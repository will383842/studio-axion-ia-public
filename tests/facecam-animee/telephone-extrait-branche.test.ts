/**
 * BR-TELEPHONE-b : le téléphone qui joue un extrait reçoit un VRAI extrait de l'archive des vidéos de Will, par le chemin réel :
 * réglage lu (`lireParametre`) → `outilsFacecamAnimee().videos()` (vraie fonction) → `fichiersTelephoneV4` → ffmpeg factice → étape « videos »
 * puis « rendu » de la vraie `avancerChaineV4` (fausse fonction `rendre` qui capture ses arguments).
 * Seuls sont factices : les banques (`chercherVideosServeur`, `approvisionnerFenetresStudio`), ffmpeg et le stockage. Aucun appel réel, 0 €.
 * Le téléphone est MUET et sans texte : aucun calque texte ni rendu « par instants » en jeu ici.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlageExtrait } from "@/domaine/archive-extraits";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import type { ElementBibliotheque, Licence } from "@/domaine/types";
import type { MotTranscrit } from "@/moteurs/montage-facecam-animee/realisateur";

const lire = vi.hoisted(() => vi.fn());
const banques = vi.hoisted(() => ({ chercher: vi.fn(async () => []), fenetres: [] as { recherche: string; media: string }[] }));
const ffmpeg = vi.hoisted(() => ({ executer: [] as string[][], telecharger: [] as string[], deposer: [] as string[] }));
vi.mock("@/services/_commun", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/_commun")>()),
  lireParametre: lire,
  depots: (await import("@/donnees/memoire")).depots,
}));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => undefined) }));
vi.mock("@/moteurs/montage-facecam-animee/images/production", () => ({
  chercherVideosServeur: () => banques.chercher,
  outilsPreparationServeur: () => ({
    executer: async (_p: string, a: string[]) => (ffmpeg.executer.push(a), new Uint8Array()),
    telecharger: async (url: string) => void ffmpeg.telecharger.push(url),
    dossierTravail: async (n: string) => `/tmp/${n}`,
    taille: async () => 1000,
    deposer: async (_f: string, cle: string) => (ffmpeg.deposer.push(cle), cle),
    supprimerDossier: async () => undefined,
  }),
  // Banque factice : remplit chaque fenêtre qu'on lui donne (et note ce qu'on lui a demandé).
  approvisionnerFenetresStudio: async (plan: { fenetres: { recherche: string; media: string }[] }) => {
    banques.fenetres.push(...plan.fenetres.map((f) => ({ recherche: f.recherche, media: f.media })));
    // Comme la vraie : la fenêtre ressort avec la clé FINALE du clip déposé (celle que la fonction compare).
    const cle = `studio/dev/facecam-animee/v-1/videos/${plan.fenetres[0].media}`;
    return { plan: { ...plan, fenetres: [{ ...plan.fenetres[0], media: cle }] }, choix: [{ fenetre: 0, source: "pexels", id: "p1", scene: "x", genre: "video", cle }], manques: [], supprimees: [], empreintes: ["e"] };
  },
}));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { outilsFacecamAnimee } = await import("@/services/facecam-animee");
const { PARAM_TELEPHONE_VIDEO_FA } = await import("@/moteurs/montage-facecam-animee/realisateur/consigne-telephone-video");
const { avancerChaineV4, etatInitialV4 } = await import("@/moteurs/montage-facecam-animee/chaine-v4");
type EtatChaineV4 = import("@/moteurs/montage-facecam-animee/chaine-v4").EtatChaineV4;

const NOW = "2026-11-17T10:00:00.000Z";
const lic = (): Licence => ({ type: "propriete", usageCommercial: true, reseaux: [] });
const plage = (id: string, p: Partial<PlageExtrait> = {}): PlageExtrait => ({
  id, debutSec: 0, finSec: 6, texte: "un dirigeant qui signe un devis", motsCles: ["devis", "signature", "dirigeant"],
  avecVisage: false, texteIncruste: false, etat: "utilisable", ...p,
});
/** Une vidéo déjà publiée de Will : élément d'archive + sortie + fichier (la source que ffmpeg lira). */
async function semerArchive(plages: PlageExtrait[] = [plage("p1")]) {
  await depots().fichiers.enregistrer({ id: "f-ancien", cleStockage: "studio/dev/sorties/v-ancien.mp4", nom: "v.mp4", mime: "video/mp4", taille: 1, creeLe: NOW, modifieLe: NOW } as never);
  await depots().sorties.enregistrer({ id: "s-ancien", videoId: "v-ancien", versionId: "ver", ratio: "9:16", resolution: "1080x1920", fichierId: "f-ancien", creeLe: NOW, modifieLe: NOW } as never);
  await depots().elements.enregistrer({
    id: "archive-extraits-v-ancien", type: "source-extraits", nom: "Extraits", motsCles: [], formatsParDefaut: [], marqueId: "m", licence: lic(), creeLe: NOW, modifieLe: NOW,
    valeur: { type: "source-extraits", fiche: { videoId: "v-ancien", versionId: "ver", sortieId: "s-ancien", ratio: "9:16", licence: lic(), famille: [], plages, rangee: false, sourcePreferee: true } },
  } as unknown as ElementBibliotheque);
}

// Plan de la répétition générale (vraies plaquettes), dont le premier « FenetreTelephone » devient le téléphone qui joue un extrait.
const RACINE = join(__dirname, "..", "..");
const REP = join(RACINE, "docs/facecam-animee-v4/repetition-generale");
const TRANS = JSON.parse(readFileSync(join(REP, "transcription.json"), "utf8")) as { dureeMonteeSec: number; gardes: { debutSec: number; finSec: number }[]; motsMontesTexteValide: MotTranscrit[] };
const PLAN_VALIDE = JSON.parse(readFileSync(join(REP, "plan-realisateur.json"), "utf8")) as PlanFacecamAnimee;
const A_VIDEO = new Set(["AvantApres", "MosaiqueVideos", "duel-video"]);
const RANG_TEL = (PLAN_VALIDE.elementsV4 ?? []).findIndex((e) => e.id === "FenetreTelephone");
const planAvec = (recherche: string | null): PlanFacecamAnimee => ({
  ...PLAN_VALIDE,
  elementsV4: (PLAN_VALIDE.elementsV4 ?? []).map((e, i) => {
    const copie = { ...e };
    if (A_VIDEO.has(e.id)) delete copie.medias; // comme l'écrit Opus : des recherches, pas de medias
    if (i === RANG_TEL && recherche) return { id: "telephone-video", debut: e.debut, fin: e.fin, recherches: [recherche] };
    return copie;
  }),
});
const NOM_TEL = `v4-${RANG_TEL}-0.mp4`;
const CLE_TEL = `studio/dev/facecam-animee/v-1/videos/${NOM_TEL}`;

const reglage = (valeur: unknown) => lire.mockImplementation(async (id: string, defaut: unknown) => (id === PARAM_TELEPHONE_VIDEO_FA ? valeur : defaut));
const outils = () =>
  outilsFacecamAnimee({ videoId: "v-1", travailId: "t-1", production: false, planScenes: null, signer: { lecture: async (c: string) => `https://signe.test/${c}`, depot: async (c: string) => c }, rendu: { soumettre: vi.fn(), etat: vi.fn() } } as never);
const telephoneDe = (p: PlanFacecamAnimee) => (p.elementsV4 ?? []).find((e) => e.id === "telephone-video");

beforeEach(() => {
  lire.mockReset();
  lire.mockImplementation(async (_i: string, d: unknown) => d);
  banques.chercher.mockClear();
  banques.fenetres.length = 0;
  ffmpeg.executer.length = 0; ffmpeg.telecharger.length = 0; ffmpeg.deposer.length = 0;
  reinitialiserDepots();
  vi.stubEnv("PEXELS_API_KEY", "cle-factice");
  vi.stubEnv("PIXABAY_API_KEY", "");
});

describe("BR-TELEPHONE-b : le téléphone prend un extrait de l'archive (videos() réelle)", () => {
  it("(a) éteint : le plan ressort tel qu'il est entré pour le téléphone, les banques servent comme avant, ffmpeg et l'archive ne servent pas", async () => {
    await semerArchive();
    const plan = planAvec("axion:devis signature");
    const r = await (await outils()).videos!({ videoId: "v-1", plan, mots: TRANS.motsMontesTexteValide });
    expect(ffmpeg.executer).toEqual([]);
    expect(ffmpeg.deposer).toEqual([]);
    expect(telephoneDe(r.plan)).toEqual(telephoneDe(plan)); // ni medias, ni retrait : code d'aujourd'hui
    expect(banques.fenetres.every((f) => !f.recherche.startsWith("axion:"))).toBe(true);
    expect(banques.fenetres.length).toBeGreaterThan(0); // les banques servent toujours les plaquettes à vidéo
    // le même plan, avec ou sans téléphone dans l'archive, donne les mêmes fichiers de banque
    const sansTel = await (await outils()).videos!({ videoId: "v-1", plan: planAvec(null), mots: TRANS.motsMontesTexteValide });
    expect(r.fichiers).toEqual(sansTel.fichiers);
    expect(r.manques).toEqual(sansTel.manques);
  });

  it("(a) « true » (texte), 1, null ou lecture qui lève : éteint aussi", async () => {
    await semerArchive();
    for (const valeur of ["true", 1, null, "leve"] as const) {
      lire.mockImplementation(async (id: string, d: unknown) => {
        if (id !== PARAM_TELEPHONE_VIDEO_FA) return d;
        if (valeur === "leve") throw new Error("lecture");
        return valeur;
      });
      const r = await (await outils()).videos!({ videoId: "v-1", plan: planAvec("axion:devis signature"), mots: TRANS.motsMontesTexteValide });
      expect(telephoneDe(r.plan)?.medias).toBeUndefined();
      expect(ffmpeg.executer).toEqual([]);
    }
  });

  it("(b) allumé + archive avec une plage de 3 s « dirigeant qui signe un devis » : 1 fichier pour le téléphone, clip 4:5 muet de la bonne source, AUCUNE banque pour lui, dépense inchangée", async () => {
    await semerArchive([plage("p1", { finSec: 3 })]);
    const sansTel = await (await outils()).videos!({ videoId: "v-1", plan: planAvec(null), mots: TRANS.motsMontesTexteValide });
    banques.fenetres.length = 0;
    reglage(true);
    const r = await (await outils()).videos!({ videoId: "v-1", plan: planAvec("axion:devis signature"), mots: TRANS.motsMontesTexteValide });
    expect(r.fichiers.filter((f) => f.nom === NOM_TEL)).toEqual([{ nom: NOM_TEL, cle: CLE_TEL }]);
    expect(r.fichiers).toHaveLength(sansTel.fichiers.length + 1);
    expect(telephoneDe(r.plan)?.medias).toEqual([`broll/${NOM_TEL}`]);
    // la source lue est la vidéo publiée, adresse signée ; le clip est déposé sous la clé du dossier de vidéos ; ffmpeg : 4:5, sans son
    expect(ffmpeg.telecharger).toEqual(["https://signe.test/studio/dev/sorties/v-ancien.mp4"]);
    expect(ffmpeg.deposer).toEqual([CLE_TEL]);
    const args = ffmpeg.executer[0].join(" ");
    expect(args).toContain("-an");
    expect(args).toContain("1080");
    expect(args).toContain("1350");
    // aucune banque pour le téléphone : ni recherche « axion: », ni fenêtre du téléphone ; mêmes appels qu'avant pour le reste
    expect(banques.fenetres.every((f) => !f.recherche.startsWith("axion:") && f.media !== NOM_TEL)).toBe(true);
    expect(r.depenseUsd).toBe(sansTel.depenseUsd);
    expect(r.choix?.some((c) => c.fichier === NOM_TEL && c.source === "archive-axion")).toBe(true);
  });

  it("(b) sans clé de banque : le téléphone est quand même servi par l'archive", async () => {
    vi.stubEnv("PEXELS_API_KEY", "");
    await semerArchive();
    reglage(true);
    const r = await (await outils()).videos!({ videoId: "v-1", plan: planAvec("axion:devis signature"), mots: TRANS.motsMontesTexteValide });
    expect(r.fichiers).toEqual([{ nom: NOM_TEL, cle: CLE_TEL }]);
    expect(telephoneDe(r.plan)?.medias).toEqual([`broll/${NOM_TEL}`]);
    expect(r.depenseUsd).toBe(0);
  });

  it("(c) allumé + archive vide : repli sans vidéo (le téléphone est retiré du plan), message clair, aucune banque, aucun fichier pour lui", async () => {
    reglage(true);
    const r = await (await outils()).videos!({ videoId: "v-1", plan: planAvec("axion:devis signature"), mots: TRANS.motsMontesTexteValide });
    expect(telephoneDe(r.plan)).toBeUndefined();
    expect(r.fichiers.some((f) => f.nom === NOM_TEL)).toBe(false);
    expect(r.manques.some((m) => m.includes("telephone-video") && m.includes("aucun extrait de vos vidéos"))).toBe(true);
    expect(banques.fenetres.every((f) => !f.recherche.startsWith("axion:"))).toBe(true);
    expect(ffmpeg.executer).toEqual([]);
  });

  it("(c) archive qui existe mais ffmpeg en échec : même repli, rien de levé", async () => {
    await semerArchive();
    reglage(true);
    const o = await outils();
    const { fichiersTelephoneV4 } = await import("@/services/telephone-extrait-v4");
    const r = await fichiersTelephoneV4(planAvec("axion:devis signature"), {
      videoId: "v-1", signerLecture: async (c) => c, cleClip: (n) => n, mode: "telecharger",
      outils: { executer: async () => { throw new Error("ffmpeg"); }, telecharger: async () => undefined, dossierTravail: async () => "/tmp/x", taille: async () => 1, deposer: async (_f, c) => c },
    });
    expect(o).toBeTruthy();
    expect(r.fichiers).toEqual([]);
    expect(r.sansExtrait).toEqual([NOM_TEL]);
    expect(telephoneDe(r.plan)).toBeUndefined();
  });

  it("une recherche ordinaire (sans axion:) n'est jamais traitée par l'archive, même allumé", async () => {
    await semerArchive();
    reglage(true);
    const plan = planAvec("devis signature");
    const r = await (await outils()).videos!({ videoId: "v-1", plan, mots: TRANS.motsMontesTexteValide });
    expect(ffmpeg.executer).toEqual([]);
    expect(telephoneDe(r.plan)?.medias).toBeUndefined();
  });

  it("(d) de bout en bout : étape « videos » puis « rendu » de la vraie chaîne ; le rendu reçoit le fichier du téléphone et le plan qui y renvoie", async () => {
    await semerArchive();
    reglage(true);
    const reels = await outils();
    const captures: { videos?: { nom: string; cle: string }[]; plan: PlanFacecamAnimee }[] = [];
    const brancher = { ...reels, rendre: async (d: { plan: PlanFacecamAnimee; videos?: { nom: string; cle: string }[] }) => (captures.push({ videos: d.videos, plan: d.plan }), { cle: "sortie.mp4", vignetteCle: "v.jpg", dureeSec: 80, taille: 1 }) };
    const depart: EtatChaineV4 = {
      ...etatInitialV4({ videoId: "v-1", versionId: "ver-1", priseCle: "k.mov" } as never),
      etape: "videos",
      coupes: { gardes: TRANS.gardes, dureeSec: TRANS.dureeMonteeSec, mots: TRANS.motsMontesTexteValide } as never,
      realisation: { version: "complete", essais: 1, avertissements: 0, plan: planAvec("axion:devis signature") },
    };
    const apresVideos = await avancerChaineV4(depart, brancher as never);
    expect(apresVideos.etape).toBe("rendu");
    expect(apresVideos.videos?.fichiers.some((f) => f.nom === NOM_TEL && f.cle === CLE_TEL)).toBe(true);
    expect(apresVideos.videos?.choix?.some((c) => c.fichier === NOM_TEL)).toBe(true);
    await avancerChaineV4(apresVideos, brancher as never);
    expect(captures).toHaveLength(1);
    expect(captures[0].videos).toContainEqual({ nom: NOM_TEL, cle: CLE_TEL });
    expect(telephoneDe(captures[0].plan)?.medias).toEqual([`broll/${NOM_TEL}`]);
    expect(banques.fenetres.every((f) => !f.recherche.startsWith("axion:"))).toBe(true);
  });

  it("(d) éteint : le rendu reçoit les mêmes fichiers qu'avant (aucun pour le téléphone)", async () => {
    await semerArchive();
    const reels = await outils();
    const depart: EtatChaineV4 = {
      ...etatInitialV4({ videoId: "v-1", versionId: "ver-1", priseCle: "k.mov" } as never),
      etape: "videos",
      coupes: { gardes: TRANS.gardes, dureeSec: TRANS.dureeMonteeSec, mots: TRANS.motsMontesTexteValide } as never,
      realisation: { version: "complete", essais: 1, avertissements: 0, plan: planAvec(null) },
    };
    const apres = await avancerChaineV4(depart, reels as never);
    expect(apres.videos?.fichiers.some((f) => f.nom === NOM_TEL)).toBe(false);
  });
});
