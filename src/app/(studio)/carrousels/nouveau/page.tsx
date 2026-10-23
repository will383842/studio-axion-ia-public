import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { BandeauGenerateurEteint } from "@/components/visuels/BandeauGenerateurEteint";
import { FormulaireNouveauCarrousel } from "@/components/visuels/FormulaireNouveauCarrousel";
import { exigerSession } from "@/services/auth";
import { generateurAllume } from "@/visuels/interrupteur";
import { phraseDuCode } from "@/visuels/services/production";
import { creerCarrouselAction } from "./actions";

export const metadata: Metadata = { title: "Nouveau carrousel" };
export const dynamic = "force-dynamic";

/** Nouveau carrousel : un sujet, ou un texte écrit en session. */
export default async function PageNouveauCarrousel({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  await exigerSession();
  const sp = await searchParams;
  const allume = await generateurAllume("carrousels");
  const erreur = phraseDuCode(sp.erreur);
  return (
    <div className="mx-auto w-full max-w-xl">
      <EnTetePage retour={{ href: "/carrousels", libelle: "Carrousels" }} titre="Nouveau carrousel" sousTitre="Écriture : simulation (0 $) ou texte écrit en session." />
      {!allume && <BandeauGenerateurEteint />}
      {erreur && (
        <p role="alert" className="mb-4 text-sm text-brique">
          {erreur}
        </p>
      )}
      <FormulaireNouveauCarrousel creer={creerCarrouselAction} />
    </div>
  );
}
