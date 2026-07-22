import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/supabase/serverComponent";
import { getServiceClient } from "@/lib/supabase/server";
import { atualizar } from "@/lib/nucleo/config";

export async function GET() {
  const usuario = await usuarioAtual();
  if (!usuario || usuario.papel !== "admin") return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });

  const { data, error } = await getServiceClient().from("config").select("chave, valor, descricao").order("chave");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ linhas: data ?? [] });
}

export async function PUT(req: Request) {
  const usuario = await usuarioAtual();
  if (!usuario || usuario.papel !== "admin") return NextResponse.json({ error: "Acesso restrito ao admin." }, { status: 403 });

  const { atualizacoes } = await req.json();
  try {
    for (const { chave, valor } of atualizacoes as { chave: string; valor: any }[]) {
      await atualizar(chave, valor, usuario.email);
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? String(err) }, { status: 500 });
  }
}
