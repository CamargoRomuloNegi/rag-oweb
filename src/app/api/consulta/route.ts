import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/supabase/serverComponent";
import { recuperar } from "@/lib/nucleo/retrieval";
import { responder } from "@/lib/nucleo/geracao";
import { registrarConsulta } from "@/lib/nucleo/banco";
import { verificar } from "@/lib/nucleo/citacao";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const usuario = await usuarioAtual();
  if (!usuario || !usuario.papel) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { pergunta, historico } = await req.json();
  if (!pergunta || typeof pergunta !== "string") {
    return NextResponse.json({ error: "Pergunta vazia." }, { status: 400 });
  }

  try {
    const [principais, referenciados, rota] = await recuperar(pergunta);

    let resposta: string;
    let rotaFinal = rota;
    if (!principais.length) {
      resposta =
        "Não localizei dispositivos relacionados à sua pergunta no corpus publicado. Reformule com outros termos ou verifique se a norma pertinente já foi ingerida pela Curadoria.";
      rotaFinal = "sem_resultado";
    } else {
      resposta = await responder(pergunta, principais, referenciados, historico ?? []);
    }

    const comSelo = async (lista: any[]) =>
      Promise.all(lista.map(async (d) => ({ ...d, integro: await verificar(d) })));

    await registrarConsulta({
      usuarioEmail: usuario.email,
      pergunta,
      rota: rotaFinal,
      idsCanonicos: principais.map((d: any) => d.id_canonico),
      resposta,
    });

    return NextResponse.json({
      resposta,
      rota: principais.length ? rota : undefined,
      principais: await comSelo(principais),
      referenciados: await comSelo(referenciados),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? String(err) }, { status: 500 });
  }
}
