/**
 * VIGNETTES AXION V2 (lot 1), côté studio. PUR.
 * Ici : la garde du texte de couverture, la rotation des ambiances et des mises en page, la famille des générateurs.
 */
import { interditsDans } from "@/domaine/qualite-script";
import { interditsTousEcrivains } from "@/domaine/qualite-script/regles/interdits";
import { normaliser } from "@/domaine/controles-script/texte";

/** Gabarits de miniature : `r4` (actuel, défaut) et `axion-v2` (réglage `miniature.gabarit`, éteint). */
export const GABARITS_MINIATURE = ["r4", "axion-v2"] as const;
export type GabaritMiniature = (typeof GABARITS_MINIATURE)[number];

/** Motifs propres aux vignettes (la liste des écrivains n'est pas touchée), sur le texte normalisé. */
const MOTIFS_VIGNETTE: readonly { libelle: string; motif: RegExp }[] = [
  { libelle: "« faites-le vous-même »", motif: /(?:^|[^a-z])faites[\s-]+le[\s-]+vous[\s-]*meme(?=$|[^a-z])/ },
  { libelle: "« Certifexemple »", motif: /(?:^|[^a-z])certifexemple(?=$|[^a-z])/ },
  { libelle: "« certifié(e)(s) »", motif: /(?:^|[^a-z])certifi(?:e|ee|es|ees)?(?:\(e\))?(?:\(s\))?(?=$|[^a-z])/ },
];

/** Libellés des interdits trouvés dans le titre d'une vignette (vide = le titre peut partir). */
export function interditsVignette(brut: string): string[] {
  // Invisibles retirés, toute espace (insécable, fine, tabulation) ramenée à une espace simple : même rendu, même verdict.
  const texte = brut.replace(/[­​-‍⁠﻿]/g, "").replace(/\s+/g, " ");
  const n = normaliser(texte.replace(/[‐-―−]/g, "-"));
  return [
    ...interditsDans(texte, "ecrire").map((i) => i.libelle),
    ...interditsTousEcrivains(texte),
    ...MOTIFS_VIGNETTE.filter((m) => m.motif.test(n)).map((m) => m.libelle),
  ];
}

export type AmbianceVignette = "encre" | "ivoire";
export type MiseVignette = "m1" | "m2" | "m3";

/** Alternance encre / ivoire d'une vidéo à l'autre (rang pair : encre) ; le trio de composition est toujours m1, m2, m3. */
export function ambianceEtMises(rangVideo: number): { ambiance: AmbianceVignette; mises: MiseVignette[] } {
  const rang = Number.isFinite(rangVideo) ? Math.abs(Math.trunc(rangVideo)) : 0;
  return { ambiance: rang % 2 === 0 ? "encre" : "ivoire", mises: ["m1", "m2", "m3"] };
}

/** Rang d'une vidéo pour l'alternance : le numéro de son code interne (« 0005-FC-TT-L · … »), sinon son épisode, sinon 0. */
export function rangDeVideo(video: { titre: string; episodeSerie?: number }): number {
  const code = /^\s*(\d{3,5})(?:-[A-Z0-9]{1,4}){2,4}\s*[·•]/i.exec(video.titre);
  return code ? Number(code[1]) : (video.episodeSerie ?? 0);
}

const SANS_VISAGE: readonly string[] = ["tableau-anime", "cas-concret", "image-video", "motion"];

/** Le générateur montre-t-il un visage ? (avocat, facecam, facecam-animee, selfie, createur-b, podcast, ecran-partage, ugc : oui.) */
export function famille(formatId: string): { visage: boolean } {
  return { visage: !SANS_VISAGE.includes(formatId) };
}
