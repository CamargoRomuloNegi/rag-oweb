"use client";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";
import { IconLogout } from "./icons";

export default function LogoutButton() {
  const router = useRouter();
  async function sair() {
    await getBrowserClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      onClick={sair}
      className="flex w-full items-center gap-2 rounded-lg border border-border px-3.5 py-2.5 text-sm font-medium text-muted transition hover:border-danger/30 hover:bg-danger-soft hover:text-danger"
    >
      <IconLogout className="h-4 w-4" />
      Sair
    </button>
  );
}
