/**
 * TEINTES-PLANCHE-a : planche des teintes sur une vraie prise (outil local). Parties pures + un essai réel avec ffmpeg
 * sur une image de SYNTHÈSE fabriquée dans un dossier temporaire (jamais de photo de personne). `outils/` est hors du
 * projet tsc : chemin CALCULÉ + type local (PIEGE-REMOTION-TSC.md).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LUTS_AXION } from "../../src/donnees/luts-axion";
import { LUTS_AXION_SUPPLEMENTAIRES } from "../../src/donnees/luts-axion-supplementaires";
import { lireCube } from "../../src/lib/lut3d";
import { ecrireCube, melangerAvecIdentite } from "../../src/lib/qc-lut";
import { argumentsFfmpegPlanche, dispositionXstack, estDansLeDepot, grapheDePlanche, lireArgumentsPlanche, teintesDeLaPlanche, texteTuile } from "../../outils/planche-teintes/planche-teintes";

const RACINE = resolve(__dirname, "../..");
const CHEMIN_MTS = ["..", "..", "outils", "planche-teintes", "planche.mts"].join("/");
const AILLEURS = mkdtempSync(join(tmpdir(), "teintes-test-"));
const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;
const tout = () => true;

describe("teintes de la planche", () => {
  it("le témoin + 4 teintes livrées + 3 supplémentaires = 8 tuiles, 7 teintes", () => {
    const t = teintesDeLaPlanche();
    expect(t).toHaveLength(8);
    expect(t[0]).toMatchObject({ nom: "Sans teinte", fichier: null });
    expect(t.slice(1).map((x) => x.fichier)).toEqual([...LUTS_AXION, ...LUTS_AXION_SUPPLEMENTAIRES].map((l) => l.fichier));
    expect(t.slice(1).every((x) => x.intensite > 0 && x.intensite <= 1)).toBe(true);
  });
  it("chaque tuile porte l'intensité par défaut de SA teinte (intensiteParDefaut / 100) ; 0 pour le témoin", () => {
    const t = teintesDeLaPlanche();
    expect(t[0].intensite).toBe(0);
    const luts = [...LUTS_AXION, ...LUTS_AXION_SUPPLEMENTAIRES];
    luts.forEach((l, i) => {
      expect(l.intensiteParDefaut, l.nom).toBeLessThanOrEqual(100);
      expect(t[i + 1].nom).toBe(l.nom);
      expect(t[i + 1].intensite, l.nom).toBe(l.intensiteParDefaut / 100);
    });
  });
  it("chaque fichier de teinte existe dans public/luts", () => {
    for (const t of teintesDeLaPlanche().slice(1)) expect(existsSync(join(RACINE, "public/luts", t.fichier as string))).toBe(true);
  });
});

describe("commande ffmpeg", () => {
  const police = "/x/Manrope-SemiBold.ttf";
  const graphe = grapheDePlanche(teintesDeLaPlanche(), 480, police);
  it("lut3d tétraédrique comme le rendu final, une fois par teinte (7), pas pour le témoin", () => {
    expect(graphe.match(/lut3d=file=teinte-\d+\.cube:interp=tetrahedral/g)).toHaveLength(7);
    expect(graphe).toContain("xstack=inputs=8");
    expect(graphe).toContain("Sans teinte");
    for (const l of [...LUTS_AXION, ...LUTS_AXION_SUPPLEMENTAIRES]) expect(graphe).toContain(texteTuile(l.nom));
  });
  it("la disposition 4 × 2", () => {
    expect(dispositionXstack(8, 4)).toBe("0_0|w0_0|w0+w0_0|w0+w0+w0_0|0_h0|w0_h0|w0+w0_h0|w0+w0+w0_h0");
  });
  it("une seule image en sortie", () => {
    const a = argumentsFfmpegPlanche("/a.jpg", "/b.jpg", teintesDeLaPlanche(), police);
    expect(a).toContain("-frames:v");
    expect(a[a.length - 1]).toBe("/b.jpg");
  });
  it("le texte d'une tuile ne laisse passer ni apostrophe ni deux-points ni pourcent", () => {
    expect(texteTuile("A'b:c%d (v1)")).toBe("Abcd (v1)");
  });
});

describe("refus des arguments", () => {
  it("--image manquant ou sans valeur", () => {
    expect(lireArgumentsPlanche(["--sortie", "/tmp/o.jpg"], RACINE, tout).ok).toBe(false);
    expect(lireArgumentsPlanche(["--image", "--sortie", "/tmp/o.jpg"], RACINE, tout).ok).toBe(false);
  });
  it("--sortie manquant", () => {
    expect(lireArgumentsPlanche(["--image", "/tmp/i.jpg"], RACINE, tout).ok).toBe(false);
  });
  it("image inexistante", () => {
    const r = lireArgumentsPlanche(["--image", "/tmp/i.jpg", "--sortie", "/tmp/o.jpg"], RACINE, () => false);
    expect(r).toMatchObject({ ok: false });
    expect((r as { erreur: string }).erreur).toMatch(/introuvable/);
  });
  it("image DANS le dépôt : refus", () => {
    const r = lireArgumentsPlanche(["--image", join(RACINE, "public/demo/lut/avant.jpg"), "--sortie", "/tmp/o.jpg"], RACINE, tout);
    expect((r as { erreur: string }).erreur).toMatch(/image source est DANS le dépôt/);
  });
  it("sortie DANS le dépôt : refus (y compris par ..)", () => {
    expect(lireArgumentsPlanche(["--image", "/tmp/i.jpg", "--sortie", join(RACINE, "planche.jpg")], RACINE, tout).ok).toBe(false);
    expect(lireArgumentsPlanche(["--image", "/tmp/i.jpg", "--sortie", join(RACINE, "tests/../../planche-teintes-dehors.jpg")], RACINE, tout).ok).toBe(true);
  });
  it("image et sortie hors dépôt : accepté", () => {
    expect(lireArgumentsPlanche(["--image", "/tmp/i.jpg", "--sortie", "/tmp/o.jpg"], RACINE, tout)).toEqual({ ok: true, image: "/tmp/i.jpg", sortie: "/tmp/o.jpg" });
  });
  it("estDansLeDepot : la racine, un sous-dossier, un voisin au nom proche", () => {
    expect(estDansLeDepot(RACINE, RACINE)).toBe(true);
    expect(estDansLeDepot(join(RACINE, "a/b"), RACINE)).toBe(true);
    expect(estDansLeDepot(RACINE + "-autre/x", RACINE)).toBe(false);
  });
});

describe("isolement", () => {
  it("aucun fichier de src/ ni de studio-rendu/ n'importe l'outil", () => {
    const vus: string[] = [];
    const marche = (d: string) => {
      for (const f of readdirSync(d)) {
        if (f === "node_modules" || f.startsWith(".")) continue;
        const p = join(d, f);
        if (statSync(p).isDirectory()) marche(p);
        else if (/\.(tsx?|mts|js|mjs)$/.test(f) && readFileSync(p, "utf8").includes("planche-teintes")) vus.push(p);
      }
    };
    marche(join(RACINE, "src"));
    marche(join(RACINE, "studio-rendu"));
    expect(vus).toEqual([]);
  });
});

describe.skipIf(!ffmpegPresent)("essai réel (image de synthèse, ffmpeg)", () => {
  it("donne une planche non vide, hors dépôt", async () => {
    const image = join(AILLEURS, "prise-synthese.png");
    execFileSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=1", "-frames:v", "1", image]);
    const sortie = join(AILLEURS, "planche.jpg");
    const mod = (await import(/* @vite-ignore */ CHEMIN_MTS)) as { fabriquerPlanche: (i: string, s: string) => void };
    mod.fabriquerPlanche(image, sortie);
    expect(statSync(sortie).size).toBeGreaterThan(5000);
    expect(readdirSync(AILLEURS).filter((f) => f.endsWith(".cube"))).toEqual([]);
    rmSync(AILLEURS, { recursive: true, force: true });
  }, 60_000);
});

describe.skipIf(!ffmpegPresent)("mélange à l'intensité par défaut (essai réel, couleur moyenne de chaque tuile)", () => {
  /** Couleur moyenne (R, G, B) de la sortie d'une chaîne de filtres appliquée à `entree`. */
  const moyenne = (entree: string, filtres: string, cwd?: string): number[] => [...execFileSync("ffmpeg", ["-hide_banner", "-v", "error", "-i", entree, "-vf", `${filtres},scale=1:1:flags=area,format=rgb24`, "-frames:v", "1", "-f", "rawvideo", "-"], { cwd })];
  it("la tuile de chaque teinte à moins de 100 % est plus proche du rendu mélangé que de la LUT pleine", async () => {
    const dossier = mkdtempSync(join(tmpdir(), "teintes-melange-"));
    try {
      const image = join(dossier, "prise-synthese.png");
      execFileSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=1", "-frames:v", "1", image]);
      const planche = join(dossier, "planche.jpg");
      const mod = (await import(/* @vite-ignore */ CHEMIN_MTS)) as { fabriquerPlanche: (i: string, s: string) => void };
      mod.fabriquerPlanche(image, planche);
      const teintes = teintesDeLaPlanche();
      let verifiees = 0;
      teintes.forEach((t, i) => {
        if (!t.fichier || t.intensite >= 1) return;
        const lut = lireCube(readFileSync(join(RACINE, "public/luts", t.fichier), "utf8"));
        writeFileSync(join(dossier, "melange.cube"), ecrireCube(melangerAvecIdentite(lut, t.intensite)));
        writeFileSync(join(dossier, "pleine.cube"), ecrireCube(lut));
        const tuile = moyenne(planche, `crop=480:200:${(i % 4) * 480}:${Math.floor(i / 4) * 270}`);
        const reference = (cube: string) => moyenne(image, `scale=480:-2,format=gbrp,lut3d=file=${cube}:interp=tetrahedral,format=rgb24,crop=480:200:0:0`, dossier);
        const dist = (a: number[], b: number[]) => Math.hypot(...a.map((v, k) => v - b[k]));
        const mixte = reference("melange.cube");
        const pleine = reference("pleine.cube");
        expect(dist(mixte, pleine), `${t.nom} : le mélange doit se voir`).toBeGreaterThan(2);
        expect(dist(tuile, mixte), t.nom).toBeLessThan(dist(tuile, pleine));
        verifiees++;
      });
      expect(verifiees).toBeGreaterThan(0);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  }, 120_000);
});
