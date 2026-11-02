/**
 * FIX-ID · la page Facebook interdite est refusée par son IDENTIFIANT même sans nom (Zernio simulé, clé fictive, fetch interdit).
 * Le nom de la vraie page n'est pas dans le dépôt : les variantes de nom sont testées par injection (« Page C »).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { creerPublicationZernio } from "@/fournisseurs/publication/zernio";
import { corpsPostZernio } from "@/fournisseurs/publication/zernio-corps";
import { empreinteNomPage, PAGES_FACEBOOK_INTERDITES, pageInterdite } from "@/fournisseurs/publication/zernio-pages-interdites";
import { ciblesZernioPour } from "@/services/zernio-cibles";
import { creerFauxClientZernio, CLE_FICTIVE, type AppelEnregistre, type ReponsePreparee } from "./aides/faux-zernio";

const ID_INTERDIT = "824208820772513";
const PA = "1315871264933190";
const PB = "917452654790827";
const A = "exemple-compte-a";
const B = "exemple-compte-b";
const flux = () => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([1])); c.close(); } });

function monter(pages: { id: string; name?: string }[], options: { pagesInterdites?: typeof PAGES_FACEBOOK_INTERDITES } = {}) {
  const serveur = (a: AppelEnregistre): ReponsePreparee => {
    if (a.url.endsWith("/v1/accounts")) return { statut: 200, corps: { accounts: [A, B].map((id) => ({ _id: id, platform: "facebook", displayName: id })) } };
    if (/accounts\/([^/]+)\/facebook-page$/.test(a.url)) return { statut: 200, corps: { pages, selectedPageId: null } };
    return { statut: 404, corps: {} };
  };
  const t = creerFauxClientZernio(serveur);
  return creerPublicationZernio(CLE_FICTIVE, { clientPret: t.client, lire: async () => ({ corps: flux(), taille: 1 }), maintenant: t.horloge.maintenant, ...options });
}

afterEach(() => vi.unstubAllGlobals());

describe("FIX-ID · page interdite par identifiant", () => {
  it("la liste réelle contient l'identifiant", () => {
    expect(PAGES_FACEBOOK_INTERDITES.ids).toContain(ID_INTERDIT);
    expect(pageInterdite(ID_INTERDIT, undefined)).toBe(true);
    expect(pageInterdite(PA, "Page A")).toBe(false);
    expect(pageInterdite(PB, undefined)).toBe(false);
  });

  it("listerCanaux : page sans nom mais avec l'identifiant interdit → absente ; Page A et Page B restent", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch interdit")));
    const f = monter([{ id: ID_INTERDIT }, { id: PA, name: "Page A" }, { id: PB, name: "Page B" }]);
    const canaux = await f.listerCanaux!();
    expect(canaux.some((c) => c.id.endsWith(ID_INTERDIT))).toBe(false);
    expect(canaux.some((c) => c.id.endsWith(PA))).toBe(true);
    expect(canaux.some((c) => c.id.endsWith(PB))).toBe(true);
  });

  it("ciblesZernioPour : la page interdite n'est jamais cible, même demandée, même seule restante", async () => {
    const f = monter([{ id: ID_INTERDIT }]);
    expect((await f.listerCanaux!()).length).toBe(0);
    const r = await ciblesZernioPour(f, "facebook", [`${A}:fb:${ID_INTERDIT}`]);
    expect(r.ok).toBe(false);
    expect((await ciblesZernioPour(f, "facebook")).ok).toBe(false);
  });

  it("variantes de nom (accents, casse, espaces) → refusées par l'empreinte", async () => {
    const liste = { ids: [] as string[], empreintesNom: [empreinteNomPage("Pagé C")] };
    for (const nom of ["Pagé C", "PAGE C", "  page   c ", "pagé  c"]) expect(pageInterdite("999", nom, liste)).toBe(true);
    const f = monter([{ id: "3000000000000003", name: "  PAGÉ   c " }, { id: PA, name: "Page A" }], { pagesInterdites: liste });
    const canaux = await f.listerCanaux!();
    expect(new Set(canaux.map((c) => c.id.split(":fb:")[1]))).toEqual(new Set([PA]));
  });

  it("corps d'envoi : l'identifiant interdit est refusé, Page A et Page B passent le contrôle", () => {
    const corps = (pageId: string) => corpsPostZernio({ reseau: "facebook", texte: "Texte d'exemple", date: "2026-11-05T10:00:00Z", fichierCle: "https://exemple.test/v.mp4", cible: `${A}:fb:${pageId}`, cleEnvoi: "b".repeat(64) }, { maintenant: Date.parse("2026-11-01T08:00:00Z") });
    expect(() => corps(ID_INTERDIT)).toThrow(/jamais être une destination/);
    for (const ok of [PA, PB]) expect(corps(ok).platforms[0].platformSpecificData).toMatchObject({ pageId: ok });
  });
});
