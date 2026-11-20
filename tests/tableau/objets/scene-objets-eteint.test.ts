/**
 * N-04d-b-v20g : le calque `ObjetsTableau` est monté dans `TableauScene` (page écrite et « reference/1 » seulement).
 * Éteint = identique : sans `objets` (ou `[]`), le rendu est strictement celui d'avant (empreintes relevées sur
 * `origin/master` 2e7ee8e6, AVANT le changement). Rendu statique, chemin CALCULÉ (piège tsc/remotion, PIEGE-REMOTION-TSC.md).
 * Le rendu se saute si `studio-rendu` n'est pas installé ; les cas de lecture de texte tournent toujours.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
let IMAGE = 10;
vi.mock("../../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<Record<string, unknown>>();
  return {
    ...vrai,
    Sequence: (p: { from?: number; durationInFrames?: number; children?: unknown }) => {
      const de = p.from ?? 0;
      const fin = de + (p.durationInFrames ?? Infinity);
      return IMAGE >= de && IMAGE < fin ? (p.children ?? null) : null;
    },
    useCurrentFrame: () => IMAGE,
    useVideoConfig: () => ({ fps: 25, width: 1080, height: 1920, durationInFrames: 250, id: "essai", defaultProps: {}, props: {}, defaultCodec: null }),
  };
});

import { proprietesScenes } from "@/briques/tableau-scene/proprietes";
import type { MiseEnPageTableau as MiseBrique, ProprietesTableauScene, SceneCalee } from "@/briques/tableau-scene/types";
import type { ObjetScene } from "@/briques/tableau-scene/objets";
import { EXEMPLES_GROS_CHIFFRE } from "@/briques/motion/petits-objets/gros-chiffre";
import { remettreEnForme } from "@/moteurs/montage-tableau/decoupage";
import { mettreEnPage } from "@/moteurs/montage-tableau/mise-en-page";
import { ficheReelleBrute } from "../dessin-4/fiches-reelles";
import { caleeReguliere } from "../reference-1/fiches";

// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { createElement } = AVEC_RENDU ? ((await import("../../../studio-rendu/node_modules/react/index.js")) as typeof import("react")) : ({} as typeof import("react"));
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { renderToStaticMarkup } = AVEC_RENDU ? ((await import("../../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server")) : ({} as typeof import("react-dom/server"));
const chemin = (c: string) => `../../../studio-rendu/compositions/${c}`;
type Module = { TableauScene: (p: ProprietesTableauScene) => unknown };
const MODULE = (AVEC_RENDU ? await import(/* @vite-ignore */ chemin("tableau/TableauScene")) : null) as Module | null;

const SCENE = 2;
const scenesDe = (habillage: string): ProprietesTableauScene[] => {
  const f = remettreEnForme({ ...ficheReelleBrute("consigne-ia"), habillage } as never);
  const c = caleeReguliere(f, "consigne-ia");
  const mise = mettreEnPage(c.fiche, {});
  return proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: c.fiche.scenes as SceneCalee[], heures: c.elements, stylo: c.fiche.stylo, mots: c.mots });
};
const referenceUn = AVEC_RENDU ? scenesDe("reference/1")[SCENE] : (null as never);
const blocsDeux = AVEC_RENDU ? scenesDe("blocs/2")[SCENE] : (null as never);
/** Les trois scènes témoins : page écrite (sans style de référence), reference/1, v2 ; et reference/3 (même scène, autre style). */
const TEMOINS = AVEC_RENDU
  ? {
      "page écrite": { ...referenceUn, styleReference: undefined } as ProprietesTableauScene,
      "reference/1": referenceUn,
      v2: blocsDeux,
      "reference/3": { ...referenceUn, styleReference: { ...referenceUn.styleReference!, style: "reference/3" } } as ProprietesTableauScene,
    }
  : ({} as Record<string, ProprietesTableauScene>);

const rendre = (p: ProprietesTableauScene, image: number) => {
  IMAGE = image;
  return renderToStaticMarkup(createElement(MODULE!.TableauScene as never, p as never) as never) as string;
};
const empreinte = (html: string) => createHash("sha256").update(html).digest("hex").slice(0, 16);
const objetChiffre: ObjetScene = { id: "objet-gros-chiffre", debutMs: 1000, finMs: 3000, parametres: EXEMPLES_GROS_CHIFFRE[0] as unknown as Record<string, unknown>, boite: { x: 100, y: 200, largeur: 600, hauteur: 400 } };

// Empreintes relevées sur origin/master 2e7ee8e6 (avant N-04d-b-v20g), images 10 et 100 (0,4 s et 4 s).
const ATTENDU: Record<string, [string, string]> = {
  "page écrite": ["9c584d2a115252cc", "713098a31a1ac048"],
  "reference/1": ["80657b4b5047f636", "645870b73682b362"],
  v2: ["2796d34edd597b97", "73c272346aa510dd"],
};

describe.skipIf(!AVEC_RENDU)("TableauScene : éteint = identique (N-04d-b-v20g)", () => {
  for (const [nom, [a, b]] of Object.entries(ATTENDU)) {
    it(`${nom} sans objets : rendu inchangé à 0,4 s et 4 s`, () => {
      expect([empreinte(rendre(TEMOINS[nom], 10)), empreinte(rendre(TEMOINS[nom], 100))]).toEqual([a, b]);
    });
    it(`${nom} avec objets: [] : identique à sans objets`, () => {
      for (const i of [10, 100]) expect(rendre({ ...TEMOINS[nom], objets: [] }, i)).toBe(rendre(TEMOINS[nom], i));
    });
  }

  it("page écrite et reference/1 : un gros chiffre apparaît à 2 s, pas à 0,5 s", () => {
    for (const nom of ["page écrite", "reference/1"]) {
      const p = { ...TEMOINS[nom], objets: [objetChiffre] };
      expect(rendre(p, 12), nom).not.toContain("minutes");
      expect(rendre(p, 50), nom).toContain("minutes");
      expect(rendre(p, 90), nom).not.toContain("minutes");
    }
  });

  it("v2 et reference/3 : un objet ne change rien au rendu", () => {
    for (const nom of ["v2", "reference/3"]) {
      for (const i of [12, 50]) expect(rendre({ ...TEMOINS[nom], objets: [objetChiffre] }, i), nom).toBe(rendre(TEMOINS[nom], i));
    }
  });
});

describe("TableauScene.tsx : lecture du texte (tourne sans remotion)", () => {
  const texte = readFileSync("studio-rendu/compositions/tableau/TableauScene.tsx", "utf8");

  it("un seul import du calque, `./ObjetsTableau`", () => {
    expect(texte.match(/from "\.\/ObjetsTableau"/g)).toHaveLength(1);
  });

  it("le calque n'est rendu que si `objets?.length`", () => {
    expect(texte).toMatch(/\.objets\?\.length/);
    expect(texte).toContain("<ObjetsTableau");
  });

  it("aucun import de la logique de placement (`objets-tableau`, `tableau-scene/objets`) en valeur", () => {
    expect(texte).not.toMatch(/^import (?!type).*(objets-tableau|tableau-scene\/objets)/m);
  });

  it("le calque n'est monté ni dans `v2` ni dans `reference/3` : il est rendu après leur retour", () => {
    expect(texte.match(/<ObjetsTableau/g)).toHaveLength(1);
    const iV2 = texte.indexOf("if (p.v2)");
    const iRef3 = texte.indexOf('"reference/3"');
    const premier = texte.indexOf("<ObjetsTableau");
    expect(iV2).toBeGreaterThan(-1);
    expect(iRef3).toBeGreaterThan(-1);
    expect(premier).toBeGreaterThan(iRef3);
  });
});
