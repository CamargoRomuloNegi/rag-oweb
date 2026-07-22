import { usuarioAtual } from "@/lib/supabase/serverComponent";
import { publicar } from "@/lib/nucleo/ingestao";

export const runtime = "nodejs";
// Vetorização em lotes com pausas respeitando rate limit — pode levar minutos
// em documentos grandes. Em planos com limite de duração menor, aumente
// 'tamanho_lote_vetorizacao' e reduza 'pausa_lote_segundos' em Configurações,
// ou eleve este valor (exige plano Vercel Pro/Enterprise para >60s).
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const usuario = await usuarioAtual();
        if (!usuario || !["admin", "curador"].includes(usuario.papel ?? "")) {
          emit({ error: "Acesso restrito a admin/curador." });
          return;
        }
        const versaoId = await publicar({
          tipoNorma: body.tipoNorma,
          numero: body.numero,
          titulo: body.titulo,
          dispositivos: body.dispositivos,
          anexos: body.anexos,
          relatorio: body.relatorio,
          sha256: body.sha256,
          nomeArquivo: body.nomeArquivo,
          dataPublicacao: body.dataPublicacao,
          aprovadoPor: usuario.email,
          progresso: (p, msg) => emit({ p, msg }),
        });
        emit({ done: true, versaoId });
      } catch (err: any) {
        emit({ error: err.message ?? String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
}
