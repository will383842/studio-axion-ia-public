/**
 * N-04b — le type « objet posé sur une scène » et le calcul pur qui place les petits objets dans la place libre de la
 * page. Propriétés de scène montées par la VRAIE `proprietesScenes` sur une fiche témoin. Aucun appel, rien ne l'appelle.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { MiseEnPageTableau as MiseBrique, ProprietesTableauScene, SceneCalee } from "../../../src/briques/tableau-scene/types";
import type { MotMinute } from "../../../src/briques/plan-scenes/schema";
import { tempsReference3 } from "../../../src/moteurs/montage-tableau/temps-reference-3";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { objetsDesScenes } from "../../../src/moteurs/montage-tableau/objets-tableau";
import { ficheReelleBrute } from "../dessin-4/fiches-reelles";
import { caleeReguliere, ficheReference } from "../reference-1/fiches";
import { caleeTemoin3 } from "../reference-3/fiches";

const GROS = ["objet-gros-chiffre"];

function proprietesDe(fiche: ReturnType<typeof ficheReference>): ProprietesTableauScene[] {
  const c = caleeReguliere(fiche, "relances");
  const mise = mettreEnPage(c.fiche, {});
  return proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: c.fiche.scenes as SceneCalee[], heures: c.elements, stylo: c.fiche.stylo, mots: c.mots });
}
const reference1 = proprietesDe(ficheReference("relances"));
const reference3 = (() => {
  const r = caleeTemoin3();
  const mise = mettreEnPage(r.fiche, {});
  return proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: r.fiche.scenes as SceneCalee[], heures: r.elements, stylo: r.fiche.stylo, mots: r.mots, temps3: tempsReference3(r.fiche, r.mots) });
})();
const blocs2 = proprietesDe(ficheReelleBrute("relances"));

/** Phrase dite à partir de `debutMs`, 300 ms par mot. */
const dit = (debutMs: number, phrase: string): MotMinute[] =>
  phrase.split(" ").map((texte, i) => ({ texte, debutMs: debutMs + i * 300, finMs: debutMs + i * 300 + 250 }));

const demiVide = reference1.find((p) => p.scene.id === "s03")!; // page à moitié vide
const pleine = reference1.find((p) => p.scene.id === "s01")!; // page pleine

describe("éteint = identique", () => {
  it("permis vide → {} pour une page écrite, reference/1 et blocs/2", () => {
    const mots = dit(13000, "on a gagné 3 clients");
    for (const proprietes of [reference1, reference3, blocs2]) expect(objetsDesScenes({ proprietes, mots, permis: [] })).toEqual({});
  });
  it("mots vides → {} ; entrée illisible → {} sans exception", () => {
    expect(objetsDesScenes({ proprietes: reference1, mots: [], permis: GROS })).toEqual({});
    expect(objetsDesScenes({ proprietes: null as never, mots: dit(13000, "on a gagné 3 clients"), permis: GROS })).toEqual({});
    expect(objetsDesScenes(null as never)).toEqual({});
  });
});

describe("placement dans la place libre", () => {
  it("page à moitié vide + « 3 clients » : 1 objet, sous le dernier écrit, au-dessus des sous-titres, dans la zone sûre", () => {
    const r = objetsDesScenes({ proprietes: reference1, mots: dit(13000, "on a gagné 3 clients"), permis: GROS });
    expect(Object.keys(r)).toEqual([demiVide.scene.id]);
    const [o] = r[demiVide.scene.id]!;
    expect(r[demiVide.scene.id]).toHaveLength(1);
    expect(o!.id).toBe("objet-gros-chiffre");
    const bas = demiVide.page.elements
      .filter((e) => demiVide.dejaEcrits.includes(e.elementId) || e.sceneId === demiVide.scene.id)
      .reduce((m, e) => Math.max(m, (e.encombrement ?? e).px.y + (e.encombrement ?? e).px.hauteur), 0);
    const z = demiVide.zoneSure.px;
    expect(o!.boite.y).toBeGreaterThanOrEqual(bas);
    expect(o!.boite.y + o!.boite.hauteur).toBeLessThanOrEqual(demiVide.bandeSousTitres.px.y);
    expect(o!.boite.x).toBeGreaterThanOrEqual(z.x);
    expect(o!.boite.x + o!.boite.largeur).toBeLessThanOrEqual(z.x + z.largeur);
    expect(o!.boite.y).toBeGreaterThanOrEqual(z.y);
    expect(o!.debutMs).toBe(13000 + 3 * 300 - demiVide.scene.debutMs); // le nombre dit est le 4e mot
    expect(o!.finMs).toBeGreaterThan(o!.debutMs);
    expect(Object.isFrozen(o!.parametres)).toBe(true);
    expect(o!.parametres).toMatchObject({ valeur: 3 });
  });
  it("même nombre dit sur une page pleine → abandonné", () => {
    expect(objetsDesScenes({ proprietes: reference1, mots: dit(1000, "on a gagné 3 clients"), permis: GROS })).toEqual({});
    expect(pleine.scene.debutMs).toBeLessThanOrEqual(1000);
  });
});

describe("styles exclus", () => {
  // Scène témoin qui PLACE un objet sans style (prouvé), puis on lui pose v2 / reference/3 : seule l'exclusion peut la vider.
  const mots = dit(13000, "on a gagné 3 clients");
  const nu = { ...demiVide, v2: undefined, styleReference: undefined } as ProprietesTableauScene;
  it("témoin : sans v2 ni style de référence, l'objet est placé", () => {
    expect(objetsDesScenes({ proprietes: [nu], mots, permis: GROS })[demiVide.scene.id]).toHaveLength(1);
  });
  it("v2 posé (blocs/2) → {} même avec permis", () => {
    const v2 = blocs2.find((p) => p.v2)!.v2;
    expect(v2).toBeTruthy();
    expect(objetsDesScenes({ proprietes: [{ ...nu, v2 }], mots, permis: GROS })).toEqual({});
  });
  it("styleReference reference/3 ou reference/2 posé → {} ; reference/1 reste accepté", () => {
    const sr = reference3.find((p) => p.styleReference)!.styleReference!;
    expect(sr.style).toBe("reference/3");
    expect(objetsDesScenes({ proprietes: [{ ...nu, styleReference: sr }], mots, permis: GROS })).toEqual({});
    expect(objetsDesScenes({ proprietes: [{ ...nu, styleReference: { ...sr, style: "reference/2" } }], mots, permis: GROS })).toEqual({});
    expect(objetsDesScenes({ proprietes: [{ ...nu, styleReference: { ...sr, style: "reference/1" } }], mots, permis: GROS })[demiVide.scene.id]).toHaveLength(1);
  });
  it("les trois jeux de propriétés réels portent bien leur style", () => {
    expect(blocs2.every((p) => p.v2)).toBe(true);
    expect(reference3.every((p) => p.styleReference?.style === "reference/3")).toBe(true);
  });
});

describe("durée", () => {
  it("dit 0,2 s avant la fin de la scène → abandonné", () => {
    const fin = demiVide.scene.finMs;
    expect(objetsDesScenes({ proprietes: reference1, mots: [{ texte: "3", debutMs: fin - 200, finMs: fin - 100 }, { texte: "clients", debutMs: fin - 100, finMs: fin - 50 }], permis: GROS })).toEqual({});
  });
  it("objet plus long que la scène → fin = durée de la scène", () => {
    const duree = demiVide.scene.finMs - demiVide.scene.debutMs;
    const r = objetsDesScenes({ proprietes: reference1, mots: dit(demiVide.scene.finMs - 1500, "on a gagné 3 clients"), permis: GROS });
    const o = r[demiVide.scene.id]?.[0];
    if (o) expect(o.finMs).toBeLessThanOrEqual(duree);
    const long = objetsDesScenes({ proprietes: reference1, mots: [{ texte: "3", debutMs: demiVide.scene.finMs - 2000, finMs: demiVide.scene.finMs - 1900 }, { texte: "clients", debutMs: demiVide.scene.finMs - 1900, finMs: demiVide.scene.finMs + 1000 }], permis: GROS });
    const l = long[demiVide.scene.id]?.[0];
    expect(l).toBeDefined();
    expect(l!.finMs).toBe(duree);
  });
});

describe("objets non acceptés", () => {
  it("objet-cartes-coche + énumération dite → {}", () => {
    const mots = dit(13000, "d'abord le devis ensuite la signature enfin le paiement");
    expect(objetsDesScenes({ proprietes: reference1, mots, permis: ["objet-cartes-coche"] })).toEqual({});
  });
});

describe("garde statique", () => {
  it("objets.ts n'a qu'un import de type ; rien dans src/** ni studio-rendu/** n'importe les deux pièces", () => {
    const src = readFileSync("src/briques/tableau-scene/objets.ts", "utf8");
    expect(src.match(/^\s*import\b.*$/gm)).toEqual(['import type { RectPx } from "./types";']);
    const fichiers: string[] = [];
    const marche = (d: string) => {
      for (const n of readdirSync(d)) {
        if (n === "node_modules" || n === ".next") continue;
        const c = join(d, n);
        if (statSync(c).isDirectory()) marche(c);
        else if (/\.(ts|tsx|mts)$/.test(n)) fichiers.push(c);
      }
    };
    marche("src");
    marche("studio-rendu");
    // Exemption RESSERRÉE (pilote, 20/11) : EXACTEMENT ObjetsTableau.tsx, et SEULEMENT pour un `import type` de tableau-scene/objets.
    const EXEMPTE = "studio-rendu/compositions/tableau/ObjetsTableau.tsx";
    const IMPORT_TYPE_OBJETS = /^\s*import\s+type\s+\{[^}]*\}\s*from\s+["'][^"']*tableau-scene\/objets["'];?\s*$/gm;
    const lit = (f: string) => {
      const t = readFileSync(f, "utf8");
      return f === EXEMPTE ? t.replace(IMPORT_TYPE_OBJETS, "") : t;
    };
    const lecteurs = fichiers.filter((f) => !/objets-tableau\.ts$|tableau-scene\/objets\.ts$/.test(f) && (/objets-tableau/.test(lit(f)) || /tableau-scene\/objets["']/.test(lit(f))));
    expect(lecteurs).toEqual([]);
  });
});
