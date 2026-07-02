export type PdfParseResult = {
  text: string
  pageCount: number
}

export async function parsePdfBuffer(buffer: Buffer): Promise<PdfParseResult> {
  // Require the parser directly — pdf-parse/index.js runs a debug self-test when
  // bundled (module.parent is undefined), which breaks on Vercel with ENOENT.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (
    buf: Buffer,
  ) => Promise<{ text: string; numpages: number }>
  const data = await pdfParse(buffer)
  return {
    text: (data.text ?? '').trim(),
    pageCount: data.numpages ?? 0,
  }
}
