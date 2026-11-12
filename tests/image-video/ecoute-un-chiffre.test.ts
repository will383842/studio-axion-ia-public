/**
 * Écoute : la voix écrite « 1 » pour le mot français « un » / « une » n'est pas un chiffre inventé ;
 * tout autre nombre absent du script reste refusé.
 */
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { comparerAuScript } from "@/moteurs/montage-image-video/ecoute";

const mots = (texte: string): MotHorodate[] => texte.split(" ").map((mot, i) => ({ mot, debutSec: i * 0.3, finSec: i * 0.3 + 0.25 }));

describe("chiffres inventés : « 1 » dit pour « un » / « une »", () => {
  it("transcription « 1 » et script avec « un » : aucun défaut", () => {
    const c = comparerAuScript("Je vous montre un seul outil pour gagner du temps.", mots("Je vous montre 1 seul outil pour gagner du temps."));
    expect(c.chiffresInventes).toEqual([]);
  });

  it("transcription « 1 » et script avec « une » : aucun défaut", () => {
    const c = comparerAuScript("Voici une idée simple pour vos clients.", mots("Voici 1 idée simple pour vos clients."));
    expect(c.chiffresInventes).toEqual([]);
  });

  it("transcription « 1 » et script sans un/une/1 : défaut conservé", () => {
    const c = comparerAuScript("Voici le seul outil pour vos clients.", mots("Voici le 1 outil pour vos clients."));
    expect(c.chiffresInventes).toEqual(["1"]);
  });

  it("transcription « 12 » absent du script : défaut conservé, même si le script a un « un »", () => {
    const c = comparerAuScript("Je vous montre un outil pour vos clients.", mots("Je vous montre 12 outils pour vos clients."));
    expect(c.chiffresInventes).toEqual(["12"]);
  });

  const inv = (script: string, voix: string) => comparerAuScript(script, mots(voix)).chiffresInventes;

  it("refuse un « 1 » qui remplace un autre mot : deux outils / 1 outil", () => {
    expect(inv("Je vous montre deux outils pour deux clients.", "Je vous montre 1 outil pour 2 clients.")).toContain("1");
  });
  it("refuse « 1 million » pour un « un client »", () => {
    expect(inv("Je vous montre un client simple.", "Je vous montre 1 million de clients simple.")).toContain("1");
  });
  it("refuse « 1 % » et « 1 heure » quand le script n'a qu'un « un »", () => {
    expect(inv("Je vous montre un outil pour vos clients.", "Je vous montre 1 % outil pour vos clients.")).not.toEqual([]);
    expect(inv("Je vous montre un outil pour vos clients.", "Je vous montre 1 heure outil pour vos clients.")).not.toEqual([]);
  });
  it("refuse « 1 millier / centaine / dizaine / k / M€ » quand le script n'a qu'un « un outil »", () => {
    for (const unite of ["millier d'outils", "centaine d'outils", "dizaine d'outils", "k outils", "M€ outils"]) {
      expect(inv("Je vous montre un outil pour vos clients.", `Je vous montre 1 ${unite} pour vos clients.`)).not.toEqual([]);
    }
  });
  it("refuse 11 puis 21 quand le script n'a qu'un « un »", () => {
    expect(inv("Je vous montre un outil pour vos clients.", "Je vous montre 11 outil pour vos clients.")).toEqual(["11"]);
    expect(inv("Je vous montre un outil pour vos clients.", "Je vous montre 21 outil pour vos clients.")).toEqual(["21"]);
  });
  it("accepte « un outil » / « 1 outil »", () => {
    expect(inv("Je vous montre un outil.", "Je vous montre 1 outil.")).toEqual([]);
  });
  it("accepte « une idée » / « 1 idée » sur un script long (plus de 34 mots)", () => {
    const long = "Aujourd'hui je vous parle de la façon dont une petite équipe peut gagner du temps chaque semaine grâce à des gestes simples, à de bons réflexes et à quelques outils bien choisis que vous pouvez mettre en place dès demain matin sans effort ni budget.";
    expect(long.split(" ").length).toBeGreaterThan(34);
    expect(inv(long, long.replace("une petite", "1 petite"))).toEqual([]);
  });
  it("accepte « premier » / « 1er »", () => {
    expect(inv("Voici le premier outil pour vos clients.", "Voici le 1er outil pour vos clients.")).toEqual([]);
  });
});
