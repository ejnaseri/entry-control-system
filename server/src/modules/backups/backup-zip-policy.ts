import { open } from "node:fs/promises";
import { HttpError } from "../../middlewares/error-handler";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_FILE_SIGNATURE = 0x02014b50;
const MAX_EOCD_SEARCH_BYTES = 65_557;

export const BACKUP_ZIP_LIMITS = Object.freeze({
  maxEntries: 64,
  maxFiles: 24,
  maxDirectoryDepth: 4,
  maxExpandedBytes: 32 * 1024 * 1024 * 1024,
  maxCompressionRatio: 200,
  maxCentralDirectoryBytes: 8 * 1024 * 1024,
});

const REQUIRED_FILE_NAMES = new Set(["database.dump", "manifest.json", "backup.log"]);
const OPTIONAL_FILE_NAME = /^(?:support-summary\.json|(?:restore-test-report|production-restore-report|production-restore-handoff|post-restore-check)_[A-Za-z0-9_-]+\.json)$/u;

function rejectZip(message: string): never {
  throw new HttpError(400, message);
}

function findEndOfCentralDirectory(buffer: Buffer) {
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  return -1;
}

function normalizeEntryPath(rawName: string) {
  const normalized = rawName.replace(/\\/gu, "/");
  if (
    !normalized ||
    normalized.includes("\0") ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//u.test(normalized)
  ) {
    rejectZip("Backup ZIP contains an unsafe path");
  }

  const isDirectory = normalized.endsWith("/");
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === "..")) {
    rejectZip("Backup ZIP contains an unsafe path");
  }
  if (parts.length > BACKUP_ZIP_LIMITS.maxDirectoryDepth + (isDirectory ? 0 : 1)) {
    rejectZip("Backup ZIP directory depth exceeds the allowed limit");
  }

  if (!isDirectory) {
    const leaf = parts.at(-1) ?? "";
    if (!REQUIRED_FILE_NAMES.has(leaf) && !OPTIONAL_FILE_NAME.test(leaf)) {
      rejectZip(`Backup ZIP contains unsupported file: ${leaf}`);
    }
  }

  return { normalized, isDirectory };
}

export type BackupZipPreflight = {
  entryCount: number;
  fileCount: number;
  expandedBytes: number;
};

/** Reads only ZIP metadata. This must pass before an extraction directory is created. */
export async function inspectBackupZipBeforeExtraction(archivePath: string): Promise<BackupZipPreflight> {
  const handle = await open(archivePath, "r");
  try {
    const archiveStat = await handle.stat();
    const tailLength = Math.min(archiveStat.size, MAX_EOCD_SEARCH_BYTES);
    if (tailLength < 22) rejectZip("Backup ZIP is incomplete");

    const tail = Buffer.alloc(tailLength);
    await handle.read(tail, 0, tailLength, archiveStat.size - tailLength);
    const eocdOffset = findEndOfCentralDirectory(tail);
    if (eocdOffset < 0) rejectZip("Backup ZIP central directory is missing");

    const diskNumber = tail.readUInt16LE(eocdOffset + 4);
    const centralDisk = tail.readUInt16LE(eocdOffset + 6);
    const diskEntries = tail.readUInt16LE(eocdOffset + 8);
    const totalEntries = tail.readUInt16LE(eocdOffset + 10);
    const centralSize = tail.readUInt32LE(eocdOffset + 12);
    const centralOffset = tail.readUInt32LE(eocdOffset + 16);
    const commentLength = tail.readUInt16LE(eocdOffset + 20);
    if (eocdOffset + 22 + commentLength !== tail.length) rejectZip("Backup ZIP has an invalid trailer");
    if (diskNumber !== 0 || centralDisk !== 0 || diskEntries !== totalEntries) rejectZip("Multi-disk Backup ZIP files are not supported");
    if (totalEntries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) rejectZip("ZIP64 Backup imports are not supported");
    if (totalEntries > BACKUP_ZIP_LIMITS.maxEntries) rejectZip("Backup ZIP contains too many entries");
    if (centralSize > BACKUP_ZIP_LIMITS.maxCentralDirectoryBytes) rejectZip("Backup ZIP central directory is too large");
    if (centralOffset + centralSize > archiveStat.size - tailLength + eocdOffset) rejectZip("Backup ZIP central directory is invalid");

    const central = Buffer.alloc(centralSize);
    await handle.read(central, 0, centralSize, centralOffset);
    let cursor = 0;
    let fileCount = 0;
    let expandedBytes = 0;
    const names = new Set<string>();

    for (let index = 0; index < totalEntries; index += 1) {
      if (cursor + 46 > central.length || central.readUInt32LE(cursor) !== CENTRAL_FILE_SIGNATURE) rejectZip("Backup ZIP central directory is malformed");
      const madeBy = central.readUInt16LE(cursor + 4);
      const flags = central.readUInt16LE(cursor + 8);
      const compressedBytes = central.readUInt32LE(cursor + 20);
      const uncompressedBytes = central.readUInt32LE(cursor + 24);
      const nameLength = central.readUInt16LE(cursor + 28);
      const extraLength = central.readUInt16LE(cursor + 30);
      const entryCommentLength = central.readUInt16LE(cursor + 32);
      const externalAttributes = central.readUInt32LE(cursor + 38);
      const recordLength = 46 + nameLength + extraLength + entryCommentLength;
      if (cursor + recordLength > central.length || nameLength === 0) rejectZip("Backup ZIP central directory is malformed");
      if ((flags & 0x1) !== 0) rejectZip("Encrypted Backup ZIP entries are not supported");

      const platform = madeBy >>> 8;
      const unixMode = externalAttributes >>> 16;
      if (platform === 3 && (unixMode & 0xf000) === 0xa000) rejectZip("Backup ZIP symbolic links are not allowed");

      const rawName = central.subarray(cursor + 46, cursor + 46 + nameLength).toString((flags & 0x800) !== 0 ? "utf8" : "latin1");
      const entry = normalizeEntryPath(rawName);
      const duplicateKey = entry.normalized.toLowerCase();
      if (names.has(duplicateKey)) rejectZip("Backup ZIP contains duplicate paths");
      names.add(duplicateKey);

      if (!entry.isDirectory) {
        fileCount += 1;
        if (fileCount > BACKUP_ZIP_LIMITS.maxFiles) rejectZip("Backup ZIP contains too many files");
        expandedBytes += uncompressedBytes;
        if (expandedBytes > BACKUP_ZIP_LIMITS.maxExpandedBytes) rejectZip("Backup ZIP expanded size exceeds the allowed limit");
        if (uncompressedBytes > 0 && (compressedBytes === 0 || uncompressedBytes / compressedBytes > BACKUP_ZIP_LIMITS.maxCompressionRatio)) {
          rejectZip("Backup ZIP compression ratio is unsafe");
        }
      }
      cursor += recordLength;
    }

    if (cursor !== central.length) rejectZip("Backup ZIP central directory has unexpected data");
    return { entryCount: totalEntries, fileCount, expandedBytes };
  } finally {
    await handle.close();
  }
}
