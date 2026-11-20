/** RAP-3 finitions · rapatriées introuvables chez le diffuseur (« à vérifier ») : comptage et retrait groupé LOCAL. Données fictives. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { creerFauxClientZernio } from "./aides/faux-zernio";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
const exiger = vi.fn(async () => ({}));
vi.mock("@/services/auth", () => ({ exigerSession: exiger, sessionApi: vi.fn(async () => ({})) }));

const { depots, reinitialiserDepots } = await import("@/donnees/memoire");
const { retirerIntrouvablesAction } = await import("@/app/(studio)/calendrier/actions/retirer-introuvables");
const { lireEcartCalendrier } = await import("@/services/ecart-calendrier");
const { injecterClientZernio } = await import("@/services/zernio");

const NOW_ISO = new Date().toISOString();
const ANCIEN = new Date(Date.now() - 30 * 3600_000).toISOString();
const base = { reseau: "instagram", statut: "programmee", via: "zernio", etatEnvoi: "envoye", date: "2026-12-25T08:30:00.000Z", texte: "Texte fictif", creeLe: "2026-11-20T10:00:00.000Z", modifieLe: "2026-11-20T10:00:00.000Z", rapatrieeLe: "2026-11-20T10:00:00.000Z", origineDiffuseur: "import-buffer", mediaDiffuseur: { type: "aucun", nombre: 0 } };
const retirable = { etatEnvoi: "a-verifier", introuvableDepuis: ANCIEN, constatsIntrouvable: 2 };
const pub = (id: string, o: object = {}) => depots().publications.enregistrer({ ...base, id, idExterne: id, ...o } as never);
let appels: string[];

beforeEach(async () => {
  reinitialiserDepots();
  exiger.mockClear();
  appels = [];
  const faux = creerFauxClientZernio() as unknown as Record<string, unknown>;
  injecterClientZernio(new Proxy(faux, { get: (c, p) => (typeof c[p as string] === "function" ? () => { appels.push(String(p)); throw new Error("appel interdit"); } : c[p as string]) }) as never);
  await depots().parametres.enregistrer({ id: "zernio.ecart_calendrier", valeur: { luLe: NOW_ISO, verifie: true, chezDiffuseur: 5, absents: 0, exemples: [] }, creeLe: NOW_ISO, modifieLe: NOW_ISO } as never);
  await pub("zr_a", retirable);
  await pub("zr_b", { ...retirable, statut: "brouillon" });
  await pub("zr_un_constat", { etatEnvoi: "a-verifier", introuvableDepuis: ANCIEN, constatsIntrouvable: 1 });
  await pub("zr_recent", { etatEnvoi: "a-verifier", introuvableDepuis: NOW_ISO, constatsIntrouvable: 3 });
  await pub("zr_ancienne", { etatEnvoi: "a-verifier" }); // d'avant : sans champs de constat
  await pub("zr_ok", { etatEnvoi: "envoye" });
  await pub("zr_deja", { etatEnvoi: "a-verifier", retireeLe: "2026-11-20T11:00:00.000Z" });
  await pub("pub_studio", { etatEnvoi: "a-verifier", via: "zernio", rapatrieeLe: undefined, visuelId: "v1" });
  await pub("zr_publiee", { etatEnvoi: "a-verifier", statut: "publiee" });
});

describe("RAP-3 finitions · introuvables", () => {
  it("introuvables (affichées) et retirables (bouton) comptés séparément", async () => {
    const e = await lireEcartCalendrier();
    expect((e as { introuvables?: number } | null)?.introuvables).toBe(5); // affichées
    expect((e as { retirables?: string[] } | null)?.retirables?.sort()).toEqual(["zr_a", "zr_b"]); // retirables : 2 constats et 24 h
  });
  it("retrait groupé : pose retireeLe sur ces seules rapatriées, n'efface rien, aucun appel au diffuseur, session exigée", async () => {
    const avant = (await depots().publications.lister(() => true)).length;
    const r = await retirerIntrouvablesAction(["zr_a", "zr_b"]);
    expect(r.ok).toBe(true);
    expect(exiger).toHaveBeenCalled();
    expect(appels).toEqual([]);
    const toutes = await depots().publications.lister(() => true);
    expect(toutes).toHaveLength(avant);
    const retirees = toutes.filter((p) => p.retireeLe).map((p) => p.id).sort();
    expect(retirees).toEqual(["zr_a", "zr_b", "zr_deja"]);
    expect(toutes.find((p) => p.id === "zr_a")).toMatchObject({ statut: "programmee", texte: "Texte fictif", etatEnvoi: "a-verifier" });
    expect(toutes.find((p) => p.id === "zr_deja")?.retireeLe).toBe("2026-11-20T11:00:00.000Z"); // inchangée
    expect(((await lireEcartCalendrier()) as { introuvables?: number } | null)?.retirables?.length ?? 0).toBe(0);
  });
  it("sans session : refus, rien n'est écrit", async () => {
    exiger.mockRejectedValueOnce(new Error("NON_CONNECTE"));
    await expect(retirerIntrouvablesAction(["zr_a", "zr_b"])).rejects.toThrow();
    expect((await depots().publications.lister((p) => !!p.retireeLe)).map((p) => p.id)).toEqual(["zr_deja"]);
  });
  it("rien à retirer : refus clair, rien d'écrit", async () => {
    await retirerIntrouvablesAction(["zr_a", "zr_b"]);
    const r = await retirerIntrouvablesAction(["zr_a", "zr_b"]);
    expect(r.ok).toBe(false);
  });
  it("le nombre confirmé est le nombre retiré : ensemble changé (en plus, en moins, ou id étranger) → refus, rien d'écrit", async () => {
    for (const ids of [["zr_a"], ["zr_a", "zr_b", "zr_un_constat"], ["zr_a", "zr_b", "pub_studio"], ["zr_a", "zr_a"], []]) {
      const r = await retirerIntrouvablesAction(ids);
      expect(r).toMatchObject({ ok: false, message: "La liste a changé : rechargez la page." });
    }
    expect((await depots().publications.lister((p) => !!p.retireeLe)).map((p) => p.id)).toEqual(["zr_deja"]);
  });
  it("revérifié au clic : une rapatriée redevenue normale entre-temps → refus de l'ensemble", async () => {
    await depots().publications.modifier("zr_b", { etatEnvoi: undefined, introuvableDepuis: undefined, constatsIntrouvable: undefined });
    expect((await retirerIntrouvablesAction(["zr_a", "zr_b"])).ok).toBe(false);
    expect((await depots().publications.lister((p) => !!p.retireeLe)).map((p) => p.id)).toEqual(["zr_deja"]);
  });
  it("le serveur refuse si la mesure n'est pas vérifiée / trop ancienne / absente, même avec les bons identifiants", async () => {
    const ecrire = (valeur: object) => depots().parametres.enregistrer({ id: "zernio.ecart_calendrier", valeur, creeLe: NOW_ISO, modifieLe: NOW_ISO } as never);
    await ecrire({ luLe: NOW_ISO, verifie: false, chezDiffuseur: 5, absents: 0, exemples: [] });
    expect((await retirerIntrouvablesAction(["zr_a", "zr_b"])).ok).toBe(false);
    await ecrire({ luLe: new Date(Date.now() - 2 * 3600_000).toISOString(), verifie: true, chezDiffuseur: 5, absents: 0, exemples: [] });
    expect((await retirerIntrouvablesAction(["zr_a", "zr_b"])).ok).toBe(false);
    await depots().parametres.supprimer("zernio.ecart_calendrier");
    expect((await retirerIntrouvablesAction(["zr_a", "zr_b"])).ok).toBe(false);
    expect((await depots().publications.lister((p) => !!p.retireeLe)).map((p) => p.id)).toEqual(["zr_deja"]);
  });
  it("aucune mesure : « jamais mesurée », non vérifiée, avec les introuvables comptés mais aucun retirable utilisable", async () => {
    await depots().parametres.supprimer("zernio.ecart_calendrier");
    const e = (await lireEcartCalendrier()) as { jamaisMesuree?: boolean; verifie: boolean; luLe: string; introuvables?: number } | null;
    expect(e).toMatchObject({ jamaisMesuree: true, verifie: false, introuvables: 5 });
    expect(e?.luLe).toBe("");
  });
});
