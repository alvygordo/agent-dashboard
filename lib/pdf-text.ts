export type PdfParseResult = {
  text: string
  pageCount: number
}

export async function parsePdfBuffer(buffer: Buffer): Promise<PdfParseResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (
    buf: Buffer,
  ) => Promise<{ text: string; numpages: number }>
  const data = await pdfParse(buffer)
  return {
    text: (data.text ?? '').trim(),
    pageCount: data.numpages ?? 0,
  }
}
