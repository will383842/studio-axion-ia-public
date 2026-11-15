/** Écran YouTube Shorts : état de la chaîne lu dans les comptes Zernio déjà enregistrés (pur, aucun réseau). */
import { describe, expect, it } from "vitest";
import { etatChaineYoutube } from "@/domaine/chaine-youtube";

describe("etatChaineYoutube", () => {
  it("comptes jamais lus : inconnu", () => {
    expect(etatChaineYoutube(null)).toEqual({ etat: "inconnu" });
    expect(etatChaineYoutube(undefined)).toEqual({ etat: "inconnu" });
    expect(etatChaineYoutube("x")).toEqual({ etat: "inconnu" });
  });
  it("aucun compte YouTube : absent", () => {
    expect(etatChaineYoutube({ lusLe: "2026-11-15T10:00:00Z", comptes: [{ id: "a", reseau: "instagram", nom: "Un compte" }] })).toEqual({ etat: "absent" });
    expect(etatChaineYoutube({ lusLe: "2026-11-15T10:00:00Z", comptes: [] })).toEqual({ etat: "absent" });
  });
  it("un compte YouTube : relié, avec son nom d'affichage seulement", () => {
    const r = etatChaineYoutube({ lusLe: "2026-11-15T10:00:00Z", comptes: [{ id: "exemple-compte-yt", reseau: "youtube", nom: "Ma chaîne" }] });
    expect(r).toEqual({ etat: "relie", nom: "Ma chaîne" });
    expect(JSON.stringify(r)).not.toContain("exemple-compte-yt");
  });
  it("liste abîmée : inconnu, jamais d'exception", () => {
    expect(etatChaineYoutube({ lusLe: "x", comptes: "oups" })).toEqual({ etat: "inconnu" });
  });
});
