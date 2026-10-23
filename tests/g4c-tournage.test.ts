/**
 * Lot G4c · TOURNAGE (plan v5 B.6 n° 15-16, ligne G4c de B.10). Critère : une séance de 3 scripts « je lis » filmée
 * sur un seul téléphone, 3 prises rangées sous leur code SANS geste de classement.
 * - Domaine pur : texte du téléprompteur horodaté au débit « je lis », défilement, ordre groupé, états, enregistreur.
 * - Parcours simulé : 3 sujets « je lis » écrits en simulation (0 €), validés ; séance ; la caméra est simulée (une
 *   prise = des octets envoyés par le vrai `envoyerFichier`, branché sur les vrais services d'envoi) ; chaque prise
 *   est rangée seule ; une prise ratée est refaite, rien n'est effacé.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";
import {
  DECOMPTE_SEC,
  enregistreur,
  etatSeance,
  etatVersionSeance,
  nomFichierPrise,
  nomPrise,
  ordonnerSeance,
  PAUSE_PHRASE_SEC,
  phrasesPrompteur,
  positionLecture,
  prochaineVersion,
  type EtatEnregistreur,
  type EvenementEnregistreur,
} from "@/domaine/tournage";
import { envoyerFichier } from "@/lib/envoi-multipart";
import type { PrisesVideo } from "@/services/tournage";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const gen = await import("@/services/generateur");
const tournage = await import("@/services/tournage");
const envois = await import("@/services/envois");

const MDP = "essai-g4c-tournage";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
});

/* ------------------------------------------------------------------ */
/* Domaine pur                                                          */
/* ------------------------------------------------------------------ */

describe("G4c · texte du téléprompteur et défilement au débit « je lis »", () => {
  const PROMPTEUR = "1. Une seule erreur de formule, / et tout est faux.\n2. Personne ne relit.\n\n3. Commencez par la liste.";

  it("une phrase par prise, lignes coupées sur « / », horodatées à 2,9 mots/s (+ une courte pause)", () => {
    const { phrases, dureeSec } = phrasesPrompteur(PROMPTEUR, 2.9);
    expect(phrases.map((p) => p.lignes)).toEqual([["Une seule erreur de formule,", "et tout est faux."], ["Personne ne relit."], ["Commencez par la liste."]]);
    expect(phrases.map((p) => p.mots)).toEqual([9, 3, 4]);
    expect(phrases[1].debutSec).toBeCloseTo(9 / 2.9 + PAUSE_PHRASE_SEC, 6);
    expect(dureeSec).toBeCloseTo(16 / 2.9 + 3 * PAUSE_PHRASE_SEC, 6);
  });

  it("position de lecture : phrase en cours et avancement ; la vitesse accélère ou ralentit le défilement ; fin signalée", () => {
    const { phrases, dureeSec } = phrasesPrompteur(PROMPTEUR, 2.9);
    expect(positionLecture(phrases, 0)).toEqual({ index: 0, avancement: 0, fini: false });
    const milieu2 = phrases[1].debutSec + phrases[1].dureeSec / 2;
    expect(positionLecture(phrases, milieu2).index).toBe(1);
    expect(positionLecture(phrases, milieu2).avancement).toBeCloseTo(0.5, 6);
    expect(positionLecture(phrases, milieu2 / 1.3, 1.3).index).toBe(1);
    expect(positionLecture(phrases, milieu2, 0.7).index).toBe(0);
    expect(positionLecture(phrases, milieu2, 5)).toEqual(positionLecture(phrases, milieu2, 1.3)); // vitesse bornée à 1,3
    expect(positionLecture(phrases, dureeSec + 1)).toEqual({ index: 2, avancement: 1, fini: true });
  });
});

describe("G4c · séance : ordre groupé, états, noms des prises", () => {
  it("un groupe par format (même tenue, même décor), dans l'ordre d'arrivée ; numéro puis code dans le groupe", () => {
    const g = ordonnerSeance([
      { id: "a", code: "0043-AV-TT-L", numero: 43, formatId: "avocat", formatNom: "Avocat" },
      { id: "b", code: "0040-PO-LI-L", numero: 40, formatId: "podcast", formatNom: "Podcast" },
      { id: "c", code: "0041-AV-LI-L", numero: 41, formatId: "avocat", formatNom: "Avocat" },
    ]);
    expect(g).toEqual([
      { libelle: "Avocat", varianteIds: ["c", "a"] },
      { libelle: "Podcast", varianteIds: ["b"] },
    ]);
  });

  it("états : à filmer → rangée → ratée (à refaire) → rangée ; prochaine version ; séance terminée", () => {
    const le = "2026-10-03T08:00:00.000Z";
    const s = { varianteIds: ["a", "b"], prises: [] as { varianteId: string; partie: "corps"; videoId?: string; ratee?: boolean; le: string }[] };
    expect(etatSeance(s)).toBe("preparee");
    expect(prochaineVersion(s)).toBe("a");
    s.prises.push({ varianteId: "a", partie: "corps", videoId: "v1", le });
    expect(etatVersionSeance(s.prises, "a")).toBe("rangee");
    expect(prochaineVersion(s)).toBe("b");
    s.prises[0].ratee = true;
    expect(etatVersionSeance(s.prises, "a")).toBe("a-refaire");
    expect(prochaineVersion(s)).toBe("a");
    s.prises.push({ varianteId: "a", partie: "corps", videoId: "v1", le }, { varianteId: "b", partie: "corps", videoId: "v2", le });
    expect(etatSeance(s)).toBe("terminee");
    expect(prochaineVersion(s)).toBeNull();
  });

  it("noms : « 0042-AV-TT-L · prise 2 » ; fichier sans espace, extension selon le format enregistré", () => {
    expect(nomPrise("0042-AV-TT-L", 2)).toBe("0042-AV-TT-L · prise 2");
    expect(nomFichierPrise("0042-AV-TT-L", 2, "video/mp4;codecs=avc1")).toBe("0042-AV-TT-L-prise-2.mp4");
    expect(nomFichierPrise("0042-AV-TT-L", 1, "video/webm")).toBe("0042-AV-TT-L-prise-1.webm");
  });
});

describe("G4c · enregistreur (caméra simulée) : machine d'états", () => {
  const jouer = (evs: EvenementEnregistreur[], depart: EtatEnregistreur = { phase: "camera" }) => evs.reduce(enregistreur, depart);

  it("caméra → prêt → compte à rebours de 3 s → enregistrement ⇄ pause au toucher → relecture → envoi → rangée → suivante", () => {
    let e = jouer([{ type: "camera-ok" }, { type: "demarrer" }]);
    expect(e).toEqual({ phase: "decompte", reste: DECOMPTE_SEC });
    e = jouer([{ type: "tic" }, { type: "tic" }], e);
    expect(e).toEqual({ phase: "decompte", reste: 1 });
    e = jouer([{ type: "tic" }, { type: "temps", sec: 4.2 }, { type: "toucher" }], e);
    expect(e).toEqual({ phase: "pause", depuisSec: 4.2 });
    e = jouer([{ type: "temps", sec: 99 }, { type: "toucher" }, { type: "temps", sec: 12.5 }, { type: "arreter" }], e);
    expect(e).toEqual({ phase: "relecture", dureeSec: 12.5 });
    e = jouer([{ type: "garder" }, { type: "envoyee" }], e);
    expect(e).toEqual({ phase: "rangee" });
    expect(jouer([{ type: "suivante" }], e)).toEqual({ phase: "pret" });
  });

  it("prise ratée → on recommence (prêt) ; échec d'envoi → la prise reste, « Garder » réessaie ; caméra refusée", () => {
    expect(jouer([{ type: "ratee" }], { phase: "relecture", dureeSec: 8 })).toEqual({ phase: "pret" });
    const echec = jouer([{ type: "garder" }, { type: "echec", message: "Réseau coupé" }], { phase: "relecture", dureeSec: 8 });
    expect(echec).toEqual({ phase: "erreur", message: "Réseau coupé", dureeSec: 8 });
    expect(jouer([{ type: "garder" }], echec)).toEqual({ phase: "envoi", dureeSec: 8 });
    expect(jouer([{ type: "camera-refusee" }])).toEqual({ phase: "refusee" });
    // Un geste hors de propos ne fait rien.
    expect(jouer([{ type: "arreter" }, { type: "garder" }, { type: "tic" }], { phase: "pret" })).toEqual({ phase: "pret" });
  });
});

/* ------------------------------------------------------------------ */
/* Parcours simulé : 3 scripts « je lis » filmés sur un seul téléphone   */
/* ------------------------------------------------------------------ */

/** Écrit un sujet « je lis » en simulation (0 €), valide sa limite et ses versions ; renvoie sa 1re version. */
async function versionJeLisValidee(i: number) {
  const s = SUJETS_BANC[i];
  const r = await bg.lancerGeneration({ idee: s.idee, reseaux: s.reseaux, formatId: "avocat", pilier: s.pilier.id, mode: "teleprompteur" });
  if (!r.ok) throw new Error(`lancement ${i} : ${JSON.stringify(r)}`);
  await bg.tourBoucleGeneration();
  const m = await depots().scriptsMaitres.obtenir(r.scriptMaitreId);
  if (m?.exception && !m.exception.valideeParWill) await bg.validerException(r.scriptMaitreId, "c-est-juste");
  const ids = (await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId)).map((v) => v.id);
  await bg.validerVariantes(ids);
  const v = (await depots().variantes.lister((x) => x.scriptMaitreId === r.scriptMaitreId)).sort((a, b) => a.code.localeCompare(b.code))[0];
  expect(v.etat).toBe("validee");
  expect(v.prompteur).toBeTruthy();
  expect(v.code).toMatch(/-L$/);
  return v;
}

/** Caméra simulée : une prise = quelques octets ; ils passent par le VRAI envoi (signature + enregistrement du fichier). */
async function filmer(seanceId: string, code: string, numero: number): Promise<string> {
  const octets = new Uint8Array(2048).fill(numero);
  const fichier = new File([octets], nomFichierPrise(code, numero, "video/webm"), { type: "video/webm", lastModified: 1 });
  const api = async (corps: Record<string, unknown>) => {
    const d = { nom: String(corps.nom), mime: String(corps.mime), taille: Number(corps.taille), typeEntite: String(corps.typeEntite), entiteId: String(corps.entiteId) };
    if (corps.action === "commencer") return { ...(await envois.commencerEnvoi(d)) };
    if (corps.action === "terminer") {
      const f = await envois.terminerEnvoi({ ...d, fichierId: String(corps.fichierId), cle: corps.cle, idEnvoi: corps.idEnvoi, morceaux: corps.morceaux });
      return { fichierId: f.id, statut: f.statut };
    }
    throw new Error(`action inattendue ${String(corps.action)}`);
  };
  const { fichierId } = await envoyerFichier(fichier, { typeEntite: "rush", entiteId: seanceId }, { api, envoyerMorceau: async () => "etag" });
  return fichierId;
}

describe("G4c · séance de 3 scripts « je lis » sur un seul téléphone (critère de fin)", () => {
  it("3 prises rangées sous leur code, sans aucun geste de classement ; rien dans « À ranger »", async () => {
    const aRangerAvant = (await gen.listerVideosARanger()).length;
    const versions = [await versionJeLisValidee(0), await versionJeLisValidee(1), await versionJeLisValidee(2)];
    const aFilmer = await tournage.listerVersionsATourner();
    for (const v of versions) expect(aFilmer.map((x) => x.id)).toContain(v.id);
    expect(aFilmer.find((x) => x.id === versions[0].id)).toMatchObject({ mode: "teleprompteur", formatId: "avocat" });

    const seance = await tournage.creerSeance(versions.map((v) => v.id));
    expect(seance.etat).toBe("preparee");
    expect(seance.groupes).toHaveLength(1); // même format : un seul groupe (même tenue)
    let vue = (await tournage.vueSeance(seance.id))!;
    expect(vue.groupes[0].versions.every((v) => v.etat === "a-filmer" && v.debit === 2.9)).toBe(true);

    // Le téléphone enchaîne : à chaque prise gardée, la suivante vient seule.
    let suivante: string | null = vue.prochaineId;
    const noms: string[] = [];
    while (suivante) {
      const v = vue.groupes.flatMap((g) => g.versions).find((x) => x.id === suivante)!;
      const fichierId = await filmer(seance.id, v.code, 1);
      const r = await tournage.enregistrerPrise({ seanceId: seance.id, varianteId: v.id, fichierId, dureeSec: 21.4 });
      noms.push(r.nom);
      suivante = r.suivanteId;
      vue = (await tournage.vueSeance(seance.id))!;
    }

    expect(noms).toHaveLength(3);
    expect(noms.sort()).toEqual(versions.map((v) => `${v.code} · prise 1`).sort());
    const fin = (await depots().sessionsTournage.obtenir(seance.id))!;
    expect(fin.etat).toBe("terminee");
    expect(fin.prises).toHaveLength(3);
    for (const v of versions) {
      const apres = (await depots().variantes.obtenir(v.id))!;
      expect(apres.videoId).toBeTruthy();
      const video = (await depots().videos.obtenir(apres.videoId!))!;
      expect(video).toMatchObject({ varianteId: v.id, reseau: v.reseau });
      const e = video.entrees as unknown as PrisesVideo;
      expect(e.origine).toBe("tournage");
      const rush = (await depots().rushs.obtenir(e.priseRetenueId!))!;
      expect(rush.nom).toBe(`${v.code} · prise 1`);
      expect(rush.motsCles).toContain(v.code);
      expect(rush.dureeSec).toBe(21.4);
      expect((await depots().fichiers.obtenir(rush.fichierId))?.statut).toBe("pret");
    }
    expect((await gen.listerVideosARanger()).length).toBe(aRangerAvant);
    expect((await tournage.listerVersionsATourner()).filter((x) => versions.some((v) => v.id === x.id))).toEqual([]);
  });

  it("prise ratée → « refaire » : la prise reste (marquée), la suivante va dans la MÊME vidéo ; rejouer une prise ne double rien", async () => {
    const v = await versionJeLisValidee(0);
    const seance = await tournage.creerSeance([v.id]);
    const rushsAvant = await depots().rushs.compter();
    const f1 = await filmer(seance.id, v.code, 1);
    const r1 = await tournage.enregistrerPrise({ seanceId: seance.id, varianteId: v.id, fichierId: f1, dureeSec: 20 });
    expect(r1.suivanteId).toBeNull();
    // Double toucher sur « Garder » : même fichier, rien de plus.
    const bis = await tournage.enregistrerPrise({ seanceId: seance.id, varianteId: v.id, fichierId: f1, dureeSec: 20 });
    expect(bis.rushId).toBe(r1.rushId);
    expect(await depots().rushs.compter()).toBe(rushsAvant + 1);

    await tournage.priseRatee(seance.id, v.id);
    let vue = (await tournage.vueSeance(seance.id))!;
    expect(vue.groupes[0].versions[0]).toMatchObject({ etat: "a-refaire", prises: 1 });
    expect(vue.prochaineId).toBe(v.id);
    expect((await depots().sessionsTournage.obtenir(seance.id))!.etat).toBe("en-cours");

    const f2 = await filmer(seance.id, v.code, 2);
    const r2 = await tournage.enregistrerPrise({ seanceId: seance.id, varianteId: v.id, fichierId: f2, dureeSec: 19 });
    expect(r2.nom).toBe(`${v.code} · prise 2`);
    expect(r2.videoId).toBe(r1.videoId);
    vue = (await tournage.vueSeance(seance.id))!;
    expect(vue.groupes[0].versions[0]).toMatchObject({ etat: "rangee", prises: 2 });

    // Rien n'est effacé : deux prises brutes, la première marquée ratée dans la vidéo.
    expect(await depots().rushs.compter()).toBe(rushsAvant + 2);
    const e = (await depots().videos.obtenir(r1.videoId))!.entrees as unknown as PrisesVideo;
    expect(e.prises.map((p) => !!p.ratee)).toEqual([true, false]);
    expect(e.priseRetenueId).toBe(r2.rushId);
    expect((await depots().sessionsTournage.obtenir(seance.id))!.prises.map((p) => !!p.ratee)).toEqual([true, false]);
  });

  it("refus : version non validée, version sans texte à lire, séance vide, prise hors séance", async () => {
    const v = await versionJeLisValidee(0);
    await expect(tournage.creerSeance([])).rejects.toMatchObject({ code: "SEANCE_VIDE" });
    const avatar = await bg.lancerGeneration({ idee: SUJETS_BANC[1].idee, reseaux: SUJETS_BANC[1].reseaux, formatId: "avocat", pilier: SUJETS_BANC[1].pilier.id, mode: "avatar" });
    if (!avatar.ok) throw new Error("lancement");
    await bg.tourBoucleGeneration();
    const double = (await depots().variantes.lister((x) => x.scriptMaitreId === avatar.scriptMaitreId))[0];
    await expect(tournage.creerSeance([double.id])).rejects.toMatchObject({ code: "PAS_A_FILMER" });
    expect((await tournage.listerVersionsATourner()).some((x) => x.id === double.id)).toBe(false);
    const seance = await tournage.creerSeance([v.id]);
    const f = await filmer(seance.id, v.code, 1);
    await expect(tournage.enregistrerPrise({ seanceId: seance.id, varianteId: double.id, fichierId: f, dureeSec: 3 })).rejects.toMatchObject({ code: "HORS_SEANCE" });
  });
});

describe("G4c · la caméra est permise au studio seul", () => {
  it("Permissions-Policy : camera=(self) (elle était coupée : camera=()), micro inchangé", async () => {
    const config = (await import("../next.config")).default;
    const regles = await config.headers!();
    const valeur = regles.flatMap((r) => r.headers).find((h) => h.key === "Permissions-Policy")?.value;
    expect(valeur).toContain("camera=(self)");
    expect(valeur).toContain("microphone=(self)");
  });
});
