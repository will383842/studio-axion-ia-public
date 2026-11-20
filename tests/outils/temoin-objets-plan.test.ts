/** C9-41-a-v19c : témoin « sans / avec réglage » des petits objets (outil local). Aucun appel, rien n'est allumé. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { adapterPlan } from "../../src/briques/plan-scenes-generateurs/adaptateur";
import { segmenterEnPhrases } from "../../src/briques/plan-scenes-generateurs/video";
import { FORMAT_PLAN_CAS_CONCRET } from "../../src/moteurs/montage-cas-concret/plan-scenes";
import { motsDuTexte, OBJETS_TEMOIN, pageTemoin, SCRIPTS_TEMOIN, temoinObjets } from "../../outils/temoin-objets-plan/temoin";

const RACINE = join(__dirname, "..", "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const estObjet = (p: string) => p.startsWith("objet-");

describe("(a) trois entrées", () => {
  it("temoinObjets rend 3 entrées", async () => {
    const t = await temoinObjets();
    expect(t).toHaveLength(3);
    expect(t.map((e) => e.texte)).toEqual([...SCRIPTS_TEMOIN]);
  });
});

describe("(b) sans réglage = identique à aujourd'hui", () => {
  it("sans objets, le plan est celui de adapterPlan appelé sans objetsPermis, et sans aucun objet", async () => {
    const t = await temoinObjets();
    for (const e of t) {
      const mots = motsDuTexte(e.texte);
      const direct = await adapterPlan({ generateur: "cas-concret", script: e.texte, segments: segmenterEnPhrases(mots), format: FORMAT_PLAN_CAS_CONCRET, facecam: false });
      expect(e.sans).toEqual(direct.plan);
      expect((e.sans?.scenes ?? []).some((s) => estObjet(s.piece))).toBe(false);
    }
  });
});

describe("(c) avec réglage, des objets visibles", () => {
  it("au moins 2 scripts sur 3 ont un objet ; gros chiffre = nombre dit ; aucun chevauchement", async () => {
    const t = await temoinObjets();
    const avecObjet = t.filter((e) => e.avec?.scenes.some((s) => estObjet(s.piece)));
    expect(avecObjet.length).toBeGreaterThanOrEqual(2);
    for (const e of t) {
      const scenes = e.avec?.scenes ?? [];
      for (const s of scenes) {
        if (s.piece !== "objet-gros-chiffre") continue;
        const dits = e.texte.match(/\d+/g)!.map(Number);
        expect(dits).toContain((s.parametres as { valeur: number }).valeur);
      }
      const tri = [...scenes].sort((a, b) => a.debutMs - b.debutMs);
      tri.slice(1).forEach((s, i) => expect(s.debutMs).toBeGreaterThanOrEqual(tri[i]!.finMs));
      for (const s of scenes) if (estObjet(s.piece)) expect(OBJETS_TEMOIN as readonly string[]).toContain(s.piece);
    }
  });
});

describe("(d) la page", () => {
  it("3 sections, un data-piece par scène objet, ni image ni http, déterministe", async () => {
    const t = await temoinObjets();
    const page = pageTemoin(t);
    expect(page.match(/<section>/g)).toHaveLength(3);
    const nbObjets = t.reduce((n, e) => n + (e.avec?.scenes.filter((s) => estObjet(s.piece)).length ?? 0), 0);
    expect(nbObjets).toBeGreaterThan(0);
    expect(page.match(/data-piece="objet-/g)).toHaveLength(nbObjets);
    expect(page).not.toContain("<img");
    expect(page).not.toContain("http");
    expect(page).toContain("<title>Témoin petits objets — cas concret</title>");
    expect(pageTemoin(await temoinObjets())).toBe(page);
  });
});

function fichiers(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier)).flatMap((n) => {
    const rel = `${dossier}/${n}`;
    if (n === "node_modules" || n.startsWith(".")) return [];
    return statSync(join(RACINE, rel)).isDirectory() ? fichiers(rel) : /\.(ts|tsx|mts)$/.test(n) ? [rel] : [];
  });
}

describe("(e) éteint : rien ne l'importe, aucun appel", () => {
  it("aucun fichier de src ni de studio-rendu n'importe l'outil", () => {
    for (const f of [...fichiers("src"), ...fichiers("studio-rendu")]) expect(lire(f), f).not.toMatch(/temoin-objets-plan/);
  });
  it("l'outil n'appelle ni fetch ni fournisseur", () => {
    for (const f of ["outils/temoin-objets-plan/temoin.ts", "outils/temoin-objets-plan/lancer.mts"]) {
      const t = lire(f);
      expect(t).not.toMatch(/\bfetch\s*\(/);
      expect(t).not.toMatch(/fournisseurs\//);
      expect(t).not.toMatch(/\bappeler\b\s*[:=(]/);
    }
  });
});
