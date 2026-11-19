/**
 * Prédicat partagé « envoyable » : utilisé par le tour d'envoi du calendrier ET par l'essai borné (un seul chemin).
 * `programme` = placé en un clic par le Studio (`plan-vers-publication.ts`), jamais une preuve d'envoi.
 */
export const STATUTS_CRENEAU_ENVOYABLES = ["valide", "programme"] as const;

const STATUTS_VISUEL_ENVOYABLES: readonly string[] = ["valide", "programme"];

interface CreneauEnvoyable {
  statut?: string;
  valideeLe?: string;
  refuseLe?: string;
  retireLe?: string;
  aRenvoyer?: boolean;
}

/** Statut permis, validation datée lisible (et passée si l'heure est fournie), ni refusé, ni retiré, ni à renvoyer. */
export function creneauEnvoyable(c: CreneauEnvoyable, maintenantMs?: number): boolean {
  if (!c.statut || !(STATUTS_CRENEAU_ENVOYABLES as readonly string[]).includes(c.statut)) return false;
  const validee = typeof c.valideeLe === "string" && c.valideeLe !== "" ? Date.parse(c.valideeLe) : NaN;
  if (!Number.isFinite(validee)) return false;
  if (maintenantMs !== undefined && validee > maintenantMs) return false;
  return !c.refuseLe && !c.retireLe && !c.aRenvoyer;
}

export const visuelEnvoyable = (v: { statut?: string }): boolean => !!v.statut && STATUTS_VISUEL_ENVOYABLES.includes(v.statut);
