import "server-only";
/**
 * Journal des actions sensibles : UNE ligne par action, sur la sortie standard, préfixe stable « studio_sensible ».
 * Actions suivies : interrupteur d'envoi, promotion, clé, export, prise de main.
 * Journal SÉPARÉ de journal-envoi.ts, et jamais purgé : ce module n'offre aucune purge.
 *
 * Liste blanche stricte : seuls ces champs sortent, et chacun doit avoir la forme attendue (sinon il est ignoré).
 *   ts (ISO, posé ici), action, acteur (un rôle : fondateur|routine|systeme), cible (nom de réglage ou d'objet), etat.
 * Jamais : e-mail, pseudo, nom de personne ou de compte, valeur de clé, texte libre. Module SERVEUR.
 */

export const PREFIXE_JOURNAL_SENSIBLE = "studio_sensible";

export const ACTIONS_SENSIBLES = ["interrupteur", "promotion", "cle", "export", "priseDeMain"] as const;
export type ActionSensible = (typeof ACTIONS_SENSIBLES)[number];

const ACTEURS = ["fondateur", "routine", "systeme"] as const;
export type ActeurSensible = (typeof ACTEURS)[number];

export interface EvenementSensible {
  action: ActionSensible;
  acteur?: ActeurSensible;
  /** Nom technique d'un réglage ou d'un objet (ex. « zernio.envoi_calendrier_autorise »). Jamais une personne. */
  cible?: string;
  /** allume|eteint|cree|revoque|promu|lance… : un mot court. */
  etat?: string;
}

const FORME_CIBLE = /^[a-z0-9][a-z0-9_.-]{0,79}$/;
const FORME_ETAT = /^[a-z][a-zA-Z0-9_-]{0,29}$/;

/** Ne garde que les champs autorisés, de la bonne forme. Retourne null si l'action est inconnue. */
export function filtrerActionSensible(brut: unknown): Record<string, string> | null {
  const e = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  if (!(ACTIONS_SENSIBLES as readonly unknown[]).includes(e.action)) return null;
  const sortie: Record<string, string> = { ts: new Date().toISOString(), action: e.action as string };
  if ((ACTEURS as readonly unknown[]).includes(e.acteur)) sortie.acteur = e.acteur as string;
  if (typeof e.cible === "string" && FORME_CIBLE.test(e.cible)) sortie.cible = e.cible;
  if (typeof e.etat === "string" && FORME_ETAT.test(e.etat)) sortie.etat = e.etat;
  return sortie;
}

/** Écrit la ligne. Ne lève jamais : le journal ne doit jamais changer le comportement de l'action. */
export function journaliserActionSensible(evenement: EvenementSensible): void {
  try {
    const f = filtrerActionSensible(evenement);
    if (f) console.log(`${PREFIXE_JOURNAL_SENSIBLE} ${JSON.stringify(f)}`);
  } catch {
    /* rien */
  }
}

/** Une ligne par bascule de l'interrupteur d'envoi. */
export function journaliserBasculeInterrupteur(p: { acteur: ActeurSensible; reglage: string; etat: boolean }): void {
  journaliserActionSensible({ action: "interrupteur", acteur: p.acteur, cible: p.reglage, etat: p.etat ? "allume" : "eteint" });
}
