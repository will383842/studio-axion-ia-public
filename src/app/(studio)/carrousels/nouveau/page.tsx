import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { BandeauGenerateurEteint } from "@/components/visuels/BandeauGenerateurEteint";
import { FormulaireNouveauCarrousel } from "@/components/visuels/FormulaireNouveauCarrousel";
import { exigerSession } from "@/services/auth";
import { generateurAllume } from "@/visuels/interrupteur";
import { aideFormat } from "@/visuels/texte/aide-format";
import { phraseDuCode } from "@/visuels/services/production";
import { creerCarrouselAction } from "./actions";

export const metadata: Metadata = { title: "Nouveau carrousel" };
export const dynamic = "force-dynamic";

/** Nouveau carrousel : un sujet, ou un texte écrit en session. */
export default async function PageNouveauCarrousel({ searchParams }: { searchParams: Promise<{ erreur?: string; entree?: string }> }) {
  await exigerSession();
  const sp = await searchParams;
  const allume = await generateurAllume("carrousels");
  // Un seul message « éteint » : le bandeau. Le code d'erreur de l'adresse ne le répète pas.
  const erreur = sp.erreur === "GENERATEUR_ETEINT" && !allume ? undefined : phraseDuCode(sp.erreur);
  return (
    <div className="mx-auto w-full max-w-xl">
      <EnTetePage retour={{ href: "/carrousels", libelle: "Carrousels" }} titre="Nouveau carrousel" sousTitre="Texte d'exemple (simulation, 0 $) ou texte écrit en session." />
      {!allume && <BandeauGenerateurEteint />}
      {erreur && (
        <p role="alert" className="mb-4 text-sm text-brique">
          {erreur}
        </p>
      )}
      <FormulaireNouveauCarrousel creer={creerCarrouselAction} aide={aideFormat()} allume={allume} entreeInitiale={sp.entree === "session" ? "depot" : "sujet"} />
    </div>
  );
}
