import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import {
  AttendanceType,
  DeviceConnectionType,
  DeviceRawLogStatus,
  DeviceStatus,
  DeviceType,
  MemberType,
} from "@prisma/client";
import {
  buildDeviceSupportBundle,
  type DeviceSupportBundleBuildInput,
  type DeviceSupportBundleLanguage,
} from "./deviceSupportBundle.service";

const generatedAt = new Date("2026-07-16T12:34:56.000Z");

function buildInput(language: DeviceSupportBundleLanguage): DeviceSupportBundleBuildInput {
  return {
    query: {
      deviceId: "cmdevice00000000000000001",
      status: DeviceRawLogStatus.FAILED,
      from: "2026-07-01",
      to: "2026-07-16",
      search: "timeout",
      limit: 500,
      language,
    },
    totalMatched: 3,
    statusCounts: {
      PENDING: 0,
      PROCESSED: 0,
      SKIPPED_DUPLICATE: 0,
      SKIPPED_INVALID: 0,
      FAILED: 3,
    },
    generatedAt,
    devices: [
      {
        id: "cmdevice00000000000000001",
        name: "K40 Main Door",
        type: DeviceType.FINGERPRINT,
        connectionType: DeviceConnectionType.ZKTECO_PULL_SDK,
        enabled: true,
        status: DeviceStatus.ERROR,
        model: "K40",
        serialNumber: "SN-100",
        config: {
          ip: "192.168.1.200",
          port: 4370,
          password: "device-password-must-not-leak",
          nested: { apiToken: "token-must-not-leak" },
        },
        lastSeenAt: new Date("2026-07-16T12:00:00.000Z"),
        lastSuccessfulPollAt: new Date("2026-07-16T12:00:00.000Z"),
        lastEventReceivedAt: new Date("2026-07-16T11:59:00.000Z"),
        lastEventProcessedAt: new Date("2026-07-16T11:59:01.000Z"),
        lastErrorAt: new Date("2026-07-16T12:01:00.000Z"),
        lastErrorMessage: "Connection timeout",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-07-16T12:01:00.000Z"),
      },
    ],
    rawLogs: [
      {
        id: "cmrawlog00000000000000001",
        deviceId: "cmdevice00000000000000001",
        recordedAt: new Date("2026-07-16T11:59:00.000Z"),
        createdAt: new Date("2026-07-16T11:59:02.000Z"),
        processedAt: new Date("2026-07-16T11:59:03.000Z"),
        dataHash: "abc123hash",
        status: DeviceRawLogStatus.FAILED,
        processError: "Unknown device user",
        payload: {
          externalUserId: "=2+2",
          eventType: "IN",
          recordId: 77,
          memberName: "Member Name Must Not Leak",
          password: "payload-password-must-not-leak",
          fingerprintTemplate: "biometric-template-must-not-leak",
          nested: { authorization: "bearer-secret-must-not-leak" },
        },
        device: {
          id: "cmdevice00000000000000001",
          name: "K40 Main Door",
          status: DeviceStatus.ERROR,
        },
        attendance: {
          id: "cmattendance0000000000001",
          entryType: AttendanceType.IN,
          isAuthorized: false,
          reason: "Unknown device user",
          recordedAt: new Date("2026-07-16T11:59:00.000Z"),
          deviceUser: { externalId: 42 },
          member: { code: "M-001", memberType: MemberType.CUSTOMER },
        },
      },
    ],
  };
}

function readZipEntries(buffer: Buffer) {
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    const stored = buffer.subarray(dataStart, dataStart + compressedSize);
    const data = method === 8 ? inflateRawSync(stored) : stored;
    assert.equal(data.length, uncompressedSize, `Unexpected uncompressed size for ${name}`);
    entries.set(name, data);
    offset = dataStart + compressedSize;
  }
  return entries;
}

function testBundleStructureAndRedaction() {
  const result = buildDeviceSupportBundle(buildInput("en"));
  assert.equal(result.filename, "atlasgym-device-support-20260716-123456Z.zip");
  assert.equal(result.totalMatched, 3);
  assert.equal(result.exportedCount, 1);
  assert.equal(result.truncated, true);
  assert.equal(result.deviceCount, 1);
  assert.equal(result.buffer.readUInt32LE(0), 0x04034b50);

  const entries = readZipEntries(result.buffer);
  assert.deepEqual(Array.from(entries.keys()), [
    "README.txt",
    "support-summary.json",
    "raw-device-logs.json",
    "raw-device-logs.csv",
  ]);

  const allText = Array.from(entries.values()).map((value) => value.toString("utf8")).join("\n");
  [
    "device-password-must-not-leak",
    "token-must-not-leak",
    "payload-password-must-not-leak",
    "Member Name Must Not Leak",
    "biometric-template-must-not-leak",
    "bearer-secret-must-not-leak",
  ].forEach((secret) => assert.equal(allText.includes(secret), false, `Support bundle leaked ${secret}`));

  const summary = JSON.parse(entries.get("support-summary.json")!.toString("utf8")) as {
    devices: Array<{ config: { password: string; nested: { apiToken: string } } }>;
    safety: { secretsExcluded: boolean; memberNamesExcluded: boolean; biometricTemplatesExcluded: boolean };
    export: { truncated: boolean; exportedCount: number };
  };
  assert.equal(summary.devices[0]?.config.password, "[REDACTED]");
  assert.equal(summary.devices[0]?.config.nested.apiToken, "[REDACTED]");
  assert.equal(summary.safety.secretsExcluded, true);
  assert.equal(summary.safety.memberNamesExcluded, true);
  assert.equal(summary.safety.biometricTemplatesExcluded, true);
  assert.equal(summary.export.truncated, true);
  assert.equal(summary.export.exportedCount, 1);

  const rawLogs = JSON.parse(entries.get("raw-device-logs.json")!.toString("utf8")) as {
    records: Array<{ payload: { password: string; fingerprintTemplate: string; nested: { authorization: string } } }>;
  };
  assert.equal(rawLogs.records[0]?.payload.password, "[REDACTED]");
  assert.equal(rawLogs.records[0]?.payload.fingerprintTemplate, "[REDACTED]");
  assert.equal(rawLogs.records[0]?.payload.nested.authorization, "[REDACTED]");

  const csv = entries.get("raw-device-logs.csv")!.toString("utf8");
  assert.equal(csv.startsWith("\ufeff"), true);
  assert.match(csv, /"Log ID","Device"/u);
  assert.match(csv, /"'=2\+2"/u);
}

function testLocalizedBundleText() {
  const expectations: Array<{ language: DeviceSupportBundleLanguage; csv: RegExp; readme: RegExp }> = [
    { language: "en", csv: /"Processing status"/u, readme: /AtlasGym device support bundle/u },
    { language: "fa", csv: /"وضعیت پردازش"/u, readme: /بسته پشتیبانی دستگاه AtlasGym/u },
    { language: "ps", csv: /"د پروسس حالت"/u, readme: /د AtlasGym د وسیلې د ملاتړ بسته/u },
  ];

  expectations.forEach(({ language, csv, readme }) => {
    const entries = readZipEntries(buildDeviceSupportBundle(buildInput(language)).buffer);
    assert.match(entries.get("raw-device-logs.csv")!.toString("utf8"), csv);
    assert.match(entries.get("README.txt")!.toString("utf8"), readme);
  });
}

const tests: Array<{ name: string; execute: () => void }> = [
  { name: "support bundle structure and redaction", execute: testBundleStructureAndRedaction },
  { name: "support bundle localized text", execute: testLocalizedBundleText },
];

tests.forEach(({ name, execute }) => {
  execute();
  console.log(`✓ ${name}`);
});

console.log(`Device support bundle tests passed (${tests.length}/${tests.length}).`);
