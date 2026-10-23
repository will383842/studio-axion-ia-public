/**
 * L7 · socle des animations d'objets : le numéro tiré (`animObjet`, hasard à part, jamais sur la v4), son passage à
 * l'objet (`anim` du contexte), et la v4 EXACTE des 15 objets sans numéro (ou n° 0) : empreintes calculées sur
 * origin/master (f49a855) avant toute modification.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ProprietesEcran } from "@/briques/ecrans-motion";
import { animObjetDe, ANIMS_OBJET, jeuDeLEcran, mettre, schemaMise, TIRAGE_V4 } from "@/moteurs/montage-cas-concret/variete";
import { exempleEcran } from "../../../studio-rendu/compositions/cas-concret/exemples";
import { animDe, styleMouvement, bouger } from "../../../studio-rendu/compositions/cas-concret/plans/anim-objets";
import { planEtape } from "../../../studio-rendu/compositions/cas-concret/plans/Etape";
import { planObjet } from "../../../studio-rendu/compositions/cas-concret/plans/Objet";
import { ECRANS_L3C, serieL3c } from "./outils-l3c";
import { IMAGES_L7, OBJETS_L7, planL7 } from "./outils-l7";

const empreinte = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 16);

describe("L7 · le numéro tiré (variete.ts)", () => {
  it("posé seulement sur les écrans etape / objet, hors v4, valeurs 1 ou 2, déterministe, schéma valide", () => {
    const vus = new Set<number | undefined>();
    for (const f of serieL3c(60)) {
      const m = mettre(f.tirage, ECRANS_L3C);
      expect(schemaMise.safeParse(m).success).toBe(true);
      for (const e of ECRANS_L3C) {
        const a = m.ecrans[e.id]!.animObjet;
        if (e.type !== "etape" && e.type !== "objet") expect(a).toBeUndefined();
        else vus.add(a);
        expect(a).toBe(animObjetDe(f.tirage, e).animObjet);
        if (a !== undefined) expect(jeuDeLEcran(m, e.id)?.animObjet).toBe(a);
      }
    }
    expect([...vus].sort()).toEqual([1, 2, undefined]);
    expect(ANIMS_OBJET).toBe(3);
    const v4 = mettre(TIRAGE_V4, ECRANS_L3C);
    for (const e of ECRANS_L3C) expect(v4.ecrans[e.id]!.animObjet).toBeUndefined();
    expect(schemaMise.safeParse({ ...v4, ecrans: { e04: { ...v4.ecrans.e04!, animObjet: 3 } } }).success).toBe(false);
  });

  it("animDe : absent, 0, illisible → 0 ; n modulo 3", () => {
    expect([undefined, 0, -1, 1.5, "1", null, 3, 1, 2, 4].map((anim) => animDe({ anim }))).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 2, 1]);
    expect(styleMouvement(undefined, { opacity: 0.5, transform: "scale(2)" })).toEqual({ opacity: 0.5, transform: "scale(2)" });
    expect(styleMouvement(undefined)).toEqual({});
    expect(styleMouvement(bouger({ opacite: 0.5, dx: 3 }), { opacity: 0.5, transform: "scale(2)" })).toEqual({ opacity: 0.25, transform: "translate(3px, 0px) rotate(0deg) scale(1, 1) scale(2)" });
  });
});

describe("L7 · passage à l'objet (contexte)", () => {
  it("sans jeu : contexte sans `anim` ; avec `animObjet` : `anim`, et rien d'autre ne change", () => {
    const etape = exempleEcran("etape") as Extract<ProprietesEcran, { type: "etape" }>;
    const objet = exempleEcran("objet") as Extract<ProprietesEcran, { type: "objet" }>;
    for (const i of [0, 10, 40, 74]) {
      expect("anim" in planEtape(etape, i).visuel.contexte).toBe(false);
      expect("anim" in planObjet({ ...objet, jeu: { fondFort: true } }, i).visuel.contexte).toBe(false);
      const a = planEtape({ ...etape, jeu: { animObjet: 2 } }, i);
      expect(a.visuel.contexte.anim).toBe(2);
      const { anim: _a, ...reste } = a.visuel.contexte;
      void _a;
      expect({ ...a, visuel: { ...a.visuel, contexte: reste } }).toEqual(planEtape(etape, i));
      expect(planObjet({ ...objet, jeu: { animObjet: 1 } }, i).visuel.contexte.anim).toBe(1);
    }
  });
});

describe("L7 · sans numéro (ou n° 0) : la v4 exacte des 15 objets", () => {
  const EPINGLEES = JSON.parse(readFileSync(join(__dirname, "objets-v4.json"), "utf8")) as Record<string, string>;
  it("15 objets × 2 fonds × 11 images : empreintes d'origin/master ; anim 0, 3, −1, 1.5 : idem", () => {
    let n = 0;
    for (const o of OBJETS_L7) {
      for (const fond of ["sombre", "ivoire"] as const) {
        for (const i of IMAGES_L7) {
          const cle = `${o}/${fond}/${i}`;
          expect(empreinte(planL7(o, i, fond)), cle).toBe(EPINGLEES[cle]);
          for (const anim of [0, 3, -1, 1.5]) expect(empreinte(planL7(o, i, fond, anim)), `${cle} anim ${anim}`).toBe(EPINGLEES[cle]);
          n++;
        }
      }
    }
    expect(n).toBe(Object.keys(EPINGLEES).length);
  });
});
