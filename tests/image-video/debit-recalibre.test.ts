/**
 * Débit recalibré le 18/10/2026 à 3,4 mots/s (et plus 2,75), mesuré sur les pistes de deux vraies voix à tempo ×1,08 ; 24/10/2026 : 3,3 (3,4 × 1,05 / 1,08) depuis le tempo ×1,05. Tout ce qui en
 * dépend suit la constante : mots de chaque classe (durée × débit), jugement du script (Q10), prix affiché au dépôt.
 * Aucun appel, aucun réseau : cartes figées, fiches simulées, services purs.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import { BORNES_CLASSE, CLASSES, complexiteDe, DEBIT_MOTS_PAR_SEC, TOLERANCE_SCRIPT } from "@/domaine/image-video/complexite";
import { motsDits, texteDuCorps, type FicheImage } from "@/domaine/image-video/fiche";
import { formatImageVideo } from "@/formats/image-video";
import { ficheSimulee } from "@/moteurs/montage-image-video/ecriture.simulation";
import { verifierScript } from "@/moteurs/montage-image-video/regles";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const ecran = await import("@/services/image-video-ecran");

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const lire = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const faux = lire("faux-16-noeuds");
const ficheFaux = ficheSimulee("essai-faux16")!;

/** Fiche du faux schéma dont le corps dit EXACTEMENT `n` mots (premier écran complété de mots neutres). */
function ficheDeMots(n: number): FicheImage {
  const f = structuredClone(ficheFaux);
  const gardes: FicheImage["ecrans"] = [];
  let somme = 0;
  for (const e of f.ecrans.slice(1)) {
    const m = motsDits(e.texteDit).length;
    if (somme + m > n - 1) break;
    gardes.push(e);
    somme += m;
  }
  f.ecrans = [{ ...f.ecrans[0]!, texteDit: Array.from({ length: n - somme }, () => "mot").join(" ") }, ...gardes];
  expect(motsDits(texteDuCorps(f))).toHaveLength(n);
  return f;
}

const q10 = (f: FicheImage) => verifierScript(f, { carte: faux }).manquements.filter((m) => m.regle === "Q10");

describe("débit de référence : 3,3 mots par seconde", () => {
  it("la constante vaut 3,3", () => {
    expect(DEBIT_MOTS_PAR_SEC).toBe(3.3);
  });

  it("les mots de chaque classe sont la durée visée × le débit, arrondis (aucun nombre en dur)", () => {
    for (const c of CLASSES) {
      const { corpsSec, mots } = BORNES_CLASSE[c];
      expect(mots).toEqual([Math.round(corpsSec[0] * DEBIT_MOTS_PAR_SEC), Math.round(corpsSec[1] * DEBIT_MOTS_PAR_SEC)]);
    }
    expect(BORNES_CLASSE.simple.mots).toEqual([99, 132]);
    expect(BORNES_CLASSE.moyenne.mots).toEqual([132, 165]);
    expect(BORNES_CLASSE.branches.mots).toEqual([158, 185]);
    expect(BORNES_CLASSE["tres-complexe"].mots).toEqual([198, 257]);
  });

  it("la complexité d'une carte rend les mots de sa classe, calculés depuis la durée", () => {
    for (const nom of ["A", "B", "C", "D", "E", "F", "faux-16-noeuds"]) {
      const c = complexiteDe(lire(nom));
      expect(c.motsCorps).toEqual([Math.round(c.fourchetteSec[0] * DEBIT_MOTS_PAR_SEC), Math.round(c.fourchetteSec[1] * DEBIT_MOTS_PAR_SEC)]);
    }
  });
});

describe("Q10 au débit de 3,3 mots/s (image très complexe : 60 à 78 s)", () => {
  it("le faux schéma est bien très complexe", () => {
    expect(complexiteDe(faux).classe).toBe("tres-complexe");
  });

  it("173 mots (≈ 51 s) : Q10 refuse, trop court (le cas de la vidéo de Will)", () => {
    const m = q10(ficheDeMots(173));
    expect(m).toHaveLength(1);
    expect(m[0]!.message).toMatch(/trop court/);
  });

  it("198 mots (60 s) passent, comme le bas de la fourchette du prompt", () => {
    expect(q10(ficheDeMots(198))).toEqual([]);
  });

  it("le seuil bas de Q10 reste à 90 % de 60 s : 179 mots passent, 178 refusent", () => {
    expect(q10(ficheDeMots(179))).toEqual([]);
    expect(q10(ficheDeMots(178))).toHaveLength(1);
  });
});

describe("débit mesuré sur les voix réelles", () => {
  it("173 mots en 49,22 s et 186 mots en 56,93 s tombent à ±10 % de la constante", () => {
    for (const [mots, sec] of [[173, 49.22], [186, 56.93]] as const) {
      const debit = mots / sec;
      expect(debit).toBeGreaterThanOrEqual(DEBIT_MOTS_PAR_SEC * (1 - TOLERANCE_SCRIPT));
      expect(debit).toBeLessThanOrEqual(DEBIT_MOTS_PAR_SEC * (1 + TOLERANCE_SCRIPT));
    }
  });
});

describe("prix affiché au dépôt (la voix au pire suit le débit)", () => {
  it("deux réseaux (YouTube Shorts et LinkedIn) : 5,27 €", () => {
    expect(ecran.prixDuDepot(["youtube-shorts", "linkedin"])).toBe(527);
  });

  it("le format déclare le même débit (écrans génériques d'écriture)", () => {
    expect(formatImageVideo.recetteScript.motsParSeconde).toBe(DEBIT_MOTS_PAR_SEC);
  });
});
