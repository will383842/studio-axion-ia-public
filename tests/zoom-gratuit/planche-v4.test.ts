/**
 * C8-Z10a : planche avant/après du zoom gratuit de la v4 (outil local, lancé à la main). Parties pures seulement, aucun FFmpeg lancé.
 * `outils/` est hors du projet tsc : chemin CALCULÉ + type local (PIEGE-REMOTION-TSC.md).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { zoomsPriseV4 } from "../../src/moteurs/montage-facecam-animee/zoom-gratuit-v4";
import { filtreZoomPrise } from "../../studio-rendu/src/composition/zoom-prise";

const RACINE = resolve(__dirname, "../..");
const CHEMIN = ["..", "..", "outils", "zoom-gratuit", "planche-v4.mts"].join("/");
type Fenetre = { debutSec: number; finSec: number; facteur: number };
type Entree = { plan: { elementsV4?: { debut: number; fin: number }[] }; gardes: { debutSec: number; finSec: number }[]; dureeSec: number; largeur: number; hauteur: number };
type Case = { colonne: "avant" | "apres" | "temoin"; instant: string; t: number; fenetre: number | null };
type Module = {
  planExempleV4: () => Entree;
  fenetresPlancheV4: (e: Entree) => Fenetre[];
  casesPlancheV4: (f: Fenetre[], plan?: Entree["plan"]) => Case[];
  maxParMinuteV4: (f: Fenetre[]) => number;
  rapportPlancheV4: (f: Fenetre[], plan: Entree["plan"]) => string[];
  argumentsFfmpegPlancheV4: (e: { t: number; fenetres: Fenetre[]; avec: boolean; largeur: number; hauteur: number; prise?: string; sortie: string }) => string[];
};
const mod = (await import(/* @vite-ignore */ CHEMIN)) as Module;
const ex = mod.planExempleV4();
const fen = mod.fenetresPlancheV4(ex);
const arg = (t: number, avec: boolean, prise?: string) => mod.argumentsFfmpegPlancheV4({ t, fenetres: fen, avec, largeur: 1080, hauteur: 1920, prise, sortie: "x.png" });

describe("a) fenêtres de l'exemple", () => {
  it("au moins 2, hors plaquettes ± 0,3 s, hors début et fin, ≤ 4 par minute, facteur ≤ 1,06", () => {
    expect(fen.length).toBeGreaterThanOrEqual(2);
    for (const f of fen) {
      for (const p of ex.plan.elementsV4 ?? []) expect(f.finSec <= p.debut - 0.3 || f.debutSec >= p.fin + 0.3).toBe(true);
      expect(f.debutSec).toBeGreaterThanOrEqual(0.8);
      expect(f.finSec).toBeLessThanOrEqual(ex.dureeSec - 1);
      expect(f.facteur).toBeLessThanOrEqual(1.06);
    }
    const pic = Math.max(...fen.map((m) => fen.filter((g) => g.debutSec <= m.debutSec && g.debutSec > m.debutSec - 60).length));
    expect(pic).toBeLessThanOrEqual(4);
    expect(mod.maxParMinuteV4(fen)).toBe(pic);
  });
  it("l'exemple : 40 s, 1080 × 1920, 9 gardes, 2 plaquettes", () => {
    expect([ex.dureeSec, ex.largeur, ex.hauteur, ex.gardes.length, ex.plan.elementsV4?.length]).toEqual([40, 1080, 1920, 9, 2]);
  });
});

describe("b) éteint = identique", () => {
  it("zoomsPriseV4 éteint → undefined ; « avant » sans -vf", () => {
    expect(zoomsPriseV4({ actif: false, plan: ex.plan, gardes: ex.gardes, dureeSec: 40, largeur: 1080, hauteur: 1920 })).toBeUndefined();
    const avant = arg(10, false);
    expect(avant).not.toContain("-vf");
    expect(avant).toEqual(arg(10, false));
  });
  it("la case témoin (dans une plaquette) : le filtre « après » vaut 1 à cet instant", () => {
    const tem = mod.casesPlancheV4(fen, ex.plan).filter((c) => c.colonne === "temoin");
    expect(tem).toHaveLength(1);
    const p = ex.plan.elementsV4![0];
    expect(tem[0].t).toBeGreaterThanOrEqual(p.debut);
    expect(tem[0].t).toBeLessThanOrEqual(p.fin);
    const a = arg(tem[0].t, true);
    const filtre = a[a.indexOf("-vf") + 1];
    for (const m of filtre.matchAll(/between\(t,([\d.]+),([\d.]+)\)/g)) expect(tem[0].t < Number(m[1]) || tem[0].t > Number(m[2])).toBe(true);
  });
});

describe("c) cases", () => {
  const cases = mod.casesPlancheV4(fen, ex.plan);
  it("3 × 2 par fenêtre + 1 témoin ; instants croissants dans [0 ; durée]", () => {
    expect(cases).toHaveLength(fen.length * 6 + 1);
    for (let i = 0; i < cases.length; i++) {
      expect(cases[i].t).toBeGreaterThanOrEqual(0);
      expect(cases[i].t).toBeLessThanOrEqual(ex.dureeSec);
      if (i > 0) expect(cases[i].t).toBeGreaterThanOrEqual(cases[i - 1].t);
    }
  });
});

describe("d) arguments FFmpeg", () => {
  it("« après » contient exactement filtreZoomPrise ; mire sans --prise ; pas d'URL", () => {
    const a = arg(5, true);
    expect(a[a.indexOf("-vf") + 1]).toBe(filtreZoomPrise(fen, 1080, 1920));
    expect(a.join(" ")).toContain("testsrc2=size=1080x1920:rate=30");
    expect(a.join(" ")).not.toMatch(/http/);
    expect(arg(5, true, "prise.mp4")).toContain("prise.mp4");
    expect(arg(5, true, "prise.mp4").join(" ")).not.toContain("testsrc2");
  });
  it("rapport en français, une ligne par zoom", () => {
    const r = mod.rapportPlancheV4(fen, ex.plan);
    expect(r.length).toBeGreaterThan(fen.length);
    expect(r[0]).toMatch(/^zoom 1 : .* s, ×1,05 ; plaquette la plus proche à .* s$/);
  });
});

describe("e) gardes statiques", () => {
  it("rien de src/ ni studio-rendu/ n'importe planche-v4 ; l'outil n'importe ni services, ni argent, ni fournisseur", () => {
    const vus: string[] = [];
    const marche = (d: string) => {
      for (const f of readdirSync(d)) {
        if (f === "node_modules" || f.startsWith(".")) continue;
        const p = join(d, f);
        if (statSync(p).isDirectory()) marche(p);
        else if (/\.(tsx?|mts|js)$/.test(f) && readFileSync(p, "utf8").includes("planche-v4")) vus.push(p);
      }
    };
    marche(join(RACINE, "src"));
    marche(join(RACINE, "studio-rendu"));
    expect(vus).toEqual([]);
    const src = readFileSync(join(RACINE, "outils/zoom-gratuit/planche-v4.mts"), "utf8");
    const imports = src.split("\n").filter((l) => /^\s*import\b/.test(l)).join("\n");
    expect(imports).not.toMatch(/@\/services\/|credits|budget|depense|couts|fal|replicate|openai|elevenlabs/i);
    expect(src).toMatch(/import\.meta\.url/);
  });
});

describe("f) déterminisme", () => {
  it("deux appels identiques ; plan d'exemple gelé", () => {
    expect(mod.planExempleV4()).toEqual(mod.planExempleV4());
    expect(mod.casesPlancheV4(fen, ex.plan)).toEqual(mod.casesPlancheV4(fen, ex.plan));
    expect(mod.rapportPlancheV4(fen, ex.plan)).toEqual(mod.rapportPlancheV4(fen, ex.plan));
    expect(Object.isFrozen(mod.planExempleV4())).toBe(true);
  });
});

describe("g) rapport : jamais un dépassement présenté comme normal", () => {
  it("l'exemple (3 zooms en 40 s) : compte glissant ≤ 4, pas de « 4,5 par minute », pas d'alerte", () => {
    const l = mod.rapportPlancheV4(fen, ex.plan).at(-1)!;
    expect(l).toContain(`au plus ${mod.maxParMinuteV4(fen)} dans une même minute (maximum 4)`);
    expect(l).not.toMatch(/par minute/);
    expect(l).not.toContain("ATTENTION");
  });
  it("5 zooms dans une minute : la ligne signale clairement le dépassement", () => {
    const cinq = [0, 1, 2, 3, 4].map((i) => ({ debutSec: 5 + i * 10, finSec: 6 + i * 10, facteur: 1.05 }));
    expect(mod.maxParMinuteV4(cinq)).toBe(5);
    expect(mod.rapportPlancheV4(cinq, {}).at(-1)).toContain("ATTENTION : dépassement");
  });
  it("zooms espacés de plus d'une minute : le compte glissant ne les additionne pas", () => {
    const e = [10, 80, 150].map((d) => ({ debutSec: d, finSec: d + 1, facteur: 1.05 }));
    expect(mod.maxParMinuteV4(e)).toBe(1);
  });
});
