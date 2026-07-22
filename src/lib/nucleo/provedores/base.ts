// nucleo/provedores/base.ts — porta de nucleo/provedores/base.py.
// Contratos (portas) que isolam a plataforma do fornecedor de IA (princípio P3).
export const DIMENSOES_PADRAO = 1024;

export interface EmbeddingProvider {
  idModelo: string;
  dimensoes: number;
  embedDocumentos(textos: string[]): Promise<number[][]>;
  embedConsulta(texto: string): Promise<number[]>;
}

export interface LLMProvider {
  gerar(
    promptSistema: string,
    historico: { role: "user" | "assistant"; content: string }[],
    pergunta: string
  ): Promise<string>;
}

/** Renormaliza para norma unitária — obrigatório após truncamento Matryoshka (ADR-004). */
export function renormalizar(vetor: number[]): number[] {
  const norma = Math.sqrt(vetor.reduce((s, v) => s + v * v, 0)) || 1;
  return vetor.map((v) => v / norma);
}
