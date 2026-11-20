import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { alerteRemarque, estPreteAvecRemarques, estResteBloquant, PREFIXE_REMARQUE_LIVRAISON, RESTE_BLOQUANT, remarquesDeLivraison } from "@/domaine/livraison-avec-remarques";
import type { AlerteQualite } from "@/domaine/types";

const CODES = ["mot-dit-faux", "chiffre-faux", "mot-interdit", "voix-ou-accord", "regles-h1-h2", "duree-plus-180-s", "phrase-non-choisie", "fin-absente", "image-noire-au-debut"];
const alerte = (gravite: AlerteQualite["gravite"], message: string): AlerteQualite => ({ code: "defaut-visuel", gravite, message });
const avecRemarque = alerte("bloquant", `${PREFIXE_REMARQUE_LIVRAISON}Variété : x`);

describe("S-13-a · liste fermée de ce qui reste bloquant", () => {
  it("a) exactement les 9 codes, dans l'ordre, liste gelée, libellés en français simple", () => {
    expect(RESTE_BLOQUANT.map((e) => e.code)).toEqual(CODES);
    expect(Object.isFrozen(RESTE_BLOQUANT)).toBe(true);
    for (const e of RESTE_BLOQUANT) {
      expect(e.libelle.trim().length).toBeGreaterThan(5);
      expect(e.libelle).not.toMatch(/\b[A-Z]{2,}\b/);
    }
  });

  it("b) estResteBloquant : vrai pour les 9, faux pour le reste", () => {
    for (const c of CODES) expect(estResteBloquant(c)).toBe(true);
    for (const c of ["variete", "deja-vu", "volume-du-son", ""]) expect(estResteBloquant(c)).toBe(false);
  });

  it("c) alerteRemarque : alerte bloquante préfixée, point final de la raison retiré", () => {
    const a = alerteRemarque("Variété", "Même structure que la vidéo d'hier.");
    expect(a.gravite).toBe("bloquant");
    expect(a.code).toBe("defaut-visuel");
    expect(a.message).toBe("Remarque de livraison · Variété : Même structure que la vidéo d'hier");
    expect(alerteRemarque("Variété", "x", "rythme").code).toBe("rythme");
  });

  it("d) remarquesDeLivraison : ignore le bloquant sans préfixe et l'attention préfixée", () => {
    expect(remarquesDeLivraison(undefined)).toEqual([]);
    const note = { alertes: [alerte("bloquant", "Sans préfixe"), alerte("attention", `${PREFIXE_REMARQUE_LIVRAISON}Variété : x`), avecRemarque] };
    expect(remarquesDeLivraison(note)).toEqual([avecRemarque]);
  });

  it("e) estPreteAvecRemarques : prête + remarque seulement (éteint = identique)", () => {
    const note = (alertes: AlerteQualite[]) => ({ alertes }) as never;
    expect(estPreteAvecRemarques({ statut: "prete", noteQualite: note([avecRemarque]) })).toBe(true);
    expect(estPreteAvecRemarques({ statut: "echec", noteQualite: note([avecRemarque]) })).toBe(false);
    expect(estPreteAvecRemarques({ statut: "prete", noteQualite: note([]) })).toBe(false);
    expect(estPreteAvecRemarques({ statut: "prete", noteQualite: note([alerte("attention", "a"), alerte("info", "b")]) })).toBe(false);
    expect(estPreteAvecRemarques({ statut: "prete" })).toBe(false);
  });

  it("f) garde : le module n'importe que des types", () => {
    const src = readFileSync(join(process.cwd(), "src/domaine/livraison-avec-remarques.ts"), "utf8");
    const imports = src.match(/^import .*$/gm) ?? [];
    expect(imports.length).toBeGreaterThan(0);
    for (const l of imports) expect(l).toMatch(/^import type /);
    expect(src).not.toMatch(/from "zod"|@\/services|@\/moteurs/);
  });
});
