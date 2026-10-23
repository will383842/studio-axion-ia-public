/**
 * Carte « Crédit Claude restant (estimé) » de l'Accueil : textes générés depuis une vue factice, rendu statique, aucun appel.
 * Affichage seulement : aucune clé entière, jamais « recharger » en mode abonnements, jamais un restant pour l'API payante.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const { CarteCreditClaude } = await import("@/app/(studio)/_accueil/CarteCreditClaude");
const { avertissementCreditClaude } = await import("@/domaine/credit-claude");

const MAINTENANT = "2026-10-19T10:00:00.000Z";
const CLE_ENTIERE = "sk-ant-fausse-cle-un-AAAA1111BBBB";

const compte = (n: number, extra: Record<string, unknown> = {}) => ({
  source: `abonnement-${n}`,
  libelle: `Compte ${n}`,
  finCle: `…${["AAAA", "BBBB", "CCCC"][n - 1]}`,
  etat: "estime",
  restantTexte: "120,00 $",
  restantCentimes: 12000,
  depuisTexte: "depuis le relevé du 12/10",
  base: "releve",
  releveLe: "2026-10-15T08:00:00.000Z",
  cycle: null,
  expireLe: null,
  prochainLe: null,
  desactive: false,
  doublon: false,
  horsTotalTexte: null,
  ...extra,
});

const vue = (extra: Record<string, unknown> = {}) =>
  ({
    totalTexte: "120,00 $",
    comptes: [compte(1)],
    api: { finCle: "…FFFF", eteinte: true, consommeMoisTexte: "3,50 $" },
    mode: "abonnements",
    ...extra,
  }) as never;

const rendre = (v: never) => renderToStaticMarkup(createElement(CarteCreditClaude, { vue: v, maintenant: MAINTENANT }));
const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("carte Crédit Claude de l'Accueil", () => {
  it("titre, total en gros, ligne de compte, lien vers les Réglages", () => {
    const html = rendre(vue());
    const t = texte(html);
    expect(t).toContain("Crédit Claude restant (estimé)");
    expect(t).toContain("120,00 $");
    expect(t).toContain("Compte 1 · …AAAA");
    expect(t).toContain("depuis le relevé du 12/10");
    expect(html).toContain('href="/reglages#credits-claude"');
  });

  it("aucun texte ne contient « recharg » en mode abonnements, ni une clé entière", () => {
    const cas = [
      vue(),
      vue({ totalTexte: "À renseigner", comptes: [compte(1, { etat: "a-renseigner", restantTexte: "À renseigner", restantCentimes: null, depuisTexte: null, base: null, releveLe: null })] }),
      vue({ comptes: [compte(1, { restantCentimes: 1500, restantTexte: "15,00 $" }), compte(2)] }),
      vue({ comptes: [compte(1, { etat: "expire", restantCentimes: 0, restantTexte: "Expiré (0 $)", prochainLe: "2026-11-11" })] }),
    ];
    for (const v of cas) {
      const html = rendre(v);
      expect(html).not.toMatch(/recharg/i);
      expect(html).not.toContain(CLE_ENTIERE);
      expect(html).not.toMatch(/sk-ant/);
    }
  });

  it("« à renseigner » : le total dit « À renseigner », jamais 0,00 $", () => {
    const t = texte(rendre(vue({ totalTexte: "À renseigner", comptes: [compte(1, { etat: "a-renseigner", restantTexte: "À renseigner", restantCentimes: null, depuisTexte: null, base: null, releveLe: null })] })));
    expect(t).toContain("À renseigner");
    expect(t).not.toMatch(/0,00\s*\$/);
  });

  it("compte expiré : « Expiré · revient vers le … » et brique si tous vides", () => {
    const html = rendre(vue({ totalTexte: "0,00 $", comptes: [compte(1, { etat: "expire", restantCentimes: 0, restantTexte: "Expiré (0 $)", prochainLe: "2026-11-11", depuisTexte: null })] }));
    const t = texte(html);
    expect(t).toMatch(/Expiré · revient vers le 11 nov/);
    expect(t).toMatch(/Comptes Claude vides jusqu'au renouvellement \(prochain : 11 nov\.?\)/);
    expect(html).toMatch(/text-brique|bg-brique/);
  });

  it("compte sous 20 $ : ambre « Compte N presque vide : le compte suivant prendra le relais »", () => {
    const html = rendre(vue({ comptes: [compte(1, { restantCentimes: 1500, restantTexte: "15,00 $" }), compte(2)] }));
    expect(texte(html)).toContain("Compte 1 presque vide : le compte suivant prendra le relais");
    expect(html).toMatch(/text-ambre|bg-ambre/);
    expect(html).not.toMatch(/Comptes Claude vides/);
  });

  it("compte hors total : motif affiché, absent de l'alerte", () => {
    const t = texte(rendre(vue({ comptes: [compte(1), compte(2, { restantCentimes: 0, restantTexte: "0 $", horsTotalTexte: "Compte désactivé : hors total." })] })));
    expect(t).toContain("Compte désactivé : hors total.");
    expect(t).not.toMatch(/presque vide|vides jusqu/);
  });

  it("relevé de plus de 7 jours : petit texte gris", () => {
    const t = texte(rendre(vue({ comptes: [compte(1, { releveLe: "2026-10-01T08:00:00.000Z" })] })));
    expect(t).toContain("Relevé ancien : vérifiez dans la Console");
    expect(texte(rendre(vue()))).not.toContain("Relevé ancien");
  });

  it("API payante : à part, grisée, « éteinte » / « allumée », la consommation du mois, jamais un restant", () => {
    const eteinte = texte(rendre(vue()));
    expect(eteinte).toContain("API payante · …FFFF · éteinte");
    expect(eteinte).toContain("3,50 $");
    expect(eteinte).not.toMatch(/API payante[^.]*restant/i);
    const allumee = texte(rendre(vue({ mode: "api", api: { finCle: "…FFFF", eteinte: false, consommeMoisTexte: "3,50 $" } })));
    expect(allumee).toContain("API payante · …FFFF · allumée");
  });

  it("avertissement pur : aucun en mode api ; ambre, brique, ancien", () => {
    const base = { maintenant: MAINTENANT, mode: "abonnements" as const };
    expect(avertissementCreditClaude({ ...base, mode: "api", comptes: [compte(1, { restantCentimes: 0 })] as never })).toBeNull();
    expect(avertissementCreditClaude({ ...base, comptes: [compte(1)] as never })).toBeNull();
    // Cas positifs.
    expect(avertissementCreditClaude({ ...base, comptes: [compte(1, { restantCentimes: 1500 }), compte(2)] as never })).toEqual({ ton: "ambre", texte: "Compte 1 presque vide : le compte suivant prendra le relais" });
    expect(avertissementCreditClaude({ ...base, comptes: [compte(1, { restantCentimes: 0 }), compte(2, { etat: "expire", restantCentimes: null, prochainLe: "2026-11-03T00:00:00.000Z" })] as never })).toEqual({ ton: "brique", texte: "Comptes Claude vides jusqu'au renouvellement (prochain : 2026-11-03)" });
    expect(avertissementCreditClaude({ ...base, comptes: [compte(1, { releveLe: "2026-10-01T08:00:00.000Z" })] as never })).toEqual({ ton: "gris", texte: "Relevé ancien : vérifiez dans la Console" });
    // Priorité : brique avant ambre avant gris.
    expect(avertissementCreditClaude({ ...base, comptes: [compte(1, { restantCentimes: 1500, releveLe: "2026-10-01T08:00:00.000Z" })] as never })?.ton).toBe("ambre");
  });
});
