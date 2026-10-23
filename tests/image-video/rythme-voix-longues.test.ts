/**
 * Rythme des écrans « email » et « alerte » à voix LONGUE, tenu par construction (relecture de #341) : quelle que soit
 * la durée de la voix (3 à 40 s), jamais plus de 2,5 s sans changement visible tant que la voix parle, et la règle Q14
 * (2,4 s) ne refuse rien.
 */
import { describe, expect, it, vi } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import type { FicheImage } from "@/domaine/image-video/fiche";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { DEBIT_MOTS_PAR_SEC } from "@/domaine/image-video/complexite";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { instantsVisibles } from "@/moteurs/montage-image-video/controles-scene";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { BRUITAGES_V4_IV } from "@/moteurs/montage-image-video/fabrication";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type ResultatMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { comptesNonDessines } from "./dessin-du-plan";
import { carteFixe } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 240_000 });

/** Écart permis tant que la voix parle (décision de Will du 17/10 : image figée jusqu'à 2,5 s sous la voix). */
const FIGE_SOUS_VOIX = 2.5;

function mettre(carte: CarteImage, fiche: FicheImage): ResultatMiseEnSceneIV {
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts" as never))!;
  return mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: BRUITAGES_V4_IV });
}

function carteChatbot(): CarteImage {
  const c = carteFixe("C");
  delete c.noeuds.find((n) => n.id === "n07")!.sousElements;
  return c;
}

/** Fiche du chatbot dont l'écran `cible` (e-mail ou alerte) dure `voixSec` de voix. */
function fiche(cible: "email" | "alerte", voixSec: number): FicheImage {
  const f = structuredClone(FICHES_SIMULEES["essai-c"]);
  const par = (id: string) => f.ecrans.find((e) => e.id === id)!;
  Object.assign(par("e11"), { scene: "email", refs: ["n07", "l06"] });
  Object.assign(par("e12"), { scene: "toile", refs: [] });
  Object.assign(par("e13"), { scene: "alerte", refs: ["n08", "n09", "l08"], surMot: [] });
  const mots = Math.max(6, Math.round(voixSec * DEBIT_MOTS_PAR_SEC));
  // Des phrases de sept mots, comme une voix réelle (l'écran peut écrire les mots dits en en-tête de relance).
  const texte = Array.from({ length: mots }, (_, i) => (i % 7 === 6 || i === mots - 1 ? `${["suite", "cela", "tout"][Math.floor(i / 7) % 3]}.` : ["puis", "ensuite", "alors"][i % 3])).join(" ");
  par(cible === "email" ? "e11" : "e13").texteDit = texte;
  for (const e of f.ecrans) e.surMot = e.surMot.filter((s) => !s.ref || e.refs.includes(s.ref));
  return f;
}

/** Plus long temps sans changement compté DANS un écran, tant que sa voix parle. */
function plusLongTrouDans(r: ResultatMiseEnSceneIV, ecran: string): number {
  const plans = r.ligne.plans.filter((p) => p.ecran === ecran);
  const debut = Math.min(...plans.map((p) => p.debut));
  const fin = Math.min(Math.max(...plans.map((p) => p.fin)), r.ligne.finVoixSec);
  const pts = [0, ...instantsVisibles(r.ligne.evenements, r.ligne.finVoixSec).filter((t) => t > 0), r.ligne.finVoixSec];
  let pire = 0;
  for (let k = 1; k < pts.length; k++) pire = Math.max(pire, Math.min(fin, pts[k]) - Math.max(debut, pts[k - 1]));
  return Math.round(pire * 1000) / 1000;
}

const q14 = (r: ResultatMiseEnSceneIV) => r.rapport.lignes.filter((l) => l.code === "Q14" && l.bloquant && !l.ok).map((l) => l.phrase);

describe("voix longues : le rythme des écrans e-mail et alerte tient par construction", () => {
  for (const [ecran, sorte] of [["e11", "email"], ["e13", "alerte"]] as const) {
    it(`${sorte} : voix de 3 à 40 s par pas de 0,7 s, aucun trou de plus de 2,5 s, Q14 ne refuse rien, rien de compté sans dessin`, () => {
      const echecs: string[] = [];
      for (let voix = 3; voix <= 40 + 1e-9; voix += 0.7) {
        const r = mettre(carteChatbot(), fiche(sorte, voix));
        const trou = plusLongTrouDans(r, ecran);
        if (trou > FIGE_SOUS_VOIX) echecs.push(`${voix.toFixed(1)} s de voix : trou de ${trou} s`);
        for (const p of q14(r)) echecs.push(`${voix.toFixed(1)} s de voix : Q14 refuse « ${p} »`);
        for (const m of comptesNonDessines(r, carteChatbot())) echecs.push(`${voix.toFixed(1)} s de voix : ${m}`);
      }
      expect(echecs).toEqual([]);
    });
  }

  it("alerte, voix de 38,8 à 39 s : un tampon posé tôt sur son mot ne laisse pas la part suivante dépasser 2,4 s (Q14)", () => {
    const echecs: string[] = [];
    for (const voix of [38.8, 38.9, 39]) {
      const r = mettre(carteChatbot(), fiche("alerte", voix));
      const trou = plusLongTrouDans(r, "e13");
      if (trou > 2.4) echecs.push(`${voix} s de voix : trou de ${trou} s`);
      for (const p of q14(r)) echecs.push(`${voix} s de voix : Q14 refuse « ${p} »`);
    }
    expect(echecs).toEqual([]);
  });

  it("avant/après : plus long trou pour 8, 13 et 18 s de voix (e-mail)", () => {
    const trous = [8, 13, 18].map((v) => plusLongTrouDans(mettre(carteChatbot(), fiche("email", v)), "e11"));
    expect(Math.max(...trous)).toBeLessThanOrEqual(2.4);
  });
});
