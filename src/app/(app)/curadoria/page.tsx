import { usuarioAtual } from "@/lib/supabase/serverComponent";
import CuradoriaTabs from "./CuradoriaTabs";

export default async function CuradoriaPage() {
  const usuario = await usuarioAtual();
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-6 font-display text-2xl text-ink">Curadoria do corpus</h1>
      <CuradoriaTabs papel={usuario!.papel!} usuarioEmail={usuario!.email} />
    </div>
  );
}
