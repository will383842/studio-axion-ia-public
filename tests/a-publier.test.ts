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

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");

const MDP = "essai-a-publier";
const VIDEO = "v-15";

const apub = await import("@/services/a-publier");
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
});

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
});
