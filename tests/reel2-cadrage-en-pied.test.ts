/**
 * CORRECTEUR RÉEL 2 · B (04/10) : sur la 1re vraie vidéo, Will est filmé EN PIED (tête aux chaussures, visage petit) ;
 * les plans alternaient zoom 1 / 1,2 : presque aucun changement. Avec « Votre avatar est filmé : En pied », les
 * cadrages deviennent large ≈ mi-cuisse (×1,4), poitrine (×2,0), serré visage sur l'emphase (×2,6), centrés sur le
 * haut du corps ; « À la taille » garde les valeurs d'avant. Au-delà de ×2,6 : alerte de netteté.
 */
import { describe, expect, it } from "vitest";
import { horodaterTexte } from "@/domaine/derivations";
import { formatAvocat, RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";
import { STYLE_MONTAGE_AVOCAT } from "@/donnees/elements-avocat";
import { controlerRythme, decouperEnPlans, type EntreeDecoupage, type SegmentDecoupage } from "@/moteurs/montage-avocat/decoupage";
import { preparerTexteVoix, reporterHorodatages } from "@/moteurs/montage-avocat/report";

const S = (id: string, bloc: string, texte: string, extra: Partial<SegmentDecoupage> = {}): SegmentDecoupage => ({ id, bloc, texte, ...extra });
const SCRIPT: SegmentDecoupage[] = [
  S("a1", "accroche", "Vous perdez des heures chaque semaine dans Excel ?"),
  S("p1", "promesse", "Je vous montre comment arrêter, en trois étapes simples."),
  S("c1", "coeur", "D'abord, listez les tâches que vous refaites chaque matin.", { emphase: ["chaque matin"] }),
  S("c2", "coeur", "Ensuite, branchez vos fichiers sur un outil qui les remplit tout seul."),
  S("c3", "coeur", "Enfin, recevez une alerte sur votre téléphone quand un chiffre bouge.", { emphase: ["alerte"] }),
  S("pr1", "preuve", "Un client a gagné dix heures par mois avec ce simple réglage.", { emphase: ["dix heures"] }),
  S("ap1", "appel", "Écrivez-moi, je regarde votre fichier avec vous."),
  S("b1", "boucle", "Et vous ne perdrez plus vos heures dans Excel."),
];

function entree(o: Partial<EntreeDecoupage> = {}): EntreeDecoupage {
  const t = preparerTexteVoix(SCRIPT, []);
  return { mots: reporterHorodatages(t, horodaterTexte(t.texte, 3.4)), segments: SCRIPT, plansIndicatifs: [], recette: RECETTE_MONTAGE_AVOCAT, style: STYLE_MONTAGE_AVOCAT, repartition: { principal: 1, second: 0 }, deuxAngles: false, ouvertureSurIllustration: false, illustrations: false, levresNote: 92, personnageId: "perso-will", ...o };
}

const zooms = (plans: ReturnType<typeof decouperEnPlans>) => plans.filter((p) => p.sourceImage === "double").map((p) => p.cadrage.zoom);

describe("RÉEL 2 · B — cadrages d'un avatar filmé en pied", () => {
  it("réglage « Votre avatar est filmé » : « À la taille » par défaut, « En pied » proposé", () => {
    expect((formatAvocat.reglages.schema.parse({}) as { cadrageDouble?: string }).cadrageDouble).toBe("taille");
    const champ = formatAvocat.reglages.champs.find((c) => c.cle === "cadrageDouble");
    expect(champ && champ.type === "choix" ? champ.options.map((o) => o.valeur) : []).toEqual(["taille", "en-pied"]);
  });

  it("à la taille : valeurs d'avant (1 / 1,2), centre à 38 %", () => {
    const plans = decouperEnPlans(entree());
    expect(Math.max(...zooms(plans))).toBeLessThanOrEqual(1.22);
    expect(plans.every((p) => p.cadrage.pointInteret.y === 0.38)).toBe(true);
  });

  it("en pied : large ×1,4 (mi-cuisse), poitrine ×2,0, serré ×2,6 sur l'emphase ; alternance franche ; centré sur le haut du corps", () => {
    const plans = decouperEnPlans(entree({ sujetEnPied: true }));
    const z = zooms(plans);
    expect(new Set(z)).toEqual(new Set([1.4, 2, 2.6].filter((x) => z.includes(x))));
    expect(z).toContain(1.4);
    expect(z.some((x) => x >= 2)).toBe(true);
    expect(Math.min(...z)).toBeGreaterThanOrEqual(1.4);
    // Effet « 2 caméras » : deux plans voisins diffèrent d'au moins 25 % (avant : 15 à 20 %).
    const doubles = plans.filter((p) => p.sourceImage === "double");
    for (let i = 1; i < doubles.length; i++) {
      const a = doubles[i - 1].cadrage;
      const b = doubles[i].cadrage;
      if (a.zoom !== b.zoom) expect(Math.abs(b.zoom - (a.zoomFin ?? a.zoom)) / Math.min(a.zoom, b.zoom)).toBeGreaterThanOrEqual(0.25);
    }
    for (const p of doubles) expect(p.cadrage.pointInteret.y).toBeCloseTo(0.18);
    expect(controlerRythme(plans, { recette: RECETTE_MONTAGE_AVOCAT, style: STYLE_MONTAGE_AVOCAT, mots: entree().mots, segments: SCRIPT, ouvertureSurIllustration: false }).some((a) => /agrandi plus de 2,6/.test(a.message))).toBe(false);
  });

  it("au-delà de ×2,6 : alerte « l'image peut perdre en netteté »", () => {
    const recette = { ...RECETTE_MONTAGE_AVOCAT, cadrages: { ...RECETTE_MONTAGE_AVOCAT.cadrages, enPied: { largePct: 140, poitrinePct: 200, serrePct: 300, poitrineLevresFaiblesPct: 175, pointInteretY: 0.18 } } };
    const plans = decouperEnPlans(entree({ sujetEnPied: true, recette }));
    expect(controlerRythme(plans, { recette, style: STYLE_MONTAGE_AVOCAT, mots: entree().mots, segments: SCRIPT, ouvertureSurIllustration: false }).some((a) => /agrandi plus de 2,6/.test(a.message))).toBe(true);
  });
});
