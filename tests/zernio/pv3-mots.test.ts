/** PV-3 : graphe des mots, pose/pause, plafonds, disjoncteur, Tout arrêter, STOP. Aucun réseau (Zernio simulé), mots interdits en JETONS. */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signatureValide } from "@/fournisseurs/site/signature";
import type { RequeteSignee } from "@/fournisseurs/site/types";
import type { RequeteMots } from "@/services/mots-service";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const T = await import("@/services/mots-textes");
const C = await import("@/services/mots-controle");
const G = await import("@/services/mots-graphe");
const S = await import("@/services/mots-service");
const Ges = await import("@/services/mots-gestes");
const { EcranMots } = await import("@/components/mots/EcranMots");
const { etatGlobalMots } = await import("@/components/mots/etat-mots");

const J = (...p: string[]) => p.join("");
const TOKENS = { lieu: J("Gren", "oble"), label: J("Quali", "opi"), participe: J("cert", "ifié"), gain: J("Aucun gain ", "garanti") };
const ALLUME = { MOTS_ENABLED: "1" };
// Échec fermé : la prise en compte d'un STOP exige le secret d'empreinte (même valeur fictive que vitest.config.mts).
const ALLUME_EMPREINTE = { ...ALLUME, STUDIO_EMPREINTE_SECRET: "secret-fictif-de-test-empreinte-0123456789" };
const T0 = Date.UTC(2026, 10, 3, 10, 0, 0);

const brouillon = (mot = "GUIDE") =>
  T.textesDepuisSaisie({ mot, reponsePublique: "Message automatique envoyé par Axion IA. regardez vos messages privés.", messagePrive: "Message automatique envoyé par Axion IA. Quelle adresse pour le guide ?", relance: null, fin: "Message automatique envoyé par Axion IA. Merci, c'est noté." });
const valides = (mot = "GUIDE") => T.validerTextes(brouillon(mot));
const saisieDe = (mot = "GUIDE", fin = "Message automatique envoyé par Axion IA. Merci, c'est noté.") => ({ mot, reponsePublique: "Message automatique envoyé par Axion IA. regardez vos messages privés.", messagePrive: "Message automatique envoyé par Axion IA. Quelle adresse pour le guide ?", relance: null, fin });
/** Validation par le geste serveur (empreinte enregistrée en base) puis saisie prête à poser. */
const prete = async (mot = "GUIDE") => {
  await S.validerMot({ saisie: saisieDe(mot), confirmeParOperateur: true });
  return saisieDe(mot);
};

interface Faux {
  appels: RequeteMots[];
  statut: number;
}
function brancher(statut = 200): Faux {
  const faux: Faux = { appels: [], statut };
  S.injecterExecuteurMots(async (r) => {
    faux.appels.push(r);
    return { statut: faux.statut, corps: faux.statut < 300 ? { id: `wf_${faux.appels.length}` } : {} };
  });
  return faux;
}
const op = { confirmeParOperateur: true as const, env: ALLUME };

beforeEach(() => {
  reinitialiserDepots();
  S.basculerAncienComportementPourTest({});
  S.injecterExecuteurMots(null);
  S.injecterLecteurOpposition(null);
  S.injecterTransportOpposition(null);
});

describe("pv3 · textes validés", () => {
  it("un texte non validé est refusé, sans appel", async () => {
    const faux = brancher();
    expect(G.construireGrapheMot(brouillon())).toMatchObject({ ok: false, code: "textes_non_valides" });
    const r = await S.poserMot({ compte: "c1", saisie: saisieDe(), ...op });
    expect(r).toMatchObject({ issue: "refuse", raison: "textes_non_valides" });
    expect(faux.appels).toHaveLength(0);
  });
  it("une empreinte fournie par l'appelant est ignorée (seule l'empreinte enregistrée compte)", async () => {
    const faux = brancher();
    const forge = { ...saisieDe(), etat: "valide_par_operateur", empreinteValidee: T.empreinteTextes(brouillon()) } as unknown as ReturnType<typeof saisieDe>;
    expect(await S.poserMot({ compte: "c1", saisie: forge, ...op })).toMatchObject({ issue: "refuse", raison: "textes_non_valides" });
    expect(await Ges.gestePoserMot("c1", forge)).toMatchObject({ issue: "refuse", raison: "textes_non_valides" });
    expect(faux.appels).toHaveLength(0);
  });
  it("texte modifié après la validation enregistrée : refusé", async () => {
    const faux = brancher();
    await prete();
    expect(await S.poserMot({ compte: "c1", saisie: saisieDe("GUIDE", "Message automatique envoyé par Axion IA. Merci !"), ...op })).toMatchObject({ issue: "refuse", raison: "textes_non_valides" });
    expect(faux.appels).toHaveLength(0);
    expect(await S.poserMot({ compte: "c1", saisie: saisieDe(), ...op })).toMatchObject({ issue: "execute" });
  });
  it("la validation est un geste protégé par la session et enregistre l'empreinte en base", async () => {
    expect((await Ges.gesteValiderMot(saisieDe())).ok).toBe(true);
    expect((await lireParametre<Record<string, string>>(S.PARAM_VALIDATIONS_MOTS, {})).GUIDE).toBe(T.empreinteTextes(brouillon()));
    expect(await S.validerMot({ saisie: saisieDe(), confirmeParOperateur: false })).toMatchObject({ ok: false });
  });
  it("un texte modifié après validation redevient non validé", () => {
    const v = valides();
    expect(T.textesValides(v)).toBe(true);
    expect(T.textesValides({ ...v, fin: v.fin + " !" })).toBe(false);
    expect(G.construireGrapheMot({ ...v, fin: v.fin + " !" })).toMatchObject({ ok: false, code: "textes_non_valides" });
  });
  it("fichier mots/<MOT>.md : état et sections lus, jamais de texte en dur", () => {
    const md = (etat: string) => `etat: ${etat}\n\n## reponse_publique\nA. Message automatique envoyé par Axion IA.\n## message_prive\nB. Message automatique envoyé par Axion IA.\n## fin\nC. Message automatique envoyé par Axion IA.\n`;
    const lu = T.lireTextesMarkdown("guide", md("brouillon"));
    expect(lu.ok && lu.textes.etat).toBe("brouillon");
    const ok = T.lireTextesMarkdown("GUIDE", md("validé par l'opérateur"));
    expect(ok.ok && ok.textes.etat).toBe(T.ETAT_VALIDE);
    // « validé » écrit à la main sans empreinte ne suffit pas.
    expect(ok.ok && G.construireGrapheMot(ok.textes)).toMatchObject({ ok: false, code: "textes_non_valides" });
    expect(T.lireTextesMarkdown("GUIDE", "etat: brouillon\n## fin\nx")).toMatchObject({ ok: false });
    expect(T.lireTextesMarkdown("../x", md("brouillon"))).toMatchObject({ ok: false, raison: "mot_invalide" });
  });
  it("le graphe vient des textes : réponse publique, message privé, fin, relance facultative ; posé en pause", () => {
    const g = G.construireGrapheMot(valides());
    expect(g.ok && g.workflow.etapes.map((e) => e.type)).toEqual(["repondre_commentaire", "envoyer_message_prive", "attendre_reponse", "terminer"]);
    expect(g.ok && g.workflow.etatInitial).toBe("pause");
    const avec = T.validerTextes({ ...brouillon(), relance: "Message automatique envoyé par Axion IA. Une dernière fois." });
    const g2 = G.construireGrapheMot(avec);
    expect(g2.ok && g2.workflow.etapes.some((e) => e.type === "relancer")).toBe(true);
  });
});

describe("pv3 · contrôle de sortie", () => {
  const avecTexte = (t: string) => G.construireGrapheMot(T.validerTextes({ ...brouillon(), messagePrive: t }));
  it.each([
    ["lieu interdit", `Message automatique envoyé par Axion IA. Depuis ${TOKENS.lieu}`, "expression_bannie"],
    ["gain garanti", `Message automatique envoyé par Axion IA. ${TOKENS.gain}`, "expression_bannie"],
    ["label qualité", `Message automatique envoyé par Axion IA. ${TOKENS.label}`, "mot_interdit"],
    ["participe", `Message automatique envoyé par Axion IA. Formation ${TOKENS.participe}e`, "mot_interdit"],
    ["mention absente", "Bonjour, votre adresse ?", "mention_absente"],
    ["promesse", `Message automatique envoyé par Axion IA. Résultat ${J("garan", "ti")} sans risque`, "promesse_interdite"],
    ["adresse e-mail", "Message automatique envoyé par Axion IA. Écrivez à quelqu@example.com", "adresse_email"],
    ["promesse coupée par un caractère invisible", `Message automatique envoyé par Axion IA. Résultat ${J("garan", "\u200B", "ti")}`, "promesse_interdite"],
    ["adresse épelée", "Message automatique envoyé par Axion IA. Écrivez à nom arobase exemple point com", "adresse_email"],
  ])("%s refusé", (_n, texte, code) => {
    const r = avecTexte(texte);
    expect(r).toMatchObject({ ok: false, code: "texte_refuse" });
    expect(!r.ok && r.refus.map((x) => x.code)).toContain(code);
  });
  it("mot interdit refusé à la pose : aucun appel", async () => {
    const faux = brancher();
    const saisie = { ...saisieDe(), reponsePublique: `Message automatique envoyé par Axion IA. ${TOKENS.lieu}` };
    expect(await S.validerMot({ saisie, confirmeParOperateur: true })).toMatchObject({ ok: false, raison: "texte_refuse" });
    const r = await S.poserMot({ compte: "c1", saisie, ...op });
    expect(r).toMatchObject({ issue: "refuse", raison: "textes_non_valides" });
    expect(faux.appels).toHaveLength(0);
  });
  it("texte conforme accepté", () => expect(C.controlerTextesMot(valides())).toEqual([]));
});

describe("pv3 · interrupteur éteint = aucun appel", () => {
  it("pose, pause, réactivation : simulation, aucun état modifié", async () => {
    const faux = brancher();
    const eteint = { confirmeParOperateur: true as const, env: {} };
    const p = await S.poserMot({ compte: "c1", saisie: await prete(), ...eteint });
    expect(p).toMatchObject({ issue: "simule", raison: "interrupteur_eteint" });
    expect(p.requete?.chemin).toBeTruthy();
    expect(await S.mettreEnPause({ mot: "GUIDE", compte: "c1", ...eteint })).toMatchObject({ issue: "refuse", raison: "mot_non_pose" });
    expect(faux.appels).toHaveLength(0);
    expect((await S.lireVueMots({})).lignes).toEqual([]);
    expect(S.motsActif({})).toBe(false);
  });
  it("sans validation de l'opérateur : refus même allumé", async () => {
    const faux = brancher();
    expect(await S.poserMot({ compte: "c1", saisie: await prete(), confirmeParOperateur: false, env: ALLUME })).toMatchObject({ issue: "refuse", raison: "validation_operateur_absente" });
    expect(faux.appels).toHaveLength(0);
  });
  it("noterEnvois éteint : rien compté", async () => {
    expect(await S.noterEnvois({ mot: "GUIDE", compte: "c1", env: {} })).toMatchObject({ actif: false });
    expect(await lireParametre(S.PARAM_GARDES_MOTS, null)).toBeNull();
  });
});

describe("pv3 · pose / pause / réactivation", () => {
  it("allumé et validé : pose en pause, puis réactivation, puis pause", async () => {
    const faux = brancher();
    expect(await S.poserMot({ compte: "c1", saisie: await prete(), ...op })).toMatchObject({ issue: "execute", idWorkflow: "wf_1" });
    expect((await S.lireVueMots(ALLUME)).lignes[0]).toMatchObject({ mot: "GUIDE", compte: "c1", etat: "pause" });
    expect(await S.reactiverMot({ mot: "GUIDE", compte: "c1", ...op })).toMatchObject({ issue: "execute" });
    expect((await S.lireVueMots(ALLUME)).lignes[0].etat).toBe("actif");
    expect(await S.mettreEnPause({ mot: "GUIDE", compte: "c1", ...op })).toMatchObject({ issue: "execute" });
    expect(faux.appels.map((a) => a.methode)).toEqual(["POST", "PUT", "PUT"]);
    expect(faux.appels[1].corps).toEqual({ etat: "actif" });
  });
  it("compte par compte : la pause d'un compte ne touche pas l'autre", async () => {
    brancher();
    for (const c of ["c1", "c2"]) {
      await S.poserMot({ compte: c, saisie: await prete(), ...op });
      await S.reactiverMot({ mot: "GUIDE", compte: c, ...op });
    }
    await S.mettreEnPause({ mot: "GUIDE", compte: "c1", ...op });
    const l = (await S.lireVueMots(ALLUME)).lignes;
    expect(l.find((x) => x.compte === "c1")?.etat).toBe("pause");
    expect(l.find((x) => x.compte === "c2")?.etat).toBe("actif");
  });
});

describe("pv3 · plafonds", () => {
  it("le plafond horaire ne dépasse jamais 600, même réglé plus haut", async () => {
    expect(S.PLAFOND_HEURE_COMPTE_MAX).toBe(600);
    expect((await S.reglerPlafonds({ heureCompte: 99999 })).heureCompte).toBe(600);
  });
  it("plafond du jour atteint = pause automatique du mot", async () => {
    const faux = brancher();
    await S.poserMot({ compte: "c1", saisie: await prete(), ...op });
    await S.reactiverMot({ mot: "GUIDE", compte: "c1", ...op });
    await S.reglerPlafonds({ jourMot: 3 });
    expect((await S.noterEnvois({ mot: "GUIDE", compte: "c1", nombre: 2, env: ALLUME, maintenantMs: T0 })).pausesAutomatiques).toBe(0);
    const r = await S.noterEnvois({ mot: "GUIDE", compte: "c1", nombre: 1, env: ALLUME, maintenantMs: T0 + 1000 });
    expect(r.pausesAutomatiques).toBe(1);
    expect((await S.lireVueMots(ALLUME)).lignes[0].etat).toBe("pause_auto");
    expect(faux.appels.at(-1)).toMatchObject({ methode: "PUT", corps: { etat: "pause" } });
    // Le lendemain, le compteur repart de zéro mais la pause demeure : seul l'opérateur réactive.
    expect((await S.lireVueMots(ALLUME)).disjoncteur.ouvert).toBe(false);
  });
  it("plafond horaire atteint = disjoncteur ouvert + pause du compte", async () => {
    brancher();
    await S.poserMot({ compte: "c1", saisie: await prete(), ...op });
    await S.reactiverMot({ mot: "GUIDE", compte: "c1", ...op });
    await S.reglerPlafonds({ heureCompte: 10, jourMot: 100000 });
    const r = await S.noterEnvois({ mot: "GUIDE", compte: "c1", nombre: 10, env: ALLUME, maintenantMs: T0 });
    expect(r).toMatchObject({ disjoncteurOuvert: true, pausesAutomatiques: 1 });
    expect((await S.lireVueMots(ALLUME)).lignes[0].etat).toBe("pause_auto");
  });
});

describe("pv3 · disjoncteur", () => {
  /**
   * Entrelacement FORCÉ (aucune minuterie de hasard) : (1) `noterEnvois` finit sa partie compteurs puis `ouvrirDisjoncteur` lit
   * les gardes (fermées) et est suspendu (verrou B) ; (2) un `poserMot` concurrent exécute son appel, relit les gardes
   * (fermées) dans `executer` et est suspendu (verrou A) ; (3) B est libéré, le disjoncteur s'écrit « ouvert » ; (4) A est
   * libéré, `executer` réécrit ses gardes périmées. Renvoie l'état final de `ouvert`.
   */
  async function jouerCourse(): Promise<boolean> {
    S.injecterExecuteurMots(null);
    let n = 0;
    let armeA = false;
    S.injecterExecuteurMots(async (r) => {
      if (r.methode === "POST") armeA = true; // seule la pose du compte c2 est suspendue
      return { statut: 200, corps: { id: `wf_${++n}` } };
    });
    await S.poserMot({ compte: "c1", saisie: await prete(), ...op });
    await S.reactiverMot({ mot: "GUIDE", compte: "c1", ...op });
    await S.reglerPlafonds({ heureCompte: 10, jourMot: 100000 });
    const saisie = await prete();
    armeA = false;

    const latch = () => {
      let ouvrir!: () => void;
      const p = new Promise<void>((r) => (ouvrir = r));
      return { p, ouvrir };
    };
    const A = latch(), B = latch();
    const atteintA = latch(), atteintB = latch();
    let gardesEcrites = false;
    const param = depots().parametres;
    const obtenir = vi.spyOn(param, "obtenir");
    const enregistrer = vi.spyOn(param, "enregistrer");
    const obtenirReel = obtenir.getMockImplementation() ?? param.obtenir.bind(param);
    const vraiObtenir = Object.getPrototypeOf(param).obtenir ? Object.getPrototypeOf(param).obtenir.bind(param) : obtenirReel;
    let pauseB = false, pauseAFaite = false;
    obtenir.mockImplementation(async (id: string) => {
      const v = await vraiObtenir(id);
      if (id !== S.PARAM_GARDES_MOTS) return v;
      if (gardesEcrites && !pauseB) {
        pauseB = true; // lecture de `ouvrirDisjoncteur` (gardes fermées) : suspendue
        atteintB.ouvrir();
        await B.p;
      } else if (armeA && !pauseAFaite) {
        pauseAFaite = true; // première relecture des gardes par `executer` après l'appel de pose : suspendue
        atteintA.ouvrir();
        await A.p;
      }
      return v;
    });
    const vraiEnregistrer = Object.getPrototypeOf(param).enregistrer.bind(param);
    enregistrer.mockImplementation(async (e: { id: string }) => {
      await vraiEnregistrer(e);
      if (e.id === S.PARAM_GARDES_MOTS && !pauseB) gardesEcrites = true; // fin de la partie compteurs de noterEnvois
    });
    try {
      const rapport = S.noterEnvois({ mot: "GUIDE", compte: "c1", nombre: 10, env: ALLUME, maintenantMs: T0 });
      await atteintB.p; // ouvrirDisjoncteur a lu les gardes fermées
      const pose = S.poserMot({ compte: "c2", saisie, ...op });
      for (let i = 0; i < 25; i++) await new Promise((r) => setTimeout(r, 0)); // laisse la pose avancer si le verrou le permet
      B.ouvrir();
      await rapport; // le disjoncteur est écrit « ouvert »
      A.ouvrir(); // executer réécrit seulement maintenant ses gardes lues avant l'ouverture
      await pose;
    } finally {
      A.ouvrir();
      B.ouvrir();
      obtenir.mockRestore();
      enregistrer.mockRestore();
    }
    return (await S.lireGardes()).disjoncteur.ouvert;
  }
  it("course (entrelacement forcé) : poserMot concurrent + dépassement du plafond, le disjoncteur reste ouvert", async () => {
    expect(await jouerCourse()).toBe(true);
    expect((await S.lireVueMots(ALLUME)).disjoncteur.ouvert).toBe(true);
    expect(await S.refermerDisjoncteur({ confirmeParOperateur: true })).toEqual({ ok: true });
    expect((await S.lireGardes()).disjoncteur.ouvert).toBe(false);
  });
  it("course · MUTATION : sur l'ancien comportement (797760d) le même scénario REFERME le disjoncteur — preuve que le test discrimine", async () => {
    S.basculerAncienComportementPourTest({ sansGardeEcriture: true, noterHorsVerrou: true });
    try {
      expect(await jouerCourse()).toBe(false); // bug reproduit : l'écriture périmée d'executer a écrasé « ouvert »
    } finally {
      S.basculerAncienComportementPourTest({});
    }
  });
  it("course · une seule des deux protections suffit à garder le disjoncteur ouvert (défense en profondeur)", async () => {
    S.basculerAncienComportementPourTest({ sansGardeEcriture: true });
    try {
      expect(await jouerCourse()).toBe(true); // bloc sous verrou, garde d'écriture désactivée
    } finally {
      S.basculerAncienComportementPourTest({});
    }
    reinitialiserDepots();
    S.basculerAncienComportementPourTest({ noterHorsVerrou: true });
    try {
      expect(await jouerCourse()).toBe(true); // bloc hors verrou, garde d'écriture active
    } finally {
      S.basculerAncienComportementPourTest({});
    }
  });
  it("s'ouvre après N erreurs, bloque pose et réactivation, ne se referme que par geste", async () => {
    const faux = brancher(500);
    for (let i = 0; i < S.ERREURS_CONSECUTIVES_MAX; i++) expect(await S.poserMot({ compte: "c1", saisie: await prete(), ...op })).toMatchObject({ raison: "zernio_refuse" });
    expect((await S.lireVueMots(ALLUME)).disjoncteur.ouvert).toBe(true);
    const avant = faux.appels.length;
    faux.statut = 200;
    expect(await S.poserMot({ compte: "c1", saisie: await prete(), ...op })).toMatchObject({ issue: "refuse", raison: "disjoncteur_ouvert" });
    expect(faux.appels).toHaveLength(avant);
    expect(await S.refermerDisjoncteur({ confirmeParOperateur: false })).toEqual({ ok: false });
    expect((await S.lireVueMots(ALLUME)).disjoncteur.ouvert).toBe(true);
    expect(await S.refermerDisjoncteur({ confirmeParOperateur: true })).toEqual({ ok: true });
    expect(await S.poserMot({ compte: "c1", saisie: await prete(), ...op })).toMatchObject({ issue: "execute" });
  });
  it("un succès remet le compteur d'erreurs à zéro", async () => {
    const faux = brancher(500);
    await S.poserMot({ compte: "c1", saisie: await prete(), ...op });
    faux.statut = 200;
    await S.poserMot({ compte: "c1", saisie: await prete(), ...op });
    expect((await S.lireGardes()).erreursConsecutives).toBe(0);
  });
});

describe("pv3 · Tout arrêter", () => {
  it("coupe aussi les mots : pose et réactivation refusées, mots actifs mis en pause", async () => {
    const faux = brancher();
    await S.poserMot({ compte: "c1", saisie: await prete(), ...op });
    await S.reactiverMot({ mot: "GUIDE", compte: "c1", ...op });
    await ecrireParametre("zernio.envoi_autorise", false); // l'interrupteur global existant
    const n = faux.appels.length;
    expect(await S.poserMot({ compte: "c2", saisie: await prete(), ...op })).toMatchObject({ issue: "refuse", raison: "tout_arrete" });
    expect(await S.reactiverMot({ mot: "GUIDE", compte: "c1", ...op })).toMatchObject({ issue: "refuse", raison: "tout_arrete" });
    expect(faux.appels).toHaveLength(n);
    expect(await S.appliquerToutArreter({ env: ALLUME })).toEqual({ arret: true, pauses: 1 });
    expect((await S.lireVueMots(ALLUME)).lignes[0].etat).toBe("pause_auto");
    expect((await S.lireVueMots(ALLUME)).toutArrete).toBe(true);
  });
  it("interrupteur global non coupé : le balayage ne fait rien", async () => {
    const faux = brancher();
    expect(await S.appliquerToutArreter({ env: ALLUME })).toEqual({ arret: false, pauses: 0 });
    expect(faux.appels).toHaveLength(0);
  });
});

describe("pv3 · STOP par compte", () => {
  it("le graphe STOP n'a aucun texte sortant et ne parle pas d'effacement", () => {
    const w = G.construireGrapheStop();
    expect(w.declencheur).toMatchObject({ type: "message_prive_mot_seul", mots: ["STOP", "ARRET", "ARRETEZ"] });
    expect(w.etapes.map((e) => e.type)).toEqual(["mettre_a_l_ecart", "alerter_operateur"]);
    expect(JSON.stringify(w)).not.toMatch(/texte|effacement/);
  });
  it("STOP et ARRÊT reconnus (mot seul) ; autre chose, non", () => {
    for (const t of ["STOP", "stop", "Arrêt", "ARRÊT.", " arret "]) expect(G.estMotOpposition(t)).toBe(true);
    for (const t of ["stop ça", "demande_effacement", "oui", "", null]) expect(G.estMotOpposition(t as string)).toBe(false);
  });
  async function deposer(mot: string, id: string) {
    await depots().evenementsFournisseurs.enregistrer({
      id: `evf_${id}`, fournisseur: "zernio", idEvenement: id, type: "workflow.run.completed", recuLe: "2026-11-03T10:00:00.000Z", traite: false,
      charge: { idRun: `run_${id}_0001`, idContact: `ct_${id}`, motDeclencheur: mot, etat: "a_faire", essais: 0, prochainEssaiLe: null, dernierCode: null, accord: null },
      creeLe: "2026-11-03T10:00:00.000Z", modifieLe: "2026-11-03T10:00:00.000Z",
    } as never);
  }
  it("mise à l'écart + alerte + sortie de la file « guide », rien supprimé", async () => {
    await deposer("STOP", "a");
    await deposer("GUIDE", "b");
    const avant = (await depots().notifications.lister(() => true)).length; // le dépôt mémoire contient des exemples
    expect(await S.traiterOppositions({ env: {} })).toEqual({ actif: false, prises: 0, transmises: 0 });
    expect((await depots().notifications.lister(() => true)).length).toBe(avant);
    expect(await S.traiterOppositions({ env: ALLUME_EMPREINTE })).toMatchObject({ actif: true, prises: 1 });
    const evts = await depots().evenementsFournisseurs.lister(() => true);
    expect(evts).toHaveLength(2); // rien supprimé
    expect(evts.find((e) => e.idEvenement === "a")).toMatchObject({ traite: true, charge: { etat: "opposition" } });
    expect(evts.find((e) => e.idEvenement === "b")?.traite).toBe(false);
    const notifs = await depots().notifications.lister(() => true);
    expect(notifs).toHaveLength(avant + 1);
    expect(notifs.filter((n) => n.lien === "/mots")).toHaveLength(1);
    const liste = await lireParametre<{ id: string }[]>(S.PARAM_OPPOSITIONS_MOTS, []);
    expect(liste).toHaveLength(1);
    expect(JSON.stringify(liste)).not.toContain("ct_a"); // empreinte, pas l'identifiant
    expect(await S.traiterOppositions({ env: ALLUME_EMPREINTE })).toMatchObject({ prises: 0 }); // une seule fois
  });
  it("transmission signée au site, e-mail jamais conservé", async () => {
    await deposer("ARRÊT", "c");
    const vus: RequeteSignee[] = [];
    S.injecterLecteurOpposition(async () => ({ email: "lecteur-fictif@example.com", reseau: "instagram" }));
    S.injecterTransportOpposition(async (r) => (vus.push(r), { statut: 200, corps: {} }));
    const env = { ...ALLUME_EMPREINTE, SITE_GUIDES_RESEAU_SECRET: "secret-fictif-pv3-0123456789abcdefghi" };
    expect(await S.traiterOppositions({ env })).toMatchObject({ prises: 1, transmises: 1 });
    expect(vus).toHaveLength(1);
    expect(vus[0].chemin).toBe(S.CHEMIN_OPPOSITIONS_SITE);
    const h = vus[0].entetes as Record<string, string>;
    const [horo, nonce, sig] = Object.values(h);
    expect(signatureValide("secret-fictif-pv3-0123456789abcdefghi", { methode: "POST", chemin: vus[0].chemin, corps: vus[0].corps as string, horodatage: horo, nonce, signature: sig })).toBe(true);
    const tout = JSON.stringify([await depots().evenementsFournisseurs.lister(() => true), await depots().parametres.lister(() => true), await depots().evenements.lister(() => true), await depots().notifications.lister(() => true)]);
    expect(tout).not.toContain("lecteur-fictif");
    expect(tout).not.toContain("secret-fictif");
  });
});

describe("pv3 · gestes et écran", () => {
  it("geste de pose depuis un fichier absent : refus", async () => {
    expect(await Ges.gestePoserDepuisFichier("c1", "ABSENT")).toMatchObject({ issue: "refuse", raison: "fichier_absent" });
  });
  it("l'écran est éteint par défaut, en français, et les gestes passent par les services", async () => {
    const vide = await S.lireVueMots({});
    expect(vide).toMatchObject({ interrupteurAllume: false, toutArrete: false, lignes: [] });
    expect(etatGlobalMots({ interrupteurAllume: false, toutArrete: false, disjoncteurOuvert: false }).libelle).toMatch(/Éteint/);
    expect(etatGlobalMots({ interrupteurAllume: true, toutArrete: true, disjoncteurOuvert: true }).libelle).toMatch(/arrêt/);
    const services = { mettreEnPause: vi.fn(), reactiver: vi.fn(), activerLocal: vi.fn(), mettreEnPauseLocal: vi.fn(), refermerDisjoncteur: vi.fn(), reglerPlafonds: vi.fn() };
    const html = renderToStaticMarkup(createElement(EcranMots, { vue: vide, services }));
    expect(html).toContain("Éteint : simulation seulement");
    expect(html).toContain("Aucun mot posé");
    const html2 = renderToStaticMarkup(createElement(EcranMots, { services, vue: { ...vide, interrupteurAllume: true, disjoncteur: { ouvert: true, raison: "x", ouvertLe: null }, lignes: [{ mot: "GUIDE", compte: "c1", etat: "pause_auto", idWorkflow: "w", raison: null, modifieLe: "" }] } }));
    expect(html2).toContain("Refermer le disjoncteur");
    expect(html2).toContain("Réactiver");
    expect(html2).toContain("Pause automatique");
  });
});

describe("pv3 · garde de dépôt", () => {
  it("aucun texte définitif ni adresse e-mail dans les fichiers du périmètre", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const fichiers = [...readdirSync("src/services").filter((f) => f.startsWith("mots-")).map((f) => `src/services/${f}`), ...readdirSync("src/components/mots").map((f) => `src/components/mots/${f}`)];
    for (const f of fichiers) expect(readFileSync(f, "utf8"), f).not.toMatch(/[\w.+-]+@[\w-]+\.(com|fr|net|org)\b/);
  });
});
