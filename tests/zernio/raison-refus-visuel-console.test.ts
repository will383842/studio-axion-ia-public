/**
 * Envoi d'un visuel refusé : la raison (code, statut, détail sans adresse) va à la console serveur, jamais au journal ni à l'écran.
 * Lecture du source seulement : aucun appel réseau.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync("src/services/publications.ts", "utf8");
const debut = src.indexOf("async function envoyerVisuelValide");
const bloc = src.slice(debut, src.indexOf("\n}\n", debut));

describe("raison du refus d'un visuel à la console serveur", () => {
  it("le chemin d'erreur de envoyerVisuelValide écrit code et statut en console.warn", () => {
    expect(bloc).toMatch(/console\.warn\(`\[studio\] outil de publication, envoi du visuel sur/);
    expect(bloc).toMatch(/e\.code, e\.statut/);
  });
  it("toute adresse est retirée et le détail est borné", () => {
    expect(bloc).toMatch(/replace\(\/https\?:\\/\\/\S\+\/g, "<adresse>"\)/);
    expect(bloc).toMatch(/\.slice\(0, 300\)/);
  });
  it("rien de nouveau n'est écrit au journal visible sur ce chemin", () => {
    const capture = bloc.slice(bloc.lastIndexOf("} catch (e) {"));
    expect(capture).not.toMatch(/journaliser\(/);
  });
});
