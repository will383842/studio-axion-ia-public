/**
 * T-EXT-34 · JOURNAL DES RÔLES du tutoriel d'outil : l'ÉTAT de chaque rôle de l'équipe, rien d'autre (jamais ses sorties,
 * qui vivent dans `travail.parametres.tutoriel.equipe`). Rangé dans `travail.parametres.tutoriel.roles`.
 * C'est le contrat que la fiche d'intégration des rôles remplit ; ici, deux fonctions pures et tolérantes.
 */

export const ROLES = ["chef-de-projet", "analyste", "maquettiste", "stratege", "scenariste", "realisateur", "directeur-motion", "controleur", "regardeur", "documentaliste"] as const;
export type IdRole = (typeof ROLES)[number];

export const ETATS_ROLE = ["a-venir", "en-cours", "attend-williams", "fait", "a-revoir", "saute"] as const;
export type EtatRole = (typeof ETATS_ROLE)[number];

export const RESUME_MAX = 120;

export interface LigneJournal {
  role: IdRole;
  etat: EtatRole;
  /** Date ISO de la note. */
  le: string;
  /** Une phrase courte (120 caractères au plus), sans mot technique. */
  resume?: string;
}

const estRole = (v: unknown): v is IdRole => typeof v === "string" && (ROLES as readonly string[]).includes(v);
const estEtat = (v: unknown): v is EtatRole => typeof v === "string" && (ETATS_ROLE as readonly string[]).includes(v);

function lignesBrutes(etat: unknown): unknown[] {
  const roles = etat && typeof etat === "object" ? (etat as { roles?: unknown }).roles : undefined;
  return Array.isArray(roles) ? roles : [];
}

/** Une ligne bien formée, ou rien. Le résumé est coupé à 120 caractères. */
function ligneValide(v: unknown): LigneJournal | null {
  if (!v || typeof v !== "object") return null;
  const { role, etat, le, resume } = v as Record<string, unknown>;
  if (!estRole(role) || !estEtat(etat) || typeof le !== "string" || !le) return null;
  const r = typeof resume === "string" && resume.trim() ? resume.trim().slice(0, RESUME_MAX) : undefined;
  return { role, etat, le, ...(r ? { resume: r } : {}) };
}

/**
 * Note l'état d'un rôle dans l'état du tutoriel. PUR : l'objet reçu n'est pas modifié, aucune ligne n'est effacée
 * (la nouvelle s'ajoute à la suite) ; une ligne mal formée est refusée en silence (l'état revient inchangé).
 */
export function noterRole<T extends object>(etat: T, ligne: LigneJournal): T & { roles: LigneJournal[] } {
  const valide = ligneValide(ligne);
  const avant = lignesBrutes(etat) as LigneJournal[];
  return { ...etat, roles: valide ? [...avant, valide] : avant };
}

/**
 * Lit le journal dans `travail.parametres` : la DERNIÈRE ligne de chaque rôle, dans l'ordre de l'équipe. Absent ou mal
 * formé : liste vide (jamais d'exception) ; une ligne abîmée est ignorée, les autres restent lues.
 */
export function lireJournalRoles(parametres: unknown): LigneJournal[] {
  const tutoriel = parametres && typeof parametres === "object" ? (parametres as { tutoriel?: unknown }).tutoriel : undefined;
  const derniere = new Map<IdRole, LigneJournal>();
  for (const brute of lignesBrutes(tutoriel)) {
    const l = ligneValide(brute);
    if (l) derniere.set(l.role, l);
  }
  return ROLES.flatMap((r) => derniere.get(r) ?? []);
}
