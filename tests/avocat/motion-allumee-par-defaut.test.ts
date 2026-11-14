/**
 * GV2-51 — motion commune de l'avocat allumée par défaut : avec la commande produite SANS réglage, les dix scripts de
 * contrôle gardent une pose prudente. Dépôts simulés, aucun appel réel.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { reinitialiserDepots } from "@/donnees/memoire";
import { entreesAvocatDuLancement } from "@/services/avocat-branchements";
import { optionMotionAvocat, poserMotionAvocat, type SegmentMotionAvocat } from "@/moteurs/montage-avocat/motion";
import type { PlanProduit } from "@/moteurs/types";
import type { MotHorodate } from "@/domaine/types";
import { familleUnite } from "@/briques/motion/choix";
import { DIX_SCRIPTS } from "../briques/faits-script/dix-scripts";

const PAS = 0.35;

/** Un segment par phrase ; les plans suivent les phrases, les mots un par 0,35 s. */
function fabriquer(script: string) {
  const phrases = script.split(/(?<=[.!?])\s+/).filter((p) => p.trim());
  const mots: MotHorodate[] = [];
  const segments: SegmentMotionAvocat[] = [];
  const plans: PlanProduit[] = [];
  let t = 0;
  phrases.forEach((texte, i) => {
    const debutSec = t;
    for (const m of texte.split(/\s+/)) {
      mots.push({ mot: m, debutSec: t, finSec: t + PAS });
      t += PAS;
    }
    const id = `s${i}`;
    // Alternance : titre à l'écran, illustration, mots en valeur (les trois places où une carte est permise).
    const genre = i % 3;
    segments.push({
      id,
      texte,
      ...(genre === 0 ? { titreEcran: texte.split(/\s+/).slice(0, 4).join(" ") } : {}),
      ...(genre === 1 ? { intentionIllustration: "illustration" } : {}),
      ...(genre === 2 ? { emphase: [texte.split(/\s+/)[0]] } : {}),
    });
    plans.push({
      ordre: i,
      debutSec,
      finSec: t,
      texte,
      segmentId: id,
      sourceImage: genre === 1 ? "illustration" : "double",
      motsEnValeur: [],
      cadrage: {},
      transition: "coupe",
    } as unknown as PlanProduit);
  });
  return { mots, segments, plans, dureeSec: t };
}

beforeEach(() => reinitialiserDepots());

describe("motion avocat allumée par défaut : dix scripts", () => {
  it("la commande produite sans réglage porte l'option allumée", async () => {
    const sortie = await entreesAvocatDuLancement({ entrees: {} } as never);
    expect(optionMotionAvocat({ entrees: sortie })).toMatchObject({ actif: true });
  });

  DIX_SCRIPTS.forEach((script, n) => {
    it(`script ${n + 1} : au plus une carte par 12 s, aucune avant 1,5 s, pas d'avant/après mélangé, pas de sur-titre « Pas »`, async () => {
      const sortie = await entreesAvocatDuLancement({ entrees: {} } as never);
      const option = optionMotionAvocat({ entrees: sortie });
      expect(option).not.toBeNull();
      const { mots, segments, plans, dureeSec } = fabriquer(script);
      const { cartes } = poserMotionAvocat({ ratios: ["9:16"], intensite: undefined } as never, option!, plans, segments, mots, dureeSec);
      expect(cartes.length).toBeLessThanOrEqual(Math.max(1, Math.floor(dureeSec / 12)));
      for (const k of cartes) {
        expect(k.debutSec).toBeGreaterThanOrEqual(1.5);
        const d = k.carte.donnees as { surTitre?: string; avant?: { unite?: string }; apres?: { unite?: string } };
        if (k.modele === "avant-apres") expect(familleUnite(d.avant?.unite ?? "")).toBe(familleUnite(d.apres?.unite ?? ""));
        expect((d.surTitre ?? "").trim()).not.toBe("Pas");
      }
      console.info(`[GV2-51] script ${n + 1} : ${cartes.length} carte(s) ${JSON.stringify(cartes.map((k) => k.modele))}`);
    });
  });
});
