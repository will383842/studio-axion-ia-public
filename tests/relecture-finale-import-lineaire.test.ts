/**
 * RELECTURE FINALE S1 et S2 — temps QUADRATIQUES de l'import, dans le processus du studio (serveur figé pour tous).
 *  - S1 : `recollerLignesPdf` relisait la ligne déjà recollée à chaque ligne : 100 000 lignes « a » → 8 s.
 *  - S2 : `/(?:^|\s+)([«“](?:\s*[«“])*)$/` revenait en arrière sur une longue suite d'espaces insécables : 50 000 → 1 s.
 * Attendu : temps linéaire (bornes larges, machine lente comprise) et MÊME résultat qu'avant sur des textes au hasard.
 */
import { describe, expect, it } from "vitest";
import { ouvrantsEnFin, paragraphesDuTexte } from "@/domaine/decoupage-colle";
import { extraireTexteFichier, recollerLignesPdf, TEXTE_BRUT_MAX_CARACTERES } from "@/services/import-texte";

/** L'ancienne version (référence du résultat attendu). */
function recollerAvant(texte: string): string {
  const sortie: string[] = [];
  for (const ligne of texte.replace(/\r\n?/g, "\n").split("\n")) {
    const i = sortie.length - 1;
    const avant = i >= 0 ? sortie[i].trimEnd() : "";
    const suite = ligne.trimStart();
    if (avant && suite && !/[.?!…:;][»"”’)\]\s  ]*$/.test(avant) && /^\p{Ll}/u.test(suite)) {
      sortie[i] = /\p{L}-$/u.test(avant) ? avant + suite : `${avant} ${suite}`;
    } else sortie.push(ligne);
  }
  return sortie.join("\n");
}

/** L'ancienne expression (référence). */
function ouvrantsAvant(m: string): { index: number; ouvrants: string } | null {
  const r = /(?:^|\s+)([«“](?:\s*[«“])*)$/.exec(m);
  return r ? { index: r.index, ouvrants: r[1] } : null;
}

/** Générateur pseudo-aléatoire reproductible. */
function hasard(graine: number) {
  let x = graine;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

const chrono = (f: () => void) => {
  const t = performance.now();
  f();
  return performance.now() - t;
};

describe("S1 — recollage des lignes d'un PDF", () => {
  it("même résultat qu'avant sur 3 000 textes au hasard (lignes, ponctuation, tirets, espaces, majuscules)", () => {
    const alea = hasard(42);
    const pieces = ["a", "b", "É", "é", "x-", "mot", "Fin.", "fin;", " ", "  ", " ", " ", "»", ")", ".", "?", "-", "\t", "Z", "ç"];
    for (let n = 0; n < 3000; n++) {
      const lignes: string[] = [];
      const nb = 1 + Math.floor(alea() * 12);
      for (let i = 0; i < nb; i++) {
        let l = "";
        const t = Math.floor(alea() * 6);
        for (let j = 0; j < t; j++) l += pieces[Math.floor(alea() * pieces.length)];
        lignes.push(l);
      }
      const texte = lignes.join(alea() < 0.1 ? "\r\n" : "\n");
      expect(recollerLignesPdf(texte)).toBe(recollerAvant(texte));
    }
  });

  it("200 000 lignes d'une lettre : bien moins d'une seconde (avant : environ 36 s)", () => {
    const texte = Array.from({ length: 200_000 }, () => "a").join("\n");
    let sortie = "";
    const ms = chrono(() => (sortie = recollerLignesPdf(texte)));
    expect(sortie).toBe(Array.from({ length: 200_000 }, () => "a").join(" "));
    expect(ms).toBeLessThan(1000);
  });

  it("un texte brut démesuré est refusé « trop long » avant tout traitement", async () => {
    const octets = new TextEncoder().encode("a\n".repeat(TEXTE_BRUT_MAX_CARACTERES));
    await expect(extraireTexteFichier("texte.txt", octets)).rejects.toMatchObject({ code: expect.stringMatching(/IMPORT_(TROP_LONG|REFUSE)/) });
  });
});

describe("S2 — guillemets ouvrants en fin de morceau", () => {
  it("même résultat que l'ancienne expression sur 20 000 morceaux au hasard", () => {
    const alea = hasard(7);
    const pieces = ["«", "“", " ", " ", " ", "a", "b", ".", "»", "\t"];
    for (let n = 0; n < 20_000; n++) {
      let m = "";
      const t = Math.floor(alea() * 10);
      for (let j = 0; j < t; j++) m += pieces[Math.floor(alea() * pieces.length)];
      expect(ouvrantsEnFin(m)).toEqual(ouvrantsAvant(m));
    }
  });

  it("200 000 espaces insécables dans un morceau : bien moins d'une seconde (avant : environ 16 s)", () => {
    const texte = `Début${" ".repeat(200_000)}fin\nsuite «\nmot`;
    let p: string[][] = [];
    const ms = chrono(() => (p = paragraphesDuTexte(texte)));
    expect(p[0].at(-1)).toBe("« mot");
    expect(ms).toBeLessThan(1000);
  });
});
