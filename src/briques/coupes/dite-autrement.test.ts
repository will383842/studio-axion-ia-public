import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { horodaterMotsPrononces } from "@/briques/calage/report";
import { calculerCoupes, controlerCoupes, corrigerLexique, motsDuMontage, texteDesSousTitres } from "./index";

/** Pose les mots d'une phrase régulièrement dans [debut, fin] (le dernier mot finit à `fin`). */
function dire(phrase: string, debut: number, fin: number): MotHorodate[] {
  const mots = phrase.split(/\s+/).filter(Boolean);
  const pas = (fin - debut) / mots.length;
  return mots.map((mot, i) => ({ mot, debutSec: +(debut + i * pas).toFixed(3), finSec: +(i === mots.length - 1 ? fin : debut + (i + 1) * pas - pas * 0.15).toFixed(3) }));
}

const TEXTE = [
  "Bonjour, je suis Will, fondateur d'Axion-IA.",
  "Vous voulez que l'intelligence artificielle vous fasse enfin avancer ?",
  "Une formation pour vos équipes, avec des aides autant que possible grâce à Certifexemple, en vous orientant vers les bonnes.",
  "Ou peut-être un accompagnement one-to-one pour vos dirigeants.",
  "Appelez-nous dès aujourd'hui.",
];

/**
 * Montage v4 d'IMG_7747 (10/10, master fde7a39) reconstitué : la phrase 3 est dite AUTREMENT de 82,4 à 87,9 s
 * (« aides OPCO possibles, IA Calliopi »), aucune coupe ne la retire.
 */
function prise(diteAutrement = true): { mots: MotHorodate[]; texte: string; duree: number } {
  const mots: MotHorodate[] = [
    ...dire(TEXTE[0], 70, 73.5),
    ...dire(TEXTE[1], 74, 81.8),
    ...(diteAutrement ? dire("Une formation pour vos équipes, avec des aides OPCO possibles, IA Calliopi, en vous orientant vers les bonnes.", 82.4, 87.9) : []),
    ...dire("Ou peut-être un accompagnement one to one pour vos dirigeants.", 88.2, 92.6),
    ...dire(TEXTE[4], 93, 95),
  ];
  return { mots, texte: TEXTE.join(" "), duree: 96 };
}

describe("passage dit autrement (IMG_7747, 10/10)", () => {
  const { mots, texte, duree } = prise();
  const plan = calculerCoupes({ mots, dureeSec: duree, texteValide: texte });

  it("la phrase dite autrement n'est plus « manquante » : état « dite autrement », passage gardé tel quel", () => {
    expect(plan.mode).toBe("texte");
    const p = plan.phrases[2];
    expect(p.debutSec).toBeUndefined();
    expect(p.diteAutrement).toMatchObject({ debutSec: 82.4, finSec: 87.9 });
    expect(p.diteAutrement!.recouvrement).toBeGreaterThanOrEqual(0.5);
    const ctrl = controlerCoupes(plan, mots);
    expect(ctrl.phrasesManquantes).toEqual([]);
    expect(ctrl.phrasesDitesAutrement).toEqual([2]);
    // Les coupes ne touchent pas le passage (aucune reprise, aucun début ou fin jeté dedans).
    expect(plan.coupes.filter((c) => c.type !== "silence" && c.finSec > 82.4 && c.debutSec < 87.9)).toEqual([]);
  });

  it("une phrase vraiment absente reste signalée", () => {
    const sans = prise(false);
    const p = calculerCoupes({ mots: sans.mots, dureeSec: sans.duree, texteValide: sans.texte });
    expect(p.phrases[2].diteAutrement).toBeUndefined();
    const ctrl = controlerCoupes(p, sans.mots);
    expect(ctrl.phrasesManquantes).toEqual([2]);
    expect(ctrl.phrasesDitesAutrement).toEqual([]);
  });

  it("sous-titres : les mots DITS sur le passage, lexique de marque, ponctuation propre", () => {
    const t = texteDesSousTitres(plan.phrases);
    expect(t).toContain("Une formation pour vos équipes, avec des aides OPCO possibles, IA Certifexemple, en vous orientant vers les bonnes. Ou peut-être");
    expect(t).not.toMatch(/Calliopi|autant que possible/);
  });

  it("sous-titres sans trou et jamais hors de la parole ; « Ou » calé sur son vrai instant", () => {
    const montes = motsDuMontage(mots, plan.gardes);
    const sous = horodaterMotsPrononces(texteDesSousTitres(plan.phrases).split(/\s+/).filter(Boolean), montes);
    const avancer = sous.findIndex((m) => m.mot === "?");
    const ou = sous.findIndex((m) => m.mot === "Ou");
    expect(ou - avancer - 1).toBeGreaterThanOrEqual(16);
    const vraiOu = montes.find((m) => m.mot === "Ou")!;
    expect(sous[ou].debutSec).toBeCloseTo(vraiOu.debutSec, 2);
    for (const s of sous) expect(montes.some((m) => s.debutSec < m.finSec + 1e-3 && s.finSec > m.debutSec - 1e-3)).toBe(true);
  });
});

describe("lexique de marque", () => {
  it("corrige les mots connus mal entendus, en gardant la ponctuation", () => {
    expect(corrigerLexique(["grâce", "à", "Calliopi,", "Kaliopi", "Certifexemplee.", "opco", "Axion", "IA", "one", "to", "one."])).toEqual(["grâce", "à", "Certifexemple,", "Certifexemple", "Certifexemple.", "OPCO", "Axion-IA", "one-to-one."]);
    expect(corrigerLexique(["une", "IA", "utile"])).toEqual(["une", "IA", "utile"]);
  });
});

describe("fiche : « dite autrement » affiché sobrement, pas comme une alerte", () => {
  it("information seule, aucune alerte « absente »", async () => {
    const { alertesControles } = await import("@/moteurs/montage-facecam/chaine");
    const { mots, texte, duree } = prise();
    const plan = calculerCoupes({ mots, dureeSec: duree, texteValide: texte });
    const ctrl = controlerCoupes(plan, mots);
    const coupes = { mode: "texte" as const, texteNonRetrouve: false, liste: plan.coupes, gardes: plan.gardes, consignes: [], dureeSourceSec: duree, dureeSortieSec: plan.dureeSortieSec, resume: "", phrasesManquantes: ctrl.phrasesManquantes, phrasesDitesAutrement: ctrl.phrasesDitesAutrement };
    const alertes = alertesControles(undefined, undefined, coupes, 0);
    expect(alertes.some((a) => /absente/.test(a.message))).toBe(false);
    expect(alertes.find((a) => /dite\(s\) autrement/.test(a.message))?.gravite).toBe("info");
  });
});
