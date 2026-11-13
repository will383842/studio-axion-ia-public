/**
 * NEW-ARG-05 · limite technique d'appels par jour (jour = heure de Paris). Atteinte, la fabrication AUTOMATIQUE de la
 * boucle s'arrête jusqu'au lendemain ; ce que Williams lance à la main ne passe jamais ici et part toujours.
 * Un « appel » = un lancement d'une tâche automatique de la boucle (lots, comité, parcours, tableau).
 * ÉTEINTE par défaut (`limite_appels.active` faux) : aucune lecture du compte, aucune écriture. Aucun appel réel,
 * aucun montant. Une erreur de lecture laisse passer (la limite ne casse jamais la boucle).
 */
import "server-only";
import { formateurDate } from "@/lib/intl";
import { ecrireParametre, lireParametre, sousVerrou } from "./_commun";

export const PARAM_LIMITE_ACTIVE = "limite_appels.active";
export const PARAM_LIMITE_PAR_JOUR = "limite_appels.par_jour";
export const PARAM_COMPTE_APPELS = "limite_appels.compte";
export const LIMITE_PAR_DEFAUT = 200;

/** Tâches de la boucle qui lancent de la fabrication automatique (les autres annexes ne sont jamais freinées). */
export const ANNEXES_AUTOMATIQUES: readonly string[] = ["lots d'images", "tâches du tableau animé", "comité éditorial", "parcours mot → guide", "parcours de conversation"];

interface Compte {
  jour: string;
  n: number;
}

/** « AAAA-MM-JJ » à Paris. */
export function jourParis(instant: number): string {
  return formateurDate("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instant));
}

export interface LecturesLimite {
  lire?: <T>(id: string, defaut: T) => Promise<T>;
}

/** Faut-il laisser partir cette tâche ? Compte l'appel quand c'est oui. */
export async function annexeAutorisee(nom: string, instant: number = Date.now(), o: LecturesLimite = {}): Promise<boolean> {
  if (!ANNEXES_AUTOMATIQUES.includes(nom)) return true;
  try {
    const lire = o.lire ?? lireParametre;
    if ((await lire<boolean>(PARAM_LIMITE_ACTIVE, false)) !== true) return true;
    const limite = Number(await lire<number>(PARAM_LIMITE_PAR_JOUR, LIMITE_PAR_DEFAUT));
    const plafond = Number.isFinite(limite) && limite > 0 ? limite : LIMITE_PAR_DEFAUT;
    const jour = jourParis(instant);
    return await sousVerrou(async () => {
      const c = await lire<Compte | null>(PARAM_COMPTE_APPELS, null);
      const n = c && c.jour === jour ? c.n : 0;
      if (n >= plafond) return false;
      await ecrireParametre(PARAM_COMPTE_APPELS, { jour, n: n + 1 } satisfies Compte);
      return true;
    });
  } catch {
    return true;
  }
}

/** Pour l'Accueil : la limite du jour est-elle atteinte ? (éteinte ou illisible : non) */
export async function etatLimiteAppels(instant: number = Date.now()): Promise<{ atteinte: boolean }> {
  try {
    if ((await lireParametre<boolean>(PARAM_LIMITE_ACTIVE, false)) !== true) return { atteinte: false };
    const limite = Number(await lireParametre<number>(PARAM_LIMITE_PAR_JOUR, LIMITE_PAR_DEFAUT));
    const plafond = Number.isFinite(limite) && limite > 0 ? limite : LIMITE_PAR_DEFAUT;
    const c = await lireParametre<Compte | null>(PARAM_COMPTE_APPELS, null);
    return { atteinte: !!c && c.jour === jourParis(instant) && c.n >= plafond };
  } catch {
    return { atteinte: false };
  }
}
