/** C9-40a — planches des familles étiquettes, écrans, manuscrit (pièces fusionnées seulement) : comptes, chevauchement, racine, garde. Aucun rendu Remotion. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PlancheEtiquettes, ENTREES_ETIQUETTES } from "../../studio-rendu/compositions/petits-objets/planche/PlancheEtiquettes";
import { PlancheEcrans, ENTREES_ECRANS } from "../../studio-rendu/compositions/petits-objets/planche/PlancheEcrans";
import { PlancheManuscrit, ENTREES_MANUSCRIT } from "../../studio-rendu/compositions/petits-objets/planche/PlancheManuscrit";
import { seChevauchent, zoneDeLaCase } from "../../studio-rendu/compositions/petits-objets/planche/PlancheEtiquettes";
import { ZONE_VISAGE_OBJETS } from "../../src/briques/motion/petits-objets/zones";
import { EXEMPLES_ETIQUETTES } from "../../src/briques/motion/petits-objets/etiquettes";
import { EXEMPLES_CARTES } from "../../src/briques/motion/petits-objets/cartes";
import { EXEMPLES_GROS_CHIFFRE } from "../../src/briques/motion/petits-objets/gros-chiffre";
import { EXEMPLES_ETAPES } from "../../src/briques/motion/petits-objets/etapes";
import { EXEMPLES_CARTON_DEFINITION } from "../../src/briques/motion/petits-objets/carton-definition";
import { EXEMPLES_SCHEMAS } from "../../src/briques/motion/petits-objets/schemas-relies";
import { EXEMPLES_FLUX } from "../../src/briques/motion/petits-objets/schema-flux";
import { EXEMPLES_FENETRE_APP } from "../../src/briques/motion/petits-objets/fenetre-app";
import { EXEMPLES_TERMINAL_COMMANDE } from "../../src/briques/motion/petits-objets/terminal-commande";
import { EXEMPLES_PANNEAU_REGLAGES } from "../../src/briques/motion/petits-objets/panneau-reglages";
import { EXEMPLES_GRILLE, EXEMPLES_VIGNETTES } from "../../src/briques/motion/petits-objets/grille-vignettes";
import { EXEMPLES_PELLICULE } from "../../src/briques/motion/petits-objets/pellicule";
import { EXEMPLES_FRISE } from "../../src/briques/motion/petits-objets/frise-montage";
import { EXEMPLES_DOSSIER_CHRONO_BARRE } from "../../src/briques/motion/petits-objets/dossier-chrono-barre";
import { EXEMPLES_ONDE } from "../../src/briques/motion/petits-objets/onde";
import { EXEMPLES_OBJET_TOURNE } from "../../src/briques/motion/petits-objets/objet-tourne";
import { EXEMPLES_POST_IT } from "../../src/briques/motion/petits-objets/post-it";
import { EXEMPLES_BULLES } from "../../src/briques/motion/petits-objets/bulles";
import { EXEMPLES_APPEL_ACTION } from "../../src/briques/motion/petits-objets/appel-action";
import { EXEMPLES_APPEL_MOT } from "../../src/briques/motion/petits-objets/appel-mot";
import { EXEMPLES_CARTON_MAGAZINE } from "../../src/briques/motion/petits-objets/carton-magazine";
import { EXEMPLES_ANNEAU } from "../../src/briques/motion/petits-objets/anneau-donnees";
import { ecrireNombreFr } from "../../src/briques/motion/petits-objets/gros-chiffre";
import type { FondAxion } from "../../src/briques/jetons-motion";

const FONDS: FondAxion[] = ["ivoire", "noir"];
const FORMATS = ["9x16", "4x5"] as const;
const compter = (m: string, attr: string) => (m.match(new RegExp(`data-${attr}="`, "g")) ?? []).length;
const somme = (o: Record<string, readonly unknown[]>) => Object.values(o).reduce((s, l) => s + l.length, 0);

// Nombre de définitions par exemple : une case par (définition × exemple).
const ATTENDU_ETIQUETTES =
  somme(EXEMPLES_ETIQUETTES) + EXEMPLES_CARTES.length + EXEMPLES_GROS_CHIFFRE.length + 2 * EXEMPLES_ETAPES.length + EXEMPLES_CARTON_DEFINITION.length + somme(EXEMPLES_SCHEMAS) + EXEMPLES_FLUX.length +
  EXEMPLES_APPEL_ACTION.length + EXEMPLES_APPEL_MOT.length + EXEMPLES_CARTON_MAGAZINE.length + EXEMPLES_ANNEAU.length;
const ATTENDU_ECRANS =
  EXEMPLES_FENETRE_APP.length + EXEMPLES_TERMINAL_COMMANDE.length + EXEMPLES_PANNEAU_REGLAGES.length + EXEMPLES_GRILLE.length + EXEMPLES_VIGNETTES.length + EXEMPLES_PELLICULE.length +
  EXEMPLES_FRISE.length + somme(EXEMPLES_DOSSIER_CHRONO_BARRE) + EXEMPLES_ONDE.length + EXEMPLES_OBJET_TOURNE.length;
const ATTENDU_MANUSCRIT = EXEMPLES_POST_IT.length + 3 * EXEMPLES_BULLES.length;

const PLANCHES = [
  { nom: "etiquettes", Composant: PlancheEtiquettes, entrees: ENTREES_ETIQUETTES, attendu: ATTENDU_ETIQUETTES },
  { nom: "ecrans", Composant: PlancheEcrans, entrees: ENTREES_ECRANS, attendu: ATTENDU_ECRANS },
  { nom: "manuscrit", Composant: PlancheManuscrit, entrees: ENTREES_MANUSCRIT, attendu: ATTENDU_MANUSCRIT },
] as const;

describe("C9-40a planches des familles", () => {
  for (const p of PLANCHES) {
    it(`${p.nom} : compte exact, identifiants uniques, paramètres valides`, () => {
      expect(p.entrees.length).toBe(p.attendu);
      expect(new Set(p.entrees.map((e) => e.id)).size).toBe(p.entrees.length);
      for (const e of p.entrees) expect(e.def.valider(e.parametres), e.id).not.toBeNull();
    });
    for (const fond of FONDS) for (const format of FORMATS) {
      it(`${p.nom} ${fond} ${format} : une case par exemple, silhouette témoin, déterministe, aucune image extérieure`, () => {
        const m = renderToStaticMarkup(createElement(p.Composant, { fond, format }));
        expect(compter(m, "objet")).toBe(p.attendu);
        expect(compter(m, "silhouette-temoin")).toBe(p.attendu);
        expect(m).toBe(renderToStaticMarkup(createElement(p.Composant, { fond, format })));
        expect(m).not.toMatch(/<image|<img|href=|url\(/);
      });
    }
    it(`${p.nom} : la marque « touche le visage » dit vrai, aucune case ne se chevauche`, () => {
      const m = renderToStaticMarkup(createElement(p.Composant, { fond: "ivoire", format: "4x5" }));
      const attendus = p.entrees.filter((e) => { const z = zoneDeLaCase(e); return z !== null && seChevauchent(z, ZONE_VISAGE_OBJETS); }).length;
      expect(compter(m, "chevauche-visage")).toBe(p.entrees.length);
      expect((m.match(/data-chevauche-visage="oui"/g) ?? []).length).toBe(attendus);
      const cases = [...m.matchAll(/data-case="([\d.]+),([\d.]+),([\d.]+)"/g)].map((r) => ({ x: +r[1], y: +r[2], largeur: +r[3], hauteur: +r[3] }));
      expect(cases.length).toBe(p.entrees.length);
      for (let i = 0; i < cases.length; i++) for (let j = i + 1; j < cases.length; j++) expect(seChevauchent(cases[i], cases[j])).toBe(false);
    });
  }
});

/** Balisage de la case `id` : de son `data-objet` jusqu'au suivant. */
const caseDe = (m: string, id: string): string => {
  const i = m.indexOf(`data-objet="${id}"`);
  expect(i, id).toBeGreaterThanOrEqual(0);
  const j = m.indexOf('data-objet="', i + 1);
  return m.slice(i, j < 0 ? undefined : j);
};
const decimalesDe = (v: number): number => (String(v).split(".")[1] ?? "").length;

describe("C9-40b-b chiffre et texte affichés = fournis", () => {
  const m = renderToStaticMarkup(createElement(PlancheEtiquettes, { fond: "ivoire", format: "9x16" }));
  it("anneau : le chiffre fourni est écrit", () => {
    EXEMPLES_ANNEAU.forEach((e, i) => expect(caseDe(m, `objet-anneau-donnees#${i + 1}`)).toContain(ecrireNombreFr(e.valeur, decimalesDe(e.valeur))));
  });
  it("appel à l'action : le texte exact est écrit", () => {
    EXEMPLES_APPEL_ACTION.forEach((e, i) => expect(caseDe(m, `objet-appel-action#${i + 1}`)).toContain(e.texte));
  });
  it("appel « Tape MOT » : le mot en capitales est écrit", () => {
    EXEMPLES_APPEL_MOT.forEach((e, i) => expect(caseDe(m, `objet-appel-mot#${i + 1}`)).toContain(e.mot.toLocaleUpperCase("fr")));
  });
  it("carton magazine : le mot-clé est écrit (casse indifférente)", () => {
    EXEMPLES_CARTON_MAGAZINE.forEach((e, i) => expect(caseDe(m, `objet-carton-magazine#${i + 1}`).toLocaleLowerCase("fr")).toContain(e.motCle.toLocaleLowerCase("fr")));
  });
});

const racineStudio = join(__dirname, "..", "..", "studio-rendu");
// `RacinePlanches.tsx` importe `remotion` (absent des modules racine) : on lit sa source, comme le fait la garde de C9-39.
const IDS_ATTENDUS = ["etiquettes", "ecrans", "manuscrit"].flatMap((nom) => FORMATS.flatMap((f) => FONDS.map((fond) => `planche-${nom}-${f}-${fond}`)));

describe("C9-40a racine", () => {
  it("12 compositions neuves (3 planches × 2 formats × 2 fonds), identifiants uniques et distincts des traits", () => {
    expect(IDS_ATTENDUS.length).toBe(12);
    expect(new Set(IDS_ATTENDUS).size).toBe(12);
    const racine = readFileSync(join(racineStudio, "compositions", "petits-objets", "planche", "RacinePlanches.tsx"), "utf8");
    expect(racine).toContain("`planche-${nom}-${f}-${fond}`");
    for (const nom of ["etiquettes", "ecrans", "manuscrit"]) expect(racine).toContain(`nom: "${nom}"`);
    for (const id of IDS_ATTENDUS) expect(id.startsWith("planche-traits-")).toBe(false);
  });
  it("tous les identifiants sont dans IDS du script", () => {
    const script = readFileSync(join(racineStudio, "scripts", "planche-petits-objets.ts"), "utf8");
    const ligne = /^const IDS = \[[\s\S]*?\];/m.exec(script)?.[0] ?? "";
    for (const id of IDS_ATTENDUS) expect(ligne).toContain(`"${id}"`);
  });
  it("aucune ligne dans compositions/Racine.tsx", () => {
    const t = readFileSync(join(__dirname, "..", "..", "studio-rendu", "compositions", "Racine.tsx"), "utf8");
    expect(t).not.toMatch(/planche|Planche/);
  });
  it("aucun @/ ni src/services, aucune police hors Manrope, dans les 3 planches", () => {
    for (const f of ["PlancheEtiquettes", "PlancheEcrans", "PlancheManuscrit"]) {
      const t = readFileSync(join(__dirname, "..", "..", "studio-rendu", "compositions", "petits-objets", "planche", `${f}.tsx`), "utf8");
      expect(t, f).not.toMatch(/@\/|src\/services|\/services\//);
      expect(t, f).not.toMatch(/fontFamily:\s*["'`]/);
    }
  });
});
