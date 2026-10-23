/**
 * LOT M0 du moteur avocat (plan v3.2, B.0 et B.11) : adaptations de la console sans écran.
 * Format avocat v2 (recette, réglages, migrations), durée depuis le script, tu / vous, mention IA coupée
 * par défaut, musique interdite, fusion fond → décor, visages par angle, commande v2 (moteur figé),
 * résultats du moteur, statut « annulée », contrats des fournisseurs, migration de données au démarrage.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots, DepotMemoire } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const travaux = await import("@/services/travaux");
const videos = await import("@/services/videos");
const publications = await import("@/services/publications");
const { migrerDonnees } = await import("@/services/migrations");
const { ecrireParametre } = await import("@/services/_commun");
const { formatAvocat, migrerReglagesAvocat, migrerScriptAvocat } = await import("@/formats/avocat");
const formats = await import("@/formats");
const { REGLES_COMMUNES } = await import("@/formats/communs");
const { analyserAdresse, alerteAdresse, regleAdresse, adresseDepuisFacon } = await import("@/domaine/adresse");
const { resoudreVisagesParAngle, normaliserTenue } = await import("@/domaine/distribution");
const { MENTION_IA_PAR_DEFAUT, MENTION_IA_ANCIEN_DEFAUT, texteScript } = await import("@/domaine/derivations");
const sim = await import("@/fournisseurs/simulation/script");
const { fournisseurVoixSimulation, fournisseurVisageSimulation, fournisseurIllustrationSimulation } = await import("@/fournisseurs/simulation/autres");
const moteurs = await import("@/moteurs");
const { briqueVoix, briqueNettoyageBlancs, alertesDuree } = await import("@/briques");
const { usdVersEur } = await import("@/lib/montants");

import type { BlocScript, ElementBibliotheque, Script, Visage } from "@/domaine/types";
import type { Depots } from "@/domaine/depots";

const MDP_TEST = "essai-moteur-avocat-m0";

beforeAll(async () => {
  process.env.SESSION_SECRET = "m".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP_TEST, false);
});

/** Script v1 tel qu'il est encore stocké en base (recette accroche, question, réponse, explication, fin). */
const BLOCS_V1: BlocScript[] = [
  { id: "b1", blocRecette: "accroche", segments: [{ id: "s1", texte: "Votre patron lit vos mails ?" }] },
  { id: "b2", blocRecette: "question", segments: [{ id: "s2", texte: "Mais jusqu'où ?" }] },
  { id: "b3", blocRecette: "reponse", segments: [{ id: "s3", texte: "Il peut ouvrir vos mails professionnels." }] },
  { id: "b4", blocRecette: "explication", segments: [{ id: "s4", texte: "Un mail est présumé professionnel." }, { id: "s5", texte: "Sauf mention « personnel »." }] },
  { id: "b5", blocRecette: "fin", segments: [{ id: "s6", texte: "Retenez le mot « personnel »." }] },
];

const tousLesTextes = (blocs: BlocScript[]) => blocs.flatMap((b) => b.segments.map((s) => s.texte));

/* ------------------------------------------------------------------ */
describe("format avocat v2 : recette, réglages et migrations (B.0 §14, B.9 bis)", () => {
  it("version 2, recette en 6 blocs, 4,4 mots/s, musique interdite, ratios 9:16 / 4:5 / 1:1, durée depuis le script", () => {
    expect(formatAvocat.version).toBe(2);
    expect(formatAvocat.recetteScript.blocs.map((b) => b.id)).toEqual(["accroche", "promesse", "coeur", "preuve", "appel", "boucle"]);
    expect(formatAvocat.recetteScript.motsParSeconde).toBe(4.4);
    expect(formatAvocat.musique).toBe("interdite");
    expect(formatAvocat.ratios).toEqual(["9:16", "4:5", "1:1"]);
    expect(formatAvocat.durees.mode).toBe("depuis-script");
    expect(formatAvocat.accrocheVisuelle?.titreFixe).toBe(false);
    expect(formatAvocat.accrocheVisuelle?.encadreOuverture).toMatchObject({ de: 0, a: 3, motsMax: 8, caracteresAlerte: 50 });
    expect(formatAvocat.illustrations).toMatchObject({ affichage: "plein-ecran", dureePlanSec: [1.5, 2.5] });
    expect(formatAvocat.export).toMatchObject({ fps: 25, debitMbpsMin: 12, debitMbpsMax: 16, audio: { kbps: 256, hz: 48000 } });
    // Lot M3 : la bascule sur « express » s'est faite avec l'écran « Votre vidéo ».
    expect(formatAvocat.etapes).toEqual(["express", "fabrication"]);
    // Le moteur réel n'est PAS en dur : il se choisit au lancement (B.1).
    expect(formatAvocat.moteur).toBe("simulation");
  });

  it("« Vouvoiement du spectateur » a quitté les règles communes ; la règle d'adresse se génère", () => {
    expect(REGLES_COMMUNES.join(" ")).not.toMatch(/vouvoiement/i);
    expect(formatAvocat.recetteScript.regles.join(" ")).not.toMatch(/titre en haut/i);
    expect(regleAdresse("tu")).toMatch(/tutoiement/i);
    expect(regleAdresse("vous")).toMatch(/vouvoiement/i);
    expect(adresseDepuisFacon(true)).toBe("tu");
    expect(adresseDepuisFacon(false)).toBe("vous");
    expect(adresseDepuisFacon(undefined)).toBe("vous");
  });

  it("migrerScript v1 → v2 : aucun texte perdu, correspondance des blocs, preuve et boucle à compléter", () => {
    const v2 = migrerScriptAvocat(BLOCS_V1, 1);
    expect(tousLesTextes(v2)).toEqual(tousLesTextes(BLOCS_V1));
    expect(v2.map((b) => b.blocRecette)).toEqual(["accroche", "promesse", "coeur", "preuve", "appel", "boucle"]);
    expect(v2.find((b) => b.blocRecette === "coeur")!.segments.map((s) => s.id)).toEqual(["s3", "s4", "s5"]);
    expect(formats.blocsACompleter(formatAvocat, v2)).toEqual(["preuve", "boucle"]);
    // Rejouée sur des blocs v2 : rien ne bouge.
    expect(migrerScriptAvocat(v2, 2)).toBe(v2);
  });

  it("un script v1 est migré à la LECTURE, versionFormat compris ; l'éditeur v2 retrouve tout le texte", async () => {
    const v1: Script = { ...(await depots().scripts.obtenir("script-2"))!, id: "script-v1", versionFormat: 1, blocs: BLOCS_V1 };
    await depots().scripts.enregistrer(v1);
    const lu = await videos.obtenirScriptAJour("script-v1");
    expect(lu!.versionFormat).toBe(2);
    expect(texteScript(lu!.blocs)).toBe(texteScript(BLOCS_V1));
    // Pas de réécriture de masse : la base garde le v1 tant qu'il n'est pas réenregistré.
    expect((await depots().scripts.obtenir("script-v1"))!.versionFormat).toBe(1);
  });

  it("migrerReglages v1 → v2 : deuxAngles=false → un seul angle ; titreEnHaut et carteFinale retirés", () => {
    const v2 = migrerReglagesAvocat({ titreEnHaut: true, deuxAngles: false, carteFinale: true }, 1);
    expect(v2).toEqual({ repartitionAngles: "un-angle" });
    expect(migrerReglagesAvocat({ titreEnHaut: true, deuxAngles: true, carteFinale: false }, 1)).toEqual({ repartitionAngles: "principal" });
    const valide = formats.validerReglages(formatAvocat, v2);
    expect(valide.ok && valide.reglages).toEqual({ repartitionAngles: "un-angle", micro: false, ouvertureSurIllustration: false, cadrageDouble: "taille", finEnBoucle: false });
  });
});

/* ------------------------------------------------------------------ */
describe("durée calculée depuis le script (B.0 §18)", () => {
  it("estimerDureeTexte = round(mots ÷ 4,4) ; zones vert 25-40, orange 40-50, hors zone au-delà", () => {
    const mots = (n: number) => Array.from({ length: n }, () => "mot").join(" ");
    expect(formats.estimerDureeTexte(formatAvocat, mots(132))).toBe(30);
    expect(formats.zoneDuree(formatAvocat, 30)).toBe("verte");
    expect(formats.zoneDuree(formatAvocat, 45)).toBe("orange");
    expect(formats.zoneDuree(formatAvocat, 55)).toBe("hors-zone");
    expect(formats.zoneDuree(formatAvocat, 20)).toBe("courte");
    expect(formats.zoneDuree(formats.obtenirFormat("podcast"), 600)).toBeNull();
    expect(formats.dureeVideo(formatAvocat, mots(176), 45)).toBe(40);
    // Format à pastilles : la durée choisie reste celle de la vidéo.
    expect(formats.dureeVideo(formats.obtenirFormat("podcast"), mots(176), 600)).toBe(600);
  });

  it("la commande porte la durée ESTIMÉE du texte, pas la durée choisie", async () => {
    await depots().videos.modifier("v-03", { dureeCibleSec: 90 });
    const c = await fabrication.construireCommande("v-03");
    expect(c.dureeCibleSec).toBe(formats.estimerDureeTexte(formatAvocat, c.script.texteComplet));
    expect(c.dureeCibleSec).not.toBe(90);
  });

  it("le contrôle qualité informe « un peu long » et « hors zone » sans jamais bloquer", () => {
    expect(alertesDuree({ dureeSec: 45, dureeCibleSec: 30, ratios: ["9:16"], formatId: "avocat" })).toEqual([{ code: "duree", gravite: "info", message: "Un peu long (40 à 50 s)." }]);
    expect(alertesDuree({ dureeSec: 55, dureeCibleSec: 30, ratios: ["9:16"], formatId: "avocat" })[0]).toMatchObject({ gravite: "info", message: "Hors zone : plus de 50 s." });
    expect(alertesDuree({ dureeSec: 30, dureeCibleSec: 30, ratios: ["9:16"], formatId: "avocat" })).toEqual([]);
    // Format à durée choisie : l'ancien contrôle d'écart reste.
    expect(alertesDuree({ dureeSec: 100, dureeCibleSec: 60, ratios: ["16:9"], formatId: "podcast" })[0].gravite).toBe("attention");
  });
});

/* ------------------------------------------------------------------ */
describe("tutoiement / vouvoiement (B.0 §15)", () => {
  it("détecte un mélange de « tu » et de « vous » (alerte non bloquante)", () => {
    expect(analyserAdresse("Vous savez ce que tu risques ?")).toMatchObject({ melange: true });
    expect(alerteAdresse("Tu sais ce que tu risques ?", "tu")).toBeNull();
    expect(alerteAdresse("Vous savez ce que vous risquez ?", "tu")).toMatch(/vouvoie/);
    expect(alerteAdresse("Le juge regarde les faits.", "vous")).toBeNull();
    expect(analyserAdresse("Tout le monde se trompe.").dominante).toBeNull();
  });

  it("le générateur simulé écrit en tu ET en vous, sans mélange", () => {
    for (let variante = 0; variante < 3; variante++) {
      const tu = texteScript(sim.scriptSimuleSync(formatAvocat.recetteScript, "Contrôle routier", variante, 30, "tu").blocs);
      const vous = texteScript(sim.scriptSimuleSync(formatAvocat.recetteScript, "Contrôle routier", variante, 30, "vous").blocs);
      expect(analyserAdresse(tu).vous).toBe(0);
      expect(analyserAdresse(vous).tu).toBe(0);
    }
  });

  it("la vidéo reçoit l'adresse de « Ma façon de parler », et la commande la transmet", async () => {
    await ecrireParametre("style.faconDeParler", { expressions: [], motsInterdits: [], tutoiement: true, notes: "" });
    const id = await videos.creerBrouillon("avocat", { scriptId: "script-2" });
    expect((await depots().videos.obtenir(id))!.adresse).toBe("tu");
    expect((await fabrication.construireCommande(id)).adresse).toBe("tu");
  });
});

/* ------------------------------------------------------------------ */
describe("générateur simulé : texte collé, accroches, saisie libre", () => {
  it("découpe un texte collé en blocs de la recette sans le réécrire", () => {
    const texte = "Votre patron lit vos mails ? Je vous explique. Il peut ouvrir les mails professionnels. Un mail est présumé professionnel. Un salarié a perdu 2 500 €. Retenez le mot personnel. Et c'est l'erreur de tous.";
    const blocs = sim.decouperTexte(texte, formatAvocat.recetteScript);
    expect(texteScript(blocs)).toBe(texte);
    expect(blocs[0].blocRecette).toBe("accroche");
    expect(blocs.at(-1)!.blocRecette).toBe("boucle");
    expect(blocs.find((b) => b.blocRecette === "preuve")!.segments[0].texte).toMatch(/2 500 €/);
  });

  it("propose 5 accroches de types différents, notées", () => {
    const a = sim.accrochesSimulees("Contrôle routier", 5, "vous");
    expect(new Set(a.map((x) => x.type)).size).toBe(5);
    expect(a.every((x) => x.note > 0 && x.note <= 100 && x.justification)).toBe(true);
  });

  it("« bureau, costume bleu, debout » → trouvé, à créer avec un coût, non filmé avec un repli", () => {
    const p = sim.resoudreDistributionSimulee("bureau, costume bleu, debout", {
      decors: [{ id: "decor-bureau", nom: "Bureau sombre", motsCles: ["bureau"] }],
      tenues: [{ id: "veste-sombre", nom: "Veste sombre" }],
      postures: [{ posture: "assis", filmee: true }, { posture: "debout", filmee: false }],
    });
    expect(p).toEqual([
      { genre: "decor", etat: "trouve", id: "decor-bureau", libelle: "Bureau sombre" },
      { genre: "tenue", etat: "a-creer", libelle: "costume bleu", coutEstime: { centimes: 25, devise: "EUR" }, dureeEstimeeSec: 180 },
      { genre: "posture", etat: "non-filme", libelle: "Debout", repli: "assis" },
    ]);
  });
});

/* ------------------------------------------------------------------ */
describe("mention IA facultative, coupée par défaut, jamais bloquante (B.0 §1)", () => {
  it("défaut coupé ; brique « au choix, coupée » pour tous les formats", () => {
    expect(MENTION_IA_PAR_DEFAUT).toMatchObject({ incrustee: false, dansLegende: false });
    for (const f of formats.listerFormats({ inclureMasques: true })) {
      expect(f.briques["mention-ia"]).toBe("au-choix-coupee");
      expect(formats.briquesEffectives(f)["mention-ia"]).toBe(false);
      expect(formats.briquesEffectives(f, [], ["mention-ia"])["mention-ia"]).toBe(true);
      expect(formats.briquesCoupables(f)).toContain("mention-ia");
    }
    expect(formats.casesRequises(false)).toEqual(["image", "son", "sousTitres", "droits"]);
    expect(formats.casesRequises(true)).toHaveLength(5);
  });

  it("la commande ne force plus la légende ; le brouillon suit le RÉGLAGE (bug de la constante corrigé)", async () => {
    const c = await fabrication.construireCommande("v-03");
    expect(c.mentionIA.incrustee).toBe(false);
    expect(c.mentionIA.dansLegende).toBe(false);
    // Will allume la mention d'un geste, pour toutes les nouvelles vidéos :
    await ecrireParametre("mentionIA.parDefaut", { ...MENTION_IA_PAR_DEFAUT, incrustee: true });
    const id = await videos.creerBrouillon("avocat", { scriptId: "script-2" });
    expect((await depots().videos.obtenir(id))!.briquesAllumees).toEqual(["mention-ia"]);
    expect((await fabrication.construireCommande(id)).mentionIA.incrustee).toBe(true);
  });

  it("couper la mention sur une vidéo est consigné au journal", async () => {
    const id = await videos.creerBrouillon("avocat", { scriptId: "script-2" });
    await videos.modifierBrouillon(id, { briquesAllumees: ["mention-ia"] });
    await videos.modifierBrouillon(id, { briquesAllumees: [] });
    const journal = await depots().evenements.lister((e) => e.entiteId === id && e.type === "mention-ia");
    expect(journal.map((e) => e.message)).toEqual(["Mention IA allumée pour cette vidéo", "Mention IA coupée pour cette vidéo"]);
  });

  it("kit : 4 cases suffisent quand la mention est coupée", async () => {
    const kit = (await publications.obtenirKit("v-03"))!;
    expect(kit.mentionIAActive).toBe(false);
    // Licences à vérifier réglées (elles bloquent à part) : seule la logique des cases est testée ici.
    for (const l of kit.licencesABloquer) await depots().elements.modifier(l.id, { licence: { type: "libre", usageCommercial: true, reseaux: [] } });
    for (const cle of ["image", "son", "sousTitres", "droits"] as const) await publications.cocherAvantDePublier("v-03", cle, true);
    const apres = (await publications.obtenirKit("v-03"))!;
    expect(apres.avantDePublier.mentionIA).toBe(false);
    expect(apres.publiable).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
describe("musique interdite et styles avocat (B.0 §8, B.7)", () => {
  it("styles résolus avec leur valeur complète ; aucune musique, même si la vidéo en demande une", async () => {
    await depots().videos.modifier("v-03", { styles: { musiqueId: "mus-tension" } });
    const c = await fabrication.construireCommande("v-03");
    expect(c.styles.musique).toBeNull();
    expect(c.styles.sousTitres).toMatchObject({ id: "st-avocat-v1", valeur: { gabarit: "karaoke", police: "Poppins ExtraBold", positionPct: 48, chiffresAlignes: true } });
    expect(c.styles.styleMontage?.valeur).toMatchObject({ transitions: "coupe", dureePlanOuvertureSec: [1.5, 2.5], ecartCadrageMinPct: 15 });
    expect(c.styles.profilSon?.valeur).toMatchObject({ niveauCibleLufs: -14, creteVraieMaxDbtp: -1.5, traitementVoix: "sec", volumeMusique: 0 });
    expect(c.styles.habillage?.valeur).toMatchObject({ fin: false, logoAnime: false, grandTitre: false });
    // Lot M4 (décision de Will, `decors/CATALOGUE-DECORS.md`) : N1 Halo orange est le décor par défaut de l'avocat.
    expect(c.styles.decor).toMatchObject({ id: "decor-n1-halo-orange", valeur: { mode: "image", methode: "neutre-incruste", teinte: "#110A05" } });
    expect(c.styles.lut).toMatchObject({ id: "lut-avocat-v1", intensite: 70 });
    expect(c.recetteMontage?.cadrages.poitrineParDefautPct).toBe(120);
    expect(c.profilRealisme).toMatchObject({ grainPct: 4 });
  });

  it("une seule règle de musique pour l'écran et la commande ; rien pour un format sans musique", async () => {
    const elements = await depots().elements.lister();
    expect(formats.musiqueRetenue(formatAvocat, "mus-tension", elements)).toBeUndefined();
    expect(formats.musiqueRetenue(formats.obtenirFormat("podcast"), undefined, elements)).toBe("mus-nappe");
    expect(formats.musiqueRetenue(formats.obtenirFormat("podcast"), "mus-elan", elements)).toBe("mus-elan");
  });

  it("micro allumé : l'accessoire part dans la commande avec sa valeur", async () => {
    await depots().videos.modifier("v-03", { reglages: { repartitionAngles: "principal", micro: true, ouvertureSurIllustration: false } });
    const c = await fabrication.construireCommande("v-03");
    expect(c.accessoires?.map((a) => a.id)).toEqual(["acc-micro-podcast"]);
    expect(c.accessoires?.[0].valeur?.cote).toBe("regard");
  });
});

/* ------------------------------------------------------------------ */
describe("plusieurs visages par vidéo (B.0 §3-5)", () => {
  const visage = (id: string, angle: Visage["angle"], tenue: string, extra: Partial<Visage> = {}): Visage => ({
    id,
    personnageId: "p",
    nom: id,
    angle,
    tenue,
    fondTournage: "Fond gris",
    statut: "pret",
    fichierIds: [],
    fournisseur: "simulation",
    creeLe: "",
    modifieLe: "",
    ...extra,
  });

  it("même tenue et même posture : deux angles ; sinon « 1 angle, effet 2 caméras »", () => {
    const tq = visage("tq", "trois-quarts", "Veste sombre");
    const face = visage("face", "face", "veste  sombre");
    const autre = visage("autre", "face", "Chemise noire");
    expect(normaliserTenue("Veste sombre")).toBe(normaliserTenue("veste  sombre"));
    expect(resoudreVisagesParAngle({ visages: [tq, face, autre], principal: tq, partSecond: 0.15 })).toEqual({ visagesParAngle: { "trois-quarts": "tq", face: "face" }, modeAngles: "deux-angles", posture: "assis" });
    expect(resoudreVisagesParAngle({ visages: [tq, autre], principal: tq, partSecond: 0.15 }).modeAngles).toBe("un-angle");
    expect(resoudreVisagesParAngle({ visages: [tq, face], principal: tq, partSecond: 0 }).modeAngles).toBe("un-angle");
    expect(resoudreVisagesParAngle({ visages: [tq, visage("debout", "face", "Veste sombre", { posture: "debout" })], principal: tq, partSecond: 0.15 }).modeAngles).toBe("un-angle");
    expect(resoudreVisagesParAngle({ visages: [tq, { ...face, statut: "a_verifier" }], principal: tq, partSecond: 0.15 }).modeAngles).toBe("un-angle");
  });

  it("la commande porte les visages résolus, la répartition, et le fournisseur lu sur la VOIX", async () => {
    // Même tenue pour les deux doubles de Will : deux angles.
    await depots().visages.modifier("vis-will-face", { tenue: "Veste sombre", tenueId: "veste-sombre" });
    await depots().videos.modifier("v-03", { distribution: [{ role: "Face caméra", personnageId: "p-will", source: "double", visageId: "vis-will-34", voixId: "voix-will" }] });
    const c = await fabrication.construireCommande("v-03");
    const d = c.distribution[0];
    expect(d.modeAngles).toBe("deux-angles");
    expect(d.visagesParAngle).toEqual({ "trois-quarts": "vis-will-34", face: "vis-will-face" });
    expect(d.visagesResolus?.["trois-quarts"]).toMatchObject({ visageId: "vis-will-34", idExterne: "sim-visage-will-34", levresNote: 87, origine: "filme" });
    expect(d.repartitionAngles).toEqual({ principal: 0.85, second: 0.15 });
    expect(d.fournisseurVoix).toBe("simulation");
  });

  it("une voix qui ne sait pas produire un son seul est refusée à la fabrication (message clair)", async () => {
    const avant = fournisseurVoixSimulation.capacites.audioSeul;
    fournisseurVoixSimulation.capacites.audioSeul = false;
    try {
      await expect(fabrication.construireCommande("v-03")).rejects.toMatchObject({ code: "VOIX_INCOMPATIBLE" });
    } finally {
      fournisseurVoixSimulation.capacites.audioSeul = avant;
    }
  });
});

/* ------------------------------------------------------------------ */
describe("commande v2 et moteur figé au lancement (B.0 §7, B.1)", () => {
  it("versionContrat 2, moteur figé, plans enrichis, taux dollar → euro", async () => {
    const c = await fabrication.construireCommande("v-03");
    expect(c.versionContrat).toBe(2);
    expect(c.moteurId).toBe("simulation");
    expect(c.plans[0]).toHaveProperty("segmentId");
    expect(c.plans[0]).toHaveProperty("cadrage");
    expect(c.plans[0]).toHaveProperty("motsEnValeur");
    expect(c.tauxUsdEur).toBe(0.9);
    expect(c.profilRendu?.encadreOuverture?.a).toBe(3);
  });

  it("choix du moteur : réglage en base > environnement > format ; un moteur inconnu retombe sur le format", () => {
    expect(moteurs.choisirMoteurAuLancement("avocat", null)).toBe("simulation");
    // Lot M1 : le moteur `montage-avocat` est inscrit ; il n'est choisi que si le réglage le demande.
    expect(moteurs.choisirMoteurAuLancement("avocat", "montage-avocat")).toBe("montage-avocat");
    expect(moteurs.choisirMoteurAuLancement("avocat", "pas-encore-inscrit")).toBe("simulation");
    process.env.MOTEUR_AVOCAT = "inconnu";
    expect(moteurs.choisirMoteurAuLancement("avocat", null)).toBe("simulation");
    delete process.env.MOTEUR_AVOCAT;
    // Une commande lit SON moteur, jamais celui du format (v1 : celui du format).
    expect(moteurs.idMoteurDeCommande({ moteurId: "simulation", formatId: "avocat" })).toBe("simulation");
    expect(moteurs.idMoteurDeCommande({ formatId: "avocat" })).toBe("simulation");
    expect(moteurs.idMoteurDeCommande({ moteurId: "disparu", formatId: "inconnu" })).toBe("simulation");
  });

  it("tarifs du visage en dollars, convertis en euros par le taux figé dans la commande", async () => {
    expect(usdVersEur(700, 0.9)).toEqual({ centimes: 630, devise: "EUR" });
    const c = await fabrication.construireCommande("v-03");
    const e = await moteurs.moteurDeCommande(c).estimer(c);
    const principal = e.lignes.find((l) => l.etape === "Double, angle principal")!;
    expect(principal.prixUnitaire.centimes).toBe(Math.round(7 * 0.9));
    const plusCher = await moteurs.moteurDeCommande(c).estimer({ ...c, tauxUsdEur: 1.2 });
    expect(plusCher.total.centimes).toBeGreaterThan(e.total.centimes);
  });
});

/* ------------------------------------------------------------------ */
describe("ce que renvoie le moteur, maquette et statut « annulée » (B.0 §19, §23)", () => {
  it("appliquerProduitsDuMoteur : plans remplacés (anciens gardés), nouvelle version de sous-titres, pistes, éléments créés", async () => {
    const versionId = "v-03-ver-1";
    const avant = await depots().plans.compter((p) => p.versionId === versionId);
    const stAvant = await videos.sousTitresCourants(versionId);
    await travaux.appliquerProduitsDuMoteur(
      "v-03",
      versionId,
      {
        plans: [
          { ordre: 1, debutSec: 0, finSec: 1.8, texte: "Accroche", segmentId: "seg-1", sourceImage: "double", motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.4 }, zoom: 1, valeur: "large" }, transition: "coupe" },
          { ordre: 2, debutSec: 1.8, finSec: 3.8, texte: "Illustration", segmentId: "seg-2", sourceImage: "illustration", motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.4 }, zoom: 1 }, transition: "coupe", illustration: { source: "generee-ia", verrouille: false, candidats: [] }, motAncre: 4 },
        ],
        sousTitres: [{ id: "g1", debutSec: 0, finSec: 0.6, mots: [{ mot: "Accroche", debutSec: 0, finSec: 0.6 }] }],
        pistes: [{ type: "audio-maitre", fournisseur: "simulation", fichierCle: "/demo/essai-voix.mp3", empreinte: "abc" }],
        elementsCrees: [{ type: "illustration-video", nom: "Clip fabriqué", motsCles: ["route"], valeur: { type: "illustration-video" }, licence: { type: "generee-ia", usageCommercial: true, reseaux: [] }, formatsParDefaut: [], fichierCle: "/demo/motion-chiffres.mp4", planOrdre: 2 }],
      },
      "fr-FR",
    );
    const plans = await depots().plans.lister((p) => p.versionId === versionId);
    expect(plans.map((p) => p.segmentId)).toEqual(["seg-1", "seg-2"]);
    // Tous les anciens plans sont gardés, en copie d'archive (jamais écrasés par les nouveaux identifiants).
    expect(await depots().plans.compter((p) => p.versionId.startsWith(`${versionId}-avant-redecoupage-`) && !p.versionId.endsWith("-remplace"))).toBe(avant);
    const cree = await depots().elements.trouver((e) => e.nom === "Clip fabriqué");
    expect(cree?.fabrique).toBe(true);
    expect(plans.find((p) => p.ordre === 2)!.illustration?.elementId).toBe(cree!.id);
    const st = await videos.sousTitresCourants(versionId);
    expect(st!.version).toBe((stAvant?.version ?? 0) + 1);
    expect(await depots().sousTitres.compter((s) => s.versionId === versionId)).toBe(2);
    expect(await depots().pistes.trouver((p) => p.versionId === versionId && p.type === "audio-maitre")).toBeTruthy();
  });

  it("maquette : passe par le budget, crée une version « maquette » jamais comptée parmi les versions", async () => {
    const numeros = async () => (await videos.obtenirVideo("v-03"))!.versions.map((v) => v.numero);
    const avant = await numeros();
    await fabrication.maquetteRapide("v-03");
    expect(await depots().versions.compter((v) => v.videoId === "v-03" && v.statut === "maquette")).toBe(1);
    expect(await numeros()).toEqual(avant);
  });

  it("« Arrêter » laisse la vidéo « annulée » ; « Reprendre » la remet en brouillon", async () => {
    const { travailId } = await fabrication.lancerFabrication("v-03", { confirme: true });
    await travaux.annulerTravail(travailId);
    expect((await depots().videos.obtenir("v-03"))!.statut).toBe("annulee");
    expect((await depots().travaux.obtenir(travailId))!.statut).toBe("annule");
    await videos.reprendreVideo("v-03");
    expect((await depots().videos.obtenir("v-03"))!.statut).toBe("brouillon");
  });
});

/* ------------------------------------------------------------------ */
describe("contrats des fournisseurs simulés (B.0 §9, §10)", () => {
  it("voix : son seul + horodatage par mot, au débit de la recette ; capacités déclarées", async () => {
    expect(fournisseurVoixSimulation.capacites).toMatchObject({ audioSeul: true, horodatageMots: true });
    expect(fournisseurVoixSimulation.reelPrevu).toBe("HeyGen (ElevenLabs en secours)");
    const r = await fournisseurVoixSimulation.lire({ idExterne: "x", texte: "Un bon PV, puis un pépin.", reglages: { vitesse: 1, stabilite: 50, emotion: 50 }, prononciations: [{ mot: "PV", prononciation: "pé-vé" }], motsParSeconde: 4.4 });
    expect(r.mots.map((m) => m.mot)).toEqual(["Un", "bon", "pé-vé,", "puis", "un", "pépin."]);
    expect(r.mots.every((m, i) => m.finSec > m.debutSec && (i === 0 || m.debutSec >= r.mots[i - 1].finSec))).toBe(true);
    const existantes = await fournisseurVoixSimulation.listerVoixExistantes();
    expect(existantes.find((v) => v.typeClone === "pro")?.utilisable).toBe(false);
  });

  it("visage : rendu sur un audio, idempotent, suivi puis récupéré ; 1080 au plus, fond transparent", async () => {
    expect(fournisseurVisageSimulation.capacites).toMatchObject({ fondTransparent: true, resolutionMax: 1080, fpsSortie: 25 });
    const a = await fournisseurVisageSimulation.rendre({ visageId: "v", audioCle: "/demo/essai-voix.mp3", fond: "transparent", ratio: "9:16", cleIdempotence: "k1" });
    const b = await fournisseurVisageSimulation.rendre({ visageId: "v", audioCle: "/demo/essai-voix.mp3", fond: "transparent", ratio: "9:16", cleIdempotence: "k1" });
    expect(a.idTravailExterne).toBe(b.idTravailExterne);
    await expect(fournisseurVisageSimulation.rendre({ visageId: "v", audioCle: "", fond: "transparent", ratio: "9:16", cleIdempotence: "k2" })).rejects.toThrow();
    expect((await fournisseurVisageSimulation.creerLook({ visageId: "v", prompt: "costume bleu" })).statut).toBe("a_verifier");
  });

  it("illustrations : banques verticales seulement, avec licence ; animation payante", async () => {
    const r = await fournisseurIllustrationSimulation.chercher({ requete: "route", ratio: "9:16", dureeMinSec: 2, sources: ["pexels", "pixabay"] });
    expect(r).toHaveLength(2);
    expect(r.every((x) => x.hauteur > x.largeur && x.licence.usageCommercial)).toBe(true);
    expect(await fournisseurIllustrationSimulation.chercher({ requete: "route", ratio: "16:9", dureeMinSec: 2, sources: ["pexels"] })).toEqual([]);
    expect((await fournisseurIllustrationSimulation.animer({ imageCle: "x", dureeSec: 5 })).cout.centimes).toBeGreaterThan(0);
  });

  it("briques : la voix suit le débit du format ; le nettoyage raccourcit les blancs et décale les mots", async () => {
    const v = await briqueVoix.executer({ texte: "Un deux trois quatre.", motsParSeconde: 4.4 });
    expect(v.mots).toHaveLength(4);
    const n = await briqueNettoyageBlancs.executer({
      pisteVoixCle: "a",
      mots: [
        { mot: "Un", debutSec: 0.3, finSec: 0.5 },
        { mot: "deux", debutSec: 1.5, finSec: 1.7 },
      ],
      regles: { seuilMs: 180, cibleMs: [80, 120], fonduMs: [10, 20], teteMaxMs: 100 },
    });
    expect(n.mots[0].debutSec).toBeCloseTo(0.1, 5);
    expect(n.mots[1].debutSec - n.mots[0].finSec).toBeCloseTo(0.1, 5);
  });
});

/* ------------------------------------------------------------------ */
describe("migration de données au démarrage : idempotente, rien n'est supprimé (B.0)", () => {
  /** Une base « en ligne » d'avant le lot M0 : fond, décor sans mode, visage.decor, fondId, mention imposée. */
  function baseAncienne(): Depots {
    const d = reinitialiserDepots();
    const anciens = d as unknown as Record<string, unknown>;
    const elements = new DepotMemoire<ElementBibliotheque>([]);
    const maintenant = "2026-09-30T10:00:00.000Z";
    const base = { marqueId: "marque-axion", licence: { type: "propriete" as const, usageCommercial: true, reseaux: [] }, motsCles: [], creeLe: maintenant, modifieLe: maintenant };
    void elements.enregistrer({ ...base, id: "fond-noir-chaud", type: "fond", nom: "Noir chaud", valeur: { type: "fond", teinte: "#16120F" }, formatsParDefaut: ["avocat"] });
    void elements.enregistrer({ ...base, id: "decor-bureau", type: "decor", nom: "Bureau", valeur: { type: "decor", ambiance: "sombre" } as unknown as ElementBibliotheque["valeur"], vignetteFichierId: "f-bureau", formatsParDefaut: [] });
    void elements.enregistrer({ ...base, id: "st-axion-pop", type: "style-sous-titres", nom: "Axion pop", valeur: { type: "style-sous-titres", police: "Archivo Black", tailleRelative: 1, motsParLigne: 3, casse: "majuscules", animation: "pop", couleurAccent: "orange", position: "centre" }, formatsParDefaut: ["avocat", "motion"] });
    void elements.enregistrer({ ...base, id: "mus-tension", type: "musique", nom: "Tension", valeur: { type: "musique", ambiance: "tension-douce", tempoBpm: 96, dureeSec: 8 }, formatsParDefaut: ["avocat"] });
    anciens.elements = elements;
    return d;
  }

  it("convertit, installe, déplace les défauts et renomme ; une seconde passe ne change rien", async () => {
    const d = baseAncienne();
    const visage = (await d.visages.obtenir("vis-will-face"))!;
    const { fondTournage, ...sansFond } = visage;
    await d.visages.enregistrer({ ...sansFond, decor: fondTournage, tenueId: undefined, posture: undefined, origine: undefined } as unknown as Visage);
    await d.videos.modifier("v-07", { styles: { fondId: "fond-noir-chaud" } as never });
    await d.parametres.enregistrer({ id: "mentionIA.parDefaut", valeur: MENTION_IA_ANCIEN_DEFAUT, creeLe: "", modifieLe: "" });
    const comptes = async () => ({ elements: await d.elements.compter(), visages: await d.visages.compter(), videos: await d.videos.compter(), modeles: await d.modeles.compter() });
    const avant = await comptes();

    const r = await migrerDonnees(d, "2026-10-02T08:00:00.000Z");
    expect(r.elementsConvertis.sort()).toEqual(["decor-bureau", "fond-noir-chaud"]);
    expect(r.elementsAjoutes).toEqual(expect.arrayContaining(["st-avocat-v1", "sm-avocat-v1", "ps-avocat-v1", "hab-avocat-v1", "lut-avocat-v1", "acc-micro-podcast", "ton-piece-will"]));
    expect(r.elementsAjoutes).not.toContain("fond-noir-chaud");
    expect(r.defautsDeplaces).toEqual(expect.arrayContaining(["-st-axion-pop", "-mus-tension"]));
    expect(r.mentionMiseAJour).toBe(true);

    const fond = (await d.elements.obtenir("fond-noir-chaud"))!;
    expect(fond.type).toBe("decor");
    expect(fond.valeur).toMatchObject({ type: "decor", mode: "teinte", teinte: "#16120F", teinteLumiere: "#C65A2E" });
    expect(fond.formatsParDefaut).toContain("avocat");
    expect((await d.elements.obtenir("decor-bureau"))!.valeur).toMatchObject({ mode: "image", imageFichierId: "f-bureau", ambiance: "sombre" });
    expect((await d.elements.obtenir("st-axion-pop"))!.formatsParDefaut).toEqual(["motion"]);
    const v = (await d.visages.obtenir("vis-will-face"))! as Visage & { decor?: string };
    expect(v).toMatchObject({ fondTournage: "Fond noir", tenueId: "chemise-noire", posture: "assis", origine: "filme" });
    expect(v.decor).toBeUndefined();
    expect((await d.videos.obtenir("v-07"))!.styles).toEqual({ decorId: "fond-noir-chaud" });
    expect((await d.parametres.obtenir("mentionIA.parDefaut"))!.valeur).toEqual(MENTION_IA_PAR_DEFAUT);

    // Rien n'est supprimé : chaque collection garde au moins ses documents.
    const apres = await comptes();
    expect(apres.elements).toBeGreaterThanOrEqual(avant.elements);
    expect(apres.visages).toBe(avant.visages);
    expect(apres.videos).toBe(avant.videos);
    expect(apres.modeles).toBe(avant.modeles);

    // Idempotente : la seconde passe ne change rien.
    const seconde = await migrerDonnees(d, "2026-10-03T08:00:00.000Z");
    expect(seconde).toEqual({ elementsAjoutes: [], elementsConvertis: [], defautsDeplaces: [], visagesMigres: 0, videosMigrees: 0, modelesMigres: 0, mentionMiseAJour: false });
  });

  it("un réglage de mention modifié par Will n'est jamais remplacé", async () => {
    const d = baseAncienne();
    const choix = { ...MENTION_IA_ANCIEN_DEFAUT, texte: "Fait avec l'IA" };
    await d.parametres.enregistrer({ id: "mentionIA.parDefaut", valeur: choix, creeLe: "", modifieLe: "" });
    await migrerDonnees(d);
    expect((await d.parametres.obtenir("mentionIA.parDefaut"))!.valeur).toEqual(choix);
  });

  it("une base neuve (démonstration) est déjà à jour : rien à faire", async () => {
    // Lots A et B (étapes 12-15) : une base neuve reçoit leurs ajouts une première fois (rangés dans `lots`), puis plus rien.
    const { lots: _lots, ...r } = await migrerDonnees(depots());
    void _lots;
    expect(r).toEqual({ elementsAjoutes: [], elementsConvertis: [], defautsDeplaces: [], visagesMigres: 0, videosMigrees: 0, modelesMigres: 0, mentionMiseAJour: false });
    expect((await migrerDonnees(depots())).lots).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
describe("interfaces figées pour les lots M2 et M3 (lecture, demande de modification)", () => {
  it("vitesse de lecture : une phrase au-delà de 5,5 mots/s est signalée, jamais réécrite", async () => {
    const { phrasesTropDenses, phrasesDe, SEUIL_MOTS_PAR_SECONDE } = await import("@/domaine/lecture");
    expect(SEUIL_MOTS_PAR_SECONDE).toBe(5.5);
    const texte = "Une phrase calme. Celle-ci est très longue et dite beaucoup trop vite pour être lue.";
    expect(phrasesDe(texte)).toHaveLength(2);
    expect(phrasesTropDenses(texte, 4.4)).toEqual([]);
    const denses = phrasesTropDenses(texte, 4.4, [1, 1.5]);
    expect(denses.map((p) => p.index)).toEqual([1]);
    expect(denses[0].phrase).toBe("Celle-ci est très longue et dite beaucoup trop vite pour être lue.");
  });

  it("« Demander une modification » simulée : opérations typées, ou réponse claire hors capacités", () => {
    const plans = [
      { id: "p1", ordre: 1, texte: "Accroche", debutSec: 0, finSec: 2, sourceImage: "double" },
      { id: "p2", ordre: 2, texte: "Un hôpital la nuit", debutSec: 2, finSec: 4, sourceImage: "illustration" },
      { id: "p3", ordre: 3, texte: "La suite", debutSec: 4, finSec: 7, sourceImage: "double" },
    ];
    expect(sim.interpreterDemandeSimulee({ texte: "enlève l'image d'hôpital", plans }).operations).toEqual([{ type: "remplacerIllustration", planId: "p2" }]);
    expect(sim.interpreterDemandeSimulee({ texte: "plus de plans serrés au début", plans }).operations.map((o) => o.type)).toEqual(["changerCadrage", "changerCadrage"]);
    const tenue = sim.interpreterDemandeSimulee({ texte: "change la tenue", plans });
    expect(tenue.operations).toEqual([]);
    expect(tenue.horsCapacite).toMatch(/refaire la vidéo/);
  });
});
