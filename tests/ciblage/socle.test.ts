/**
 * Ciblage des scripts, lot A (socle) : types, contrôles purs, doublons. Rendu serveur seulement (pas de jsdom).
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TAILLES, TYPES_AUTOMATISATION, type Ciblage } from "@/domaine/ciblage/types";
import { appliquerChoix, beneficeClair, cibleNommee, debutParle, deduireCiblage, deduireTypeAutomatisation, libelleCibleValide, normaliser } from "@/domaine/ciblage/controles";
import { doublonsPossibles } from "@/domaine/ciblage/doublons";
import { ChoixCible, gererChoix } from "@/components/ciblage/ChoixCible";
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

const taille = (libelle: string): Ciblage => ({ niveau: "taille", libelle, origine: "saisie" });
const secteur = (libelle: string): Ciblage => ({ niveau: "secteur", libelle, origine: "saisie" });

describe("défaut 1 : plusieurs tailles nommées", () => {
  it("« les TPE et les PME » : null", () => {
    expect(deduireCiblage("pour les TPE et les PME")).toBeNull();
  });
  it("une seule taille reste déduite, y compris « petites et moyennes entreprises »", () => {
    expect(deduireCiblage("pour les PME")?.libelle).toBe("PME");
    expect(deduireCiblage("pour les petites et moyennes entreprises")?.libelle).toBe("PME");
  });
});

describe("défaut 2 : tiret traité comme espace", () => {
  it("normaliser remplace le tiret par une espace", () => expect(normaliser("Rendez-vous, compte-rendu")).toBe("rendez vous compte rendu"));
  it("types déduits avec tirets", () => {
    expect(deduireTypeAutomatisation("Vos rendez-vous en un clic")).toBe("rendez-vous-planning");
    expect(deduireTypeAutomatisation("Votre compte-rendu automatique")).toBe("comptes-rendus");
  });
  it("expert-comptable nommé dans « Experts comptables »", () => {
    expect(cibleNommee("Experts comptables, lisez ceci", metier("expert-comptable"))).toBe(true);
  });
});

describe("défaut 3 : la cible la plus longue l'emporte", () => {
  it("« experts comptables » : un métier", () => {
    expect(deduireCiblage("pour les experts comptables")).toEqual({ niveau: "metier", libelle: "expert-comptable", origine: "deduite" });
  });
  it("« agents immobiliers » : le métier, pas le secteur", () => {
    expect(deduireCiblage("pour les agents immobiliers")).toEqual({ niveau: "metier", libelle: "agent immobilier", origine: "deduite" });
  });
  it("deux cibles distinctes : null", () => expect(deduireCiblage("plombiers et électriciens")).toBeNull());
});

describe("défaut 4 : cibleNommee compare des suites de mots", () => {
  const agent = secteur("agent immobilier");
  it("singulier, pluriel, élision", () => {
    expect(cibleNommee("un agent immobilier", agent)).toBe(true);
    expect(cibleNommee("des agents immobiliers", agent)).toBe(true);
    expect(cibleNommee("devis d'électricien", metier("électricien"))).toBe(true);
    expect(cibleNommee("des électriciens", metier("électricien"))).toBe(true);
  });
  it("féminin", () => {
    expect(cibleNommee("Vous êtes électricienne ?", metier("électricien"))).toBe(true);
    expect(cibleNommee("Vous êtes électricien ?", metier("électricienne"))).toBe(true);
  });
  it("faux positifs : mots non consécutifs ou autre mot", () => {
    expect(cibleNommee("un agent de voyage immobilier", agent)).toBe(false);
    expect(cibleNommee("immobilier : un agent", agent)).toBe(false);
    expect(cibleNommee("Une opportunité à saisir", taille("TPE"))).toBe(false);
    expect(cibleNommee("Une opportunité à saisir", metier("coach"))).toBe(false);
    expect(cibleNommee("Du coaching pour tous", metier("coach"))).toBe(false);
  });
  it("tailles : PMEs et libellés en toutes lettres", () => {
    expect(cibleNommee("Les PMEs perdent du temps", taille("PME"))).toBe(true);
    expect(cibleNommee("Les TPE perdent du temps", taille("Petites entreprises"))).toBe(true);
    expect(cibleNommee("Votre petite entreprise", taille("Petites entreprises"))).toBe(true);
    expect(cibleNommee("Votre petite entreprise", taille("Moyennes entreprises"))).toBe(false);
    expect(cibleNommee("Votre moyenne entreprise", taille("Moyennes entreprises"))).toBe(true);
  });
});

describe("défaut 5 : doublons", () => {
  const base = { typeAutomatisation: "devis-factures" as const, ciblage: metier("plombier") };
  it("un même id présent deux fois : pas d'auto-doublon", () => {
    expect(doublonsPossibles([{ id: "a", sujet: "Faire un devis", ...base }, { id: "a", sujet: "Faire un devis", ...base }])).toEqual([]);
  });
  it("un id répété plus un vrai doublon : groupe sans répétition", () => {
    const g = doublonsPossibles([
      { id: "a", sujet: "Faire un devis", ...base },
      { id: "a", sujet: "Faire un devis", ...base },
      { id: "b", sujet: "Faire un devis", ...base },
    ]);
    expect(g).toEqual([["a", "b"]]);
  });
  it("seuil exact 0,6 : compte", () => {
    // 3 communs sur 5 mots en tout : 3/5 = 0,6
    const exact = doublonsPossibles([{ id: "a", sujet: "alpha beta gamma delta", ...base }, { id: "b", sujet: "alpha beta gamma epsilon", ...base }]);
    expect(exact).toEqual([["a", "b"]]);
  });
  it("0,59 ne compte pas", () => {
    const communs = Array.from({ length: 13 }, (_, i) => `mot${i}`);
    const a = [...communs, ...Array.from({ length: 9 }, (_, i) => `seul${i}`)].join(" ");
    const g = doublonsPossibles([{ id: "a", sujet: a, ...base }, { id: "b", sujet: communs.join(" "), ...base }]);
    expect(g).toEqual([]);
  });
  it("ordre déterministe quel que soit l'ordre d'entrée", () => {
    const s = [
      { id: "z", sujet: "Faire un devis", ...base },
      { id: "m", sujet: "Faire un devis", ...base },
      { id: "c", sujet: "Relancer les clients impayés", ...base },
      { id: "b", sujet: "Relancer les clients impayés", ...base },
    ];
    const attendu = [["b", "c"], ["m", "z"]];
    expect(doublonsPossibles(s)).toEqual(attendu);
    expect(doublonsPossibles([...s].reverse())).toEqual(attendu);
  });
});

describe("défaut 6 : ChoixCible réactif et libellé valide", () => {
  it("le composant est utilisable côté client et expose onChange", () => {
    const src = readFileSync("src/components/ciblage/ChoixCible.tsx", "utf-8");
    expect(src.trimStart().startsWith('"use client"')).toBe(true);
    expect(src).toContain("onChange");
  });
  it("rendu serveur : radios contrôlés, niveau coché", () => {
    const h = renderToStaticMarkup(createElement(ChoixCible, { niveau: "secteur", valeur: "santé" }));
    expect(h.match(/checked=""/g)).toHaveLength(1);
    expect(h).toContain('value="santé"');
    const t = renderToStaticMarkup(createElement(ChoixCible, { niveau: "taille", valeur: "PME" }));
    expect(t.match(/checked=""/g)).toHaveLength(2);
  });
  it("appliquerChoix : choisir un niveau ouvre l'étape 2 et vide la valeur", () => {
    expect(appliquerChoix({ valeur: "" }, { type: "niveau", niveau: "metier" })).toEqual({ niveau: "metier", valeur: "" });
    expect(appliquerChoix({ niveau: "metier", valeur: "plombier" }, { type: "niveau", niveau: "taille" })).toEqual({ niveau: "taille", valeur: "" });
    expect(appliquerChoix({ niveau: "metier", valeur: "plombier" }, { type: "niveau", niveau: "metier" })).toEqual({ niveau: "metier", valeur: "plombier" });
    expect(appliquerChoix({ niveau: "metier", valeur: "" }, { type: "valeur", valeur: "maçon" })).toEqual({ niveau: "metier", valeur: "maçon" });
  });
  it("libelleCibleValide", () => {
    expect(libelleCibleValide("plombier")).toBe(true);
    expect(libelleCibleValide("  plombier  ")).toBe(true);
    expect(libelleCibleValide("a".repeat(80))).toBe(true);
    expect(libelleCibleValide("a".repeat(81))).toBe(false);
    expect(libelleCibleValide("")).toBe(false);
    expect(libelleCibleValide("   ")).toBe(false);
    expect(libelleCibleValide("deux\nlignes")).toBe(false);
    expect(libelleCibleValide("une\rligne")).toBe(false);
  });
});

describe("lot A2 : finitions du socle", () => {
  it("deux cibles courtes/longues dans un même texte : pas de déduction", () => {
    expect(deduireCiblage("les comptables et experts comptables")).toBeNull();
    expect(deduireCiblage("pour les experts comptables")?.libelle).toBe("expert-comptable");
    expect(deduireCiblage("les comptables")?.libelle).toBe("comptable");
  });
  it("cleCible ignore le pluriel", () => {
    const base = { sujet: "relancer les impayés rapidement", typeAutomatisation: "relances-impayes" as const };
    const g = doublonsPossibles([
      { id: "a", ...base, ciblage: { niveau: "metier", libelle: "Plombiers", origine: "saisie" } },
      { id: "b", ...base, ciblage: { niveau: "metier", libelle: "plombier", origine: "saisie" } },
    ]);
    expect(g).toEqual([["a", "b"]]);
  });
  it("la zone role=status est toujours présente", () => {
    const h = renderToStaticMarkup(createElement(ChoixCible, { niveau: "metier", suggestions: ["plombier"] }));
    expect(h).toContain('role="status"');
    expect(h).not.toContain("Aucune suggestion");
    const v = renderToStaticMarkup(createElement(ChoixCible, { niveau: "metier" }));
    expect(v).toContain('role="status"');
    expect(v).toContain("Aucune suggestion");
  });
  it("gererChoix appelle onChange avec (metier, \"\") au changement de niveau", () => {
    const appels: [string, string][] = [];
    const suivant = gererChoix({ niveau: "taille", valeur: "PME" }, { type: "niveau", niveau: "metier" }, (n, v) => appels.push([n, v]));
    expect(appels).toEqual([["metier", ""]]);
    expect(suivant).toEqual({ niveau: "metier", valeur: "" });
    gererChoix(suivant, { type: "valeur", valeur: "plombier" }, (n, v) => appels.push([n, v]));
    expect(appels[1]).toEqual(["metier", "plombier"]);
  });
  it("deduireCiblage gère le féminin", () => {
    expect(deduireCiblage("les agences immobilières")?.libelle).toBe("immobilier");
    expect(deduireCiblage("une agence immobilière")?.niveau).toBe("secteur");
    expect(deduireCiblage("les photographes et les électriciennes")).toBeNull();
    expect(deduireCiblage("une électricienne")?.libelle).toBe("électricien");
    expect(deduireCiblage("une coiffeuse")?.libelle).toBe("coiffeur");
  });
});
