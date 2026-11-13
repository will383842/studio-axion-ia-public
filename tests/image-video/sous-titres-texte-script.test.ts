/**
 * GV2-29 · Sous-titres écrits comme le script (signes isolés recollés, « œ » gardé) et clôture après la voix.
 * Rendu, voix et stockage SIMULÉS : aucun appel payant.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import type { FicheImage } from "@/domaine/image-video/fiche";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import { CLOTURE_AVANT_FIN_SEC, type BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { controlerSousTitresIV, sousTitresIV } from "@/moteurs/montage-image-video/sous-titres";

const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const carte: CarteImage = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/C.json"), "utf8"));
const base = FICHES_SIMULEES["essai-c"];
const SONDE = "Vous doutez ? Un bon PV, puis un pépin : 135 € perdus, soit 20 % du budget.";
const fiche: FicheImage = { ...base, ecrans: base.ecrans.map((e, i) => (i === 0 ? { ...e, texteDit: SONDE } : i === 1 ? { ...e, texteDit: "Le cœur du sujet." } : e)) };
const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
const voix = pisteSimulee(fiche, fin.muet ? null : fin);
const res = mettreEnSceneIV({ carte, fiche, voix, fin, reseaux: fin.reseaux, bruitagesValides: VALIDES });
const lignes = res.ligne.sousTitres.groupes.map((g) => g.mots.map((m) => m.mot).join(" "));
const tout = lignes.join(" | ");

describe("sous-titres écrits comme le script", () => {
  it("les signes isolés restent collés au mot", () => {
    for (const attendu of ["doutez ?", "pépin :", "135 €", "20 %"]) expect(tout).toContain(attendu);
  });
  it("« cœur » s'affiche « cœur »", () => {
    expect(tout).toContain("cœur");
    expect(tout).not.toContain("coeur");
  });
  it("aucun signe seul n'est un mot de sous-titre", () => {
    for (const g of res.ligne.sousTitres.groupes) for (const m of g.mots) expect(m.mot).toMatch(/[\p{L}\p{N}]/u);
  });
  it("les heures sont celles de la voix : début du groupe = début d'un mot de la voix, fin ≤ fin de la voix", () => {
    const debuts = new Set(voix.mots.map((m) => m.debutSec));
    for (const g of res.ligne.sousTitres.groupes) {
      expect(debuts.has(g.mots[0].debutSec)).toBe(true);
      expect(g.finSec).toBeLessThanOrEqual(voix.finVoixSec + 1e-6);
    }
  });
  it("aucun groupe ne déborde : la bande reste conforme (Q22)", () => {
    expect(controlerSousTitresIV(res.ligne.sousTitres, fin.reseaux)).toEqual([]);
  });
  it("signes recollés par sousTitresIV : « ? » seul sans mot avant reste seul, heures inchangées", () => {
    const mots = [
      { mot: "Vous", debutSec: 0, finSec: 0.2 }, { mot: "doutez", debutSec: 0.3, finSec: 0.6 }, { mot: "?", debutSec: 0.3, finSec: 0.6 },
      { mot: "20", debutSec: 0.7, finSec: 0.9 }, { mot: "%", debutSec: 0.7, finSec: 0.9 },
    ];
    const g = sousTitresIV(mots, { reseaux: ["tiktok"] }).groupes.flatMap((x) => x.mots);
    expect(g.map((m) => m.mot)).toEqual(["Vous", "doutez ?", "20 %"]);
    expect(g[1]).toMatchObject({ debutSec: 0.3, finSec: 0.6 });
  });
});

describe("bruitage de clôture après la voix", () => {
  it("la clôture est posée au moins 0,3 s après la fin de la voix", () => {
    const cloture = res.ligne.bruitages.find((b) => b.planId === "cloture")!;
    expect(cloture).toBeDefined();
    expect(cloture.debutSec).toBeGreaterThanOrEqual(res.ligne.finVoixSec + 0.3 - 1e-6);
    expect(cloture.debutSec).toBeGreaterThanOrEqual(res.ligne.dureeSec - CLOTURE_AVANT_FIN_SEC - 1e-6);
  });
});
