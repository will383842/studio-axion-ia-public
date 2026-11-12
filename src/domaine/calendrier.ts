/**
 * Vue unifiée du calendrier (L4-02) : une EntreeCalendrier par publication ou par créneau du plan. PUR, sans réseau.
 * Règle de non-doublon : un créneau n'est pas montré si, pour chacun de ses réseaux, une publication existe
 * déjà pour le même média, le même réseau et le même jour de Paris (la publication fait foi).
 */

export type FamilleEntree = "video" | "carrousel";
export type OrigineEntree = "publication" | "creneau";

export interface EntreeCalendrier {
  /** « publication:<id> » ou « creneau:<id> » : unique dans la vue. */
  cle: string;
  /** Jour de Paris, AAAA-MM-JJ. */
  jour: string;
  famille: FamilleEntree;
  origine: OrigineEntree;
  titre: string;
  /** Clé de stockage de la vignette, ou null si le média est introuvable ou sans rendu. */
  vignette: string | null;
  /** Lien vers le média, ou null : jamais « /videos/undefined ». */
  lien: string | null;
  reseaux: string[];
  mediaId: string | null;
  statut: string;
}

/** Lien vers un média ; un identifiant absent, vide ou littéralement « undefined »/« null » ne donne aucun lien. */
export function lienMedia(famille: FamilleEntree, id: string | null | undefined): string | null {
  const v = (id ?? "").trim();
  if (!v || v === "undefined" || v === "null") return null;
  const racine = famille === "video" ? "/videos/" : "/visuels/";
  return racine + encodeURIComponent(v);
}

function cleCouverture(mediaId: string | null, reseau: string, jour: string): string {
  return `${mediaId ?? ""}|${reseau}|${jour}`;
}

/** Fusionne publications et créneaux (déjà convertis) en appliquant le non-doublon ; tri par jour puis par clé. */
export function fusionnerEntrees(publications: EntreeCalendrier[], creneaux: EntreeCalendrier[]): EntreeCalendrier[] {
  const couvert = new Set<string>();
  for (const p of publications) {
    if (!p.mediaId) continue;
    for (const r of p.reseaux) couvert.add(cleCouverture(p.mediaId, r, p.jour));
  }
  const restants = creneaux.filter((c) => !(c.mediaId && c.reseaux.length > 0 && c.reseaux.every((r) => couvert.has(cleCouverture(c.mediaId, r, c.jour)))));
  return [...publications, ...restants].sort((a, b) => a.jour.localeCompare(b.jour) || a.cle.localeCompare(b.cle));
}
