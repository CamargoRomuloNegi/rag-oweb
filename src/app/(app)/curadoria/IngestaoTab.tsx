"use client";
import { useState } from "react";
import Metric from "@/components/Metric";
import { IconAlert, IconCheck, IconChevronDown, IconUpload } from "@/components/icons";

interface Preparo {
  dispositivos: any[];
  anexos: Record<string, string>;
  relatorio: any;
  sha256: string;
  duplicado: boolean;
  nomeArquivo: string;
  tipoNorma: string;
  numero: string;
  titulo: string;
  dataPub: string;
}

export default function IngestaoTab({ usuarioEmail }: { usuarioEmail: string }) {
  const [tipoNorma, setTipoNorma] = useState("Resolução CGIBS");
  const [numero, setNumero] = useState("");
  const [titulo, setTitulo] = useState("");
  const [sigla, setSigla] = useState("");
  const [dataPub, setDataPub] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);

  const [analisando, setAnalisando] = useState(false);
  const [preparo, setPreparo] = useState<Preparo | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  const [avisosAbertos, setAvisosAbertos] = useState(false);

  const [publicando, setPublicando] = useState(false);
  const [progresso, setProgresso] = useState<{ p: number; msg: string } | null>(null);
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null);

  async function analisar(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo || !numero || !sigla) {
      setResultado({ ok: false, msg: "Preencha o PDF, o número e a sigla antes de analisar." });
      return;
    }
    setResultado(null);
    setPreparo(null);
    setAnalisando(true);
    try {
      const form = new FormData();
      form.append("arquivo", arquivo);
      form.append("sigla", sigla.trim());
      form.append("dataPub", dataPub);
      const resp = await fetch("/api/ingestao/analisar", { method: "POST", body: form });
      if (!resp.ok) throw new Error((await resp.json()).error ?? "Falha ao analisar.");
      const dados = await resp.json();
      setPreparo({ ...dados, tipoNorma, numero: numero.trim(), titulo: titulo.trim(), dataPub });
    } catch (err: any) {
      setResultado({ ok: false, msg: err.message ?? String(err) });
    } finally {
      setAnalisando(false);
    }
  }

  async function publicar() {
    if (!preparo) return;
    setPublicando(true);
    setProgresso({ p: 0, msg: "Iniciando publicação..." });
    setResultado(null);
    try {
      const resp = await fetch("/api/ingestao/publicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoNorma: preparo.tipoNorma,
          numero: preparo.numero,
          titulo: preparo.titulo,
          dispositivos: preparo.dispositivos,
          anexos: preparo.anexos,
          relatorio: preparo.relatorio,
          sha256: preparo.sha256,
          nomeArquivo: preparo.nomeArquivo,
          dataPublicacao: preparo.dataPub,
        }),
      });
      if (!resp.body) throw new Error("Sem resposta do servidor.");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let versaoId: string | null = null;
      let erroFinal: string | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const linhas = buffer.split("\n");
        buffer = linhas.pop() ?? "";
        for (const linha of linhas) {
          if (!linha.trim()) continue;
          const evento = JSON.parse(linha);
          if (evento.error) erroFinal = evento.error;
          else if (evento.done) versaoId = evento.versaoId;
          else setProgresso({ p: evento.p, msg: evento.msg });
        }
      }
      if (erroFinal) throw new Error(erroFinal);
      setResultado({ ok: true, msg: `Versão publicada com sucesso (id ${versaoId}).` });
      setPreparo(null);
      setConfirmar(false);
    } catch (err: any) {
      setResultado({ ok: false, msg: `Falha na publicação: ${err.message ?? err}` });
    } finally {
      setPublicando(false);
      setProgresso(null);
    }
  }

  const rel = preparo?.relatorio;

  return (
    <div className="space-y-6">
      <h2 className="font-display text-lg text-ink">Ingestão de novo documento normativo</h2>

      <form onSubmit={analisar} className="space-y-4 rounded-2xl border border-border bg-surface p-6">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-8 text-center transition hover:border-primary/40">
          <IconUpload className="h-6 w-6 text-muted" />
          <span className="text-sm font-medium text-ink">{arquivo ? arquivo.name : "PDF da norma"}</span>
          <span className="text-xs text-muted">Clique para selecionar um arquivo .pdf</span>
          <input type="file" accept="application/pdf" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Tipo de norma</label>
              <select
                value={tipoNorma}
                onChange={(e) => setTipoNorma(e.target.value)}
                className="w-full rounded-lg border border-border bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
              >
                <option>Resolução CGIBS</option>
                <option>LC</option>
                <option>Nota Técnica</option>
              </select>
              <p className="mt-1 text-xs text-muted">
                No MVP, o parser hierárquico cobre Resoluções CGIBS. Perfis para LC (via LexML) e Notas Técnicas:
                Fase 2.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Número (ex.: 6/2026)</label>
              <input
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className="w-full rounded-lg border border-border bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Título/ementa (opcional)</label>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="w-full rounded-lg border border-border bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Sigla para os IDs canônicos (ex.: RES6-2026)</label>
              <input
                value={sigla}
                onChange={(e) => setSigla(e.target.value)}
                className="w-full rounded-lg border border-border bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
              />
              <p className="mt-1 text-xs text-muted">Prefixo estável dos dispositivos: RES6-2026 → RES6-2026-ART186.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Data de publicação</label>
              <input
                type="date"
                value={dataPub}
                onChange={(e) => setDataPub(e.target.value)}
                className="w-full rounded-lg border border-border bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={analisando}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-surface transition hover:bg-primary-hover disabled:opacity-60"
        >
          {analisando ? "Analisando..." : "1️⃣ Analisar (parser + auditoria)"}
        </button>
      </form>

      {preparo?.duplicado && (
        <p className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          <IconAlert className="mt-0.5 h-4 w-4 shrink-0" /> Este arquivo (mesmo SHA-256) já foi ingerido anteriormente.
          Ingestão duplicada bloqueada.
        </p>
      )}

      {rel && !preparo?.duplicado && (
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-6">
          <h3 className="font-display text-lg text-ink">Relatório de auditoria estrutural</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Artigos extraídos" value={rel.totalArtigos} />
            <Metric label="Sequência completa" value={rel.sequenciaCompleta ? "Sim ✅" : "NÃO ⚠️"} />
            <Metric label="Remissões (grafo)" value={rel.remissoesExternasTotal + rel.remissoesInternasTotal} />
            <Metric label="Anexos segregados" value={rel.anexosDetectados.length} />
          </div>

          {rel.aprovavel ? (
            <p className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary-soft px-4 py-3 text-sm text-primary">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0" /> Auditoria LIMPA: sequência de artigos íntegra, todos os
              headings do sumário conferidos no corpo e todas as tabelas conferidas nos anexos.
            </p>
          ) : (
            <p className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
              <IconAlert className="mt-0.5 h-4 w-4 shrink-0" /> Auditoria REPROVADA — divergências estruturais
              detectadas. Publique somente após correção do parser ou do documento.
            </p>
          )}

          <div className="rounded-xl border border-border">
            <button onClick={() => setDetalhesAbertos((a) => !a)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-ink">
              Detalhes completos da auditoria (JSON)
              <IconChevronDown className={`h-4 w-4 transition-transform ${detalhesAbertos ? "rotate-180" : ""}`} />
            </button>
            {detalhesAbertos && (
              <pre className="max-h-72 overflow-auto border-t border-border bg-paper p-4 text-xs text-ink/80">
                {JSON.stringify(rel, null, 2)}
              </pre>
            )}
          </div>

          {rel.avisosMonotonicidade.length > 0 && (
            <div className="rounded-xl border border-border">
              <button onClick={() => setAvisosAbertos((a) => !a)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-ink">
                ⚠️ Avisos de monotonicidade ({rel.avisosMonotonicidade.length})
                <IconChevronDown className={`h-4 w-4 transition-transform ${avisosAbertos ? "rotate-180" : ""}`} />
              </button>
              {avisosAbertos && (
                <ul className="space-y-1 border-t border-border px-5 py-3 text-sm text-ink/80">
                  {rel.avisosMonotonicidade.map((a: string, i: number) => (
                    <li key={i}>• {a}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <label className="flex items-start gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={confirmar}
              disabled={!rel.aprovavel}
              onChange={(e) => setConfirmar(e.target.checked)}
              className="mt-0.5"
            />
            Revisei o relatório de auditoria e aprovo a publicação desta versão.
          </label>

          <button
            onClick={publicar}
            disabled={!confirmar || !rel.aprovavel || publicando}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-surface transition hover:bg-primary-hover disabled:opacity-50"
          >
            2️⃣ Aprovar e publicar (vetoriza e disponibiliza na Consulta)
          </button>

          {progresso && (
            <div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-paper">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progresso.p * 100}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-muted">{progresso.msg}</p>
            </div>
          )}
        </div>
      )}

      {resultado && (
        <p
          className={`rounded-lg border px-4 py-3 text-sm ${
            resultado.ok ? "border-primary/20 bg-primary-soft text-primary" : "border-danger/30 bg-danger-soft text-danger"
          }`}
        >
          {resultado.msg}
        </p>
      )}
    </div>
  );
}
