// nucleo/banco.ts — porta de nucleo/banco.py (sem o cache de recurso do Streamlit;
// cada invocação serverless já é isolada).
import { getServiceClient } from "@/lib/supabase/server";

export async function obterPerfil(userId: string) {
  const { data, error } = await getServiceClient().from("perfis").select("*").eq("user_id", userId);
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function registrarConsulta(params: {
  usuarioEmail: string;
  pergunta: string;
  rota: string;
  idsCanonicos: string[];
  resposta: string;
}) {
  const { error } = await getServiceClient().from("consultas_log").insert({
    usuario_email: params.usuarioEmail,
    pergunta: params.pergunta,
    rota: params.rota,
    dispositivos_recuperados: params.idsCanonicos,
    resposta: params.resposta,
  });
  if (error) throw error;
}
