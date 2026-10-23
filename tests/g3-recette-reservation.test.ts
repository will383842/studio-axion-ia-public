/**
 * LOT G3 — recette avocat v4 corrigée par l'addendum du 02/10 (données), paramètres du générateur par format, et
 * RÉSERVATION du choix conjoint sous `sousVerrou` (deux lancements d'affilée sans combinaison identique ; arrêts à 0 €
 * sans numéro ; réservation libérée).
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { M, P } from "./helpers/g3";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const gen = await import("@/services/generateur");
const choix = await import("@/services/choix-generateur");
import { SEUIL_ECART_TYPE_RYTHME } from "@/domaine/controles-script";
import { parametresGenerateur } from "@/donnees/generateur/parametres-generateur";
import {
  APPELS_PAR_OBJECTIF_AVOCAT,
  BIBLIOTHEQUE_ACCROCHES_AVOCAT,
  FORMULES_APAISEMENT_AVOCAT,
  FORMULES_EXCEPTION_AVOCAT,
  PLAFONDS_AVOCAT,
  STRUCTURES_AVOCAT,
  VERSION_RECETTE_AVOCAT,
  VIDEOS_MODELES_AVOCAT,
} from "@/donnees/generateur/recette-avocat-v4";

describe("recette avocat v4 (addendum du 02/10, qui prime)", () => {
  it("version de recette 4", () => expect(VERSION_RECETTE_AVOCAT).toBe(4));
  it("accroche ≤ 5 s et ≤ 20 mots (point 1)", () => expect([PLAFONDS_AVOCAT.accrocheMaxSec, PLAFONDS_AVOCAT.accrocheMaxMots]).toEqual([5, 20]));
  it("appel facultatif, 5 à 47 mots (point 7)", () => expect([PLAFONDS_AVOCAT.appelFacultatif, PLAFONDS_AVOCAT.appelMinMots, PLAFONDS_AVOCAT.appelMaxMots]).toEqual([true, 5, 47]));
  it("exception facultative (point 6), formules réellement dites en tête de rotation", () => {
    expect(PLAFONDS_AVOCAT.exceptionObligatoire).toBe(false);
    expect(FORMULES_EXCEPTION_AVOCAT.slice(0, 3)).toEqual(["à moins que", "En revanche", "Par contre"]);
  });
  it("apaisement : jamais « Rassurez-vous », « Pas de panique », « Pas d'affolement » (point 3)", () => {
    expect(FORMULES_APAISEMENT_AVOCAT.join(" ")).not.toMatch(/rassurez|panique|affolement/i);
    expect(FORMULES_APAISEMENT_AVOCAT).toContain("Ne restez pas seul");
  });
  it("S1 ouvre sur une affirmation, avec « geste OU verdict » avant 5 s (points 2 et 4)", () => {
    const s1 = STRUCTURES_AVOCAT.find((s) => s.id === "AV.S1")!;
    expect(s1.ouvertureAffirmative).toBe(true);
    expect(s1.temps.find((t) => t.id === "geste-ou-verdict")?.avantSec).toBe(5);
  });
  it("S10 « la règle cachée » existe et se tire (point 10) ; S6 à S9 attendent leur banc", () => {
    expect(STRUCTURES_AVOCAT.find((s) => s.id === "AV.S10")?.tirable).toBe(true);
    expect(STRUCTURES_AVOCAT.filter((s) => !s.tirable).map((s) => s.id)).toEqual(["AV.S6", "AV.S7", "AV.S8", "AV.S9"]);
  });
  it("chaque structure déclare ses exigences ; S3 exige l'accord, S5 une question reçue", () => {
    for (const s of STRUCTURES_AVOCAT) expect(s.temps.length + s.appui.length).toBeGreaterThan(0);
    expect(STRUCTURES_AVOCAT.find((s) => s.id === "AV.S3")?.accordRequis).toBe(true);
    expect(STRUCTURES_AVOCAT.find((s) => s.id === "AV.S5")?.typesAncrage).toEqual(["question-recue"]);
  });
  it("bibliothèque d'accroches : identifiants uniques, modèles au vouvoiement, situation à l'affirmatif", () => {
    const ids = BIBLIOTHEQUE_ACCROCHES_AVOCAT.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(["situation-spectateur", "dementi", "chiffre-choc", "aveu-de-cout", "milieu-action", "contre-intuitif", "cible-nommee", "question-client", "mise-en-garde-destinataire", "question", "avant-apres", "resultat-dabord", "reponse-commentaire", "verdict-expert"]));
    expect(BIBLIOTHEQUE_ACCROCHES_AVOCAT.find((l) => l.id === "situation-spectateur")?.modele).not.toMatch(/\?$/);
    for (const l of BIBLIOTHEQUE_ACCROCHES_AVOCAT) expect(l.modele).not.toMatch(/\b(tu|ton|ta|tes)\b/);
  });
  it("table objectif × réseau v5 : « faire partager » donne l'envoi sur LinkedIn et Facebook", () => {
    expect(APPELS_PAR_OBJECTIF_AVOCAT.notoriete.linkedin).toBe("envoi");
    expect(APPELS_PAR_OBJECTIF_AVOCAT.notoriete.facebook).toBe("envoi");
    expect(APPELS_PAR_OBJECTIF_AVOCAT["rendez-vous"].linkedin).toBe("diagnostic");
  });
  it("vidéos modèles du lot GR rattachées aux structures", () => expect(VIDEOS_MODELES_AVOCAT.every((v) => STRUCTURES_AVOCAT.some((s) => s.id === v.structure))).toBe(true));
  it("seuil de C9 provisoire : 2,5 mots (recalibré dès 20 textes de Will)", () => expect(SEUIL_ECART_TYPE_RYTHME).toBe(2.5));
  it("paramètres par format : recette v4 pour l'avocat, valeurs déduites de la famille pour un autre format", () => {
    const av = parametresGenerateur("avocat");
    expect(av.versionRecette).toBe(4);
    expect(av.recette.famillesAccrochePermises).not.toContain("transparence-ia");
    expect(av.reseau("linkedin").premiereLigneAvecMotCle).toBe(false);
    expect(av.reseau("youtube-shorts").champsRequis).toContain("titres");
    const autre = parametresGenerateur("podcast");
    expect(autre.recette.roles.accroche).toBeTruthy();
    expect(autre.recette.structures).toEqual([]);
  });
});

const MDP = "essai-g3-reservation";
beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

async function semer() {
  for (const m of Object.values(M)) await depots().matieres.enregistrer(m);
  for (const p of Object.values(P)) await depots().preuves.enregistrer(p);
}

describe("réservation du choix (B.3.9 point 9)", () => {
  it("le choix est écrit sur le sujet (en écriture) ; le suivant, lancé tout de suite, tire une autre combinaison", async () => {
    await semer();
    const a = await gen.creerSujet({ idee: "Remplacer Excel par un tableau de bord", reseaux: ["tiktok", "linkedin"], formatId: "avocat", pilier: "donnees", motCle: "remplacer Excel" });
    const b = await gen.creerSujet({ idee: "Remplacer Excel par un tableau de bord", reseaux: ["tiktok", "linkedin"], formatId: "avocat", pilier: "donnees", motCle: "remplacer Excel" });
    const ra = await choix.reserverCombinaison(a.id);
    const rb = await choix.reserverCombinaison(b.id);
    expect(ra.ok && rb.ok).toBe(true);
    if (!ra.ok || !rb.ok) return;
    const ma = (await depots().scriptsMaitres.obtenir(a.id))!;
    expect(ma.etat).toBe("en-ecriture");
    expect(ma.choix?.structure).toBe(ra.retenue.structure);
    expect(ma.combinaisonsTransmises?.length).toBeGreaterThanOrEqual(2);
    expect(ma.numero).toBeUndefined();
    const k = (c: typeof ra.retenue) => `${c.structure}|${c.ancrages[0].matiereId}|${c.pointDeVue}|${c.emotion}`;
    expect(k(rb.retenue)).not.toBe(k(ra.retenue));
  });

  it("sans matière : ANCRAGE_MANQUANT écrit sur le sujet, 0 €, sans numéro", async () => {
    const s = await gen.creerSujet({ idee: "Un sujet sans matière", reseaux: ["tiktok"], formatId: "avocat" });
    const r = await choix.reserverCombinaison(s.id);
    expect(r.ok).toBe(false);
    const m = (await depots().scriptsMaitres.obtenir(s.id))!;
    expect(m.manque?.type).toBe("ANCRAGE_MANQUANT");
    expect(m.numero).toBeUndefined();
    expect(await depots().generations.compter()).toBe(0);
  });

  it("abandon : la réservation est libérée", async () => {
    await semer();
    const s = await gen.creerSujet({ idee: "Remplacer Excel par un tableau de bord", reseaux: ["tiktok"], formatId: "avocat", pilier: "donnees" });
    await choix.reserverCombinaison(s.id);
    await choix.libererReservation(s.id);
    const m = (await depots().scriptsMaitres.obtenir(s.id))!;
    expect(m.choix).toBeUndefined();
    expect(m.etat).toBe("brouillon");
  });
});
