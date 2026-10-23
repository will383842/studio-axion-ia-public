import { afterEach, describe, expect, it, vi } from "vitest";
import { CarrouselSpec } from "@/domaine/visuels/schema";
import { chiffresDe } from "@/domaine/image-video/chiffres";
import { PAGES, TYPES_COUVERTURE } from "@/briques/visuels/registre-pages";
import { creerFournisseurSimulation } from "@/visuels/texte/simulation";
import { FIXTURES, FIXTURES_AXION } from "@/visuels/texte/fixtures";

const SUJETS = [
  "Ranger son bureau le matin",
  "Les gestes d'un atelier propre",
  "Préparer une réunion calme",
  "Classer des dossiers sans stress",
  "Entretenir ses outils de bricolage",
  "Écrire un message clair",
  "Organiser un établi",
  "Accueillir un visiteur",
  "Tenir un carnet de bord",
  "Réparer une chaise bancale",
];

const MOTS_NOMBRE = /(?<![\p{L}])(?:deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|vingt|trente|cent|mille|zéro|premier|première|deuxième|seconde|second)(?![\p{L}])/iu;

const CLES_TECHNIQUES = new Set(["id", "version", "type", "mini", "deco"]);

/** Textes lisibles seulement : les champs techniques (version, type, mini, deco, id) sont exclus. */
function textesDe(valeur: unknown): string[] {
  if (typeof valeur === "string") return [valeur];
  if (Array.isArray(valeur)) return valeur.flatMap(textesDe);
  if (valeur && typeof valeur === "object") return Object.entries(valeur).filter(([k]) => !CLES_TECHNIQUES.has(k)).flatMap(([, v]) => textesDe(v));
  return [];
}

afterEach(() => vi.restoreAllMocks());

describe("fournisseur de simulation", () => {
  const fournisseur = creerFournisseurSimulation();

  it("est en mode simulation", () => {
    expect(fournisseur.mode).toBe("simulation");
  });

  it("10 sujets donnent 10 specs valides de 6 à 8 pages", async () => {
    for (const sujet of SUJETS) {
      const r = await fournisseur.ecrire({ type: "sujet", sujet });
      const lu = CarrouselSpec.safeParse(r.spec);
      expect(lu.success, sujet).toBe(true);
      const n = (r.spec as { pages: unknown[] }).pages.length;
      expect(n, sujet).toBeGreaterThanOrEqual(6);
      expect(n, sujet).toBeLessThanOrEqual(8);
      expect(r.mode).toBe("simulation");
      expect(r.titre.length).toBeGreaterThan(0);
      expect(r.titre.length).toBeLessThanOrEqual(120);
      expect(r.pourquoi).toHaveLength(n);
    }
  });

  it("le même sujet donne la même spec, sans tenir compte de la casse ni des accents", async () => {
    const a = await fournisseur.ecrire({ type: "sujet", sujet: "Ranger son bureau le matin" });
    const b = await fournisseur.ecrire({ type: "sujet", sujet: "Ranger son bureau le matin" });
    const c = await fournisseur.ecrire({ type: "sujet", sujet: "  RANGER son  bureau le matin " });
    expect(b).toEqual(a);
    expect(JSON.stringify((c.spec as { pages: unknown[] }).pages.slice(1))).toBe(JSON.stringify((a.spec as { pages: unknown[] }).pages.slice(1)));
  });

  it("produit au moins 3 plans distincts sur 10 sujets", async () => {
    const plans = new Set<string>();
    for (const sujet of SUJETS) {
      const r = await fournisseur.ecrire({ type: "sujet", sujet });
      plans.add((r.spec as { pages: { type: string }[] }).pages.map((p) => p.type).join("-") + "|" + r.pourquoi[1]);
    }
    expect(plans.size).toBeGreaterThanOrEqual(3);
  });

  it("reprend le sujet comme titre de couverture quand il tient", async () => {
    const r = await fournisseur.ecrire({ type: "sujet", sujet: "Ranger son bureau" });
    expect((r.spec as { pages: { titre: string }[] }).pages[0].titre).toBe("Ranger son bureau");
  });

  it("ne recopie pas en titre un sujet que la porte refuse", async () => {
    for (const sujet of ["Les équipes de Grenoble", "Aucun gain garanti", "Tu peux ranger"]) {
      const r = await fournisseur.ecrire({ type: "sujet", sujet });
      expect((r.spec as { pages: { titre: string }[] }).pages[0].titre, sujet).not.toBe(sujet);
    }
  });

  it("garde le titre de la fixture quand le sujet est trop long", async () => {
    const sujet = "Un sujet très long qui ne tient dans aucun titre de couverture, même le plus généreux du registre";
    const r = await fournisseur.ecrire({ type: "sujet", sujet });
    const titre = (r.spec as { pages: { titre: string }[] }).pages[0].titre;
    expect(titre).not.toBe(sujet);
    expect(CarrouselSpec.safeParse(r.spec).success).toBe(true);
  });

  it("un sujet contenant un chiffre donne une couverture sans chiffre", async () => {
    for (const sujet of ["Mes 5 habitudes de bureau", "Le 1er jour à l'atelier", "Ranger en 10 minutes"]) {
      const r = await fournisseur.ecrire({ type: "sujet", sujet });
      const couverture = (r.spec as { pages: { titre: string }[] }).pages[0];
      expect(chiffresDe(couverture.titre), sujet).toEqual([]);
      expect(couverture.titre).not.toMatch(/\d/u);
      expect(r.titre).not.toMatch(/\d/u);
      expect(CarrouselSpec.safeParse(r.spec).success).toBe(true);
    }
  });

  it("refuse tout ce qui n'est pas un sujet avec SESSION_ATTENDUE", async () => {
    await expect(fournisseur.ecrire({ type: "paquet-session", contenu: "{}" })).rejects.toMatchObject({ code: "SESSION_ATTENDUE" });
  });

  it("refuse un sujet vide avec SUJET_INVALIDE", async () => {
    await expect(fournisseur.ecrire({ type: "sujet", sujet: "   " })).rejects.toMatchObject({ code: "SUJET_INVALIDE" });
  });

  it("ne choisit que des modèles Axion (aucun thème de bureau ou d'atelier)", async () => {
    const ids = new Set(FIXTURES_AXION.map((f) => f.id));
    for (const sujet of SUJETS) {
      const r = await fournisseur.ecrire({ type: "sujet", sujet });
      expect(ids.has(FIXTURES_AXION.find((f) => JSON.stringify(f.pourquoi) === JSON.stringify(r.pourquoi))?.id ?? ""), sujet).toBe(true);
    }
  });

  it("n'ouvre aucune connexion réseau", async () => {
    const espion = vi.spyOn(globalThis, "fetch");
    for (const sujet of SUJETS) await fournisseur.ecrire({ type: "sujet", sujet });
    expect(espion).toHaveBeenCalledTimes(0);
  });
});

describe("fixtures", () => {
  it("compte au moins 4 carrousels inventés, de 6 à 8 pages, 4 types distincts au moins", () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(4);
    for (const f of FIXTURES) {
      expect(f.spec.pages.length).toBeGreaterThanOrEqual(6);
      expect(f.spec.pages.length).toBeLessThanOrEqual(8);
      expect(new Set(f.spec.pages.map((p) => p.type)).size, f.id).toBeGreaterThanOrEqual(4);
    }
  });

  it("respecte la structure : couverture en tête, T21 en dernier, une phrase de pourquoi par page", () => {
    for (const f of FIXTURES) {
      expect(CarrouselSpec.safeParse(f.spec).success, f.id).toBe(true);
      expect(TYPES_COUVERTURE).toContain(f.spec.pages[0].type);
      expect(f.spec.pages.at(-1)?.type).toBe("T21");
      expect(f.pourquoi).toHaveLength(f.spec.pages.length);
      for (const p of f.pourquoi) expect(p.length).toBeGreaterThan(0);
      for (const p of f.pourquoi) expect(p.length).toBeLessThanOrEqual(200);
    }
  });

  it("respecte les budgets des couvertures et ne dépasse pas 3 « Scénario type »", () => {
    for (const f of FIXTURES) {
      const [couverture] = f.spec.pages;
      expect(couverture.type === "T01" || couverture.type === "T01B" || couverture.type === "T01C").toBe(true);
      if (couverture.type === "T01" || couverture.type === "T01B" || couverture.type === "T01C") {
        expect(couverture.titre.length).toBeLessThanOrEqual(PAGES[couverture.type].titreMax);
      }
      const scenarios = textesDe(f).filter((t) => /scénario type/iu.test(t)).length;
      expect(scenarios).toBeLessThanOrEqual(3);
    }
  });

  it("ne contient aucun chiffre, domaine, marque ni tutoiement", () => {
    for (const f of FIXTURES) {
      for (const t of textesDe(f)) {
        expect(chiffresDe(t), t).toEqual([]);
        expect(t, t).not.toMatch(/\d/u);
        expect(t, t).not.toMatch(MOTS_NOMBRE);
        expect(t, t).not.toMatch(/\.(?:com|fr|net|org|io)\b|https?:|www\./iu);
        expect(t, t).not.toMatch(/(?<![\p{L}'’-])(?:tu|toi|ton|ta|tes|te)(?![\p{L}])/iu);
        expect(t, t).not.toMatch(/Villeexemple|Aucun gain garanti|J'aide/iu);
      }
    }
  });
});
