/**
 * BANQUE DE BRUITAGES MODERNES (lot du 02/10, D1 ; consigne `INTENSITE-ET-BRUITAGES.md` §2). PUR.
 *
 * Vingt sons (cinq déclencheurs × quatre variantes), fabriqués par synthèse dans le studio
 * (`outils/bruitages/fabriquer.mts`, fichiers dans `public/bruitages/`) : créations originales, libres de droits,
 * usage commercial permis, CC0 1.0 — la licence est enregistrée SUR CHAQUE ÉLÉMENT. Sonie normalisée à la
 * fabrication (niveau actif −20 dBFS, crête ≤ −3 dBFS).
 *
 * Tous arrivent « à vérifier » : AUCUN n'est posé dans une vidéo tant que Will ne l'a pas écouté et validé
 * (Bibliothèque › Bruitages). Les sons d'avant le lot (sans déclencheur) ne sont jamais posés automatiquement.
 */
import type { DeclencheurBruitage, ElementBibliotheque, Fichier, Licence } from "@/domaine/types";

/** Licence de chaque son de la banque (créations originales du studio). */
export const LICENCE_BRUITAGES: Licence = {
  type: "libre",
  usageCommercial: true,
  reseaux: [],
  source: "Création originale du studio, fabriquée par synthèse (outils/bruitages/fabriquer.mts). Domaine public (CC0 1.0) : usage commercial permis, aucune attribution.",
};

/** Ce que chaque déclencheur accompagne à l'image, en clair (écran d'écoute). */
export const LIBELLES_DECLENCHEURS: Record<DeclencheurBruitage, { nom: string; quand: string }> = {
  chiffre: { nom: "Tic", quand: "Un chiffre apparaît" },
  document: { nom: "Papier", quand: "Un document glisse" },
  telephone: { nom: "Vibration", quand: "Un téléphone vibre" },
  "illustration-forte": { nom: "Souffle court", quand: "Une image forte entre" },
  impact: { nom: "Pop grave", quand: "Un mot en grand" },
};

interface SonBanque {
  declencheur: DeclencheurBruitage;
  variante: number;
  dureeSec: number;
}

/** Les vingt sons (durées mesurées par l'outil : `public/bruitages/manifeste.json`). */
export const SONS_BANQUE: SonBanque[] = [
  ...[0.09, 0.09, 0.09, 0.09].map((d, i) => ({ declencheur: "chiffre" as const, variante: i + 1, dureeSec: d })),
  ...[0.3, 0.33, 0.28, 0.35].map((d, i) => ({ declencheur: "document" as const, variante: i + 1, dureeSec: d })),
  ...[0.31, 0.3, 0.32, 0.29].map((d, i) => ({ declencheur: "telephone" as const, variante: i + 1, dureeSec: d })),
  ...[0.24, 0.26, 0.22, 0.28].map((d, i) => ({ declencheur: "illustration-forte" as const, variante: i + 1, dureeSec: d })),
  ...[0.16, 0.17, 0.15, 0.18].map((d, i) => ({ declencheur: "impact" as const, variante: i + 1, dureeSec: d })),
];

/** Niveau actif normalisé à la fabrication (dBFS ; le mixage mesure de toute façon chaque son). */
export const SONIE_BANQUE_DB = -20;

export const cleBruitage = (s: Pick<SonBanque, "declencheur" | "variante">) => `/bruitages/${s.declencheur}-${s.variante}.wav`;
export const idElementBruitage = (s: Pick<SonBanque, "declencheur" | "variante">) => `bruit-${s.declencheur}-${s.variante}`;
export const idFichierBruitage = (s: Pick<SonBanque, "declencheur" | "variante">) => `f-bruitages-${s.declencheur}-${s.variante}`;

export function fichiersBruitages(maintenant: string): Fichier[] {
  return SONS_BANQUE.map((s) => ({
    id: idFichierBruitage(s),
    cleStockage: cleBruitage(s),
    nom: `${s.declencheur}-${s.variante}.wav`,
    mime: "audio/wav",
    taille: 44 + Math.round(s.dureeSec * 48000) * 2,
    dureeSec: s.dureeSec,
    origine: "demo" as const,
    statut: "pret" as const,
    creeLe: maintenant,
    modifieLe: maintenant,
  }));
}

/** Les éléments de la Bibliothèque, tous « à vérifier ». */
export function elementsBruitages(maintenant: string): ElementBibliotheque[] {
  return SONS_BANQUE.map((s) => ({
    id: idElementBruitage(s),
    type: "bruitage" as const,
    nom: `${LIBELLES_DECLENCHEURS[s.declencheur].nom} ${s.variante}`,
    motsCles: ["bruitage", LIBELLES_DECLENCHEURS[s.declencheur].nom.toLowerCase(), s.declencheur],
    valeur: { type: "bruitage" as const, categorie: s.declencheur === "telephone" ? ("notification" as const) : ("impact" as const), dureeSec: s.dureeSec, declencheur: s.declencheur, variante: s.variante, ecoute: "a_verifier" as const, sonieLufs: SONIE_BANQUE_DB },
    fichierId: idFichierBruitage(s),
    licence: LICENCE_BRUITAGES,
    formatsParDefaut: [],
    marqueId: "marque-axion",
    creeLe: maintenant,
    modifieLe: maintenant,
  }));
}

/* ------------------------------------------------------------------ */
/* Tableau animé, style « blocs/2 » (11/10, ajout pur)                   */
/* ------------------------------------------------------------------ */

/** Familles des bruitages du tableau animé (vidéo modèle « Formation »). */
export type FamilleBruitageTableau = "trait" | "toc" | "validation";

export interface SonTableau {
  famille: FamilleBruitageTableau;
  /** Ce que le son accompagne à l'image, en clair. */
  quand: string;
  cleStockage: string;
  dureeSec: number;
  /** Crête du fichier (dBFS, mesurée par `volumedetect`). */
  creteDb: number;
  /** Gain posé au mixage (dB) : le son reste au moins 18 dB sous la voix en crête. */
  gainDb: number;
}

/**
 * Les trois bruitages du style « blocs/2 », DANS cette banque (la seule du studio) : fabriqués par synthèse pour la
 * vidéo modèle (`maquettes/tableau-design-v2/video/formation/bruitages/fabriquer.sh`, ffmpeg : bruit rose filtré,
 * sinus courts), créations originales, même licence CC0 que les vingt autres. Ils ne sont posés que par le plan d'une
 * scène du tableau (`src/briques/tableau-scene/v2/animation.ts`), jamais par le placement des autres formats.
 * Gains de la vidéo modèle (−17 dB, puis −1 et −3 dB selon le son) : 22 dB sous la voix en crête, mesuré.
 */
export const SONS_TABLEAU: readonly SonTableau[] = Object.freeze([
  { famille: "trait", quand: "Le crayon trace sur un mot fort (soulignement, croix, gribouillis)", cleStockage: "/bruitages/tableau-trait.wav", dureeSec: 0.2, creteDb: -7.6, gainDb: -17 },
  { famille: "toc", quand: "Un numéro d'étape (ou le mot de l'appel) arrive", cleStockage: "/bruitages/tableau-toc.wav", dureeSec: 0.12, creteDb: -5.8, gainDb: -18 },
  { famille: "validation", quand: "Une coche se pose", cleStockage: "/bruitages/tableau-validation.wav", dureeSec: 0.36, creteDb: -6.6, gainDb: -20 },
]);
