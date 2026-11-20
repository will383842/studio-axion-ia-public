/**
 * Envoi d'un visuel refusé : la raison (code, statut, détail sans adresse) va à la console serveur, jamais au journal ni à l'écran.
 * Lecture du source seulement : aucun appel réseau.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..", "..");
const src = readFileSync(join(RACINE, "src/services/publications.ts"), "utf8").replace(/\r\n/g, "\n");
const debut = src.indexOf("async function envoyerVisuelValide");
const fin = src.indexOf("\n}\n", debut);
const bloc = src.slice(debut, fin);
const capture = bloc.slice(bloc.lastIndexOf("} catch (e) {"));

describe("raison du refus d'un visuel à la console serveur", () => {
  it("le bloc de envoyerVisuelValide est trouvé", () => {
    expect(debut).toBeGreaterThan(0);
    expect(fin).toBeGreaterThan(debut);
  });
  it("le chemin d'erreur écrit code et statut en console.warn", () => {
    expect(capture.includes("console.warn(")).toBe(true);
    expect(capture.includes("envoi du visuel sur")).toBe(true);
    expect(capture.includes("[e.code, e.statut]")).toBe(true);
  });
  it("toute adresse est retirée et le détail est borné", () => {
    expect(capture.includes('"<adresse>"')).toBe(true);
    expect(capture.includes(".slice(0, 300)")).toBe(true);
  });
  it("rien de nouveau n'est écrit au journal visible sur ce chemin", () => {
    expect(capture.includes("journaliser(")).toBe(false);
  });
});
