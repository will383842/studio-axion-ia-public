/**
 * ÉQUIPE 7 · TIKTOK — SÉRIES RECONNAISSABLES (docs/conception/TIKTOK-SERIES-HASHTAGS.md, § 2.3).
 * Créer une série, y rattacher un sujet ou une vidéo, numéro d'épisode automatique (jamais réutilisé), même titre à
 * l'écran (ligne « Série : » de l'encadré d'ouverture) et en tête de description « Série · ép. 3 ». Aucun réseau.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { encadreAvecSerie, enteteSerie, serieEffective } from "@/domaine/series";
import { placerEncadre } from "@/briques/composition/encadre";
import { trouverFormat } from "@/formats";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const series = await import("@/services/series");
const generateur = await import("@/services/generateur");
const pub = await import("@/services/publications");
const fabrication = await import("@/services/fabrication");

const MDP = "essai-e7-series";
const NOM = "L'IA qui fait gagner 1 h";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

describe("Séries (PUR)", () => {
  it("en-tête de description : « Série · ép. 3 » (sans épisode : le nom seul)", () => {
    expect(enteteSerie(NOM, 3)).toBe("L'IA qui fait gagner 1 h · ép. 3");
    expect(enteteSerie(NOM)).toBe(NOM);
  });

  it("encadré : « Série : accroche », un ancien thème remplacé, l'accroche gardée", () => {
    expect(encadreAvecSerie("Vos devis en 10 minutes", NOM)).toBe("L'IA qui fait gagner 1 h : Vos devis en 10 minutes");
    expect(encadreAvecSerie("Devis : 10 minutes suffisent", NOM)).toBe("L'IA qui fait gagner 1 h : 10 minutes suffisent");
    expect(encadreAvecSerie(undefined, NOM)).toBe(NOM);
  });

  it("le titre de série tient sur la ligne de thème de l'encadré, sans alerte qui gêne le rendu", () => {
    const f = trouverFormat("avocat")!;
    const def = f.profilRendu?.encadreOuverture ?? f.accrocheVisuelle!.encadreOuverture!;
    const r = placerEncadre(encadreAvecSerie("Vos devis en 10 minutes", NOM), "9:16", ["tiktok"], { encadre: def });
    expect(r.encadre.lignes[0]).toBe("L'IA qui fait gagner 1 h :");
    expect(r.alertes.filter((a) => a.gravite === "attention")).toEqual([]);
  });

  it("série d'une vidéo : la sienne, sinon celle du sujet de sa version", () => {
    expect(serieEffective({ serieId: "s1", episodeSerie: 2 }, { brief: { serieId: "s2" }, episodeSerie: 5 })).toEqual({ serieId: "s1", episode: 2 });
    expect(serieEffective({}, { brief: { serieId: "s2" }, episodeSerie: 5 })).toEqual({ serieId: "s2", episode: 5 });
    expect(serieEffective({}, null)).toBeNull();
  });
});

describe("Séries (service)", () => {
  it("nom : 2 à 40 caractères, sans « : », et lisible à l'écran", async () => {
    expect(series.validerNomSerie(`  ${NOM}  `)).toEqual({ ok: true, nom: NOM });
    expect(series.validerNomSerie("A").ok).toBe(false);
    expect(series.validerNomSerie("IA : le vrai du faux").ok).toBe(false);
    const large = series.validerNomSerie("WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW");
    expect(large.ok).toBe(false);
    if (!large.ok) expect(large.message).toMatch(/écran/);
    await expect(series.creerSerie("IA : le vrai du faux")).rejects.toThrow();
  });

  it("créer une série la montre dans la liste d'Écrire, sans épisode", async () => {
    const s = await series.creerSerie(NOM);
    const liste = await series.listerSeries();
    expect(liste.find((x) => x.id === s.id)).toMatchObject({ nom: NOM, episodes: 0 });
  });

  it("deux séries ne portent pas le même nom", async () => {
    await series.creerSerie(NOM);
    await expect(series.creerSerie("l'ia qui fait gagner 1 h")).rejects.toThrow(/existe/);
  });

  it("numéro d'épisode automatique : 1, 2, 3 ; un sujet retiré ne libère pas son numéro", async () => {
    const s = await series.creerSerie(NOM);
    const a = await generateur.creerSujet({ idee: "Devis en 10 minutes avec l'IA", reseaux: ["tiktok"], formatId: "avocat", serieId: s.id });
    const b = await generateur.creerSujet({ idee: "Relances clients avec ChatGPT", reseaux: ["tiktok"], formatId: "avocat" });
    // INTÉGRATION FINALE (décision du 04/10) : l'épisode se prend au départ réel de l'écriture, pas à la création.
    expect((await depots().scriptsMaitres.obtenir(a.id))!.episodeSerie).toBeUndefined();
    expect((await series.rattacherSujet(a.id, s.id)).episode).toBeUndefined();
    await generateur.attribuerNumero(a.id);
    await generateur.attribuerNumero(b.id);
    expect((await depots().scriptsMaitres.obtenir(a.id))!.episodeSerie).toBe(1);
    expect((await series.rattacherSujet(b.id, s.id)).episode).toBe(2);
    expect((await series.rattacherSujet(b.id, null)).episode).toBeUndefined();
    expect((await depots().scriptsMaitres.obtenir(b.id))!.brief.serieId).toBeUndefined();
    expect((await series.rattacherSujet(b.id, s.id)).episode).toBe(3);
    // Rattaché deux fois à la même série : le numéro ne bouge pas.
    expect((await series.rattacherSujet(b.id, s.id)).episode).toBe(3);
    expect((await series.listerSeries()).find((x) => x.id === s.id)!.episodes).toBe(2);
  });

  it("une série inconnue est refusée", async () => {
    const a = await generateur.creerSujet({ idee: "Devis en 10 minutes avec l'IA", reseaux: ["tiktok"], formatId: "avocat" });
    await expect(series.rattacherSujet(a.id, "serie-inconnue")).rejects.toThrow();
  });
});

describe("Séries sur la vidéo : description et écran", () => {
  async function videoPrete(id = "v-e7s") {
    const modele = (await depots().videos.obtenir("v-04"))!;
    await depots().videos.enregistrer({ ...modele, id, estDemo: false, serieId: undefined });
    return id;
  }

  it("rattacher une vidéo : épisode, en-tête dans le kit et en tête du texte envoyé", async () => {
    const s = await series.creerSerie(NOM);
    const id = await videoPrete();
    expect((await series.rattacherVideo(id, s.id)).episode).toBe(1);
    const kit = (await pub.obtenirKit(id))!;
    expect(kit.serie).toMatchObject({ id: s.id, nom: NOM, episode: 1, entete: "L'IA qui fait gagner 1 h · ép. 1" });
    expect(kit.series.map((x) => x.id)).toContain(s.id);
    for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(id, c, true);
    const r = await pub.envoyerVersBuffer(id, ["tiktok"], new Date(Date.now() + 86_400_000).toISOString());
    expect(r.publications[0].texte.split("\n")[0]).toBe("L'IA qui fait gagner 1 h · ép. 1");
  });

  it("vidéo d'un sujet en série : la série et l'épisode du sujet", async () => {
    const s = await series.creerSerie(NOM);
    const sujet = await generateur.creerSujet({ idee: "Devis en 10 minutes avec l'IA", reseaux: ["tiktok"], formatId: "avocat", serieId: s.id });
    await generateur.attribuerNumero(sujet.id); // départ de l'écriture : l'épisode est pris
    const id = await videoPrete();
    await depots().variantes.enregistrer({ id: "var-e7", scriptMaitreId: sujet.id, reseau: "tiktok", videoId: id } as never);
    await depots().videos.modifier(id, { varianteId: "var-e7" });
    expect(await series.serieDeVideo(id)).toMatchObject({ id: s.id, episode: 1 });
  });

  it("la commande de fabrication écrit le titre de série dans l'encadré d'ouverture", async () => {
    const s = await series.creerSerie(NOM);
    const id = await videoPrete();
    const sans = await fabrication.construireCommande(id);
    expect(sans.encadreTexte ?? "").not.toContain(NOM);
    await series.rattacherVideo(id, s.id);
    const c = await fabrication.construireCommande(id);
    expect(c.encadreTexte?.startsWith(`${NOM} :`) || c.encadreTexte === NOM).toBe(true);
  });
});
