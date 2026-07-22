// Cliente com chave ANÔNIMA, ciente da sessão via cookies — para Server
// Components e Route Handlers que precisam saber "quem está logado".
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function getServerComponentClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // Server Components não podem gravar cookies; o middleware cuida do refresh de sessão.
        setAll: () => {},
      },
    }
  );
}

/** Usuário autenticado + papel, ou null. Lança se autenticado mas sem perfil. */
export async function usuarioAtual() {
  const supabase = getServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { getServiceClient } = await import("./server");
  const { data } = await getServiceClient().from("perfis").select("email, papel").eq("user_id", user.id).single();
  if (!data) return { id: user.id, email: user.email ?? "", papel: null as string | null };
  return { id: user.id, email: data.email as string, papel: data.papel as string };
}
