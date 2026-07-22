"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const supabase = getBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      setErro("E-mail ou senha inválidos.");
      setCarregando(false);
      return;
    }
    const resp = await fetch("/api/perfil");
    if (resp.status === 404) {
      setErro(
        "Usuário autenticado, porém sem papel atribuído. Solicite ao administrador a inclusão na tabela de perfis (ver GUIA_OPERACAO.md)."
      );
      setCarregando(false);
      return;
    }
    router.push("/consulta");
    router.refresh();
  }

  return (
    <form
      onSubmit={entrar}
      className="space-y-5 rounded-2xl border border-border bg-surface p-8 shadow-soft"
    >
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-ink" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-border bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-soft"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-ink" htmlFor="senha">
          Senha
        </label>
        <input
          id="senha"
          type="password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="w-full rounded-lg border border-border bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-soft"
        />
      </div>
      {erro && (
        <p className="rounded-lg border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-sm leading-relaxed text-danger">
          {erro}
        </p>
      )}
      <button
        type="submit"
        disabled={carregando}
        className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-surface transition hover:bg-primary-hover disabled:opacity-60"
      >
        {carregando ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
