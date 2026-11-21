"use server";

/**
 * RÉSERVE DE TUTORIELS · actions de la page (plan PLAN-RESERVE-TUTORIELS-21-11, fiche RES-5). CHAQUE action commence par la
 * session, puis par `exigerTutorielAllume` (éteint : refus, rien n'est écrit), renvoie un Resultat par `essayer`, puis
 * rafraîchit la page. Aucun montant. `fichierId` et `id` sont contrôlés par les services.
 */
import { revalidatePath } from "next/cache";
import type { IssueTirage } from "@/domaine/tutoriel-reserve";
import { nouvelId } from "@/lib/ids";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { exigerTutorielAllume } from "@/services/tutoriel-depot";
import { ajouterDossierReserve, ajouterIdeeReserve, remettreEnReserve, retirerDeLaReserve, type IssueReserve } from "@/services/tutoriel-reserve-depot";

const CHEMIN = "/tutoriel-outil/reserve";

const PHRASE_ESSAI_INDISPONIBLE = "La préparation à la demande n'est pas encore disponible. Vos éléments restent en réserve.";

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

type TirerSuivant = (d: { declencheur: "essai"; cle: string }) => Promise<IssueTirage>;

/**
 * Indirection vers `tirerSuivantReserve` (RES-3, branche voisine) : l'import est dynamique pour que cette branche compile
 * sans RES-3. Module absent (ou illisible) : repli « pas encore disponible », rien n'est tiré. Après la fusion de RES-3, remplacer par un
 * import statique (voir la PR). Le module n'est jamais choisi par l'appelant.
 */
async function chargerTirage(): Promise<TirerSuivant | null> {
  try {
    const chemin = "../../../../services/tutoriel-reserve-tirage";
    const m = (await import(/* @vite-ignore */ chemin)) as { tirerSuivantReserve?: TirerSuivant };
    return typeof m.tirerSuivantReserve === "function" ? m.tirerSuivantReserve : null;
  } catch {
    return null;
  }
}

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
      return i.phrase;
    case "echec":
      return i.phrase;
  }
}

/** « Préparer le suivant maintenant » : le clic de Williams ; les plafonds s'appliquent quand même (RES-3). */
export async function essayerTirageAction(): Promise<Resultat<{ phrase: string; pris: boolean }>> {
  return rafraichie(async () => {
    const tirer = await chargerTirage();
    if (!tirer) return { phrase: PHRASE_ESSAI_INDISPONIBLE, pris: false };
    const i = await tirer({ declencheur: "essai", cle: nouvelId("essai") });
    return { phrase: phraseIssue(i), pris: i.etat === "pris" };
  });
}
