import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/supabase/serverComponent";
import { preparar, versaoJaIngerida } from "@/lib/nucleo/ingestao";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const usuario = await usuarioAtual();
  if (!usuario || !["admin", "curador"].includes(usuario.papel ?? "")) {
    return NextResponse.json({ error: "Acesso restrito a admin/curador." }, { status: 403 });
  }

  const form = await req.formData();
  const arquivo = form.get("arquivo") as File | null;
  const sigla = String(form.get("sigla") ?? "").trim();
  const dataPub = String(form.get("dataPub") ?? "");
  if (!arquivo || !sigla) {
    return NextResponse.json({ error: "Preencha o PDF, o número e a sigla antes de analisar." }, { status: 400 });
  }

  try {
    const buffer = new Uint8Array(await arquivo.arrayBuffer());
    const { dispositivos, anexos, relatorio, sha256 } = await preparar(buffer, sigla, dataPub);
    const duplicado = await versaoJaIngerida(sha256);
    return NextResponse.json({ dispositivos, anexos, relatorio, sha256, duplicado, nomeArquivo: arquivo.name });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? String(err) }, { status: 500 });
  }
}
