"use client";
import { useState, useRef, useEffect } from "react";
import { IconAlert, IconChevronDown, IconGraph, IconSend } from "@/components/icons";

interface Dispositivo {
  id_canonico: string;
  livro?: string;
  titulo?: string;
  capitulo?: string;
  secao?: string;
  subsecao?: string;
  texto: string;
  integro: boolean;
}
interface Mensagem {
  role: "user" | "assistant";
  content: string;
  principais?: Dispositivo[];
  referenciados?: Dispositivo[];
  rota?: string;
}

function endereco(d: Dispositivo) {
  return [d.livro, d.titulo, d.capitulo, d.secao, d.subsecao].filter(Boolean).join(" › ");
}

function Dispositivos({ principais, referenciados }: { principais: Dispositivo[]; referenciados: Dispositivo[] }) {
  const [aberto, setAberto] = useState(false);
  if (!principais.length && !referenciados.length) return null;
  return (
    <div className="mt-3 rounded-xl border border-border bg-surface">
      <button
        onClick={() => setAberto((a) => !a)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-ink"
      >
        <span>
          📄 Dispositivos na íntegra — {principais.length} recuperado(s)
          {referenciados.length ? ` + ${referenciados.length} referenciado(s) pelo grafo` : ""}
        </span>
        <IconChevronDown className={`h-4 w-4 shrink-0 transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (
        <div className="space-y-4 border-t border-border px-4 py-4">
          {principais.map((d) => (
            <div key={d.id_canonico} className="border-b border-border pb-4 last:border-0 last:pb-0">
              <p className="text-sm font-semibold text-ink">
                {d.id_canonico} <span className="font-normal text-muted">— {d.integro ? "✅ íntegro (hash verificado)" : "⚠️ FALHA DE INTEGRIDADE"}</span>
              </p>
              {endereco(d) && <p className="mt-0.5 text-xs text-muted">{endereco(d)}</p>}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">{d.texto}</p>
            </div>
          ))}
          {referenciados.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                <IconGraph className="h-3.5 w-3.5" /> Anexados pelo grafo de remissões
              </p>
              {referenciados.map((d) => (
                <div key={d.id_canonico} className="border-b border-border pb-3 pt-1 last:border-0">
                  <p className="text-sm font-semibold text-ink">{d.id_canonico}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">{d.texto}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChatConsulta() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [pergunta, setPergunta] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollTo?.({ top: fimRef.current.scrollHeight });
  }, [mensagens, carregando]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const texto = pergunta.trim();
    if (!texto || carregando) return;
    setErro(null);
    setPergunta("");
    const historico = mensagens.map((m) => ({ role: m.role, content: m.content }));
    setMensagens((m) => [...m, { role: "user", content: texto }]);
    setCarregando(true);
    try {
      const resp = await fetch("/api/consulta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta: texto, historico }),
      });
      if (!resp.ok) throw new Error((await resp.json()).error ?? "Falha ao processar a consulta.");
      const dados = await resp.json();
      setMensagens((m) => [
        ...m,
        { role: "assistant", content: dados.resposta, principais: dados.principais, referenciados: dados.referenciados, rota: dados.rota },
      ]);
    } catch (err: any) {
      setErro(err.message ?? String(err));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={fimRef} className="flex-1 space-y-5 overflow-y-auto pb-4 pr-1">
        {mensagens.length === 0 && (
          <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted">
            Pergunte sobre o IBS/CBS — ex.: "o que diz o art. 186?" ou "como funciona o split payment?"
          </p>
        )}
        {mensagens.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={m.role === "user" ? "max-w-[85%] rounded-2xl bg-primary px-4 py-3 text-sm text-surface" : "max-w-[92%]"}>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
              {m.role === "assistant" && m.rota && (
                <p className="mt-2 text-xs text-muted">
                  Rota de recuperação: {m.rota === "deterministica" ? "🎯 determinística (endereço de artigo)" : "🔀 híbrida (léxica + vetorial, fusão RRF)"}
                </p>
              )}
              {m.role === "assistant" && (
                <Dispositivos principais={m.principais ?? []} referenciados={m.referenciados ?? []} />
              )}
            </div>
          </div>
        ))}
        {carregando && <p className="text-sm text-muted">Recuperando dispositivos e elaborando a resposta...</p>}
        {erro && (
          <p className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
            <IconAlert className="mt-0.5 h-4 w-4 shrink-0" /> Falha ao processar a consulta: {erro}
          </p>
        )}
      </div>
      <form onSubmit={enviar} className="flex shrink-0 items-center gap-2 border-t border-border pt-4">
        <input
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          placeholder="Pergunte sobre o IBS/CBS (ex.: o que diz o art. 186?)"
          className="flex-1 rounded-full border border-border bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-soft"
        />
        <button
          type="submit"
          disabled={carregando || !pergunta.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-surface transition hover:bg-primary-hover disabled:opacity-50"
        >
          <IconSend className="h-4.5 w-4.5" />
        </button>
      </form>
    </div>
  );
}
