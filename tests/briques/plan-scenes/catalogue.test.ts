import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CATALOGUE_BRIQUES, IDS_PIECES } from "@/briques/plan-scenes/catalogue";
import { RENDUS_BRIQUES } from "@/briques/plan-scenes/briques";
import { CHARTE_AXION, POLICE_AXION, FPS_AXION, adoucir } from "@/briques/jetons-motion";

const ATTENDUES = ["curseur", "zoom-camera", "frappe-clavier", "carte-kpi", "graphique", "tableau-de-bord", "liste-crm", "fenetre-app", "bulle-chat", "legende", "compteur", "jauge", "avant-apres", "barres", "etapes", "liste-au-mot", "citation", "repere"];
const HEX_CHARTE = new Set(Object.values(CHARTE_AXION).map((c) => c.toLowerCase()));

function rendre(id: (typeof IDS_PIECES)[number], image: number, fond: "ivoire" | "noir" = "ivoire"): string {
  const def = CATALOGUE_BRIQUES[id];
  const Composant = RENDUS_BRIQUES[id];
  return renderToStaticMarkup(createElement(Composant as never, { image, fps: FPS_AXION, dureeImages: 125, fond, parametres: def.exemple }));
}

describe("catalogue de briques (fausse interface logicielle)", () => {
  it("contient les 18 briques demandées, chacune avec un rendu", () => {
    expect([...IDS_PIECES].sort()).toEqual([...ATTENDUES].sort());
    for (const id of IDS_PIECES) expect(RENDUS_BRIQUES[id]).toBeTypeOf("function");
  });

  it.each(ATTENDUES)("%s : l'exemple respecte ses paramètres, des paramètres faux sont refusés", (id) => {
    const def = CATALOGUE_BRIQUES[id as (typeof IDS_PIECES)[number]];
    expect(def.schema.safeParse(def.exemple).success).toBe(true);
    expect(def.schema.safeParse({ inconnu: 42, texte: 12 }).success).toBe(false);
    expect(def.nom.length).toBeGreaterThan(2);
    expect(def.toile.largeur).toBeGreaterThan(0);
  });

  it.each(ATTENDUES)("%s : rendu déterministe (même entrée = même image) et qui bouge dans le temps", (id) => {
    const p = id as (typeof IDS_PIECES)[number];
    expect(rendre(p, 30)).toBe(rendre(p, 30));
    expect(rendre(p, 2)).not.toBe(rendre(p, 60));
  });

  it.each(ATTENDUES)("%s : couleurs de la charte seulement, Manrope seule, orange jamais sur fond clair", (id) => {
    const p = id as (typeof IDS_PIECES)[number];
    for (const fond of ["ivoire", "noir"] as const) {
      const html = rendre(p, 40, fond);
      const hex = html.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
      for (const h of hex) expect(HEX_CHARTE.has(h.toLowerCase()), `${id} ${h}`).toBe(true);
      for (const m of html.matchAll(/font-family:([^;"]+)/g)) expect(m[1]).toContain(POLICE_AXION);
      if (fond === "ivoire") expect(html.toLowerCase()).not.toContain(CHARTE_AXION.orange.toLowerCase());
      expect(html).not.toMatch(/rgb\(\s*0\s*,\s*0\s*,\s*255|blue|yellow|green|salmon/i);
    }
  });
});

describe("mouvement doux sans rebond", () => {
  it("la courbe reste entre 0 et 1 et ne recule jamais", () => {
    let avant = 0;
    for (let i = 0; i <= 100; i++) {
      const v = adoucir(i / 100);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(avant);
      avant = v;
    }
    expect(adoucir(-1)).toBe(0);
    expect(adoucir(2)).toBe(1);
  });
});
