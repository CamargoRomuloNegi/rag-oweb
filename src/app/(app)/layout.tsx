import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/supabase/serverComponent";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  if (!usuario.papel) redirect("/login");

  return (
    <div className="flex bg-paper">
      <Sidebar email={usuario.email} papel={usuario.papel} />
      <main className="h-screen flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
