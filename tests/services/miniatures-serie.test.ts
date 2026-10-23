/**
 * Couverture de série (TB-16) : la douleur en gros (8 mots au plus, refus au-delà), mot-clé en noir souligné d'orange,
 * nom de la série en petit, jamais de numéro d'épisode ; 9:16 et 1:1 ; demande `image-fixe` ; règles du service =
 * règles du gabarit ; `Miniature.tsx` intact ; aucune importation de studio-rendu par src/.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ServiceRendu } from "../../src/fournisseurs/types";
import { controlerCouvertureSerie, demandeCouvertureSerie, motCleCouvertureSerie, proprietesCouvertureSerie, rendreCouvertureSerie } from "../../src/services/miniatures-serie";
import { COULEURS_VIDEO } from "../../src/briques/habillage/charte-video";
import { COUVERTURE_EXEMPLE } from "../../studio-rendu/compositions/commune/miniature-serie/exemple";
import { controlerCouverture, dimensionsCouverture, planifierCouverture, VERSION_COUVERTURE, zoneCouverture, type ProprietesCouverture } from "../../studio-rendu/compositions/commune/miniature-serie/plan";

const base: ProprietesCouverture = COUVERTURE_EXEMPLE;
const DOSSIER = join(process.cwd(), "studio-rendu/compositions/commune/miniature-serie");
const sansCommentaires = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("gabarit : plan de la couverture", () => {
  it("les propriétés par défaut sont valides ; tailles 1080 × 1920 et 1080 × 1080", () => {
    expect(controlerCouverture(base)).toEqual([]);
    expect(dimensionsCouverture("9:16")).toEqual({ largeur: 1080, hauteur: 1920 });
    expect(dimensionsCouverture("1:1")).toEqual({ largeur: 1080, hauteur: 1080 });
  });

  it("refuse plus de 8 mots, une douleur vide, un mot-clé étranger, un format inconnu", () => {
    expect(controlerCouverture({ ...base, douleur: "un deux trois quatre cinq six sept huit neuf", motCle: "un" }).join()).toMatch(/9 mots \(8 au plus\)/);
    expect(controlerCouverture({ ...base, douleur: "un deux trois quatre cinq six sept huit", motCle: "un" })).toEqual([]);
    expect(controlerCouverture({ ...base, douleur: " " }).join()).toMatch(/vide/);
    expect(controlerCouverture({ ...base, motCle: "autre" }).join()).toMatch(/pas un mot de la douleur/);
    expect(controlerCouverture({ ...base, ratio: "4:5" as never }).join()).toMatch(/non géré/);
    expect(() => planifierCouverture({ ...base, douleur: "un deux trois quatre cinq six sept huit neuf", motCle: "un" })).toThrow(/9 mots/);
  });

  it("jamais de numéro d'épisode, ni dans la douleur ni dans le nom de la série", () => {
    for (const serie of ["L'IA au bureau · ép. 3", "L'IA au bureau épisode 12", "L'IA au bureau #4", "L'IA au bureau (3/10)", "Saison 1", "Épisode"]) {
      expect(controlerCouverture({ ...base, serie }).join(), serie).toMatch(/numéro d'épisode/);
    }
    expect(controlerCouverture({ ...base, douleur: "Épisode 3 : vos réponses", motCle: "réponses" }).join()).toMatch(/numéro d'épisode/);
    expect(controlerCouverture({ ...base, serie: "L'IA en 2026" })).toEqual([]);
  });

  for (const ratio of ["9:16", "1:1"] as const) {
    it(`${ratio} : tout tient dans la zone, le texte reste en noir, le mot-clé est souligné d'orange`, () => {
      const plan = planifierCouverture({ ...base, ratio });
      const z = zoneCouverture(ratio);
      expect(plan.lignes.map((l) => l.texte).join(" ")).toBe(base.douleur);
      for (const l of plan.lignes) {
        expect(l.px.x).toBeGreaterThanOrEqual(z.x);
        expect(l.px.x + l.px.largeur).toBeLessThanOrEqual(z.x + z.largeur + 1);
        expect(l.px.y).toBeGreaterThanOrEqual(z.y);
        expect(l.px.y + l.px.hauteur).toBeLessThanOrEqual(plan.serie.px.y);
      }
      expect(plan.serie.px.y + plan.serie.px.hauteur).toBeLessThanOrEqual(z.y + z.hauteur);
      // Le nom de la série est petit ; la douleur est en gros.
      expect(plan.serie.taille).toBeLessThan(plan.taille / 1.5);
      expect(plan.taille).toBeGreaterThanOrEqual(Math.round(0.04 * plan.hauteur));
      // Un seul mot-clé souligné, sous son mot, dans la largeur du mot.
      const cles = plan.lignes.flatMap((l) => l.mots.filter((m) => m.cle));
      expect(cles.map((m) => m.texte)).toEqual(["vagues"]);
      expect(plan.traits).toHaveLength(1);
      expect(plan.traits[0].x).toBe(cles[0].x);
      expect(plan.traits[0].largeur).toBe(Math.round(cles[0].largeur));
    });
  }

  it("déterministe, et plus de mots = plus petit mais jamais sous le plancher", () => {
    expect(JSON.stringify(planifierCouverture(base))).toBe(JSON.stringify(planifierCouverture(structuredClone(base))));
    const court = planifierCouverture({ ...base, douleur: "Réponses vagues ?", motCle: "vagues" });
    const long = planifierCouverture({ ...base, douleur: "Vos équipes perdent encore une heure par jour", motCle: "heure" });
    expect(long.taille).toBeLessThanOrEqual(court.taille);
  });

  it("garde-fous : aucune couleur ni police en dur, orange jamais en couleur de texte, ni alias « @/ »", () => {
    for (const f of readdirSync(DOSSIER).filter((x) => /\.tsx?$/.test(x))) {
      const code = sansCommentaires(readFileSync(join(DOSSIER, f), "utf8"));
      expect(code, f).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|fontFamily:\s*(?:["']|`(?!"\$\{))|from "@\//);
      expect(code, f).not.toMatch(/color:\s*COULEURS_VIDEO\.soulignement/);
    }
    expect(COULEURS_VIDEO.soulignement).not.toBe(COULEURS_VIDEO.ecriture);
  });

  it("Miniature.tsx n'est pas modifié (comparé à origin/master)", () => {
    const diff = execFileSync("git", ["diff", "--name-only", "origin/master", "--", "studio-rendu/compositions/commune/Miniature.tsx", "studio-rendu/compositions/commune/miniature-mise-en-page.ts"], { encoding: "utf8" });
    expect(diff.trim()).toBe("");
    // La Racine peut recevoir de nouveaux formats (ex. « Image → vidéo ») : seulement des AJOUTS, aucune ligne existante retirée.
    const racine = execFileSync("git", ["diff", "-U0", "origin/master", "--", "studio-rendu/compositions/Racine.tsx"], { encoding: "utf8" });
    expect(racine.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---"))).toEqual([]);
  });
});

describe("service : demande de rendu", () => {
  it("les règles du service sont celles du gabarit", () => {
    const cas = [
      { douleur: "Vos réponses restent vagues ?", serie: "L'IA au bureau" },
      { douleur: "un deux trois quatre cinq six sept huit neuf", serie: "S" },
      { douleur: "Vos réponses", serie: "Série ép. 3" },
      { douleur: "Épisode 2 des réponses", serie: "Série" },
      { douleur: "", serie: "Série" },
      { douleur: "Vos réponses", serie: " " },
    ];
    for (const c of cas) {
      const mot = c.douleur.split(/\s+/)[0] || "x";
      const gabarit = controlerCouverture({ version: VERSION_COUVERTURE, ratio: "9:16", douleur: c.douleur, motCle: mot, serie: c.serie }).filter((m) => !/mot-clé/.test(m));
      expect(controlerCouvertureSerie(c).length > 0, JSON.stringify(c)).toBe(gabarit.length > 0);
    }
  });

  it("propriétés : 9:16 par défaut, mot-clé demandé ou plus long mot", () => {
    expect(proprietesCouvertureSerie({ douleur: "Vos réponses restent vagues ?", serie: "L'IA au bureau" })).toEqual({ version: VERSION_COUVERTURE, ratio: "9:16", douleur: "Vos réponses restent vagues ?", motCle: "réponses", serie: "L'IA au bureau" });
    expect(motCleCouvertureSerie("Vos réponses restent vagues ?", "VAGUES")).toBe("vagues");
    expect(() => motCleCouvertureSerie("Vos réponses", "autre")).toThrow(/pas un mot de la douleur/);
    expect(proprietesCouvertureSerie({ douleur: "Vagues ?", serie: "S", ratio: "1:1" }).ratio).toBe("1:1");
    expect(() => proprietesCouvertureSerie({ douleur: "un deux trois quatre cinq six sept huit neuf", serie: "S" })).toThrow(/9 mots/);
    // Les propriétés produites sont acceptées par le gabarit.
    expect(controlerCouverture(proprietesCouvertureSerie({ douleur: "Vos réponses restent vagues ?", serie: "L'IA au bureau" }) as unknown as ProprietesCouverture)).toEqual([]);
  });

  it("demande `image-fixe` vers la composition inscrite ; rendu par un service injecté, sans appel réel", async () => {
    const sortie = { urlDepot: "https://depot.test/x", cle: "studio/test/couvertures/x.png" };
    const d = demandeCouvertureSerie({ douleur: "Vagues ?", serie: "S" }, "couv-1", sortie);
    expect(d).toMatchObject({ idRendu: "couv-1", operation: "image-fixe", file: "courte", entrees: {}, sortie });
    expect(d.parametres).toMatchObject({ composition: "TableauCouvertureSerie", image: 0 });
    const soumises: string[] = [];
    const service: ServiceRendu = { soumettre: async (x) => (soumises.push(x.idRendu), { idRendu: x.idRendu }), etat: async () => ({ statut: "termine", sortieCle: sortie.cle }) };
    await expect(rendreCouvertureSerie(service, { douleur: "Vagues ?", serie: "S" }, "couv-1", sortie)).resolves.toBe(sortie.cle);
    expect(soumises).toEqual(["couv-1"]);
  });

  it("src/ n'importe jamais studio-rendu (l'image du studio ne l'embarque pas)", () => {
    expect(readFileSync(join(process.cwd(), "src/services/miniatures-serie.ts"), "utf8")).not.toMatch(/studio-rendu\//);
  });
});
