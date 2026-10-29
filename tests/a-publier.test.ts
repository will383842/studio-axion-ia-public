/**
 * Page « À publier » (vidéos) : liste des vidéos validées, lignes par réseau, interrupteur éteint par défaut, menu.
 * Aucun réseau : la publication reste en simulation.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { exemplesCommeVraies } from "./helpers/videos-reelles";
import { preparerMotDePasse } from "./helpers/g1a";

const CLE = "cle-buffer-de-test-QUI-NE-DOIT-JAMAIS-SORTIR-9f8e";
delete process.env.BUFFER_API_KEY;
process.env.FOURNISSEUR_PUBLICATION = "simulation";
// Stockage R2 configuré (signature locale, aucun appel) : l'adresse donnée à Buffer est une adresse signée.
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
// « Image → vidéo » : la livraison du réseau, pilotée par chaque test (aucun fichier image-video n'est lu).
const iv = vi.hoisted(() => ({ travail: null as unknown }));
vi.mock("@/services/image-video-carte", () => ({ travailImageVideo: async () => iv.travail }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");

const MDP = "essai-a-publier";
const VIDEO = "v-15";

const apub = await import("@/services/a-publier");
const pc = await import("@/services/premier-commentaire");
const { ID_MOTEUR_CAS_CONCRET } = await import("@/moteurs/montage-cas-concret");
const service = (await import("@/fournisseurs")).resoudreFournisseur("publication", null);
const nav = await import("@/components/coquille/navigation");

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  vi.unstubAllGlobals();
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  iv.travail = null;
  vi.restoreAllMocks();
});

const JOUR = 86_400_000;
async function publication(date: string, champs: Record<string, unknown> = {}) {
  return depots().publications.enregistrer({ id: `pub-${Math.random().toString(36).slice(2)}`, videoId: VIDEO, reseau: "instagram", statut: "brouillon", via: "buffer", etatEnvoi: "envoye", date, texte: "t", creeLe: new Date().toISOString(), modifieLe: new Date().toISOString(), ...champs } as never);
}
const ligneInstagram = async () => (await apub.vueAPublier()).lignes.find((l) => l.cle === `${VIDEO}:instagram`);

describe("À publier", () => {
  it("listerAPublier : seulement les vidéos validées, avec leur famille ; listerAProgrammer garde sa forme", async () => {
    await depots().videos.modifier(VIDEO, { etapeEditoriale: "a_relire" });
    expect((await pub.listerAPublier()).some((v) => v.id === VIDEO)).toBe(false);
    await depots().videos.modifier(VIDEO, { etapeEditoriale: "validee" });
    const liste = await pub.listerAPublier();
    expect(liste.find((v) => v.id === VIDEO)).toMatchObject({ id: VIDEO, famille: "video" });
    const ancien = (await pub.listerAProgrammer()).find((v) => v.id === VIDEO)!;
    expect(ancien).toBeTruthy();
    expect("famille" in ancien).toBe(false);
  });

  it("la page est éteinte par défaut, et ne s'allume que par le réglage", async () => {
    expect(await apub.pageAPublierAllumee()).toBe(false);
    await expect(apub.definirPageAPublier("oui")).rejects.toMatchObject({ code: "CHOIX_INCONNU" });
    await apub.definirPageAPublier(true);
    expect(await apub.pageAPublierAllumee()).toBe(true);
    await apub.definirPageAPublier(false);
    expect(await apub.pageAPublierAllumee()).toBe(false);
  });

  it("vueAPublier : une ligne par vidéo validée et par réseau voulu, en simulation (aucun envoi)", async () => {
    await depots().videos.modifier(VIDEO, { etapeEditoriale: "validee" });
    const vue = await apub.vueAPublier();
    expect(vue.envoiSimule).toBe(true);
    const lignes = vue.lignes.filter((l) => l.videoId === VIDEO);
    expect(lignes.length).toBeGreaterThan(0);
    expect(new Set(lignes.map((l) => l.reseau)).size).toBe(lignes.length);
    for (const l of lignes) expect(l).toMatchObject({ famille: "video", cle: `${VIDEO}:${l.reseau}` });
    expect(lignes[0].casesRequises.length).toBeGreaterThanOrEqual(4);
    expect(await depots().publications.compter((p) => p.videoId === VIDEO)).toBe(0);
  });

  it("une vidéo en simulation ne part pas : envoyer reste un essai, jamais programmée", async () => {
    await depots().videos.modifier(VIDEO, { etapeEditoriale: "validee" });
    for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, c, true);
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram"], new Date(Date.now() + 86_400_000).toISOString(), { premiersCommentaires: { instagram: "Le lien" } });
    expect(r.simulation).toBe(true);
    expect(r.publications[0]).toMatchObject({ via: "simulation", statut: "brouillon" });
    const ligne = (await apub.vueAPublier()).lignes.find((l) => l.cle === `${VIDEO}:instagram`);
    expect(ligne?.etat).toMatchObject({ libelle: "Essai" });
  });

  it("menu : « À publier » à côté du calendrier seulement quand le réglage est allumé", () => {
    const sans = nav.navigationLaterale([]).map((e) => e.href);
    const avec = nav.navigationLaterale([], false, true).map((e) => e.href);
    expect(sans).not.toContain("/a-publier");
    expect(avec[avec.indexOf("/calendrier") + 1]).toBe("/a-publier");
    expect(nav.tuilesPlusMobile().map((t) => t.href)).not.toContain("/a-publier");
    expect(nav.tuilesPlusMobile(false, true).map((t) => t.href)).toContain("/a-publier");
  });

  it("une ligne déjà envoyée (brouillon ou programmée) est marquée envoyée : la page refuse un second envoi", async () => {
    await depots().videos.modifier(VIDEO, { etapeEditoriale: "validee" });
    expect((await ligneInstagram())?.etat).toBeUndefined();
    const brouillon = await publication(new Date(Date.now() + JOUR).toISOString(), { statut: "brouillon" });
    expect((await ligneInstagram())?.etat).toMatchObject({ envoye: true });
    await depots().publications.modifier(brouillon.id, { statut: "programmee" });
    expect((await ligneInstagram())?.etat).toMatchObject({ envoye: true });
    // Une publication plus récente refusée ne lève pas le blocage : l'ancienne occupe toujours Buffer.
    await publication(new Date(Date.now() + 2 * JOUR).toISOString(), { statut: "echec", etatEnvoi: "refuse", creeLe: new Date(Date.now() + 1000).toISOString() });
    expect((await ligneInstagram())?.etat).toMatchObject({ envoye: true });
  });

  it("une vidéo programmée ou publiée reste dans la page 14 jours, puis disparaît", async () => {
    for (const etape of ["programmee", "publiee"] as const) {
      await depots().videos.modifier(VIDEO, { etapeEditoriale: etape });
      for (const p of await depots().publications.lister((x) => x.videoId === VIDEO)) await depots().publications.supprimer(p.id);
      await publication(new Date(Date.now() - 13 * JOUR).toISOString(), { statut: etape === "publiee" ? "publiee" : "programmee" });
      expect((await apub.vueAPublier()).lignes.some((l) => l.videoId === VIDEO)).toBe(true);
      for (const p of await depots().publications.lister((x) => x.videoId === VIDEO)) await depots().publications.supprimer(p.id);
      await publication(new Date(Date.now() - 15 * JOUR).toISOString(), { statut: etape === "publiee" ? "publiee" : "programmee" });
      expect((await apub.vueAPublier()).lignes.some((l) => l.videoId === VIDEO)).toBe(false);
    }
  });

  it("provenance du premier commentaire : Cas concret, puis Image → vidéo, puis la version ; sinon rien", async () => {
    const version = (await depots().versions.obtenir("v-15-ver-1"))!;
    expect(await pc.premierCommentaireDeVideo(VIDEO, "instagram")).toBeUndefined();
    // La version du générateur (sources puis lien suivi).
    const variante = { reseau: "instagram" as const, champs: { sources: ["Source A"], lienSuivi: "https://exemple.invalid/s" } };
    expect(pc.deLaVersion(variante, "instagram")).toBe("Source A\nhttps://exemple.invalid/s");
    expect(pc.deLaVersion(variante, "linkedin")).toBeUndefined();
    expect(await pc.premierCommentaireDeVideo(VIDEO, "instagram", variante)).toBe("Source A\nhttps://exemple.invalid/s");
    // Image → vidéo passe avant la version.
    iv.travail = { parametres: { imageVideo: { version: "fabrication-iv/1", livraison: [{ reseau: "instagram", premierCommentaire: " Du film image " }] } } };
    expect(await pc.premierCommentaireDeVideo(VIDEO, "instagram", variante)).toBe("Du film image");
    expect(await pc.premierCommentaireDeVideo(VIDEO, "linkedin", variante)).toBeUndefined();
    // Cas concret passe avant tout, sauf pour une vidéo d'essai.
    const casConcret = (essai: boolean) => depots().versions.modifier(version.id, { commande: { ...version.commande, moteurId: ID_MOTEUR_CAS_CONCRET, entrees: { casConcret: { essai } } }, projetMontage: { casConcret: { publication: [{ reseau: "instagram", premierCommentaire: " Du cas concret " }] } } } as never);
    await casConcret(false);
    expect(await pc.premierCommentaireDeVideo(VIDEO, "instagram", variante)).toBe("Du cas concret");
    await casConcret(true);
    expect(await pc.premierCommentaireDeVideo(VIDEO, "instagram", variante)).toBe("Du film image");
  });

  it("chemin simulé : le premier commentaire est transmis à service.envoyer", async () => {
    await depots().videos.modifier(VIDEO, { etapeEditoriale: "validee" });
    for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, c, true);
    const envoyer = vi.spyOn(service, "envoyer");
    const date = new Date(Date.now() + JOUR).toISOString();
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], date, { premiersCommentaires: { instagram: "  Le lien  " } });
    expect(envoyer.mock.calls[0][0]).toMatchObject({ reseau: "instagram", premierCommentaire: "Le lien" });
    // Un commentaire vide : rien n'est transmis.
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], date, { premiersCommentaires: { instagram: "" } });
    expect(envoyer.mock.calls[1][0]).not.toHaveProperty("premierCommentaire");
  });
});
