/** Lot B2a, 6e passe : repères de constats selon leur nombre, exemple du découpage fidèle au témoin, tranches et plafonds. */
import { describe, expect, it } from "vitest";
import { BORNES_PASSAGES, MOTS_SCRIPT, repereConstats, compterMots, ACCROCHE_MAX_SEC, controlerAccroche } from "@/domaine/scripts-tableau-controles";
type DureeScript = 60 | 30;
import { CONSIGNE_DECOUPAGE } from "@/moteurs/montage-tableau/decoupage";
import { REGLES_TABLEAU, SCRIPT_TEMOIN } from "@/services/tableau-scripts/consignes";
import { caracteresDits } from "@/domaine/duree-tableau";
import { EXEMPLES_V5 } from "./exemples-v5";

const ditsDe = (script: any): string[] => Object.values(script).flatMap((v: any) => (Array.isArray(v) ? v.flatMap((x: any) => (x?.dit ? [x.dit] : [x.action?.dit, ...(x.comment ?? []).map((c: any) => c.dit)])) : []));
const milieu = (r: readonly [number, number]) => (r[0] + r[1]) / 2;
const PASSAGES = ["accroche", "douleur", "promesse", "exemple", "fin"] as const;

describe("repère de mots d'un constat selon leur nombre", () => {
  for (const d of [60, 30] as DureeScript[]) {
    for (const n of [2, 3]) {
      it(`${d} s, ${n} constats : la somme des milieux tombe dans la borne du script`, () => {
        const somme = PASSAGES.reduce((t, k) => t + milieu(BORNES_PASSAGES[d][k].repere), 0) + n * milieu(repereConstats(d, n));
        expect(somme).toBeGreaterThanOrEqual(MOTS_SCRIPT[d].min);
        expect(somme).toBeLessThanOrEqual(MOTS_SCRIPT[d].max);
      });
    }
  }
  const hautPassages = PASSAGES.reduce((t, k) => t + BORNES_PASSAGES[60][k].repere[1], 0);
  it("60 s, 2 constats : passages au haut et constats au milieu, avec marge", () => {
    const somme = hautPassages + 2 * milieu(repereConstats(60, 2));
    expect(somme).toBeGreaterThanOrEqual(MOTS_SCRIPT[60].min + 5);
    expect(somme).toBeLessThanOrEqual(MOTS_SCRIPT[60].max - 5);
  });
  it("60 s, 2 constats : constats au bas de leur repère, passages au haut : au moins le plancher", () => {
    expect(hautPassages + 2 * repereConstats(60, 2)[0]).toBeGreaterThanOrEqual(MOTS_SCRIPT[60].min);
  });
  it("60 s, 2 constats : le repère ne dépasse pas 22 mots (au-delà, la scène est coupée)", () => {
    expect(repereConstats(60, 2)[1]).toBeLessThanOrEqual(22);
  });
  it("la consigne dit de viser le haut des repères avec 2 constats", () => {
    expect(REGLES_TABLEAU).toMatch(/avec 2 constats[^.]*haut des repères de CHAQUE passage/);
    expect(REGLES_TABLEAU).toContain("125 mots au moins");
  });
});

describe("l'exemple de la consigne du découpage suit le témoin v5", () => {
  const temoin = (EXEMPLES_V5[0]!.ecriture.script as any);
  const texteTemoin = [SCRIPT_TEMOIN, ...ditsDe(temoin), ...temoin.exemple.phrases.map((x: any) => x.dit)].join(" ");
  const exemple = CONSIGNE_DECOUPAGE.slice(CONSIGNE_DECOUPAGE.lastIndexOf("EXEMPLE (forme exacte"), CONSIGNE_DECOUPAGE.lastIndexOf("À ne pas faire"));
  const lignes = exemple.split("\n").filter((l) => /^\{"id":"s\d\d","role":"(accroche|douleur|etape|resultat|fin)","page":\d+,"texteDit":"[^"]*","gabarit":\{"role":"(accroche|douleur|solution|retenir|appel)"/.test(l));
  it("l'exemple contient les scènes du témoin", () => expect(lignes.length).toBeGreaterThanOrEqual(6));
  for (const l of lignes) {
    const o = JSON.parse(l);
    for (const phrase of String(o.texteDit).split(/(?<=[.?!])\s+/)) {
      it(`${o.id} : « ${phrase} » est dite dans le témoin`, () => expect(texteTemoin).toContain(phrase));
    }
  }
});

const temoinScript = EXEMPLES_V5[0]!.ecriture.script as any;
describe("tranches de temps et plafonds", () => {
  it("douleur ≈ 3,5-12 s, promesse ≈ 12-17 s dans la consigne", () => {
    expect(REGLES_TABLEAU).toContain("DOULEUR (3,5 à 12 s");
    expect(REGLES_TABLEAU).toContain("PROMESSE ET BOUCLE OUVERTE (12 à 17 s");
    expect(REGLES_TABLEAU).not.toContain("DOULEUR (3 à 10 s");
  });
  it("plafonds durs élargis : fin 27, exemple 14-33", () => {
    expect(BORNES_PASSAGES[60].fin.refus).toEqual([9, 27]);
    expect(BORNES_PASSAGES[60].exemple.refus).toEqual([14, 33]);
  });
  it("la consigne n'appelle plus la durée « voix réelle »", () => {
    expect(REGLES_TABLEAU).not.toContain("voix réelle");
    expect(REGLES_TABLEAU).toContain("cible de la voix (à mesurer");
  });
  it("le témoin v5 fait 896 caractères dits (exemples-v5)", () => {
    const dits = [...ditsDe(temoinScript), ...temoinScript.exemple.phrases.map((x: any) => x.dit)];
    expect(caracteresDits(dits.join(" "))).toBe(896);
  });
  it("l'accroche trop longue s'écrit avec la virgule française", () => {
    const longue = { accroche: [{ dit: "Un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze.", ecran: "Un mot" }], douleur: [], promesse: [], etapes: [], exemple: { phrases: [] }, aRetenir: [], appel: [] } as any;
    const msg = controlerAccroche(longue).map((x) => x.message).join(" ");
    expect(msg).toContain("4,4 s");
    expect(msg).not.toMatch(/\d\.\d s/);
    expect(ACCROCHE_MAX_SEC).toBe(4.4);
    expect(compterMots("a b")).toBe(2);
  });
});
