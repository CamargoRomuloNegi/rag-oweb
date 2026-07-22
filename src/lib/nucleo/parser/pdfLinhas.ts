// nucleo/parser/pdfLinhas.ts — extrai (página, linha) de um PDF, agrupando
// itens de texto por posição vertical (equivalente ao pdfplumber.extract_text()
// usado no parser original).
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extrairLinhas(bytes: Uint8Array): Promise<[number, string][]> {
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
  const linhas: [number, string][] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const itens = content.items as { transform: number[]; str: string }[];

    // Agrupa itens cuja coordenada Y difere por menos de 2px na mesma linha.
    const grupos: { y: number; itens: { x: number; str: string }[] }[] = [];
    for (const it of itens) {
      const y = it.transform[5];
      const x = it.transform[4];
      let grupo = grupos.find((g) => Math.abs(g.y - y) < 2);
      if (!grupo) {
        grupo = { y, itens: [] };
        grupos.push(grupo);
      }
      grupo.itens.push({ x, str: it.str });
    }
    grupos.sort((a, b) => b.y - a.y);
    for (const g of grupos) {
      const linha = g.itens
        .sort((a, b) => a.x - b.x)
        .map((i) => i.str)
        .join("")
        .trim();
      if (linha) linhas.push([p, linha]);
    }
  }
  return linhas;
}
