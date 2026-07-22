"use client";
import { useEffect, useState } from "react";

interface Versao {
  id: string;
  nome_arquivo: string;
  data_publicacao: string;
  status: string;
  aprovado_por: string | null;
  aprovado_em: string | null;
  criado_em: string;
  documentos: { tipo_norma: string; numero: string; titulo: string | null } | null;
}

const ROTULO: Record<string, string> = {
  publicado: "🟢 publicado",
  substituido: "🟡 substituído",
  rascunho: "⚪ rascunho",
  rejeitado: "🔴 rejeitado",
};

export default function VersoesTab() {
  const [versoes, setVersoes] = useState<Versao[] | null>(null);

  useEffect(() => {
    fetch("/api/versoes")
      .then((r) => r.json())
      .then((d) => setVersoes(d.versoes ?? []));
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg text-ink">Ciclo de vida do corpus</h2>
      {versoes === null && <p className="text-sm text-muted">Carregando...</p>}
      {versoes?.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          Nenhuma versão ingerida ainda. Utilize a aba Ingestão.
        </p>
      )}
      <div className="space-y-2">
        {versoes?.map((v) => (
          <div key={v.id} className="rounded-xl border border-border bg-surface px-4 py-3.5 text-sm text-ink">
            <span className="font-semibold">
              {v.documentos?.tipo_norma ?? ""} nº {v.documentos?.numero ?? ""}
            </span>{" "}
            — {ROTULO[v.status] ?? v.status} · publicação {v.data_publicacao} · arquivo{" "}
            <code className="rounded bg-paper px-1.5 py-0.5 text-xs">{v.nome_arquivo}</code>
            {v.aprovado_por && ` · aprovado por ${v.aprovado_por}`}
          </div>
        ))}
      </div>
    </div>
  );
}
