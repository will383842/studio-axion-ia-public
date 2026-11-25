"use server";

/**
 * RÉSERVE DE TUTORIELS · actions de la page (plan PLAN-RESERVE-TUTORIELS-21-11, fiche RES-5). CHAQUE action commence par la
 * session, puis par `exigerTutorielAllume` (éteint : refus, rien n'est écrit), renvoie un Resultat par `essayer`, puis
 * rafraîchit la page. Aucun montant. `fichierId` et `id` sont contrôlés par les services.
 */
import { revalidatePath } from "next/cache";
import type { IssueTirage, RaisonAttente } from "@/domaine/tutoriel-reserve";
import { nouvelId } from "@/lib/ids";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { exigerTutorielAllume } from "@/services/tutoriel-depot";
import { tirerSuivantReserve } from "@/services/tutoriel-reserve-tirage";
import { ajouterDossierReserve, ajouterIdeeReserve, remettreEnReserve, retirerDeLaReserve, type IssueReserve } from "@/services/tutoriel-reserve-depot";

const CHEMIN = "/tutoriel-outil/reserve";

async function garde(): Promise<void> {
  await exigerSession();
  await exigerTutorielAllume();
}

async function rafraichie<T>(f: () => Promise<T>): Promise<Resultat<T>> {
  const r = await essayer(async () => {
    await garde();
    return f();
  });
  revalidatePath(CHEMIN);
  return r;
}

/** Un dossier (.zip) déjà envoyé au stockage. `attestationImages` : seul `true` exact compte (vérifié par le service). */
export async function ajouterDossierAction(d: { fichierId: string; attestationImages: boolean; script?: string; fin?: string }): Promise<Resultat<IssueReserve>> {
  return rafraichie(() => ajouterDossierReserve(d));
}

export async function ajouterIdeeAction(d: { phrase: string; script?: string; fin?: string }): Promise<Resultat<IssueReserve>> {
  return rafraichie(() => ajouterIdeeReserve(d));
}

export async function retirerAction(id: string): Promise<Resultat<IssueReserve>> {
  return rafraichie(() => retirerDeLaReserve(id));
}

export async function remettreAction(id: string): Promise<Resultat<IssueReserve>> {
  return rafraichie(() => remettreEnReserve(id));
}

/** Raisons d'attente à actionner, en mots simples (aucun montant). Les autres gardent la phrase du service. */
const RAISON_EN_MOTS: Partial<Record<RaisonAttente, string>> = {
  plafond_video: "La limite par vidéo est trop basse : voir les réglages.",
};

/** L'issue d'un tirage, en une phrase lisible (jamais un montant). */
function phraseIssue(i: IssueTirage): string {
  switch (i.etat) {
    case "pris":
      return `« ${i.titre} » est pris : la vidéo se prépare.`;
    case "reserve_vide":
      return "La réserve est vide : ajoutez un dossier ou une idée.";
    case "eteint":
      return "La prise automatique est éteinte.";
    case "attente":
      return RAISON_EN_MOTS[i.raison] ?? i.phrase;
    case "echec":
      return i.phrase;
  }
}

/**
 * « Préparer le suivant maintenant » : le clic de Williams. Seule action qui envoie le déclencheur « essai » (il passe l'interrupteur
 * de la réserve éteint) ; elle n'est atteignable qu'avec session (`garde`) et formulaire allumé. Les plafonds s'appliquent quand même (RES-3).
 */
export async function essayerTirageAction(): Promise<Resultat<{ phrase: string; pris: boolean }>> {
  return rafraichie(async () => {
    const i = await tirerSuivantReserve({ declencheur: "essai", cle: nouvelId("essai") });
    return { phrase: phraseIssue(i), pris: i.etat === "pris" };
  });
}
