/**
 * Ciblage des scripts, lot A (socle) : types, contrôles purs, doublons. Rendu serveur seulement (pas de jsdom).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TAILLES, TYPES_AUTOMATISATION, type Ciblage } from "@/domaine/ciblage/types";
import { beneficeClair, cibleNommee, debutParle, deduireCiblage, deduireTypeAutomatisation } from "@/domaine/ciblage/controles";
import { doublonsPossibles } from "@/domaine/ciblage/doublons";
import { ChoixCible } from "@/components/ciblage/ChoixCible";
import { ChoixTypeAutomatisation } from "@/components/ciblage/ChoixTypeAutomatisation";

const metier = (libelle: string): Ciblage => ({ niveau: "metier", libelle, origine: "saisie" });

describe("types", () => {
  it("12 types en kebab-case avec libellé français, sans « À classer »", () => {
    expect(TYPES_AUTOMATISATION).toHaveLength(12);
    for (const t of TYPES_AUTOMATISATION) {
      expect(t.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(t.libelle.length).toBeGreaterThan(3);
    }
    expect(TYPES_AUTOMATISATION.find((t) => t.id === "devis-factures")?.libelle).toBe("Devis et factures");
    expect(TYPES_AUTOMATISATION.find((t) => t.id === "former-equipes")?.libelle).toBe("Former les équipes à l'IA");
    expect(TYPES_AUTOMATISATION.some((t) => /classer/i.test(t.libelle))).toBe(false);
  });
  it("3 tailles avec effectif en clair", () => {
    expect(TAILLES.map((t) => t.id)).toEqual(["TPE", "PME", "ETI"]);
    expect(TAILLES[0].libelle).toContain("moins de 10 salariés");
    expect(TAILLES[1].libelle).toContain("10 à 249");
    expect(TAILLES[2].libelle).toContain("250 à 4 999");
  });
});

describe("cibleNommee", () => {
  it("métier : casse, accents, pluriel, élision", () => {
    expect(cibleNommee("Vous êtes électricien ?", metier("électricien"))).toBe(true);
    expect(cibleNommee("VOUS ETES ELECTRICIENS", metier("Électricien"))).toBe(true);
    expect(cibleNommee("Un devis d'électricien en 2 minutes", metier("électricien"))).toBe(true);
    expect(cibleNommee("Vous êtes plombier ?", metier("électricien"))).toBe(false);
  });
  it("secteur à plusieurs mots", () => {
    const c: Ciblage = { niveau: "secteur", libelle: "agent immobilier", origine: "saisie" };
    expect(cibleNommee("Agents immobiliers, lisez ceci", c)).toBe(true);
    expect(cibleNommee("Agents de voyage", c)).toBe(false);
  });
  it("taille : synonymes", () => {
    const tpe: Ciblage = { niveau: "taille", libelle: "TPE", origine: "saisie" };
    expect(cibleNommee("Vous dirigez une petite entreprise ?", tpe)).toBe(true);
    expect(cibleNommee("Les TPE perdent du temps", tpe)).toBe(true);
    expect(cibleNommee("Dans une grande entreprise", tpe)).toBe(false);
    expect(cibleNommee("Votre PME", { niveau: "taille", libelle: "PME", origine: "saisie" })).toBe(true);
    expect(cibleNommee("Une entreprise de taille intermédiaire", { niveau: "taille", libelle: "ETI", origine: "saisie" })).toBe(true);
  });
});

describe("debutParle", () => {
  const texte = Array.from({ length: 40 }, (_, i) => `mot${i + 1}`).join(" ");
  it("5 secondes ≈ 13 mots", () => {
    expect(debutParle(texte, 2.6).split(" ")).toHaveLength(13);
    expect(debutParle(texte, 3).split(" ")).toHaveLength(15);
  });
  it("texte court inchangé", () => expect(debutParle("Bonjour à tous", 2.6)).toBe("Bonjour à tous"));
});

describe("beneficeClair", () => {
  it("gain concret", () => {
    expect(beneficeClair("Gagnez 2 heures par semaine sur vos devis")).toBe(true);
    expect(beneficeClair("Fini les erreurs de facturation")).toBe(true);
    expect(beneficeClair("Relancez vos clients plus vite")).toBe(true);
  });
  it("flou", () => {
    expect(beneficeClair("L'IA va tout changer")).toBe(false);
    expect(beneficeClair("")).toBe(false);
  });
});

describe("deduireTypeAutomatisation", () => {
  it("un seul type", () => {
    expect(deduireTypeAutomatisation("Faire vos devis en deux minutes")).toBe("devis-factures");
    expect(deduireTypeAutomatisation("Un compte rendu de réunion automatique")).toBe("comptes-rendus");
  });
  it("plusieurs types ou aucun : null", () => {
    expect(deduireTypeAutomatisation("Relancer les factures impayées")).toBeNull();
    expect(deduireTypeAutomatisation("Bonjour")).toBeNull();
  });
});

describe("deduireCiblage", () => {
  it("taille déduite", () => {
    expect(deduireCiblage("pour les petites entreprises")).toEqual({ niveau: "taille", libelle: "TPE", origine: "deduite" });
  });
  it("métier déduit, ≤ 80 caractères, une ligne", () => {
    const c = deduireCiblage("pour les plombiers");
    expect(c?.niveau).toBe("metier");
    expect(c?.origine).toBe("deduite");
    expect(c!.libelle.length).toBeLessThanOrEqual(80);
    expect(c!.libelle).not.toContain("\n");
  });
  it("rien de reconnu : null", () => expect(deduireCiblage("quelque chose")).toBeNull());
});

describe("doublonsPossibles", () => {
  const base = { typeAutomatisation: "devis-factures" as const, ciblage: metier("plombier") };
  it("regroupe type, cible et sujets proches", () => {
    const g = doublonsPossibles([
      { id: "a", sujet: "Faire un devis en deux minutes", ...base },
      { id: "b", sujet: "Faire un devis en deux minutes chrono", ...base },
      { id: "c", sujet: "Relancer les clients", ...base },
      { id: "d", sujet: "Faire un devis en deux minutes", typeAutomatisation: "emails-messages", ciblage: metier("plombier") },
      { id: "e", sujet: "Faire un devis en deux minutes", ...base, ciblage: metier("maçon") },
    ]);
    expect(g).toEqual([["a", "b"]]);
  });
  it("aucun doublon : liste vide", () => expect(doublonsPossibles([{ id: "a", sujet: "x", ...base }])).toEqual([]));
});

describe("composants", () => {
  it("ChoixCible étape 1 : trois choix", () => {
    const h = renderToStaticMarkup(createElement(ChoixCible, {}));
    for (const l of ["Un métier", "Un secteur", "Une taille d'entreprise"]) expect(h.replace(/&#x27;/g, "'")).toContain(l);
    expect(h.match(/type="radio"/g)).toHaveLength(3);
  });
  it("taille : TPE/PME/ETI avec effectif", () => {
    const h = renderToStaticMarkup(createElement(ChoixCible, { niveau: "taille" }));
    expect(h).toContain("moins de 10 salariés");
    expect(h).toContain("250 à 4 999");
  });
  it("métier : champ libre, aide et 4 états", () => {
    const rendu = (p: object) => renderToStaticMarkup(createElement(ChoixCible, { niveau: "metier", ...p }));
    expect(rendu({ suggestions: ["plombier"] })).toContain("Elle sera nommée dans les 5 premières secondes.");
    expect(rendu({ suggestions: ["plombier"] })).toContain('value="plombier"');
    expect(rendu({ chargement: true })).toContain("Chargement des suggestions…");
    expect(rendu({ suggestions: [] })).toContain("Aucune suggestion, écrivez la vôtre.");
    expect(rendu({ erreur: true })).toContain("Suggestions indisponibles, la saisie reste possible.");
    expect(rendu({ erreur: true })).toContain("<input");
  });
  it("ChoixTypeAutomatisation : 12 types + À classer, sans mots interdits ni couleur en dur", () => {
    const h = renderToStaticMarkup(createElement(ChoixTypeAutomatisation, {}));
    expect(h.match(/type="radio"/g)).toHaveLength(13);
    expect(h).toContain("À classer");
    const tout = h + renderToStaticMarkup(createElement(ChoixCible, { niveau: "metier" }));
    expect(tout).not.toMatch(/zernio|buffer|\bkit\b|variante|#[0-9a-f]{3,6}\b|€/i);
  });
});
