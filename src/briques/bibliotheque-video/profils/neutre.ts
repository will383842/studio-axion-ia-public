/**
 * Profil neutre (C1-U3, PLAN-FINAL § 3.2 et 3.4) : aucune capacité, le format garde sa vidéo d'aujourd'hui.
 * Module pur côté Studio : aucun service, aucun réglage lu, aucune date, aucun hasard.
 */
import { ID } from "../noms";
import type { BlocExtraits, ProfilVideo } from "../types";

/** Droit des extraits par défaut : Q5 vrai, P-4 faux partout, 3 s, une source par vidéo. */
export const EXTRAITS_PAR_DEFAUT: BlocExtraits = Object.freeze({
  visageSurInstagram: true,
  texteIncrusteAccepte: Object.freeze({}),
  dureeMinSec: 3,
  uneSourceParVideo: true,
});

/** Fige un profil et ses sous-objets (profondeur utile : un profil est une liste de permissions, jamais modifiée). */
export function figerProfil(p: ProfilVideo): ProfilVideo {
  for (const r of Object.values(p.capacites)) if (r) Object.freeze(r);
  Object.freeze(p.capacites); Object.freeze(p.plafonds); Object.freeze(p.memoire); Object.freeze(p.verrous);
  const b = p.blocs;
  if (b) {
    if (b.texteEcran) { Object.freeze(b.texteEcran.teintes); Object.freeze(b.texteEcran.cibles); Object.freeze(b.texteEcran.intensites); Object.freeze(b.texteEcran); }
    Object.freeze(b);
  }
  return Object.freeze(p);
}

export function profilNeutre(formatId: string): ProfilVideo {
  return figerProfil({
    id: "neutre", formatId, version: 1,
    capacites: {}, plafonds: {},
    memoire: { fenetreVideos: 10, portee: "format" },
    verrous: [ID.calqueTexteDerriereDouble],
  });
}

/**
 * Formats sans profil propre (A1-6) : le test échoue si un format n'est ni profilé ni listé ici.
 * PLAN-FINAL disait « 6 » : `tutoriel-outil` et `demo-facecam` sont arrivés depuis, puis sortis de la liste par N-02 et G3-11.
 * Un format par ligne (couloir K9 : diffs d'une ligne).
 */
export const FORMATS_PROFIL_NEUTRE: readonly string[] = Object.freeze([
  "podcast",
  "createur-b",
  "ecran-partage",
  "motion",
  "ugc",
  "selfie",
  "video-longue",
  "tableau-de-bord",
]);
