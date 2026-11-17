/** C9-24 — dossier, chronomètre, barre de progression (pièces pures, non inscrites). */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEF_BARRE_PROGRESSION, DEF_CHRONO, DEF_DOSSIER, EXEMPLES_DOSSIER_CHRONO_BARRE, formaterChrono, tonBarre,
} from "../../src/briques/motion/petits-objets/dossier-chrono-barre";
import { verifierDefinition, type DefinitionObjet, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { PALETTE } from "../../src/briques/charte/axion-2026";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { IMAGES_SORTIE } from "../../src/briques/motion/petits-objets/progres";
import { garderObjet } from "../../src/briques/plan-scenes-objets";

const CHEMIN = new URL("../../src/briques/motion/petits-objets/dossier-chrono-barre.tsx", import.meta.url);
const DEFS = [DEF_DOSSIER, DEF_CHRONO, DEF_BARRE_PROGRESSION] as unknown as DefinitionObjet<unknown>[];
const VALIDES: unknown[] = [{ feuilles: 3 }, { dureeSec: 1260 }, { progression: 0.5 }];
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const D = 60;
const rendre = (def: DefinitionObjet<unknown>, p: unknown, image: number, ton: TonObjet = "neutre", fond: "ivoire" | "noir" = "noir", graine = 7) =>
  renderToStaticMarkup(def.Rendu({ image, fps: 25, dureeImages: D, fond, ton, graine, parametres: p }));

const MOTIFS: RegExp[] = [/@\//, /\bzod\b/, /Math\.random/, /remotion/, /from\s+["'][^"']*moteurs\//, /from\s+["'][^"']*-v4/, /VideoAnimeeV4/, /briques-v4/, /faits-script/, /from\s+["'][^"']*\/droits/, /bibliotheque-video/, /src\/domaine|from\s+["'][^"']*\/domaine\//, /from\s+["'][^"']*\/services\//];

describe("C9-24 contrat", () => {
  it("ids, familles, capacités, données", () => {
    expect(DEFS.map((d) => [d.id, d.famille, d.capacite, d.donnees])).toEqual([
      ["objet-dossier", "schema", "objet.schema", "aucune"],
      ["objet-chrono", "chiffre", "objet.chiffre", "nombres-dits"],
      ["objet-barre-progression", "chiffre", "objet.chiffre", "aucune"],
    ]);
    for (const d of DEFS) expect(verifierDefinition(d)).toBe("ok");
  });
  it("valider ne lève jamais et renvoie null sur entrée mauvaise", () => {
    const mauvaises = [undefined, null, {}, 5, "un deux trois quatre cinq", [], { feuilles: 0 }, { feuilles: 6 }, { dureeSec: -1 }, { dureeSec: 1.5 }, { progression: 2 }, { progression: NaN }];
    for (const d of DEFS) for (const m of mauvaises) expect(() => d.valider(m)).not.toThrow();
    for (const d of DEFS) for (const m of [undefined, null, {}, 5, "un deux trois quatre cinq"]) expect(d.valider(m)).toBeNull();
    expect(DEF_DOSSIER.valider({ feuilles: 6 })).toBeNull();
    expect(DEF_CHRONO.valider({ dureeSec: 1.5 })).toBeNull();
    expect(DEF_BARRE_PROGRESSION.valider({ progression: 1.2 })).toBeNull();
  });
  it("valide les exemples", () => {
    const ex = EXEMPLES_DOSSIER_CHRONO_BARRE;
    for (const e of ex.dossier) expect(DEF_DOSSIER.valider(e)).not.toBeNull();
    for (const e of ex.chrono) expect(DEF_CHRONO.valider(e)).not.toBeNull();
    for (const e of ex.barre) expect(DEF_BARRE_PROGRESSION.valider(e)).not.toBeNull();
  });
});

describe("C9-24 rendu", () => {
  it("même entrée = même balisage", () => {
    DEFS.forEach((d, i) => expect(rendre(d, VALIDES[i], 20)).toBe(rendre(d, VALIDES[i], 20)));
  });
  it("image 0 : tracé à 0 ; dernière image : opacité 0 ; sortie en 6 images", () => {
    DEFS.forEach((d, i) => {
      expect(rendre(d, VALIDES[i], 0)).toContain('stroke-dashoffset="1"');
      expect(rendre(d, VALIDES[i], D - 1)).toMatch(/opacity="0"/);
      const sous = Array.from({ length: D }, (_, k) => k).filter((k) => !/opacity="1"/.test(rendre(d, VALIDES[i], k)) && k > 10);
      expect(sous).toHaveLength(IMAGES_SORTIE);
    });
  });
  it("couleurs de la charte, orange jamais sur ivoire, aucun filtre", () => {
    DEFS.forEach((d, i) => {
      for (const fond of ["ivoire", "noir"] as const) for (const ton of TONS) {
        const m = rendre(d, VALIDES[i], 30, ton, fond);
        const permises = new Set(TONS.map((t) => couleurDuTon(t, fond)));
        for (const c of m.matchAll(/(?:stroke|fill)="(#[0-9a-fA-F]+)"/g)) expect(permises.has(c[1]!)).toBe(true);
        expect(m).not.toMatch(/filter|mask|drop-shadow/i);
      }
      for (const ton of TONS) expect(rendre(d, VALIDES[i], 30, ton, "ivoire").toLowerCase()).not.toContain(PALETTE.orange.toLowerCase());
    });
  });
  it("entrée invalide : rendu vide sans exception", () => {
    for (const d of DEFS) expect(() => rendre(d, null, 10)).not.toThrow();
  });
});

describe("C9-24 propres à la fiche", () => {
  it("dossier : une feuille de plus = un tracé de plus, aucune couleur jaune/vert/bleu", () => {
    const n = (k: number) => (rendre(DEF_DOSSIER as DefinitionObjet<unknown>, { feuilles: k }, 30).match(/<path/g) ?? []).length;
    expect(n(1)).toBe(2);
    expect(n(5)).toBe(6);
  });
  it("chrono : affichage final = durée exacte", () => {
    const d = DEF_CHRONO as DefinitionObjet<unknown>;
    expect(formaterChrono(1260)).toBe("21:00");
    expect(formaterChrono(95)).toBe("01:35");
    expect(rendre(d, { dureeSec: 1260 }, 30)).toContain(">21:00<");
    expect(rendre(d, { dureeSec: 95 }, 30)).toContain(">01:35<");
    expect(rendre(d, { dureeSec: 95 }, 1)).not.toContain(">01:35<");
    expect(rendre(d, { dureeSec: 95 }, 30)).toContain("Axion Manrope");
  });
  it("chrono : garderObjet refuse « 21 minutes » non dit, accepte si dit", () => {
    const d = DEF_CHRONO as DefinitionObjet<unknown>;
    const m = (texte: string, i: number) => ({ texte, debutMs: i * 300, finMs: i * 300 + 250 });
    const sans = [m("bonjour", 0), m("tout", 1), m("le", 2), m("monde", 3)];
    const avec = [m("en", 0), m("90", 1), m("secondes", 2)];
    expect(typeof garderObjet(d, { dureeSec: 1260 }, { mots: sans as never, premier: 0, dernier: 3 })).toBe("object");
    expect(garderObjet(d, { dureeSec: 90 }, { mots: avec as never, premier: 0, dernier: 2 })).toBe("ok");
    // Limite connue de C9-04 : « 21 minutes » ne donne que 21 (unité d'origine), jamais 1260 s : 1260 est refusé même si dit. Voir journal.
    const minutes = [m("en", 0), m("21", 1), m("minutes", 2)];
    expect(typeof garderObjet(d, { dureeSec: 1260 }, { mots: minutes as never, premier: 0, dernier: 2 })).toBe("object");
  });
  it("barre : à 100 % sans preuve, jamais sauge", () => {
    const sauge = PALETTE.reussite;
    const b = DEF_BARRE_PROGRESSION as DefinitionObjet<unknown>;
    for (const fond of ["ivoire", "noir"] as const) {
      expect(rendre(b, { progression: 1 }, 30, "valide", fond)).not.toContain(sauge);
      expect(rendre(b, { progression: 1, preuve: "  " }, 30, "valide", fond)).not.toContain(sauge);
      expect(rendre(b, { progression: 0.6, preuve: "ok" }, 30, "valide", fond)).not.toContain(sauge);
      expect(rendre(b, { progression: 1, preuve: "tableau terminé" }, 30, "valide", fond)).toContain(sauge);
    }
    expect(tonBarre({ progression: 1 }, "valide")).toBe("accent");
    expect(tonBarre({ progression: 1, preuve: "x" }, "valide")).toBe("valide");
  });
  it("barre : aucun nombre écrit", () => {
    expect(rendre(DEF_BARRE_PROGRESSION as DefinitionObjet<unknown>, { progression: 0.5 }, 30)).not.toMatch(/<text/);
  });
});

describe("C9-24 garde statique du fichier", () => {
  const texte = readFileSync(CHEMIN, "utf8");
  it("aucun motif interdit", () => { for (const re of MOTIFS) expect(re.test(texte)).toBe(false); });
  it("aucun littéral de courbe ni couleur", () => {
    expect(texte).not.toMatch(/cubic-bezier|Easing\.bezier|damping|stiffness|\bmass\b/);
    expect(texte).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
  it("non inscrit : rien ne l'importe", () => {
    expect(readFileSync(new URL("../../src/briques/motion/petits-objets/index.ts", import.meta.url), "utf8")).not.toMatch(/dossier-chrono-barre/);
  });
});
