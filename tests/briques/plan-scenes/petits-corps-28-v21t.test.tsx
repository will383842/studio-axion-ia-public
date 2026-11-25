/**
 * P6-TAILLES-v21t : les petits textes de la liste de contacts, de la fenêtre d'app et du volet avant / après sont à
 * 28 px au moins. Rendu statique, aucun rendu vidéo, 0 €.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CATALOGUE_BRIQUES } from "@/briques/plan-scenes/catalogue";
import { RENDUS_BRIQUES } from "@/briques/plan-scenes/briques";
import { FPS_AXION } from "@/briques/jetons-motion";
import { EXEMPLES_VOLET, OBJET_VOLET_AVANT_APRES } from "@/briques/motion/petits-objets/volet-avant-apres";

const RACINE = resolve(__dirname, "../../..");
const SOURCES = ["src/briques/plan-scenes/briques/ListeCrm.tsx", "src/briques/plan-scenes/briques/FenetreApp.tsx", "src/briques/motion/petits-objets/volet-avant-apres.tsx"];

function brique(id: "liste-crm" | "fenetre-app") {
  const def = CATALOGUE_BRIQUES[id];
  const Composant = RENDUS_BRIQUES[id];
  return renderToStaticMarkup(createElement(Composant as never, { image: 120, fps: FPS_AXION, dureeImages: 125, fond: "ivoire", parametres: def.exemple }));
}
const tailles = (html: string) => [...html.matchAll(/font-size:(\d+)px/g)].map((m) => Number(m[1]));

describe("P6-TAILLES-v21t", () => {
  it("(a) liste de contacts : initiale, détail et statut à 28 px ; titre 38 et nom 30 inchangés", () => {
    const html = brique("liste-crm");
    expect(tailles(html).filter((t) => t < 28)).toEqual([]);
    expect(html).toContain("font-size:38px");
    expect(html).toContain("font-size:30px");
    // 3 lignes × (initiale + détail + statut) = 9 textes à 28 px
    expect(tailles(html).filter((t) => t === 28)).toHaveLength(9);
  });

  it("(b) fenêtre : onglets à 28 px, titre à 28", () => {
    const html = brique("fenetre-app");
    expect(tailles(html).filter((t) => t < 28)).toEqual([]);
    expect(tailles(html).filter((t) => t === 28)).toHaveLength(1 + 3); // titre + 3 onglets
  });

  it("(c) volet : étiquettes à 28, pilule 150 × 52 inchangée", () => {
    const html = renderToStaticMarkup(OBJET_VOLET_AVANT_APRES.Rendu({ image: 30, fps: 25, dureeImages: 60, fond: "ivoire", parametres: EXEMPLES_VOLET[0]!, ton: "neutre", graine: 7 }));
    expect([...html.matchAll(/font-size="(\d+)"/g)].map((m) => Number(m[1]))).toEqual([28, 28]);
    expect(html).toContain('width="150" height="52"');
  });

  it("(d) minimum 28 sur les trois fichiers : aucune valeur fontSize < 28", () => {
    for (const f of SOURCES) {
      const src = readFileSync(join(RACINE, f), "utf8");
      const valeurs = [...src.matchAll(/fontSize(?::\s*|=\{)(\d+)/g)].map((m) => Number(m[1]));
      expect(valeurs.length, f).toBeGreaterThan(0);
      expect(valeurs.filter((v) => v < 28), f).toEqual([]);
    }
  });
});
