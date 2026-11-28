/** Encart vidéo, PR 2 : routes et réponses du fournisseur alignées sur celles du site (réponses rédigées comme le site les rend). */
import { describe, expect, it } from "vitest";
import { CHEMIN_REGLAGES, CHEMIN_RETRAIT, CHEMIN_VIDEOS, erreurDepuisReponse, fournisseurSiteDepuisTransport } from "@/fournisseurs/site/fournisseur";
import { ErreurSite, type ReponseSite, type RequeteSignee } from "@/fournisseurs/site/types";
import { corpsExemple } from "./helpers-contrat";

function fournisseurAvec(reponse: (r: RequeteSignee) => ReponseSite) {
  const vues: RequeteSignee[] = [];
  const f = fournisseurSiteDepuisTransport({
    id: "essai", nom: "Essai", reelPrevu: "Site", mode: "simulation", secret: "s", maintenant: () => 1_760_000_000_000,
    transport: async (r) => { vues.push(r); return reponse(r); },
  });
  return { f, vues };
}

describe("encart PR 2 : routes", () => {
  it("les réglages se lisent sur la route du site", async () => {
    expect(CHEMIN_REGLAGES).toBe("/api/interne/reglages-publics");
    const { f, vues } = fournisseurAvec(() => ({ statut: 200, corps: { schemaVersion: 1, luLe: "2026-11-27T10:00:00.000Z", avisPublies: true, videosSiteActives: true } }));
    await f.lireReglages();
    expect(vues[0]).toMatchObject({ methode: "GET", chemin: "/api/interne/reglages-publics" });
  });

  it("les réglages lus : `avisPublies` est repris tel que le site le rend", async () => {
    const { f } = fournisseurAvec(() => ({ statut: 200, corps: { schemaVersion: 1, avisPublies: true } }));
    expect((await f.lireReglages()).avisPublies).toBe(true);
  });

  it("le retrait est un DELETE sur la route des vidéos, avec un corps {schemaVersion, studioVideoId, motif}", async () => {
    expect(CHEMIN_RETRAIT).toBe(CHEMIN_VIDEOS);
    const { f, vues } = fournisseurAvec(() => ({ statut: 200, corps: { ok: true, statut: "retiree", slug: "a", rejeu: false } }));
    expect(await f.retirer("vid_exemple_1")).toEqual({ statut: "retiree" });
    expect(vues[0]).toMatchObject({ methode: "DELETE", chemin: "/api/interne/videos" });
    expect(JSON.parse(vues[0].corps)).toEqual({ schemaVersion: 1, studioVideoId: "vid_exemple_1", motif: "obsolete" });
  });

  it("le motif de retrait se choisit parmi ceux du site", async () => {
    const { f, vues } = fournisseurAvec(() => ({ statut: 200, corps: { ok: true, statut: "retiree" } }));
    await f.retirer("vid_exemple_1", "autre");
    expect(JSON.parse(vues[0].corps).motif).toBe("autre");
  });
});

describe("encart PR 2 : réponses", () => {
  it("un 404 « video_inconnue » est un retrait déjà fait", async () => {
    const { f } = fournisseurAvec(() => ({ statut: 404, corps: { ok: false, erreur: "video_inconnue" } }));
    expect(await f.retirer("vid_exemple_1")).toEqual({ statut: "inconnue" });
  });

  it("un 404 de route (corps absent ou autre) n'est PAS un succès : le retrait échoue à voix haute", async () => {
    for (const corps of [null, { erreur: "introuvable" }, "<html>"]) {
      const { f } = fournisseurAvec(() => ({ statut: 404, corps }));
      await expect(f.retirer("vid_exemple_1")).rejects.toMatchObject({ code: "route-absente" });
    }
  });

  it("un 200 de retrait sans le bon corps n'est pas un succès (page de proxy, corps vide)", async () => {
    for (const corps of [null, {}, { ok: true }, { ok: false, statut: "retiree" }, "<html>"]) {
      const { f } = fournisseurAvec(() => ({ statut: 200, corps }));
      await expect(f.retirer("vid_exemple_1")).rejects.toMatchObject({ code: "serveur" });
    }
  });

  it("la première publication (201, version, rejeu) est lue comme une publication", async () => {
    const { f } = fournisseurAvec(() => ({ statut: 201, corps: { ok: true, statut: "publiee", slug: "a-b", url: "https://x.invalid/fr/videos/a-b", version: 1, rejeu: false } }));
    expect(await f.publier(corpsExemple())).toEqual({ statut: "publiee", slug: "a-b", url: "https://x.invalid/fr/videos/a-b", versionPasseport: 1, inchange: false });
  });

  it("un rejeu (200, rejeu: true) est « inchangé »", async () => {
    const { f } = fournisseurAvec(() => ({ statut: 200, corps: { ok: true, statut: "publiee", slug: "a-b", url: "https://x.invalid/fr/videos/a-b", version: 2, rejeu: true } }));
    expect((await f.publier(corpsExemple())).inchange).toBe(true);
  });

  it("une réponse qui n'a pas la forme attendue reste « illisible »", async () => {
    const { f } = fournisseurAvec(() => ({ statut: 201, corps: { ok: true, statut: "publiee" } }));
    await expect(f.publier(corpsExemple())).rejects.toMatchObject({ code: "serveur" });
  });

  it("un 422 affiche les champs en faute (`champs`, comme le site)", () => {
    const e = erreurDepuisReponse({ statut: 422, corps: { ok: false, erreur: "schema_invalide", champs: ["titre", "description"] } });
    expect(e.code).toBe("invalide");
    expect(e.erreurs).toEqual(["titre", "description"]);
    expect(e.message).toContain("titre");
  });

  it("les 409 se distinguent : retirée (définitif), identifiant de page déjà pris, version périmée", () => {
    const code = (erreur: string) => erreurDepuisReponse({ statut: 409, corps: { ok: false, erreur } });
    expect(code("video_retiree")).toMatchObject({ code: "retiree", statut: 409 });
    expect(code("video_retiree").message).toMatch(/définitif/);
    expect(code("slug_deja_pris")).toMatchObject({ code: "conflit" });
    expect(code("slug_deja_pris").message).toMatch(/adresse/);
    expect(code("slug_immuable").message).toMatch(/adresse/);
    expect(code("version_perimee").message).toMatch(/plus récente/);
    expect(code("version_deja_publiee").message).toMatch(/même version/);
    expect(code("nonce_reutilise").message).toMatch(/réessayez/);
    expect(erreurDepuisReponse({ statut: 409, corps: null }).code).toBe("conflit");
  });

  it("503 « reception_eteinte » : message clair, code « eteinte », pas de nouvel essai inutile", () => {
    const e = erreurDepuisReponse({ statut: 503, corps: { ok: false, erreur: "reception_eteinte" } });
    expect(e.code).toBe("eteinte");
    expect(e.message).toMatch(/réception/i);
    expect(e).toBeInstanceOf(ErreurSite);
  });
});

describe("encart PR 2 : simulation et nouveaux essais", () => {
  it("le fournisseur de simulation du registre transmet le motif", async () => {
    const { fournisseurSiteSimulation, creerSiteFactice, injecterSiteFactice } = await import("@/fournisseurs/site/simulation");
    const site = creerSiteFactice({ secret: "s" });
    const recus: unknown[] = [];
    const traiter = site.traiter.bind(site);
    site.traiter = async (r) => { if (r.methode === "DELETE") recus.push(JSON.parse(r.corps)); return traiter(r); };
    injecterSiteFactice(site);
    try {
      await fournisseurSiteSimulation.retirer("vid_exemple_1", "autre");
    } finally {
      injecterSiteFactice(null);
    }
    expect(recus).toEqual([{ schemaVersion: 1, studioVideoId: "vid_exemple_1", motif: "autre" }]);
  });
});
