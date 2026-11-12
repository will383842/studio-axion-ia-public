/**
 * L3-05 : charte de voix appliquée en sortie (PUB-10). Généré : rejeté ; saisi ou importé : signalé, jamais bloqué.
 * Les interdits sont assemblés, jamais écrits en clair. Aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import { analyserCharte } from "@/domaine/ecriture-post/charte-voix";
import { controlerCharte } from "@/domaine/ecriture-post/controle-charte";

const J = (...p: string[]) => p.join("");
const INTERDIT = J("cert", "ifié");
const CONFORME = "Voici trois gestes simples pour votre semaine.";
const AVEC_TU = "Voici ce que tu peux faire dès demain.";
const AVEC_INTERDIT = `Une équipe ${INTERDIT} pour vous.`;

describe("analyserCharte", () => {
  it("repère le tutoiement et les interdits", () => {
    expect(analyserCharte(AVEC_TU).tutoiement).toBe(true);
    expect(analyserCharte(AVEC_INTERDIT).interdits.length).toBeGreaterThan(0);
    expect(analyserCharte(CONFORME)).toEqual({ tutoiement: false, interdits: [] });
  });
  it("repère un interdit collé ou invisible", () => {
    expect(analyserCharte(J("#Formation", INTERDIT, "​")).interdits.length).toBeGreaterThan(0);
  });
});

describe("controlerCharte", () => {
  it("texte généré avec « tu » : rejeté", () => {
    const r = controlerCharte(AVEC_TU, "genere");
    expect(r.verdict).toBe("rejete");
    expect(r.motifs.length).toBeGreaterThan(0);
  });
  it("texte généré avec un interdit : rejeté", () => {
    expect(controlerCharte(AVEC_INTERDIT, "genere").verdict).toBe("rejete");
  });
  it.each(["saisi", "importe"] as const)("texte %s avec « tu » ou un interdit : signalé, jamais bloqué", (origine) => {
    for (const t of [AVEC_TU, AVEC_INTERDIT, `${AVEC_TU} ${AVEC_INTERDIT}`]) {
      const r = controlerCharte(t, origine);
      expect(r.verdict).toBe("signale");
      expect(r.motifs.length).toBeGreaterThan(0);
    }
  });
  it.each(["genere", "saisi", "importe"] as const)("texte conforme (%s) : passe", (origine) => {
    expect(controlerCharte(CONFORME, origine)).toEqual({ verdict: "passe", motifs: [] });
  });
  it("« certificat » reste autorisé", () => {
    expect(controlerCharte("Votre certificat de présence.", "genere").verdict).toBe("passe");
  });
});
