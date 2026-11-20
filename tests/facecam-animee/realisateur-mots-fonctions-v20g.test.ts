/**
 * T-MOTS-REALISATEUR-FA-v20g : tests directs de `ponctuationFinale`, `estMotOutil` et `nombresDansTexte`
 * (`src/moteurs/montage-facecam-animee/realisateur/mots.ts`). Aucun double de module, rien de `studio-rendu`.
 */
import { describe, expect, it } from "vitest";
import { estMotOutil, nombresDansTexte, ponctuationFinale } from "@/moteurs/montage-facecam-animee/realisateur/mots";

describe("ponctuationFinale", () => {
  it("rend la ponctuation finale du mot brut", () => {
    expect(ponctuationFinale("fuite.")).toBe(".");
    expect(ponctuationFinale("Un :")).toBe(":");
    expect(ponctuationFinale("vraiment…")).toBe("…");
    expect(ponctuationFinale("non,")).toBe(",");
  });
  it("passe sur les fermants (espace, guillemet, parenthèse) après la ponctuation", () => {
    expect(ponctuationFinale("fin.»")).toBe(".");
    expect(ponctuationFinale("fin ? »")).toBe("?");
    expect(ponctuationFinale("fin ?\u00A0»")).toBe("?"); // espace insécable : c'est un espace (\s)
    expect(ponctuationFinale("(vu !)")).toBe("!");
    expect(ponctuationFinale('dit." ')).toBe(".");
  });
  it("rend null sans ponctuation finale (mot nu, vide, ponctuation au milieu, tiret)", () => {
    expect(ponctuationFinale("fuite")).toBeNull();
    expect(ponctuationFinale("")).toBeNull();
    expect(ponctuationFinale("a.b")).toBeNull();
    expect(ponctuationFinale("peut-être")).toBeNull();
  });
  it("ne garde que la dernière ponctuation", () => {
    expect(ponctuationFinale("quoi ?!")).toBe("!");
    expect(ponctuationFinale("hum, oui.")).toBe(".");
  });
});

describe("estMotOutil", () => {
  it("vrai pour les mots-outils, avec ponctuation, majuscule ou accent", () => {
    expect(estMotOutil("le")).toBe(true);
    expect(estMotOutil("Et,")).toBe(true);
    expect(estMotOutil("à")).toBe(true);
    expect(estMotOutil("très")).toBe(true);
    expect(estMotOutil("peut-être")).toBe(true);
  });
  it("vrai pour les élisions dont la base est un mot-outil", () => {
    expect(estMotOutil("l'IA")).toBe(false); // « ia » : 2 lettres, pas dans la liste
    expect(estMotOutil("l'on")).toBe(true);
    expect(estMotOutil("qu'est")).toBe(true);
    expect(estMotOutil("c'est")).toBe(true);
  });
  it("vrai pour le vide et les mots d'une lettre (après nettoyage)", () => {
    expect(estMotOutil("")).toBe(true);
    expect(estMotOutil("?")).toBe(true);
    expect(estMotOutil(" … ")).toBe(true);
    expect(estMotOutil("x")).toBe(true);
    expect(estMotOutil("'")).toBe(true);
  });
  it("faux pour les mots forts et pour tout mot contenant un chiffre", () => {
    expect(estMotOutil("fuite.")).toBe(false);
    expect(estMotOutil("administratif")).toBe(false);
    expect(estMotOutil("45")).toBe(false);
    expect(estMotOutil("2,5")).toBe(false);
    expect(estMotOutil("a1")).toBe(false);
    expect(estMotOutil("5")).toBe(false);
    expect(estMotOutil("7,")).toBe(false);
    expect(estMotOutil("IA")).toBe(false);
  });
});

describe("nombresDansTexte", () => {
  it("lit les nombres en chiffres, dans l'ordre, virgule décimale comprise", () => {
    expect(nombresDansTexte("45 min")).toEqual([45]);
    expect(nombresDansTexte("2,5 h puis 3.75 €")).toEqual([2.5, 3.75]);
    expect(nombresDansTexte("de 10 à 20 puis 10")).toEqual([10, 20, 10]);
  });
  it("rend [] sans chiffre (vide, lettres seulement)", () => {
    expect(nombresDansTexte("")).toEqual([]);
    expect(nombresDansTexte("quarante-cinq minutes")).toEqual([]);
  });
  it("ne prend pas le signe et sépare les groupes", () => {
    expect(nombresDansTexte("-5")).toEqual([5]);
    expect(nombresDansTexte("30%")).toEqual([30]);
  });
  it("n'agit pas sur la chaîne reçue (texte immuable) et reste identique à chaque appel", () => {
    const t = "2,5 h";
    expect(nombresDansTexte(t)).toEqual(nombresDansTexte(t));
    expect(t).toBe("2,5 h");
  });
});
