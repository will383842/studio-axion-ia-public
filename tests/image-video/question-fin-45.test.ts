/**
 * 25/10 · Question de fin lisible en 4:5. Le niveau « ligne » de la charte se mesure sur la hauteur de l'image : 0,022 × 1350
 * = 30 px en 4:5 contre 42 px en 9:16. En Image → vidéo 4:5, la question garde la taille du 9:16 (référence 1920),
 * sur 2 lignes au plus. Le comportement par défaut de la brique (cas concret, 9:16) ne change pas. Aucun appel, pur.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { disposer, type ProprietesEcran } from "@/briques/ecrans-motion";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { parametresDuBloc } from "@/services/image-video-rendu";

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const TAILLE_LIGNE = 0.022;

function questionDe(nom: "A" | "B" | "C" | "D" | "E" | "F", format: "9:16" | "4:5") {
  const carte: CarteImage = JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
  const fiche = FICHES_SIMULEES[`essai-${nom.toLowerCase()}`];
  // 26/10/2026 : la question n'est plus posée par défaut ; ce test porte sur son écran, donc le réglage « question puis fin ».
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, numeroVersion: 1, appelCommentaire: "question-puis-fin", questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
  const ligne = mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES, ...(format === "4:5" ? { format } : {}) }).ligne;
  const bloc = ligne.blocs.find((b) => b.sorte === "ecran" && b.ecran.type === "question")!;
  const p = parametresDuBloc(bloc, ligne).proprietes as unknown as ProprietesEcran;
  const pose = disposer(p).textes.find((t) => t.nom === "question")!;
  return { p, pose };
}

describe("question de fin · taille en 4:5", () => {
  for (const nom of ["A", "B", "C", "D", "E", "F"] as const) {
    it(`carte ${nom} : en 4:5 la question est à la taille du 9:16 (≥ 0,022 × 1920 × 0,75), tient, sur 2 lignes au plus`, () => {
      const q45 = questionDe(nom, "4:5");
      const q916 = questionDe(nom, "9:16");
      expect(q45.pose.tient).toBe(true);
      expect(q45.pose.lignes.length).toBeLessThanOrEqual(2);
      // Taille rendue ≥ 75 % de celle du 9:16 (plancher des textes Inter) et très au-dessus des ~30 px de l'ancien 4:5.
      expect(q45.pose.tailleRendue).toBeGreaterThanOrEqual(TAILLE_LIGNE * 1920 * 0.75);
      expect(q45.pose.tailleRendue).toBeGreaterThan(TAILLE_LIGNE * 1350 + 1);
      expect(q45.pose.taille).toBeCloseTo(TAILLE_LIGNE * 1920, 5);
      // 9:16 strictement inchangé : taille de la charte sur 1920, aucune propriété de plus.
      expect(q916.pose.taille).toBeCloseTo(TAILLE_LIGNE * 1920, 5);
      expect("hauteurLigneRef" in q916.p).toBe(false);
    });
  }

  it("le défaut de la brique ne change pas : sans `hauteurLigneRef`, la question suit la hauteur de l'image (0,022 × 1350)", () => {
    const { p } = questionDe("C", "4:5");
    const sans = { ...p } as Record<string, unknown>;
    delete sans.hauteurLigneRef;
    const pose = disposer(sans as unknown as ProprietesEcran).textes.find((t) => t.nom === "question")!;
    expect(pose.taille).toBeCloseTo(TAILLE_LIGNE * 1350, 5);
  });

  it("la question plus grande ne réduit pas les titres de l'écran ni ne les fait déborder (mêmes tailles qu'avant, tout dans la zone utile)", () => {
    for (const nom of ["A", "B", "C", "D", "E", "F"] as const) {
      const { p } = questionDe(nom, "4:5");
      const sans = { ...p } as Record<string, unknown>;
      delete sans.hauteurLigneRef;
      const avant = disposer(sans as unknown as ProprietesEcran).textes;
      const apres = disposer(p).textes;
      for (const t of apres.filter((x) => x.nom.startsWith("titre-"))) expect(t.taille, `${nom} · ${t.nom}`).toBeCloseTo(avant.find((x) => x.nom === t.nom)!.taille, 5);
      for (const t of apres) expect(t.boite.y + t.boite.hauteur, `${nom} · ${t.nom}`).toBeLessThanOrEqual(p.zone.y + p.zone.hauteur + 0.5);
    }
  });
});
