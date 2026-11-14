/**
 * CAL-14C : « Ajouter » depuis la vue Jour. Chargeur des comptes (lecture seule), composant, action et page. Aucun appel réel.
 */
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { revalidatePath } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mini-moteur de crochets (le dépôt n'a ni jsdom ni testing-library) : le composant client est appelé comme une fonction.
vi.mock("react", async (o) => ({
  ...(await o<typeof import("react")>()),
  ...(await import("../aides/crochets-factices")).crochets,
  useId: () => "id-fixe", // absent du mini-moteur (tests/aides n'est pas touché)
}));
vi.mock("@/components/calendrier/AjouterEntreeProposant", () => ({ AjouterEntreeProposant: () => null }));

let lecture: () => unknown = () => null;
const canaux = { mockReset: () => { lecture = () => null; }, mockResolvedValue: (v: unknown) => { lecture = async () => v; }, mockPanne: () => { lecture = async () => { throw new Error("base en panne"); }; } };
vi.mock("@/services/comptes-envoi-zernio", () => ({ canauxZernioEnregistres: async () => lecture() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({ id: "s1" }) }));
vi.mock("@/services/publications", () => ({ listerCalendrier: async () => [], listerAProgrammer: async () => [] }));
vi.mock("@/app/(studio)/calendrier/charger-plan", () => ({ chargerPlanDuJour: async () => [] }));

import { comptesCibles } from "@/app/(studio)/calendrier/charger-comptes";
import { ajouterEntree } from "@/app/(studio)/calendrier/actions/ajouter";
import { reinitialiserDepots } from "@/donnees/memoire";
import { compteCibleValide } from "@/app/(studio)/calendrier/compte-cible";
import { monter, trouver } from "../aides/crochets-factices";

const canal = (id: string, service: string, deconnecte = false) => ({ id, organisationId: "o", nom: id, service, deconnecte });

describe("CAL-14C : compte cible choisi par le chargeur", () => {
  beforeEach(() => canaux.mockReset());
  it("un seul canal LinkedIn relié : son identifiant", async () => {
    canaux.mockResolvedValue({ lusLe: "x", canaux: [canal("lk-1", "linkedin"), canal("ig-1", "instagram"), canal("ig-2", "instagram")] });
    const r = await comptesCibles(["linkedin", "instagram"]);
    expect(r.linkedin).toBe("lk-1");
    expect(r.instagram).toBe("compte-studio"); // deux canaux : jamais de tirage au sort
  });
  it("un canal déconnecté ne compte pas", async () => {
    canaux.mockResolvedValue({ lusLe: "x", canaux: [canal("lk-1", "linkedin"), canal("lk-2", "linkedin", true)] });
    expect((await comptesCibles(["linkedin"])).linkedin).toBe("lk-1");
  });
  it("deux canaux ou aucun : compte-studio", async () => {
    canaux.mockResolvedValue({ lusLe: "x", canaux: [canal("lk-1", "linkedin"), canal("lk-2", "linkedin")] });
    expect((await comptesCibles(["linkedin", "tiktok"]))).toEqual({ linkedin: "compte-studio", tiktok: "compte-studio" });
    canaux.mockResolvedValue(null);
    expect((await comptesCibles(["linkedin"])).linkedin).toBe("compte-studio");
  });
  it("la lecture qui lève : valeur par défaut, la page ne casse pas", async () => {
    canaux.mockPanne();
    expect(await comptesCibles(["linkedin", "facebook"])).toEqual({ linkedin: "compte-studio", facebook: "compte-studio" });
  });
  it("page Facebook interdite : seule, elle n'est pas gardée « parce qu'il n'en reste qu'une »", async () => {
    canaux.mockResolvedValue({ lusLe: "x", canaux: [canal("zernio:fb:824208820772513", "facebook")] });
    expect((await comptesCibles(["facebook"])).facebook).toBe("compte-studio");
  });
  it("page Facebook ordinaire seule : son identifiant ; interdite à côté d'une autre : l'autre", async () => {
    canaux.mockResolvedValue({ lusLe: "x", canaux: [canal("zernio:fb:111", "facebook")] });
    expect((await comptesCibles(["facebook"])).facebook).toBe("zernio:fb:111");
    canaux.mockResolvedValue({ lusLe: "x", canaux: [canal("zernio:fb:824208820772513", "facebook"), canal("zernio:fb:111", "facebook")] });
    expect((await comptesCibles(["facebook"])).facebook).toBe("zernio:fb:111");
  });
  it("un identifiant de forme douteuse n'est pas proposé", async () => {
    canaux.mockResolvedValue({ lusLe: "x", canaux: [canal("<script>", "linkedin")] });
    expect((await comptesCibles(["linkedin"])).linkedin).toBe("compte-studio");
  });
});

describe("CAL-14C : action d'ajout, compte cible", () => {
  beforeEach(() => { reinitialiserDepots(); vi.useFakeTimers({ now: new Date("2026-11-20T10:00:00Z") }); });
  afterEach(() => vi.useRealTimers());
  const base = { jour: "2026-12-03", reseau: "linkedin" as const, videoId: "v1" };
  it("un compteCible <script> est refusé et n'écrit rien", async () => {
    const d = reinitialiserDepots();
    const r = await ajouterEntree({ ...base, compteCible: "<script>alert(1)</script>", cle: "c1" });
    expect(r.ok).toBe(false);
    expect(await d.creneauxEditoriaux.lister()).toHaveLength(0);
  });
  it("un identifiant de canal (avec deux-points) est accepté", async () => {
    const d = reinitialiserDepots();
    const r = await ajouterEntree({ ...base, compteCible: "zernio:fb:123.a_b-c", cle: "c2" });
    expect(r.ok).toBe(true);
    expect(await d.creneauxEditoriaux.lister()).toHaveLength(1);
  });
  it("la forme du compte est lue d'une seule source, par le chargeur comme par l'action", () => {
    for (const bon of ["lk-1", "zernio:fb:123.a_b-c", "a".repeat(80)]) expect(compteCibleValide(bon)).toBe(true);
    for (const mauvais of ["", "a".repeat(81), "<script>", "a b", 12, undefined]) expect(compteCibleValide(mauvais)).toBe(false);
  });
  it("vide ou trop long : refusé", async () => {
    expect((await ajouterEntree({ ...base, compteCible: "", cle: "c3" })).ok).toBe(false);
    expect((await ajouterEntree({ ...base, compteCible: "a".repeat(81), cle: "c4" })).ok).toBe(false);
  });
});

describe("CAL-15 : rafraîchissement après un ajout", () => {
  beforeEach(() => { reinitialiserDepots(); vi.useFakeTimers({ now: new Date("2026-11-20T10:00:00Z") }); vi.mocked(revalidatePath).mockClear(); });
  afterEach(() => vi.useRealTimers());
  const base = { jour: "2026-12-03", reseau: "linkedin" as const, videoId: "v1", compteCible: "lk-1" };
  it("revalidatePath(\"/calendrier\") est appelé une fois après une réussite", async () => {
    expect((await ajouterEntree({ ...base, cle: "r1" })).ok).toBe(true);
    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/calendrier");
  });
  it("jamais après un refus (compte invalide, jour invalide, date passée à confirmer)", async () => {
    expect((await ajouterEntree({ ...base, compteCible: "<script>", cle: "r2" })).ok).toBe(false);
    expect((await ajouterEntree({ ...base, jour: "2026-13-45", cle: "r3" })).ok).toBe(false);
    expect((await ajouterEntree({ ...base, jour: "2026-11-01", cle: "r4" })).ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("le rejeu d'une même clé ne rafraîchit pas une seconde fois", async () => {
    await ajouterEntree({ ...base, cle: "r5" });
    await ajouterEntree({ ...base, cle: "r5" });
    expect(revalidatePath).toHaveBeenCalledTimes(1);
  });
});

describe("CAL-14C : le bouton dans la vue Jour", () => {
  afterEach(() => vi.useRealTimers());
  it("composant : bouton fermé par défaut, rien d'autre de rendu", async () => {
    const { AjouterDuJour } = await import("@/components/calendrier/AjouterDuJour");
    const h = renderToStaticMarkup(<AjouterDuJour jour="2026-12-03" aujourdhui="2026-11-20" reseaux={["linkedin", "tiktok"]} comptes={{ linkedin: "lk-1" }} />);
    expect(h).toContain("+ Ajouter ce jour-là");
    expect(h).toContain('aria-expanded="false"');
    expect(h).not.toContain("<form"); // fermé : le formulaire n'est pas là
    expect(h).not.toMatch(/bg-orange(?![-\w])/); // pas un second orange plein
    expect(renderToStaticMarkup(<AjouterDuJour jour="2026-11-01" aujourdhui="2026-11-20" reseaux={["linkedin"]} comptes={{}} />)).toBe("");
    expect(renderToStaticMarkup(<AjouterDuJour jour="2026-12-03" aujourdhui="2026-11-20" reseaux={[]} comptes={{}} />)).toBe("");
  });
  it("composant OUVERT : le réseau coché et le compte passé au formulaire, avec repli compte-studio", async () => {
    const { AjouterDuJour } = await import("@/components/calendrier/AjouterDuJour");
    const { AjouterEntreeProposant } = await import("@/components/calendrier/AjouterEntreeProposant");
    type El = ReactElement<Record<string, unknown>>;
    const m = monter(AjouterDuJour, { jour: "2026-12-03", aujourdhui: "2026-11-20", reseaux: ["linkedin", "tiktok"], comptes: { linkedin: "lk-1" } });
    const bouton = () => trouver(m.rendre() as ReactNode, (e) => e.props["aria-expanded"] !== undefined)[0];
    const formulaire = () => trouver(m.rendre() as ReactNode, (e) => e.type === AjouterEntreeProposant)[0] as El | undefined;
    const radios = () => trouver(m.rendre() as ReactNode, (e) => e.type === "input" && e.props.type === "radio");
    expect(bouton().props["aria-expanded"]).toBe(false);
    expect(formulaire()).toBeUndefined();
    (bouton().props.onClick as () => void)();
    expect(bouton().props["aria-expanded"]).toBe(true);
    // Ouvert : premier réseau coché par défaut, son compte transmis.
    expect(radios().map((r) => [r.props.value, r.props.checked])).toEqual([["linkedin", true], ["tiktok", false]]);
    expect(formulaire()?.props).toMatchObject({ reseau: "linkedin", compteCible: "lk-1", jour: "2026-12-03" });
    // Choisir TikTok (aucun compte connu) : repli compte-studio.
    (radios()[1].props.onChange as () => void)();
    expect(radios().map((r) => r.props.checked)).toEqual([false, true]);
    expect(formulaire()?.props).toMatchObject({ reseau: "tiktok", compteCible: "compte-studio" });
  });
  it("page : jour passé sans bouton, aujourd'hui avec", async () => {
    vi.resetModules();
    vi.doMock("@/components/calendrier/AjouterDuJour", () => ({ AjouterDuJour: ({ jour }: { jour: string }) => <p data-marqueur="ajouter">{jour}</p> }));
    vi.useFakeTimers({ now: new Date("2026-11-20T10:00:00Z"), toFake: ["Date"] });
    canaux.mockResolvedValue(null);
    const { default: Page } = await import("../../src/app/(studio)/calendrier/page");
    const rendre = async (date: string) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ vue: "jour", date }) }));
    expect(await rendre("2026-11-10")).not.toContain('data-marqueur="ajouter"');
    expect(await rendre("2026-11-20")).toContain('data-marqueur="ajouter"');
    expect(await rendre("2026-11-25")).toContain('data-marqueur="ajouter"');
  });
});
