// nucleo/config.ts — porta de nucleo/config.py. Nenhum parâmetro operacional
// é hard-coded: tudo vive na tabela `config`, editável em Curadoria → Configurações.
import { getServiceClient } from "@/lib/supabase/server";

const TTL_CONFIG_MS = 60_000;
let cache: { valores: Record<string, any>; expira: number } | null = null;

export async function carregarConfig(): Promise<Record<string, any>> {
  if (cache && cache.expira > Date.now()) return cache.valores;
  const { data, error } = await getServiceClient().from("config").select("chave, valor");
  if (error) throw error;
  const valores: Record<string, any> = {};
  for (const linha of data ?? []) valores[linha.chave] = linha.valor;
  cache = { valores, expira: Date.now() + TTL_CONFIG_MS };
  return valores;
}

export async function obter<T = any>(chave: string, padrao: T): Promise<T> {
  const cfg = await carregarConfig();
  return chave in cfg ? (cfg[chave] as T) : padrao;
}

export async function atualizar(chave: string, valor: any, autor: string): Promise<void> {
  const { error } = await getServiceClient()
    .from("config")
    .upsert({ chave, valor, atualizado_por: autor });
  if (error) throw error;
  limparCacheConfig();
}

export function limparCacheConfig(): void {
  cache = null;
}

export async function modeloEmbeddingAtivo() {
  const { data, error } = await getServiceClient()
    .from("modelos_embedding")
    .select("*")
    .eq("ativo", true)
    .limit(1);
  if (error) throw error;
  if (!data?.length) {
    throw new Error(
      "Nenhum modelo de embedding ativo em `modelos_embedding`. Execute sql/001_schema.sql ou ative um modelo."
    );
  }
  return data[0];
}
