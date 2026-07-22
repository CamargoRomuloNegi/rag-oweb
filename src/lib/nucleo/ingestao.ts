// nucleo/ingestao.ts — porta de nucleo/ingestao.py. Portão humano (P2):
// preparar() só parseia e audita, em memória; publicar() grava após aprovação
// explícita do curador.
import { getServiceClient } from "@/lib/supabase/server";
import { obter } from "./config";
import { sha256Hex } from "./hash";
import { parsear } from "./parser/resolucaoCgibs";
import { embeddingAtivo } from "./provedores";
import type { Dispositivo, RelatorioAuditoria } from "./types";

export async function preparar(conteudoPdf: Uint8Array, sigla: string, dataPublicacao: string) {
  const sha256 = await sha256Hex(conteudoPdf);
  const { dispositivos, anexos, relatorio } = await parsear(conteudoPdf, sigla, dataPublicacao);
  return { dispositivos, anexos, relatorio, sha256 };
}

export async function versaoJaIngerida(sha256: string): Promise<boolean> {
  const { data, error } = await getServiceClient().from("versoes_documento").select("id").eq("sha256_arquivo", sha256);
  if (error) throw error;
  return !!data?.length;
}

export async function publicar(params: {
  tipoNorma: string;
  numero: string;
  titulo: string;
  dispositivos: Dispositivo[];
  anexos: Record<string, string>;
  relatorio: RelatorioAuditoria;
  sha256: string;
  nomeArquivo: string;
  dataPublicacao: string;
  aprovadoPor: string;
  progresso?: (p: number, msg: string) => void;
}): Promise<string> {
  const {
    tipoNorma,
    numero,
    titulo,
    dispositivos,
    anexos,
    relatorio,
    sha256,
    nomeArquivo,
    dataPublicacao,
    aprovadoPor,
  } = params;
  const progresso = params.progresso ?? (() => {});
  const db = getServiceClient();

  // ── 2.1 Documento ──
  progresso(0.02, "Registrando documento e versão...");
  const { data: docRows, error: eDoc } = await db
    .from("documentos")
    .upsert({ tipo_norma: tipoNorma, numero, titulo }, { onConflict: "tipo_norma,numero" })
    .select();
  if (eDoc) throw eDoc;
  const doc = docRows![0];

  // ── 2.2 Versão em rascunho ──
  const { data: versaoRows, error: eVer } = await db
    .from("versoes_documento")
    .insert({
      documento_id: doc.id,
      sha256_arquivo: sha256,
      nome_arquivo: nomeArquivo,
      data_publicacao: dataPublicacao,
      vigencia_inicio: dataPublicacao,
      status: "rascunho",
      relatorio_auditoria: relatorio,
    })
    .select();
  if (eVer) throw eVer;
  const versaoId = versaoRows![0].id as string;

  // ── 2.3 Dispositivos em lotes ──
  progresso(0.05, "Gravando dispositivos...");
  const registros = dispositivos.map((d) => ({
    versao_id: versaoId,
    id_canonico: d.idCanonico,
    numero_artigo: d.numeroArtigo,
    livro: d.hierarquia.livro,
    titulo: d.hierarquia.titulo,
    capitulo: d.hierarquia.capitulo,
    secao: d.hierarquia.secao,
    subsecao: d.hierarquia.subsecao,
    texto: d.texto,
    hash_sha256: d.hashSha256,
    paginas: d.paginas,
  }));
  const mapaUuid: Record<string, string> = {};
  for (let i = 0; i < registros.length; i += 100) {
    const { data, error } = await db.from("dispositivos").insert(registros.slice(i, i + 100)).select();
    if (error) throw error;
    for (const r of data!) mapaUuid[r.id_canonico] = r.id;
  }

  // ── 2.4 Anexos segregados ──
  if (Object.keys(anexos).length) {
    const { error } = await db
      .from("anexos")
      .insert(Object.entries(anexos).map(([rotulo, corpo]) => ({ versao_id: versaoId, rotulo, conteudo_bruto: corpo })));
    if (error) throw error;
  }

  // ── 2.5 Vetorização em lotes ──
  const provedor = await embeddingAtivo();
  const modeloId = provedor.idModelo;
  const tamanhoLote = Number(await obter("tamanho_lote_vetorizacao", 20));
  const pausa = Number(await obter("pausa_lote_segundos", 2));
  const total = dispositivos.length;
  for (let i = 0; i < total; i += tamanhoLote) {
    const lote = dispositivos.slice(i, i + tamanhoLote);
    const vetores = await provedor.embedDocumentos(lote.map((d) => d.texto));
    const { error } = await db.from("embeddings").upsert(
      lote.map((d, idx) => ({ dispositivo_id: mapaUuid[d.idCanonico], modelo_id: modeloId, vetor: vetores[idx] }))
    );
    if (error) throw error;
    progresso(
      0.05 + 0.8 * Math.min((i + tamanhoLote) / total, 1),
      `Vetorizando dispositivos (${Math.min(i + tamanhoLote, total)}/${total})...`
    );
    if (i + tamanhoLote < total) await new Promise((r) => setTimeout(r, pausa * 1000));
  }

  // ── 2.6 Remissões → arestas do grafo ──
  progresso(0.88, "Materializando o grafo de remissões...");
  const arestas: any[] = [];
  const prefixo = dispositivos.length ? dispositivos[0].idCanonico.split("-ART")[0] : "";
  for (const d of dispositivos) {
    const origem = mapaUuid[d.idCanonico];
    for (const alvoNum of d.remissoesInternas) {
      const alvoCanonico = `${prefixo}-ART${String(alvoNum).padStart(3, "0")}`;
      arestas.push({
        origem_dispositivo_id: origem,
        tipo: "remete_interna",
        alvo_dispositivo_id: mapaUuid[alvoCanonico] ?? null,
        alvo_textual: `Art. ${alvoNum}`,
      });
    }
    for (const ref of d.remissoesExternas) {
      arestas.push({
        origem_dispositivo_id: origem,
        tipo: "remete_externa",
        alvo_dispositivo_id: null,
        alvo_textual: ref.replace(/\s+/g, " ").trim(),
      });
    }
  }
  for (let i = 0; i < arestas.length; i += 200) {
    const { error } = await db.from("remissoes").insert(arestas.slice(i, i + 200));
    if (error) throw error;
  }

  // ── 2.7 Publicação atômica de status ──
  progresso(0.96, "Publicando versão...");
  await db.from("versoes_documento").update({ status: "substituido" }).eq("documento_id", doc.id).eq("status", "publicado");
  await db
    .from("versoes_documento")
    .update({ status: "publicado", aprovado_por: aprovadoPor, aprovado_em: new Date().toISOString() })
    .eq("id", versaoId);

  progresso(1, "Concluído.");
  return versaoId;
}
