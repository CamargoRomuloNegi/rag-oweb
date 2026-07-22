"use client";
import { useState } from "react";
import IngestaoTab from "./IngestaoTab";
import VersoesTab from "./VersoesTab";
import ConfiguracoesTab from "./ConfiguracoesTab";

const ABAS = ["📥 Ingestão", "🗂️ Versões", "⚙️ Configurações"] as const;

export default function CuradoriaTabs({ papel, usuarioEmail }: { papel: string; usuarioEmail: string }) {
  const [ativa, setAtiva] = useState<(typeof ABAS)[number]>(ABAS[0]);
  return (
    <div>
      <div className="mb-6 flex gap-1 border-b border-border">
        {ABAS.map((aba) => (
          <button
            key={aba}
            onClick={() => setAtiva(aba)}
            className={`relative px-4 py-2.5 text-sm font-medium transition ${
              ativa === aba ? "text-primary" : "text-muted hover:text-ink"
            }`}
          >
            {aba}
            {ativa === aba && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>
      {ativa === ABAS[0] && <IngestaoTab usuarioEmail={usuarioEmail} />}
      {ativa === ABAS[1] && <VersoesTab />}
      {ativa === ABAS[2] && <ConfiguracoesTab papel={papel} usuarioEmail={usuarioEmail} />}
    </div>
  );
}
