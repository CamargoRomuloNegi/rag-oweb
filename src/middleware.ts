import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const protegida = path.startsWith("/consulta") || path.startsWith("/curadoria");

  if (protegida && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (path === "/login" && user) {
    return NextResponse.redirect(new URL("/consulta", request.url));
  }
  if (path.startsWith("/curadoria") && user) {
    const service = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
      auth: { persistSession: false },
    });
    const { data: perfil } = await service.from("perfis").select("papel").eq("user_id", user.id).single();
    if (!perfil || !["admin", "curador"].includes(perfil.papel)) {
      return NextResponse.redirect(new URL("/consulta", request.url));
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
