/** Fiche carrousel : les cases « Préparer pour les réseaux » reflètent les réseaux déjà préparés. Aucun appel réel. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DepotMemoire } from "@/donnees/memoire";
import type { Visuel } from "@/domaine/visuels/visuel";
import type { DependancesCarrousels } from "@/visuels/services/carrousels";
import { ficheCarrousel } from "@/visuels/services/vues";

const etat = vi.hoisted(() => ({ fiche: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: () => undefined }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({ id: "s1" }) }));
vi.mock("@/visuels/services/production", () => ({ dependancesCarrousels: () => ({ lireParametre: async (_i: string, d: unknown) => d }), phraseDuCode: () => undefined, codeErreur: () => "", lireIdFormulaire: () => "" }));
vi.mock("@/visuels/services/vues", async (orig) => {
  const m = await orig<typeof import("@/visuels/services/vues")>();
  return { ...m, ficheCarrousel: async (...a: Parameters<typeof m.ficheCarrousel>) => (etat.fiche ? etat.fiche : m.ficheCarrousel(...a)) };
});
vi.mock("@/app/(studio)/carrousels/[id]/actions", () => {
  const f = async () => undefined;
  return { corbeilleAction: f, enregistrerLegendeAction: f, preparerReseauxAction: f, programmerAction: f, refaireAction: f, refuserAction: f, relancerRenduAction: f, restaurerAction: f, retirerDuCalendrierAction: f, validerAction: f };
});

const LE = "2026-11-10T08:00:00.000Z";
async function fiche(extra: Partial<Visuel>) {
  const depot = new DepotMemoire<Visuel>();
  await depot.enregistrer({ id: "v1", famille: "carrousel", titre: "Titre", entree: { type: "sujet", sujet: "S" }, statut: "valide", modeTexte: "simulation", spec: { version: "carrousel/1", alt: "a", pages: [] }, pourquoi: [], versionSpec: 1, coutCentimes: 0, creeLe: LE, modifieLe: LE, ...extra } as Visuel);
  const deps = { depot, urlLecture: async (c: string) => c, maintenant: () => LE, allume: async () => true, lireParametre: async <T,>(_i: string, d: T) => d } as unknown as DependancesCarrousels;
  const m = await vi.importActual<typeof import("@/visuels/services/vues")>("@/visuels/services/vues");
  return m.ficheCarrousel("v1", deps);
}

describe("ficheCarrousel : réseaux préparés", () => {
  it("rend les réseaux du visuel quand il en a", async () => {
    expect((await fiche({ reseaux: ["facebook"] })).reseaux).toEqual(["facebook"]);
  });
  it("rien sinon", async () => {
    expect("reseaux" in (await fiche({}))).toBe(false);
    expect("reseaux" in (await fiche({ reseaux: [] }))).toBe(false);
  });
  void ficheCarrousel;
});

describe("page de la fiche : cases cochées", () => {
  async function rendre(f: unknown): Promise<string> {
    etat.fiche = f;
    const { default: Page } = await import("@/app/(studio)/carrousels/[id]/page");
    const el = await Page({ params: Promise.resolve({ id: "v1" }), searchParams: Promise.resolve({}) });
    etat.fiche = null;
    return renderToStaticMarkup(el as never);
  }
  const cochee = (html: string, r: string): boolean => (html.match(/<input[^>]*name="reseau"[^>]*>/g) ?? []).some((i) => i.includes(`value="${r}"`) && i.includes('checked=""'));
  it("['facebook'] : seule la case Facebook est cochée", async () => {
    const html = await rendre({ ...(await fiche({ reseaux: ["facebook"] })) });
    expect([cochee(html, "linkedin"), cochee(html, "instagram"), cochee(html, "facebook")]).toEqual([false, false, true]);
  });
  it("sans réseaux : LinkedIn et Instagram cochés, pas Facebook", async () => {
    const html = await rendre({ ...(await fiche({})) });
    expect([cochee(html, "linkedin"), cochee(html, "instagram"), cochee(html, "facebook")]).toEqual([true, true, false]);
  });
});
