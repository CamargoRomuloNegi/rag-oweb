import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/supabase/serverComponent";
import { getServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const usuario = await usuarioAtual();
  if (!usuario || !usuario.papel) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data, error } = await getServiceClient()
    .from("versoes_documento")
    .select(
      "id, nome_arquivo, data_publicacao, status, aprovado_por, aprovado_em, criado_em, documentos(tipo_norma, numero, titulo)"
    )
    .order("criado_em", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ versoes: data ?? [] });
}
