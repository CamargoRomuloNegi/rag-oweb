"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChat, IconFolder } from "./icons";
import LogoutButton from "./LogoutButton";

export default function Sidebar({ email, papel }: { email: string; papel: string }) {
  const pathname = usePathname();
  const ativo = pathname.startsWith("/curadoria") ? "curadoria" : "consulta";
  const podeCurar = papel === "admin" || papel === "curador";
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col justify-between border-r border-border bg-surface px-4 py-6">
      <div>
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-surface">
            <span className="font-display text-sm">Δ</span>
          </div>
          <span className="font-display text-lg leading-tight text-ink">RAG RTC</span>
        </div>
        <nav className="space-y-1">
          <Link
            href="/consulta"
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              ativo === "consulta" ? "bg-primary-soft text-primary" : "text-muted hover:bg-paper hover:text-ink"
            }`}
          >
            <IconChat className="h-4.5 w-4.5" />
            Consulta
          </Link>
          {podeCurar && (
            <Link
              href="/curadoria"
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                ativo === "curadoria" ? "bg-primary-soft text-primary" : "text-muted hover:bg-paper hover:text-ink"
              }`}
            >
              <IconFolder className="h-4.5 w-4.5" />
              Curadoria
            </Link>
          )}
        </nav>
      </div>
      <div className="space-y-3 border-t border-border pt-4">
        <div className="px-2">
          <p className="truncate text-sm font-medium text-ink">{email}</p>
          <p className="mt-0.5 inline-block rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium capitalize text-ink/70">
            {papel}
          </p>
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
