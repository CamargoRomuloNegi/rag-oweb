// nucleo/provedores/index.ts — porta de nucleo/provedores/__init__.py (fábrica).
// Único ponto onde a config vira instâncias concretas — troca de provedor é
// uma edição na tabela `config`, zero código.
import { obter } from "../config";
import type { EmbeddingProvider, LLMProvider } from "./base";

export async function embeddingAtivo(): Promise<EmbeddingProvider> {
  const provedor = await obter("provedor_embedding", "gemini");

  if (provedor === "gemini") {
    const { GeminiEmbedding } = await import("./gemini");
    return new GeminiEmbedding();
  }
  if (provedor === "bge_m3") {
    const { BgeM3Embedding } = await import("./bgeM3Local");
    return new BgeM3Embedding();
  }
  if (provedor === "openai_compat") {
    const { OpenAICompatEmbedding } = await import("./openaiCompat");
    const modelo = await obter("modelo_embedding_openai_compat", "text-embedding-3-large");
    return new OpenAICompatEmbedding(modelo);
  }
  throw new Error(
    `Provedor de embedding desconhecido na config: '${provedor}'. Valores aceitos: gemini | bge_m3 | openai_compat.`
  );
}

export async function llmAtivo(): Promise<LLMProvider> {
  const provedor = await obter("provedor_llm", "gemini");
  const modelo = await obter("modelo_llm", "gemini-2.5-flash");

  if (provedor === "gemini") {
    const { GeminiLLM } = await import("./gemini");
    return new GeminiLLM(modelo);
  }
  if (provedor === "openai_compat") {
    const { OpenAICompatLLM } = await import("./openaiCompat");
    return new OpenAICompatLLM(modelo);
  }
  throw new Error(`Provedor de LLM desconhecido na config: '${provedor}'. Valores aceitos: gemini | openai_compat.`);
}
