// nucleo/provedores/bgeM3Local.ts — porta de nucleo/provedores/bge_m3_local.py.
//
// ⚠️ O modelo BGE-M3 (sentence-transformers, ~2GB) exige um runtime Python
// com o modelo carregado em memória — INCOMPATÍVEL com funções serverless da
// Vercel (mesma restrição que o app original já tinha no Streamlit Community
// Cloud, ver ADR-007/ADR-008). Mantido aqui apenas para preservar a interface
// e o caminho de saída: um deploy self-hosted (VPS com Node ou um microsserviço
// Python à parte) pode implementar este adaptador de verdade.
import { DIMENSOES_PADRAO, type EmbeddingProvider } from "./base";

export class BgeM3Embedding implements EmbeddingProvider {
  idModelo = "bge-m3@1024";
  dimensoes = DIMENSOES_PADRAO;

  private indisponivel(): never {
    throw new Error(
      "O provedor 'bge_m3' exige um runtime com o modelo local carregado — não suportado em " +
        "funções serverless da Vercel. Troque 'provedor_embedding' para 'gemini' ou 'openai_compat' " +
        "em Curadoria → Configurações, ou aponte para um serviço self-hosted que implemente este adaptador."
    );
  }

  embedDocumentos(_textos: string[]): Promise<number[][]> {
    this.indisponivel();
  }
  embedConsulta(_texto: string): Promise<number[]> {
    this.indisponivel();
  }
}
