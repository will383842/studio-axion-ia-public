/** C1.5 : calibrage de la ressemblance commune sur 30 paires étiquetées (voir docs/ecriture/CALIBRAGE-RESSEMBLANCE-2026-10-18.md). */
import { describe, expect, it } from "vitest";
import { comparerScripts } from "@/domaine/ecriture-commune/ressemblance";
import { CORPUS_60 } from "./corpus-60";
import { PAIRES } from "./paires";

const verdict = (p: (typeof PAIRES)[number]) => comparerScripts(p.nouveau, [p.ancien]);

describe("calibrage sur 30 paires", () => {
  it("il y a 30 paires, 18 qui se ressemblent et 12 qui diffèrent", () => {
    expect(PAIRES).toHaveLength(30);
    expect(PAIRES.filter((p) => p.attendu === "ressemble")).toHaveLength(18);
    expect(new Set(PAIRES.map((p) => p.id)).size).toBe(30);
  });
  it("détecte toutes les copies et paraphrases", () => {
    const ratees = PAIRES.filter((p) => ["copie", "paraphrase"].includes(p.groupe) && !verdict(p).ressemble).map((p) => p.id);
    expect(ratees).toEqual([]);
  });
  it("aucun faux positif sur les scripts différents du même thème", () => {
    expect(PAIRES.filter((p) => p.groupe === "different" && verdict(p).ressemble).map((p) => p.id)).toEqual([]);
  });
  it("aucune charpente courante (moule propre) n'est refusée à tort", () => {
    const faux = PAIRES.filter((p) => p.groupe === "moule-propre" && verdict(p).ressemble).map((p) => p.id);
    expect(faux).toEqual([]);
  });
  it("le moule (seul) détecte les 4 patrons repris sur 4", () => {
    expect(PAIRES.filter((p) => p.groupe === "moule" && verdict(p).moules.length > 0).length).toBe(4);
  });
});

describe("calibrage en service : un script contre 60 anciens", () => {
  const verdicts = CORPUS_60.map((s, i) => comparerScripts(s, CORPUS_60.filter((_, j) => j !== i)));
  it("le corpus compte 60 scripts distincts", () => {
    expect(CORPUS_60).toHaveLength(60);
    expect(new Set(CORPUS_60).size).toBe(60);
  });
  it("aucun script honnête n'est refusé à tort quand on le compare aux 59 autres", () => {
    expect(verdicts.filter((v) => v.ressemble).length).toBe(0);
  });
  it("le moule seul reste un signal (moules rendus) mais ne fait jamais `ressemble`", () => {
    const moulesSeuls = verdicts.filter((v) => v.moules.length > 0 && !v.copies.length && !v.paraphrases.length);
    expect(moulesSeuls.length).toBeGreaterThan(0);
    for (const v of moulesSeuls) expect(v.ressemble).toBe(false);
    const m = PAIRES.filter((p) => p.groupe === "moule").map(verdict).filter((v) => !v.copies.length && !v.paraphrases.length);
    for (const v of m) expect(v.ressemble).toBe(false);
  });
});
