/**
 * G5 : écran « Guides » (conversions, rendu de départ, langage simple, interrupteur de l'onglet). Sans DOM, sans réseau.
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EcranGuides, type ServicesGuides } from "@/components/mots/EcranGuides";
import { depuisEditable, etapeAtteinte, versEditable } from "@/components/mots/guides-logique";
import { controlerRelecture } from "@/domaine/guides-pdf/guide-fabrique";

const J = (a: string, b: string) => a + b;
const FICHIERS = [
  "src/components/mots/EcranGuides.tsx",
  "src/components/mots/guides-logique.ts",
  "src/services/guides-fabrique.ts",
  "src/services/guides-fabrique-site.ts",
  "src/domaine/guides-pdf/guide-fabrique.ts",
  "src/app/(studio)/mots/actions-guides.ts",
];
const services: ServicesGuides = { lire: vi.fn(), rediger: vi.fn(), valider: vi.fn(), fabriquer: vi.fn(), rattacher: vi.fn() };

describe("conversions du texte relu", () => {
  it("aller-retour : paragraphes séparés par une ligne vide, une puce par ligne, lignes vides ignorées", () => {
    const c = { titre: "Titre", sections: [{ titre: "Partie", paragraphes: ["Un.", "Deux."], puces: ["a", "b"] }] };
    expect(depuisEditable(versEditable(c))).toEqual(c);
    const saisi = depuisEditable({ titre: "  T  ", sections: [{ titre: " S ", paragraphes: "Un.\n\n\n\nDeux.\n\n", puces: "\n a \n\n b\n" }] });
    expect(saisi).toEqual({ titre: "T", sections: [{ titre: "S", paragraphes: ["Un.", "Deux."], puces: ["a", "b"] }] });
    expect(controlerRelecture(saisi).ok).toBe(true);
  });
  it("un retour à la ligne simple dans un paragraphe devient une espace (le contrôle C0 ne bute plus)", () => {
    const saisi = depuisEditable({ titre: "T", sections: [{ titre: "S", paragraphes: "Première ligne\nsuite du même paragraphe.\r\nEncore.\n\nDeuxième.", puces: "a" }] });
    expect(saisi.sections[0].paragraphes).toEqual(["Première ligne suite du même paragraphe. Encore.", "Deuxième."]);
    expect(controlerRelecture(saisi).ok).toBe(true);
  });
  it("étape atteinte", () => {
    expect(etapeAtteinte(null)).toBe(0);
    expect(etapeAtteinte({ derniere: { statut: "À valider" }, fabrique: null })).toBe(1);
    expect(etapeAtteinte({ derniere: { statut: "Validé" }, fabrique: null })).toBe(2);
    expect(etapeAtteinte({ derniere: { statut: "Validé" }, fabrique: { rattache: false } })).toBe(3);
    expect(etapeAtteinte({ derniere: { statut: "Validé" }, fabrique: { rattache: true } })).toBe(4);
  });
});

describe("écran de départ", () => {
  const html = renderToStaticMarkup(<EcranGuides mots={["facture", "devis"]} services={services} />);
  it("champ étiqueté, liste de mots, bouton « Créer son guide » (désactivé tant que rien n'est saisi), aucun geste d'envoi", () => {
    expect(html).toContain("Mot du guide");
    expect(html).toContain('<option value="facture"');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[^<]*Créer son guide/);
    expect(html).not.toContain("Fabriquer le PDF</button>");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-label="Les 5 gestes"');
  });
  it("aucun service n'est appelé au rendu", () => {
    for (const f of Object.values(services)) expect(f).not.toHaveBeenCalled();
  });
});

describe("langage et branchement", () => {
  it("jamais « abonné », jamais le nom de ville interdit, jamais la promesse de gain interdite en clair", () => {
    for (const f of FICHIERS) {
      const t = readFileSync(f, "utf8").toLowerCase();
      expect(t, f).not.toMatch(/abonn[eé]/);
      expect(t, f).not.toContain(J("gren", "oble"));
      expect(t, f).not.toContain(J("aucun gain ", "garanti"));
    }
  });
  it("l'onglet n'existe que si l'interrupteur est allumé ; la page lit l'interrupteur", () => {
    const connecte = readFileSync("src/components/mots/EcranMotsConnecte.tsx", "utf8");
    expect(connecte).toContain("if (!guidesActif)");
    expect(connecte).toContain("guidesActif = false");
    expect(readFileSync("src/app/(studio)/mots/page.tsx", "utf8")).toContain("guidesActif={guidesFabriqueActif()}");
  });
  it("chaque action serveur exige la session avant le geste", () => {
    const t = readFileSync("src/app/(studio)/mots/actions-guides.ts", "utf8");
    const corps = t.split("export async function").slice(1);
    expect(corps).toHaveLength(5);
    for (const c of corps) expect(c.indexOf("await exigerSession()")).toBeGreaterThan(-1);
    for (const c of corps) expect(c.indexOf("await exigerSession()")).toBeLessThan(c.search(/lireGuideDuMot|redigerGuide\(|validerGuide\(|fabriquerPdf\(|rattacherGuide\(/));
  });
});
