import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/coquille/Logo";
import { lireSession } from "@/services/auth";
import { FormulaireConnexion } from "./FormulaireConnexion";

export const metadata: Metadata = { title: "Connexion" };

export default async function PageConnexion({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  if (await lireSession()) redirect("/");
  const { suite } = await searchParams;
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden px-4">
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[70vh] lueur-forte" />
      <div aria-hidden className="absolute -bottom-40 left-1/2 -z-10 size-[520px] -translate-x-1/2 rounded-full bg-orange/10 blur-3xl" />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
        <Logo taille="lg" />
        <h1 className="titre-affiche mt-10 text-[44px] text-texte">
          Mon
          <br />
          <span className="text-orange-vif">studio</span>
          <br />
          vidéo.
        </h1>
        <p className="mb-8 mt-3 text-texte-doux">Entrez votre mot de passe.</p>
        <FormulaireConnexion suite={suite ?? "/"} />
      </div>
      <p className="pb-[max(16px,env(safe-area-inset-bottom))] text-center text-xs text-texte-faible">Accès privé · Axion-IA</p>
    </main>
  );
}
