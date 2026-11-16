/**
 * FB-REEL-b · envoi Facebook (Reel) avec Zernio SIMULÉ (même banc que tests/zernio/e2e-04-service.test.ts).
 * Aucune vraie clé, aucun appel réseau, compte fictif.
 * Fournisseur « simulation » : le routage Zernio passe par le choix de l'outil, pas par cette variable.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import { preparerMotDePasse } from "../helpers/g1a";
import { CLE_FICTIVE, postExemple, type AppelEnregistre, type ReponsePreparee } from "../zernio/aides/faux-zernio";
import { serveurSimule } from "../zernio/aides/serveur-simule";

process.env.ZERNIO_API_KEY = CLE_FICTIVE;
process.env.FOURNISSEUR_PUBLICATION = "simulation";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");
const { envoyerParOutilAction } = await import("@/services/a-publier-zernio");
const { injecterClientZernio, PARAM_ENVOI_CALENDRIER } = await import("@/services/zernio");
const { ecrireParametre } = await import("@/services/_commun");
const { REGLAGE_EDITORIALE_ACTIVE } = await import("@/services/promotion-envois");

const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const COMPTES = {
  accounts: [
    { _id: "exemple-compte-yt", platform: "youtube", displayName: "Exemple YT" },
    { _id: "exemple-compte-1", platform: "instagram", displayName: "Exemple IG" },
    { _id: "exemple-compte-li", platform: "linkedin", displayName: "Exemple LI" },
    { _id: "exemple-compte-tt", platform: "tiktok", displayName: "Exemple TT" },
    { _id: "exemple-compte-fb", platform: "facebook", displayName: "Exemple FB" },
  ],
};
let appelsZernio: AppelEnregistre[];
let serveur: ReturnType<typeof serveurSimule>;

function brancherReseauSimule(surmesure?: (a: AppelEnregistre) => ReponsePreparee | undefined) {
  serveur = serveurSimule({
    surmesure: (a) => {
      if (surmesure) {
        const s = surmesure(a);
        if (s) return s;
      }
      if (a.methode === "GET" && a.url.endsWith("/v1/accounts")) return { statut: 200, corps: COMPTES };
      if (a.methode === "GET" && /\/v1\/accounts\/exemple-compte-fb\/facebook-page/.test(a.url)) return { statut: 200, corps: { pages: [{ id: "exemple-page-1", name: "Page exemple" }], selectedPageId: "exemple-page-1" } };
      if (a.methode === "GET" && /\/v1\/accounts\/exemple-compte-li\/linkedin-organizations/.test(a.url)) return { statut: 200, corps: { organizations: [{ id: "12345", name: "Organisation exemple" }] } };
      return undefined;
    },
  });
  appelsZernio = [];
  vi.stubGlobal("fetch", async (url: unknown, init: RequestInit = {}) => {
    const u = String(url);
    if (u.startsWith("https://zernio.com/") || u.startsWith("https://exemple-stockage.test")) {
      const corps = typeof init.body === "string" ? init.body : undefined;
      const a: AppelEnregistre = { url: u, methode: String(init.method ?? "GET"), entetes: { ...(init.headers as Record<string, string>) }, corps, json: corps ? JSON.parse(corps) : undefined };
      appelsZernio.push(a);
      const r = serveur.repondre(a);
      if ("erreur" in r) throw Object.assign(new Error(r.message ?? "fetch failed"), { name: r.erreur === "delai" ? "TimeoutError" : "TypeError" });
      return new Response(r.corps === undefined ? null : JSON.stringify(r.corps), { status: r.statut, headers: { "content-type": "application/json", ...(r.entetes ?? {}) } });
    }
    return new Response(new Uint8Array([1]), { headers: { "content-length": "1" } });
  });
}
const posts = () => appelsZernio.filter((a) => a.methode === "POST" && a.url.endsWith("/v1/posts"));
const lignesZernio = () => depots().publications.lister((p) => p.via === "zernio");
const toutesLesPublications = () => depots().publications.lister((p) => p.videoId === VIDEO);

beforeAll(async () => {
  await preparerMotDePasse("essai-fb-reel-b");
});

let decalageMs = 0;
beforeEach(async () => {
  decalageMs += 10 * 60_000;
  vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + decalageMs });
  vi.unstubAllGlobals();
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  await ecrireParametre(PARAM_ENVOI_CALENDRIER, true);
  await ecrireParametre(REGLAGE_EDITORIALE_ACTIVE, true);
  reinitialiserRequete();
  injecterClientZernio(null);
  process.env.ZERNIO_API_KEY = CLE_FICTIVE;
  await auth.seConnecter("essai-fb-reel-b", false);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  brancherReseauSimule();
  await (await import("@/fournisseurs")).fournisseurParId("publication", "zernio").publicationsRecentes?.({ organisationId: "exemple-organisation", canalId: "exemple-compte-yt", depuis: "2000-01-01T00:00:00Z" });
  appelsZernio.length = 0;
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, c, true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const COMPTE_FB = "exemple-compte-fb:fb:exemple-page-1";
const envoyerFacebook = () => envoyerParOutilAction(VIDEO, "facebook", DEMAIN, { outil: "zernio", comptes: [COMPTE_FB] } as never);
async function fixerSorties(ratio: string, dureeSec: number) {
  for (const s of await depots().sorties.lister((x) => x.videoId === VIDEO)) await depots().sorties.modifier(s.id, { ratio: ratio as never, dureeSec });
}
const corpsFacebook = () => (posts()[0].json as { platforms: { platform: string; platformSpecificData: Record<string, unknown> }[] }).platforms[0];

describe("FB-REEL-b · Facebook reçoit la vidéo comme Reel", () => {
  it.each([3, 30, 60])("9:16 de %s s : format et durée réels transmis, corps Zernio en contentType « reel »", async (dureeSec) => {
    await fixerSorties("9:16", dureeSec);
    const { fournisseurParId } = await import("@/fournisseurs");
    const envoyer = vi.spyOn(fournisseurParId("publication", "zernio"), "envoyer");
    const r = await envoyerFacebook();
    expect(r.ok).toBe(true);
    expect(envoyer.mock.calls[0][0]).toMatchObject({ reseau: "facebook", format: "9:16", dureeSec });
    expect(posts()).toHaveLength(1);
    expect(corpsFacebook()).toMatchObject({ platform: "facebook", platformSpecificData: { contentType: "reel" } });
  });

  it.each([
    ["4:5", 30],
    ["9:16", 2.9],
    ["9:16", 60.1],
  ])("%s de %s s : l'avertissement du kit est dans le réseau Facebook, l'envoi n'est pas bloqué et ne part pas en Reel", async (ratio, dureeSec) => {
    await fixerSorties(ratio, dureeSec);
    const kit = await pub.obtenirKit(VIDEO);
    const fb = kit!.reseaux.find((x) => x.reseau === "facebook")!;
    expect(fb.avertissements.some((a) => /Reel Facebook/.test(a.message))).toBe(true);
    for (const autre of kit!.reseaux.filter((x) => x.reseau !== "facebook")) expect(autre.avertissements.some((a) => /Reel Facebook/.test(a.message))).toBe(false);
    expect(fb.avertissements.some((a) => a.code === "trop-longue" || a.code === "ratio-absent")).toBe(false);
    const reel = fb.avertissements.find((a) => /Reel Facebook/.test(a.message))!;
    expect(reel.code).toBe(pub.CODE_AVERTISSEMENT_REEL_FACEBOOK);
    expect(reel.code).not.toBe("legende-trop-longue");
    const r = await envoyerFacebook();
    expect(r.ok).toBe(true);
    expect(posts()).toHaveLength(1);
    expect(corpsFacebook().platformSpecificData.contentType).toBeUndefined();
  });

  it("dans les limites : aucun avertissement Reel", async () => {
    await fixerSorties("9:16", 30);
    const fb = (await pub.obtenirKit(VIDEO))!.reseaux.find((x) => x.reseau === "facebook")!;
    expect(fb.avertissements.some((a) => /Reel Facebook/.test(a.message))).toBe(false);
  });
});

describe("FB-REEL-b · correction relecture 582", () => {
  it("le banc n'évoque plus l'ancien fournisseur", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(new URL(import.meta.url), "utf8").toLowerCase().includes("buf" + "fer")).toBe(false);
  });
});
