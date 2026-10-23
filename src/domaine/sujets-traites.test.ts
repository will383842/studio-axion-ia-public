import { describe, expect, it } from "vitest";
import {
  chercherPrecedents,
  cleCas,
  cleFichier,
  cleFichierRef,
  clesFichier,
  sujetDeLaVideo,
  type CandidatSujet,
  cleUsine,
  construireRegistre,
  contientMotInterdit,
  filtrerSuggestions,
  lireGarde,
  marquerAttentes,
  CODES_ATTENTE_VALIDATION,
  type TravailRegistre,
  verifierSujet,
  videoCompte,
  type CandidatSuggestion,
  type SujetRegistre,
  type VideoRegistre,
} from "./sujets-traites";

// Expressions bannies, écrites en morceaux pour ne pas les avoir en clair dans le dépôt.
const INTERDIT_A = "Gren" + "oble";
const INTERDIT_B = "Aucun gain " + "garanti";
const MAINTENANT = "2026-10-19T10:00:00.000Z";

function video(id: string, formatId: string, extra: Partial<VideoRegistre> = {}): VideoRegistre {
  return { id, titre: `Vidéo ${id}`, formatId, statut: "prete", creeLe: "2026-10-10T08:00:00.000Z", ...extra };
}
const cas = (casId: string) => ({ casConcret: { casId } });

describe("sujets traités : une vidéo compte-t-elle ?", () => {
  it("compte : en file, en fabrication, prête, maquette", () => {
    for (const statut of ["en_file", "en_fabrication", "prete", "maquette"] as const) expect(videoCompte(video("a", "avocat", { statut }))).toBe(true);
  });
  it("ne compte pas : brouillon, échec, annulée", () => {
    for (const statut of ["brouillon", "echec", "annulee"] as const) expect(videoCompte(video("a", "avocat", { statut }))).toBe(false);
  });
  it("(e) une vidéo de démonstration est ignorée", () => {
    expect(videoCompte(video("a", "avocat", { estDemo: true }))).toBe(false);
  });
  it("archivée : compte selon son statut d'avant l'archivage", () => {
    expect(videoCompte(video("a", "avocat", { statut: "archivee", statutAvantArchive: "prete" }))).toBe(true);
    expect(videoCompte(video("a", "avocat", { statut: "archivee", statutAvantArchive: "brouillon" }))).toBe(false);
    expect(videoCompte(video("a", "avocat", { statut: "archivee" }))).toBe(false);
  });
});

describe("sujets traités : cas cités", () => {
  it("(a) deux vidéos cas concret du même casId : identique", () => {
    const registre = construireRegistre({ videos: [video("v1", "cas-concret", { entrees: cas("recrutement-apporteurs") })] });
    const r = verifierSujet(registre, { generateur: "cas-concret", cles: [cleCas("recrutement-apporteurs")] }, { maintenant: MAINTENANT });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.niveau).toBe("identique");
      expect(r.precedents.map((p) => p.videoId)).toEqual(["v1"]);
      expect(r.precedents[0]!.lien).toBe("/videos/v1");
      expect(r.jeton).toMatch(/^[0-9a-f]{16}$/);
    }
  });

  it("(a bis) un autre cas du catalogue reste libre", () => {
    const registre = construireRegistre({ videos: [video("v1", "cas-concret", { entrees: cas("recrutement-apporteurs") })] });
    expect(verifierSujet(registre, { generateur: "cas-concret", cles: [cleCas("rappels-rendez-vous")] }, { maintenant: MAINTENANT })).toEqual({ ok: true });
  });

  it("(b) deux vidéos tableau de sujets différents : libre", () => {
    const registre = construireRegistre({ videos: [video("t1", "tableau-anime", { sujet: "Relancer les devis non signés automatiquement" })] });
    const r = verifierSujet(registre, { generateur: "tableau-anime", texte: "Préparer le planning des formateurs de la semaine" }, { maintenant: MAINTENANT });
    expect(r).toEqual({ ok: true });
  });

  it("(c) face caméra animée : 1re vidéo en échec, 2e réussie, même prise : seule la 2e compte, et elle se reprend librement", () => {
    const entrees = { facecamAnimee: { fichierId: "f1", priseCle: "studio/x/prise.mp4" } };
    const fichiers = [{ id: "f1", cleStockage: "studio/x/prise.mp4", nom: "Prise A.mp4", taille: 1234, sha256: "ABC123" }];
    const videos = [video("fa1", "facecam-animee", { statut: "echec", entrees }), video("fa2", "facecam-animee", { statut: "prete", entrees })];
    const registre = construireRegistre({ videos, fichiers });
    expect(registre.map((e) => e.videoId)).toEqual(["fa2"]);
    // La 2e est libre quand on la reprend elle-même (réexport, retouche).
    expect(verifierSujet(registre, { generateur: "facecam-animee", cles: [cleFichier({ sha256: "abc123" })!], ignorerVideoId: "fa2" }, { maintenant: MAINTENANT })).toEqual({ ok: true });
    // Une troisième vidéo sur la même prise est refusée : fichier identique.
    const r = verifierSujet(registre, { generateur: "facecam-animee", cles: [cleFichier({ sha256: "abc123" })!] }, { maintenant: MAINTENANT });
    expect(r.ok).toBe(false);
  });

  it("(c bis) 1re vidéo en échec seule : la prise est libre", () => {
    const entrees = { facecamAnimee: { fichierId: "f1" } };
    const registre = construireRegistre({ videos: [video("fa1", "facecam-animee", { statut: "echec", entrees })], fichiers: [{ id: "f1", cleStockage: "k", nom: "p.mp4", taille: 10, sha256: "zz" }] });
    expect(verifierSujet(registre, { generateur: "facecam-animee", cles: ["fichier:zz"] }, { maintenant: MAINTENANT })).toEqual({ ok: true });
  });

  it("(d) image → vidéo archivée abandonnée (brouillon avant l'archivage) : libre ; archivée prête : prise", () => {
    const entrees = { imageVideo: { imageCle: "studio/x/img.png", empreinte: "sha-img" } };
    const abandonnee = construireRegistre({ videos: [video("iv1", "image-video", { statut: "archivee", statutAvantArchive: "brouillon", entrees })] });
    expect(verifierSujet(abandonnee, { generateur: "image-video", cles: ["fichier:sha-img"] }, { maintenant: MAINTENANT })).toEqual({ ok: true });
    const gardee = construireRegistre({ videos: [video("iv2", "image-video", { statut: "archivee", statutAvantArchive: "prete", entrees })] });
    expect(verifierSujet(gardee, { generateur: "image-video", cles: ["fichier:sha-img"] }, { maintenant: MAINTENANT }).ok).toBe(false);
  });

  it("(e) une vidéo de démonstration ne prend aucun sujet", () => {
    const registre = construireRegistre({ videos: [video("d1", "cas-concret", { estDemo: true, entrees: cas("recrutement-apporteurs") })] });
    expect(registre).toEqual([]);
  });

  it("(f) une vidéo supprimée (absente des lectures) n'est pas dans le registre : le sujet est libre", () => {
    const avant = construireRegistre({ videos: [video("v1", "cas-concret", { entrees: cas("recrutement-apporteurs") })] });
    expect(avant).toHaveLength(1);
    const apres = construireRegistre({ videos: [] });
    expect(verifierSujet(apres, { generateur: "cas-concret", cles: [cleCas("recrutement-apporteurs")] }, { maintenant: MAINTENANT })).toEqual({ ok: true });
  });

  it("(g) la reprise de la même vidéo n'est pas contrôlée", () => {
    const registre = construireRegistre({ videos: [video("v1", "cas-concret", { entrees: cas("recrutement-apporteurs") })] });
    const base = { generateur: "cas-concret", cles: [cleCas("recrutement-apporteurs")] };
    expect(verifierSujet(registre, { ...base, ignorerVideoId: "v1" }, { maintenant: MAINTENANT })).toEqual({ ok: true });
    expect(verifierSujet(registre, { ...base, estReprise: true }, { maintenant: MAINTENANT })).toEqual({ ok: true });
  });
});

describe("sujets traités : chaîne centrale", () => {
  const sujet: SujetRegistre = { id: "m1", numero: 1, creeLe: "2026-10-05T08:00:00.000Z", idee: "Le diagnostic fuite", formatId: "avocat" };

  it("(h) « Le diagnostic fuite » déjà traité en n° 1 : refus sans jeton, accepté avec le bon jeton, refusé avec un jeton périmé", () => {
    const registre = construireRegistre({ videos: [], sujets: [sujet] });
    expect(registre).toHaveLength(1);
    expect(registre[0]!.lien).toBe("/scripts/m1");
    const candidat = { generateur: "avocat", texte: "Le diagnostic fuite" };
    const refus = verifierSujet(registre, candidat, { maintenant: MAINTENANT, suggestions: () => [{ titre: "A", source: "usine" }, { titre: "B", source: "usine" }, { titre: "C", source: "usine" }, { titre: "D", source: "usine" }] });
    expect(refus.ok).toBe(false);
    if (refus.ok) return;
    expect(refus.niveau).toBe("proche");
    expect(refus.suggestions).toHaveLength(3);
    const accepte = verifierSujet(registre, candidat, { maintenant: MAINTENANT, confirmation: { choix: "refaire", jeton: refus.jeton } });
    expect(accepte).toEqual({ ok: true, confirme: "refaire" });
    // Un second sujet proche est apparu entre la demande et la confirmation : le jeton de la demande est périmé.
    const apres = construireRegistre({ videos: [], sujets: [sujet, { ...sujet, id: "m2", numero: 2, creeLe: "2026-10-08T08:00:00.000Z" }] });
    const perime = verifierSujet(apres, candidat, { maintenant: MAINTENANT, confirmation: { choix: "nouvel-angle", jeton: refus.jeton } });
    expect(perime.ok).toBe(false);
    if (!perime.ok) expect(perime.jetonPerime).toBe(true);
  });

  it("le sujet devenu vidéo n'est compté qu'une fois, et son code Usine devient une clé identique", () => {
    const m: SujetRegistre = { ...sujet, codeCasUsage: "dirigeant.devis.c01" };
    const registre = construireRegistre({
      videos: [video("v9", "avocat", { scriptId: "s9" })],
      sujets: [m],
      sujetDuScript: new Map([["s9", "m1"]]),
    });
    expect(registre).toHaveLength(1);
    expect(registre[0]!.videoId).toBe("v9");
    const r = verifierSujet(registre, { generateur: "avocat", cles: [cleUsine("dirigeant.devis.c01")] }, { maintenant: MAINTENANT });
    expect(r.ok === false && r.niveau).toBe("identique");
  });

  it("un sujet de démonstration (n° 9000 et plus) ou archivé ne compte pas", () => {
    const registre = construireRegistre({ videos: [], sujets: [{ ...sujet, numero: 9001 }, { ...sujet, id: "m2", archiveLe: "2026-10-06T00:00:00.000Z" }, { ...sujet, id: "m3", numero: undefined }] });
    expect(registre).toEqual([]);
  });

  it("un thème proche hors fenêtre de 180 jours est libre", () => {
    const vieux = construireRegistre({ videos: [], sujets: [{ ...sujet, creeLe: "2026-01-01T00:00:00.000Z" }] });
    expect(chercherPrecedents(vieux, { generateur: "avocat", texte: "Le diagnostic fuite" }, MAINTENANT)).toEqual([]);
  });
});

describe("sujets traités : (i) autre générateur", () => {
  it("un sujet traité dans un autre générateur prévient seulement", () => {
    const registre = construireRegistre({ videos: [video("v1", "cas-concret", { entrees: cas("recrutement-apporteurs") })] });
    const r = verifierSujet(registre, { generateur: "avocat", cles: [cleCas("recrutement-apporteurs")] }, { maintenant: MAINTENANT });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.avertissement?.niveau).toBe("identique");
      expect(r.avertissement?.precedents.map((p) => p.videoId)).toEqual(["v1"]);
    }
  });
});

describe("sujets traités : réglage et clés", () => {
  it("« avertissement » ne bloque pas, « eteint » ne dit rien, une valeur inconnue vaut « bloquant »", () => {
    const registre = construireRegistre({ videos: [video("v1", "cas-concret", { entrees: cas("x") })] });
    const c = { generateur: "cas-concret", cles: [cleCas("x")] };
    expect(verifierSujet(registre, c, { maintenant: MAINTENANT, garde: "avertissement" }).ok).toBe(true);
    expect(verifierSujet(registre, c, { maintenant: MAINTENANT, garde: "eteint" })).toEqual({ ok: true });
    expect(verifierSujet(registre, c, { maintenant: MAINTENANT, garde: lireGarde("n'importe quoi") }).ok).toBe(false);
  });

  it("cleFichier : empreinte, sinon nom normalisé + taille, sinon rien", () => {
    expect(cleFichier({ sha256: " AB12 ", nom: "x", taille: 1 })).toBe("fichier:ab12");
    expect(cleFichier({ nom: "  Prise  Été.MP4 ", taille: 99 })).toBe("fichier:prise ete mp4#99");
    expect(cleFichier({ nom: "x" })).toBeUndefined();
  });

  it("le jeton change quand une vidéo précédente apparaît", () => {
    const c = { generateur: "cas-concret", cles: [cleCas("x")] };
    const un = construireRegistre({ videos: [video("v1", "cas-concret", { entrees: cas("x") })] });
    const deux = construireRegistre({ videos: [video("v1", "cas-concret", { entrees: cas("x") }), video("v2", "cas-concret", { entrees: cas("x") })] });
    const a = verifierSujet(un, c, { maintenant: MAINTENANT });
    const b = verifierSujet(deux, c, { maintenant: MAINTENANT });
    expect(a.ok === false && b.ok === false && a.jeton !== b.jeton).toBe(true);
  });
});

describe("sujets traités : suggestions", () => {
  const registre = construireRegistre({ videos: [video("v1", "avocat", { titre: "Les devis non signés se relancent", sujet: "Les devis non signés se relancent", entrees: {} })] });
  const candidats: CandidatSuggestion[] = [
    { titre: "Les devis non signés se relancent", code: "a.1", source: "usine" },
    { titre: "Relance des factures impayées", code: "a.2", source: "usine" },
    { titre: "Relance des factures impayées", code: "a.3", source: "usine" },
    { titre: `Une équipe à ${INTERDIT_A}`, code: "a.4", source: "usine" },
    { titre: "Sans risque", code: "a.5", source: "usine", textes: [`${INTERDIT_B} pour vous`] },
    { titre: "Trier les CV reçus", code: "a.6", source: "usine" },
    { titre: "Compte rendu de visio", code: "a.7", source: "usine" },
    { titre: "Agenda des rendez-vous", code: "a.8", source: "usine" },
  ];

  it("écarte le déjà traité, les doublons de titre et les mots interdits ; trois au plus", () => {
    const s = filtrerSuggestions(candidats, registre, "avocat", MAINTENANT);
    expect(s.map((x) => x.titre)).toEqual(["Relance des factures impayées", "Trier les CV reçus", "Compte rendu de visio"]);
  });

  it("écarte un code Usine déjà pris", () => {
    const pris = construireRegistre({ videos: [video("v1", "avocat", { scriptId: "s" })], sujets: [{ id: "m", numero: 2, creeLe: "2026-10-01T00:00:00.000Z", idee: "Autre chose", formatId: "avocat", codeCasUsage: "a.2" }], sujetDuScript: { s: "m" } });
    const s = filtrerSuggestions(candidats, pris, "avocat", MAINTENANT, 10);
    expect(s.some((x) => x.code === "a.2")).toBe(false);
  });

  it("détecte les mots interdits sans tenir compte des accents ni de la casse", () => {
    expect(contientMotInterdit(INTERDIT_A.toUpperCase())).toBe(true);
    expect(contientMotInterdit("aucun  gain   " + "garanti")).toBe(true);
    expect(contientMotInterdit("Partout en France")).toBe(false);
  });
});

describe("sujets traités : corrections de la relecture", () => {
  const m = (id: string, version: number, extra: Partial<SujetRegistre> = {}): SujetRegistre => ({ id, numero: 7, version, creeLe: `2026-10-0${version}T08:00:00.000Z`, idee: `Le diagnostic fuite v${version}`, formatId: "avocat", ...extra });
  const ok = (registre: ReturnType<typeof construireRegistre>, candidat: CandidatSujet): boolean => verifierSujet(registre, candidat, { maintenant: MAINTENANT }).ok;

  it("plusieurs versions d'un sujet (même numéro) : une seule entrée, la dernière version", () => {
    const registre = construireRegistre({ videos: [], sujets: [m("m1", 1), m("m2", 2), m("m3", 3)] });
    expect(registre).toHaveLength(1);
    expect(registre[0]!.sujetId).toBe("m3");
    expect(registre[0]!.sujetIds).toEqual(["m3", "m2", "m1"]);
  });

  it("une vidéo qui porte une ancienne version couvre tout le numéro : pas d'entrée en double", () => {
    const registre = construireRegistre({ videos: [video("v1", "avocat", { scriptId: "s1" })], sujets: [m("m1", 1), m("m2", 2)], sujetDuScript: { s1: "m1" } });
    expect(registre.map((e) => e.id)).toEqual(["v1"]);
  });

  it("ignorerSujetId et ignorerNumero couvrent toutes les versions du numéro", () => {
    const registre = construireRegistre({ videos: [], sujets: [m("m1", 1), m("m2", 2)] });
    const base = { generateur: "avocat", texte: "Le diagnostic fuite" };
    expect(ok(registre, { ...base, ignorerSujetId: "m1" })).toBe(true);
    expect(ok(registre, { ...base, ignorerNumero: 7 })).toBe(true);
    expect(ok(registre, { ...base, ignorerNumero: 8 })).toBe(false);
  });

  it("relance après échec : la vidéo en échec n'est pas bloquée par son propre sujet numéroté", () => {
    const sources = { videos: [video("v1", "avocat", { statut: "echec", scriptId: "s1" })], sujets: [m("m1", 1)], sujetDuScript: { s1: "m1" } };
    const registre = construireRegistre(sources);
    expect(registre.map((e) => e.sujetId)).toEqual(["m1"]);
    const candidat = { generateur: "avocat", texte: "Le diagnostic fuite", ignorerVideoId: "v1" };
    expect(ok(registre, candidat)).toBe(false);
    const propre = sujetDeLaVideo(sources, "v1");
    expect(propre).toEqual({ sujetId: "m1", numero: 7 });
    expect(ok(registre, { ...candidat, ignorerNumero: propre!.numero })).toBe(true);
  });

  it("liste `ignorerVideoIds` : toutes les vidéos listées sont écartées, pas les autres ; l'ancien `ignorerVideoId` marche toujours", () => {
    const registre = construireRegistre({ videos: [video("v1", "cas-concret", { entrees: cas("recrutement-apporteurs") }), video("v2", "cas-concret", { entrees: cas("recrutement-apporteurs") }), video("v3", "cas-concret", { entrees: cas("recrutement-apporteurs") })] });
    const c = { generateur: "cas-concret", cles: [cleCas("recrutement-apporteurs")] };
    expect(ok(registre, { ...c, ignorerVideoIds: ["v1", "v2"] })).toBe(false);
    expect(ok(registre, { ...c, ignorerVideoIds: ["v1", "v2", "v3"] })).toBe(true);
    expect(ok(registre, { ...c, ignorerVideoId: "v1", ignorerVideoIds: ["v2", "v3"] })).toBe(true);
    expect(ok(registre, { ...c, ignorerVideoIds: [] })).toBe(false);
  });

  it("repli fichier:ref : une prise sans fichier connu reste reconnue par sa référence", () => {
    const entrees = { facecamAnimee: { fichierId: "f9", priseCle: "studio/x/p.mp4" } };
    const registre = construireRegistre({ videos: [video("fa1", "facecam-animee", { entrees })] });
    expect(ok(registre, { generateur: "facecam-animee", cles: [cleFichierRef("f9")] })).toBe(false);
    expect(ok(registre, { generateur: "facecam-animee", cles: [cleFichierRef("studio/x/p.mp4")] })).toBe(false);
  });

  it("mélange sha256 / nom + taille : les deux clés sont produites, un renommage ou un sha manquant ne contourne rien", () => {
    const fichiers = [{ id: "f1", cleStockage: "k1", nom: "Prise A.mp4", taille: 500, sha256: "AA" }];
    const registre = construireRegistre({ videos: [video("iv1", "image-video", { entrees: { imageVideo: { imageCle: "k1" } } })], fichiers });
    expect(registre[0]!.cles).toEqual(expect.arrayContaining(["fichier:aa", "fichier:prise a mp4#500"]));
    for (const cle of clesFichier({ sha256: "aa" })) expect(ok(registre, { generateur: "image-video", cles: [cle] })).toBe(false);
    for (const cle of clesFichier({ nom: "prise a.MP4", taille: 500 })) expect(ok(registre, { generateur: "image-video", cles: [cle] })).toBe(false);
  });

  it("« proche » trouvé sur une entrée VIDÉO (pas seulement un sujet central)", () => {
    const registre = construireRegistre({ videos: [video("t1", "tableau-anime", { sujet: "Relancer les devis non signés automatiquement" })] });
    const r = verifierSujet(registre, { generateur: "tableau-anime", texte: "Relancer automatiquement les devis non signés" }, { maintenant: MAINTENANT });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.niveau).toBe("proche");
      expect(r.precedents[0]!.videoId).toBe("t1");
    }
  });

  describe("« proche » comparé aussi au TITRE de la vidéo précédente", () => {
    const SUJET_GESTE = "Rédiger un devis à partir d'un modèle";
    const TITRE = "Combien de temps perdez-vous sur chaque devis ?";
    const tableau = (extra: Partial<VideoRegistre> = {}) => construireRegistre({ videos: [video("t1", "tableau-anime", { sujet: SUJET_GESTE, titre: TITRE, ...extra })] });

    it("retaper le titre affiché d'une vidéo faite est « proche »", () => {
      const r = verifierSujet(tableau(), { generateur: "tableau-anime", texte: TITRE }, { maintenant: MAINTENANT });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.niveau).toBe("proche");
        expect(r.precedents[0]!.videoId).toBe("t1");
      }
    });
    it("le sujet interne (geste) reste reconnu", () => {
      expect(chercherPrecedents(tableau(), { generateur: "tableau-anime", texte: SUJET_GESTE }, MAINTENANT)).toHaveLength(1);
    });
    it("une demande sans rapport n'est pas « proche »", () => {
      expect(chercherPrecedents(tableau(), { generateur: "tableau-anime", texte: "Trier les CV reçus chaque matin" }, MAINTENANT)).toHaveLength(0);
    });
    it("un titre court ou générique (une seule racine) ne rend pas « proche » toute demande qui contient ce mot", () => {
      const registre = construireRegistre({ videos: [video("t2", "tableau-anime", { sujet: "Facturer les clients", titre: "Devis" })] });
      expect(chercherPrecedents(registre, { generateur: "tableau-anime", texte: "Relancer les devis impayés" }, MAINTENANT)).toHaveLength(0);
    });
    it("D1 : une vidéo d'un AUTRE générateur retrouvée par son seul titre prévient sans bloquer", () => {
      const registre = construireRegistre({ videos: [video("a1", "avocat", { sujet: "Rédiger un devis à partir d'un modèle", titre: TITRE })] });
      const r = verifierSujet(registre, { generateur: "tableau-anime", texte: TITRE }, { maintenant: MAINTENANT });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.avertissement?.precedents[0]!.videoId).toBe("a1");
    });
    it("cas concret ou image→vidéo AVEC clé : le titre d'une vidéo identique au texte ne bloque pas", () => {
      const registre = construireRegistre({ videos: [video("c1", "cas-concret", { titre: TITRE, sujet: TITRE, ...cas("autre-cas") })] });
      expect(verifierSujet(registre, { generateur: "cas-concret", cles: [cleCas("nouveau-cas")], texte: TITRE }, { maintenant: MAINTENANT })).toEqual({ ok: true });
      const iv = construireRegistre({ videos: [video("i1", "image-video", { titre: TITRE, entrees: { imageVideo: { imageCle: "k1" } } })] });
      expect(verifierSujet(iv, { generateur: "image-video", cles: [cleFichier({ sha256: "zz" })!], texte: TITRE }, { maintenant: MAINTENANT })).toEqual({ ok: true });
    });
  });

  it("générateur à clé exacte : avec sa clé, le texte ne crée pas de « proche »", () => {
    const registre = construireRegistre({ videos: [video("v1", "cas-concret", { titre: "Recruter des apporteurs", entrees: cas("recrutement-apporteurs") })] });
    expect(verifierSujet(registre, { generateur: "cas-concret", cles: [cleCas("autre")], texte: "Recruter des apporteurs" }, { maintenant: MAINTENANT })).toEqual({ ok: true });
  });

  it("vrai jeton périmé : une vidéo apparue entre la demande et la confirmation", () => {
    const un = construireRegistre({ videos: [video("v1", "cas-concret", { entrees: cas("x") })] });
    const c = { generateur: "cas-concret", cles: [cleCas("x")] };
    const refus = verifierSujet(un, c, { maintenant: MAINTENANT });
    if (refus.ok) throw new Error("refus attendu");
    const deux = construireRegistre({ videos: [video("v1", "cas-concret", { entrees: cas("x") }), video("v2", "cas-concret", { entrees: cas("x") })] });
    const r = verifierSujet(deux, c, { maintenant: MAINTENANT, confirmation: { choix: "refaire", jeton: refus.jeton } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.jetonPerime).toBe(true);
  });

  it("le jeton est lié au candidat : celui d'un autre texte ne passe pas", () => {
    const registre = construireRegistre({ videos: [video("t1", "tableau-anime", { sujet: "Relancer les devis non signés" })] });
    const a = verifierSujet(registre, { generateur: "tableau-anime", texte: "Relancer les devis non signés" }, { maintenant: MAINTENANT });
    if (a.ok) throw new Error("refus attendu");
    const b = verifierSujet(registre, { generateur: "tableau-anime", texte: "Les devis non signés à relancer" }, { maintenant: MAINTENANT, confirmation: { choix: "refaire", jeton: a.jeton } });
    expect(b.ok).toBe(false);
  });

  it("une vidéo dérivée dont la mère compte est exclue ; orpheline ou à mère qui ne compte pas, elle compte", () => {
    const mere = video("v0", "avocat");
    const fille = video("d1", "avocat", { sourceVideoId: "v0", typeDerive: "variante-reseau" });
    expect(construireRegistre({ videos: [mere, fille] }).map((e) => e.id)).toEqual(["v0"]);
    const orpheline = video("d2", "avocat", { typeDerive: "variante-accroche" });
    expect(construireRegistre({ videos: [orpheline] }).map((e) => e.id)).toEqual(["d2"]);
    const mereEnEchec = video("v0", "avocat", { statut: "echec" });
    expect(construireRegistre({ videos: [mereEnEchec, fille] }).map((e) => e.id)).toEqual(["d1"]);
  });

  it("deux fichiers de même nom et taille mais d'empreintes différentes connues ne se joignent pas", () => {
    const fichiers = [{ id: "f1", cleStockage: "k1", nom: "Prise.mp4", taille: 500, sha256: "aa" }];
    const registre = construireRegistre({ videos: [video("iv1", "image-video", { entrees: { imageVideo: { imageCle: "k1" } } })], fichiers });
    const nomTaille = "fichier:prise mp4#500";
    expect(ok(registre, { generateur: "image-video", cles: [nomTaille, "fichier:bb"] })).toBe(true);
    expect(ok(registre, { generateur: "image-video", cles: [nomTaille, "fichier:aa"] })).toBe(false);
    // Sans empreinte côté candidat, nom + taille suffit encore.
    expect(ok(registre, { generateur: "image-video", cles: [nomTaille] })).toBe(false);
  });

  it("date de création illisible : le « proche » fonctionne quand même", () => {
    const registre = construireRegistre({ videos: [video("t1", "tableau-anime", { creeLe: "", sujet: "Relancer les devis non signés" })] });
    expect(ok(registre, { generateur: "tableau-anime", texte: "Relancer les devis non signés" })).toBe(false);
  });

  it("une autre vidéo prête sur le même numéro continue de bloquer la relance d'une vidéo en échec", () => {
    const sources = {
      videos: [video("v1", "avocat", { statut: "echec", scriptId: "s1" }), video("v2", "avocat", { scriptId: "s2" })],
      sujets: [m("m1", 1)],
      sujetDuScript: { s1: "m1", s2: "m1" },
    };
    const registre = construireRegistre(sources);
    const base = { generateur: "avocat", texte: "Le diagnostic fuite", ignorerVideoId: "v1", ignorerEntreeSujetNumero: 7 };
    expect(ok(registre, base)).toBe(false);
    // Seule v1 en échec : son sujet central n'a pas d'autre porteur, la relance passe.
    const seule = construireRegistre({ ...sources, videos: [sources.videos[0]!] });
    expect(ok(seule, base)).toBe(true);
  });

  it("verrouille le numéro factice du « proche » : une entrée vidéo sans numéro de sujet est bien comparée", () => {
    const registre = construireRegistre({ videos: [video("t1", "avocat", { sujet: "Le diagnostic fuite" })] });
    expect(chercherPrecedents(registre, { generateur: "avocat", texte: "Le diagnostic fuite" }, MAINTENANT)).toHaveLength(1);
  });
});

describe("sujets traités : pauses « à valider » (échec qui attend Will)", () => {
  const enPause = (extra: Partial<VideoRegistre> = {}) => video("p", "image-video", { statut: "echec", enAttenteValidation: true, ...extra });

  it("(a) un échec compte avec le champ, pas sans", () => {
    expect(videoCompte(enPause())).toBe(true);
    expect(videoCompte(video("p", "image-video", { statut: "echec" }))).toBe(false);
    expect(videoCompte(video("p", "image-video", { statut: "echec", enAttenteValidation: false }))).toBe(false);
  });
  it("(b) corbeille : compte si le statut d'avant l'archivage était l'échec en pause", () => {
    expect(videoCompte(enPause({ statut: "archivee", statutAvantArchive: "echec" }))).toBe(true);
    expect(videoCompte(video("p", "image-video", { statut: "archivee", statutAvantArchive: "echec" }))).toBe(false);
  });
  it("(c) une démonstration en pause ne compte pas", () => {
    expect(videoCompte(enPause({ estDemo: true }))).toBe(false);
  });
  it("(d) brouillon et annulée ne comptent pas, même avec le champ", () => {
    expect(videoCompte(enPause({ statut: "brouillon" }))).toBe(false);
    expect(videoCompte(enPause({ statut: "annulee" }))).toBe(false);
  });

  const travail = (extra: Partial<TravailRegistre> = {}): TravailRegistre => ({ cibleId: "p", type: "fabrication", statut: "echec", creeLe: "2026-10-19T08:00:00.000Z", erreur: { code: "IV_CARTE_A_VALIDER" }, ...extra });
  const marque = (t: TravailRegistre[], v = video("p", "image-video", { statut: "echec" })) => marquerAttentes([v], t)[0]!.enAttenteValidation;

  it("(e) marquerAttentes : chaque code de pause pose le champ", () => {
    for (const code of CODES_ATTENTE_VALIDATION) expect(marque([travail({ erreur: { code } })])).toBe(true);
  });
  it("(e) le code lu sur l'étape en échec compte aussi", () => {
    expect(marque([travail({ erreur: undefined, etapes: [{ statut: "terminee" }, { statut: "echec", erreur: { code: "IV_SCRIPT_A_VALIDER" } }] })])).toBe(true);
  });
  it("(e) pas de champ : voix en panne, type à choisir, travail annulé ou en cours, sans code", () => {
    expect(marque([travail({ erreur: { code: "IV_VOIX" } })])).toBeUndefined();
    expect(marque([travail({ erreur: { code: "IV_TYPE_A_CHOISIR" } })])).toBeUndefined();
    expect(marque([travail({ statut: "annule" })])).toBeUndefined();
    expect(marque([travail({ statut: "en_cours" })])).toBeUndefined();
    expect(marque([travail({ erreur: undefined })])).toBeUndefined();
    expect(marque([])).toBeUndefined();
  });
  it("(e) seul le DERNIER travail compte : une pause suivie d'une vraie panne n'est plus une pause", () => {
    const pause = travail();
    const panne = travail({ creeLe: "2026-10-19T09:00:00.000Z", erreur: { code: "IV_VOIX" } });
    expect(marque([pause, panne])).toBeUndefined();
    expect(marque([panne, pause])).toBeUndefined();
    expect(marque([travail({ creeLe: "2026-10-19T07:00:00.000Z", erreur: { code: "IV_VOIX" } }), pause])).toBe(true);
  });
  it("(e) un réexport plus récent est ignoré ; un autre travail d'une autre vidéo aussi", () => {
    expect(marque([travail(), travail({ type: "reexport", creeLe: "2026-10-19T12:00:00.000Z", erreur: { code: "X" } })])).toBe(true);
    expect(marque([travail({ cibleId: "autre" })])).toBeUndefined();
  });
  it("(e) un travail sans date ne lève pas ; le plus récent l'emporte, puis modifieLe, puis id", () => {
    const sansDate = { ...travail(), creeLe: undefined } as unknown as TravailRegistre;
    expect(() => marque([sansDate, travail({ erreur: { code: "IV_VOIX" } })])).not.toThrow();
    expect(marque([sansDate])).toBe(true);
    expect(marque([sansDate, travail({ erreur: { code: "IV_VOIX" } })])).toBeUndefined();
    expect(marque([travail({ modifieLe: "2026-10-19T09:00:00.000Z", erreur: { code: "IV_VOIX" } }), travail({ modifieLe: "2026-10-19T08:00:00.000Z" })])).toBeUndefined();
    expect(marque([travail({ id: "b", erreur: { code: "IV_VOIX" } }), travail({ id: "a" })])).toBeUndefined();
  });
  it("(e) vidéo prête ou autre statut : inchangée", () => {
    const prete = video("p", "image-video");
    expect(marquerAttentes([prete], [travail()])[0]).toBe(prete);
  });
  it("(e) vidéo archivée dont l'échec était une pause : marquée", () => {
    expect(marque([travail()], video("p", "image-video", { statut: "archivee", statutAvantArchive: "echec" }))).toBe(true);
  });

  it("(g) une vidéo image→vidéo en pause avec empreinte prend la clé fichier:<sha>", () => {
    const v = enPause({ entrees: { imageVideo: { empreinte: "ABC" } } });
    const registre = construireRegistre({ videos: [v] });
    expect(registre).toHaveLength(1);
    expect(registre[0]!.cles).toContain("fichier:abc");
  });
});
