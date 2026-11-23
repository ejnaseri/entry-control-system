import { existsSync } from "node:fs";

import PDFDocument from "pdfkit";

type XlsxCellValue = string | number | boolean | null | undefined;

export type XlsxSheet = {
  name: string;
  rows: Array<Array<XlsxCellValue>>;
};

export function buildCsv(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>) {
  const lines: string[] = [headers.map((value) => escapeCsvCell(String(value))).join(",")];
  rows.forEach((row) => {
    lines.push(row.map((value) => escapeCsvCell(value == null ? "" : String(value))).join(","));
  });
  return lines.join("\n");
}

export function buildXlsxBuffer(sheets: XlsxSheet[]) {
  const normalizedSheets = sheets.map((sheet, index) => ({
    name: sanitizeSheetName(sheet.name || `Sheet${index + 1}`),
    rows: sheet.rows,
  }));

  const entries: Array<{ name: string; data: Buffer }> = [];
  entries.push({
    name: "[Content_Types].xml",
    data: Buffer.from(buildContentTypesXml(normalizedSheets.length), "utf8"),
  });
  entries.push({
    name: "_rels/.rels",
    data: Buffer.from(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        "</Relationships>",
      "utf8"
    ),
  });
  entries.push({
    name: "xl/workbook.xml",
    data: Buffer.from(buildWorkbookXml(normalizedSheets), "utf8"),
  });
  entries.push({
    name: "xl/_rels/workbook.xml.rels",
    data: Buffer.from(buildWorkbookRelsXml(normalizedSheets.length), "utf8"),
  });
  entries.push({
    name: "xl/styles.xml",
    data: Buffer.from(buildStylesXml(), "utf8"),
  });

  normalizedSheets.forEach((sheet, index) => {
    entries.push({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: Buffer.from(buildSheetXml(sheet.rows), "utf8"),
    });
  });

  return buildZip(entries);
}

export async function buildSimplePdf(lines: string[], title: string) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
    bufferPages: false,
    info: { Title: title },
  });

  const chunks: Buffer[] = [];
  const bufferReady = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const fontPath = resolvePdfFontPath();
  const needsUnicode = [title, ...lines].some((value) => /[^\x00-\x7f]/.test(value));
  if (fontPath) {
    doc.registerFont("ReportUnicode", fontPath);
    doc.font("ReportUnicode");
  } else if (needsUnicode) {
    throw new Error("Unicode PDF font was not found. Set REPORT_PDF_FONT_PATH to a .ttf font file.");
  } else {
    doc.font("Helvetica");
  }

  doc.fontSize(12).text(title, { lineGap: 4 });
  doc.moveDown(0.7);
  doc.fontSize(10);
  lines.forEach((line) => {
    doc.text(line || " ", { lineGap: 3 });
  });
  doc.end();

  return bufferReady;
}

export function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildFilenameStamp(date: Date) {
  return date.toISOString().replace(/[:T]/g, "-").slice(0, 19);
}

function buildContentTypesXml(sheetCount: number) {
  const sheets = Array.from({ length: sheetCount }, (_, idx) => {
    const i = idx + 1;
    return `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  }).join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    sheets +
    "</Types>"
  );
}

function buildWorkbookXml(sheets: Array<{ name: string }>) {
  const rows = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    )
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets>${rows}</sheets>` +
    "</workbook>"
  );
}

function buildWorkbookRelsXml(sheetCount: number) {
  const sheetRels = Array.from({ length: sheetCount }, (_, idx) => {
    const i = idx + 1;
    return `<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`;
  }).join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheetRels +
    `<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    "</Relationships>"
  );
}

function buildStylesXml() {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    "</styleSheet>"
  );
}

function buildSheetXml(rows: Array<Array<XlsxCellValue>>) {
  const xmlRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, colIndex) => buildSheetCell(value, rowIndex + 1, colIndex + 1))
        .filter(Boolean)
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${xmlRows}</sheetData>` +
    "</worksheet>"
  );
}

function buildSheetCell(value: XlsxCellValue, row: number, col: number) {
  if (value === null || value === undefined) return "";
  const ref = `${toExcelColumnName(col)}${row}`;
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  if (typeof value === "boolean") {
    return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }
  const text = escapeXml(String(value));
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
}

function toExcelColumnName(index: number) {
  let col = "";
  let n = index;
  while (n > 0) {
    const mod = (n - 1) % 26;
    col = String.fromCharCode(65 + mod) + col;
    n = Math.floor((n - mod) / 26);
  }
  return col;
}

function sanitizeSheetName(name: string) {
  const sanitized = name.replace(/[\\/?*\[\]:]/g, " ").trim();
  return sanitized.slice(0, 31) || "Sheet";
}

function buildZip(entries: Array<{ name: string; data: Buffer }>) {
  const fileParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  entries.forEach((entry) => {
    const fileName = Buffer.from(entry.name, "utf8");
    const data = entry.data;
    const crc = crc32(data);
    const dos = toDosDateTime(new Date());

    const localHeader = Buffer.alloc(30 + fileName.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dos.time, 10);
    localHeader.writeUInt16LE(dos.date, 12);
    localHeader.writeUInt32LE(crc >>> 0, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);
    fileName.copy(localHeader, 30);

    fileParts.push(localHeader, data);

    const centralHeader = Buffer.alloc(46 + fileName.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dos.time, 12);
    centralHeader.writeUInt16LE(dos.date, 14);
    centralHeader.writeUInt32LE(crc >>> 0, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    fileName.copy(centralHeader, 46);
    centralParts.push(centralHeader);

    localOffset += localHeader.length + data.length;
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

function toDosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { time: dosTime, date: dosDate };
}

let crcTable: number[] | null = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  const table: number[] = [];
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  crcTable = table;
  return table;
}

function crc32(buffer: Buffer) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    const byte = buffer[i];
    if (byte === undefined) continue;
    crc = table[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function resolvePdfFontPath() {
  const candidates = [
    process.env["REPORT_PDF_FONT_PATH"],
    "C:\\Windows\\Fonts\\arial.ttf",
    "C:\\Windows\\Fonts\\segoeui.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf",
  ].filter((value): value is string => Boolean(value));

  return candidates.find((candidate) => existsSync(candidate));
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
