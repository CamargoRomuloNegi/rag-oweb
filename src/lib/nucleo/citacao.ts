// nucleo/citacao.ts — porta de nucleo/citacao.py. Integridade de citação (P1):
// o texto legal exibido nunca vem do LLM; sua integridade é reconferida por hash.
import { sha256Hex } from "./hash";

export async function verificar(d: { texto: string; hash_sha256: string }): Promise<boolean> {
  return (await sha256Hex(d.texto)) === d.hash_sha256;
}

export async function selo(d: { texto: string; hash_sha256: string }): Promise<string> {
  return (await verificar(d))
    ? "✅ íntegro (hash verificado)"
    : "⚠️ FALHA DE INTEGRIDADE — o texto não confere com o hash da ingestão";
}

export function enderecoHierarquico(d: {
  livro?: string;
  titulo?: string;
  capitulo?: string;
  secao?: string;
  subsecao?: string;
}): string {
  return [d.livro, d.titulo, d.capitulo, d.secao, d.subsecao].filter(Boolean).join(" › ");
}
