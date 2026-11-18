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
import type { MotTranscrit, RequeteRealisateur } from "@/moteurs/montage-facecam-animee/realisateur";
import type { ElementV4Plan } from "@/domaine/facecam-animee/plan";
import { erreurRepliTelephone, retirerSansVideoOuvertV4, telephonesSansMediaV4 } from "@/moteurs/montage-facecam-animee/repli-telephone-video";
import { plaquettesSansVideo } from "@/moteurs/montage-facecam-animee/videos-v4";

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

  it("(c) allumé + archive vide : le téléphone reste sans media (la chaîne le retire : voir (d bis)), message clair, aucune banque, aucun fichier pour lui", async () => {
    reglage(true);
    const r = await (await outils()).videos!({ videoId: "v-1", plan: planAvec("axion:devis signature"), mots: TRANS.motsMontesTexteValide });
    expect(telephoneDe(r.plan)).toBeDefined();
    expect(telephoneDe(r.plan)?.medias).toBeUndefined();
    expect(telephonesSansMediaV4(r.plan, { telephoneVideo: true })).toEqual([RANG_TEL]);
    expect(retirerSansVideoOuvertV4(r.plan, { telephoneVideo: true }).retirees.map((x) => x.id)).toEqual(["telephone-video"]);
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
    expect(telephoneDe(r.plan)?.medias).toBeUndefined(); // reste à son rang ; le retrait est celui de la chaîne
    expect(telephoneDe(retirerSansVideoOuvertV4(r.plan, { telephoneVideo: true }).plan)).toBeUndefined();
  });

  it("2 téléphones dont le 1er sans extrait, avant des plaquettes à banque : aucun nom de clip en double, la clé de l'extrait n'est la media d'aucune fenêtre de banque", async () => {
    await semerArchive([plage("p1", { finSec: 3 })]);
    reglage(true);
    const base = planAvec("axion:devis signature");
    const premier = RANG_TEL - 1; // rang AVANT le téléphone servi : un retrait précoce décalerait tous les rangs suivants
    const plan: PlanFacecamAnimee = { ...base, elementsV4: (base.elementsV4 ?? []).map((e, i) => (i === premier ? { id: "telephone-video", debut: e.debut, fin: e.fin, recherches: ["axion:zzzz introuvable"] } : i === RANG_TEL + 1 ? { ...(base.elementsV4 ?? [])[5], debut: e.debut, fin: e.fin } : e)) }; // la mosaïque suit le téléphone servi (comme à la répétition)
    const r = await (await outils()).videos!({ videoId: "v-1", plan, mots: TRANS.motsMontesTexteValide });
    const noms = r.fichiers.map((f) => f.nom);
    expect(new Set(noms).size).toBe(noms.length);
    const cles = r.fichiers.map((f) => f.cle);
    expect(new Set(cles).size).toBe(cles.length);
    expect(r.fichiers.filter((f) => f.nom === NOM_TEL)).toEqual([{ nom: NOM_TEL, cle: CLE_TEL }]);
    // le téléphone servi garde son rang d'origine ; aucune fenêtre de banque ne renvoie à son clip
    const tels = (r.plan.elementsV4 ?? []).filter((e) => e.id === "telephone-video");
    expect(tels).toHaveLength(2); // le 1er, sans extrait, reste à son rang SANS media (la chaîne le retire) ; rien ne décale les rangs
    expect(tels[0].medias).toBeUndefined();
    expect(tels[1].medias).toEqual([`broll/${NOM_TEL}`]);
    expect((r.plan.elementsV4 ?? []).length).toBe((plan.elementsV4 ?? []).length);
    const medias = (r.plan.elementsV4 ?? []).filter((e) => e.id !== "telephone-video").flatMap((e) => e.medias ?? []);
    expect(medias).not.toContain(`broll/${NOM_TEL}`);
    expect(banques.fenetres.every((f) => f.media !== NOM_TEL && !f.recherche.startsWith("axion:"))).toBe(true);
    expect(ffmpeg.deposer).toEqual([CLE_TEL]);
    expect(r.manques.some((m) => m.includes("aucun extrait de vos vidéos"))).toBe(true);
  });

  it("une recherche ordinaire (sans axion:) n'est jamais traitée par l'archive, même allumé", async () => {
    await semerArchive();
    reglage(true);
    const plan = planAvec("devis signature");
    const r = await (await outils()).videos!({ videoId: "v-1", plan, mots: TRANS.motsMontesTexteValide });
    expect(ffmpeg.executer).toEqual([]);
    expect(telephoneDe(r.plan)?.medias).toBeUndefined();
  });

  // ---- (d) PAR LE CHEMIN RÉEL : « mise-en-scene » → vraie `realiser` + vrai `verifierPlan` → VRAIE `videos()` du service → « rendu » ----
  // Seuls factices : l'appel à Claude (plans écrits ici, requêtes captées), les ports de plafond / historique, `rendre` (capte ses arguments), banques, ffmpeg, stockage.
  const TEL = "telephone-video";
  const D0_TEL = "« telephone-video » n'existe pas dans le catalogue v4";
  const motsForts = [...new Set(PLAN_VALIDE.groupes.flatMap((g) => g.mots.filter((m) => m.fort).map((m) => m.w.replace(/[.,;:!?…«»"“”()]/g, ""))))];
  const BANQUE = (PLAN_VALIDE.elementsV4 ?? []).map((e) => {
    const copie = { ...e };
    if (A_VIDEO.has(e.id)) delete copie.medias;
    return copie;
  });
  const RANGS_BANQUE = BANQUE.flatMap((e, i) => (A_VIDEO.has(e.id) ? [i] : []));
  const RANG_SEUL = RANGS_BANQUE[0];
  const SEUL_TEL: ElementV4Plan = { id: TEL, debut: BANQUE[RANG_SEUL].debut, fin: BANQUE[RANG_SEUL].fin, recherches: ["axion:devis signature"], illustre: "les devis signés" };
  // Le SEUL élément à vidéo est le téléphone : les deux autres plaquettes de banque deviennent des plaquettes sans vidéo, aux mêmes instants.
  const SANS_VIDEO: Record<string, (e: ElementV4Plan) => ElementV4Plan> = {
    "duel-video": (e) => ({ id: "MotSaute", debut: e.debut, fin: Math.round((e.fin - 0.1) * 100) / 100, mots: ["OUTIL", "EMBAUCHE"], illustre: "un outil de plus, une embauche de plus" }),
    MosaiqueVideos: (e) => ({ id: "CarteCalendrier", debut: e.debut, fin: e.fin, mots: ["NOTRE ÉQUIPE"], instants: [49.6, 50.8], illustre: "en visio avec notre équipe" }),
  };
  const PLAN_AU_TEL: ElementV4Plan[] = BANQUE.map((e, i) => (i === RANG_SEUL ? SEUL_TEL : SANS_VIDEO[e.id]?.(e) ?? e));
  /** 2e plan d'Opus après le repli : le téléphone devient une plaquette sans vidéo, à son instant. */
  const PLAN_REPLI: ElementV4Plan[] = PLAN_AU_TEL.map((e) => (e.id === TEL ? { id: "CarteCalendrier", debut: e.debut, fin: e.fin, mots: ["À LA MAIN"], instants: [8.6, 9.4], illustre: "les devis, les relances à la main, les chiffres" } : e));
  const NOM_SEUL = `v4-${RANG_SEUL}-0.mp4`;
  const CLE_SEUL = `studio/dev/facecam-animee/v-1/videos/${NOM_SEUL}`;

  /** Faux Claude : rend les plans dans l'ordre (le dernier se répète), capte chaque requête. */
  function realisateurFaux(plans: ElementV4Plan[][]) {
    const requetes: RequeteRealisateur[] = [];
    let n = 0;
    const appeler = async (r: RequeteRealisateur) => {
      requetes.push(r);
      return { ok: true as const, donnees: { cartes: [], fenetres: [], calques: [], zooms: [], motions: [], elementsV4: plans[Math.min(n++, plans.length - 1)], motsForts } };
    };
    return { requetes, appeler };
  }
  const etatMiseEnScene = (): EtatChaineV4 => ({
    ...etatInitialV4({ videoId: "v-1", versionId: "ver-1", priseCle: "k.mov" } as never),
    etape: "mise-en-scene",
    coupes: { gardes: TRANS.gardes, dureeSec: TRANS.dureeMonteeSec, mots: TRANS.motsMontesTexteValide } as never,
  });
  async function chaineReelle(plans: ElementV4Plan[][]) {
    const reels = await outils();
    const videos = vi.fn(reels.videos!);
    const faux = realisateurFaux(plans);
    const rendre = vi.fn(async (d: { plan: PlanFacecamAnimee; videos?: { nom: string; cle: string }[] }) => ({ cle: "sortie.mp4", vignetteCle: "v.jpg", dureeSec: d.plan.duree, taille: 1 }));
    const o = { ...reels, appelerRealisateur: faux.appeler, plafondClaudeAtteint: async () => false, historique: async () => [], videos, rendre } as never;
    const etats: EtatChaineV4[] = [etatMiseEnScene()];
    let erreur: unknown = null;
    for (let i = 0; i < 8 && etats[etats.length - 1].etape !== "prete"; i++) {
      try {
        etats.push(await avancerChaineV4(etats[etats.length - 1], o));
      } catch (e) {
        erreur = e;
        break;
      }
    }
    return { etats, erreur, videos, rendre, faux };
  }

  it("(d) allumé, le téléphone est le SEUL élément à vidéo : de « mise-en-scene » à « rendu », vraie videos(), aucune banque, l'extrait et sa media arrivent au rendu", async () => {
    await semerArchive([plage("p1", { finSec: 3 })]);
    reglage(true);
    const r = await chaineReelle([PLAN_AU_TEL]);
    expect(r.erreur).toBeNull();
    expect(r.etats.map((e) => e.etape)).toEqual(["mise-en-scene", "videos", "rendu", "prete"]);
    // la mise en scène (vrai verifierPlan) laisse passer le téléphone : plan complet, aucune erreur D0 (les corrections D14 viennent des répétitions de la répétition générale, pas du téléphone)
    expect(r.etats[1].realisation?.version).toBe("complete");
    expect((r.etats[1].realisation?.erreurs ?? []).filter((e) => e.includes("telephone-video"))).toEqual([]);
    expect(r.faux.requetes.some((q) => q.message.includes(D0_TEL))).toBe(false);
    // R1 : la chaîne appelle `videos()` (la vraie) pour ce plan, sans plaquette à banque
    expect(r.videos).toHaveBeenCalledTimes(1);
    expect(plaquettesSansVideo(r.videos.mock.calls[0][0].plan)).toEqual([]);
    // argent : aucune banque (ni recherche, ni fenêtre), dépense nulle ; l'extrait vient de l'archive (ffmpeg 4:5 muet)
    expect(banques.chercher).not.toHaveBeenCalled();
    expect(banques.fenetres).toEqual([]);
    expect(r.etats[2].videos?.depenseUsd).toBe(0);
    expect(ffmpeg.deposer).toEqual([CLE_SEUL]);
    expect(ffmpeg.executer[0].join(" ")).toContain("-an");
    // le rendu reçoit le fichier du téléphone ET le plan qui y renvoie (rien n'est retiré)
    expect(r.etats[2].videos?.retirees).toEqual([]);
    expect(r.rendre).toHaveBeenCalledTimes(1);
    const arg = r.rendre.mock.calls[0][0];
    expect(arg.videos).toEqual([{ nom: NOM_SEUL, cle: CLE_SEUL }]);
    expect(telephoneDe(arg.plan)?.medias).toEqual([`broll/${NOM_SEUL}`]);
    expect(telephonesSansMediaV4(arg.plan, { telephoneVideo: true })).toEqual([]);
  });

  it("(d bis) allumé, archive vide : le téléphone est retiré PAR LA CHAÎNE (repli C4-U4.9b-b : H1/H2, puis Opus refait sans lui, une fois) ; le rendu ne reçoit ni téléphone ni media sans nom, 0 €", async () => {
    reglage(true);
    const r = await chaineReelle([PLAN_AU_TEL, PLAN_AU_TEL, PLAN_REPLI]);
    expect(r.erreur).toBeNull();
    expect(r.videos).toHaveBeenCalledTimes(1);
    const apresVideos = r.etats[2];
    // retrait avec sa raison et le message clair ; aucun D0 du téléphone au contrôle après retrait
    expect(apresVideos.videos?.retirees.map((x) => x.id)).toEqual([TEL]);
    expect(apresVideos.videos?.retirees[0].raison).toMatch(/^aucun extrait des vidéos de Will trouvé pour « telephone-video »/);
    expect(apresVideos.videos?.manques.some((m) => m.includes("aucun extrait de vos vidéos"))).toBe(true);
    expect((apresVideos.videos?.controle?.erreurs ?? []).some((e) => e.includes("telephone-video"))).toBe(false);
    // sans le téléphone, Will reste seul à son instant (H2a) : retour à la mise en scène, avec la consigne exacte du téléphone et la plaquette interdite
    expect(apresVideos.etape).toBe("mise-en-scene");
    expect(apresVideos.repliSansVideo?.retirees.map((x) => x.id)).toEqual([TEL]);
    const repli = r.faux.requetes.find((q) => /INTERDITES/.test(q.message));
    expect(repli).toBeDefined();
    expect(repli!.message).toMatch(/INTERDITES[^\n]*telephone-video/);
    expect(repli!.message).toContain(erreurRepliTelephone(RANG_SEUL, SEUL_TEL.debut));
    // le 2e plan (sans téléphone) va jusqu'au rendu
    expect(r.etats[r.etats.length - 1].etape).toBe("prete");
    expect(r.rendre).toHaveBeenCalledTimes(1);
    const arg = r.rendre.mock.calls[0][0];
    expect(telephoneDe(arg.plan)).toBeUndefined();
    expect((arg.plan.elementsV4 ?? []).flatMap((e) => e.medias ?? []).filter((m) => !/^broll\/.+/.test(m))).toEqual([]);
    // aucune banque, aucun fichier, aucune dépense, ffmpeg jamais lancé
    expect(banques.chercher).not.toHaveBeenCalled();
    expect(banques.fenetres).toEqual([]);
    expect(apresVideos.videos?.depenseUsd).toBe(0);
    expect(ffmpeg.executer).toEqual([]);
  });

  it("(d ter) éteint : même plan au téléphone, la chaîne réelle le refuse par D0 comme aujourd'hui ; archive, ffmpeg et banques ne servent pas, le rendu ne reçoit aucun téléphone", async () => {
    await semerArchive([plage("p1", { finSec: 3 })]);
    const r = await chaineReelle([PLAN_AU_TEL, PLAN_AU_TEL, PLAN_REPLI]);
    expect(r.faux.requetes.length).toBeGreaterThanOrEqual(2);
    expect(r.faux.requetes[1].message).toContain(D0_TEL);
    expect(ffmpeg.executer).toEqual([]);
    expect(ffmpeg.deposer).toEqual([]);
    expect(banques.chercher).not.toHaveBeenCalled();
    for (const c of r.rendre.mock.calls) expect(telephoneDe(c[0].plan)).toBeUndefined();
  });

  it("(d éteint) plan de la répétition : la chaîne réelle va jusqu'au rendu, aucun fichier pour le téléphone, ffmpeg ne sert pas", async () => {
    await semerArchive();
    const r = await chaineReelle([BANQUE]);
    expect(r.erreur).toBeNull();
    expect(r.etats.map((e) => e.etape)).toEqual(["mise-en-scene", "videos", "rendu", "prete"]);
    expect(ffmpeg.executer).toEqual([]);
    expect(r.rendre.mock.calls[0][0].videos?.some((f) => f.nom.startsWith("v4-") && f.cle.includes("axion"))).toBe(false);
  });
});
