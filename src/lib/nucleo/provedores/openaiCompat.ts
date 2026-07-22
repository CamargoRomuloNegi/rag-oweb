// nucleo/provedores/openaiCompat.ts — porta de nucleo/provedores/openai_compat.py.
// Cobre qualquer serviço no padrão OpenAI: OpenAI, Maritaca (Sabiá), Ollama, vLLM...
import { DIMENSOES_PADRAO, renormalizar, type EmbeddingProvider, type LLMProvider } from "./base";

const TIMEOUT_MS = 120_000;

function baseUrl(): string {
  const u = process.env.OPENAI_COMPAT_BASE_URL;
  if (!u) throw new Error("OPENAI_COMPAT_BASE_URL não configurada nas variáveis de ambiente.");
  return u.replace(/\/$/, "");
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.OPENAI_COMPAT_API_KEY ?? ""}`,
    "Content-Type": "application/json",
  };
}

async function fetchComTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

export class OpenAICompatEmbedding implements EmbeddingProvider {
  idModelo: string;
  dimensoes = DIMENSOES_PADRAO;

  constructor(private nomeModelo: string) {
    this.idModelo = `openai_compat:${nomeModelo}@${DIMENSOES_PADRAO}`;
  }

  private async embed(textos: string[]): Promise<number[][]> {
    const resp = await fetchComTimeout(`${baseUrl()}/embeddings`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ model: this.nomeModelo, input: textos, dimensions: this.dimensoes }),
    });
    if (!resp.ok) throw new Error(`openai_compat embeddings falhou: ${resp.status} ${await resp.text()}`);
    const json = await resp.json();
    const dados = [...json.data].sort((a: any, b: any) => a.index - b.index);
    return dados.map((d: any) => {
      const v = (d.embedding as number[]).slice(0, this.dimensoes);
      if (v.length !== this.dimensoes) {
        throw new Error(
          `O modelo '${this.nomeModelo}' retornou ${v.length} dimensões; a plataforma exige ${this.dimensoes}. Escolha um modelo compatível.`
        );
      }
      return renormalizar(v);
    });
  }

  embedDocumentos(textos: string[]) {
    return this.embed(textos);
  }
  async embedConsulta(texto: string) {
    return (await this.embed([texto]))[0];
  }
}

export class OpenAICompatLLM implements LLMProvider {
  constructor(private modelo: string) {}

  async gerar(
    promptSistema: string,
    historico: { role: "user" | "assistant"; content: string }[],
    pergunta: string
  ): Promise<string> {
    const mensagens = [
      { role: "system", content: promptSistema },
      ...historico,
      { role: "user", content: pergunta },
    ];
    const resp = await fetchComTimeout(`${baseUrl()}/chat/completions`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ model: this.modelo, messages: mensagens, temperature: 0.1 }),
    });
    if (!resp.ok) throw new Error(`openai_compat geração falhou: ${resp.status} ${await resp.text()}`);
    const json = await resp.json();
    return json.choices[0].message.content as string;
  }
}
