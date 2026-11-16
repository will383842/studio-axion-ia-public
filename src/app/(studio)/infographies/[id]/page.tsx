import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConteneurPage } from "@/components/ui/ConteneurPage";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { BandeauInfographieEteint, FicheInfographieValidation, type FicheInfographieStockee } from "@/components/visuels/FicheInfographie";
import { lireParametre } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { generateurAllume } from "@/visuels/interrupteur";
import { validerInfographieAction } from "../actions";

export const metadata: Metadata = { title: "Infographie" };
export const dynamic = "force-dynamic";

/** Fiche d'une infographie = aperçu et validation. Brouillon tant que « Valider » n'a pas été cliqué. */
export default async function PageFicheInfographie({ params }: { params: Promise<{ id: string }> }) {
  await exigerSession();
  const { id } = await params;
  const [fiche, allume] = await Promise.all([lireParametre<FicheInfographieStockee | null>(`infographies.fiche.${id}`, null), generateurAllume("infographies")]);
  if (!fiche) notFound();
  return (
    <ConteneurPage largeur="lecture">
      <EnTetePage retour={{ href: "/infographies", libelle: "Infographies" }} titre={fiche.titre} sousTitre={fiche.statut === "valide" ? "Validée" : "Brouillon à relire"} />
      {!allume && <BandeauInfographieEteint />}
      <FicheInfographieValidation fiche={fiche} valider={validerInfographieAction} />
    </ConteneurPage>
  );
}
