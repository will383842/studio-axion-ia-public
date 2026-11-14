import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { EcranMotsConnecte } from "@/components/mots/EcranMotsConnecte";
import { exigerSession } from "@/services/auth";
import { etatBranchementZernio } from "@/services/branchements-zernio";
import { lireVueMotsCibles } from "@/services/mots-cibles-vue";
import { gesteComptesGuide, gesteLireMots, gesteLireReglagesParcours } from "@/services/mots-gestes";
import { gesteLireTableauSuivi } from "@/services/suivi-mots-gestes";

export const metadata: Metadata = { title: "Mots" };
export const dynamic = "force-dynamic";

/** Écran « Mots » : lignes, boutons Activer / Pause du mot GUIDE, état du branchement (booléens et codes, jamais une valeur). */
export default async function PageMots() {
  await exigerSession();
  const vue = await gesteLireMots();
  const comptes = await gesteComptesGuide();
  const reglages = await gesteLireReglagesParcours();
  // Le suivi chiffré se lit côté serveur, session déjà vérifiée ; une panne n'enlève rien d'autre à l'écran.
  let suivi: Awaited<ReturnType<typeof gesteLireTableauSuivi>> | null = null;
  try {
    suivi = await gesteLireTableauSuivi();
  } catch (e) {
    // Une redirection (ou tout arrêt interne de Next) doit continuer son chemin ; seule une vraie panne de lecture est absorbée.
    unstable_rethrow(e);
    suivi = null;
  }
  // Écran « mots et cibles » : les lignes déjà lues sont passées telles quelles. Catalogue du site injoignable (ou toute panne de lecture) : l'écran d'avant s'affiche seul.
  let motsCibles: Awaited<ReturnType<typeof lireVueMotsCibles>> = null;
  try {
    motsCibles = await lireVueMotsCibles({ lignes: vue.lignes });
  } catch (e) {
    unstable_rethrow(e);
    motsCibles = null;
  }
  return <EcranMotsConnecte vue={vue} comptes={comptes} branchement={etatBranchementZernio()} motsCibles={motsCibles} suivi={suivi} reglages={reglages} suiviIndisponible={suivi === null} />;
}
