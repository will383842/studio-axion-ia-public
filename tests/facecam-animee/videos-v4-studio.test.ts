/**
 * FACE CAMÉRA ANIMÉE v4 — outil « vidéos d'illustration » du studio (18/10/2026).
 * `fournirVideosV4` cherche, contrôle et prépare UNE vidéo par `recherche` des plaquettes AvantApres, MosaiqueVideos, duel-video.
 * Banques, ffmpeg et Claude sont SIMULÉS : aucun appel réseau (fetch est piégé), aucune dépense.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ElementV4Plan, PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { adaptateurStudio } from "@/moteurs/montage-facecam-animee/images/adaptateur";
import type { CandidatImage } from "@/moteurs/montage-facecam-animee/images/choisir";
import { remplirFenetres } from "@/moteurs/montage-facecam-animee/images";
import type { OptionsProductionImages } from "@/moteurs/montage-facecam-animee/images/production";
import { preparateurMiniVideo, type OutilsPreparation } from "@/moteurs/montage-facecam-animee/images/preparation";
import { MODELE_ECRITURE, MODELE_JUGE } from "@/fournisseurs/claude/tarifs";
import { CONTROLES_MAX_PAR_REQUETE, fournirVideosV4, PLAFOND_VIDEOS_USD, roleControleVideoV4, sousVerrouLocalV4, type DependancesVideosV4 } from "@/moteurs/montage-facecam-animee/videos-v4-studio";
import { plaquettesSansVideo } from "@/moteurs/montage-facecam-animee/videos-v4";

const DOSSIER = mkdtempSync(join(tmpdir(), "videos-v4-test-"));
const IMAGE = join(DOSSIER, "planche.jpg");
writeFileSync(IMAGE, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

const MOTS = [
  { w: "Avant,", a: 4.0, f: 4.2 }, { w: "on", a: 4.3, f: 4.5 }, { w: "tapait", a: 4.5, f: 4.7 }, { w: "tout", a: 4.8, f: 5.0 }, { w: "à", a: 5.0, f: 5.2 }, { w: "la", a: 5.1, f: 5.3 }, { w: "main.", a: 5.3, f: 5.5 },
  { w: "Maintenant", a: 6.0, f: 6.2 }, { w: "tout", a: 6.4, f: 6.6 }, { w: "part", a: 6.7, f: 6.9 }, { w: "seul.", a: 7.0, f: 7.2 },
];

const el = (id: string, debut: number, extra: Partial<ElementV4Plan> = {}): ElementV4Plan => ({ id, debut, fin: debut + 2.5, ...extra });
const planDe = (elementsV4: ElementV4Plan[]) => ({ elementsV4, duree: 30 }) as unknown as PlanFacecamAnimee;

/** Candidat de banque : 1080 x 1920, 15 s, description = la requête (classement par recouvrement). */
const candidat = (source: "pexels" | "pixabay", id: string, requete: string): CandidatImage => ({
  source, id, genre: "video", cle: `https://banque.invalid/${source}/${id}.mp4`, vignette: `https://banque.invalid/${source}/${id}.jpg`, largeur: 1080, hauteur: 1920, dureeSec: 15,
  description: requete, licence: { usageCommercial: true, nom: source === "pexels" ? "Pexels License" : "Pixabay Content License" }, page: `https://banque.invalid/page/${id}`, auteur: "Auteur",
});

interface Banc {
  dep: DependancesVideosV4;
  appelsChercher: { source: string; requete: string; page: number }[];
  dossiers: string[];
  controles: { cle: string; consigne: string }[];
  retires: string[];
  deposes: string[];
}

/** Banc simulé : `verdict(requete)` dit si le candidat de cette requête est « littéral » ; `cout` = dollars par contrôle. */
function banc(o: { verdict?: (consigne: string, cle: string) => "littéral" | "métaphore" | "hors sujet"; cout?: number; candidats?: number; sansMouvement?: boolean } = {}): Banc {
  const verdict = o.verdict ?? (() => "littéral" as const);
  const appelsChercher: Banc["appelsChercher"] = [];
  const controles: Banc["controles"] = [];
  const retires: string[] = [];
  const deposes: string[] = [];
  const dossiers: string[] = [];
  let courant = "";
  const preparation: OutilsPreparation = {
    executer: async () => { throw new Error("pas de ffmpeg dans ce test"); },
    telecharger: async () => undefined,
    dossierTravail: async (nom) => {
      dossiers.push(nom);
      return DOSSIER;
    },
    taille: async () => 1000,
    deposer: async (_f, cle) => { deposes.push(cle); return cle; },
    retirer: async (cle) => { retires.push(cle); },
  };
  const dep: DependancesVideosV4 = {
    chercherVideos: async (source, requete, page) => {
      appelsChercher.push({ source, requete, page });
      courant = `${source}|${requete}`;
      if (source !== "pexels" || page > 1) return [];
      return Array.from({ length: o.candidats ?? 6 }, (_, k) => candidat("pexels", `${requete.replace(/\W+/g, "-")}-${k}`, requete));
    },
    preparation,
    cleClip: (nom) => `studio/dev/facecam-animee/v-1/videos/${nom}`,
    controler: async ({ consigne }) => {
      controles.push({ cle: courant, consigne });
      return { ok: true, texte: JSON.stringify({ verdict: verdict(consigne, courant), texte: false, logo: false, grosPlanVisage: false, raison: "ok" }), coutUsd: o.cout ?? 0.01 };
    },
    // approvisionnement RÉEL des fenêtres (remplirFenetres) sur des préparations simulées
    approvisionner: async (plan, opt: OptionsProductionImages) =>
      remplirFenetres(plan, {
        ...adaptateurStudio({ chercherVideos: opt.chercherVideos }),
        preparerMiniVideo: async (c, d) => {
          await opt.preparation!.dossierTravail(`${c.source}-${c.id}`);
          await opt.preparation!.telecharger(c.cle, "x");
          const cle = await opt.preparation!.deposer("x", `videos/fenetre-${d.fenetre + 1}.mp4`);
          return { cle, depuisSec: 0, mouvement: 6, pixelsChanges: o.sansMouvement ? 0.001 : 0.1, pixelsChangesMedian: o.sansMouvement ? 0.001 : 0.1, partFigee: 0, coupes: 0, dureeSec: 3.5, octets: 1000, image: IMAGE };
        },
        abandonner: async (cle) => { await opt.preparation!.retirer?.(cle); },
        stocker: async (c) => c.cle,
        verifierMiniVideo: opt.verifierMiniVideo,
        historique: opt.historique,
        mots: opt.mots,
      }) as never,
  };
  return { dep, appelsChercher, dossiers, controles, retires, deposes };
}

const fetchPiege = vi.fn(() => {
  throw new Error("appel réseau réel interdit dans ce test");
});
beforeEach(() => {
  vi.stubGlobal("fetch", fetchPiege);
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchPiege.mockClear();
});

describe("vidéos d'illustration v4 · outil du studio (banques et Claude simulés)", () => {
  it("2 vidéos trouvées pour un duel : 2 medias, 2 fichiers rangés sous videos/, dépense comptée, aucun réseau", async () => {
    const b = banc();
    const plan = planDe([el("dalle-claquee", 1, { mots: ["OUI"] }), el("duel-video", 4, { recherches: ["ordinateur sur un bureau", "équipe en réunion"], illustre: "tout à la main" })]);
    const r = await fournirVideosV4({ videoId: "v-1", plan, mots: MOTS }, b.dep);
    const duel = r.plan.elementsV4![1];
    expect(duel.medias).toEqual(["broll/v4-1-0.mp4", "broll/v4-1-1.mp4"]);
    expect(r.fichiers).toEqual([
      { nom: "v4-1-0.mp4", cle: "studio/dev/facecam-animee/v-1/videos/v4-1-0.mp4" },
      { nom: "v4-1-1.mp4", cle: "studio/dev/facecam-animee/v-1/videos/v4-1-1.mp4" },
    ]);
    expect(plaquettesSansVideo(r.plan)).toEqual([]);
    expect(r.depenseUsd).toBeCloseTo(0.02, 5);
    expect(r.choix?.map((c) => c.fichier)).toEqual(["v4-1-0.mp4", "v4-1-1.mp4"]);
    expect(r.choix?.[0]).toMatchObject({ source: "pexels", licence: "Pexels License" });
    expect(r.manques).toEqual([]);
    expect(fetchPiege).not.toHaveBeenCalled();
    // les autres plaquettes ne sont pas touchées
    expect(r.plan.elementsV4![0]).toEqual(plan.elementsV4![0]);
    // le plan reçu n'est pas modifié
    expect(plan.elementsV4![1].medias).toBeUndefined();
  });

  it("une vidéo refusée par la littéralité : la plaquette reste SANS media (la chaîne la retire), le clip déjà prêt est effacé, jamais remplacé", async () => {
    const b = banc({ verdict: (consigne) => (/équipe/.test(consigne) ? "métaphore" : "littéral") });
    const plan = planDe([el("duel-video", 4, { recherches: ["ordinateur sur un bureau", "équipe en réunion"] })]);
    const r = await fournirVideosV4({ videoId: "v-1", plan, mots: MOTS }, b.dep);
    expect(r.plan.elementsV4![0].medias).toBeUndefined();
    expect(plaquettesSansVideo(r.plan)).toEqual([0]);
    expect(r.fichiers).toEqual([]);
    expect(r.manques.join(" ")).toMatch(/duel-video/);
    expect(b.retires).toContain("studio/dev/facecam-animee/v-1/videos/v4-0-0.mp4");
    expect(fetchPiege).not.toHaveBeenCalled();
  });

  it("si la 1re vidéo d'un duel manque, la 2e n'est même pas cherchée (aucune dépense inutile)", async () => {
    const b = banc({ verdict: (consigne) => (/ordinateur/.test(consigne) ? "hors sujet" : "littéral") });
    const plan = planDe([el("duel-video", 4, { recherches: ["ordinateur sur un bureau", "équipe en réunion"] })]);
    const r = await fournirVideosV4({ videoId: "v-1", plan, mots: MOTS }, b.dep);
    expect(plaquettesSansVideo(r.plan)).toEqual([0]);
    expect(b.controles.length).toBeGreaterThan(0);
    expect(b.controles.some((c) => /équipe/.test(c.consigne))).toBe(false);
  });

  it("une mosaïque de 5 recherches dont 4 trouvées est gardée avec 4 vidéos (recherches alignées sur les medias)", async () => {
    const b = banc({ verdict: (consigne) => (/cinquième/.test(consigne) ? "hors sujet" : "littéral") });
    const plan = planDe([el("MosaiqueVideos", 8, { recherches: ["devis signé", "clavier qui tape", "cinquième scène introuvable", "équipe en réunion", "appel téléphonique"] })]);
    const r = await fournirVideosV4({ videoId: "v-1", plan, mots: MOTS }, b.dep);
    const m = r.plan.elementsV4![0];
    expect(m.medias).toHaveLength(4);
    expect(m.recherches).toEqual(["devis signé", "clavier qui tape", "équipe en réunion", "appel téléphonique"]);
    expect(plaquettesSansVideo(r.plan)).toEqual([]);
  });

  it("une mosaïque qui n'a que 3 recherches pour 4 vidéos au minimum n'est pas cherchée du tout", async () => {
    const b = banc();
    const plan = planDe([el("MosaiqueVideos", 8, { recherches: ["a b", "c d", "e f"] })]);
    const r = await fournirVideosV4({ videoId: "v-1", plan, mots: MOTS }, b.dep);
    expect(b.appelsChercher).toHaveLength(0);
    expect(plaquettesSansVideo(r.plan)).toEqual([0]);
    expect(r.manques[0]).toMatch(/MosaiqueVideos/);
  });

  it("au plus 2 contrôles Claude par recherche (banque + requête) : tout refusé, la recherche passe à l'autre requête puis s'arrête", async () => {
    const b = banc({ verdict: () => "hors sujet" });
    const plan = planDe([el("AvantApres", 4, { recherches: ["homme qui tape à la main"] })]);
    const r = await fournirVideosV4({ videoId: "v-1", plan, mots: MOTS }, b.dep);
    expect(plaquettesSansVideo(r.plan)).toEqual([0]);
    expect(b.controles.length).toBeGreaterThan(0);
    const parCle = new Map<string, number>();
    for (const c of b.controles) parCle.set(c.cle, (parCle.get(c.cle) ?? 0) + 1);
    expect(Math.max(...parCle.values())).toBeLessThanOrEqual(CONTROLES_MAX_PAR_REQUETE);
    expect(CONTROLES_MAX_PAR_REQUETE).toBe(2);
  });

  it("le plafond de 0,60 $ par vidéo finale n'est jamais dépassé (compteur rendu), puis plus aucun contrôle", async () => {
    const b = banc({ verdict: () => "hors sujet", cout: 0.25 });
    const plan = planDe([el("AvantApres", 4, { recherches: ["homme qui tape à la main"] }), el("AvantApres", 12, { recherches: ["facture envoyée"] }), el("AvantApres", 20, { recherches: ["signature d'un contrat"] })]);
    const r = await fournirVideosV4({ videoId: "v-1", plan, mots: MOTS }, b.dep);
    expect(PLAFOND_VIDEOS_USD).toBe(0.6);
    expect(r.depenseUsd!).toBeLessThanOrEqual(PLAFOND_VIDEOS_USD);
    expect(b.controles.length).toBe(2); // 2 x 0,25 = 0,50 ; un 3e (0,75 > 0,60) est refusé d'avance
    expect(plaquettesSansVideo(r.plan)).toEqual([0, 1, 2]);
  });

  it("sans Claude relié (contrôle impossible) : aucune vidéo acceptée à l'aveugle, la plaquette reste sans media", async () => {
    const b = banc();
    b.dep.controler = async () => ({ ok: false, message: "Claude n'est pas relié." });
    const plan = planDe([el("AvantApres", 4, { recherches: ["homme qui tape à la main"] })]);
    const r = await fournirVideosV4({ videoId: "v-1", plan, mots: MOTS }, b.dep);
    expect(plaquettesSansVideo(r.plan)).toEqual([0]);
    expect(r.fichiers).toEqual([]);
  });

  it("deux plaquettes ne reprennent pas la même vidéo de banque", async () => {
    const b = banc({ candidats: 6 });
    const plan = planDe([el("AvantApres", 4, { recherches: ["homme qui tape à la main"] }), el("AvantApres", 14, { recherches: ["homme qui tape à la main"] })]);
    const r = await fournirVideosV4({ videoId: "v-1", plan, mots: MOTS }, b.dep);
    expect(r.choix).toHaveLength(2);
    expect(new Set(r.choix!.map((c) => `${c.source}:${c.id}`)).size).toBe(2);
  });

  it("le contrôle visuel tourne sur le modèle de contrôle du module images (Sonnet), jamais sur Opus ; la simulation ne rend rien (candidat refusé)", () => {
    const role = roleControleVideoV4();
    expect(role.modele).toBe(MODELE_JUGE);
    expect(role.modele).not.toBe(MODELE_ECRITURE);
    expect(role.simuler({ contexte: {}, variable: "" })).toBe("");
  });

  it("le verrou local fait passer les préparations une à une, même si l'une échoue", async () => {
    const ordre: string[] = [];
    const tache = (nom: string, ms: number, echoue = false) => () =>
      new Promise<string>((ok, ko) => {
        ordre.push(`debut-${nom}`);
        setTimeout(() => {
          ordre.push(`fin-${nom}`);
          if (echoue) ko(new Error(nom));
          else ok(nom);
        }, ms);
      });
    const r = await Promise.allSettled([sousVerrouLocalV4(tache("a", 20)), sousVerrouLocalV4(tache("b", 5, true)), sousVerrouLocalV4(tache("c", 1))]);
    expect(ordre).toEqual(["debut-a", "fin-a", "debut-b", "fin-b", "debut-c", "fin-c"]);
    expect(r.map((x) => x.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
  });

  it("ffprobe absent du serveur : une PANNE (« n'a pas pu aboutir »), pas « aucune vidéo fidèle » ; 0 $ dépensé, aucun contrôle Claude", async () => {
    const b = banc();
    const plan = planDe([el("AvantApres", 4, { recherches: ["homme qui tape à la main"] })]);
    const outils: OutilsPreparation = { ...b.dep.preparation, executer: async () => { throw Object.assign(new Error("spawn ffprobe ENOENT"), { code: "ENOENT", syscall: "spawn ffprobe" }); } };
    b.dep.approvisionner = async (p, o) =>
      remplirFenetres(p, {
        ...adaptateurStudio({ chercherVideos: o.chercherVideos }),
        preparerMiniVideo: preparateurMiniVideo(outils),
        verifierMiniVideo: o.verifierMiniVideo,
        historique: o.historique,
        mots: o.mots,
      }) as never;
    const r = await fournirVideosV4({ videoId: "v-1", plan, mots: MOTS }, b.dep);
    // UN seul manque (la panne, en phrase simple), un seul téléchargement : on s'arrête dès la première panne d'outil.
    expect(r.manques).toEqual(["Un outil vidéo manque sur le serveur du studio : aucune vidéo d'illustration n'a pu être préparée."]);
    expect(r.manques[0]).not.toMatch(/ENOENT|ffprobe|aucune vidéo fidèle/);
    expect(b.dossiers).toHaveLength(1);
    expect(r.depenseUsd).toBe(0);
    expect(b.controles).toEqual([]);
  });

  it("les manques sont des phrases françaises simples : jamais le texte brut d'une erreur ni les motifs techniques des refus", async () => {
    const b = banc({ verdict: () => "hors sujet" });
    const plan = planDe([el("AvantApres", 4, { recherches: ["homme qui tape à la main"] }), el("AvantApres", 14, { recherches: ["facture envoyée"] })]);
    const vrai = b.dep.approvisionner!;
    let n = 0;
    b.dep.approvisionner = async (p, o) => {
      if (n++ === 1) throw new Error("ECONNRESET at TLSSocket.onHttpSocketClose node:_http_client:1234");
      return vrai(p, o);
    };
    const r = await fournirVideosV4({ videoId: "v-1", plan, mots: MOTS }, b.dep);
    expect(r.manques.length).toBeGreaterThanOrEqual(2);
    for (const m of r.manques) {
      expect(m).not.toMatch(/ECONNRESET|TLSSocket|node:|pexels|pixabay|hors sujet|refusées|\d{4,}/i);
      expect(m).toMatch(/AvantApres/);
    }
  });

  it("au plus 8 candidats téléchargés par recherche, même quand aucun n'atteint le contrôle Claude (mouvement invisible)", async () => {
    const b = banc({ sansMouvement: true, candidats: 12 });
    const plan = planDe([el("AvantApres", 4, { recherches: ["homme qui tape à la main"] })]);
    const r = await fournirVideosV4({ videoId: "v-1", plan, mots: MOTS }, b.dep);
    expect(plaquettesSansVideo(r.plan)).toEqual([0]);
    expect(b.dossiers.length).toBe(8);
    expect(b.controles).toHaveLength(0);
    expect(r.depenseUsd).toBe(0);
  });
});
