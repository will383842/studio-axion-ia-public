/** S1.2 — chapitres web : le début de chaque bloc est retrouvé en comptant les mots dans les sous-titres horodatés. */
import { describe, expect, it } from "vitest";
import { chapitresWeb } from "@/domaine/site-videos/chapitres";
import type { BlocScript, MotHorodate } from "@/domaine/types";
import { resoudreRecette } from "@/formats/familles";
import { formatAvocat } from "@/formats/avocat";
import { formatCasConcret } from "@/formats/cas-concret";
import { formatTableauAnime } from "@/formats/tableau-anime";

/** Un bloc de `n` mots. */
function bloc(blocRecette: string, n: number, i: number): BlocScript {
  return { id: `b${i}`, blocRecette, segments: [{ id: `s${i}`, texte: Array.from({ length: n }, (_, k) => `m${i}x${k}`).join(" ") }] };
}
/** Mots horodatés : `parMot` secondes chacun, à partir de 0. */
function mots(total: number, parMot: number, debut = 0): MotHorodate[] {
  return Array.from({ length: total }, (_, i) => ({ mot: `w${i}`, debutSec: +(debut + i * parMot).toFixed(3), finSec: +(debut + (i + 1) * parMot).toFixed(3) }));
}
const blocsDe = (liste: [string, number][]) => liste.map(([b, n], i) => bloc(b, n, i));
const total = (liste: [string, number][]) => liste.reduce((a, [, n]) => a + n, 0);

describe("S1.2 chapitres web", () => {
  it("avocat 45 s : 6 blocs, « boucle » rattachée → 5 chapitres, le premier à 0", () => {
    const liste: [string, number][] = [["accroche", 10], ["promesse", 20], ["coeur", 60], ["preuve", 30], ["appel", 20], ["boucle", 10]];
    const ch = chapitresWeb({ blocs: blocsDe(liste), recette: resoudreRecette(formatAvocat), regle: formatAvocat.chapitresWeb ?? { rattaches: ["boucle"] }, mots: mots(150, 0.3), dureeSec: 45 });
    expect(ch.map((c) => c.libelle)).toEqual(["Accroche", "Promesse", "Cœur", "Preuve", "Appel"]);
    expect(ch[0].debutSec).toBe(0);
    expect(ch.map((c) => c.debutSec)).toEqual([0, 3, 9, 27, 36]);
    // Le dernier chapitre (avec « boucle » rattachée) finit à la durée ; chaque fin = début du suivant.
    expect(ch[4].finSec).toBe(45);
    expect(ch[0].finSec).toBe(3);
    expect(ch.map((c) => c.blocRecette)).toEqual(["accroche", "promesse", "coeur", "preuve", "appel"]);
  });

  it("cas concret 3 étapes : « Étape 1/2/3 », un bloc non répétable n'est jamais numéroté", () => {
    const liste: [string, number][] = [["accroche", 10], ["etape", 20], ["etape", 20], ["etape", 20], ["resultat", 10], ["question", 10]];
    const ch = chapitresWeb({ blocs: blocsDe(liste), recette: resoudreRecette(formatCasConcret), regle: formatCasConcret.chapitresWeb ?? {}, mots: mots(90, 0.5), dureeSec: 45 });
    expect(ch.map((c) => c.libelle)).toEqual(["Accroche", "Étape 1", "Étape 2", "Étape 3", "Résultat", "Question"]);
  });

  it("tableau 2 gestes : « Écran 1 », « Écran 2 »", () => {
    const liste: [string, number][] = [["accroche", 10], ["geste", 20], ["geste", 20], ["preuve", 10], ["resultat", 10]];
    const ch = chapitresWeb({ blocs: blocsDe(liste), recette: resoudreRecette(formatTableauAnime), regle: { libelles: { geste: "Écran" } }, mots: mots(70, 0.6), dureeSec: 42 });
    expect(ch.map((c) => c.libelle)).toEqual(["Accroche", "Écran 1", "Écran 2", "Preuve", "Résultat"]);
  });

  it("vidéo de 25 s → aucun chapitre", () => {
    const liste: [string, number][] = [["accroche", 10], ["promesse", 20], ["coeur", 60]];
    expect(chapitresWeb({ blocs: blocsDe(liste), recette: resoudreRecette(formatAvocat), regle: {}, mots: mots(90, 0.28), dureeSec: 25 })).toEqual([]);
  });

  it("deux blocs à 0,4 s d'écart → le second est fusionné dans le premier", () => {
    const liste: [string, number][] = [["accroche", 2], ["promesse", 20], ["coeur", 60], ["preuve", 30]];
    const ch = chapitresWeb({ blocs: blocsDe(liste), recette: resoudreRecette(formatAvocat), regle: {}, mots: mots(112, 0.4), dureeSec: 45 });
    // « accroche » 2 mots = 0,8 s ; « promesse » commence à 0,8 s : écart < 1 s → fusionnés.
    expect(ch.map((c) => c.libelle)).toEqual(["Accroche", "Cœur", "Preuve"]);
    expect(ch[0].finSec).toBe(ch[1].debutSec);
  });

  it("sous-titres absents → répartition au prorata des mots sur la durée", () => {
    const liste: [string, number][] = [["accroche", 10], ["promesse", 10], ["coeur", 20], ["preuve", 10]];
    const ch = chapitresWeb({ blocs: blocsDe(liste), recette: resoudreRecette(formatAvocat), regle: {}, mots: [], dureeSec: 50 });
    expect(ch.map((c) => c.debutSec)).toEqual([0, 10, 20, 40]);
    expect(ch[3].finSec).toBe(50);
  });

  it("sous-titres plus courts que le texte → prorata aussi", () => {
    const liste: [string, number][] = [["accroche", 10], ["promesse", 10], ["coeur", 20], ["preuve", 10]];
    const ch = chapitresWeb({ blocs: blocsDe(liste), recette: resoudreRecette(formatAvocat), regle: {}, mots: mots(5, 1), dureeSec: 50 });
    expect(ch.map((c) => c.debutSec)).toEqual([0, 10, 20, 40]);
  });

  it("un seul bloc → aucun chapitre", () => {
    expect(chapitresWeb({ blocs: blocsDe([["coeur", 80]]), recette: resoudreRecette(formatAvocat), regle: {}, mots: mots(80, 0.5), dureeSec: 40 })).toEqual([]);
  });

  it("deux chapitres n'ont jamais le même début, les débuts croissent", () => {
    const liste: [string, number][] = [["accroche", 10], ["promesse", 10], ["coeur", 40], ["preuve", 10], ["appel", 10]];
    const ch = chapitresWeb({ blocs: blocsDe(liste), recette: resoudreRecette(formatAvocat), regle: {}, mots: mots(80, 0.5), dureeSec: 40 });
    for (let i = 1; i < ch.length; i++) expect(ch[i].debutSec).toBeGreaterThan(ch[i - 1].debutSec);
    expect(total(liste)).toBe(80);
  });
});
