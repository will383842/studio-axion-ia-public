/**
 * NEW-ARG-05 · limite technique d'appels par jour (jour = heure de Paris). Atteinte, la fabrication AUTOMATIQUE lancée
 * par la boucle de fond s'arrête jusqu'au lendemain ; ce que le fondateur lance à la main ne passe jamais ici et part toujours.
 * Un « appel » = un vrai envoi au fournisseur fait par une tâche automatique (comité : un lot envoyé ; parcours mot :
 * un message envoyé). Un tour à vide ne compte pas. Seul `lancerAnnexe` (boucle) passe ici : les réveils manuels
 * (tableau animé, lots d'images) ne sont jamais freinés, leurs tâches ne sont donc pas dans la liste.
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

/**
 * Tâches de fond qui envoient de la fabrication automatique au fournisseur. Les autres ne sont jamais freinées, ni
 * celles que des gestes manuels réveillent par le même nom (tableau animé, lots d'images), ni le parcours de
 * conversation (réponses aux personnes, « stop » : il ne rend pas de compte d'appels).
 */
export const ANNEXES_AUTOMATIQUES: readonly string[] = ["comité éditorial", "parcours mot → guide"];

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

/** Ce que rend la tâche : combien de vrais appels fournisseur elle a faits (0 : tour à vide). */
export function appelsFaits(nom: string, resultat: unknown): number {
  const r = resultat as { etat?: string; envoyes?: number } | null | undefined;
  if (nom === "comité éditorial") return r?.etat === "envoye" ? 1 : 0;
  if (nom === "parcours mot → guide") return typeof r?.envoyes === "number" && r.envoyes > 0 ? r.envoyes : 0;
  return 0;
}

async function ajouterAuCompte(n: number, instant: number): Promise<void> {
  const jour = jourParis(instant);
  await sousVerrou(async () => {
    const c = await lireParametre<Compte | null>(PARAM_COMPTE_APPELS, null);
    await ecrireParametre(PARAM_COMPTE_APPELS, { jour, n: (c && c.jour === jour ? c.n : 0) + n } satisfies Compte);
  });
}

/**
 * Lance la tâche de fond `f` sous la limite. Éteinte, ou tâche hors liste : `f` part, rien n'est lu ni écrit.
 * Limite atteinte : `f` ne part pas. Sinon `f` part et seuls ses vrais appels sont comptés (aucune écriture à vide).
 */
export async function lancerSousLimite(nom: string, f: () => Promise<unknown>, instant: number = Date.now(), o: LecturesLimite = {}): Promise<unknown> {
  if (!ANNEXES_AUTOMATIQUES.includes(nom)) return f();
  try {
    const lire = o.lire ?? lireParametre;
    if ((await lire<boolean>(PARAM_LIMITE_ACTIVE, false)) !== true) return f();
    const limite = Number(await lire<number>(PARAM_LIMITE_PAR_JOUR, LIMITE_PAR_DEFAUT));
    const plafond = Number.isFinite(limite) && limite > 0 ? limite : LIMITE_PAR_DEFAUT;
    const c = await lire<Compte | null>(PARAM_COMPTE_APPELS, null);
    if (c && c.jour === jourParis(instant) && c.n >= plafond) return undefined;
  } catch {
    return f();
  }
  const resultat = await f();
  const n = appelsFaits(nom, resultat);
  if (n > 0) await ajouterAuCompte(n, instant).catch(() => undefined);
  return resultat;
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
