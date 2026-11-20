/**
 * R4-03-b3 : la liste des « téléphones qui jouent un extrait » d'une version gardée, lisible par Will. Pur ; rien ne l'importe.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ElementV4Plan, PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { lireProjetGardeV4 } from "@/moteurs/montage-facecam-animee/retouche-gratuite";
import { libelleTelephoneV4, telephonesRetouchablesV4, type TelephoneRetouchableV4 } from "@/moteurs/montage-facecam-animee/telephones-retouche-v4";

const RACINE = join(__dirname, "..", "..");
const PLAN_BASE = JSON.parse(readFileSync(join(RACINE, "docs/facecam-animee-v4/repetition-generale/plan-realisateur.json"), "utf8")) as PlanFacecamAnimee;
const CLE = "extrait:archive-extraits-v-a:p1";
const ELEMENTS: ElementV4Plan[] = [
  { id: "CarteCalendrier", debut: 1, fin: 3, mots: ["A"], instants: [1.5, 2.5] },
  { id: "telephone-video", debut: 12.4, fin: 15.4, recherches: ["axion:devis client"], medias: ["broll/v4-1-0.mp4"] },
  { id: "telephone-video", debut: 20, fin: 23.25, recherches: ["devis signature"], medias: ["broll/v4-2-0.mp4"] },
];
const brut = (elementsV4: ElementV4Plan[] | undefined, choix: unknown[] = [
  { fichier: "v4-1-0.mp4", source: "archive-axion", id: CLE, scene: "axion:devis client" },
  { fichier: "v4-2-0.mp4", source: "pexels", id: "px1", scene: "devis signature" },
]) => ({
  priseCle: "k.mov", plan: { ...PLAN_BASE, elementsV4 }, gardes: [{ debutSec: 0, finSec: 30 }], videos: { fichiers: [], choix },
});
const projet = (e?: ElementV4Plan[]) => lireProjetGardeV4(brut(e))!;

describe("R4-03-b3 : téléphones retouchables", () => {
  it("(a) 2 lignes (rangs 1 et 2) : archive ou banque", () => {
    const l = telephonesRetouchablesV4(projet(ELEMENTS));
    expect(l.map((t) => t.rang)).toEqual([1, 2]);
    expect(l[0]).toEqual({ rang: 1, debut: 12.4, fin: 15.4, dureeSec: 3, recherche: "devis client", depuisArchive: true, fichier: "v4-1-0.mp4", extraitCle: CLE });
    expect(l[1]).toMatchObject({ rang: 2, depuisArchive: false, recherche: "devis signature", fichier: "v4-2-0.mp4", extraitCle: null });
  });

  it("(b) téléphone sans medias : fichier et extraitCle nuls", () => {
    const sans: ElementV4Plan[] = [{ id: "telephone-video", debut: 5, fin: 8, recherches: ["axion:devis"] }];
    expect(telephonesRetouchablesV4(projet(sans))[0]).toMatchObject({ fichier: null, extraitCle: null, depuisArchive: true });
  });

  it("(c) libellé : virgule française, guillemets français ; sans recherche, rien après la durée", () => {
    const [t] = telephonesRetouchablesV4(projet(ELEMENTS));
    expect(libelleTelephoneV4(t)).toBe("Téléphone à 12,4 s (3,0 s) : « devis client »");
    expect(libelleTelephoneV4({ ...t, recherche: null })).toBe("Téléphone à 12,4 s (3,0 s)");
  });

  it("(d) éteint = identique : null, plan sans elementsV4 → [] ; le projet n'est pas muté", () => {
    expect(telephonesRetouchablesV4(null)).toEqual([]);
    expect(telephonesRetouchablesV4(projet(undefined))).toEqual([]);
    expect(telephonesRetouchablesV4(projet([]))).toEqual([]);
    const p = projet(ELEMENTS);
    const avant = structuredClone(p);
    telephonesRetouchablesV4(p);
    expect(p).toEqual(avant);
    // entrée malformée : ne lève jamais
    expect(telephonesRetouchablesV4({ plan: { elementsV4: [null, 3] } } as never)).toEqual([]);
  });

  it("(e) gardes statiques : pur, aucun service ni argent ni horloge, et rien dans src/** ne l'importe", () => {
    const fichier = "src/moteurs/montage-facecam-animee/telephones-retouche-v4.ts";
    const src = readFileSync(join(RACINE, fichier), "utf8");
    expect(src).not.toMatch(/@\/services\//);
    expect(src).not.toMatch(/lireParametre|credits|budget|depense|plafond/);
    expect(src).not.toMatch(/\bDate\b/);
    const parcourir = (d: string): string[] => readdirSync(d).flatMap((n) => {
      const p = join(d, n);
      return statSync(p).isDirectory() ? parcourir(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
    const importeurs = parcourir(join(RACINE, "src")).filter((f) => !f.endsWith("telephones-retouche-v4.ts") && /telephones-retouche-v4/.test(readFileSync(f, "utf8")));
    expect(importeurs.map((f) => f.slice(RACINE.length + 1).split("\\").join("/"))).toEqual(["src/services/changer-extrait-v4-ecran.ts"]);
  });

  it("type : TelephoneRetouchableV4 est exporté", () => {
    const t: TelephoneRetouchableV4 = { rang: 0, debut: 0, fin: 1, dureeSec: 1, recherche: null, depuisArchive: false, fichier: null, extraitCle: null };
    expect(libelleTelephoneV4(t)).toBe("Téléphone à 0,0 s (1,0 s)");
  });
});
