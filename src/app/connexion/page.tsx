import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/coquille/Logo";
import { Carte } from "@/components/ui/Carte";
import { lireSession } from "@/services/auth";
import { FormulaireConnexion } from "./FormulaireConnexion";

export const metadata: Metadata = { title: "Connexion" };

export default async function PageConnexion({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  if (await lireSession()) redirect("/");
  const { suite } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col px-4">
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-12">
        <Carte className="p-6 sm:p-7">
          <Logo taille="lg" />
          <h1 className="mt-6 text-[30px] text-texte">Mon studio vidéo</h1>
          <p className="mb-6 mt-1.5 text-texte-doux">Entrez votre mot de passe.</p>
          <FormulaireConnexion suite={suite ?? "/"} />
        </Carte>
      </div>
      <p className="pb-[max(16px,env(safe-area-inset-bottom))] text-center text-xs text-texte-faible">Accès privé · Axion-IA</p>
    </main>
  );
}
