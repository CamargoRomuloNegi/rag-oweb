import ChatConsulta from "./ChatConsulta";

export default function ConsultaPage() {
  return (
    <div className="mx-auto flex h-screen max-w-3xl flex-col px-6 py-8">
      <header className="mb-6 shrink-0">
        <h1 className="font-display text-2xl text-ink">Consulta ao corpus normativo</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          As respostas fundamentam-se exclusivamente nas normas publicadas na plataforma e não substituem parecer
          profissional.
        </p>
      </header>
      <ChatConsulta />
    </div>
  );
}
