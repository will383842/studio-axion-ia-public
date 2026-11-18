/**
 * BR-OBJETS-c — 6 petits objets de plus inscrits au plan de scènes, PORTE FERMÉE.
 * (a) par la vraie fonction `adapterPlan` avec `objetsPermis` : les scènes objet-croix et objet-compteur-rouleau sont gardées ;
 * (b) sans `objetsPermis` : consigne identique, aucune scène objet- ; (c) capacités connues du profil du cas concret ;
 * (d) rendu par instants (0 %, 50 %, 100 %). Aucun appel réel : Claude est simulé.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { adapterPlan } from "@/briques/plan-scenes-generateurs/adaptateur";
import { BRIQUES_OBJETS, OBJETS_PLAN_SCENES, RENDUS_OBJETS } from "@/briques/plan-scenes/briques/objets-inscrits";
import { TOILES } from "@/briques/plan-scenes/toiles";
import { PROFILS_DU_CODE } from "@/briques/bibliotheque-video/profils";
import { consignePlan } from "@/briques/plan-scenes/generateur";
import type { RequeteClaude } from "@/fournisseurs/claude/client";

const IDS = ["objet-soulignement-droit", "objet-croix", "objet-mot-barre", "objet-compteur-rouleau", "objet-carton-definition", "objet-fleche-main-levee"] as const;
const SEGMENTS = [{ texte: "ce n'est pas faux ni 12 heures", debutMs: 0, finMs: 3000 }];
const FORMAT = { largeur: 1080, hauteur: 1920, fps: 25 as const };
const base = { generateur: "cas-concret" as never, script: "ce n'est pas faux ni 12 heures", segments: SEGMENTS, format: FORMAT, facecam: false };

function claudeSimule(vus: RequeteClaude[]) {
  const scene = (id: string, premier: number, dernier: number, debutMs: number, finMs: number, piece: string, parametres: unknown) => ({
    id, version: 1, mots: { premier, dernier }, debutMs, finMs, niveau: 1, position: "centre", transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 }, piece, parametres,
  });
  const plan = {
    version: "1", format: FORMAT, dureeMs: 3000,
    scenes: [
      scene("a", 3, 3, 1000, 1800, "objet-croix", { boite: { x: 20, y: 30, largeur: 40, hauteur: 25 } }),
      scene("b", 5, 5, 2000, 2900, "objet-compteur-rouleau", { valeur: 12 }),
    ],
  };
  return async (r: RequeteClaude) => {
    vus.push(r);
    return { texte: JSON.stringify(plan) } as never;
  };
}

describe("(a) permis : les nouveaux objets sont gardés par adapterPlan", () => {
  it("objet-croix et objet-compteur-rouleau (12) restent dans le plan", async () => {
    const vus: RequeteClaude[] = [];
    const r = await adapterPlan({ ...base, objetsPermis: [...IDS] }, { appeler: claudeSimule(vus) });
    const pieces = (r.plan?.scenes ?? []).map((s) => s.piece);
    expect(pieces).toContain("objet-croix");
    expect(pieces).toContain("objet-compteur-rouleau");
  });
});

describe("(b) éteint = identique", () => {
  it("sans objetsPermis : aucune scène objet-, consigne identique à celle d'avant (empreinte)", async () => {
    const vus: RequeteClaude[] = [];
    const r = await adapterPlan(base, { appeler: claudeSimule(vus) });
    expect((r.plan?.scenes ?? []).some((s) => s.piece.startsWith("objet-"))).toBe(false);
    expect(JSON.stringify(vus[0])).not.toContain("objet-");
    expect(consignePlan()).not.toContain("objet-");
    const vus2: RequeteClaude[] = [];
    await adapterPlan({ ...base, objetsPermis: [] }, { appeler: claudeSimule(vus2) });
    expect(JSON.stringify(vus2[0])).toBe(JSON.stringify(vus[0]));
  });
});

describe("(b bis) objetsPermis absent : requête et plan identiques (toEqual)", () => {
  it("clé absente = clé undefined : même requête envoyée à Claude, même résultat", async () => {
    const v1: RequeteClaude[] = [];
    const v2: RequeteClaude[] = [];
    const r1 = await adapterPlan(base, { appeler: claudeSimule(v1) });
    const r2 = await adapterPlan({ ...base, objetsPermis: undefined }, { appeler: claudeSimule(v2) });
    expect(v2).toEqual(v1);
    expect(r2).toEqual(r1);
  });
});

describe("(c) inscription et capacités", () => {
  it("6 objets de plus, toiles écrites en dur identiques aux définitions, capacité connue du profil du cas concret", () => {
    const profil = JSON.stringify(PROFILS_DU_CODE["cas-concret"]);
    for (const id of IDS) {
      const def = OBJETS_PLAN_SCENES.find((d) => d.id === id);
      expect(def, id).toBeDefined();
      expect(BRIQUES_OBJETS[id as keyof typeof BRIQUES_OBJETS].id).toBe(id);
      expect(RENDUS_OBJETS[id as keyof typeof RENDUS_OBJETS]).toBeTypeOf("function");
      expect(TOILES[id as keyof typeof TOILES]).toEqual(def!.toile);
      expect(profil).toContain(`"${def!.capacite}"`);
    }
  });
});

describe("(d) rendu par instants", () => {
  const exemples: Record<string, unknown> = {
    "objet-croix": { boite: { x: 20, y: 30, largeur: 40, hauteur: 25 } },
    "objet-compteur-rouleau": { valeur: 12 },
  };
  it.each(Object.keys(exemples))("%s : 3 sorties différentes à 0 %%, 50 %%, 100 %%", (id) => {
    const Rendu = RENDUS_OBJETS[id as keyof typeof RENDUS_OBJETS] as unknown as (p: unknown) => never;
    const dureeImages = 50;
    const sorties = [0, 25, 50].map((image) => renderToStaticMarkup(createElement(Rendu as never, { image, fps: 25, dureeImages, fond: "noir", parametres: exemples[id], graine: 7 })));
    expect(new Set(sorties).size).toBe(3);
    const toile = TOILES[id as keyof typeof TOILES];
    for (const s of sorties) expect(s).toContain(`viewBox="0 0 ${toile.largeur} ${toile.hauteur}"`);
  });
});
