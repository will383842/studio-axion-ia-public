/**
 * Variété « Image → vidéo » · lot APP-MAT · axe 6, APPARITION des cartes du schéma (APP-B feutre, APP-C fantôme qui
 * s'allume, APP-D cartes qui tombent ; APP-A = référence). Seul le dessin change : invariants de la ligne de temps
 * tenus sur les 6 cartes ; sans variété, `Toile`/`Noeud` rendent EXACTEMENT le HTML d'avant le lot (empreinte figée
 * avant toute modification). Rendu statique par `react-dom/server` de `studio-rendu` (un seul React).
 * Rouge sans le lot : recette APP-C → aucune carte éteinte (fantôme) au début de la toile.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CodeVariante, RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type BlocRenduIV, type EntreeMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { AXE_APPARITION } from "@/moteurs/montage-image-video/variete/axes/apparition";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";
import { calculerScene, TEMPS_IV } from "../../../studio-rendu/compositions/image-video/plan";
import { Toile } from "../../../studio-rendu/compositions/image-video/Toile";
import { ContexteVariete } from "../../../studio-rendu/compositions/image-video/variete/ContexteVariete";
import { invariantsVarieteIV } from "./invariants";

const exiger = createRequire(join(process.cwd(), "studio-rendu/package.json"));
const { createElement } = exiger("react") as typeof import("react");
const { renderToStaticMarkup } = exiger("react-dom/server") as typeof import("react-dom/server");

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const carteDe = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const NOMS = ["A", "B", "C", "D", "E", "F"] as const;

function entrees(nom: string): EntreeMiseEnSceneIV[] {
  const carte = carteDe(nom);
  const fiche = FICHES_SIMULEES[`essai-${nom.toLowerCase()}`];
  const fins = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins;
  return fins.map((fin) => ({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES }));
}
const recette = (...codes: CodeVariante[]): RecetteVarieteIV => {
  const r: Record<string, string> = { ...RECETTE_REFERENCE_IV };
  for (const c of codes) r[c.startsWith("APP") ? "apparition" : "matiere"] = c;
  return r as RecetteVarieteIV;
};
type BlocToile = Extract<BlocRenduIV, { sorte: "toile" }>;
const toiles = (blocs: BlocRenduIV[]) => blocs.filter((b): b is BlocToile => b.sorte === "toile");

/** HTML statique de la toile d'un bloc à l'instant `t` (secondes depuis le début du bloc). */
function rendreToile(b: BlocToile, t: number, avecVariete = true): string {
  const scene = calculerScene(b.proprietes);
  const toile = createElement(Toile, { scene, schema: b.proprietes.schema, t });
  return renderToStaticMarkup(avecVariete ? createElement(ContexteVariete, { variete: b.variete, scene, children: toile }) : toile);
}

/**
 * Empreinte du HTML de `Toile` SANS variété (6 cartes, 1re version, toutes les toiles, un instant tous les 0,25 s), figée AVANT le lot.
 * Caméra (17/10, bloc entier sur son mot) : seule la toile b06 de la carte F change (la caméra ne quitte plus n09
 * avant son mot : n08 surgit 0,31 s et n10 0,17 s après leur mot, décalage existant ≤ 0,6 s ; trajectoire et bruitage
 * de caméra suivent).
 */
const EMPREINTE_TOILE_REFERENCE = "09542bc8cbf0158882df2a00343389dbc0aab6690c8b609cbc89522f86bfb2ab";

function empreinteToiles(variete?: RecetteVarieteIV): string {
  const h = createHash("sha256");
  for (const nom of NOMS) {
    const { ligne } = mettreEnSceneIV({ ...entrees(nom)[0], ...(variete ? { variete } : {}) });
    for (const b of toiles(ligne.blocs)) {
      const scene = calculerScene(b.proprietes);
      for (let t = 0; t < b.fin - b.debut; t += 0.25) {
        const toile = createElement(Toile, { scene, schema: b.proprietes.schema, t });
        h.update(renderToStaticMarkup(variete ? createElement(ContexteVariete, { variete: b.variete, scene, children: toile }) : toile));
      }
    }
  }
  return h.digest("hex");
}

describe("APP · référence inchangée", () => {
  it("sans variété : le HTML de la toile est identique à celui d'avant le lot", () => {
    expect(empreinteToiles()).toBe(EMPREINTE_TOILE_REFERENCE);
  }, 30_000);

  it("recette de référence (APP-A, MAT-A) dans le contexte : même HTML que sans variété", () => {
    expect(empreinteToiles(recette("APP-A", "MAT-A"))).toBe(EMPREINTE_TOILE_REFERENCE);
  }, 30_000);
});

describe("APP · moteur", () => {
  it("possibles : les trois variantes sur un schéma (≥ 3 nœuds), aucune sans schéma", () => {
    expect(AXE_APPARITION.possibles(carteDe("C"), "9:16")).toEqual(["APP-B", "APP-C", "APP-D"]);
    const petite = { ...carteDe("C"), noeuds: carteDe("C").noeuds.slice(0, 2) };
    expect(AXE_APPARITION.possibles(petite, "9:16")).toEqual([]);
  });

  for (const code of ["APP-B", "APP-C", "APP-D"] as const) {
    it(`${code} : invariants tenus sur les 6 cartes (toutes les versions) ; chaque toile porte le code, sinon repli écrit`, () => {
      for (const nom of NOMS) {
        for (const e of entrees(nom)) {
          const sans = mettreEnSceneIV(e);
          const avec = mettreEnSceneIV({ ...e, variete: recette(code) });
          expect(invariantsVarieteIV(sans, avec), `${nom} ${e.reseaux.join(",")}`).toEqual([]);
          const ts = toiles(avec.ligne.blocs);
          for (const b of ts) expect((b.variete?.donnees?.apparition as { code: string }).code).toBe(code);
          if (!ts.length) expect(avec.ligne.variete?.replis.some((r) => r.axe === "apparition" && r.code === code), nom).toBe(true);
          // Rien d'autre que les toiles ne reçoit l'apparition.
          for (const b of avec.ligne.blocs) if (b.sorte !== "toile") expect(b.variete?.donnees?.apparition).toBeUndefined();
        }
      }
    }, 60_000);
  }

  it("APP-C : tout le schéma est éteint dès le début, sauf les cartes déjà vues avant (« vus »)", () => {
    for (const nom of ["C", "E", "F"]) {
      const { ligne } = mettreEnSceneIV({ ...entrees(nom)[0], variete: recette("APP-C") });
      for (const b of toiles(ligne.blocs)) {
        const d = b.variete!.donnees!.apparition as { fantomes: string[]; vus: string[] };
        const vus = new Set(b.proprietes.dejaVus ?? []);
        expect(d.vus.sort()).toEqual([...vus].sort());
        expect(d.fantomes.sort()).toEqual(b.proprietes.schema.noeuds.map((n) => n.id).filter((n) => !vus.has(n)).sort());
      }
    }
  });
});

describe("APP · dessin", () => {
  const ligneC = (code: CodeVariante) => mettreEnSceneIV({ ...entrees("C")[0], variete: recette(code) }).ligne;

  it("APP-C (rouge sans le lot) : au début de la toile, toutes les cartes sont là, éteintes et sans texte ; chacune s'allume à son mot", () => {
    const b = toiles(ligneC("APP-C").blocs)[0];
    const html = rendreToile(b, 0);
    const eteintes = html.match(/data-eteinte=""/g) ?? [];
    expect(eteintes.length).toBe(b.proprietes.schema.noeuds.length);
    expect(html).toContain("data-fils-eteints");
    // Aucun libellé lisible avant d'être dit : le texte des cartes éteintes est à opacité 0.
    expect(html).not.toMatch(/opacity:0\.35;filter:grayscale\(1\)"/);
    const premier = b.proprietes.mots[0];
    const apres = rendreToile(b, premier.t + 0.5);
    expect((apres.match(/data-eteinte=""/g) ?? []).length).toBe(eteintes.length - 1);
    expect(apres).not.toContain(`data-noeud="${premier.noeud}" data-eteinte`);
  });

  it("APP-C : les cartes vues dans une séquence précédente sont posées « vues » dès le début (pas éteintes)", () => {
    const b = toiles(ligneC("APP-C").blocs).find((x) => (x.proprietes.dejaVus ?? []).length > 0)!;
    expect(b).toBeDefined();
    const html = rendreToile(b, 0);
    for (const id of b.proprietes.dejaVus!) {
      expect(html).toContain(`data-noeud="${id}"`);
      expect(html).not.toContain(`data-noeud="${id}" data-eteinte`);
    }
  });

  it("APP-B : la carte se trace au feutre (contour, feutre), la place de la suivante attend en pointillé", () => {
    const b = toiles(ligneC("APP-B").blocs)[0];
    const [m0, m1] = b.proprietes.mots;
    const debut = m1.t - TEMPS_IV.avanceNoeud;
    const pendant = rendreToile(b, debut + 0.15);
    expect(pendant).toContain('stroke-dasharray="1 1"');
    expect(pendant).toMatch(/rotate\(32deg\)/);
    const avant = rendreToile(b, m0.t + 0.6);
    expect(avant).toContain(`data-place="${m1.noeud}"`);
    expect(avant).toContain('stroke-dasharray="2 20"');
    // Une fois tracée, la carte est complète : plus de feutre.
    expect(rendreToile(b, m1.t + 1)).not.toMatch(/rotate\(32deg\)/);
  });

  it("APP-D : la carte tombe (décalage vers le haut, inclinée) puis se pose de travers ; la place de la suivante est pleine", () => {
    const b = toiles(ligneC("APP-D").blocs)[0];
    const [m0, m1] = b.proprietes.mots;
    const chute = rendreToile(b, m0.t - TEMPS_IV.avanceNoeud + 0.1);
    expect(chute).toMatch(new RegExp(`data-noeud="${m0.noeud}"[^>]*translateY\\(-\\d`));
    const posee = rendreToile(b, m0.t + 0.6);
    expect(posee).toMatch(new RegExp(`data-noeud="${m0.noeud}"[^>]*translateY\\(-?0\\.0px\\) rotate\\(-?1\\.20deg\\)`));
    expect(posee).toContain(`data-place="${m1.noeud}"`);
    expect(posee).toContain("background:#E2D7C9");
  });
});

describe("APP · déterminisme", () => {
  it("aucun Math.random ni Date dans les fichiers du lot", () => {
    const fichiers = [
      "src/moteurs/montage-image-video/variete/axes/apparition.ts",
      "src/moteurs/montage-image-video/variete/axes/matiere.ts",
      "studio-rendu/compositions/image-video/Toile.tsx",
      "studio-rendu/compositions/image-video/Noeud.tsx",
      ...["apparition", "matiere"].flatMap((d) => readdirSync(join(process.cwd(), "studio-rendu/compositions/image-video/variete", d)).map((f) => `studio-rendu/compositions/image-video/variete/${d}/${f}`)),
    ];
    for (const f of fichiers) {
      const source = readFileSync(join(process.cwd(), f), "utf8");
      expect(source, f).not.toMatch(/Math\.random\(|new Date\(|Date\.now\(/);
    }
  });
});
