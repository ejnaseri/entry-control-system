import os from "os";
import net from "net";
import crypto from "crypto";
import dns from "dns/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { DeviceConnectionType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import { logger } from "../../config/logger";
import { ZktecoK40Client } from "./zktecoK40.client";

const execFileAsync = promisify(execFile);

type LocalInterface = {
  name: string;
  address: string;
  netmask: string;
  cidr: string;
  network: string;
  prefix: number;
  addressState?: string;
  isDuplicate?: boolean;
  isLinkLocal?: boolean;
};

type NetworkIssue = {
  code:
    | "LOCAL_IP_DUPLICATE"
    | "DEVICE_IP_CONFLICT"
    | "LINK_LOCAL_ADDRESS"
    | "SUBNET_MISMATCH"
    | "DEVICE_UNREACHABLE";
  severity: "warning" | "critical";
  title: string;
  detail: string;
  recommendation: string;
  interfaceName?: string;
  address?: string;
};

type DiagnosticsResult = {
  deviceId: string;
  target: {
    host: string;
    port: number;
    resolvedIp?: string;
    isIpv4: boolean;
    warning?: string;
  };
  localInterfaces: LocalInterface[];
  subnetMatch: {
    matched: boolean | null;
    matchedInterfaces: string[];
    expectedSubnet?: { network: string; netmask: string; cidr: string };
  };
  ping: {
    status: "reachable" | "unreachable" | "timeout" | "error";
    latencyMs?: number;
    message?: string;
  };
  tcpPort: {
    status: "open" | "closed" | "timeout" | "error";
    latencyMs?: number;
    message?: string;
  };
  networkIssues: NetworkIssue[];
  recommendations: string[];
  scanTargets: ScanSubnet[];
};

type ScanSubnet = {
  network: string;
  netmask: string;
  cidr: string;
  reason: string;
  hostCount: number;
  tooLarge?: boolean;
};

type ScanCandidate = {
  ip: string;
  port: number;
  latencyMs?: number;
  verified?: boolean;
  serialNumber?: string;
};

type ScanStatus = {
  scanId: string;
  deviceId: string;
  status: "running" | "complete" | "cancelled" | "failed";
  startedAt: string;
  finishedAt?: string;
  total: number;
  completed: number;
  found: number;
  candidates: ScanCandidate[];
  subnets: ScanSubnet[];
  skippedSubnets: ScanSubnet[];
  message?: string;
};

type ScanJob = {
  scanId: string;
  deviceId: string;
  status: "running" | "complete" | "cancelled" | "failed";
  startedAt: Date;
  finishedAt?: Date;
  total: number;
  completed: number;
  found: number;
  candidates: ScanCandidate[];
  subnets: ScanSubnet[];
  skippedSubnets: ScanSubnet[];
  queue: string[];
  port: number;
  timeoutMs: number;
  delayMs: number;
  concurrency: number;
  index: number;
  inFlight: number;
  cancelled: boolean;
  expectedSerial?: string;
  password?: string;
  verifyPending: number;
};

type WindowsIpAddressRow = {
  InterfaceAlias?: unknown;
  IPAddress?: unknown;
  PrefixLength?: unknown;
  AddressState?: unknown;
};

const scanJobs = new Map<string, ScanJob>();
const SCAN_CONCURRENCY = Number(process.env["ZKTECO_SCAN_CONCURRENCY"] ?? 32);
const SCAN_TIMEOUT_MS = Number(process.env["ZKTECO_SCAN_TIMEOUT_MS"] ?? 400);
const SCAN_DELAY_MS = Number(process.env["ZKTECO_SCAN_DELAY_MS"] ?? 5);
const MAX_SCAN_HOSTS = Number(process.env["ZKTECO_SCAN_MAX_HOSTS"] ?? 1024);
const SCAN_RESULT_TTL_MS = Number(process.env["ZKTECO_SCAN_RESULT_TTL_MS"] ?? 15 * 60 * 1000);

function isZktecoConnectionType(
  connectionType: DeviceConnectionType
): connectionType is "NETWORK" | "ZKTECO_PULL_SDK" {
  return connectionType === DeviceConnectionType.NETWORK || connectionType === DeviceConnectionType.ZKTECO_PULL_SDK;
}

const ipv4Regex =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

function isIpv4(value?: string): boolean {
  if (!value) return false;
  return ipv4Regex.test(value);
}

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`Invalid IPv4 address: ${ip}`);
  }
  return (((parts[0]! << 24) >>> 0) + ((parts[1]! << 16) >>> 0) + ((parts[2]! << 8) >>> 0) + (parts[3]! >>> 0)) >>> 0;
}

function intToIpv4(value: number): string {
  const a = (value >>> 24) & 0xff;
  const b = (value >>> 16) & 0xff;
  const c = (value >>> 8) & 0xff;
  const d = value & 0xff;
  return `${a}.${b}.${c}.${d}`;
}

function maskToPrefix(netmask: string): number {
  const maskInt = ipv4ToInt(netmask);
  let count = 0;
  for (let i = 31; i >= 0; i -= 1) {
    if ((maskInt & (1 << i)) !== 0) {
      count += 1;
    }
  }
  return count;
}

function prefixToMask(prefix: number): string {
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`Invalid prefix: ${prefix}`);
  }
  if (prefix === 0) return "0.0.0.0";
  const mask = prefix === 32 ? 0xffffffff : ((0xffffffff << (32 - prefix)) >>> 0);
  return intToIpv4(mask);
}

function getNetworkAddress(ip: string, netmask: string): string {
  const ipInt = ipv4ToInt(ip);
  const maskInt = ipv4ToInt(netmask);
  return intToIpv4(ipInt & maskInt);
}

function getHostRange(network: string, prefix: number): { start: number; end: number; count: number } {
  const networkInt = ipv4ToInt(network);
  if (prefix >= 32) {
    return { start: networkInt, end: networkInt, count: 1 };
  }
  const size = 2 ** (32 - prefix);
  if (prefix === 31) {
    return { start: networkInt, end: networkInt + 1, count: 2 };
  }
  const start = networkInt + 1;
  const end = networkInt + size - 2;
  return { start, end, count: Math.max(0, end - start + 1) };
}

function parseSubnetMask(raw?: string): { netmask?: string; prefix?: number } {
  if (!raw) return {};
  const trimmed = raw.trim();
  if (!trimmed) return {};
  if (trimmed.includes(".")) {
    if (isIpv4(trimmed)) {
      return { netmask: trimmed, prefix: maskToPrefix(trimmed) };
    }
    return {};
  }
  const prefix = Number(trimmed.replace("/", ""));
  if (!Number.isFinite(prefix)) return {};
  const bounded = Math.max(0, Math.min(32, Math.floor(prefix)));
  return { netmask: prefixToMask(bounded), prefix: bounded };
}

function getLocalInterfaces(): LocalInterface[] {
  const nets = os.networkInterfaces();
  const results: LocalInterface[] = [];
  Object.entries(nets).forEach(([name, entries]) => {
    entries?.forEach((entry) => {
      if (entry.family !== "IPv4" || entry.internal) return;
      const netmask = entry.netmask ?? "255.255.255.0";
      const prefix = maskToPrefix(netmask);
      const network = getNetworkAddress(entry.address, netmask);
      results.push({
        name,
        address: entry.address,
        netmask,
        cidr: `${entry.address}/${prefix}`,
        network,
        prefix,
      });
    });
  });
  return results;
}

function isSameSubnet(ip: string, iface: LocalInterface): boolean {
  try {
    const network = getNetworkAddress(ip, iface.netmask);
    return network === iface.network;
  } catch {
    return false;
  }
}

function isLinkLocalAddress(ip: string) {
  return ip.startsWith("169.254.");
}

function normalizeWindowsRows(raw: unknown): WindowsIpAddressRow[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as WindowsIpAddressRow[];
  if (typeof raw === "object") return [raw as WindowsIpAddressRow];
  return [];
}

function normalizeAddressState(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value !== "number") return undefined;
  const knownStates: Record<number, string> = {
    0: "Invalid",
    1: "Tentative",
    2: "Duplicate",
    3: "Deprecated",
    4: "Preferred",
  };
  return knownStates[value] ?? String(value);
}

async function getWindowsIpv4Rows(): Promise<WindowsIpAddressRow[]> {
  if (process.platform !== "win32") return [];
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "$ErrorActionPreference='Stop'; Get-NetIPAddress -AddressFamily IPv4 | Select-Object InterfaceAlias,IPAddress,PrefixLength,AddressState | ConvertTo-Json -Depth 3",
      ],
      { timeout: 2500, windowsHide: true, maxBuffer: 1024 * 1024 }
    );
    const trimmed = stdout.trim();
    if (!trimmed) return [];
    return normalizeWindowsRows(JSON.parse(trimmed));
  } catch (error) {
    logger.debug?.("Unable to read Windows IPv4 address states", { message: (error as Error).message });
    return [];
  }
}

function mergeWindowsAddressStates(localInterfaces: LocalInterface[], rows: WindowsIpAddressRow[]): LocalInterface[] {
  const merged = [...localInterfaces];
  const keyFor = (name: string, address: string) => `${name.toLowerCase()}|${address}`;
  const byNameAndAddress = new Map<string, WindowsIpAddressRow>();
  const byAddress = new Map<string, WindowsIpAddressRow>();

  rows.forEach((row) => {
    const name = typeof row.InterfaceAlias === "string" ? row.InterfaceAlias : "";
    const address = typeof row.IPAddress === "string" ? row.IPAddress : "";
    if (!name || !isIpv4(address)) return;
    byNameAndAddress.set(keyFor(name, address), row);
    byAddress.set(address, row);
  });

  const seen = new Set<string>();
  const withState = merged.map((iface) => {
    seen.add(keyFor(iface.name, iface.address));
    const row = byNameAndAddress.get(keyFor(iface.name, iface.address)) ?? byAddress.get(iface.address);
    const addressState = normalizeAddressState(row?.AddressState);
    return {
      ...iface,
      ...(addressState ? { addressState, isDuplicate: addressState.toLowerCase() === "duplicate" } : {}),
      ...(isLinkLocalAddress(iface.address) ? { isLinkLocal: true } : {}),
    };
  });

  rows.forEach((row) => {
    const name = typeof row.InterfaceAlias === "string" ? row.InterfaceAlias : "";
    const address = typeof row.IPAddress === "string" ? row.IPAddress : "";
    const prefix = Number(row.PrefixLength ?? 24);
    if (!name || !isIpv4(address) || !Number.isInteger(prefix) || seen.has(keyFor(name, address))) return;
    try {
      const netmask = prefixToMask(Math.max(0, Math.min(32, prefix)));
      const network = getNetworkAddress(address, netmask);
      const addressState = normalizeAddressState(row.AddressState);
      withState.push({
        name,
        address,
        netmask,
        cidr: `${address}/${prefix}`,
        network,
        prefix,
        ...(addressState ? { addressState, isDuplicate: addressState.toLowerCase() === "duplicate" } : {}),
        ...(isLinkLocalAddress(address) ? { isLinkLocal: true } : {}),
      });
    } catch {
      // ignore malformed OS rows
    }
  });

  return withState;
}

async function getDiagnosticLocalInterfaces(): Promise<LocalInterface[]> {
  return mergeWindowsAddressStates(getLocalInterfaces(), await getWindowsIpv4Rows());
}

function normalizeHostPort(config: any): { host: string; port: number; warning?: string } {
  const rawHost = String(config?.ip ?? config?.host ?? "").trim();
  let host = rawHost;
  let port = Number(config?.port ?? 0);
  let warning: string | undefined;
  const ipv4PortMatch = rawHost.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/);
  if (ipv4PortMatch && (!port || Number.isNaN(port))) {
    host = ipv4PortMatch[1] ?? host;
    port = Number(ipv4PortMatch[2] ?? port);
    warning = "Port was parsed from host field.";
  }
  if (!port || Number.isNaN(port)) {
    port = 4370;
    warning = warning ? `${warning} Port defaulted to 4370.` : "Port missing; defaulted to 4370.";
  }
  return { host, port, ...(warning ? { warning } : {}) };
}

async function resolveHost(host: string): Promise<{ resolvedIp?: string; isIpv4: boolean; error?: string }> {
  if (isIpv4(host)) {
    return { resolvedIp: host, isIpv4: true };
  }
  try {
    const resolved = await dns.lookup(host, { family: 4 });
    if (resolved?.address && isIpv4(resolved.address)) {
      return { resolvedIp: resolved.address, isIpv4: true };
    }
    return { isIpv4: false, error: "No IPv4 address resolved." };
  } catch (error) {
    return { isIpv4: false, error: (error as Error).message };
  }
}

async function probeTcp(host: string, port: number, timeoutMs: number) {
  return new Promise<{ reachable: boolean; open: boolean; latencyMs?: number; code?: string; message?: string }>((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const start = Date.now();

    const finalize = (result: { reachable: boolean; open: boolean; latencyMs?: number; code?: string; message?: string }) => {
      if (done) return;
      done = true;
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      finalize({ reachable: true, open: true, latencyMs: Date.now() - start });
    });
    socket.once("timeout", () => {
      finalize({ reachable: false, open: false, code: "TIMEOUT", message: "Timed out" });
    });
    socket.once("error", (err) => {
      const code = (err as NodeJS.ErrnoException).code ?? "ERROR";
      if (code === "ECONNREFUSED") {
        finalize({ reachable: true, open: false, code, message: "Connection refused" });
        return;
      }
      if (code === "EHOSTUNREACH" || code === "ENETUNREACH") {
        finalize({ reachable: false, open: false, code, message: "Network unreachable" });
        return;
      }
      finalize({ reachable: false, open: false, code, message: (err as Error).message });
    });

    try {
      socket.connect(port, host);
    } catch (error) {
      finalize({ reachable: false, open: false, code: "ERROR", message: (error as Error).message });
    }
  });
}

function buildScanTargets(deviceIp: string | undefined, configSubnet: string | undefined, localIfaces: LocalInterface[]) {
  const targets: ScanSubnet[] = [];
  const seen = new Set<string>();
  const addTarget = (network: string, netmask: string, reason: string) => {
    const prefix = maskToPrefix(netmask);
    const cidr = `${network}/${prefix}`;
    const key = `${network}/${prefix}`;
    if (seen.has(key)) return;
    seen.add(key);
    const { count } = getHostRange(network, prefix);
    targets.push({ network, netmask, cidr, reason, hostCount: count });
  };

  if (deviceIp && isIpv4(deviceIp)) {
    const parsed = parseSubnetMask(configSubnet);
    const netmask = parsed.netmask ?? "255.255.255.0";
    const network = getNetworkAddress(deviceIp, netmask);
    addTarget(network, netmask, parsed.netmask ? "Device configured subnet" : "Device subnet (/24 fallback)");
  }

  localIfaces.forEach((iface) => {
    addTarget(iface.network, iface.netmask, `Local interface ${iface.name}`);
  });

  return targets;
}

function suggestPcAddress(deviceIp: string | undefined, localIfaces: LocalInterface[]) {
  if (!deviceIp || !isIpv4(deviceIp)) return "an unused address in the device subnet";
  const parts = deviceIp.split(".");
  const prefix = parts.slice(0, 3).join(".");
  const deviceLast = Number(parts[3]);
  const used = new Set(localIfaces.map((iface) => iface.address));
  const candidates = [250, 201, 10, 20, 100, 150].filter((last) => last !== deviceLast);
  const selected = candidates.find((last) => !used.has(`${prefix}.${last}`)) ?? candidates[0] ?? 250;
  return `${prefix}.${selected}`;
}

function buildNetworkIssues(params: {
  resolvedIp?: string;
  localIfaces: LocalInterface[];
  subnetMatch: boolean | null;
  probe: { reachable: boolean; open: boolean; code?: string; message?: string };
  port: number;
}): NetworkIssue[] {
  const issues: NetworkIssue[] = [];
  const { resolvedIp, localIfaces, subnetMatch, probe, port } = params;
  const suggestedPcIp = suggestPcAddress(resolvedIp, localIfaces);

  if (resolvedIp) {
    localIfaces
      .filter((iface) => iface.address === resolvedIp)
      .forEach((iface) => {
        issues.push({
          code: "DEVICE_IP_CONFLICT",
          severity: "critical",
          title: "PC and device are using the same IP address",
          detail: `The device target is ${resolvedIp}, but local interface ${iface.name} also has ${iface.address}.`,
          recommendation: `Keep the device on ${resolvedIp} and set the PC Ethernet adapter to another unused address such as ${suggestedPcIp}. Use subnet mask 255.255.255.0 and leave gateway/DNS empty for a direct cable.`,
          interfaceName: iface.name,
          address: iface.address,
        });
      });
  }

  localIfaces
    .filter((iface) => iface.isDuplicate)
    .forEach((iface) => {
      issues.push({
        code: "LOCAL_IP_DUPLICATE",
        severity: "critical",
        title: "Duplicate PC IP detected",
        detail: `Windows reports ${iface.name} ${iface.address} as Duplicate, so this address is not usable for device communication.`,
        recommendation: `Change the PC Ethernet adapter to another unused address in the same subnet, for example ${suggestedPcIp}. Then disable/enable the adapter or reconnect the cable.`,
        interfaceName: iface.name,
        address: iface.address,
      });
    });

  if (resolvedIp && subnetMatch === false) {
    const localNetworks = localIfaces.map((iface) => `${iface.network}/${iface.prefix}`).join(", ");
    issues.push({
      code: "SUBNET_MISMATCH",
      severity: "critical",
      title: "PC is not on the device subnet",
      detail: `The device is ${resolvedIp}, but no active PC interface is in that subnet. Local networks: ${localNetworks || "none"}.`,
      recommendation: `Set the PC Ethernet adapter to ${suggestedPcIp} with subnet mask 255.255.255.0, or move the device to a subnet already used by the PC.`,
    });
  }

  const hasCriticalLocalIssue = issues.some((issue) =>
    issue.code === "DEVICE_IP_CONFLICT" || issue.code === "LOCAL_IP_DUPLICATE" || issue.code === "SUBNET_MISMATCH"
  );

  const linkLocalInterfaces = localIfaces.filter((iface) => iface.isLinkLocal);
  if (resolvedIp && !resolvedIp.startsWith("169.254.") && linkLocalInterfaces.length > 0 && !probe.open && !hasCriticalLocalIssue) {
    const physicalIface =
      linkLocalInterfaces.find((iface) => /ethernet/i.test(iface.name) && !/loopback|virtual|adapter|tap/i.test(iface.name)) ??
      linkLocalInterfaces.find((iface) => !/loopback/i.test(iface.name)) ??
      linkLocalInterfaces[0];
    if (physicalIface) {
      const extraCount = linkLocalInterfaces.length - 1;
      issues.push({
        code: "LINK_LOCAL_ADDRESS",
        severity: "warning",
        title: "Self-assigned Windows network address detected",
        detail:
          extraCount > 0
            ? `${physicalIface.name} has ${physicalIface.address}. ${extraCount} other local interface(s) also use 169.254 addresses.`
            : `${physicalIface.name} has ${physicalIface.address}. This usually means Windows did not get or use the intended IPv4 configuration on that adapter.`,
        recommendation: `For direct K40 connection, set the PC Ethernet adapter manually to ${suggestedPcIp}, subnet mask 255.255.255.0, gateway empty, DNS empty. Then reconnect the cable.`,
        interfaceName: physicalIface.name,
        address: physicalIface.address,
      });
    }
  }

  if (!probe.open && !hasCriticalLocalIssue) {
    const status = probe.code === "TIMEOUT" ? "timed out" : probe.message ?? "was not reachable";
    issues.push({
      code: "DEVICE_UNREACHABLE",
      severity: "warning",
      title: `TCP port ${port} is not open`,
      detail: `The device probe ${status}.`,
      recommendation: "Verify device power, Ethernet cable, device IP, TCP communication port 4370, and any comm key/password.",
    });
  }

  return issues;
}

async function verifySerial(ip: string, port: number, password: string | undefined, expectedSerial: string, timeoutMs: number) {
  const client = new ZktecoK40Client({
    id: `scan:${ip}`,
    host: ip,
    port,
    ...(password !== undefined ? { password } : {}),
    timeoutMs,
  });
  try {
    const result = await client.testConnection();
    if (!result.ok) {
      return { verified: false };
    }
    const info = result.info as Record<string, unknown> | undefined;
    const serial =
      info?.["serialNumber"] ??
      info?.["serial"] ??
      info?.["sn"] ??
      info?.["SN"] ??
      info?.["deviceSN"] ??
      info?.["deviceSerialNumber"];
    if (serial && String(serial).trim() === expectedSerial.trim()) {
      return { verified: true, serialNumber: String(serial).trim() };
    }
    return { verified: false, serialNumber: serial ? String(serial).trim() : undefined };
  } catch (error) {
    logger.debug?.("Serial verification failed", { ip, message: (error as Error).message });
    return { verified: false };
  } finally {
    await client.disconnect().catch(() => {});
  }
}

function buildRecommendations(params: {
  resolvedIp?: string;
  localIfaces: LocalInterface[];
  subnetMatch: boolean | null;
  pingReachable: boolean;
  networkIssues: NetworkIssue[];
}) {
  const suggestions: string[] = [];
  const { resolvedIp, localIfaces, subnetMatch, pingReachable, networkIssues } = params;
  const addSuggestion = (value: string) => {
    if (!suggestions.includes(value)) {
      suggestions.push(value);
    }
  };

  networkIssues.forEach((issue) => addSuggestion(issue.recommendation));

  if (!localIfaces.length) {
    addSuggestion("No active IPv4 interface detected. Enable a NIC and retry.");
    return suggestions;
  }

  if (resolvedIp && subnetMatch === false) {
    const localNetworks = localIfaces.map((iface) => `${iface.network}/${iface.prefix}`).join(", ");
    addSuggestion(`PC is not on the same network as device ${resolvedIp}.`);
    addSuggestion(`Set your PC NIC to the device subnet or move the device to your current subnet (local: ${localNetworks}).`);
    addSuggestion("Alternatively, add routing (router/bridge) or a second NIC between the two subnets.");
    addSuggestion(`Example: set PC to ${resolvedIp.split(".").slice(0, 3).join(".")}.x to match the device subnet.`);
  } else if (!pingReachable) {
    addSuggestion("Device did not respond to reachability check. Verify cabling, power, and NIC link status.");
  }

  return suggestions;
}

function summarizeProbe(result: { reachable: boolean; open: boolean; code?: string; message?: string }) {
  if (result.open) {
    return { ping: { status: "reachable" as const }, port: { status: "open" as const } };
  }
  if (result.reachable && !result.open) {
    return { ping: { status: "reachable" as const }, port: { status: "closed" as const } };
  }
  if (result.code === "TIMEOUT") {
    return { ping: { status: "timeout" as const }, port: { status: "timeout" as const } };
  }
  return { ping: { status: "unreachable" as const }, port: { status: "error" as const } };
}

export async function diagnoseDeviceConnectivity(deviceId: string): Promise<DiagnosticsResult> {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) {
    throw new HttpError(404, "Device not found");
  }

  if (!isZktecoConnectionType(device.connectionType)) {
    throw new HttpError(400, "Diagnostics are only supported for network devices");
  }

  const cfg: any = device.config ?? {};
  const { host, port, warning } = normalizeHostPort(cfg);
  if (!host) {
    throw new HttpError(400, "Device host is missing");
  }

  const resolved = await resolveHost(host);
  const localInterfaces = await getDiagnosticLocalInterfaces();
  const resolvedIp = resolved.resolvedIp;
  const isIpv4Host = resolved.isIpv4 && Boolean(resolvedIp);

  const matchedInterfaces = isIpv4Host
    ? localInterfaces.filter((iface) => isSameSubnet(resolvedIp as string, iface)).map((iface) => iface.name)
    : [];
  const subnetMatched = isIpv4Host ? matchedInterfaces.length > 0 : null;

  let expectedSubnet: { network: string; netmask: string; cidr: string } | undefined;
  if (isIpv4Host) {
    const parsed = parseSubnetMask(cfg.subnet);
    const netmask = parsed.netmask ?? "255.255.255.0";
    const network = getNetworkAddress(resolvedIp as string, netmask);
    const prefix = maskToPrefix(netmask);
    expectedSubnet = { network, netmask, cidr: `${network}/${prefix}` };
  }

  const probe = await probeTcp(resolvedIp ?? host, port, Math.min(Number(cfg.timeoutMs ?? 1500), 5000));
  const summary = summarizeProbe(probe);
  const networkIssues = buildNetworkIssues({
    ...(resolvedIp ? { resolvedIp } : {}),
    localIfaces: localInterfaces,
    subnetMatch: subnetMatched,
    probe,
    port,
  });

  const recommendations = buildRecommendations({
    ...(resolvedIp ? { resolvedIp } : {}),
    localIfaces: localInterfaces,
    subnetMatch: subnetMatched,
    pingReachable: summary.ping.status === "reachable",
    networkIssues,
  });

  const scanTargets = buildScanTargets(resolvedIp, cfg.subnet, localInterfaces).map((target) => ({
    ...target,
    tooLarge: target.hostCount > MAX_SCAN_HOSTS,
  }));

  return {
    deviceId: device.id,
    target: {
      host,
      port,
      ...(resolvedIp ? { resolvedIp } : {}),
      isIpv4: isIpv4Host,
      ...((warning ?? resolved.error) ? { warning: warning ?? resolved.error } : {}),
    },
    localInterfaces,
    subnetMatch: {
      matched: subnetMatched,
      matchedInterfaces,
      ...(expectedSubnet ? { expectedSubnet } : {}),
    },
    ping: {
      status: summary.ping.status,
      ...(probe.latencyMs !== undefined ? { latencyMs: probe.latencyMs } : {}),
      ...(probe.message !== undefined ? { message: probe.message } : {}),
    },
    tcpPort: {
      status: summary.port.status,
      ...(probe.latencyMs !== undefined ? { latencyMs: probe.latencyMs } : {}),
      ...(probe.message !== undefined ? { message: probe.message } : {}),
    },
    networkIssues,
    recommendations,
    scanTargets,
  };
}

function jobToStatus(job: ScanJob): ScanStatus {
  return {
    scanId: job.scanId,
    deviceId: job.deviceId,
    status: job.status,
    startedAt: job.startedAt.toISOString(),
    ...(job.finishedAt ? { finishedAt: job.finishedAt.toISOString() } : {}),
    total: job.total,
    completed: job.completed,
    found: job.found,
    candidates: job.candidates,
    subnets: job.subnets,
    skippedSubnets: job.skippedSubnets,
  };
}

function finishJob(job: ScanJob, status: ScanJob["status"], message?: string) {
  job.status = status;
  job.finishedAt = new Date();
  if (message) {
    logger.info("Scan finished", { scanId: job.scanId, status, message });
  }
  setTimeout(() => {
    scanJobs.delete(job.scanId);
  }, SCAN_RESULT_TTL_MS).unref?.();
}

function runScan(job: ScanJob) {
  const pump = () => {
    if (job.cancelled) {
      if (job.inFlight === 0 && job.verifyPending === 0) {
        finishJob(job, "cancelled");
      }
      return;
    }

    while (job.inFlight < job.concurrency && job.index < job.queue.length) {
      const ip = job.queue[job.index];
      job.index += 1;
      if (!ip) continue;
      job.inFlight += 1;

      probeTcp(ip, job.port, job.timeoutMs)
        .then((result) => {
          job.completed += 1;
          if (result.open) {
            job.found += 1;
            const candidate: ScanCandidate = {
              ip,
              port: job.port,
              ...(result.latencyMs !== undefined ? { latencyMs: result.latencyMs } : {}),
            };
            job.candidates.push(candidate);
            if (job.expectedSerial) {
              job.verifyPending += 1;
              verifySerial(ip, job.port, job.password, job.expectedSerial, Math.max(job.timeoutMs, 1500))
                .then((verified) => {
                  if (job.cancelled) return;
                  candidate.verified = verified.verified;
                  if (verified.serialNumber) {
                    candidate.serialNumber = verified.serialNumber;
                  }
                })
                .finally(() => {
                  job.verifyPending -= 1;
                  if (job.index >= job.queue.length && job.inFlight === 0 && job.verifyPending === 0 && !job.cancelled) {
                    finishJob(job, "complete");
                  }
                });
            }
          }
        })
        .catch((error) => {
          job.completed += 1;
          logger.debug?.("Scan probe error", { ip, message: (error as Error).message });
        })
        .finally(() => {
          job.inFlight -= 1;
          if (job.index >= job.queue.length && job.inFlight === 0 && job.verifyPending === 0 && !job.cancelled) {
            finishJob(job, "complete");
            return;
          }
          setTimeout(pump, job.delayMs);
        });
    }
  };

  pump();
}

export async function startDeviceScan(deviceId: string): Promise<ScanStatus> {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) {
    throw new HttpError(404, "Device not found");
  }
  if (!isZktecoConnectionType(device.connectionType)) {
    throw new HttpError(400, "Scan is only supported for network devices");
  }

  const cfg: any = device.config ?? {};
  const { host, port } = normalizeHostPort(cfg);
  const resolved = await resolveHost(host);
  const localInterfaces = await getDiagnosticLocalInterfaces();
  const subnets = buildScanTargets(resolved.resolvedIp, cfg.subnet, localInterfaces);

  const queue: string[] = [];
  const skippedSubnets: ScanSubnet[] = [];
  const seen = new Set<string>();

  subnets.forEach((subnet) => {
    const prefix = maskToPrefix(subnet.netmask);
    const { start, end, count } = getHostRange(subnet.network, prefix);
    if (count > MAX_SCAN_HOSTS) {
      skippedSubnets.push({ ...subnet, hostCount: count, tooLarge: true });
      return;
    }
    for (let value = start; value <= end; value += 1) {
      const ip = intToIpv4(value);
      if (seen.has(ip)) continue;
      seen.add(ip);
      queue.push(ip);
    }
  });

  if (queue.length === 0) {
    return {
      scanId: "",
      deviceId,
      status: "failed",
      startedAt: new Date().toISOString(),
      total: 0,
      completed: 0,
      found: 0,
      candidates: [],
      subnets,
      skippedSubnets,
      message: "No scan targets available. Check subnet size or configuration.",
    };
  }

  const scanId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
  const expectedSerial = device.serialNumber?.trim();
  const password = cfg.password ?? cfg.pass ?? cfg.commKey;
  const job: ScanJob = {
    scanId,
    deviceId,
    status: "running",
    startedAt: new Date(),
    total: queue.length,
    completed: 0,
    found: 0,
    candidates: [],
    subnets,
    skippedSubnets,
    queue,
    port,
    timeoutMs: SCAN_TIMEOUT_MS,
    delayMs: SCAN_DELAY_MS,
    concurrency: SCAN_CONCURRENCY,
    index: 0,
    inFlight: 0,
    cancelled: false,
    ...(expectedSerial ? { expectedSerial } : {}),
    ...(password !== undefined ? { password } : {}),
    verifyPending: 0,
  };

  scanJobs.set(scanId, job);
  runScan(job);
  return jobToStatus(job);
}

export function getDeviceScan(scanId: string): ScanStatus {
  const job = scanJobs.get(scanId);
  if (!job) {
    throw new HttpError(404, "Scan not found or expired");
  }
  return jobToStatus(job);
}

export function cancelDeviceScan(scanId: string): ScanStatus {
  const job = scanJobs.get(scanId);
  if (!job) {
    throw new HttpError(404, "Scan not found or expired");
  }
  job.cancelled = true;
  job.status = "cancelled";
  if (job.inFlight === 0 && job.verifyPending === 0) {
    finishJob(job, "cancelled");
  }
  return jobToStatus(job);
}
