/** K4 : tableau de bord du stock (rendu serveur), paramètres de lien, réglage éteint = rendu d'avant. Jeu de démonstration en mémoire. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StockDesCas } from "@/components/formats/cas-concret/stock/StockDesCas";
import { lienStock, lireParamsStock, PAR_PAGE } from "@/components/formats/cas-concret/stock/filtres-stock";
import type { LigneStock } from "@/services/cas-concret-stock";
import type { FiltresStock } from "@/services/cas-concret-stock-synthese";
import type { Rangement } from "@/formats/cas-concret/stock-metiers/schema";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("@/app/(studio)/cas-concret/actions", () => ({ remettreEnStockAction: vi.fn() }));

const rangement = (fiche: string, secteur: string, taille: Rangement["taille"]): Rangement => ({
  fiche, secteur, metier: "metier-test", metierNom: "Métier", taille, socle: "S02", inventaire: [], niveauPreuve: "lu-dans-le-code", douleur: "douleur-test", casUsage: null, voisinCatalogue: null, angle: null,
});
const ligne = (n: number, o: { secteur?: string; taille?: Rangement["taille"]; offre?: LigneStock["offre"]; traite?: boolean; valide?: boolean }): LigneStock => ({
  casId: `cas-${n}`,
  titre: `Titre du cas ${n}`,
  offre: o.offre ?? "integration",
  posture: "offre",
  script: o.valide === false ? { valide: false } : { valide: true, version: 1, date: "2026-10-01" },
  videos: { total: o.traite ? 1 : 0, faites: o.traite ? 1 : 0, comptees: o.traite ? 1 : 0, parEtat: o.traite ? { validee: 1 } : {} },
  ...(o.secteur ? { rangement: rangement(`${o.secteur}-${String(n).padStart(2, "0")}`, o.secteur, o.taille ?? "PME") } : {}),
  faits: { total: 0, avecPreuve: 0, aSignaler: [] },
});

/** 45 cas : 30 IN (10 traités), 15 BT en TPE audit. */
const jeu: LigneStock[] = [
  ...Array.from({ length: 30 }, (_, i) => ligne(i + 1, { secteur: "IN", taille: "PME", traite: i < 10 })),
  ...Array.from({ length: 15 }, (_, i) => ligne(i + 31, { secteur: "BT", taille: "TPE", offre: "audit" })),
];
const rendre = (tableau?: { filtres: FiltresStock; page: number; ouvert?: boolean }, lignes = jeu) => renderToStaticMarkup(createElement(StockDesCas, { lignes, idees: [], ...(tableau ? { tableau } : {}) }));
const nbCartes = (html: string) => (html.match(/<li /g) ?? []).length;
const chiffre = (n: number, nom: string) => `<span class="text-[22px] font-semibold text-texte">${n}</span><span class="text-[13px] text-texte-doux">${nom}</span>`;

describe("tableau de bord du stock", () => {
  it("montre le bandeau : total, restants, déjà traités, à valider, validés", () => {
    const h = rendre({ filtres: {}, page: 1 });
    expect(h).toContain(chiffre(45, "Cas au total"));
    expect(h).toContain(chiffre(35, "Restants"));
    expect(h).toContain(chiffre(10, "Déjà faits"));
    expect(h).toContain(chiffre(0, "À valider"));
    expect(h).toContain(chiffre(45, "Validés"));
  });

  it("montre les compteurs par secteur, taille et offre, en liens", () => {
    const h = rendre({ filtres: {}, page: 1 });
    expect(h).toContain('href="/cas-concret?secteur=IN&amp;vue=stock#stock"');
    expect(h).toContain('href="/cas-concret?taille=TPE&amp;vue=stock#stock"');
    expect(h).toContain('href="/cas-concret?offre=audit&amp;vue=stock#stock"');
    expect(h).toMatch(/Industrie<\/span><span[^>]*>30</);
    expect(h).toMatch(/TPE<\/span><span[^>]*>15</);
  });

  it("pagine par 20 et propose la page suivante, puis la précédente", () => {
    const p1 = rendre({ filtres: {}, page: 1 });
    expect(nbCartes(p1)).toBe(PAR_PAGE);
    expect(p1).toContain("Page 1 sur 3");
    expect(p1).toContain('href="/cas-concret?page=2&amp;vue=stock#stock"');
    expect(p1).not.toContain("Page précédente");
    const p3 = rendre({ filtres: {}, page: 3 });
    expect(nbCartes(p3)).toBe(5);
    expect(p3).toContain("Page précédente");
    expect(p3).not.toContain("Page suivante");
  });

  it("ramène une page trop grande à la dernière", () => {
    expect(rendre({ filtres: {}, page: 99 })).toContain("Page 3 sur 3");
  });

  it("filtre : les filtres se combinent", () => {
    const h = rendre({ filtres: { secteur: "IN", etat: "restant" }, page: 1 });
    expect(nbCartes(h)).toBe(PAR_PAGE);
    expect(h).toContain("20 cas");
    expect(h).toContain('aria-current="true"');
    expect(rendre({ filtres: { secteur: "BT", taille: "TPE", offre: "audit" }, page: 1 })).toContain("15 cas");
  });

  it("« Aucun cas pour ces filtres » quand rien ne passe, avec un lien pour tout afficher", () => {
    const h = rendre({ filtres: { secteur: "BT", taille: "PME" }, page: 1 });
    expect(h).toContain("Aucun cas pour ces filtres");
    expect(nbCartes(h)).toBe(0);
    expect(h).toContain('href="/cas-concret?vue=stock#stock"');
  });

  it("est en lecture seule : aucun bouton, aucun formulaire", () => {
    const h = rendre({ filtres: { secteur: "IN" }, page: 2 });
    expect(h).not.toContain("<button");
    expect(h).not.toContain("<form");
  });

  it("s'ouvre quand un filtre ou une page est demandé, reste replié sinon", () => {
    expect(rendre({ filtres: {}, page: 1 })).not.toMatch(/<details[^>]* open/);
    expect(rendre({ filtres: { secteur: "IN" }, page: 1 })).toMatch(/<details[^>]* open/);
  });

  it("reste ouvert quand l'adresse porte le marqueur du tableau, même sans filtre ni page (Tout afficher, page 1)", () => {
    expect(rendre({ filtres: {}, page: 1, ouvert: true })).toMatch(/<details[^>]* open/);
    expect(lireParamsStock({ vue: "stock" }, ["IN"]).ouvert).toBe(true);
    expect(lireParamsStock({}, ["IN"]).ouvert).toBe(false);
    const q = Object.fromEntries(new URL(lienStock({}), "http://x").searchParams);
    expect(lireParamsStock(q, ["IN"]).ouvert).toBe(true);
  });

  it("montre le libellé du secteur et garde le code dans l'adresse", () => {
    const h = rendre({ filtres: {}, page: 1 });
    expect(h).toContain("Industrie");
    expect(h).toContain("Bâtiment");
    expect(h).toContain('href="/cas-concret?secteur=IN&amp;vue=stock#stock"');
    expect(h).toContain('role="group" aria-labelledby="filtre-stock-secteur"');
    expect(h).toContain('id="filtre-stock-secteur"');
  });
});

describe("paramètres de lien", () => {
  const secteurs = ["IN", "BT"];
  it("lit les valeurs connues", () => {
    expect(lireParamsStock({ secteur: "IN", taille: "PME", offre: "integration", etat: "restant", page: "2" }, secteurs)).toEqual({ filtres: { secteur: "IN", taille: "PME", offre: "integration", etat: "restant" }, page: 2, ouvert: false });
  });
  it("ignore sans erreur les valeurs inconnues, vides, doubles ou absurdes", () => {
    expect(lireParamsStock({ secteur: "ZZ", taille: "GRANDE", offre: "tous", etat: "peut-etre", page: "abc" }, secteurs)).toEqual({ filtres: {}, page: 1, ouvert: false });
    expect(lireParamsStock({ page: "-3" }, secteurs).page).toBe(1);
    expect(lireParamsStock({ page: "1.5" }, secteurs).page).toBe(1);
    expect(lireParamsStock({ secteur: ["BT", "IN"] }, secteurs).filtres).toEqual({ secteur: "BT" });
    expect(lireParamsStock(undefined, secteurs)).toEqual({ filtres: {}, page: 1, ouvert: false });
  });
  it("une adresse relue donne les mêmes filtres", () => {
    const f: FiltresStock = { secteur: "IN", taille: "ETI", offre: "formation", etat: "valide" };
    const q = Object.fromEntries(new URL(lienStock(f, 2), "http://x").searchParams);
    expect(lireParamsStock(q, secteurs)).toEqual({ filtres: f, page: 2, ouvert: true });
  });
});

describe("réglage éteint : rien ne change", () => {
  it("sans `tableau`, la carte liste tous les cas, repliée, sans lien ni identifiant", () => {
    const h = rendre(undefined, jeu);
    expect(nbCartes(h)).toBe(jeu.length);
    expect(h).not.toContain("<a ");
    expect(h).not.toContain('id="stock"');
    expect(h).not.toMatch(/<details[^>]* open/);
    expect(h).not.toContain("Cas au total");
    expect(h).not.toContain("Page ");
  });
});
