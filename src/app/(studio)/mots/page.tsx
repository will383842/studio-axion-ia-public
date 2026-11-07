import type { Metadata } from "next";
import { EcranMotsConnecte } from "@/components/mots/EcranMotsConnecte";
import { exigerSession } from "@/services/auth";
import { etatBranchementZernio } from "@/services/branchements-zernio";
import { gesteLireMots } from "@/services/mots-gestes";

export const metadata: Metadata = { title: "Mots" };
export const dynamic = "force-dynamic";

/** Écran « Mots » : lignes, boutons Activer / Pause du mot GUIDE, état du branchement (booléens et codes, jamais une valeur). */
export default async function PageMots() {
  await exigerSession();
  const vue = await gesteLireMots();
  return <EcranMotsConnecte vue={vue} branchement={etatBranchementZernio()} />;
}
