/**
 * GV2-14 : les sous-titres disent TOUT ce qui est gardé dans le son (phrase improvisée entre deux phrases du texte,
 * suite de phrases dites autrement) et suivent les coupes demandées après coup.
 */
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { calculerCoupes, controlerCoupes, gardesApres, texteSousTitresGardes } from "./index";

/** Pose les mots d'une phrase régulièrement dans [debut, fin]. */
function dire(phrase: string, debut: number, fin: number): MotHorodate[] {
  const mots = phrase.split(/\s+/).filter(Boolean);
  const pas = (fin - debut) / mots.length;
  return mots.map((mot, i) => ({ mot, debutSec: +(debut + i * pas).toFixed(3), finSec: +(i === mots.length - 1 ? fin : debut + (i + 1) * pas - pas * 0.15).toFixed(3) }));
}

const TEXTE = ["Bonjour, je suis Will, fondateur d'Axion-IA.", "Vous voulez que l'intelligence artificielle vous fasse enfin avancer ?", "Une formation pour vos équipes en deux minutes.", "Appelez-nous dès aujourd'hui."];
const IMPROVISEE = "Et franchement personne ne vous le dit jamais.";
const mots = (...morceaux: MotHorodate[][]) => morceaux.flat();
const mots_ = (s: string) => s.replace(/[.,?!]/g, "").toLowerCase().split(/\s+/).filter(Boolean);

describe("texteSousTitresGardes", () => {
  // S1a : une phrase improvisée entre deux phrases du texte.
  const prise = mots(dire(TEXTE[0], 1, 4), dire(TEXTE[1], 4.5, 9), dire(IMPROVISEE, 9.5, 12.2), dire(TEXTE[2], 12.7, 16), dire(TEXTE[3], 16.5, 18.5));
  const plan = calculerCoupes({ mots: prise, dureeSec: 20, texteValide: TEXTE.join(" ") });

  it("S1a : chaque mot gardé figure dans le texte ; les mots du script gardent leur orthographe", () => {
    const t = texteSousTitresGardes(plan, prise);
    for (const m of mots_(IMPROVISEE)) expect(mots_(t)).toContain(m);
    expect(t).toContain("Bonjour, je suis Will, fondateur d'Axion-IA.");
    expect(t).toContain("Appelez-nous dès aujourd'hui.");
    expect(t.indexOf("personne")).toBeGreaterThan(t.indexOf("avancer"));
    expect(t.indexOf("personne")).toBeLessThan(t.indexOf("formation"));
  });

  it("S1c : deux phrases de suite dites autrement → leur texte est présent et aucune n'est « manquante »", () => {
    const dit = mots(dire(TEXTE[0], 1, 4), dire("Alors là on parle de tout autre chose, de cuisine et de jardin.", 4.5, 9), dire("Rien à voir avec le sujet mais quel plaisir de vous le dire.", 9.5, 13), dire(TEXTE[2], 13.5, 16.5), dire(TEXTE[3], 17, 19));
    const p = calculerCoupes({ mots: dit, dureeSec: 20, texteValide: TEXTE.join(" ") });
    const t = texteSousTitresGardes(p, dit);
    expect(t).toContain("cuisine");
    expect(t).toContain("quel plaisir");
    const c = controlerCoupes(p, dit);
    expect(c.phrasesManquantes).toEqual([]);
    expect(c.phrasesDitesAutrement.length).toBeGreaterThan(0);
  });

  it("une phrase vraiment absente (rien de gardé à sa place) reste manquante", () => {
    const sans = mots(dire(TEXTE[0], 1, 4), dire(TEXTE[2], 4.5, 8), dire(TEXTE[3], 8.5, 10.5));
    const p = calculerCoupes({ mots: sans, dureeSec: 12, texteValide: TEXTE.join(" ") });
    expect(controlerCoupes(p, sans).phrasesManquantes).toEqual([1]);
  });

  it("gardes réduites par une coupe demandée sur une phrase → aucun mot de cette phrase", () => {
    const phrase = plan.phrases[2];
    expect(phrase.debutSec).toBeDefined();
    const gardes = gardesApres({ coupes: [...plan.coupes, { id: "demande", type: "reprise", debutSec: phrase.debutSec! - 0.02, finSec: phrase.finSec! + 0.02, raison: "demandée", auto: false } as never], dureeSourceSec: plan.dureeSourceSec });
    const t = texteSousTitresGardes(plan, prise, gardes);
    expect(t).not.toContain("formation");
    expect(t).not.toContain("minutes");
    expect(t).toContain("personne");
    expect(t).toContain("Appelez-nous");
  });

  it("une consigne « Monteur, … » et les « euh » n'apparaissent jamais", () => {
    const avec = mots(dire("Monteur, mets une carte liste ici.", 0.2, 2.5), dire(TEXTE[0], 3.5, 6.5), dire("euh", 6.6, 6.9), dire(TEXTE[1], 7.2, 12), dire(TEXTE[2], 12.5, 16), dire(TEXTE[3], 16.5, 18.5));
    const p = calculerCoupes({ mots: avec, dureeSec: 20, texteValide: TEXTE.join(" ") });
    // Même consigne rétablie dans le son (gardes = toute la prise) : elle reste hors du texte.
    const t = texteSousTitresGardes(p, avec, [{ debutSec: 0, finSec: 20 }]);
    expect(t.toLowerCase()).not.toContain("monteur");
    expect(t).not.toContain("carte liste");
    expect(mots_(t)).not.toContain("euh");
  });
});

describe("texteSousTitresGardes · fin de phrase mal transcrite", () => {
  it("un mot de fin mal transcrit (hors des bornes de la phrase) n'est jamais écrit en double", () => {
    const T = ["Bonjour, je suis Paul, fondateur de Certifexemple.", "Nous avons automatisé toutes les relances de nos clients en deux semaines.", "Appelez-nous dès aujourd'hui."];
    const prise = mots(dire("Bonjour je suis Paul fondateur de Certifexemple", 1, 4), dire("Nous avons automatisé toutes les relances de nos clients en deux sème haines", 4.5, 9), dire("Appelez-nous dès aujourd'hui", 9.5, 11));
    const p = calculerCoupes({ mots: prise, dureeSec: 12, texteValide: T.join(" ") });
    expect(texteSousTitresGardes(p, prise)).toBe(T.join(" "));
  });
  it("une marque coupée en deux par la transcription n'est pas répétée", () => {
    const T = ["Bonjour, je suis Paul, fondateur de Certifexemple.", "Nous avons automatisé toutes les relances de nos clients en deux semaines.", "Appelez-nous dès aujourd'hui."];
    const prise = mots(dire("Bonjour je suis Paul fondateur de certif exemple", 1, 4), dire("Nous avons automatisé toutes les", 4.5, 6.5), dire("nous avons automatisé toutes les relances de nos clients en deux semaines", 7, 11), dire("Appelez-nous dès aujourd'hui", 11.5, 13));
    const p = calculerCoupes({ mots: prise, dureeSec: 15, texteValide: T.join(" ") });
    expect(texteSousTitresGardes(p, prise)).toBe(T.join(" "));
  });
});
