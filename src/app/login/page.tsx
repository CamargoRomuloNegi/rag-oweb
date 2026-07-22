import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-surface">
            <span className="font-display text-lg">Δ</span>
          </div>
          <h1 className="font-display text-3xl tracking-tight text-ink">Plataforma RAG RTC</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
            Consulta técnica ao corpus normativo da Reforma Tributária do Consumo — IBS, CBS e Imposto Seletivo.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
