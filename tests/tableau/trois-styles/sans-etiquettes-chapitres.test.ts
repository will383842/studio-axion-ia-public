/**
 * FIX-ETIQUETTES-TABLEAU : décision de Williams (17/11), les étiquettes
 * « Douleur · Solution · Exemple · À vous » ne sont plus jamais dessinées en haut de l'image.
 * Lecture des sources par readFileSync UNIQUEMENT (jamais d'import d'une composition : PIEGE-REMOTION-TSC).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STRUCTURES_FICHE } from "../../../src/briques/fiche-scenes/types";
import { STYLES_TABLEAU } from "../../../src/briques/tableau-scene/trois-styles/styles";
import { avecStyleTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { IDS_FORMATS_SORTIE } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { ficheMaquettes } from "./fiches";

const RACINE = new URL("../../../studio-rendu/compositions/tableau/", import.meta.url).pathname;
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const fichiers = (d: string): string[] =>
  readdirSync(d).flatMap((n) => {
    const c = join(d, n);
    return statSync(c).isDirectory() ? fichiers(c) : /\.tsx?$/.test(n) ? [c] : [];
  });

describe("plus d'étiquettes de chapitres dans le tableau", () => {
  it("a) PageTableau.tsx ne dessine plus la barre des chapitres", () => {
    const src = sansCommentaires(readFileSync(join(RACINE, "trois-styles/PageTableau.tsx"), "utf8"));
    for (const interdit of ["CHAPITRES_TABLEAU", "chapitreDePartie", "function chapitres(", "chapitres(", '"Douleur"', '"Solution"', '"À vous"']) {
      expect(src, interdit).not.toContain(interdit);
    }
  });
  it("b) aucun rendu du tableau (hors PageReference3) n'importe CHAPITRES_TABLEAU", () => {
    const rendus = fichiers(RACINE).filter((f) => !f.endsWith("reference/PageReference3.tsx"));
    expect(rendus.length).toBeGreaterThan(0);
    for (const f of rendus) expect(readFileSync(f, "utf8"), f).not.toContain("CHAPITRES_TABLEAU");
  });
  it("c) l'ancien rendu PageReference3 n'est jamais choisi : le style du tableau est toujours posé", () => {
    for (const structure of STRUCTURES_FICHE) {
      for (const format of IDS_FORMATS_SORTIE) {
        for (const style of STYLES_TABLEAU) {
          const fiche = avecStyleTableau({ ...ficheMaquettes(style), structure, styleTableau: style });
          const m = mettreEnPage(fiche, format === "vertical" ? {} : { format });
          expect(m.styleReference?.style, `${structure} ${format} ${style}`).toBe("reference/3");
          expect(m.styleReference?.tableau, `${structure} ${format} ${style}`).toBeDefined();
        }
      }
    }
    const sans = { ...ficheMaquettes() } as Record<string, unknown>;
    delete sans.styleTableau;
    const m = mettreEnPage(avecStyleTableau(sans as unknown as ReturnType<typeof ficheMaquettes>), {});
    expect(m.styleReference?.tableau).toBeDefined();
  }, 30_000);
});
