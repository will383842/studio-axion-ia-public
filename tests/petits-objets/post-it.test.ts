/** C9-25 — post-it (Manrope seule, aucun jaune) : pièce pure, non inscrite. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEF_POST_IT, EXEMPLES_POST_IT, taillePostIt } from "../../src/briques/motion/petits-objets/post-it";
import { MOTS_MAX, verifierDefinition, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur } from "../../src/briques/jetons-motion";
import { PALETTE } from "../../src/briques/charte/axion-2026";
import { CHARTE_AXION } from "../../src/briques/jetons-motion";

const SOURCE = readFileSync(new URL("../../src/briques/motion/petits-objets/post-it.tsx", import.meta.url), "utf8");
const D = 60;
const MOTS = { mots: ["ça", "coûte", "trop", "cher"] };
const rendre = (p: unknown, image = 30, ton: TonObjet = "neutre", fond: "ivoire" | "noir" = "ivoire", graine = 7) =>
  renderToStaticMarkup(DEF_POST_IT.Rendu({ image, fps: 25, dureeImages: D, fond, ton, graine, parametres: p as never }));

const MOTIFS: RegExp[] = [/@\//, /\bzod\b/, /Math\.random/, /remotion/, /from\s+["'][^"']*moteurs\//, /from\s+["'][^"']*-v4/, /VideoAnimeeV4/, /briques-v4/, /faits-script/, /from\s+["'][^"']*\/droits/, /bibliotheque-video/, /src\/domaine|from\s+["'][^"']*\/domaine\//, /from\s+["'][^"']*\/services\//];

describe("C9-25 contrat", () => {
  it("id, famille, capacité, données", () => {
    expect(verifierDefinition(DEF_POST_IT)).toBe("ok");
    expect(DEF_POST_IT.id).toBe("objet-post-it");
    expect(DEF_POST_IT.famille).toBe("etiquette");
    expect(DEF_POST_IT.capacite).toBe("objet.etiquette");
    expect(DEF_POST_IT.donnees).toBe("mots-dits");
  });
  it("valider ne lève jamais ; null sur entrée mauvaise", () => {
    for (const m of [undefined, null, {}, 5, "texte", { mots: [] }, { mots: ["a", "b", "c", "d", "e"] }, { mots: [1] }, { mots: ["  "] }, { mots: "a" }])
      expect(DEF_POST_IT.valider(m)).toBeNull();
    expect(DEF_POST_IT.valider(MOTS)).toEqual(MOTS);
    expect(MOTS.mots.length).toBeLessThanOrEqual(MOTS_MAX);
  });
  it("exemples valides", () => {
    for (const e of EXEMPLES_POST_IT) expect(DEF_POST_IT.valider(e)).not.toBeNull();
  });
});

describe("C9-25 rendu", () => {
  it("même graine = même sortie ; autre graine = autre inclinaison", () => {
    expect(rendre(MOTS)).toBe(rendre(MOTS));
    expect(rendre(MOTS, 30, "neutre", "ivoire", 1)).not.toBe(rendre(MOTS, 30, "neutre", "ivoire", 2));
  });
  it("paramètres nuls ou image hors durée : aucune exception, aucun texte", () => {
    expect(rendre(null)).not.toContain("<text");
    expect(rendre(MOTS, -1)).not.toContain("coûte");
    expect(rendre(MOTS, D)).not.toContain("coûte");
  });
  it("le texte passé est affiché, en Manrope", () => {
    const h = rendre(MOTS);
    for (const m of MOTS.mots) expect(h).toContain(m);
    expect(h).toContain("Manrope");
  });
  it("texte long → taille réduite, sans débordement", () => {
    const court = taillePostIt(["ok"]);
    const long = taillePostIt(["extraordinairement", "interminablement", "constitutionnellement", "anticonstitutionnellement"]);
    expect(long).toBeLessThan(court);
    expect(long).toBeGreaterThan(0);
    for (const mots of [["ok"], ["un", "deux", "trois", "quatre"], ["anticonstitutionnellement", "anticonstitutionnellement"]]) {
      const t = taillePostIt(mots);
      const largeurMax = Math.max(...mots.map((m) => m.length)) * t * 0.62;
      expect(largeurMax).toBeLessThanOrEqual(DEF_POST_IT.toile.largeur * 0.8 + 0.001);
      expect(mots.length * t * 1.2).toBeLessThanOrEqual(DEF_POST_IT.toile.hauteur * 0.8 + 0.001);
    }
  });
  it("ombre = 2e forme décalée, jamais filter / mask", () => {
    const h = rendre(MOTS);
    expect(h).not.toMatch(/filter|drop-shadow|mask/i);
    expect((h.match(/<rect/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
  it("couleurs ∈ charte, aucun jaune, aucune couleur libre", () => {
    const charte = new Set([...Object.values(CHARTE_AXION), ...Object.values(PALETTE)].map((c) => String(c).toLowerCase()));
    for (const fond of ["ivoire", "noir"] as const)
      for (const ton of ["neutre", "accent", "valide", "erreur"] as TonObjet[]) {
        const h = rendre(MOTS, 30, ton, fond);
        expect(h).toContain(couleurDuTon(ton, fond));
        for (const c of h.match(/#[0-9a-fA-F]{6}\b/g) ?? []) expect(charte.has(c.toLowerCase())).toBe(true);
        expect(h).not.toContain("#B8341C");
      }
    expect(couleursSur("ivoire").panneauRelief).toBeTruthy();
  });
  it("éteint = identique : importer le fichier n'inscrit rien", () => {
    expect(SOURCE).not.toMatch(/registre|inscrire|lireParametre/);
  });
});

describe("C9-25 garde statique du fichier .tsx", () => {
  it("aucun des 13 motifs interdits", () => {
    for (const re of MOTIFS) expect(SOURCE).not.toMatch(re);
  });
  it("aucune police autre que Manrope, aucun jaune, aucune couleur codée en dur", () => {
    expect(SOURCE).not.toMatch(/Montserrat|JetBrains|Arial|Helvetica|Georgia|Courier|Comic|serif\b(?!.*FAMILLE)|monospace/);
    expect(SOURCE).not.toMatch(/jaune|yellow|#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/i);
    expect(SOURCE).toContain("FAMILLE_CSS_AXION");
  });
});
