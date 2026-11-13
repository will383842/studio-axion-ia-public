import type { Metadata } from "next";
import { EcranMotsConnecte } from "@/components/mots/EcranMotsConnecte";
import { exigerSession } from "@/services/auth";
import { etatBranchementZernio } from "@/services/branchements-zernio";
import { gesteComptesGuide, gesteLireMots } from "@/services/mots-gestes";
import { gesteLireTableauSuivi } from "@/services/suivi-mots-gestes";

export const metadata: Metadata = { title: "Mots" };
export const dynamic = "force-dynamic";

/** Écran « Mots » : lignes, boutons Activer / Pause du mot GUIDE, état du branchement (booléens et codes, jamais une valeur). */
export default async function PageMots() {
  await exigerSession();
  const vue = await gesteLireMots();
  const comptes = await gesteComptesGuide();
  // Le suivi chiffré se lit côté serveur, session déjà vérifiée ; une panne n'enlève rien d'autre à l'écran.
  let suivi: Awaited<ReturnType<typeof gesteLireTableauSuivi>> | null = null;
  try {
    suivi = await gesteLireTableauSuivi();
  } catch {
    suivi = null;
  }
  return <EcranMotsConnecte vue={vue} comptes={comptes} branchement={etatBranchementZernio()} suivi={suivi} suiviIndisponible={suivi === null} />;
}
