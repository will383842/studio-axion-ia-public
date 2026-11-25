/** C11-T6b-b : les deux composants des titres de couverture. Montés nulle part, sans fond flouté. */
import React from "react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
// `polices.ts` importe « remotion », absent hors studio-rendu : doublure minimale (aucune police chargée en rendu serveur).
vi.mock("remotion", () => ({ delayRender: () => 0, continueRender: () => undefined, cancelRender: () => undefined }));
import { PALETTE } from "@/briques/charte/axion-2026";
import { ZONE_VISAGE, seChevauchent } from "@/briques/plan-scenes/zones";
import { ETAPE_ECHELLE_DEPART, RATIOS_COUVERTURE, ENTREE_S, TENUE_S, SORTIE_S } from "@/briques/motion/titres-couverture/etapes";

type RatioC = (typeof RATIOS_COUVERTURE)[number];
type Etape = React.FC<{ numero: number; libelle: string; debutImage: number; ips: number; image: number; couleurTexte?: string; couleurFond?: string }>;
type Pastille = React.FC<{ texte: string; ratio: RatioC; couleurTexte?: string; couleurFond?: string }>;
let EtapeMontante: Etape, PastilleContexte: Pastille;
beforeAll(async () => {
  const base = ["..", "..", "..", "studio-rendu", "compositions", "commune", "titres-couverture"].join("/");
  EtapeMontante = ((await import(/* @vite-ignore */ `${base}/EtapeMontante`)) as { EtapeMontante: Etape }).EtapeMontante;
  PastilleContexte = ((await import(/* @vite-ignore */ `${base}/PastilleContexte`)) as { PastilleContexte: Pastille }).PastilleContexte;
});

const IPS = 30;
const DEBUT = 10;
const etape = (image: number, numero = 3, libelle = "Le bon réflexe") =>
  renderToStaticMarkup(<EtapeMontante numero={numero} libelle={libelle} debutImage={DEBUT} ips={IPS} image={image} />);
const pastille = (ratio: RatioC = "9:16", texte = "Cas concret") => renderToStaticMarkup(<PastilleContexte texte={texte} ratio={ratio} />);
const pct = (html: string, prop: string): number => {
  const m = html.match(new RegExp(`${prop}:(-?[\\d.]+)%`));
  if (!m) throw new Error(`${prop} absent`);
  return Number(m[1]);
};
const opacite = (html: string): number => Number(html.match(/opacity:([\d.]+)/)![1]);
const finEntree = DEBUT + Math.round(ENTREE_S * IPS);
const debutSortie = finEntree + Math.round(TENUE_S * IPS);
const fin = debutSortie + Math.round(SORTIE_S * IPS);

describe("EtapeMontante", () => {
  it("avant le début et après la sortie : balisage vide", () => {
    expect(etape(DEBUT - 1)).toBe("");
    expect(etape(fin + 1)).toBe("");
  });
  it("montée : contient « Étape 3 » et le libellé tel quel, haut ≤ 33 %", () => {
    const h = etape(finEntree + 2, 3, "Le bon réflexe");
    expect(h).toContain("Étape 3");
    expect(h).toContain("Le bon réflexe");
    expect(pct(h, "top")).toBeLessThanOrEqual(33);
  });
  it("même image = même balisage ; opacité croissante pendant l'entrée", () => {
    expect(etape(finEntree)).toBe(etape(finEntree));
    const ops = [DEBUT + 1, DEBUT + 3, DEBUT + 5, DEBUT + 7].map((i) => opacite(etape(i)));
    for (let i = 1; i < ops.length; i++) expect(ops[i]).toBeGreaterThan(ops[i - 1]);
    expect(ETAPE_ECHELLE_DEPART).toBeLessThan(1);
  });
  it("jamais devant le visage, à toutes les images de sa vie", () => {
    for (let i = DEBUT; i <= fin; i++) {
      const h = etape(i);
      if (h === "") continue;
      const rect = { x: pct(h, "left"), y: pct(h, "top"), largeur: pct(h, "width"), hauteur: pct(h, "height") };
      expect(seChevauchent(rect, ZONE_VISAGE)).toBe(false);
    }
  });
  it("entrées invalides : le rendu lève (numéro 10, 6 mots)", () => {
    expect(() => etape(finEntree, 10)).toThrow(/Numéro d'étape invalide/);
    expect(() => etape(finEntree, 3, "un deux trois quatre cinq six")).toThrow(/Libellé d'étape invalide/);
  });
});

describe("PastilleContexte", () => {
  it("contient le texte, une seule ligne", () => {
    const h = pastille();
    expect(h).toContain("Cas concret");
    expect(h).toContain("white-space:nowrap");
  });
  it.each(RATIOS_COUVERTURE)("ratio %s : jamais devant le visage", (ratio) => {
    const h = pastille(ratio);
    const rect = { x: pct(h, "left"), y: pct(h, "top"), largeur: pct(h, "width"), hauteur: pct(h, "height") };
    expect(seChevauchent(rect, ZONE_VISAGE)).toBe(false);
  });
  it("29 caractères et ratio inconnu : le rendu lève", () => {
    expect(() => pastille("9:16", "a".repeat(29))).toThrow(/Texte de pastille invalide/);
    expect(() => pastille("2:1" as RatioC)).toThrow(/Ratio inconnu/);
  });
});

describe("police, couleurs, filtres", () => {
  const sorties = () => [etape(finEntree), pastille()];
  it("Axion Manrope seule, aucun filter ni blur", () => {
    for (const h of sorties()) {
      expect(h).toContain("Axion Manrope");
      const familles = [...h.replaceAll("&quot;", '"').matchAll(/font-family:([^;]*)/g)].flatMap((m) => m[1].split(",").map((f) => f.replace(/"/g, "").trim()));
      expect(familles.every((f) => ["Axion Manrope", "Manrope", "sans-serif"].includes(f))).toBe(true);
      expect(h).not.toMatch(/filter|blur/);
    }
  });
  it("aucune couleur hors PALETTE par défaut", () => {
    const permises = new Set(Object.values(PALETTE).map((c) => String(c).toLowerCase()));
    for (const h of sorties()) for (const c of h.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) expect(permises.has(c.toLowerCase())).toBe(true);
  });
});

describe("gardes statiques", () => {
  const racine = process.cwd();
  const sources = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
      const p = join(d, n);
      if (n === "node_modules") return [];
      return statSync(p).isDirectory() ? sources(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
  const dossier = join(racine, "studio-rendu/compositions/commune/titres-couverture");
  const siens = ["EtapeMontante.tsx", "PastilleContexte.tsx"].map((n) => join(dossier, n));
  // ÉLARGISSEMENT DU PILOTE n° 2 (C11-C2-a-v20k) : ces deux fichiers DÉCLARENT un identifiant de catalogue, ils n'importent aucun composant.
  const declarations = ["src/briques/bibliotheque-video/noms.ts", "src/briques/bibliotheque-video/catalogue/couverture.ts"].map((c) => join(racine, c));
  it("rien n'importe les composants", () => {
    const tous = ["src", "studio-rendu/src", "studio-rendu/compositions"].flatMap((d) => sources(join(racine, d)));
    for (const f of tous.filter((f) => !siens.includes(f) && !declarations.includes(f) && !f.endsWith("composants.test.tsx"))) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/EtapeMontante|PastilleContexte/);
    }
  });
  it("les deux fichiers de déclaration du catalogue n'importent rien de titres-couverture", () => {
    for (const f of declarations) {
      // Texte entier : couvre import multi-ligne, import() dynamique et ré-export.
      expect(readFileSync(f, "utf8"), f).not.toMatch(/titres-couverture/);
    }
  });
  it("aucun service, fournisseur ni useCurrentFrame", () => {
    for (const f of siens) {
      const s = readFileSync(f, "utf8");
      expect(s).not.toMatch(/@\/services|@\/fournisseurs|useCurrentFrame/);
    }
  });
});
