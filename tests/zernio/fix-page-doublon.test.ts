/**
 * FIX-DOUBLON · deux comptes Facebook de Zernio exposent les MÊMES pages (Zernio simulé, clé fictive, aucun réseau).
 * Compte A : page par défaut « Page A ». Compte B : page par défaut « Page B ». Les deux listent Page A, Page B et Page C.
 * « Page C » est déclarée interdite ici par injection (le vrai nom n'est pas dans le dépôt : seulement son empreinte).
 */
import { describe, expect, it, vi } from "vitest";
import { creerPublicationZernio } from "@/fournisseurs/publication/zernio";
import { empreinteNomPage, PAGES_FACEBOOK_INTERDITES, pageInterdite } from "@/fournisseurs/publication/zernio-pages-interdites";
import { ciblesZernioPour, traduireSelectionVersZernio } from "@/services/zernio-cibles";
import { cleEnvoiPublication } from "@/domaine/outil-publication";
import type { CanalPublication } from "@/fournisseurs/types";
import { creerFauxClientZernio, CLE_FICTIVE, postExemple, type AppelEnregistre, type ReponsePreparee } from "./aides/faux-zernio";

const A = "exemple-compte-a";
const B = "exemple-compte-b";
const PA = "1000000000000001";
const PB = "2000000000000002";
const PC = "3000000000000003";
const INTERDITES = { ids: [] as string[], empreintesNom: [empreinteNomPage("Page C")] };
const PAGES = [{ id: PB, name: "Page B" }, { id: PC, name: "Page C" }, { id: PA, name: "Page A" }];
const CLE = cleEnvoiPublication("video-exemple", "facebook", "2026-11-05T10:00:00Z", "exemple");
const flux = () => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([1])); c.close(); } });

function monter(comptes: Record<string, string | null> = { [A]: PA, [B]: PB }, pagesDe: (id: string) => typeof PAGES = () => PAGES) {
  const serveur = (a: AppelEnregistre): ReponsePreparee => {
    if (a.url.endsWith("/v1/accounts")) return { statut: 200, corps: { accounts: Object.keys(comptes).map((id) => ({ _id: id, platform: "facebook", displayName: id === A ? "Compte A" : "Compte B" })) } };
    const m = /accounts\/([^/]+)\/facebook-page$/.exec(a.url);
    if (m) return { statut: 200, corps: { pages: pagesDe(m[1]), selectedPageId: comptes[m[1]] } };
    if (a.url.endsWith("/v1/media/presign")) return { statut: 200, corps: { uploadUrl: "https://exemple-stockage.test/depot/x", publicUrl: "https://exemple-cdn.test/m/x.mp4" } };
    if (a.url.startsWith("https://exemple-stockage.test")) return { statut: 200, corps: {} };
    if (a.methode === "POST" && a.url.endsWith("/v1/posts")) return { statut: 201, corps: { post: postExemple({ _id: "exemple-post-9" }) } };
    return { statut: 404, corps: {} };
  };
  const t = creerFauxClientZernio(serveur);
  const f = creerPublicationZernio(CLE_FICTIVE, { clientPret: t.client, lire: async () => ({ corps: flux(), taille: 1 }), maintenant: t.horloge.maintenant, pagesInterdites: INTERDITES });
  return { ...t, f };
}
const canalBuffer = (id: string, nom: string): CanalPublication => ({ id, organisationId: "org-buffer", nom, service: "facebook", deconnecte: false });

describe("FIX-DOUBLON · un seul canal par page", () => {
  it("les 3 mêmes pages sur 2 comptes : Page A → compte A, Page B → compte B, Page C jamais listée", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch interdit")));
    const { f } = monter();
    const canaux = await f.listerCanaux!();
    expect(canaux.map((c) => c.id).sort()).toEqual([`${A}:fb:${PA}`, `${B}:fb:${PB}`].sort());
    expect(canaux.find((c) => c.nom === "Page B")!.id).toBe(`${B}:fb:${PB}`);
    expect(canaux.find((c) => c.nom === "Page A")!.id).toBe(`${A}:fb:${PA}`);
    expect(canaux.some((c) => c.nom === "Page C" || c.id.endsWith(PC))).toBe(false);
  });

  it("la présélection « Page B » se traduit en UN seul canal (plus de refus d'homonymes), sans choix au hasard", async () => {
    const { f } = monter();
    const traduit = await traduireSelectionVersZernio(f, "facebook", ["buf-b"], [canalBuffer("buf-b", "Page B")]);
    expect(traduit).toEqual([`${B}:fb:${PB}`]);
    const cibles = await ciblesZernioPour(f, "facebook", traduit);
    expect(cibles.ok && cibles.canaux.map((c) => c.id)).toEqual([`${B}:fb:${PB}`]);
    expect(await traduireSelectionVersZernio(f, "facebook", ["buf-a"], [canalBuffer("buf-a", "Page A")])).toEqual([`${A}:fb:${PA}`]);
  });

  it("aucun compte n'a la page par défaut : refus clair, jamais un tirage au sort", async () => {
    const { f } = monter({ [A]: null, [B]: null });
    const traduit = await traduireSelectionVersZernio(f, "facebook", ["buf-b"], [canalBuffer("buf-b", "Page B")]);
    const r = await ciblesZernioPour(f, "facebook", traduit);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).toContain("aucun d'eux ne l'a comme page par défaut");
  });

  it("deux VRAIS homonymes (identifiants de page différents) : refus avec le message nommé actuel", async () => {
    const { f } = monter({ [A]: PA, [B]: PB }, (id) => [{ id: id === A ? PA : PB, name: "Page H" }]);
    const traduit = await traduireSelectionVersZernio(f, "facebook", ["buf-h"], [canalBuffer("buf-h", "Page H")]);
    const r = await ciblesZernioPour(f, "facebook", traduit);
    expect(r.ok).toBe(false);
    const texte = JSON.stringify(r);
    expect(texte).toContain("Plusieurs comptes de l'outil de publication portent le nom");
    expect(texte).toContain(`…${PA.slice(-6)}`);
    expect(texte).toContain(`…${PB.slice(-6)}`);
  });

  it("Page C : jamais ciblée (liste, présélection, même seule), refus", async () => {
    const { f } = monter({ [A]: PA }, () => [{ id: PC, name: "Page C" }]);
    expect(await f.listerCanaux!()).toEqual([]);
    const traduit = await traduireSelectionVersZernio(f, "facebook", ["buf-c"], [canalBuffer("buf-c", "Page C")]);
    expect(traduit).toBeUndefined();
    const r = await ciblesZernioPour(f, "facebook", traduit);
    expect(r.ok).toBe(false);
    // Même un service qui la liste malgré tout : le garde du Studio la retire par son nom (liste du dépôt, par empreinte).
    expect(pageInterdite("x", "Page C", INTERDITES)).toBe(true);
    expect(PAGES_FACEBOOK_INTERDITES.empreintesNom.every((e) => /^[0-9a-f]{64}$/.test(e))).toBe(true);
    expect(pageInterdite("3000000000000003", "Page C")).toBe(false);
  });

  it("le corps d'envoi cible compte B + page B (platformSpecificData.pageId), en brouillon", async () => {
    const { f, faux } = monter();
    const r = await f.envoyer({ reseau: "facebook", texte: "Texte d'exemple", date: "2026-11-05T10:00:00Z", fichierCle: "https://exemple-r2.test/v.mp4", cible: `${B}:fb:${PB}`, cleEnvoi: CLE });
    expect(r.statut).toBe("brouillon");
    const p = faux.appels.find((a) => a.methode === "POST" && a.url.endsWith("/v1/posts"))!;
    expect(p.json).toMatchObject({ isDraft: true, platforms: [{ platform: "facebook", accountId: B, platformSpecificData: { pageId: PB } }] });
    expect(p.corps).not.toMatch(/publishNow/);
  });
});
