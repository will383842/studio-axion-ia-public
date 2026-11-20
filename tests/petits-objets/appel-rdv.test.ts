/** C10-13b-a — pièce « Prendre rendez-vous » (curseur, pilule, lueur, « validé »). Pure, non inscrite, éteinte. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { DEF_APPEL_RDV, EXEMPLES_APPEL_RDV } from "../../src/briques/motion/petits-objets/appel-rdv";
import { verifierDefinition, MOTS_MAX, type DefinitionObjet } from "../../src/briques/motion/petits-objets/contrat";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { LIBELLE_APPEL_RDV, etatSequenceAppel } from "../../src/briques/motion/habillage-commun/sequence-appel";

const CHEMIN = join(process.cwd(), "src/briques/motion/petits-objets/appel-rdv.tsx");
const DEF = DEF_APPEL_RDV as unknown as DefinitionObjet<unknown>;
const D = 100;
const rendre = (p: unknown, image: number, fond: "ivoire" | "noir" = "ivoire") =>
  renderToStaticMarkup(DEF.Rendu({ image, fps: 25, dureeImages: D, fond, graine: 3, parametres: p }));
const compter = (s: string, sous: string) => s.split(sous).length - 1;

const MOTIFS: RegExp[] = [/@\//, /\bzod\b/, /Math\.random/, /remotion/, /from\s+["'][^"']*moteurs\//, /from\s+["'][^"']*-v4/, /VideoAnimeeV4/, /briques-v4/, /faits-script/, /from\s+["'][^"']*\/droits/, /bibliotheque-video/, /src\/domaine|from\s+["'][^"']*\/domaine\//, /from\s+["'][^"']*\/services\//];

describe("C10-13b-a contrat", () => {
  it("verifierDefinition ok, id, capacité, famille, données, durée", () => {
    expect(verifierDefinition(DEF)).toBe("ok");
    expect(DEF.id).toBe("objet-appel-rdv");
    expect(DEF.capacite).toBe("objet.appel");
    expect(DEF.famille).toBe("etiquette");
    expect(DEF.donnees).toBe("aucune");
    expect(DEF.dureeSec.min).toBeGreaterThanOrEqual(0.4);
    expect(DEF.dureeSec.max).toBeLessThanOrEqual(4);
    expect(LIBELLE_APPEL_RDV.split(" ").length).toBeLessThanOrEqual(MOTS_MAX);
  });
  it("valider accepte {} et les exemples", () => {
    expect(DEF.valider({})).not.toBeNull();
    expect(EXEMPLES_APPEL_RDV).toHaveLength(3);
    for (const e of EXEMPLES_APPEL_RDV) expect(DEF.valider(e)).not.toBeNull();
  });
  it("valider refuse le reste, sans exception", () => {
    const refus: unknown[] = [null, undefined, 42, "x", { texte: "Abonne-toi" }, { libelle: "x" }, { lien: "x" }, { url: "x" },
      { depart: { x: Number.NaN, y: 1 } }, { depart: { x: 120, y: 1 } }, { depart: { x: 1, y: -1 } }, { depart: 5 }, { depart: null }, { depart: { x: 1 } }, { depart: { x: 1, y: 1 }, texte: "a" }];
    for (const m of refus) expect(() => DEF.valider(m)).not.toThrow();
    for (const m of refus) expect(DEF.valider(m)).toBeNull();
  });
});

describe("C10-13b-a rendu", () => {
  for (const fond of ["ivoire", "noir"] as const) {
    it(`libellé unique, rien d'interdit (fond ${fond})`, () => {
      for (const e of EXEMPLES_APPEL_RDV) for (const i of [0, 30, 60, 75, 90, D - 1]) {
        const m = rendre(e, i, fond);
        expect(compter(m, LIBELLE_APPEL_RDV)).toBe(1);
        for (const interdit of ["http", "@", "Tape", "<img", "href=", "filter", "drop-shadow", "mask", "Validé"]) expect(m).not.toContain(interdit);
      }
    });
  }
  it("aucun anneau à l'image 0, anneau pendant le clic", () => {
    expect(rendre({}, 0)).not.toContain("data-anneau");
    const clic = Array.from({ length: D }, (_, i) => i).find((i) => etatSequenceAppel(i, D).anneau !== null);
    expect(clic).toBeDefined();
    expect(rendre({}, clic as number)).toContain("data-anneau");
  });
  it("dernière image : contour du ton valide ; image 0 : ton neutre", () => {
    expect(rendre({}, D - 1).toLowerCase()).toContain(couleurDuTon("valide", "ivoire").toLowerCase());
    expect(rendre({}, 5).toLowerCase()).not.toContain(couleurDuTon("valide", "ivoire").toLowerCase());
  });
  it("paramètres invalides : svg vide ; même entrée = même balisage", () => {
    expect(rendre(null, 30)).not.toContain(LIBELLE_APPEL_RDV);
    expect(rendre({}, 50)).toBe(rendre({}, 50));
  });
});

describe("C10-13b-a gardes", () => {
  const texte = readFileSync(CHEMIN, "utf8");
  it("le texte du .tsx : motifs de garde.test.ts, aucun hexadécimal écrit, libellé non réécrit", () => {
    for (const re of MOTIFS) expect(texte).not.toMatch(re);
    expect(texte).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(texte).not.toContain("Prendre rendez-vous");
    expect(texte).not.toMatch(/\b(useState|useEffect|useRef|Date\.now)\b/);
  });
  // C10-13-v19b (19/11) : le registre des objets est le SEUL importeur autorisé (liste blanche d'un chemin exact) ; rien dans studio-rendu/.
  it("seuls le registre, objets-inscrits.ts (import) et les fichiers qui citent l'id (C9-34-FIN-v20h) mentionnent appel-rdv (et rien dans studio-rendu/)", () => {
    const visiter = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        if (n === "node_modules") return [];
        const p = join(dir, n);
        return statSync(p).isDirectory() ? visiter(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
      });
    const racine = process.cwd();
    const fautifs = [...visiter(join(racine, "src")), ...visiter(join(racine, "studio-rendu"))]
      .filter((p) => !p.endsWith("appel-rdv.tsx") && /appel-rdv/.test(readFileSync(p, "utf8")))
      .map((p) => p.slice(racine.length + 1).split("\\").join("/"));
    // toiles.ts et moments-ecran.ts ne citent que l'identifiant « objet-appel-rdv » (aucun import).
    expect([...fautifs].sort()).toEqual(["src/briques/note-extraits/moments-ecran.ts", "src/briques/plan-scenes-objets/registre.ts", "src/briques/plan-scenes/briques/objets-inscrits.ts", "src/briques/plan-scenes/toiles.ts"]);
  });
});
