/**
 * NEW-ARG-01d · aucun montant à l'écran dans les six fichiers du lot d. Les coûts restent enregistrés ; seul l'affichage change.
 * Rendu serveur seulement (pas de jsdom) : on lit les textes produits par la logique et on garde les sources sans symbole d'argent.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { messageSansMontant } from "@/components/ui/ConfirmationPrix";
import { centimes } from "@/lib/montants";
import { decisionLancement, libelleBoutonFabriquer, libellePastille, prixEnVrai } from "@/assistant/express/logique";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const SANS_ARGENT = /€|\$|euros?\b|dollars?\b|\bUSD\b|\bEUR\b/i;
const FICHIERS = [
  "src/assistant/express/FeuillePlateau.tsx",
  "src/assistant/express/VoirLesPlans.tsx",
  "src/assistant/express/logique.ts",
  "src/components/formats/cas-concret/fiche-video/SuiviCasConcret.tsx",
  "src/components/formats/cas-concret/stock/StockDesCas.tsx",
  "src/components/formats/commun/BoutonFabriquer.tsx",
];

describe("sources du lot d", () => {
  it.each(FICHIERS)("%s : aucun « € », « $ » ni « euros »", (f) => {
    const source = readFileSync(f, "utf8").replace(/\$\{|`[^`]*\$\{/g, "");
    expect(source.replace(/\$\{[^}]*\}/g, "")).not.toMatch(/€|\beuros?\b/i);
  });
  it.each(["src/assistant/express/FeuillePlateau.tsx", "src/assistant/express/VoirLesPlans.tsx", "src/components/formats/cas-concret/fiche-video/SuiviCasConcret.tsx"])(
    "%s : les messages venus du serveur passent par messageSansMontant",
    (f) => {
      expect(readFileSync(f, "utf8")).toContain("messageSansMontant");
    },
  );
});

describe("textes de la logique", () => {
  it("libellé du bouton : aucun montant, essai ou non", () => {
    for (const essaiGratuit of [true, false]) {
      expect(libelleBoutonFabriquer({ montant: centimes(1234), dureeFabricationSec: 125, essaiGratuit })).not.toMatch(SANS_ARGENT);
    }
  });
  it("« En vrai » : rien à afficher", () => expect(prixEnVrai(centimes(103))).toBeNull());
  it("pastilles : aucun montant", () => {
    for (const etat of ["trouve", "a-creer", "repli"] as const) {
      const t = libellePastille({ etat, libelle: "Costume bleu", genre: "tenue", id: "x", repli: "assis", dureeEstimeeSec: 60, cout: centimes(25) } as never);
      expect(t).not.toMatch(SANS_ARGENT);
      expect(t).not.toMatch(/\d/);
    }
  });
  it("décision de lancement : les raisons n'ont aucun montant, et un lancement n'est pas bloqué en mode indicatif", () => {
    const d = decisionLancement({ coutCentimes: 9000, seuilCentimes: 100, resteCentimes: 10, aVerifier: [], budgetIndicatif: true });
    expect(d.genre).toBe("confirmer");
    expect(JSON.stringify(d)).not.toMatch(SANS_ARGENT);
  });
});

describe("messages du serveur", () => {
  it.each(["Cela coûtera environ 1,03 €.", "Prix : 12 euros", "Total $4.50", "Au plus 3,20 € ce mois-ci"])("« %s » : aucun montant ne reste", (m) => {
    const t = messageSansMontant(m);
    expect(t).not.toMatch(SANS_ARGENT);
    expect(t).not.toMatch(/\d/);
  });
});

describe("rendu", () => {
  it("le bouton Fabriquer ne montre aucun montant", async () => {
    const { BoutonFabriquer } = await import("@/components/formats/commun/BoutonFabriquer");
    const html = renderToStaticMarkup(createElement(BoutonFabriquer, { montantCentimes: 1234, onFabriquer: async () => undefined }));
    const t = html.replace(/<[^>]*>/g, " ");
    expect(t).not.toMatch(SANS_ARGENT);
    expect(t).not.toMatch(/\d/);
  });
});
