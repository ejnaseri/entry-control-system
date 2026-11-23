const UTF8_BOM = "\uFEFF";

export function downloadCsv(csv: string, filename: string) {
  const excelFriendlyCsv = csv.replace(/\r?\n/g, "\r\n");
  const content = excelFriendlyCsv.startsWith(UTF8_BOM) ? excelFriendlyCsv : `${UTF8_BOM}${excelFriendlyCsv}`;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
