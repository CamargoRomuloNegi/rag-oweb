// Cliente com a chave de SERVIÇO — usado apenas em Route Handlers / Server
// Components. Nunca importar este arquivo em um componente "use client".
import { createClient } from "@supabase/supabase-js";

export function getServiceClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
    auth: { persistSession: false },
  });
}
