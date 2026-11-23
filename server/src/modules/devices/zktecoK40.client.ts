import ZKLib from "zklib-js";
import { COMMANDS } from "zklib-js/constants";
import type { Socket as TcpSocket } from "net";
import type { Socket as UdpSocket } from "dgram";
import { logger } from "../../config/logger";
import type { DeviceClient, DeviceEvent, DeviceEventType } from "../../shared/devices.types";
import { formatDeviceError } from "./deviceError";

type RawAttendance = Record<string, unknown>;
type RawUser = Record<string, unknown>;

type ZkUser = {
  uid: number;
  userId: string;
  name?: string;
  role?: number;
  password?: string;
  cardno?: number;
  raw: RawUser;
};

type UpsertUserInput = {
  uid?: number;
  userId: string | number;
  name: string;
  password?: string;
  role?: number;
  cardno?: number | string;
};

type EnrollFingerprintInput = {
  uid?: number;
  userId?: string | number;
  fingerId?: number;
};

export class ZktecoK40Client implements DeviceClient {
  public readonly id: string;
  private readonly host: string;
  private readonly port: number;
  private readonly password: string | undefined;
  private readonly timeoutMs: number;
  private zk: any;
  private connected = false;
  private lastTimestamp?: number;
  private lastRecordId?: number;
  private lastTimestampEventKeys = new Set<string>();
  private lastFetchedEvents: DeviceEvent[] = [];

  constructor(params: { id: string; host: string; port: number; password?: string; timeoutMs?: number }) {
    this.id = params.id;
    this.host = params.host;
    this.port = params.port;
    this.password = params.password;
    this.timeoutMs = params.timeoutMs ?? 10000;

    this.zk = new ZKLib(this.host, this.port, this.timeoutMs, this.password ? Number(this.password) : 0);
  }

  async connect(): Promise<void> {
    try {
      this.cleanupSockets();
      await this.zk.createSocket();
      this.connected = true;
      logger.info("[ZKTECO] Connected to device", { device: this.id, host: this.host, port: this.port });
    } catch (error) {
      this.connected = false;
      const message = formatDeviceError(error, `Unable to connect to ${this.host}:${this.port}`);
      logger.error("[ZKTECO] Failed to connect", { device: this.id, host: this.host, port: this.port, message });
      throw error instanceof Error && error.message.trim() ? error : new Error(message);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.zk.disconnect();
      this.connected = false;
      logger.info("[ZKTECO] Disconnected", { device: this.id });
    } catch (error) {
      this.connected = false;
      logger.warn("[ZKTECO] Disconnect failed", { device: this.id, message: formatDeviceError(error) });
    } finally {
      this.cleanupSockets();
    }
  }

  async testConnection(): Promise<{ ok: boolean; info?: unknown; message?: string }> {
    const wasConnected = this.connected;
    try {
      if (!wasConnected) {
        await this.connect();
      }
      const info = await this.zk.getInfo();
      return { ok: true, info };
    } catch (error) {
      return { ok: false, message: formatDeviceError(error, "Device connection test failed without details") };
    } finally {
      if (!wasConnected) {
        await this.disconnect();
      }
    }
  }

  async getDeviceTime(): Promise<Date> {
    return this.zk.getTime();
  }

  async setDeviceTime(time: Date): Promise<void> {
    const encoded = this.encodeDeviceTime(time);
    const payload = Buffer.alloc(4);
    payload.writeUInt32LE(encoded, 0);
    await this.zk.executeCmd(COMMANDS["CMD_SET_TIME"], payload);
  }

  async unlockDoor(seconds = 3): Promise<void> {
    const duration = Number.isFinite(seconds) ? Math.max(1, Math.min(60, Math.trunc(seconds))) : 3;
    const payload = Buffer.alloc(4);
    payload.writeUInt32LE(duration, 0);
    await this.zk.executeCmd(COMMANDS["CMD_UNLOCK"], payload);
  }

  async listUsers(): Promise<ZkUser[]> {
    const result = await this.withTcpListenerCleanup(() => this.zk.getUsers());
    const rows = this.readDataArray<RawUser>(result);
    return rows.map((row) => this.normalizeUser(row));
  }

  async upsertUser(input: UpsertUserInput): Promise<void> {
    const users = await this.listUsers();
    const userId = String(input.userId);
    let uid = input.uid;

    if (!uid) {
      const existing = users.find((user) => user.userId === userId);
      if (existing?.uid) {
        uid = existing.uid;
      }
    }

    if (!uid) {
      const numericUserId = Number(userId);
      if (Number.isInteger(numericUserId) && numericUserId > 0 && numericUserId <= 3000) {
        uid = numericUserId;
      } else {
        const maxUid = users.reduce((max, user) => (user.uid > max ? user.uid : max), 0);
        uid = maxUid + 1;
      }
    }

    if (!uid || uid <= 0 || uid > 3000) {
      throw new Error("Unable to resolve a device uid for the user");
    }

    const password = input.password ?? "";
    const role = input.role ?? 0;
    const cardno = input.cardno ?? 0;

    const result = await this.zk.setUser(uid, userId, input.name, password, role, cardno);
    if (result === false) {
      throw new Error("Device rejected user payload");
    }
  }

  async deleteUser(input: { uid?: number; userId?: string | number }): Promise<void> {
    let uid = input.uid;
    const userId = input.userId !== undefined ? String(input.userId) : undefined;

    if (!uid && userId) {
      const users = await this.listUsers();
      const found = users.find((user) => user.userId === userId);
      uid = found?.uid;
    }

    if (!uid) {
      throw new Error("Unable to resolve uid for deletion");
    }

    const payload = Buffer.alloc(2);
    payload.writeUInt16LE(uid, 0);
    await this.zk.executeCmd(COMMANDS["CMD_DELETE_USER"], payload);
  }

  async enrollFingerprint(input: EnrollFingerprintInput): Promise<void> {
    const fingerId = typeof input.fingerId === "number" ? input.fingerId : 0;
    let userId = input.userId !== undefined ? String(input.userId) : undefined;

    if (!userId && input.uid !== undefined) {
      const users = await this.listUsers();
      userId = users.find((user) => user.uid === input.uid)?.userId;
    }

    if (!userId) {
      throw new Error("Unable to resolve userId for enrollment");
    }

    const payload = this.buildEnrollPayload(userId, fingerId);
    await this.zk.executeCmd(COMMANDS["CMD_STARTENROLL"], payload);
  }

  async fetchAttendanceLogs(): Promise<DeviceEvent[]> {
    const rows = await this.fetchAttendanceRows();
    return rows
      .map((row) => this.buildEvent(row))
      .filter((event): event is DeviceEvent => Boolean(event));
  }

  async clearAttendanceLogs(): Promise<void> {
    await this.zk.clearAttendanceLog();
  }

  async fetchNewEvents(): Promise<DeviceEvent[]> {
    try {
      const rows = await this.fetchAttendanceRows();
      const events: DeviceEvent[] = [];
      this.lastFetchedEvents = [];

      for (const row of rows) {
        const event = this.buildEvent(row);
        if (!event) continue;

        const recordId = event.recordId;
        if (this.lastRecordId && recordId && recordId <= this.lastRecordId) {
          continue;
        }
        if (!recordId && this.lastTimestamp) {
          const eventTimestamp = event.timestamp.getTime();
          if (eventTimestamp < this.lastTimestamp) continue;
          if (
            eventTimestamp === this.lastTimestamp &&
            this.lastTimestampEventKeys.has(this.buildTimestampEventKey(event))
          ) {
            continue;
          }
        }
        events.push(event);
      }

      this.lastFetchedEvents = events;

      if (events.length === 0) {
        logger.debug?.("[ZKTECO] No new attendance rows", { device: this.id });
      }

      return events;
    } catch (error) {
      logger.error("[ZKTECO] Failed to fetch attendance", { device: this.id, message: formatDeviceError(error) });
      throw error;
    }
  }

  private async fetchAttendanceRows(): Promise<RawAttendance[]> {
    const result = await this.withTcpListenerCleanup(() => this.zk.getAttendances());
    return this.readDataArray<RawAttendance>(result);
  }

  setCursor(cursor: { lastRecordId?: number; lastTimestamp?: Date }) {
    if (typeof cursor.lastRecordId === "number") {
      this.lastRecordId = cursor.lastRecordId;
    }
    if (cursor.lastTimestamp instanceof Date && !Number.isNaN(cursor.lastTimestamp.getTime())) {
      const nextTimestamp = cursor.lastTimestamp.getTime();
      if (this.lastTimestamp === undefined || nextTimestamp > this.lastTimestamp) {
        this.lastTimestamp = nextTimestamp;
        this.lastTimestampEventKeys = new Set(
          this.lastFetchedEvents
            .filter((event) => event.recordId === undefined && event.timestamp.getTime() === nextTimestamp)
            .map((event) => this.buildTimestampEventKey(event))
        );
      } else if (nextTimestamp === this.lastTimestamp) {
        for (const event of this.lastFetchedEvents) {
          if (event.recordId === undefined && event.timestamp.getTime() === nextTimestamp) {
            this.lastTimestampEventKeys.add(this.buildTimestampEventKey(event));
          }
        }
      }
    }
    this.lastFetchedEvents = [];
  }

  private buildTimestampEventKey(event: DeviceEvent): string {
    return `${event.externalUserId}\u0000${event.timestamp.toISOString()}\u0000${event.eventType}`;
  }

  private normalizeUser(row: RawUser): ZkUser {
    const uid = this.coerceNumber(row["uid"] ?? row["userSn"] ?? row["id"] ?? row["user_id"]) ?? 0;
    const userId =
      this.coerceString(row["userId"] ?? row["user_id"] ?? row["pin"] ?? row["deviceUserId"] ?? row["uidNumber"]) ??
      (uid ? String(uid) : "");
    const name = this.coerceString(row["name"] ?? row["username"] ?? row["UserName"]);
    const role = this.coerceNumber(row["role"] ?? row["userRole"] ?? row["privilege"]);
    const password = this.coerceString(row["password"] ?? row["pass"]);
    const cardno = this.coerceNumber(row["cardno"] ?? row["cardNumber"] ?? row["card"]);

    const normalized: ZkUser = {
      uid,
      userId,
      raw: row,
    };
    if (typeof name === "string") {
      normalized.name = name;
    }
    if (typeof role === "number") {
      normalized.role = role;
    }
    if (typeof password === "string") {
      normalized.password = password;
    }
    if (typeof cardno === "number") {
      normalized.cardno = cardno;
    }
    return normalized;
  }

  private buildEvent(row: RawAttendance): DeviceEvent | null {
    const timestamp = this.parseTimestamp(row);
    const externalUserId = this.extractUserId(row);
    if (!timestamp || !externalUserId) {
      return null;
    }

    const recordId = this.extractRecordId(row);
    const event: DeviceEvent = {
      deviceId: this.id,
      externalUserId,
      timestamp,
      eventType: this.mapType(row),
      raw: row,
      ...(typeof recordId === "number" ? { recordId } : {}),
    };
    return event;
  }

  private buildEnrollPayload(userId: string, fingerId: number): Buffer {
    const connectionType = this.zk?.connectionType;
    if (connectionType === "udp") {
      const payload = Buffer.alloc(5);
      const numericUserId = Number(userId);
      if (!Number.isFinite(numericUserId)) {
        throw new Error("Enrollment requires numeric userId for UDP mode");
      }
      payload.writeUInt32LE(numericUserId, 0);
      payload.writeUInt8(fingerId, 4);
      return payload;
    }

    const payload = Buffer.alloc(26);
    Buffer.from(userId, "ascii").copy(payload, 0, 0, 24);
    payload.writeUInt8(fingerId, 24);
    payload.writeUInt8(1, 25);
    return payload;
  }

  private getTcpSocket(): TcpSocket | null {
    const socket = this.zk?.zklibTcp?.socket;
    if (!socket) return null;
    return socket as TcpSocket;
  }

  private getUdpSocket(): UdpSocket | null {
    const socket = this.zk?.zklibUdp?.socket;
    if (!socket) return null;
    return socket as UdpSocket;
  }

  private withTcpListenerCleanup<T>(action: () => Promise<T>): Promise<T> {
    if (this.zk?.connectionType === "tcp") {
      this.pruneTcpListeners();
    }
    return action().finally(() => {
      if (this.zk?.connectionType === "tcp") {
        this.pruneTcpListeners();
      }
    });
  }

  private pruneTcpListeners(): void {
    const socket = this.getTcpSocket();
    if (!socket) return;

    const dataListeners = socket.listeners("data");
    for (const listener of dataListeners) {
      socket.removeListener("data", listener as (...args: unknown[]) => void);
    }

    const closeListeners = socket.listeners("close");
    if (closeListeners.length > 1) {
      for (let i = 1; i < closeListeners.length; i += 1) {
        socket.removeListener("close", closeListeners[i] as (...args: unknown[]) => void);
      }
    }

    const errorListeners = socket.listeners("error");
    if (errorListeners.length > 1) {
      for (let i = 1; i < errorListeners.length; i += 1) {
        socket.removeListener("error", errorListeners[i] as (...args: unknown[]) => void);
      }
    }
  }

  private cleanupSockets(): void {
    const tcpSocket = this.getTcpSocket();
    if (tcpSocket) {
      tcpSocket.removeAllListeners();
      if (!tcpSocket.destroyed) {
        tcpSocket.destroy();
      }
      if (this.zk?.zklibTcp) {
        this.zk.zklibTcp.socket = null;
      }
    }

    const udpSocket = this.getUdpSocket();
    if (udpSocket) {
      udpSocket.removeAllListeners();
      try {
        udpSocket.close();
      } catch {
        // ignore close failures for already-closed sockets
      }
      if (this.zk?.zklibUdp) {
        this.zk.zklibUdp.socket = null;
      }
    }
  }

  private encodeDeviceTime(date: Date): number {
    return (
      ((date.getFullYear() % 100) * 12 * 31 + date.getMonth() * 31 + date.getDate() - 1) * (24 * 60 * 60) +
      (date.getHours() * 60 + date.getMinutes()) * 60 +
      date.getSeconds()
    );
  }

  private coerceNumber(value: unknown): number | null {
    if (value === undefined || value === null) {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  private coerceString(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const str = String(value);
    return str.length > 0 ? str : null;
  }

  private readDataArray<T>(value: unknown): T[] {
    if (Array.isArray(value)) {
      return value as T[];
    }
    if (value && typeof value === "object") {
      const data = (value as Record<string, unknown>)["data"];
      if (Array.isArray(data)) {
        return data as T[];
      }
    }
    return [];
  }

  private extractUserId(row: RawAttendance): string | null {
    const candidate =
      row["userId"] ??
      row["user_id"] ??
      row["uid"] ??
      row["deviceUserId"] ??
      row["pin"] ??
      row["userSn"] ??
      row["UserID"] ??
      row["user"] ??
      row["uidNumber"];

    if (candidate === undefined || candidate === null) {
      return null;
    }

    return String(candidate);
  }

  private parseTimestamp(row: RawAttendance): Date | null {
    const value =
      row["recordTime"] ??
      row["timestamp"] ??
      row["time"] ??
      row["attTime"] ??
      row["date"] ??
      row["AttTime"] ??
      row["LogTime"] ??
      row["checkTime"];

    if (!value) {
      return null;
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }

    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  }

  private extractRecordId(row: RawAttendance): number | null {
    const candidate = row["id"] ?? row["recordId"] ?? row["LogID"] ?? row["AttLogId"] ?? row["logid"] ?? row["serialNumber"];
    if (candidate === undefined || candidate === null) return null;
    const num = Number(candidate);
    return Number.isNaN(num) ? null : num;
  }

  private mapType(row: RawAttendance): DeviceEventType {
    const rawType = row["type"] ?? row["attType"] ?? row["verifyType"] ?? row["AttType"] ?? row["event"];
    if (typeof rawType === "string") {
      const t = rawType.toLowerCase();
      if (t.includes("out")) return "CHECK_OUT";
      if (t.includes("in")) return "CHECK_IN";
    }
    if (typeof rawType === "number") {
      if (rawType === 0) return "CHECK_IN";
      if (rawType === 1) return "CHECK_OUT";
    }
    return "UNKNOWN";
  }
}
