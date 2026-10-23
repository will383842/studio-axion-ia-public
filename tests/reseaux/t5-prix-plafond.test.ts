/**
 * Formats par réseau, T5 (ARGENT) : un format ajouté d'office est dans le prix ANNONCÉ ; l'annoncé = le contrôlé au
 * lancement ; le 4:5 n'ajoute rien, ni à l'annoncé ni au réel. Le plafond réel <= annoncé n'est PAS prouvé ici
 * (simulation, marge de 10 % : MARGE_SIMULEE). Tout simulé : aucune clé, aucun appel payant. L'AVOCAT EST HORS T5 (décision de Will :
 * une session dédiée le traitera) : aucun 4:5 d'office, 9:16 comme avant ; la preuve « 4:5 ajouté » porte sur un format
 * fictif (podcast ouvert avec le 4:5). Le plafond en simulation tolère 10 % (MARGE_SIMULEE) ; le strict n'est pas prouvé.
 *  - création d'une vidéo (`creerBrouillon`) : format maître + préférés des réseaux par défaut ∩ capacités du moteur ;
 *    les générateurs à 9:16 seul et le face caméra (pastilles, T11) ne bougent pas ;
 *  - lancement (`construireCommande`) : les formats de la vidéo tels quels, rien n'est ajouté (un 4:5 décoché ne
 *    revient jamais) ;
 *  - « Fabriquer les N » (avocat, hors T5) : tout en 9:16 ; prix annoncé = prix
 *    contrôlé au lancement, et coût réel <= annoncé à 10 % près (MARGE_SIMULEE).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import { SUJETS_BANC } from "../generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const videos = await import("@/services/videos");
const scripts = await import("@/services/scripts");
const fabrication = await import("@/services/fabrication");
const bg = await import("@/services/boucle-generation");
const fr = await import("@/services/fabrication-reseaux");
const credits = await import("@/services/credits");
const boucle = await import("@/services/boucle");
const { ecrireParametre } = await import("@/services/_commun");
const { moteurDeCommande } = await import("@/moteurs");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { obtenirFormat } = await import("@/formats");

import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { DemandeRendu, EtatRendu, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import type { MoteurVideo, ResultatFabrication } from "@/moteurs";

const MDP = "t5-prix-plafond";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  credits.injecterLecteursPourEssai(null);
  await auth.seConnecter(MDP, false);
  await ecrireParametre("afficherExemples", false);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
});

afterEach(() => {
  bg.arreterBoucleGeneration();
  vi.useRealTimers();
});

/** Podcast (moteur « simulation », statut « bientôt ») ouvert le temps d'un essai, avec le 4:5 dans ses formats : un format fictif qui offre le 4:5 (coché à la main). */
async function avecPodcastEn45(essai: () => Promise<void>): Promise<void> {
  const format = obtenirFormat("podcast") as { statut: string; ratios: string[] };
  const { statut, ratios } = format;
  format.statut = "actif";
  format.ratios = [...ratios, "4:5"];
  try {
    await essai();
  } finally {
    format.statut = statut;
    format.ratios = ratios;
  }
}

async function brouillon(formatId: string): Promise<string> {
  const blocs = [{ id: "b1", blocRecette: "accroche", segments: [{ id: "s1", texte: "Votre employeur peut-il lire vos courriels ? La réponse est non, sauf exceptions. ".repeat(3) }] }];
  const scriptId = await scripts.enregistrerScript({ formatId, sujet: "Courriels au travail", blocs } as never);
  return videos.creerBrouillon(formatId, { scriptId });
}

describe("T5 · création d'une vidéo : formats voulus par les réseaux par défaut", () => {
  it("avocat (moteur avocat : 9:16, 4:5, 1:1), LinkedIn dans les réseaux par défaut : 9:16 seul (hors T5, décision de Will)", async () => {
    await ecrireParametre("moteur.avocat", "montage-avocat");
    const id = await brouillon("avocat");
    expect((await depots().videos.obtenir(id))!.ratios).toEqual(["9:16"]);
  });

  it("avocat sans LinkedIn dans les réseaux par défaut : 9:16 seul (comme avant)", async () => {
    await ecrireParametre("moteur.avocat", "montage-avocat");
    await ecrireParametre("reseaux.parDefaut", ["instagram", "tiktok"]);
    const id = await brouillon("avocat");
    expect((await depots().videos.obtenir(id))!.ratios).toEqual(["9:16"]);
    // Relecture n° 2 : le lancement n'ajoute rien non plus (LinkedIn conseillé par le format n'y change rien).
    expect((await fabrication.construireCommande(id)).ratios).toEqual(["9:16"]);
  });

  it("relecture n° 5 : podcast (format maître 16:9, formats 16:9 et 9:16, essai simulé) : jamais de 4:5 qu'il ne propose pas", async () => {
    // Le podcast est « bientôt » : ouvert le temps du test (sa définition, moteur « simulation », est celle du dépôt).
    const format = obtenirFormat("podcast") as { statut: string };
    const avant = format.statut;
    format.statut = "actif";
    try {
      const id = await brouillon("podcast");
      const ratios = (await depots().videos.obtenir(id))!.ratios;
      expect(ratios).not.toContain("4:5");
      expect(ratios).toEqual(["16:9", "9:16"]);
    } finally {
      format.statut = avant;
    }
  });

  it("3e tour n° 2 : format au moteur « simulation » : ses capacités sont bornées à ce qu'il propose (podcast : jamais de 4:5, ni pour une version LinkedIn)", async () => {
    const { capacitesRatios } = await import("@/services/formats-voulus");
    expect([...(await capacitesRatios("podcast"))].sort()).toEqual(["16:9", "9:16"]);
    expect(await fr.ratiosDeLaVersion({ formatId: "podcast", reseau: "linkedin" })).not.toContain("4:5");
    // L'avocat est hors T5 (décision de Will : une session dédiée le traitera) : aucune capacité ajoutée d'office.
    expect(await capacitesRatios("avocat")).toEqual([]);
    expect(await capacitesRatios("avocat", "montage-avocat")).toEqual([]);
    expect(await fr.ratiosDeLaVersion({ formatId: "avocat", reseau: "linkedin" })).toEqual(["9:16"]);
  });

  it("relecture n° 5 : les formats d'un modèle sont filtrés par ce que le format propose (pas seulement par le moteur)", async () => {
    const modele = (await depots().modeles.obtenir("mod-1"))!;
    await depots().modeles.enregistrer({ ...modele, id: "mod-t5", ratios: ["16:9", "9:16"] });
    const id = await videos.creerBrouillon("avocat", { modeleId: "mod-t5" });
    expect((await depots().videos.obtenir(id))!.ratios).toEqual(["9:16"]);
  });

  it("avocat en essai (moteur simulé, sait tout faire) : jamais de 16:9 ni de 4:5 d'office, même avec YouTube et LinkedIn (décision 3, avocat hors T5)", async () => {
    await ecrireParametre("reseaux.parDefaut", ["linkedin", "youtube"]);
    const id = await brouillon("avocat");
    expect((await depots().videos.obtenir(id))!.ratios).toEqual(["9:16"]);
  });

  it.each(["cas-concret", "facecam"])("%s : inchangé (9:16 seul ; face caméra : ses pastilles, T11)", async (formatId) => {
    const id = await brouillon(formatId);
    expect((await depots().videos.obtenir(id))!.ratios).toEqual(["9:16"]);
  });
});

describe("T5 · lancement : la commande garde les formats de la vidéo (4:5 posé à la création, jamais au lancement)", () => {
  it("avocat : aucun 4:5 d'office, la commande et le prix montré sont en 9:16", async () => {
    await ecrireParametre("moteur.avocat", "montage-avocat");
    const id = await brouillon("avocat");
    const c = await fabrication.construireCommande(id);
    expect(c.ratios).toEqual(["9:16"]);
    const avec = await moteurDeCommande(c).estimer(c);
    const apercu = await fabrication.apercuFabrication(id);
    expect(apercu.estimation.total.centimes).toBe(avec.total.centimes);
  });

  // La preuve « 4:5 ajouté d'office, dans la commande et dans le prix » porte sur un format fictif : le podcast (moteur
  // « simulation », bientôt), ouvert le temps du test avec le 4:5 dans ses formats.
  it("format fictif (podcast ouvert avec le 4:5) : LinkedIn en 9:16 n'ajoute plus le 4:5 ; le 4:5 coché est dans la commande et dans le prix montré", async () => {
    await avecPodcastEn45(async () => {
      const id = await brouillon("podcast");
      // Décision de Will du 19/10 : LinkedIn sort en 9:16, aucun réseau par défaut n'ajoute le 4:5.
      expect((await depots().videos.obtenir(id))!.ratios).toEqual(["16:9", "9:16"]);
      await depots().videos.modifier(id, { ratios: ["16:9", "9:16", "4:5"] });
      const c = await fabrication.construireCommande(id);
      expect(c.ratios).toEqual(["16:9", "9:16", "4:5"]);
      const sans = { ...c, ratios: c.ratios.filter((r) => r !== "4:5") };
      const avec = await moteurDeCommande(c).estimer(c);
      const apercu = await fabrication.apercuFabrication(id);
      expect(apercu.estimation.total.centimes).toBe(avec.total.centimes);
      // Ne vérifie que « avec 4:5 >= sans 4:5 » (le prix annoncé ne baisse pas quand on ajoute le 4:5).
      expect(avec.total.centimes).toBeGreaterThanOrEqual((await moteurDeCommande(sans).estimer(sans)).total.centimes);
    });
  });

  it("relecture n° 1 : le 4:5 décoché ne revient pas au lancement ; le prix montré compte le seul 9:16", async () => {
    await ecrireParametre("moteur.avocat", "montage-avocat");
    const id = await brouillon("avocat");
    await depots().videos.modifier(id, { ratios: ["9:16"] });
    const c = await fabrication.construireCommande(id);
    expect(c.ratios).toEqual(["9:16"]);
    const apercu = await fabrication.apercuFabrication(id);
    expect(apercu.estimation.total.centimes).toBe((await moteurDeCommande(c).estimer(c)).total.centimes);
    expect((await depots().videos.obtenir(id))!.ratios).toEqual(["9:16"]);
  });

  it("relecture n° 1 : essai simulé (format au moteur « simulation ») : le 4:5 décoché n'est pas facturé", async () => {
    const id = await brouillon("avocat");
    await depots().videos.modifier(id, { ratios: ["9:16"] });
    const c = await fabrication.construireCommande(id);
    expect(c.moteurId).toBe("simulation");
    expect(c.ratios).toEqual(["9:16"]);
  });

  it("un format choisi à la main n'est jamais retiré, et rien n'est ajouté au lancement", async () => {
    await ecrireParametre("moteur.avocat", "montage-avocat");
    const id = await brouillon("avocat");
    await depots().videos.modifier(id, { ratios: ["9:16", "1:1"] });
    expect((await fabrication.construireCommande(id)).ratios).toEqual(["9:16", "1:1"]);
  });
});

async function sujetValide(): Promise<string> {
  const r = await bg.lancerGeneration({ idee: SUJETS_BANC[0].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" as const });
  if (!r.ok) throw new Error("lancement de l'écriture");
  await bg.tourBoucleGeneration();
  const m = await depots().scriptsMaitres.obtenir(r.scriptMaitreId);
  if (m?.exception?.source === "proposition-machine") await bg.validerException(r.scriptMaitreId, "c-est-juste");
  const vs = await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId);
  await bg.validerVariantes(vs.map((v) => v.id));
  return r.scriptMaitreId;
}

async function ratiosDesSorties(videoId: string): Promise<string[]> {
  const v = (await depots().videos.obtenir(videoId))!;
  const versions = (await depots().versions.lister((x) => x.videoId === videoId && x.statut !== "maquette")).sort((a, b) => a.numero - b.numero);
  const courante = versions.find((x) => x.id === v.versionChoisieId) ?? versions.at(-1);
  if (!courante) return [];
  return [...new Set((await depots().sorties.lister((s) => s.versionId === courante.id)).map((s) => s.ratio))].sort();
}

describe("T5 · « Fabriquer les N » (moteur avocat, hors T5) : tout en 9:16, prix annoncé = contrôlé", () => {
  it("annoncé = contrôlé au lancement, réel dans la marge de la simulation (≤ annoncé × 1,1) ; aucune sortie en 4:5, même LinkedIn", async () => {
    await ecrireParametre("moteur.avocat", "montage-avocat");
    const id = await sujetValide();
    const plan = (await fr.planFabricationSujet(id))!;
    // Aucune option cochée, et l'avocat n'en reçoit aucune d'office.
    expect(plan.ratiosOption).toEqual([]);
    const res = await fr.fabriquerLesN(id, { operationId: "op-t5", lancer: true, totalConfirme: plan.total.centimes });
    const mere = (await depots().videos.obtenir(res.mereVideoId))!;
    expect(mere.ratios).toEqual(["9:16"]);
    for (const vid of res.videoIds.slice(1)) {
      const v = (await depots().videos.obtenir(vid))!;
      expect(v.ratios, v.titre).toEqual(["9:16"]);
    }
    vi.useFakeTimers({ toFake: ["Date"] });
    for (let i = 0; i < 400; i++) {
      vi.setSystemTime(Date.now() + 5_000);
      await boucle.tourDeBoucle();
      const vids = await Promise.all(res.videoIds.map((x) => depots().videos.obtenir(x)));
      if (vids.every((x) => x?.statut === "prete")) break;
    }
    vi.useRealTimers();
    for (const version of plan.versions) {
      const video = (await depots().videos.lister((x) => x.varianteId === version.varianteId))[0];
      expect(video?.statut, version.code).toBe("prete");
      // Annoncé = contrôlé au lancement (même chemin de commande).
      expect(video?.coutEstime?.centimes, version.code).toBe(version.cout.centimes);
      // Relecture A2 : réel comparé à l'annoncé, vidéo par vidéo. En simulation, le « réel » des étapes simulées est
      // l'estimation à ±10 % (`lignesSimuleesReelles`, moteur avocat) : il peut dépasser l'annoncé de 9 % au plus, sans
      // rapport avec T5 (constaté : 54 annoncés, 58 « réels »). Le plafond strict n'est pas prouvé ici.
      expect(video?.coutReel, version.code).toBeDefined();
      expect(video!.coutReel!.centimes, version.code).toBeLessThanOrEqual(Math.ceil(version.cout.centimes * MARGE_SIMULEE));
      expect(await ratiosDesSorties(video!.id), version.code).toEqual(["9:16"]);
    }
  }, 120_000);
});

/** Écart permis en simulation : le « réel » simulé est l'estimation × 0,90 à 1,09 (`lignesSimuleesReelles`). */
const MARGE_SIMULEE = 1.1;

async function versionDuReseau(scriptMaitreId: string, reseau: string) {
  return (await depots().variantes.lister((v) => v.scriptMaitreId === scriptMaitreId && v.reseau === reseau && !v.archiveLe && v.etat === "validee"))[0];
}

describe("T5 · relecture n° 4 : formats de la mère et des versions (moteur avocat)", () => {
  it("LinkedIn dans les versions mais pas dans le brief : l'avocat reste en 9:16 seul, mère comprise (hors T5)", async () => {
    await ecrireParametre("moteur.avocat", "montage-avocat");
    const id = await sujetValide();
    const m = (await depots().scriptsMaitres.obtenir(id))!;
    await depots().scriptsMaitres.modifier(id, { brief: { ...m.brief, reseaux: ["instagram", "tiktok"] } });
    expect(await versionDuReseau(id, "linkedin")).toBeDefined();
    const res = await fr.fabriquerLesN(id, { operationId: "op-t5-union", lancer: false });
    expect((await depots().videos.obtenir(res.mereVideoId))!.ratios).toEqual(["9:16"]);
    for (const vid of res.videoIds.slice(1)) {
      const v = (await depots().videos.obtenir(vid))!;
      expect(v.ratios, v.titre).toEqual(["9:16"]);
    }
  });

  it("mère déjà faite avant T5 (9:16 seul) : les versions restent dans les formats de la mère, au prix comme à la fabrication", async () => {
    await ecrireParametre("moteur.avocat", "montage-avocat");
    const id = await sujetValide();
    const avant = (await fr.planFabricationSujet(id))!;
    const mere = avant.mere;
    expect(mere.reseau).not.toBe("linkedin");
    const mereVideoId = await videos.creerBrouillon("avocat", { reseaux: ["instagram"] });
    expect((await depots().videos.obtenir(mereVideoId))!.ratios).toEqual(["9:16"]);
    await depots().variantes.modifier(mere.varianteId, { videoId: mereVideoId });
    const plan = (await fr.planFabricationSujet(id))!;
    // Le prix de la version LinkedIn est celui d'une version en 9:16 seul.
    const linkedin = plan.versions.find((x) => x.reseau === "linkedin")!;
    const instagram = plan.versions.find((x) => x.reseau !== "linkedin" && x.role !== "mere" && Math.abs(x.dureeSec - linkedin.dureeSec) < 1);
    if (instagram) expect(linkedin.cout.centimes).toBe(instagram.cout.centimes);
    const res = await fr.fabriquerLesN(id, { operationId: "op-t5-mere-avant", lancer: false });
    expect(res.mereVideoId).toBe(mereVideoId);
    for (const vid of res.videoIds.slice(1)) {
      const v = (await depots().videos.obtenir(vid))!;
      expect(v.ratios, v.titre).toEqual(["9:16"]);
    }
  });
});

describe("T5 · « Fabriquer cette version » (avocat, hors T5) : les formats du brouillon sont ceux du prix (relectures n° 7 et A3)", () => {
  it("nouveau brouillon : les formats de la version, par la même règle que `verifierAvantDeCreer`", async () => {
    await ecrireParametre("moteur.avocat", "montage-avocat");
    const id = await sujetValide();
    const v = (await versionDuReseau(id, "linkedin"))!;
    const r = await bg.fabriquerVariante(v.id, { operationId: "op-t5-version", lancer: false });
    const attendus = await fr.ratiosDeLaVersion(v);
    expect(attendus).toEqual(["9:16"]);
    expect((await depots().videos.obtenir(r.videoId))!.ratios).toEqual(attendus);
  });

  it("brouillon REPRIS (lancement refusé plus tôt, en 9:16 seul) : il garde le 9:16 annoncé, sans 4:5", async () => {
    await ecrireParametre("moteur.avocat", "montage-avocat");
    const id = await sujetValide();
    const v = (await versionDuReseau(id, "linkedin"))!;
    const ancien = await videos.creerBrouillon("avocat", { reseaux: ["instagram"] });
    await depots().videos.modifier(ancien, { statut: "archivee", statutAvantArchive: "brouillon", ratios: ["9:16"] });
    await ecrireParametre(`generateur.brouillon-de-version.${v.id}`, ancien);
    const r = await bg.fabriquerVariante(v.id, { operationId: "op-t5-reprise", lancer: false });
    expect(r.videoId).toBe(ancien);
    expect((await depots().videos.obtenir(ancien))!.ratios).toEqual(["9:16"]);
  });

  it("tournage : la vidéo de la version reçoit les formats du prix", async () => {
    await ecrireParametre("moteur.avocat", "montage-avocat");
    const id = await sujetValide();
    const v = (await versionDuReseau(id, "linkedin"))!;
    const tournage = await import("@/services/tournage");
    const rush = { id: "rush-t5", nom: "prise 1", fichierId: "f-t5", dureeSec: 30, motsCles: [], creeLe: new Date().toISOString(), modifieLe: new Date().toISOString() };
    const videoId = await tournage.ajouterPriseAVideo(v, rush as never);
    expect((await depots().videos.obtenir(videoId))!.ratios).toEqual(await fr.ratiosDeLaVersion(v));
    expect((await depots().videos.obtenir(videoId))!.ratios).toEqual(["9:16"]);
  });
});

/* ------------------------------------------------------------------ */
/* Plafond en montage réel : le format ajouté ne coûte rien de plus     */
/* ------------------------------------------------------------------ */

const T0 = Date.UTC(2026, 9, 18, 9, 0, 0);

const stockageSigne = (): StockageFichiers => ({
  id: "r2",
  type: "stockage",
  nom: "Stockage",
  reelPrevu: "R2",
  mode: "reel",
  capacites: { asynchrone: false, accordExige: false },
  preparerDepot: async () => ({ cleStockage: "x", urlDepot: "" }),
  confirmerDepot: async () => ({ ok: true }),
  urlLecture: async (cle) => `https://r2.exemple/${cle}?court`,
  urlLectureDuree: async (cle, s) => `https://r2.exemple/${cle}?valable=${s}`,
  urlDepotDuree: async (cle, s) => `https://r2.exemple/${cle}?depot=${s}`,
});

const MESURES_BONNES = { largeur: 1080, hauteur: 1920, fps: 25, dureeSec: 30, taille: 52_000_000, debitKbps: 14_050, bt709: 1, plageTv: 1, yuv420p: 1, profilHigh: 1, niveau: 41, faststart: 1, imageNoireTete: 0, lufs: -14.1, lra: 2.2, creteVraieDbtp: -2.0, pauses: 9, pauseMinDb: -44, pauseMaxDb: -41 };

/** studio-rendu injecté (montage RÉEL) : chaque demande se termine au tour suivant. */
function fauxRendu() {
  const recues: DemandeRendu[] = [];
  const etats = new Map<string, EtatRendu>();
  const service: ServiceRendu = {
    async soumettre(d) {
      recues.push(d);
      etats.set(d.idRendu, { statut: "termine", sortieCle: d.sortie.cle, mesures: d.operation === "composition" ? MESURES_BONNES : undefined });
      return { idRendu: d.idRendu };
    },
    etat: async (id) => etats.get(id) ?? { statut: "inconnu" },
  };
  return { service, compositions: () => recues.filter((d) => d.operation === "composition") };
}

async function jusquAuBout(moteur: MoteurVideo, c: CommandeFabrication, t: Travail): Promise<{ travail: Travail; resultat?: ResultatFabrication }> {
  let travail = t;
  let resultat: ResultatFabrication | undefined;
  for (let ms = T0; ms < T0 + 10 * 60_000; ms += 500) {
    const r = await moteur.avancer(travail, c, ms);
    travail = r.travail;
    resultat = r.resultat ?? resultat;
    if (travail.statut === "termine" || travail.statut === "echec") return { travail, resultat };
  }
  throw new Error(`bloqué : ${travail.statut}`);
}

const somme = (lignes: { total: { centimes: number } }[]): number => lignes.reduce((t, l) => t + l.total.centimes, 0);

describe("T5 · plafond en montage réel (moteur avocat, studio-rendu injecté)", () => {
  // Relecture A2 : deux vidéos de démonstration (v-03 : 9:16 seul ; v-04 : 9:16 + carré), auxquelles le 4:5 est ajouté
  // à la main (l'avocat n'en reçoit plus d'office : preuve sur le moteur, pas sur le défaut). Le total réel est comparé au total annoncé (plafond), pas seulement les écarts.
  it.each([
    ["v-03", ["9:16"]],
    ["v-04", ["9:16", "1:1"]],
  ] as const)("%s : un 4:5 ajouté : 0 € annoncé de plus, 0 € réel de plus, même écart réel − annoncé qu'en 9:16, aucun fournisseur payant de plus", async (videoId, sansLe45) => {
    await depots().videos.modifier(videoId, { ratios: [...sansLe45, "4:5"] });
    const c = await fabrication.construireCommande(videoId);
    expect(c.ratios).toEqual([...sansLe45, "4:5"]);
    const cSans: CommandeFabrication = { ...c, ratios: [...sansLe45] };
    const avec = fauxRendu();
    const sans = fauxRendu();
    const mAvec = creerMoteurMontageAvocat({ rendu: avec.service, stockage: stockageSigne });
    const mSans = creerMoteurMontageAvocat({ rendu: sans.service, stockage: stockageSigne });
    const annonceAvec = await mAvec.estimer(c);
    const annonceSans = await mSans.estimer(cSans);
    const rAvec = await jusquAuBout(mAvec, c, await mAvec.lancer(c, { travailId: `t-t5-avec-${videoId}`, versionId: `ver-t5-avec-${videoId}`, titre: "T5", maintenant: T0 }));
    const rSans = await jusquAuBout(mSans, cSans, await mSans.lancer(cSans, { travailId: `t-t5-sans-${videoId}`, versionId: `ver-t5-sans-${videoId}`, titre: "T5", maintenant: T0 }));
    expect(rAvec.travail.statut).toBe("termine");
    expect(rSans.travail.statut).toBe("termine");
    // Le 4:5 est bien fabriqué : une composition de plus, un fichier 4:5.
    expect(avec.compositions().length).toBe(sans.compositions().length + 1);
    expect(rAvec.resultat!.sorties.map((x) => x.ratio).sort()).toEqual([...sansLe45, "4:5"].sort());
    const reelAvec = somme(rAvec.resultat!.lignesReelles);
    const reelSans = somme(rSans.resultat!.lignesReelles);
    // Total réel comparé au total annoncé. Ici la voix et le double sont des doubles SIMULÉS : la voix simulée est
    // annoncée 0 € mais « payée » (0,40 € pour v-03), le double simulé « coûte » son estimation × 0,90 à 1,09. Constaté
    // sans le 4:5 comme avec : v-03 328 c réels pour 277 annoncés. Ce n'est pas T5 (ancien comportement de la
    // simulation, signalé dans la PR) : ce test prouve que l'écart réel − annoncé est le MÊME avec et sans le 4:5, et
    // que chaque étape payante reste dans la marge de la simulation.
    expect(reelAvec - annonceAvec.total.centimes).toBe(reelSans - annonceSans.total.centimes);
    for (const l of rAvec.resultat!.lignesReelles.filter((x) => x.etape !== "Voix")) {
      const annoncee = annonceAvec.lignes.find((x) => x.etape === l.etape);
      expect(annoncee, l.etape).toBeDefined();
      expect(l.total.centimes, l.etape).toBeLessThanOrEqual(Math.ceil(annoncee!.total.centimes * MARGE_SIMULEE));
    }
    // Le 4:5 ne fait payer aucun fournisseur (composition sur notre serveur) : rien de plus annoncé, rien de plus réel.
    expect(annonceAvec.total.centimes - annonceSans.total.centimes).toBe(0);
    expect(reelAvec - reelSans).toBe(0);
    // Les fournisseurs payants (voix, double) ne sont pas appelés une fois de plus pour le 4:5.
    const payants = (r: ResultatFabrication) => r.lignesReelles.filter((l) => l.etape === "Voix" || /^Double/.test(l.etape)).map((l) => [l.etape, l.quantite]);
    expect(payants(rAvec.resultat!)).toEqual(payants(rSans.resultat!));
  }, 60_000);
});
