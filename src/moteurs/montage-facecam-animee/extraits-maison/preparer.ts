/**
 * Extraits maison de la v4 : préparer l'extrait en clip 4:5 muet (ffmpeg du studio).
 * Réutilise sans le modifier l'encodage de `images/preparation.ts`. Deux modes de lecture, choisis par l'appelant :
 * `direct` (l'adresse signée https va telle quelle en `-i`) ou `telecharger` (copie locale puis `-i`).
 * Lecture HTTPS du ffmpeg du studio non vérifiée : à contrôler avant allumage. Aucun réglage, aucune dépense.
 */
import { join } from "node:path";
import { argumentsEncodage, longueurExtrait, OCTETS_MAX_EXTRAIT, type OutilsPreparation } from "../images/preparation";

/** Le contrat des arguments ffmpeg (4:5, 1080×1350, `-an`, `-ss` avant `-i`), figé par test. */
export const argumentsExtraitMaisonV4 = argumentsEncodage;

export interface PlageExtraitV4 { debutSec: number; finSec: number }
export interface CibleExtraitV4 { cle: string; dureeFenetreSec: number }
export interface LectureExtraitV4 { adresse: string; mode: "direct" | "telecharger" }
export interface ExtraitPrepareV4 { cle: string; debutSec: number; dureeSec: number; octets: number }

export async function preparerExtraitV4(extrait: PlageExtraitV4, cible: CibleExtraitV4, outils: OutilsPreparation, lecture: LectureExtraitV4): Promise<ExtraitPrepareV4> {
  const longueur = longueurExtrait(cible.dureeFenetreSec, extrait.finSec - extrait.debutSec);
  if (extrait.debutSec + longueur > extrait.finSec + 0.01) throw new Error("plage de l'extrait trop courte pour la fenêtre");
  if (lecture.mode === "direct" && !lecture.adresse.startsWith("https://")) throw new Error("lecture directe : adresse https:// requise");
  const verrou = <T>(f: () => Promise<T>) => (outils.sousVerrou ? outils.sousVerrou(f) : f());
  const dossier = await outils.dossierTravail(cible.cle.replace(/[^a-z0-9-]/gi, "_"));
  try {
    const sortie = join(dossier, "extrait.mp4");
    const octets = await verrou(async () => {
      let source = lecture.adresse;
      if (lecture.mode === "telecharger") {
        source = join(dossier, "source.mp4");
        await outils.telecharger(lecture.adresse, source);
      }
      let crf = 21;
      await outils.executer("ffmpeg", argumentsExtraitMaisonV4(source, sortie, extrait.debutSec, longueur, crf));
      let t = await outils.taille(sortie);
      while (t > OCTETS_MAX_EXTRAIT && crf < 33) {
        crf += 4;
        await outils.executer("ffmpeg", argumentsExtraitMaisonV4(source, sortie, extrait.debutSec, longueur, crf));
        t = await outils.taille(sortie);
      }
      return t;
    });
    if (octets > OCTETS_MAX_EXTRAIT) throw new Error("extrait trop lourd même à la qualité minimale");
    const cle = await outils.deposer(sortie, cible.cle);
    return { cle, debutSec: extrait.debutSec, dureeSec: longueur, octets };
  } finally {
    await outils.supprimerDossier?.(dossier).catch(() => undefined);
  }
}
