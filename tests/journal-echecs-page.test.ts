/** GV-EC-02 — page « Échecs » : lecture du journal durable, compteurs, cas vide. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./site-videos/helpers";
import type { LigneEchec } from "@/domaine/journal-echecs";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { depots } = await import("@/donnees/memoire");
const { lireEchecs } = await import("@/services/journal-echecs");
const { default: PageEchecs } = await import("@/app/(studio)/reglages/echecs/page");

beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});
beforeEach(async () => {
  await preparerBase();
});

const html = async () => renderToStaticMarkup(createElement("div", null, await PageEchecs()));

function ligne(i: number, famille: LigneEchec["famille"], code: string, joursAvant = 1, demo = false): { l: LigneEchec; demo: boolean } {
  const date = new Date(Date.now() - joursAvant * 86_400_000 - i * 1000).toISOString();
  return { demo, l: { date, videoId: `v-${i}`, travailId: `tr-${i}`, generateur: "avocat", moteur: "m", etape: "montage", code, famille, phrase: `Phrase ${i}`, detail: "détail", essai: 1 } };
}

async function poser(l: LigneEchec, demo = false) {
  await depots().evenements.enregistrer({ id: `ev-echec-${l.travailId}-1`, type: "echec-detail", message: "x", entite: "video", entiteId: l.videoId, estDemo: demo, date: l.date, creeLe: l.date, modifieLe: l.date, echec: l } as never);
}

describe("GV-EC-02 · page Échecs", () => {
  it("zéro ligne : « Aucun échec sur 30 jours », sans erreur", async () => {
    expect(await html()).toContain("Aucun échec sur 30 jours");
  });

  it("lireEchecs : exclut les exemples et les lignes de plus de 30 jours, du plus récent au plus ancien", async () => {
    await poser(ligne(1, "controle", "BUDGET_X", 3).l);
    await poser(ligne(2, "controle", "BUDGET_X", 1).l);
    await poser(ligne(3, "controle", "BUDGET_X", 2, true).l, true);
    await poser(ligne(4, "controle", "BUDGET_X", 40).l);
    const r = await lireEchecs({ joursMax: 30 });
    expect(r.map((x) => x.travailId)).toEqual(["tr-2", "tr-1"]);
  });

  it("avec des lignes : total, attentes à part, liens vers les vidéos, aucun symbole d'argent", async () => {
    for (let i = 1; i <= 3; i++) await poser(ligne(i, "controle", "BUDGET_X").l);
    await poser(ligne(4, "fournisseur", "FOURNISSEUR_REFUS").l);
    await poser(ligne(5, "attente-validation", "IV_CARTE_A_VALIDER").l);
    const h = await html();
    expect(h).toContain("30 jours : 4 échecs, dont 3 pour un contrôle, 1 pour un outil");
    expect(h).toContain("1 en attente de votre validation");
    expect(h).toContain('href="/videos/v-1"');
    expect(h).not.toContain("Phrase 5");
    expect(h).not.toMatch(/€|\$/);
  });
});
