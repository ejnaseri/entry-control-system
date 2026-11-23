type PdfTextItem = { str?: string };

type PdfJsModule = {
  getDocument: (options: { data: Uint8Array }) => {
    promise: Promise<{
      numPages: number;
      getPage: (pageNumber: number) => Promise<{
        getTextContent: () => Promise<{ items: PdfTextItem[] }>;
      }>;
    }>;
    destroy: () => Promise<void>;
  };
};

let pdfJsPromise: Promise<PdfJsModule> | undefined;

function loadPdfJs() {
  // TypeScript compiles this project as CommonJS, while current PDF.js is ESM-only.
  // Keeping the native dynamic import avoids transforming it into require().
  const importEsm = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<PdfJsModule>;
  pdfJsPromise ??= importEsm("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfJsPromise;
}

export async function extractPdfText(buffer: Buffer) {
  const { getDocument } = await loadPdfJs();
  const loadingTask = getDocument({ data: new Uint8Array(buffer) });
  const document = await loadingTask.promise;
  const pages: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str ?? "").join(" "));
    }
  } finally {
    await loadingTask.destroy();
  }

  return pages.join("\n").normalize("NFC").replace(/\s+/gu, " ").trim();
}

export function pdfTextIncludesWords(text: string, expected: string) {
  const words = expected.normalize("NFC").match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.length > 0 && words.every((word) => text.includes(word));
}
