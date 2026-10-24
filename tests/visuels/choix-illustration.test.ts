/**
 * ART-1 : les couvertures portent une VRAIE illustration de la banque maison (I01…I12), choisie d'après le sujet (mots-clés du registre),
 * ou aucune (composition typographique pleine) : jamais un aplat vide ni une forme sans sens.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { choisirIcone, choisirIllustration, iconesDesQuestions } from "@/briques/visuels/choix-illustration";
import type { NomIcone } from "@/briques/visuels/registre-illustrations";

describe("choisirIllustration", () => {
  it.each([
    ["Vos factures en ordre", undefined, "I11"],
    ["Le temps perdu en relances", "Où il part, comment le reprendre", "I03"],
    ["Une relance qui part toute seule", undefined, "I04"],
    ["Moins de réunions", "Et de meilleures décisions", "I12"],
    ["Un dossier client sans trou", "Tout au même endroit", "I06"],
    ["Gagner du temps chaque semaine", undefined, "I03"],
    ["Quel objectif pour cette année ?", undefined, "I09"],
  ])("%j / %j → %s", (titre, sousTitre, attendu) => {
    expect(choisirIllustration(titre, sousTitre)).toBe(attendu);
  });

  it("sans mot-clé reconnu : aucune illustration (la couverture reste typographique)", () => {
    expect(choisirIllustration("Relancer sans y penser")).toBeNull();
    expect(choisirIllustration("Professionnalisation")).toBeNull();
  });

  it("insensible aux accents, à la casse et au pluriel", () => {
    expect(choisirIllustration("ÉCHÉANCES ET PLANNINGS")).toBe("I05");
  });

  it("un mot-clé ne se reconnaît qu'en mot entier (« but » n'est pas dans « début »)", () => {
    expect(choisirIllustration("Un bon début")).toBeNull();
  });
});

/**
 * Tour 2 (T23) : la même icône « ? » répétée sur chaque question n'apporte rien. Chaque question reçoit l'icône qui a un SENS pour elle
 * (choisie dans son texte, mots-clés du registre, comme `choisirIllustration`), ou la page n'a aucune icône.
 */
describe("iconesDesQuestions (T23)", () => {
  const q = (question: string, aide = "Une aide.", icone?: NomIcone) => ({ question, aide, ...(icone ? { icone } : {}) });
  it("une icône par question, choisie dans son texte", () => {
    expect(choisirIcone("Combien de temps par semaine ?")).toBe("horloge");
    expect(iconesDesQuestions([q("Combien de temps par semaine ?"), q("Quel objectif viser ?")])).toEqual(["horloge", "cible"]);
  });
  it("le « ? » répété (ou toute icône sans sens à côté d'une question) n'est jamais posé : aucune icône sur la page", () => {
    expect(iconesDesQuestions([q("Quoi automatiser ?", "Ce qui revient.", "question"), q("Qui essaie ?", "Une personne.", "question")])).toBeNull();
  });
  it("une icône choisie par le spec qui a un sens est gardée ; « ? » est remplacée par celle du texte", () => {
    expect(iconesDesQuestions([q("Une première ?", "Aide.", "engrenage"), q("Quel délai ?", "Aide.", "question")])).toEqual(["engrenage", "horloge"]);
  });
  it("une question sans icône possible, ou deux questions avec la même : aucune icône sur la page", () => {
    expect(iconesDesQuestions([q("Combien de temps ?"), q("Qui essaie ?")])).toBeNull();
    expect(iconesDesQuestions([q("Combien de temps ?"), q("Quel délai ?")])).toBeNull();
  });
  it("la composition T23 pose les icônes choisies ainsi", () => {
    expect(readFileSync(new URL("../../studio-rendu/compositions/visuels/pages/T23.tsx", import.meta.url), "utf8")).toContain("iconesDesQuestions(questions)");
  });
});
