// nucleo/provedores/gemini.ts — porta de nucleo/provedores/gemini.py.
// Embeddings: gemini-embedding-2 truncado para 1024 dims + renormalização L2.
// Geração: modelo definido na config (padrão gemini-2.5-flash).
import { DIMENSOES_PADRAO, renormalizar, type EmbeddingProvider, type LLMProvider } from "./base";

function apiKey(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY não configurada nas variáveis de ambiente.");
  return k;
}

async function embedBatch(textos: string[], taskType: string): Promise<number[][]> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents?key=${apiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: textos.map((t) => ({
          model: "models/gemini-embedding-2",
          content: { parts: [{ text: t }] },
          taskType,
          outputDimensionality: DIMENSOES_PADRAO,
        })),
      }),
    }
  );
  if (!resp.ok) throw new Error(`Gemini embeddings falhou: ${resp.status} ${await resp.text()}`);
  const json = await resp.json();
  return json.embeddings.map((e: { values: number[] }) => renormalizar(e.values));
}

export class GeminiEmbedding implements EmbeddingProvider {
  idModelo = "gemini-embedding-2@1024";
  dimensoes = DIMENSOES_PADRAO;
  embedDocumentos(textos: string[]) {
    return embedBatch(textos, "RETRIEVAL_DOCUMENT");
  }
  async embedConsulta(texto: string) {
    return (await embedBatch([texto], "RETRIEVAL_QUERY"))[0];
  }
}

export class GeminiLLM implements LLMProvider {
  constructor(private modelo: string) {}

  async gerar(
    promptSistema: string,
    historico: { role: "user" | "assistant"; content: string }[],
    pergunta: string
  ): Promise<string> {
    const contents = [
      ...historico.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      })),
      { role: "user", parts: [{ text: pergunta }] },
    ];
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.modelo}:generateContent?key=${apiKey()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: promptSistema }] },
          generationConfig: { temperature: 0.1 },
        }),
      }
    );
    if (!resp.ok) throw new Error(`Gemini geração falhou: ${resp.status} ${await resp.text()}`);
    const json = await resp.json();
    const partes = json.candidates?.[0]?.content?.parts ?? [];
    const texto = partes.map((p: { text?: string }) => p.text ?? "").join("");
    return texto || "(o modelo não retornou texto)";
  }
}
