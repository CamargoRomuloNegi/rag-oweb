import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/supabase/serverComponent";

export async function GET() {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!usuario.papel) return NextResponse.json({ error: "Sem papel atribuído." }, { status: 404 });
  return NextResponse.json({ email: usuario.email, papel: usuario.papel });
}
