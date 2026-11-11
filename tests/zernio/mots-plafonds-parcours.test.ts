/** STU-PLAFONDS : la carte « Plafonds » de /mots écrit le réglage que le parcours LIT, et l'écran montre l'état du parcours (compteurs seulement). Valeurs fictives. */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LigneMot } from "@/services/mots-service";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { lireParametre, ecrireParametre } = await import("@/services/_commun");
const S = await import("@/services/mots-service");
const P = await import("@/services/parcours-conversation");
const { plafondHeureCompte } = await import("@/domaine/guide-reseau/plafonds-conversation");
const { PARAM_OPPOSITIONS_MOTS } = await import("@/services/oppositions-mots");
const { EcranMots } = await import("@/components/mots/EcranMots");

const ENV = { PARCOURS_CONVERSATION_TITRE_GUIDE: "Guide fictif" };
beforeEach(() => {
  reinitialiserDepots();
});

describe("la carte écrit ce que le parcours lit", () => {
  it("le réglage par heure arrive dans le paramètre lu par le parcours", async () => {
    await S.reglerPlafonds({ heureCompte: 45 });
    expect(plafondHeureCompte(await lireParametre<unknown>(P.PARAM_PLAFONDS_CONVERSATION, undefined))).toBe(45);
  });
  it("borné à 600 comme côté parcours", async () => {
    await S.reglerPlafonds({ heureCompte: 5000 });
    expect(plafondHeureCompte(await lireParametre<unknown>(P.PARAM_PLAFONDS_CONVERSATION, undefined))).toBe(600);
  });
  it("le plafond par mot et par jour ne touche pas le réglage du parcours", async () => {
    await S.reglerPlafonds({ jourMot: 77 });
    expect(await lireParametre<unknown>(P.PARAM_PLAFONDS_CONVERSATION, undefined)).toBeUndefined();
    expect((await S.lireVueMots(ENV)).plafonds.jourMot).toBe(77);
  });
  it("la vue affiche la valeur effectivement lue par le parcours (défaut 30, pas 600)", async () => {
    expect((await S.lireVueMots(ENV)).plafonds.heureCompte).toBe(30);
    await ecrireParametre(P.PARAM_PLAFONDS_CONVERSATION, { heureCompte: 12 });
    expect((await S.lireVueMots(ENV)).plafonds.heureCompte).toBe(12);
  });
});

describe("état du parcours en lecture seule", () => {
  it("éteint par défaut, allumé avec l'interrupteur du parcours", async () => {
    expect((await S.lireVueMots(ENV)).parcoursAllume).toBe(false);
    expect((await S.lireVueMots({ ...ENV, PARCOURS_CONVERSATION_ENABLED: "1" })).parcoursAllume).toBe(true);
  });
  it("compte les « stop » en doute (non transmis), des nombres seulement", async () => {
    await ecrireParametre(PARAM_OPPOSITIONS_MOTS, [
      { id: "e1", le: "2026-01-01", transmise: false },
      { id: "e2", le: "2026-01-01", transmise: true },
      { id: "e3", le: "2026-01-01", transmise: false },
    ]);
    const vue = await S.lireVueMots(ENV);
    expect(vue.oppositionsEnDoute).toBe(2);
    expect(JSON.stringify(vue)).not.toMatch(/e1|e3/);
  });
});

const vue = { guidePerime: false, interrupteurAllume: false, toutArrete: false, disjoncteur: { ouvert: false, raison: null, ouvertLe: null }, plafonds: { heureCompte: 30, jourMot: 100 }, lignes: [] as LigneMot[], oppositions: 0, guideValide: true, parcoursAllume: true, oppositionsEnDoute: 3 };
const services = { mettreEnPause: vi.fn(), reactiver: vi.fn(), activerLocal: vi.fn(), mettreEnPauseLocal: vi.fn(), refermerDisjoncteur: vi.fn(), reglerPlafonds: vi.fn(), validerGuide: vi.fn() };

describe("écran", () => {
  it("la carte montre parcours allumé, textes validés et le nombre de « stop » en doute", () => {
    const html = renderToStaticMarkup(createElement(EcranMots, { vue, services: services as never }));
    const carte = html.slice(html.indexOf('data-carte="plafonds"'));
    expect(carte).toMatch(/Parcours des messages privés : allumé/);
    expect(carte).toMatch(/Textes validés/);
    expect(carte).toMatch(/3 « stop » en doute/);
  });
  it("éteint et non validé", () => {
    const html = renderToStaticMarkup(createElement(EcranMots, { vue: { ...vue, parcoursAllume: false, guideValide: false, oppositionsEnDoute: 0 }, services: services as never }));
    const carte = html.slice(html.indexOf('data-carte="plafonds"'));
    expect(carte).toMatch(/Parcours des messages privés : éteint/);
    expect(carte).toMatch(/Textes non validés/);
    expect(carte).toMatch(/Aucun « stop » en doute/);
  });
});
