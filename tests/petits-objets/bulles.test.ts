/** C9-26 — bulles de parole, de pensée et de notification : pièces pures non inscrites. */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXEMPLES_BULLES,
  OBJET_BULLE_NOTIFICATION,
  OBJET_BULLE_PAROLE,
  OBJET_BULLE_PENSEE,
  type ParametresBulle,
} from "../../src/briques/motion/petits-objets/bulles";
import { verifierDefinition, type DefinitionObjet, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";
import { PALETTE } from "../../src/briques/charte/axion-2026";
import { garderObjet } from "../../src/briques/plan-scenes-objets/garde";

const TOUS = [OBJET_BULLE_PAROLE, OBJET_BULLE_PENSEE, OBJET_BULLE_NOTIFICATION] as unknown as DefinitionObjet<ParametresBulle>[];
const P: ParametresBulle = { texte: "Pas besoin", queue: -1 };
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const FONDS: FondAxion[] = ["ivoire", "noir"];
const D = 60;

function rendre(def: DefinitionObjet<ParametresBulle>, image: number, o: { graine?: number; ton?: TonObjet; fond?: FondAxion; p?: ParametresBulle } = {}) {
  return renderToStaticMarkup(
    def.Rendu({ image, fps: 25, dureeImages: D, fond: o.fond ?? "ivoire", parametres: o.p ?? P, ton: o.ton ?? "neutre", graine: o.graine ?? 7 }),
  );
}
const decalages = (m: string) => [...m.matchAll(/stroke-dashoffset="([^"]+)"/g)].map((x) => Number(x[1]));
/** Opacité du groupe racine (la première du balisage). */
const opaciteGroupe = (m: string) => Number(/<g opacity="([^"]+)"/.exec(m)?.[1]);

describe("C9-26 contrat", () => {
  it("trois identifiants propres, famille etiquette, capacité objet.etiquette, mots dits", () => {
    expect(TOUS.map((d) => d.id)).toEqual(["objet-bulle-parole", "objet-bulle-pensee", "objet-bulle-notification"]);
    for (const d of TOUS) {
      expect(verifierDefinition(d)).toBe("ok");
      expect(d.famille).toBe("etiquette");
      expect(d.capacite).toBe("objet.etiquette");
      expect(d.donnees).toBe("mots-dits");
      expect(d.id).not.toMatch(/profil|commentaire/);
    }
  });
  it("valider ne lève jamais et refuse les mauvaises entrées", () => {
    for (const d of TOUS) {
      for (const mauvais of [undefined, null, {}, 42, "un deux", { texte: "un deux trois quatre cinq", queue: 0 }, { texte: "", queue: 0 }, { texte: "salut", queue: 2 }, { texte: "salut", queue: "bas" }, { texte: 3, queue: 0 }])
        expect(d.valider(mauvais)).toBeNull();
      expect(d.valider(P)).toEqual(P);
    }
    for (const d of [OBJET_BULLE_PAROLE, OBJET_BULLE_PENSEE] as unknown as DefinitionObjet<ParametresBulle>[]) expect(d.valider({ texte: "salut" })).toBeNull();
    expect(OBJET_BULLE_NOTIFICATION.valider({ texte: "salut" })).toEqual({ texte: "salut" });
    for (const d of TOUS) {
    }
  });
  it("exemples valides", () => {
    for (const d of TOUS) for (const e of EXEMPLES_BULLES) expect(d.valider(e)).not.toBeNull();
  });
});

describe("C9-26 rendu", () => {
  it("déterministe, tracé à 0 en image 0, opacité 0 à la dernière image, tenue pleine", () => {
    for (const d of TOUS) {
      expect(rendre(d, 20)).toBe(rendre(d, 20));
      expect(decalages(rendre(d, 0)).every((x) => x === 1)).toBe(true);
      expect(opaciteGroupe(rendre(d, 0))).toBe(1);
      expect(rendre(d, 0)).not.toContain(P.texte.split(" ")[0] + "</text>");
      expect(opaciteGroupe(rendre(d, D - 1))).toBe(0);
      expect(decalages(rendre(d, 30)).every((x) => x === 0)).toBe(true);
      expect(opaciteGroupe(rendre(d, 30))).toBe(1);
    }
  });
  it("sortie en 6 images exactement", () => {
    for (const d of TOUS) {
      const sous = Array.from({ length: D }, (_, i) => i).filter((i) => i > 10 && opaciteGroupe(rendre(d, i)) < 1);
      expect(sous).toEqual([54, 55, 56, 57, 58, 59]);
    }
  });
  it("texte après contour, à chaque image : opacité du texte > 0 ⇒ corps entièrement tracé", () => {
    for (const d of TOUS) for (let i = 0; i < D; i++) {
      const m = rendre(d, i);
      const op = Number(/<text[^>]* opacity="([^"]+)"/.exec(m)?.[1]);
      if (op > 0) expect(decalages(m)[0]).toBe(0);
    }
  });
  it("le texte apparaît après le contour", () => {
    for (const d of TOUS) {
      const opTexte = (i: number) => Number(/<text[^>]* opacity="([^"]+)"/.exec(rendre(d, i))?.[1]);
      expect(opTexte(0)).toBe(0);
      expect(opTexte(1)).toBe(0);
      expect(Math.min(...decalages(rendre(d, 1)))).toBeLessThan(1);
      expect(opTexte(30)).toBe(1);
    }
  });
  it("couleurs de la charte seulement, aucun filter/mask/drop-shadow", () => {
    for (const d of TOUS) for (const fond of FONDS) for (const ton of TONS) {
      const m = rendre(d, 30, { fond, ton });
      const permis = [couleurDuTon(ton, fond), couleursSur(fond).texte];
      for (const c of m.matchAll(/stroke="([^"]+)"/g)) expect(permis).toContain(c[1]);
      for (const c of m.matchAll(/ fill="([^"]+)"/g)) if (c[1] !== "none") expect(permis).toContain(c[1]);
      expect(m).not.toMatch(/filter|mask|drop-shadow/i);
      expect(m).not.toMatch(/jaune|yellow|green|blue/i);
      if (fond === "ivoire" && ton === "accent") expect(m).not.toContain(PALETTE.orange);
    }
  });
});

describe("C9-26 propres à la fiche", () => {
  it("le texte rendu = le texte passé, en Manrope, rien d'autre", () => {
    for (const d of TOUS) {
      const m = rendre(d, 30);
      expect([...m.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((x) => x[1])).toEqual([P.texte]);
      expect(m).toContain("Axion Manrope");
    }
  });
  it("la queue change le tracé de la parole ; la pensée a trois ronds et pas de queue", () => {
    const d = (q: -1 | 0 | 1) => rendre(OBJET_BULLE_PAROLE, 30, { p: { texte: "salut", queue: q } });
    expect(new Set(([-1, 1, 0] as const).map((q) => d(q))).size).toBe(3);
    const pensee = rendre(OBJET_BULLE_PENSEE, 30);
    expect(decalages(pensee).length).toBe(4);
    expect(decalages(rendre(OBJET_BULLE_PAROLE, 30)).length).toBe(1);
  });
  it("notification : aucun nom d'application, aucun logo, aucune heure inventée", () => {
    const m = rendre(OBJET_BULLE_NOTIFICATION, 30);
    expect(m).not.toMatch(/<image|<use|href/i);
    expect([...m.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((x) => x[1]).join(" ")).not.toMatch(/\d/);
    expect([...m.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((x) => x[1])).toEqual([P.texte]);
  });
  it("garderObjet refuse un texte non dit et accepte un texte dit (accord avec C9-04)", () => {
    const mot = (texte: string, i: number) => ({ texte, debut: i, fin: i + 0.4 }) as never;
    const mots = [mot("pas", 0), mot("besoin", 1), mot("de", 2), mot("plus", 3)];
    const ctx = { mots, premier: 0, dernier: 3 };
    for (const d of TOUS) {
      expect(garderObjet(d as unknown as DefinitionObjet<unknown>, { texte: "ailleurs ici", queue: 0 }, ctx)).toEqual({ refus: "mots non dits" });
      expect(garderObjet(d as unknown as DefinitionObjet<unknown>, { texte: "Pas besoin", queue: 0 }, ctx)).toBe("ok");
    }
  });
});

describe("C9-26 garde statique du fichier (13 motifs de garde.test.ts:8-22, copiés)", () => {
  const texte = readFileSync(join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", "bulles.tsx"), "utf8");
  const MOTIFS: [string, RegExp][] = [
    ["@/", /@\//], ["zod", /\bzod\b/], ["Math.random", /Math\.random/], ["remotion", /remotion/],
    ["moteurs/", /from\s+["'][^"']*moteurs\//], ["-v4", /from\s+["'][^"']*-v4/], ["VideoAnimeeV4", /VideoAnimeeV4/],
    ["briques-v4", /briques-v4/], ["faits-script", /faits-script/], ["droits", /from\s+["'][^"']*\/droits/],
    ["bibliotheque-video", /bibliotheque-video/], ["domaine", /src\/domaine|from\s+["'][^"']*\/domaine\//], ["services", /from\s+["'][^"']*\/services\//],
  ];
  it("aucun motif interdit", () => {
    expect(MOTIFS.filter(([, re]) => re.test(texte)).map(([n]) => n)).toEqual([]);
  });
  it("ni filtre, ni masque, ni courbe littérale, ni ressort", () => {
    expect(texte).not.toMatch(/drop-shadow|<mask|<filter|\bfilter\s*[=:]|cubic-bezier|Easing\.bezier|damping|stiffness|mass\s*:/);
  });
});
