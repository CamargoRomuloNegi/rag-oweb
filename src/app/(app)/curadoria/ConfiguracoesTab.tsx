"use client";
import { useEffect, useState } from "react";

interface Linha {
  chave: string;
  valor: any;
  descricao: string | null;
}

export default function ConfiguracoesTab({ papel, usuarioEmail }: { papel: string; usuarioEmail: string }) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (papel !== "admin") return;
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        setLinhas(d.linhas ?? []);
        const t: Record<string, string> = {};
        for (const l of d.linhas ?? []) t[l.chave] = JSON.stringify(l.valor);
        setTextos(t);
      });
  }, [papel]);

  if (papel !== "admin") {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
        A edição de configurações é restrita ao papel admin.
      </p>
    );
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setOk(false);
    const novosErros: Record<string, string> = {};
    const atualizacoes: { chave: string; valor: any }[] = [];
    for (const [chave, texto] of Object.entries(textos)) {
      try {
        atualizacoes.push({ chave, valor: JSON.parse(texto) });
      } catch (e: any) {
        novosErros[chave] = `Valor inválido (use JSON: strings entre aspas, números puros): ${e.message}`;
      }
    }
    setErros(novosErros);
    if (Object.keys(novosErros).length) return;
    setSalvando(true);
    try {
      const resp = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atualizacoes }),
      });
      if (!resp.ok) throw new Error((await resp.json()).error ?? "Falha ao salvar.");
      setOk(true);
    } catch (err: any) {
      setErros({ __geral: err.message ?? String(err) });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg text-ink">Parâmetros da plataforma</h2>
        <p className="mt-1 text-sm text-muted">
          Os valores abaixo vivem na tabela <code>config</code> — nenhum parâmetro operacional é hard-coded.
          Alterações valem para as próximas consultas.
        </p>
      </div>

      {linhas === null && <p className="text-sm text-muted">Carregando...</p>}

      {linhas && (
        <form onSubmit={salvar} className="space-y-4 rounded-2xl border border-border bg-surface p-6">
          {linhas.map((l) => (
            <div key={l.chave}>
              <label className="mb-1 block text-sm font-medium text-ink">{l.chave}</label>
              <input
                value={textos[l.chave] ?? ""}
                onChange={(e) => setTextos((t) => ({ ...t, [l.chave]: e.target.value }))}
                className="w-full rounded-lg border border-border bg-paper px-3 py-2.5 font-mono text-sm text-ink outline-none focus:border-primary"
              />
              {l.descricao && <p className="mt-1 text-xs text-muted">{l.descricao}</p>}
              {erros[l.chave] && <p className="mt-1 text-xs text-danger">{erros[l.chave]}</p>}
            </div>
          ))}
          {erros.__geral && <p className="text-sm text-danger">{erros.__geral}</p>}
          {ok && <p className="text-sm text-primary">Configurações salvas e cache recarregado.</p>}
          <button
            type="submit"
            disabled={salvando}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-surface transition hover:bg-primary-hover disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Salvar configurações"}
          </button>
        </form>
      )}
    </div>
  );
}
