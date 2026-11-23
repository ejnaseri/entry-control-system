import { deflateRawSync } from "node:zlib";

export type ZipArchiveEntry = {
  name: string;
  data: Buffer | string;
};

export function buildZipArchive(entries: ZipArchiveEntry[], modifiedAt = new Date()) {
  if (entries.length > 0xffff) {
    throw new Error("ZIP archive contains too many entries");
  }

  const fileParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  entries.forEach((entry) => {
    assertSafeEntryName(entry.name);
    const fileName = Buffer.from(entry.name, "utf8");
    const source = typeof entry.data === "string" ? Buffer.from(entry.data, "utf8") : entry.data;
    const deflated = source.length > 0 ? deflateRawSync(source, { level: 6 }) : source;
    const shouldCompress = deflated.length < source.length;
    const storedData = shouldCompress ? deflated : source;
    const compressionMethod = shouldCompress ? 8 : 0;
    const crc = crc32(source);
    const dos = toDosDateTime(modifiedAt);
    const utf8Flag = 0x0800;

    const localHeader = Buffer.alloc(30 + fileName.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(utf8Flag, 6);
    localHeader.writeUInt16LE(compressionMethod, 8);
    localHeader.writeUInt16LE(dos.time, 10);
    localHeader.writeUInt16LE(dos.date, 12);
    localHeader.writeUInt32LE(crc >>> 0, 14);
    localHeader.writeUInt32LE(storedData.length, 18);
    localHeader.writeUInt32LE(source.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);
    fileName.copy(localHeader, 30);
    fileParts.push(localHeader, storedData);

    const centralHeader = Buffer.alloc(46 + fileName.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(utf8Flag, 8);
    centralHeader.writeUInt16LE(compressionMethod, 10);
    centralHeader.writeUInt16LE(dos.time, 12);
    centralHeader.writeUInt16LE(dos.date, 14);
    centralHeader.writeUInt32LE(crc >>> 0, 16);
    centralHeader.writeUInt32LE(storedData.length, 20);
    centralHeader.writeUInt32LE(source.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    fileName.copy(centralHeader, 46);
    centralParts.push(centralHeader);

    localOffset += localHeader.length + storedData.length;
  });

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(localOffset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...fileParts, centralDirectory, endRecord]);
}

function assertSafeEntryName(name: string) {
  const normalized = name.replace(/\\/gu, "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("../") || normalized.includes("\0")) {
    throw new Error(`Unsafe ZIP entry name: ${name}`);
  }
}

function toDosDateTime(date: Date) {
  const year = Math.min(2107, Math.max(1980, date.getFullYear()));
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  const time = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { time, date: dosDate };
}

let crcTable: number[] | null = null;

function crc32(data: Buffer) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = table[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    return value >>> 0;
  });
  return crcTable;
}
