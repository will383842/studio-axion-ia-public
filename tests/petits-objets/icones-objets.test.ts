/** C9-28 — table figée rôle → icône des petits objets. Aucun logo de marque, aucun visage. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ICONES_BIBLIOTHEQUE, jeuDe } from "../../src/briques/motion/bibliotheque-icones";
import { ICONES } from "../../src/briques/motion/icones";
import { ICONES_OBJETS, iconeObjet } from "../../src/briques/motion/petits-objets/icones-objets";

const RACINE = join(__dirname, "..", "..");
const MARQUES = /(facebook|instagram|linkedin|youtube|tiktok|twitter|whatsapp|snapchat|pinterest|github|google|apple|microsoft|amazon|meta|\bx\b)/i;
const VISAGES = /(visage|face|smiley|emoji|sourire|tete|head|avatar)/i;
const MANQUANTS = ["globe", "ajout-personne", "lecture"] as const;

describe("C9-28 icônes des petits objets", () => {
  it("la table est figée et porte les rôles attendus", () => {
    expect(Object.isFrozen(ICONES_OBJETS)).toBe(true);
    for (const r of ["pouce", "lien", "cloche", "personne", "etoile", "coche", ...MANQUANTS]) expect(r in ICONES_OBJETS).toBe(true);
  });
  it("chaque icône non nulle existe (bibliothèque ou ICONES) et iconeObjet la rend", () => {
    for (const [role, nom] of Object.entries(ICONES_OBJETS)) {
      if (nom === null) continue;
      expect(nom in ICONES_BIBLIOTHEQUE || nom in ICONES, `${role} → ${nom}`).toBe(true);
      const i = iconeObjet(role);
      expect(i).not.toBeNull();
      expect(i!.viewBox).toMatch(/^\d+ \d+ \d+ \d+$/);
      expect(i!.noeuds.length).toBeGreaterThan(0);
    }
  });
  it("chaque jeu de la bibliothèque utilisé a une entrée de droits", () => {
    for (const nom of Object.values(ICONES_OBJETS)) {
      if (nom === null || !nom.includes(":")) continue;
      const jeu = jeuDe(nom);
      expect(jeu, nom).toBeTruthy();
      const texte = readFileSync(join(RACINE, "src/briques/droits/registre", `icones-bibliotheque-${jeu}.ts`), "utf8");
      expect(texte).toContain(`id: "icones-bibliotheque-${jeu}"`);
    }
  });
  it("aucun nom de marque ni de visage", () => {
    for (const [role, nom] of Object.entries(ICONES_OBJETS)) {
      expect(MARQUES.test(role) || MARQUES.test(nom ?? ""), `${role} ${nom}`).toBe(false);
      expect(VISAGES.test(role) || VISAGES.test(nom ?? ""), `${role} ${nom}`).toBe(false);
    }
  });
  it("rôles manquants = null, jamais d'exception", () => {
    for (const r of MANQUANTS) {
      expect(ICONES_OBJETS[r]).toBeNull();
      expect(iconeObjet(r)).toBeNull();
    }
    for (const r of ["inconnu", "", "__proto__", "constructor", "toString"]) expect(iconeObjet(r)).toBeNull();
    expect(iconeObjet(undefined as unknown as string)).toBeNull();
  });
});
