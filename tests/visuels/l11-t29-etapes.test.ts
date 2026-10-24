/**
 * Lot L10 / L11 des carrousels : T29 « relance » (avant-dernière page qui relance l'attention : une question ou une phrase forte, puis le
 * rappel de ce que le lecteur a vu) et la variante « étapes à mini-maquettes » de T20 (chaque étape montre un petit écran dessiné en SVG).
 * Contrats du registre, du schéma, de la porte, des textes posés par le code et des sources de la composition ; le rendu réel est contrôlé par
 * `studio-rendu/scripts/essai-l10-l11.ts`.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAQUETTES, maquettesDesEtapes } from "@/briques/visuels/maquettes-etapes";
import { placesDesMots } from "@/briques/visuels/places-mots";
import { CAPACITE_RELANCE, PAGES, TYPES_PAGE } from "@/briques/visuels/registre-pages";
import { RUBRIQUES, TEXTES_FIXES_L11 } from "@/briques/visuels/textes-fixes";
import { controlerCarrousel } from "@/domaine/controles-visuel/porte";
import { CarrouselSpec } from "@/domaine/visuels/schema";
import { EXEMPLES_PAGES } from "@/visuels/texte/aide-format";
import { varianteEtapes } from "../../studio-rendu/compositions/visuels/pages/T20";

const RACINE = new URL("../../studio-rendu/compositions/visuels/", import.meta.url);
const lire = (f: string) => readFileSync(new URL(f, RACINE), "utf8");

const couv = { type: "T01", titre: "Une couverture" };
const fin = { type: "T21" };
const spec = (...pages: object[]) => ({ version: "carrousel/1", alt: "Un carrousel d'essai", pages: [couv, ...pages, fin] });
const valide = (page: object) => CarrouselSpec.safeParse(spec(page)).success;

const T29 = { type: "T29", relance: "Et chez vous, par où commencer ?", rappels: [{ texte: "Repérer une tâche qui revient" }, { texte: "Garder la main sur chaque étape" }] };
const etapes = [
  { titre: "Lister les tâches", corps: "Noter ce qui revient." },
  { titre: "Répondre au message", corps: "Un brouillon prêt." },
  { titre: "Valider", corps: "Vous gardez la main." },
];
const T20 = { type: "T20", titre: "La méthode type", etapes };

describe("L11 : T29 au registre", () => {
  it("T29 rejoint les types ; T25 (grand chiffre) reste éteint", () => {
    expect(TYPES_PAGE).toContain("T29");
    expect(TYPES_PAGE).not.toContain("T25");
  });
  it("famille « appel », 2 à 3 rappels, pas de titre de page (la relance est le grand texte), pas de cartes", () => {
    expect(PAGES.T29.famille).toBe("appel");
    expect(PAGES.T29.elements).toEqual({ min: 2, max: 3 });
    expect(PAGES.T29.titreMax).toBe(0);
    expect(PAGES.T29.cartesMax).toBe(0);
  });
});

describe("L11 : schéma de T29", () => {
  it("un contenu ordinaire est accepté", () => {
    expect(CarrouselSpec.safeParse(spec(T29)).error?.issues ?? []).toEqual([]);
  });
  it("relance et rappels bornés par leur budget ; 2 à 3 rappels ; clé inconnue et lien refusés", () => {
    expect(valide({ ...T29, relance: "x".repeat(CAPACITE_RELANCE.relance) })).toBe(true);
    expect(valide({ ...T29, relance: "x".repeat(CAPACITE_RELANCE.relance + 1) })).toBe(false);
    const r = (n: number, longueur = 10) => Array.from({ length: n }, () => ({ texte: "x".repeat(longueur) }));
    expect(valide({ ...T29, rappels: r(1) })).toBe(false);
    expect(valide({ ...T29, rappels: r(4) })).toBe(false);
    expect(valide({ ...T29, rappels: r(3, CAPACITE_RELANCE.rappel) })).toBe(true);
    expect(valide({ ...T29, rappels: r(3, CAPACITE_RELANCE.rappel + 1) })).toBe(false);
    expect(valide({ ...T29, couleur: "orange" })).toBe(false);
    expect(valide({ ...T29, relance: "Voir www.exemple.fr" })).toBe(false);
  });
  it("T29 n'est pas la page sombre : il peut précéder T21, et T21 reste la dernière", () => {
    expect(CarrouselSpec.safeParse({ version: "carrousel/1", alt: "Essai", pages: [couv, fin, T29] }).success).toBe(false);
  });
  it("l'aide au format a un exemple valide de T29", () => {
    expect(CarrouselSpec.safeParse(spec(EXEMPLES_PAGES.T29)).success).toBe(true);
  });
});

describe("L11 : porte qualité sur T29", () => {
  const ctx = { faitsDisponibles: false, interditsDans: () => [] };
  const codes = (page: object) => controlerCarrousel(spec(page), ctx).rapport.controles.map((c) => c.code);
  it("un contenu ordinaire n'a aucune faute rouge", () => {
    expect(controlerCarrousel(spec(T29), ctx).rapport.controles.filter((c) => c.niveau === "rouge")).toEqual([]);
  });
  it("aucun chiffre factuel dans la relance ni dans un rappel (les expressions bannies sont contrôlées sur tout texte, tests L9)", () => {
    expect(codes({ ...T29, relance: "Vous gagnez trois heures ?" })).toContain("CHIFFRE");
    expect(codes({ ...T29, rappels: [{ texte: "Vous gagnez trois heures" }, T29.rappels[1]] })).toContain("CHIFFRE");
  });
  it("chaque rappel a sa place de mot (MOT_TROP_LONG) : 24 lettres larges refusées, « professionnalisation » acceptée", () => {
    expect(placesDesMots(T29 as never).map((p) => p.chemin)).toEqual(["rappels.0.texte", "rappels.1.texte"]);
    expect(codes({ ...T29, rappels: [{ texte: "MWMWMWMWMWMWMWMWMWMWMWMW" }, T29.rappels[1]] })).toContain("MOT_TROP_LONG");
    expect(codes({ ...T29, rappels: [{ texte: "Professionnalisation" }, T29.rappels[1]] })).not.toContain("MOT_TROP_LONG");
  });
});

describe("L11 : consigne de session", () => {
  const consigne = readFileSync(new URL("../../scripts/visuels/consigne-session-carrousel.md", import.meta.url), "utf8");
  const ligne = (t: string) => consigne.split("\n").find((l) => l.startsWith(`| ${t} |`)) ?? "";
  it("donne T29 avec ses budgets du registre et quand le choisir, et la variante « maquettes » de T20", () => {
    expect(ligne("T29")).toContain(`relance ${CAPACITE_RELANCE.relance} ; chaque rappel ${CAPACITE_RELANCE.rappel}`);
    expect(consigne).toMatch(/\*\*T29 relance\*\*/);
    expect(ligne("T20")).toContain("`variante` (facultative : `maquettes`)");
  });
});

describe("L11 : textes de T29 posés par le code", () => {
  it("rubrique en capitales et étiquette du rappel : sans chiffre, sans lien, sans promesse, admis par le schéma", () => {
    expect(RUBRIQUES.T29).toBe(RUBRIQUES.T29.toLocaleUpperCase("fr-FR"));
    for (const t of [RUBRIQUES.T29, ...Object.values(TEXTES_FIXES_L11)]) {
      expect(t).not.toMatch(/\d|https?:|www\.|@/i);
      expect(CarrouselSpec.safeParse({ version: "carrousel/1", alt: t, pages: [couv, fin] }).success, t).toBe(true);
    }
  });
});

describe("L11 : sources de la composition T29", () => {
  const src = lire("pages/T29.tsx");
  it("composant branché dans VisuelPage, rubrique par PageBase, texte borné à x = 912 / 860", () => {
    expect(lire("VisuelPage.tsx")).toContain('case "T29":');
    expect(src).toContain('type="T29"');
    expect(src).toMatch(/largeurTexteMax\(/);
    expect(src).toContain("BORD_DROIT_TEXTE_BAS");
    expect(src).not.toMatch(/from "@\/|from "zod"|server-only|from "[^"]+\.js"/);
  });
  it("PAS une page sombre : fond crème de PageBase, aucun fond encre ; aucune image externe ; aucun bleu", () => {
    expect(src).toContain("<PageBase");
    expect(src).not.toMatch(/background: COULEURS\.encre/);
    expect(src).not.toMatch(/<img|<Img|staticFile|https?:/);
    expect(src).not.toMatch(/bleu|blue|turquoise|#0[0-9a-f]{2}[89a-f]/i);
  });
  it("relance en capitales (Titre ajusté), étiquette du rappel posée par le code, aucun corps sous 26 px", () => {
    expect(src).toContain("<Titre");
    expect(src).toContain("TEXTES_FIXES_L11.t29Rappel");
    for (const m of src.matchAll(/fontSize: (?:k\()?(\d+)/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(26);
  });
  it("chaque dessin fait sur place est posé dans l'enveloppe `Dessin`", () => {
    const composants = [...src.matchAll(/function (\w+)\([^)]*\)[^{]*\{(?:(?!\nfunction )[\s\S])*?<svg/g)].map((m) => m[1]);
    expect(composants.length).toBeGreaterThan(0);
    for (const c of composants) {
      const usages = [...src.matchAll(new RegExp(`<${c}[\\s/>]`, "g"))].length;
      const enveloppes = [...src.matchAll(new RegExp(`<Dessin[^>]*>\\s*<${c}[\\s/>]`, "g"))].length;
      expect(enveloppes, c).toBe(usages);
    }
  });
});

describe("L10 : variante « étapes à mini-maquettes » de T20", () => {
  it("schéma : la clé `variante` est facultative ; seule « maquettes » est admise", () => {
    expect(valide(T20)).toBe(true);
    expect(valide({ ...T20, variante: "maquettes" })).toBe(true);
    expect(valide({ ...T20, variante: "photos" })).toBe(false);
  });
  it("choix de la variante par le code : sans la clé, l'ancienne page (rendu identique) ; avec, les mini-maquettes", () => {
    expect(varianteEtapes(T20 as never)).toBe("classique");
    expect(varianteEtapes({ ...T20, variante: "maquettes" } as never)).toBe("maquettes");
  });
  it("chaque étape reçoit une maquette choisie d'après son texte, toutes différentes, toujours la même pour le même texte", () => {
    const choix = maquettesDesEtapes(etapes);
    expect(choix).toEqual(["liste", "messages", "validation"]);
    expect(maquettesDesEtapes(etapes)).toEqual(choix);
    for (const n of [3, 4, 5]) {
      const neutres = Array.from({ length: n }, (_, i) => ({ titre: `Étape neutre ${"a".repeat(i)}`, corps: "Un texte sans mot-clé." }));
      const m = maquettesDesEtapes(neutres);
      expect(m).toHaveLength(n);
      expect(new Set(m).size, `${n}`).toBe(n);
      for (const x of m) expect(MAQUETTES).toContain(x);
    }
  });
  it("mini-maquettes en SVG maison : rectangles, barres, coches ; aucun texte, aucun logo, aucune image ; dans l'enveloppe `Dessin`", () => {
    const src = lire("pages/maquettes-etapes.tsx");
    expect(src).not.toMatch(/<text|<img|<Img|<image|staticFile|https?:|logo/i);
    expect(src).not.toMatch(/bleu|blue|turquoise/i);
    expect(src).toMatch(/<rect/);
    for (const m of MAQUETTES) expect(src, m).toContain(`${m}:`);
    const t20 = lire("pages/T20.tsx");
    expect(t20).toMatch(/<Dessin[^>]*>\s*<MiniMaquette/);
    for (const m of t20.matchAll(/fontSize: (?:k\()?(\d+)/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(26);
  });
  it("VisuelPage choisit la variante par le code et la passe à T20", () => {
    expect(lire("VisuelPage.tsx")).toMatch(/variante=\{varianteEtapes\(page\)\}/);
  });
  it("la place des mots de la variante est connue de la porte (colonne plus étroite)", () => {
    const classique = placesDesMots(T20 as never);
    const maquettes = placesDesMots({ ...T20, variante: "maquettes" } as never);
    expect(classique).toEqual([]);
    expect(maquettes.map((p) => p.chemin)).toEqual(etapes.flatMap((_, i) => [`etapes.${i}.titre`, `etapes.${i}.corps`]));
  });
});
