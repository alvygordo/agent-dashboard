export type PdfParseResult = {
  text: string
  pageCount: number
  pageTexts: string[]
}

export async function parsePdfBuffer(buffer: Buffer): Promise<PdfParseResult> {
  const pageTexts: string[] = []

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (
    buf: Buffer,
    opts?: {
      pagerender?: (pageData: {
        getTextContent: () => Promise<{ items: { str: string; transform: number[] }[] }>
      }) => Promise<string>
    },
  ) => Promise<{ text: string; numpages: number }>

  const data = await pdfParse(buffer, {
    pagerender(pageData) {
      return pageData.getTextContent().then((textContent) => {
        let lastY: number | undefined
        let text = ''
        for (const item of textContent.items) {
          if (lastY === item.transform[5] || !lastY) {
            text += item.str
          } else {
            text += `\n${item.str}`
          }
          lastY = item.transform[5]
        }
        pageTexts.push(text.trim())
        return text
      })
    },
  })

  return {
    text: (data.text ?? '').trim(),
    pageCount: data.numpages ?? pageTexts.length,
    pageTexts,
  }
}
