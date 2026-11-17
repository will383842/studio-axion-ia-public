import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { NOMS_ICONES } from "../../../src/briques/motion/icones";
import { ICONES_BIBLIOTHEQUE, jeuDe } from "../../../src/briques/motion/bibliotheque-icones";
import { DROITS } from "../../../src/briques/droits/registre";
import { admissibleEnAutomatique } from "../../../src/briques/droits/licences";

const DOSSIER = "src/briques/motion/bibliotheque-icones";
const NOMS_FIGES = ["coche","coche-cercle","croix","horloge","sablier","goutte","loupe","cle","marteau","graphique","hausse","baisse","cible","eclair","ampoule","calendrier","personne","equipe","message","telephone","document","bouclier","fusee","maison","alerte","question","etoile","coeur","camera","robot","verrou","fleche","euro","liste","route","drapeau","engrenage","thermometre","outils"];
const MARQUES = ["facebook","instagram","linkedin","youtube","twitter","x","tiktok","github","google"];
const COULEUR = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|\b(red|blue|green|black|white|yellow|orange|purple|pink|gray|grey)\b/i;

describe("bibliothèque d'icônes (C6-H17a)", () => {
  it("NOMS_ICONES est inchangé (K8)", () => {
    expect([...NOMS_ICONES]).toEqual(NOMS_FIGES);
    expect(NOMS_FIGES).toHaveLength(39);
  });

  it("chaque icône est valide, sans couleur en dur, légère", () => {
    const entrees = Object.entries(ICONES_BIBLIOTHEQUE);
    expect(entrees.length).toBeGreaterThanOrEqual(40);
    for (const [nom, ic] of entrees) {
      expect(ic.viewBox, nom).toMatch(/^0 0 \d+ \d+$/);
      expect(ic.noeuds.length, nom).toBeGreaterThan(0);
      const json = JSON.stringify(ic.noeuds);
      expect(json.length, nom).toBeLessThan(4096);
      for (const [, attrs] of ic.noeuds) {
        for (const [k, v] of Object.entries(attrs)) {
          if (k === "fill" || k === "stroke") expect(["currentColor", "none"], nom).toContain(v);
        }
      }
      expect(COULEUR.test(json), nom).toBe(false);
    }
  });

  it("tous les noms sont préfixés par leur jeu (lucide, phosphor, material, tabler, heroicons, iconoir, carbon, bootstrap, health-icons) et aucun n'est une marque", () => {
    for (const nom of Object.keys(ICONES_BIBLIOTHEQUE)) {
      const jeu = nom.slice(0, nom.indexOf(":"));
      expect(["lucide", "phosphor", "material", "tabler", "heroicons", "iconoir", "carbon", "bootstrap", "health-icons"], nom).toContain(jeu);
      expect(MARQUES).not.toContain(nom.slice(jeu.length + 1).replace(/~duotone$/, ""));
      expect(jeuDe(nom)).toBe(jeu);
    }
    expect(Object.keys(ICONES_BIBLIOTHEQUE).filter((n) => n.startsWith("lucide:"))).toHaveLength(43);
    expect(jeuDe("coche")).toBeUndefined();
    expect(Object.isFrozen(ICONES_BIBLIOTHEQUE)).toBe(true);
  });

  it("l'entrée de droits existe, est admissible et ne demande aucun crédit", () => {
    const d = DROITS.find((e) => e.id === "icones-bibliotheque-lucide");
    expect(d).toBeDefined();
    expect(admissibleEnAutomatique(d!)).toBe(true);
    expect((d as { creditRequis?: boolean }).creditRequis).not.toBe(true);
    // E-6 : les entrées de droits des icônes de bibliothèque sont en fin de registre, dans l'ordre d'arrivée des jeux.
    const ids = DROITS.map((e) => e.id);
    expect(ids.indexOf("icones-bibliotheque-lucide")).toBeLessThan(ids.indexOf("icones-bibliotheque-phosphor"));
    expect(ids.slice(-8)).toEqual(["icones-bibliotheque-phosphor", "icones-bibliotheque-material", "icones-bibliotheque-tabler", "icones-bibliotheque-heroicons", "icones-bibliotheque-iconoir", "icones-bibliotheque-carbon", "icones-bibliotheque-bootstrap", "icones-bibliotheque-health-icons"]);
  });

  it("LICENCE-Lucide.txt contient l'ISC entière, le MIT de Feather et une date", () => {
    const t = readFileSync(join(DOSSIER, "LICENCE-Lucide.txt"), "utf8");
    expect(t).toMatch(/^ISC License/);
    expect(t).toContain("Permission to use, copy, modify, and/or distribute this software for any");
    expect(t).toContain("OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.");
    expect(t).toContain("Cole Bemis");
    expect(t).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("aucun « @/ » dans le dossier, aucun import de droits", () => {
    for (const f of readdirSync(DOSSIER).filter((x) => x.endsWith(".ts"))) {
      expect(statSync(join(DOSSIER, f)).isFile()).toBe(true);
      const s = readFileSync(join(DOSSIER, f), "utf8");
      expect(s, f).not.toMatch(/from\s+["']@\//);
      expect(s, f).not.toMatch(/droits/);
    }
  });

  it("aucun fichier de studio-rendu/compositions/visuels n'est modifié", () => {
    let sortie = "";
    try {
      sortie = execSync("git diff --name-only origin/master -- studio-rendu/compositions/visuels", { encoding: "utf8" });
    } catch {
      return; // pas de dépôt git ou de référence : rien à comparer
    }
    expect(sortie.trim()).toBe("");
  });
});
