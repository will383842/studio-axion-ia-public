/** Réparation mécanique des phrases trop longues (Q09) : seule la ponctuation et la majuscule changent. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import { motsDits, phrasesDe, type FicheImage } from "@/domaine/image-video/fiche";
import type { EntreeRole } from "@/generateur/roles/types";
import { ecrireScriptIV, reparerPhrasesLongues, scinderPhrasesLongues, type OutilsEcritureIV } from "@/moteurs/montage-image-video/ecriture";
import { ficheSimulee } from "@/moteurs/montage-image-video/ecriture.simulation";
import { MOTS_PAR_PHRASE_MAX, cleFormule, verifierScript, type ChoixFormule } from "@/moteurs/montage-image-video/regles";

const carte: CarteImage = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/C.json"), "utf8"));
const GARDER: Record<string, ChoixFormule> = Object.fromEntries(
  ["dès le premier jour", "0 demande perdue", "toujours", "0 question sans réponse", "risque erreur : zéro", "Zéro erreur"].map((f) => [cleFormule(f), "garder" as const]),
);
const mots = (t: string) => t.split(/[^\p{L}\p{N}'’-]+/u).filter(Boolean).map((m) => m.toLowerCase());
const PHRASE = "Moins de tâches répétitives, plus de temps pour vos clients et votre croissance";

describe("scinderPhrasesLongues", () => {
  it("(a) 13 mots → deux phrases de 12 mots au plus, mêmes mots, même ordre", () => {
    const r = scinderPhrasesLongues(`${PHRASE}.`);
    expect(r).toBe("Moins de tâches répétitives. Plus de temps pour vos clients et votre croissance.");
    for (const p of phrasesDe(r)) expect(motsDits(p).length).toBeLessThanOrEqual(MOTS_PAR_PHRASE_MAX);
    expect(mots(r)).toEqual(mots(PHRASE));
  });
  it("(b) 30 mots sans virgule → scindée, mêmes mots", () => {
    const t = Array.from({ length: 30 }, (_, i) => `mot${i}`).join(" ");
    const r = scinderPhrasesLongues(`${t}.`);
    expect(phrasesDe(r).length).toBeGreaterThan(1);
    for (const p of phrasesDe(r)) expect(motsDits(p).length).toBeLessThanOrEqual(MOTS_PAR_PHRASE_MAX);
    expect(mots(r)).toEqual(mots(t));
  });
  it("mot de liaison quand il n'y a pas de virgule", () => {
    const t = "Nous répondons à chaque message client chaque jour et nous relançons les prospects sans effort";
    expect(scinderPhrasesLongues(t)).toBe("Nous répondons à chaque message client chaque jour. Et nous relançons les prospects sans effort");
  });
  it("(c) 12 mots ou moins → inchangée", () => {
    const t = "Un texte court. Une autre phrase, avec une virgule, mais courte ?";
    expect(scinderPhrasesLongues(t)).toBe(t);
    expect(scinderPhrasesLongues("Un deux trois quatre cinq six sept huit neuf dix onze douze.")).toBe("Un deux trois quatre cinq six sept huit neuf dix onze douze.");
  });
  it("(d) les chiffres restent identiques", () => {
    const t = "En 2024, 35 clients ont gagné 12 heures par semaine et 48 % de réponses en plus sur 3 mois avec 7 outils";
    expect(scinderPhrasesLongues(t).match(/\d+/g)).toEqual(t.match(/\d+/g));
  });
});

describe("écriture : phrase trop longue réparée sans blocage", () => {
  it("(e) une fiche dont seule la phrase est trop longue devient valide, sans relance", async () => {
    const f: FicheImage = structuredClone(ficheSimulee("essai-c")!);
    const e = f.ecrans[1]!;
    e.texteDit = `${PHRASE}.`;
    e.surMot = [{ mot: 0, action: "apparait" }];
    expect(verifierScript(f, { carte, choixFormules: GARDER }).manquements.some((m) => m.regle === "Q09")).toBe(true);
    const o: OutilsEcritureIV = {
      budget: { reserver: async () => ({ ok: true }) },
      appeler: async (_r, _e: EntreeRole) => ({ ok: true, simule: true, donnees: f }),
    };
    const r = await ecrireScriptIV({ videoId: "v1", versionId: "s1", carte, choixFormules: GARDER }, o);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.appels).toBe(1);
    expect(r.fiche.ecrans[1]!.texteDit).toBe("Moins de tâches répétitives. Plus de temps pour vos clients et votre croissance.");
    expect(r.fiche.ecrans[1]!.surMot).toEqual(e.surMot);
    expect(reparerPhrasesLongues(r.fiche)).toEqual(r.fiche);
  });
});
