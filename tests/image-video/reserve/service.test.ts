/**
 * RÉSERVE Image → vidéo · service : dépôts mémoire, dépôt de texte/script doublé, `fetch` jamais appelé. Un clic = une
 * fabrication ; aucun accord à valider à la main ; un orphelin retrouve son brouillon au lieu d'être relancé.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id, Travail, Video } from "@/domaine/types";
import type { EtatFabricationIV } from "@/moteurs/montage-image-video";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }), headers: async () => new Headers() }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));

const depotScript = vi.fn();
const depotTexte = vi.fn();
vi.mock("@/services/image-video-texte", () => ({ deposerScriptImageVideo: depotScript, deposerTexteImageVideo: depotTexte }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const { prixDuDepot } = await import("@/services/image-video-ecran");
const reserve = await import("@/services/image-video-reserve");
const { ID_FORMAT_IMAGE_VIDEO } = await import("@/formats/image-video");
const { marquerLancementIV } = await import("@/domaine/image-video/reserve");

const reseau = vi.spyOn(globalThis, "fetch");
const SCRIPT = "Chaque lundi, un robot fictif trie les messages reçus, prépare un résumé clair et l'envoie à toute l'équipe avant neuf heures.";
const IDEE = "Un assistant fictif qui range les factures du mois dans le bon dossier";
const horo = () => ({ creeLe: new Date().toISOString(), modifieLe: new Date().toISOString() });
const etat = (etape: string, plus: Record<string, unknown> = {}) => ({ version: "fabrication-iv/1", etape, demande: {}, caisse: { plafondCentimes: 1, reservations: [] }, tentatives: {}, journal: [], ...plus }) as unknown as EtatFabricationIV;

async function video(id: Id, texte: string, creeLe = new Date().toISOString(), statut = "brouillon") {
  await depots().videos.enregistrer({ id, titre: id, formatId: ID_FORMAT_IMAGE_VIDEO, statut, entrees: { imageVideo: { texte } }, creeLe, modifieLe: creeLe } as unknown as Video);
}
async function travail(videoId: Id, statut: Travail["statut"], e?: EtatFabricationIV) {
  await depots().travaux.enregistrer({ id: `t-${videoId}`, type: "video", cibleId: videoId, titre: videoId, etapes: [], statut, progression: 0, tentatives: 1, cleIdempotence: `t-${videoId}`, fournisseurUtilise: "x", ...(e ? { parametres: { imageVideo: e } } : {}), ...horo() } as unknown as Travail);
}
const el = async (id: string) => (await reserve.lireReserveIV()).elements.find((e) => e.id === id)!;
const ajouter = async (nature: "script" | "idee", texte: string) => {
  const r = await reserve.ajouterReserveIV({ nature, texte, reseaux: ["linkedin"] });
  if (r.statut !== "ajoute") throw new Error(r.phrase);
  return r.element.id;
};

beforeEach(() => {
  reinitialiserDepots();
  depotScript.mockReset();
  depotTexte.mockReset();
});
afterEach(() => expect(reseau).not.toHaveBeenCalled());

describe("réserve · lecture, ajout, retrait", () => {
  it("document unique sous imageVideo.reserve, vide par défaut", async () => {
    expect((await reserve.lireReserveIV()).elements).toEqual([]);
    await ajouter("idee", IDEE);
    expect((await depots().parametres.obtenir("imageVideo.reserve"))?.valeur).toMatchObject({ elements: [{ texte: IDEE, etat: "a-faire" }] });
  });

  it("refuse un texte vide ; retire seulement un à-faire, en le conservant", async () => {
    expect(await reserve.ajouterReserveIV({ nature: "idee", texte: "  " })).toMatchObject({ statut: "refuse" });
    expect(await reserve.ajouterReserveIV({ nature: "idee", texte: IDEE, reseaux: ["inconnu"] })).toEqual({ statut: "refuse", phrase: "Cochez au moins un réseau." });
    expect(await reserve.ajouterReserveIV({ nature: "idee", texte: IDEE, reseaux: [] })).toMatchObject({ statut: "refuse" });
    expect((await reserve.lireReserveIV()).elements).toEqual([]);
    const a = await ajouter("idee", IDEE);
    const b = await ajouter("idee", IDEE);
    await ecrireParametre("imageVideo.reserve", marquerLancementIV(await reserve.lireReserveIV(), b, new Date().toISOString()));
    expect(await reserve.retirerReserveIV(b)).toBe(false);
    expect(await reserve.retirerReserveIV(a)).toBe(true);
    const r = await reserve.lireReserveIV();
    expect(r.elements.map((e) => e.etat)).toEqual(["retire", "en-cours"]);
  });
});

describe("fabriquerSuivantReserveIV", () => {
  it("file vide : rien n'est déposé", async () => {
    expect(await reserve.fabriquerSuivantReserveIV()).toEqual({ statut: "vide" });
    expect(depotScript).not.toHaveBeenCalled();
  });

  it("un script est dit tel quel (accord = prix du dépôt), une idée passe par le texte ; la vidéo est liée", async () => {
    const s = await ajouter("script", SCRIPT);
    const i = await ajouter("idee", IDEE);
    depotScript.mockResolvedValueOnce({ statut: "lancee", videoId: "v-s" });
    depotTexte.mockResolvedValueOnce({ statut: "lancee", videoId: "v-i" });
    const prix = prixDuDepot(["linkedin"], 0.92);
    expect(await reserve.fabriquerSuivantReserveIV({ taux: async () => 0.92 })).toMatchObject({ statut: "lancee", id: s, videoId: "v-s" });
    expect(depotScript).toHaveBeenCalledWith({ script: SCRIPT, reserveId: s, reseaux: ["linkedin"], accordCentimes: prix }, undefined);
    expect(depotTexte).not.toHaveBeenCalled();
    expect(await el(s)).toMatchObject({ etat: "en-cours", videoId: "v-s" });
    expect(await reserve.fabriquerSuivantReserveIV({ taux: async () => 0.92 })).toMatchObject({ id: i, videoId: "v-i" });
    expect(depotTexte).toHaveBeenCalledWith({ texte: IDEE, reserveId: i, reseaux: ["linkedin"], accordCentimes: prix }, undefined);
  });

  it("accord-requis : un seul nouvel essai avec le montant renvoyé, sans validation manuelle", async () => {
    await ajouter("idee", IDEE);
    depotTexte.mockResolvedValueOnce({ statut: "accord-requis", centimes: 4321, phrase: "p" }).mockResolvedValueOnce({ statut: "lancee", videoId: "v1" });
    expect(await reserve.fabriquerSuivantReserveIV()).toMatchObject({ statut: "lancee", videoId: "v1" });
    expect(depotTexte).toHaveBeenCalledTimes(2);
    expect(depotTexte.mock.calls[1][0].accordCentimes).toBe(4321);
  });

  it("accord-requis deux fois : pas de troisième essai, retour à faire avec la phrase", async () => {
    const id = await ajouter("idee", IDEE);
    depotTexte.mockResolvedValue({ statut: "accord-requis", centimes: 5, phrase: "Cette vidéo coûte au plus 0,05 €." });
    expect(await reserve.fabriquerSuivantReserveIV()).toMatchObject({ statut: "refusee", phrase: "Cette vidéo coûte au plus 0,05 €." });
    expect(depotTexte).toHaveBeenCalledTimes(2);
    expect(await el(id)).toMatchObject({ etat: "a-faire", essais: 1, note: "Cette vidéo coûte au plus 0,05 €." });
  });

  it("refusée : retour à faire en fin de file, la phrase en note", async () => {
    const a = await ajouter("idee", IDEE);
    const b = await ajouter("idee", IDEE);
    depotTexte.mockResolvedValueOnce({ statut: "refusee", phrase: "Le format n'est pas ouvert." });
    expect(await reserve.fabriquerSuivantReserveIV()).toMatchObject({ statut: "refusee", id: a });
    expect(await el(a)).toMatchObject({ etat: "a-faire", rang: 3, essais: 1, note: "Le format n'est pas ouvert." });
    expect((await reserve.lireReserveIV()).elements.find((e) => e.etat === "a-faire" && e.rang === 2)?.id).toBe(b);
  });

  it("double clic simultané : un seul dépôt, l'autre clic est « occupé »", async () => {
    await ajouter("idee", IDEE);
    await ajouter("idee", IDEE);
    depotTexte.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return { statut: "lancee", videoId: "v" };
    });
    const issues = await Promise.all([reserve.fabriquerSuivantReserveIV(), reserve.fabriquerSuivantReserveIV()]);
    expect(depotTexte).toHaveBeenCalledTimes(1);
    expect(issues.map((i) => i.statut).sort()).toEqual(["lancee", "occupe"]);
    expect((await reserve.lireReserveIV()).elements.filter((e) => e.etat === "en-cours")).toHaveLength(1);
  });

  it("un seul dépôt par clic", async () => {
    await ajouter("idee", IDEE);
    await ajouter("idee", IDEE);
    depotTexte.mockResolvedValue({ statut: "lancee", videoId: "v" });
    await reserve.fabriquerSuivantReserveIV();
    expect(depotTexte).toHaveBeenCalledTimes(1);
  });
});

describe("orphelin : jamais de doublon", () => {
  const vieux = "2020-01-01T10:00:00.000Z";
  async function orphelin() {
    const id = await ajouter("idee", IDEE);
    await ecrireParametre("imageVideo.reserve", marquerLancementIV(await reserve.lireReserveIV(), id, vieux));
    return id;
  }

  it("un brouillon de même texte créé après lanceeLe est relié, rien n'est relancé", async () => {
    const id = await orphelin();
    await video("v-autre", "Autre texte", "2020-01-01T10:01:00.000Z");
    await video("v-avant", IDEE, "2019-12-31T10:00:00.000Z");
    await video("v-ok", IDEE, "2020-01-01T10:02:00.000Z");
    await travail("v-ok", "en_cours", etat("lecture"));
    expect(await reserve.fabriquerSuivantReserveIV()).toEqual({ statut: "lancee", id, videoId: "v-ok", reprise: true });
    expect(depotTexte).not.toHaveBeenCalled();
    expect(await el(id)).toMatchObject({ etat: "en-cours", videoId: "v-ok" });
  });

  it("un brouillon sans travail est archivé (conservé), puis l'orphelin est relancé", async () => {
    const id = await orphelin();
    await video("v-nu", IDEE, "2020-01-01T10:02:00.000Z");
    depotTexte.mockResolvedValueOnce({ statut: "lancee", videoId: "v-neuf" });
    expect(await reserve.fabriquerSuivantReserveIV()).toMatchObject({ statut: "lancee", id, videoId: "v-neuf" });
    expect(depotTexte).toHaveBeenCalledTimes(1);
    expect((await depots().videos.obtenir("v-nu"))?.statut).toBe("archivee");
  });

  it("le brouillon d'un autre élément (déjà lié) ou d'une autre nature n'est pas pris", async () => {
    const id = await orphelin();
    const autre = await ajouter("idee", IDEE);
    await video("v-lie", IDEE, "2020-01-01T10:02:00.000Z");
    await travail("v-lie", "en_cours", etat("lecture"));
    await ecrireParametre("imageVideo.reserve", (await import("@/domaine/image-video/reserve")).lierVideoIV(marquerLancementIV(await reserve.lireReserveIV(), autre, "2020-01-01T10:00:00.000Z"), autre, "v-lie"));
    await depots().videos.enregistrer({ id: "v-script", titre: "x", formatId: ID_FORMAT_IMAGE_VIDEO, statut: "brouillon", entrees: { imageVideo: { texte: IDEE, scriptColle: true } }, creeLe: "2020-01-01T10:03:00.000Z", modifieLe: "2020-01-01T10:03:00.000Z" } as unknown as Video);
    await travail("v-script", "en_cours", etat("lecture"));
    depotTexte.mockResolvedValueOnce({ statut: "lancee", videoId: "v-neuf" });
    expect(await reserve.fabriquerSuivantReserveIV()).toMatchObject({ id, videoId: "v-neuf" });
  });

  it("un brouillon portant la reserveId de l'orphelin est retrouvé", async () => {
    const id = await orphelin();
    await depots().videos.enregistrer({ id: "v-cle", titre: "x", formatId: ID_FORMAT_IMAGE_VIDEO, statut: "brouillon", entrees: { imageVideo: { texte: "texte normalisé autrement", reserveId: id } }, creeLe: "2020-01-01T10:03:00.000Z", modifieLe: "2020-01-01T10:03:00.000Z" } as unknown as Video);
    await travail("v-cle", "en_cours", etat("lecture"));
    expect(await reserve.fabriquerSuivantReserveIV()).toMatchObject({ id, videoId: "v-cle", reprise: true });
  });

  it("sans brouillon, l'orphelin est relancé (avant un nouvel élément)", async () => {
    const id = await orphelin();
    await ajouter("idee", IDEE);
    depotTexte.mockResolvedValueOnce({ statut: "lancee", videoId: "v-neuf" });
    expect(await reserve.fabriquerSuivantReserveIV()).toMatchObject({ id, videoId: "v-neuf" });
  });

  it("un lancement récent (moins de 15 minutes) n'est pas un orphelin", async () => {
    const id = await ajouter("idee", IDEE);
    await ecrireParametre("imageVideo.reserve", marquerLancementIV(await reserve.lireReserveIV(), id, new Date().toISOString()));
    expect(await reserve.fabriquerSuivantReserveIV()).toEqual({ statut: "occupe" });
    expect(depotTexte).not.toHaveBeenCalled();
  });
});

describe("vueReserveIV : recalcul depuis les travaux", () => {
  async function liee(texte = IDEE, videoId = "v1") {
    const id = await ajouter("idee", texte);
    await video(videoId, texte);
    await ecrireParametre("imageVideo.reserve", (await import("@/domaine/image-video/reserve")).lierVideoIV(marquerLancementIV(await reserve.lireReserveIV(), id, new Date().toISOString()), id, videoId));
    return id;
  }

  it("vidéo faite : fait ; relue deux fois : inchangé", async () => {
    const id = await liee();
    await travail("v1", "reussi", etat("prete"));
    await reserve.vueReserveIV();
    expect((await reserve.vueReserveIV()).elements.find((e) => e.id === id)).toMatchObject({ etat: "fait" });
  });

  it("mise de côté : reste en cours, à relire", async () => {
    const id = await liee();
    await travail("v1", "echec", etat("carte-a-valider", { miseDeCote: { porte: "carte", motif: "m", phrases: [] } }));
    await reserve.vueReserveIV();
    expect(await el(id)).toMatchObject({ etat: "en-cours", note: "à relire", videoId: "v1" });
  });

  it("arrêt, annulation : à faire en fin de file, un seul essai même relu", async () => {
    const id = await liee();
    await travail("v1", "echec", etat("refusee", { refus: { message: "Arrêtée." } }));
    await reserve.vueReserveIV();
    await reserve.vueReserveIV();
    expect(await el(id)).toMatchObject({ etat: "a-faire", essais: 1 });
    const id2 = await liee("Un autre texte fictif pour la file", "v2");
    await depots().travaux.enregistrer({ id: "t-v2", type: "video", cibleId: "v2", titre: "v2", etapes: [], statut: "annule", progression: 0, tentatives: 1, cleIdempotence: "t-v2", fournisseurUtilise: "x", ...horo() } as unknown as Travail);
    await reserve.vueReserveIV();
    expect(await el(id2)).toMatchObject({ etat: "a-faire", essais: 1 });
  });

  it("vidéo supprimée : à faire, un essai de plus", async () => {
    const id = await liee();
    await depots().videos.supprimer("v1");
    await reserve.vueReserveIV();
    expect(await el(id)).toMatchObject({ etat: "a-faire", essais: 1 });
  });

  it("vidéo archivée : à faire, un essai de plus", async () => {
    const id = await liee();
    await depots().videos.modifier("v1", { statut: "archivee" });
    await reserve.vueReserveIV();
    expect(await el(id)).toMatchObject({ etat: "a-faire", essais: 1 });
  });

  it("vidéo en fabrication : rien ne change", async () => {
    const id = await liee();
    await travail("v1", "en_cours", etat("lecture"));
    await reserve.vueReserveIV();
    expect(await el(id)).toMatchObject({ etat: "en-cours", videoId: "v1" });
  });
});
