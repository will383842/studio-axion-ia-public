/**
 * Alerte NOMMÉE À LA FIN de sa phrase (« … puis cela. Alerte Telegram. ») : la notification tombe au plus tard 2,2 s
 * après le début de l'écran et des tampons « Reçu » coupent l'attente jusqu'au message ; aucun trou de plus de 2,5 s
 * tant que la voix parle (3 à 40 s par pas de 0,1 s), Q14 ne refuse rien.
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

/** Fiche dont l'écran d'alerte dure `voixSec` de voix et nomme « Alerte Telegram » en toute fin de phrase (ou au milieu). */
function fiche(voixSec: number, ou: "fin" | "milieu" = "fin"): FicheImage {
  const f = structuredClone(FICHES_SIMULEES["essai-c"]);
  const par = (id: string) => f.ecrans.find((e) => e.id === id)!;
  Object.assign(par("e11"), { scene: "email", refs: ["n07", "l06"] });
  Object.assign(par("e12"), { scene: "toile", refs: [] });
  Object.assign(par("e13"), { scene: "alerte", refs: ["n08", "n09", "l08"], surMot: [] });
  const mots = Math.max(8, Math.round(voixSec * DEBIT_MOTS_PAR_SEC)) - 2;
  const corps = Array.from({ length: mots }, (_, i) => (i % 7 === 6 ? `${["suite", "cela", "tout"][Math.floor(i / 7) % 3]}.` : ["puis", "ensuite", "alors"][i % 3]));
  corps[mots - 1] = "cela.";
  const m = Math.floor(mots / 2);
  par("e13").texteDit = ou === "fin" ? `${corps.join(" ")} Alerte Telegram.` : `${corps.slice(0, m).join(" ")} Alerte Telegram. ${corps.slice(m).join(" ")}`;
  for (const e of f.ecrans) e.surMot = e.surMot.filter((s) => !s.ref || e.refs.includes(s.ref));
  return f;
}

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

describe("alerte nommée en fin de phrase : le rythme tient pour toute durée de voix", () => {
  it.each(["fin", "milieu"] as const)("nommée %s, voix de 3 à 40 s par pas de 0,1 s : aucun trou de plus de 2,5 s, Q14 ne refuse rien, rien de compté sans dessin", (ou) => {
    const echecs: string[] = [];
    for (let i = 0; i <= 370; i++) {
      const voix = 3 + i / 10;
      const r = mettre(carteChatbot(), fiche(voix, ou));
      const trou = plusLongTrouDans(r, "e13");
      if (trou > FIGE_SOUS_VOIX) echecs.push(`${voix.toFixed(1)} s : trou de ${trou} s`);
      for (const p of q14(r)) echecs.push(`${voix.toFixed(1)} s : Q14 refuse « ${p} »`);
      for (const m of comptesNonDessines(r, carteChatbot())) echecs.push(`${voix.toFixed(1)} s : ${m}`);
    }
    expect(echecs).toEqual([]);
  });

  it("nommée au milieu, 31,5 à 31,8 s de voix : le message de la notification coupe un plan trop long (deux plans de 4,36 s refusés par Q14 sinon)", () => {
    const refus = [31.5, 31.6, 31.7, 31.8].flatMap((v) => q14(mettre(carteChatbot(), fiche(v, "milieu"))).map((p) => `${v} s : ${p}`));
    expect(refus).toEqual([]);
  });

  it("avant/après : plus long trou pour 5, 10 et 39 s de voix", () => {
    const trous = [5.1, 10, 39.4].map((v) => plusLongTrouDans(mettre(carteChatbot(), fiche(v)), "e13"));
    expect(Math.max(...trous)).toBeLessThanOrEqual(FIGE_SOUS_VOIX);
  });
});
