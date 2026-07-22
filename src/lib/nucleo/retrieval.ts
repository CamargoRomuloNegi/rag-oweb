// nucleo/retrieval.ts — porta de nucleo/retrieval.py. Três estágios:
// roteador determinístico → busca híbrida (RRF) → enriquecimento por grafo.
import { getServiceClient } from "@/lib/supabase/server";
import { obter } from "./config";
import { embeddingAtivo } from "./provedores";

const RX_ENDERECO_ARTIGO = /\bart(?:igo)?\.?\s*(\d{1,3})\b/gi;
const RX_OUTRA_NORMA = /\b(?:da|do)\s+(?:LC|Lei|EC|CF|Constitui[çc]ão)/i;

export async function rotearDeterministico(pergunta: string): Promise<any[]> {
  const numeros = [...pergunta.matchAll(RX_ENDERECO_ARTIGO)].map((m) => Number(m[1]));
  if (!numeros.length || RX_OUTRA_NORMA.test(pergunta)) return [];
  const unicos = [...new Set(numeros)];
  const db = getServiceClient();
  const encontrados: any[] = [];
  for (const numero of unicos) {
    const { data, error } = await db.rpc("buscar_por_artigo", { p_numero: numero });
    if (error) throw error;
    encontrados.push(...(data ?? []));
  }
  return encontrados;
}

export async function buscarHibrida(pergunta: string): Promise<any[]> {
  const provedor = await embeddingAtivo();
  const vetor = await provedor.embedConsulta(pergunta);
  const { data, error } = await getServiceClient().rpc("busca_hibrida", {
    p_texto: pergunta,
    p_embedding: vetor,
    p_modelo_id: provedor.idModelo,
    p_qtd: Number(await obter("top_k", 4)),
    p_rrf_k: Number(await obter("rrf_k", 60)),
    p_candidatos: Number(await obter("candidatos_por_ranking", 20)),
  });
  if (error) throw error;
  return data ?? [];
}

export async function enriquecerPorGrafo(dispositivos: any[]): Promise<any[]> {
  const limite = Number(await obter("limite_enriquecimento", 3));
  if (limite <= 0 || !dispositivos.length) return [];
  const ids = dispositivos.map((d) => d.dispositivo_id ?? d.id);
  const { data, error } = await getServiceClient().rpc("dispositivos_referenciados", { p_ids: ids });
  if (error) throw error;
  const jaPresentes = new Set(dispositivos.map((d) => d.id_canonico));
  const extras: any[] = [];
  const vistos = new Set<string>();
  for (const r of data ?? []) {
    if (jaPresentes.has(r.id_canonico) || vistos.has(r.id_canonico)) continue;
    vistos.add(r.id_canonico);
    extras.push(r);
    if (extras.length >= limite) break;
  }
  return extras;
}

export async function recuperar(pergunta: string): Promise<[any[], any[], string]> {
  let principais = await rotearDeterministico(pergunta);
  let rota = "deterministica";
  if (!principais.length) {
    principais = await buscarHibrida(pergunta);
    rota = "hibrida";
  }
  const referenciados = await enriquecerPorGrafo(principais);
  return [principais, referenciados, rota];
}
