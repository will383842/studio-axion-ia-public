/** RAP-3 · seuils du retrait groupé des rapatriées introuvables (constantes pures, sans dépendance). */
/** Réponses « introuvable » à des passages DISTINCTS exigées avant qu'une rapatriée soit retirable en groupe. */
export const CONSTATS_INTROUVABLE_REQUIS = 2;
/** Délai minimal entre le PREMIER et le DERNIER constat « introuvable » (le dernier doit en plus dater de moins d'une heure). */
export const DELAI_RETRAIT_INTROUVABLE_MS = 24 * 3_600_000;
/** Fraîcheur exigée du dernier constat « introuvable » au moment d'un retrait groupé. */
export const FRAICHEUR_CONSTAT_INTROUVABLE_MS = 3_600_000;
/** Une rapatriée « à vérifier » aux constats faits est relue seule au plus tous les 30 min, et 10 au plus par passage (après les publications du Studio). */
export const RELECTURE_INTROUVABLE_MIN_MS = 30 * 60_000;
export const RELECTURES_INTROUVABLES_PAR_PASSAGE = 10;
export const MESSAGE_AUCUN_POST_RETROUVE = "Le diffuseur ne retrouve aucun de vos posts : vérifiez la connexion avant de retirer quoi que ce soit.";
/** Une mesure d'écart n'est « vérifiée » que si elle date de moins d'une heure. */
export const VALIDITE_MESURE_ECART_MS = 3_600_000;

/** Mesure d'écart minimale (forme de `EcartCalendrier`, sans dépendance). */
export interface MesureEcartMinimale {
  luLe: string;
  verifie: boolean;
  absents: number;
  /** Jamais mesuré : aucune mesure n'a été écrite (la mesure rendue n'est alors qu'un gabarit). */
  jamaisMesuree?: boolean;
  /** Publications suivies (attendues chez le diffuseur) au dernier passage vérifié. Absent : mesure d'avant, rien n'atteste l'espace. */
  suivies?: number;
  /** Posts de la liste vérifiée qui sont des publications connues AVANT tout soupçon d'espace inconnu. Absent : idem. */
  connusFiables?: number;
  /** Premier passage où la liste ne contenait aucun post connu alors que des publications étaient suivies (collant jusqu'au retour d'un post connu). */
  espaceSuspectLe?: string;
}

/** Faux (avec message) si la mesure laisse penser que la clé relie un AUTRE espace : aucune publication suivie retrouvée dans la liste vérifiée. */
export function mesureAttesteEspaceConnu(m: MesureEcartMinimale | null | undefined): boolean {
  return !!m && !m.espaceSuspectLe && typeof m.suivies === "number" && typeof m.connusFiables === "number" && !(m.suivies > 0 && m.connusFiables === 0);
}

/**
 * VRAI seulement pour une mesure VÉRIFIÉE, de moins d'une heure, sans écart « absents » : jamais « non vérifié », jamais « jamais mesuré ».
 * ATTENTION : la mesure n'atteste l'absence que des posts programmés, brouillons et en cours de publication (les seuls statuts lus en liste) :
 * un post publié ou en échec n'y figure jamais. Seule une lecture unitaire récente (dernier constat) prouve l'absence d'un post donné.
 */
export function mesureVerifieeRecente(m: MesureEcartMinimale | null | undefined, maintenantMs: number): boolean {
  if (!m || m.jamaisMesuree || !m.verifie || m.absents > 0) return false;
  const lu = Date.parse(m.luLe);
  return Number.isFinite(lu) && maintenantMs - lu <= VALIDITE_MESURE_ECART_MS;
}
