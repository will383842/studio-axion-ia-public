/** PR A · machine et carte : le doute en commentaire. Fonctions pures, données fictives. */
import { describe, expect, it } from "vitest";
import { transition } from "@/domaine/guide-reseau/machine-conversation";
import { proposerCarte } from "@/domaine/guide-reseau/carte-manuelle";

const NOW = Date.parse("2026-10-18T10:05:00.000Z");
const com = (o: Record<string, unknown> = {}) => ({ t: "commentaire" as const, idCommentaire: "com-1", proprio: false, idAuteur: "a", idCompte: "c", motSeul: null, estReponse: false, ageMs: 1000, maintenantMs: NOW, ...o }) as never;

describe("A7 machine · commentaire en doute", () => {
  it("doute → action « doute » sans patch", () => {
    const s = transition(null, com({ doute: true }));
    expect(s).toEqual({ action: "doute" });
    expect("patch" in s).toBe(false);
  });
  it("proprio et auteur_compte passent avant", () => {
    expect(transition(null, com({ doute: true, proprio: true }))).toMatchObject({ action: "ecarter", raison: "proprio" });
    expect(transition(null, com({ doute: true, idAuteur: "c" }))).toMatchObject({ action: "ecarter", raison: "auteur_compte" });
    expect(transition(null, com({ doute: true, idAuteur: null }))).toMatchObject({ action: "ecarter", raison: "auteur_compte" });
  });
  it("opposition claire passe avant le doute", () => {
    expect(transition(null, com({ doute: true, motSeul: "STOP" })).action).toBe("opposer");
  });
  it("estReponse + doute → « doute » (pas « reponse »)", () => {
    expect(transition(null, com({ doute: true, estReponse: true })).action).toBe("doute");
  });
  it("sans doute : comportement inchangé", () => {
    expect(transition(null, com({ estReponse: true }))).toMatchObject({ action: "ecarter", raison: "reponse" });
    expect(transition(null, com())).toMatchObject({ action: "ecarter", raison: "mot" });
    expect(transition(null, com({ doute: false, motSeul: "GUIDE" })).action).toBe("demarrer");
  });
});

const mots = [{ mot: "GUIDE", etat: "actif" as const, textesValides: true }];
const base = { reseau: "linkedin_page" as const, motSeul: null as string | null, motsDuReseau: mots, opposee: false, dejaTraite: false };
describe("A8 proposerCarte · doute", () => {
  it("doute → carte_doute", () => {
    expect(proposerCarte({ ...base, doute: true })).toEqual({ action: "carte_doute" });
    expect(proposerCarte({ ...base, reseau: "tiktok", doute: true })).toEqual({ action: "carte_doute" });
  });
  it("opposition claire et opposée passent avant", () => {
    expect(proposerCarte({ ...base, motSeul: "STOP", doute: true })).toEqual({ action: "silence", raison: "opposition" });
    expect(proposerCarte({ ...base, opposee: true, doute: true })).toEqual({ action: "silence", raison: "personne_opposee" });
  });
  it("sans doute : inchangé", () => {
    expect(proposerCarte(base)).toEqual({ action: "silence", raison: "rien" });
    expect(proposerCarte({ ...base, doute: false })).toEqual({ action: "silence", raison: "rien" });
    expect(proposerCarte({ ...base, motSeul: "GUIDE" }).action).toBe("carte");
  });
});
