/**
 * Sous-titres VARIÉS du format (décision de Will du 15/10) : le mélange de la brique commune (Impact, Bandeau,
 * intensité « Équilibré »), adapté à la bande unique `BANDE_SOUS_TITRES_IV`, contrôlé par Q22 sur chaque variation.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV, type ReseauIV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { controlerVariationsIV, INTENSITE_SOUS_TITRES_IV, sousTitresVariesIV } from "@/moteurs/montage-image-video/sous-titres-varies";
import { BANDE_SOUS_TITRES_IV } from "@/briques/schema-motion/types";

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const carteDe = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));

function miseEnScene(nom: string, reseau: ReseauIV) {
  const carte = carteDe(nom);
  const fiche = FICHES_SIMULEES[`essai-${nom.toLowerCase()}` as keyof typeof FICHES_SIMULEES];
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes(reseau))!;
  return mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES });
}


describe("sous-titres variés de l'image C", () => {
  it("TikTok : des variations (au moins une Impact ou Bandeau sur un chiffre), toutes dans la bande, Q22 vert", () => {
    const res = miseEnScene("C", "youtube-shorts");
    const segments = sousTitresVariesIV(res.ligne);
    const accents = segments.filter((s) => s.style === "impact" || s.style === "bandeau");
    expect(accents.length).toBeGreaterThanOrEqual(2);
    // Un chiffre de la carte (80 %, 20 %, 4 secondes, 24h/24, 3 heures…) dit pendant une variation.
    const surUnChiffre = accents.filter((s) => res.ligne.chiffresDits.some((c) => c.t >= s.debutSec - 1e-3 && c.t < s.finSec));
    expect(surUnChiffre.length).toBeGreaterThan(0);
    expect(controlerVariationsIV(segments, res.ligne)).toEqual([]);
    const q22 = res.rapport.lignes.find((l) => l.code === "Q22")!;
    expect(q22.ok, q22.details.join(" ")).toBe(true);
    for (const s of accents) expect(s.position).toBe("milieu");
  });

  it("Q22 rougit sur une variation qui sortirait de la bande (Impact très grand et incliné, glissement d'entrée)", () => {
    const res = miseEnScene("C", "youtube-shorts");
    const segments = sousTitresVariesIV(res.ligne);
    const i = segments.findIndex((s) => s.style === "impact");
    const trop = segments.map((s, k) => (k === i ? { ...s, importance: 3, inclinaison: 4 } : s));
    expect(controlerVariationsIV(trop, res.ligne).join(" ")).toMatch(/Impact.*(sous la bande|au-dessus de la bande)/);
    // Un bandeau dans la bande glisse de 40 px à l'entrée (brique commune) : il en sort, Q22 le voit.
    const j = segments.findIndex((s, k) => s.style === "base" && s.mots.length >= 2 && k > 0 && segments[k - 1].style === "base" && segments[k + 1]?.style === "base");
    const bandeau = segments.map((s, k) => (k === j ? { ...s, style: "bandeau" as const, importance: 2, position: "milieu" as const } : s));
    expect(controlerVariationsIV(bandeau, res.ligne).join(" ")).toMatch(/Bandeau/);
    // Deux variations collées.
    const colles = segments.map((s, k) => (k === i + 1 ? { ...s, style: "impact" as const, importance: 2, inclinaison: 0, position: "milieu" as const } : s));
    expect(controlerVariationsIV(colles, res.ligne).join(" ")).toMatch(/collées/);
  });
});

describe("sous-titres variés : les 6 images, les 5 réseaux", () => {
  for (const nom of ["A", "B", "C", "D", "E", "F"]) {
    it(`${nom} : variations présentes, au centre de la bande, jamais collées, jamais sur la question ; Q22 vert`, () => {
      expect(INTENSITE_SOUS_TITRES_IV).toBe("equilibre");
      for (const r of RESEAUX_IV) {
        const res = miseEnScene(nom, r);
        const segments = sousTitresVariesIV(res.ligne);
        const accents = segments.filter((s) => s.style === "impact" || s.style === "bandeau");
        expect(accents.length, `${nom} ${r}`).toBeGreaterThan(0);
        for (const s of accents) expect(s.position).toBe("milieu");
        segments.forEach((s, k) => {
          if (s.style !== "base" && segments[k + 1]) expect(segments[k + 1].style, `${nom} ${r} groupe ${k}`).toBe("base");
        });
        for (const p of res.ligne.plans.filter((x) => x.scene === "question")) for (const s of accents) expect(s.finSec <= p.debut + 1e-6 || s.debutSec >= p.fin - 1e-6, `${nom} ${r}`).toBe(true);
        // Mêmes mots que la ligne de temps : seul le style change, jamais le texte ni les heures.
        expect(segments.map((s) => s.mots.map((m) => [m.mot, m.debutSec, m.finSec]))).toEqual(res.ligne.sousTitres.groupes.map((g) => g.mots.map((m) => [m.mot, m.debutSec, m.finSec])));
        expect(controlerVariationsIV(segments, res.ligne), `${nom} ${r}`).toEqual([]);
        const q22 = res.rapport.lignes.find((l) => l.code === "Q22")!;
        expect(q22.ok, `${nom} ${r} ${q22.details.join(" ")}`).toBe(true);
        expect(res.ligne.sousTitres.bande).toEqual({ haut: BANDE_SOUS_TITRES_IV.haut, bas: BANDE_SOUS_TITRES_IV.bas });
      }
    });
  }

  it("déterministe : même ligne de temps, mêmes variations", () => {
    const l = miseEnScene("C", "instagram").ligne;
    expect(JSON.stringify(sousTitresVariesIV(l))).toBe(JSON.stringify(sousTitresVariesIV(l)));
  });
});
