/**
 * Variété « Image → vidéo » · lot APP-MAT · axe 9, MATIÈRE (MAT-B papier, MAT-C trait fait main, MAT-D profondeur douce ;
 * MAT-A = référence). Seul le dessin change : invariants tenus sur les 6 cartes ; le calque de matière enveloppe toutes
 * les scènes dessinées par l'IV ; sans variété (ou en MAT-A) il rend son contenu tel quel. Les tuiles du papier sont
 * de vrais PNG, identiques à chaque calcul. Rendu statique par `react-dom/server` de `studio-rendu` (un seul React).
 * Rouge sans le lot : MAT-B → le calque ne pose aucun papier, aucun bloc ne porte la matière.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
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
import { AXE_MATIERE } from "@/moteurs/montage-image-video/variete/axes/matiere";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";
import { calculerScene } from "../../../studio-rendu/compositions/image-video/plan";
import { Toile } from "../../../studio-rendu/compositions/image-video/Toile";
import { ContexteVariete } from "../../../studio-rendu/compositions/image-video/variete/ContexteVariete";
import { CalqueMatiere } from "../../../studio-rendu/compositions/image-video/variete/matiere/calque";
import { bruitPeriodique, tuilesPapier } from "../../../studio-rendu/compositions/image-video/variete/matiere/bruit";
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
const HABILLEES = new Set(["toile", "objets", "moments", "variete"]);

/** Le calque de matière autour d'un contenu témoin, dans le contexte d'une recette (`scene` : une toile). */
function rendreCalque(r: RecetteVarieteIV | null, scene?: unknown): string {
  const contenu = createElement("div", { id: "contenu" }, "témoin");
  const calque = createElement(CalqueMatiere, { children: contenu });
  return renderToStaticMarkup(createElement(ContexteVariete, { variete: r ? { recette: r, format: "9:16" } : undefined, scene, children: calque }));
}

function rendreToile(b: BlocToile, t: number): string {
  const scene = calculerScene(b.proprietes);
  return renderToStaticMarkup(createElement(ContexteVariete, { variete: b.variete, scene, children: createElement(Toile, { scene, schema: b.proprietes.schema, t }) }));
}

describe("MAT · moteur", () => {
  it("possibles : les trois variantes, sur toute carte", () => {
    for (const nom of NOMS) expect(AXE_MATIERE.possibles(carteDe(nom), "9:16")).toEqual(["MAT-B", "MAT-C", "MAT-D"]);
  });

  for (const code of ["MAT-B", "MAT-C", "MAT-D"] as const) {
    it(`${code} : invariants tenus sur les 6 cartes ; chaque scène dessinée par l'IV porte la matière, jamais un écran emprunté`, () => {
      for (const nom of NOMS) {
        for (const e of entrees(nom)) {
          const sans = mettreEnSceneIV(e);
          const avec = mettreEnSceneIV({ ...e, variete: recette(code) });
          expect(invariantsVarieteIV(sans, avec), `${nom} ${e.reseaux.join(",")}`).toEqual([]);
          for (const b of avec.ligne.blocs) {
            if (HABILLEES.has(b.sorte)) expect(b.variete?.donnees?.matiere, `${nom} ${b.id}`).toEqual({ code });
            else expect(b.variete?.donnees?.matiere).toBeUndefined();
          }
        }
      }
    }, 60_000);
  }
});

describe("MAT · calque", () => {
  it("sans variété, ou en MAT-A : le contenu tel quel", () => {
    const seul = renderToStaticMarkup(createElement("div", { id: "contenu" }, "témoin"));
    expect(rendreCalque(null)).toBe(seul);
    expect(rendreCalque(recette("MAT-A"))).toBe(seul);
  });

  it("MAT-B (rouge sans le lot) : le papier (deux tuiles PNG + bord assombri) est posé sur toute la scène, contenu intact", () => {
    const html = rendreCalque(recette("MAT-B"));
    expect(html).toContain('<div id="contenu">témoin</div>');
    expect(html).toContain('data-matiere="papier"');
    expect((html.match(/data:image\/png;base64,/g) ?? []).length).toBe(2);
    expect(html).toContain("radial-gradient");
    // Le papier est AU-DESSUS du contenu (posé après lui).
    expect(html.indexOf("contenu")).toBeLessThan(html.indexOf("data-matiere"));
  });

  it("MAT-C : le calque ne déforme pas la scène (le trait fait main est dans les cartes et les fils de la toile)", () => {
    expect(rendreCalque(recette("MAT-C"))).toBe(renderToStaticMarkup(createElement("div", { id: "contenu" }, "témoin")));
  });

  it("MAT-D : une lumière douce (bords assombris d'encre) sur toute la scène", () => {
    const html = rendreCalque(recette("MAT-D"));
    expect(html).toContain('data-matiere="profondeur"');
    expect(html).toContain("radial-gradient");
  });
});

describe("MAT · toile", () => {
  const toileC = (code: CodeVariante) => mettreEnSceneIV({ ...entrees("C")[0], variete: recette(code) }).ligne.blocs.find((b): b is BlocToile => b.sorte === "toile")!;

  it("MAT-C : contours faits main (tracés tremblés), ombres en hachures, fils passés au filtre de tremblé", () => {
    const b = toileC("MAT-C");
    const html = rendreToile(b, b.proprietes.mots[1].t + 0.5);
    expect(html).toContain('filter="url(#mat-c-fils)"');
    expect(html).toContain("<feDisplacementMap");
    expect(html).toMatch(/clipPath id="hach-/);
    expect(html).toMatch(/<path d="M-?\d+\.\d -?\d+\.\d L/);
  });

  it("MAT-D : chaque colonne du schéma a son plateau ; chaque carte posée a sa tranche", () => {
    const b = toileC("MAT-D");
    // Un plateau par colonne dont une carte est déjà posée ; jamais de plateau vide avant la première carte.
    const colonnes = (ids: string[]) => new Set(b.toile.boites.filter((x) => ids.includes(x.id)).map((x) => x.colonne ?? "")).size;
    const fin = b.fin - b.debut - 0.01;
    expect((rendreToile(b, fin).match(/data-plateau=/g) ?? []).length).toBe(colonnes(b.proprietes.mots.map((m) => m.noeud)));
    expect(rendreToile(b, 0)).not.toContain("data-plateau=");
    const html = rendreToile(b, b.proprietes.mots[1].t + 0.5);
    expect(html).toMatch(/top:22px;width:\d+px;height:\d+px;border-radius:34px;background:#(C2532A|2A150B)/);
  });

  it("MAT-B : les cartes sont en papier (ivoire clair) avec une ombre plus profonde", () => {
    const b = toileC("MAT-B");
    const html = rendreToile(b, b.proprietes.mots[1].t + 0.5);
    expect(html).toContain("background:#FBF8F3");
    expect(html).toContain("0 34px 90px #15100C1f");
  });
});

describe("MAT · tuiles du papier", () => {
  /** Lit un PNG : signature, IHDR, données décompressées (zlib vérifie la somme Adler-32). */
  function lirePng(adresse: string) {
    const o = Buffer.from(adresse.replace("data:image/png;base64,", ""), "base64");
    expect([...o.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const largeur = o.readUInt32BE(16);
    const hauteur = o.readUInt32BE(20);
    expect(o.subarray(12, 16).toString()).toBe("IHDR");
    expect([...o.subarray(24, 29)]).toEqual([8, 6, 0, 0, 0]);
    const longueurIdat = o.readUInt32BE(33);
    expect(o.subarray(37, 41).toString()).toBe("IDAT");
    const brut = inflateSync(o.subarray(41, 41 + longueurIdat));
    return { largeur, hauteur, brut };
  }

  it("grain 128 px et nuages 64 px : de vrais PNG RGBA, couleurs de la charte (encre, lueur), voile léger", () => {
    const { grain, nuages } = tuilesPapier();
    const g = lirePng(grain);
    expect([g.largeur, g.hauteur, g.brut.length]).toEqual([128, 128, 128 * (1 + 4 * 128)]);
    expect([...g.brut.subarray(1, 4)]).toEqual([0x15, 0x10, 0x0c]);
    const n = lirePng(nuages);
    expect([n.largeur, n.hauteur]).toEqual([64, 64]);
    expect([...n.brut.subarray(1, 4)]).toEqual([0x7a, 0x34, 0x18]);
    const alphas = (b: Buffer, cote: number) => Array.from({ length: cote * cote }, (_, i) => b[Math.floor(i / cote) * (1 + 4 * cote) + 1 + 4 * (i % cote) + 3]);
    expect(Math.max(...alphas(g.brut, 128))).toBeLessThanOrEqual(Math.round(255 * 0.2));
    expect(Math.max(...alphas(n.brut, 64))).toBeLessThanOrEqual(Math.round(255 * 0.09));
  });

  it("déterministes : même tuile à chaque calcul ; le bruit des nuages se raccorde (tuile périodique)", () => {
    expect(tuilesPapier()).toEqual(tuilesPapier());
    const a = bruitPeriodique(32, 3, 11);
    expect(Array.from(a)).toEqual(Array.from(bruitPeriodique(32, 3, 11)));
    // Bord droit ≈ bord gauche (pas de couture visible quand la tuile se répète).
    for (let y = 0; y < 32; y++) expect(Math.abs(a[y * 32 + 31] - a[y * 32])).toBeLessThan(0.12);
  });
});
