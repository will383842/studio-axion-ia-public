import type { Metadata } from "next";
import { ConteneurPage } from "@/components/ui/ConteneurPage";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { BandeauInfographieEteint, FormulaireInfographie } from "@/components/visuels/FicheInfographie";
import { exigerSession } from "@/services/auth";
import { generateurAllume } from "@/visuels/interrupteur";
import { creerInfographieAction } from "../actions";

export const metadata: Metadata = { title: "Nouvelle infographie" };
export const dynamic = "force-dynamic";

/** Nouvelle infographie : un titre, trois à cinq points clés, un style. L'aperçu se met à jour pendant la frappe. */
export default async function PageNouvelleInfographie() {
  await exigerSession();
  const allume = await generateurAllume("infographies");
  return (
    <ConteneurPage>
      <EnTetePage retour={{ href: "/infographies", libelle: "Infographies" }} titre="Nouvelle infographie" sousTitre="Un titre, trois à cinq points clés, un style : vous relisez avant tout." />
      {!allume && <BandeauInfographieEteint />}
      <FormulaireInfographie creer={creerInfographieAction} allume={allume} />
    </ConteneurPage>
  );
}
