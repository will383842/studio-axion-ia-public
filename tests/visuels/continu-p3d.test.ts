import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CARTES_CAS } from "../../src/briques/visuels/continu/familles/cas";
import { GABARITS, GABARITS_PRODUCTION } from "../../src/briques/visuels/continu/registre-gabarits";
import { TEXTES_FIXES_L9 } from "../../src/briques/visuels/textes-fixes";
import { COMPOSANTS_PLAQUETTES } from "../../studio-rendu/compositions/visuels/continu/registre-composants";

vi.mock("remotion", () => ({ cancelRender: () => undefined, continueRender: () => undefined, delayRender: () => 0, AbsoluteFill: () => null }));

/** Table attendue (maquette v3, famille « Cas concrets ») : `dk` → sombre, `or` → orangeFort. */
const ATTENDU: Record<string, { nom: string; sombre: boolean; orangeFort: boolean }> = {
  S01: { nom: "Fenêtre : la relance", sombre: false, orangeFort: false },
  S02: { nom: "Conversation", sombre: true, orangeFort: false },
  S03: { nom: "Schéma en trois nœuds", sombre: false, orangeFort: false },
};

/** Budgets (caractères) par champ de texte ; le texte au budget passe, le budget + 1 échoue. */
const BUDGETS: Record<string, Record<string, number>> = {
  S01: { titre: 22, accent: 22, fenetre: 34, destinataire: 24, objet: 40, message: 150, validation: 36 },
  S02: { titre: 22, accent: 28, question: 70, reponse: 50, pret: 50, validation: 24 },
  S03: { titre: 28, accent: 24 },
};
const BUDGET_NOEUD = { titre: 22, texte: 48 };

const cas = () => CARTES_CAS;
const exemple = (type: string) => cas().find((g) => g.type === type)!.exemple as Record<string, unknown>;

describe("continu P3d : cas concrets", () => {
  it("les trois cas S01 à S03, dans cet ordre, de la famille « cas »", () => {
    expect(cas().map((g) => g.type)).toEqual(["S01", "S02", "S03"]);
    for (const g of cas()) {
      expect(g.famille).toBe("cas");
      expect(g.nom).toBe(ATTENDU[g.type].nom);
      expect(g.role).toBe("contenu");
    }
  });
  it("sombre / orangeFort conformes à la maquette, version >= 1, actifs", () => {
    for (const g of cas()) {
      expect(g.sombre, g.type).toBe(ATTENDU[g.type].sombre);
      expect(g.orangeFort, g.type).toBe(ATTENDU[g.type].orangeFort);
      expect(g.version, g.type).toBeGreaterThanOrEqual(1);
      expect(g.actif, g.type).toBe(true);
    }
    expect(GABARITS_PRODUCTION.map((g) => g.type)).toEqual(expect.arrayContaining(["S01", "S02", "S03"]));
  });
  it("les trois portent cas:true (étiquette posée par le code)", () => {
    for (const g of cas()) expect(g.cas, g.type).toBe(true);
    expect(TEXTES_FIXES_L9.t26Etiquette).toBe("Scénario type · exemple illustratif");
  });
  it("le rendu de chaque cas affiche l'étiquette « Scénario type » posée par le code", () => {
    for (const g of cas()) {
      const rendu = renderToStaticMarkup(createElement(COMPOSANTS_PLAQUETTES[g.type], { page: g.exemple as never, index: 1, total: 3, hauteur: 1350, sombre: g.sombre }));
      expect(rendu, g.type).toContain(TEXTES_FIXES_L9.t26Etiquette);
    }
  });
  it("l'exemple passe le schéma, un champ inconnu (dont « etiquette ») est refusé", () => {
    for (const g of cas()) {
      expect(g.schema.safeParse(g.exemple).success, g.type).toBe(true);
      expect(g.schema.safeParse({ ...exemple(g.type), etiquette: "Scénario type" }).success, g.type).toBe(false);
      expect(g.schema.safeParse({ ...exemple(g.type), inconnue: 1 }).success, g.type).toBe(false);
      expect(String((g.exemple as { alt: string }).alt).length, g.type).toBeLessThanOrEqual(125);
      expect(g.bordsLibres.gauche.length + g.bordsLibres.droite.length, g.type).toBeGreaterThan(0);
    }
  });
  it("budgets : le texte au budget passe, budget + 1 échoue", () => {
    for (const [type, champs] of Object.entries(BUDGETS)) {
      const g = cas().find((x) => x.type === type)!;
      for (const [champ, max] of Object.entries(champs)) {
        expect(g.schema.safeParse({ ...exemple(type), [champ]: "a".repeat(max) }).success, `${type}.${champ} = ${max}`).toBe(true);
        expect(g.schema.safeParse({ ...exemple(type), [champ]: "a".repeat(max + 1) }).success, `${type}.${champ} = ${max + 1}`).toBe(false);
      }
    }
  });
  it("S03 : exactement trois nœuds, budgets de chaque nœud", () => {
    const g = cas().find((x) => x.type === "S03")!;
    const noeuds = exemple("S03").noeuds as { titre: string; texte: string }[];
    expect(noeuds).toHaveLength(3);
    expect(g.schema.safeParse({ ...exemple("S03"), noeuds: noeuds.slice(0, 2) }).success).toBe(false);
    expect(g.schema.safeParse({ ...exemple("S03"), noeuds: [...noeuds, noeuds[0]] }).success).toBe(false);
    for (const [champ, max] of Object.entries(BUDGET_NOEUD)) {
      const avec = (n: number) => ({ ...exemple("S03"), noeuds: [{ ...noeuds[0], [champ]: "a".repeat(n) }, noeuds[1], noeuds[2]] });
      expect(g.schema.safeParse(avec(max)).success, champ).toBe(true);
      expect(g.schema.safeParse(avec(max + 1)).success, champ).toBe(false);
    }
  });
  it("les noms propres d'exemple restent des champs (aucun n'est posé par le code)", () => {
    expect(exemple("S01").destinataire).toBe("M. Martin");
    expect(String(exemple("S01").fenetre)).toContain("Martin");
  });
  it("un lien dans un texte est refusé", () => {
    const g = cas().find((x) => x.type === "S01")!;
    expect(g.schema.safeParse({ ...exemple("S01"), message: "Voir https://exemple.fr" }).success).toBe(false);
  });
  it("chaque type du registre a son composant déclaré", () => {
    for (const g of GABARITS.filter((x) => x.famille === "cas")) expect(typeof COMPOSANTS_PLAQUETTES[g.type], g.type).toBe("function");
  });
});
