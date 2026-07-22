// nucleo/geracao.ts — porta de nucleo/geracao.py. Renderiza o template
// versionado (prompts/) com o contexto recuperado e chama o LLM ativo.
import fs from "node:fs/promises";
import path from "node:path";
import { obter } from "./config";
import { llmAtivo } from "./provedores";

async function carregarTemplate(): Promise<string> {
  const nome = await obter("prompt_consulta", "consulta_v1");
  const caminho = path.join(process.cwd(), "prompts", `${nome}.md`);
  try {
    return await fs.readFile(caminho, "utf-8");
  } catch {
    throw new Error(
      `Template de prompt '${nome}.md' não encontrado em prompts/. Verifique a chave 'prompt_consulta' na configuração.`
    );
  }
}

function montarContexto(principais: any[], referenciados: any[]): string {
  const blocos = principais.map((d) => {
    const endereco = [d.livro, d.titulo, d.capitulo, d.secao, d.subsecao].filter(Boolean).join(" › ");
    return `[${d.id_canonico}] ${endereco}\n${d.texto}`;
  });
  if (referenciados.length) {
    blocos.push("--- DISPOSITIVOS REFERENCIADOS PELOS ANTERIORES (grafo de remissões) ---");
    for (const d of referenciados) blocos.push(`[${d.id_canonico}] (referenciado)\n${d.texto}`);
  }
  return blocos.join("\n\n");
}

export async function responder(
  pergunta: string,
  principais: any[],
  referenciados: any[],
  historico: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const template = await carregarTemplate();
  const promptSistema = template.replace("{contexto}", montarContexto(principais, referenciados));
  const maximo = Number(await obter("historico_maximo", 6));
  const historicoRecente = maximo > 0 ? historico.slice(-maximo) : [];
  const provedor = await llmAtivo();
  return provedor.gerar(promptSistema, historicoRecente, pergunta);
}
