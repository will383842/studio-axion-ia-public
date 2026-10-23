/**
 * Lot R6 « Calage et “je lis” réels » — partie MOTEUR (plan « outils réels » du 03/10, constats C5 et C6).
 *
 * C6 : caler la voix de synthèse la dégrade (mesure D3 : HeyGen tel quel 20,3 ms d'écart moyen, après calage 39,1 ms).
 *      Règle : la voix de synthèse n'est calée que sur demande (réglage `alignement.voixSynthese`, coupé par défaut), ou
 *      quand la voix ne donne pas d'horodatage des mots (on n'a alors qu'une estimation).
 * C5 : sans aligneur, les prises filmées (« je lis ») sont sous-titrées sur une ESTIMATION (le texte réparti sur la
 *      durée de la prise) : c'est désormais dit, par une alerte « Sous-titres approximatifs » visible sur la vidéo.
 *
 * Aligneur, voix et rendu injectés ; la réponse de l'aligneur est la sortie RÉELLE de `studio-aligneur` sur la voix
 * d'essai (lot D3, `tests/fixtures/d3-calage-voix-essai.json`). Aucun appel réseau, aucune dépense.
 * Les tests marqués ROUGE échouent sur `outils/r0` (48d6ad6) — preuve dans docs/OUTILS-REELS-R6.md.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.setConfig({ testTimeout: 60_000 });

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const { ecrireParametre } = await import("@/services/_commun");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { creerServiceRenduSimule } = await import("@/fournisseurs/simulation/rendu");
const { fournisseurVoixSimulation } = await import("@/fournisseurs/simulation/autres");
const { CarteQualite } = await import("@/components/videos/CarteQualite");
const { depots } = await import("@/donnees/memoire");
const boucle = await import("@/services/boucle");
const { empreinteAudioMaitre } = await import("@/moteurs/montage-avocat");

import type { BlocScript, CommandeFabrication, Travail, VoixBrutePayee } from "@/domaine/types";
import type { DemandeAlignement, DemandeRendu, EtatAlignement, EtatRendu, FournisseurAlignement, FournisseurVoix, ResultatAlignement, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import type { MoteurVideo, ResultatFabrication } from "@/moteurs";

const MDP = "essai-r6-calage";
const T0 = Date.UTC(2026, 9, 3, 14, 0, 0);
const CALE = JSON.parse(readFileSync(join(process.cwd(), "tests", "fixtures", "d3-calage-voix-essai.json"), "utf8")) as ResultatAlignement;
const APPROXIMATIFS = /Sous-titres approximatifs/;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  // 14/10 (voix de référence) : ce test porte sur le chemin de la voix SANS contrôle de ressemblance (réglage coupé) ;
  // l'avocat avec le contrôle actif est prouvé par tests/voix-reference/avocat.test.ts.
  await ecrireParametre("voix.ressemblance", { actif: false, relancesMax: 2 });
});

const stockage = (): StockageFichiers => ({
  id: "r2",
  type: "stockage",
  nom: "Stockage",
  reelPrevu: "R2",
  mode: "reel",
  capacites: { asynchrone: false, accordExige: false },
  preparerDepot: async () => ({ cleStockage: "x", urlDepot: "" }),
  confirmerDepot: async () => ({ ok: true }),
  urlLecture: async (cle) => `https://r2.exemple/${cle}`,
  urlLectureDuree: async (cle, sec) => `https://r2.exemple/${cle}?valable=${sec}`,
  urlDepotDuree: async (cle) => `https://r2.exemple/${cle}?depot`,
});

function fauxRendu(): ServiceRendu {
  const etats = new Map<string, EtatRendu>();
  return {
    async soumettre(d: DemandeRendu) {
      etats.set(d.idRendu, { statut: "termine", sortieCle: d.sortie.cle, mesures: d.operation === "composition" ? { largeur: 1080, hauteur: 1920, fps: 25, dureeSec: 11, lufs: -14 } : { dureeSec: 11 } });
      return { idRendu: d.idRendu };
    },
    etat: async (id) => etats.get(id) ?? { statut: "inconnu" },
  };
}

/**
 * Aligneur « réel » injecté : chaque soumission est notée ; il répond la sortie enregistrée de studio-aligneur, une
 * panne, ou (« echo ») les mots de la référence reçue, pour un calage réussi sur n'importe quel texte.
 */
function aligneurReel(reponse: "cale" | "panne" | "refus" | "echo" = "cale") {
  const demandes: DemandeAlignement[] = [];
  const a = {
    id: "studio-aligneur",
    type: "alignement",
    nom: "Calage des sous-titres",
    reelPrevu: "studio-aligneur",
    mode: "reel",
    capacites: { asynchrone: true, accordExige: false },
    soumettre: async (d: DemandeAlignement) => void demandes.push(d),
    suivre: async (): Promise<EtatAlignement> =>
      reponse === "echo"
        ? { statut: "termine", resultat: { mots: demandes.at(-1)!.reference!, motsNonAlignes: 0, modele: "essai", dureeCalculSec: 0 } }
        : reponse === "cale"
        ? { statut: "termine", resultat: CALE }
        : { statut: "echec", erreur: reponse === "panne" ? { code: "indisponible", reessayable: true, message: "panne" } : { code: "fichier-inaccessible", reessayable: false, message: "son illisible" } },
  } as unknown as FournisseurAlignement;
  return { demandes, aligneur: () => a };
}

/** La voix HeyGen (imitée, sans réseau) : réelle, avec horodatage des mots — ou sans horodatage (`mots: []`). */
function voixHeygen(avecHorodatage = true): () => FournisseurVoix {
  const v: FournisseurVoix = {
    ...fournisseurVoixSimulation,
    id: "heygen",
    mode: "reel",
    capacites: { ...fournisseurVoixSimulation.capacites, horodatageMots: avecHorodatage },
    async lire(d) {
      const r = await fournisseurVoixSimulation.lire(d);
      return { ...r, fichierCle: "studio/prod/voix/heygen-essai.mp3", ...(avecHorodatage ? {} : { mots: [] }) };
    },
  };
  return () => v;
}

/** Horloge partagée par le moteur et le rendu simulé (le rendu simulé avance avec elle). */
const horloge = { t: T0 };
const renduSimule = () => creerServiceRenduSimule(() => horloge.t);

async function voixJusquAuBout(m: MoteurVideo, c: CommandeFabrication): Promise<Travail> {
  horloge.t = T0;
  let t = await m.lancer(c, { travailId: "t-r6", versionId: "ver-r6", titre: "R6", maintenant: T0 });
  for (; horloge.t < T0 + 30 * 60_000 && t.etapes.find((e) => e.cle === "voix")?.statut !== "terminee"; horloge.t += 5_000) {
    t = (await m.avancer(t, c, horloge.t)).travail;
    if (t.statut === "echec") throw new Error(JSON.stringify(t.erreur));
  }
  return t;
}
const audioDe = (t: Travail) => (t.parametres?.voix as { phase: string; audio: { alignement?: { source: string } } }).audio;

async function jusquAuBout(m: MoteurVideo, c: CommandeFabrication): Promise<ResultatFabrication> {
  let travail = await m.lancer(c, { travailId: "t-r6-jl", versionId: "ver-r6-jl", titre: "Je lis", maintenant: T0 });
  let resultat: ResultatFabrication | undefined;
  for (let ms = T0; ms < T0 + 10 * 60_000; ms += 500) {
    const r = await m.avancer(travail, c, ms);
    travail = r.travail;
    resultat = r.resultat ?? resultat;
    if (travail.statut === "termine") return resultat!;
    if (travail.statut === "echec") throw new Error(JSON.stringify(travail.erreur));
  }
  throw new Error(`bloqué : ${travail.statut}`);
}

const SEGMENTS = [
  { id: "s1", texte: "Vous recevez un PV de 135 € ?" },
  { id: "s2", texte: "Surtout, ne le payez pas tout de suite." },
  { id: "s3", texte: "Je vous explique pourquoi, en trois points." },
];
const DITS = ["Vous recevez un pé vé de cent trente-cinq euros ?", "Surtout, ne le payez pas tout de suite.", "Je vous explique pourquoi, en trois points."];

/** Une vidéo « je lis » : une prise filmée de toute la version (même texte que la fixture du calage). */
async function commandeJeLis(): Promise<CommandeFabrication> {
  const c0 = await fabrication.construireCommande("v-03");
  const blocs: BlocScript[] = [
    { id: "b1", blocRecette: "accroche", segments: [SEGMENTS[0]] },
    { id: "b2", blocRecette: "coeur", segments: [SEGMENTS[1]] },
    { id: "b3", blocRecette: "appel", segments: [SEGMENTS[2]] },
  ];
  return {
    ...c0,
    script: { blocs, texteComplet: SEGMENTS.map((s) => s.texte).join(" ") },
    dureeCibleSec: 11,
    plans: [],
    prononciations: [],
    texteDitParSegment: DITS,
    distribution: [{ ...c0.distribution[0], source: "rush", modeAngles: "un-angle", visagesResolus: undefined }],
    briques: { ...c0.briques, illustrations: false },
    prises: [{ id: "p1", partie: "version", cle: "prises/0042-AV-TT-L-prise-1.mp4", mime: "video/mp4", dureeSec: 10.921, segmentIds: ["s1", "s2", "s3"] }],
  };
}

const messages = (r: ResultatFabrication) => ({
  note: r.noteQualite!.alertes.map((a) => a.message),
  sortie: r.sorties[0].rapportQualite.alertes.map((a) => a.message),
});

/* ------------------------------------------------------------------ */
describe("R6 · ROUGE — aligneur réel + voix HeyGen → aucune soumission (C6)", () => {
  it("la voix de synthèse garde son horodatage : rien n'est envoyé au calage, la vidéo continue", async () => {
    const al = aligneurReel();
    const m = creerMoteurMontageAvocat({ rendu: renduSimule(), stockage, alignement: al.aligneur, voix: voixHeygen() });
    const c = await fabrication.construireCommande("v-03");
    const t = await voixJusquAuBout(m, c);
    expect(al.demandes).toEqual([]);
    expect((t.parametres?.voix as { phase: string }).phase).toBe("faite");
    expect(audioDe(t).alignement).toBeUndefined();
  });
});

describe("R6 — quand la voix est calée quand même", () => {
  it("réglage « alignement.voixSynthese » allumé : la voix est calée (une seule demande), le rapport le dit", async () => {
    await ecrireParametre("alignement.voixSynthese", true);
    const al = aligneurReel();
    const m = creerMoteurMontageAvocat({ rendu: renduSimule(), stockage, alignement: al.aligneur, voix: voixHeygen() });
    const c = await fabrication.construireCommande("v-03");
    expect(c.entrees.calerVoixSynthese).toBe(true);
    const t = await voixJusquAuBout(m, c);
    expect(al.demandes).toHaveLength(1);
    expect(audioDe(t).alignement?.source).toBeDefined();
  });

  it("une voix SANS horodatage des mots (estimation seulement) est calée, sans réglage", async () => {
    const al = aligneurReel();
    const m = creerMoteurMontageAvocat({ rendu: renduSimule(), stockage, alignement: al.aligneur, voix: voixHeygen(false) });
    const t = await voixJusquAuBout(m, await fabrication.construireCommande("v-03"));
    expect(al.demandes).toHaveLength(1);
    expect(audioDe(t).alignement).toBeDefined();
  });

  it("le choix fait dans Réglages > Connexions (et le réglage de la voix) partent avec la commande, figés au lancement", async () => {
    let c = await fabrication.construireCommande("v-03");
    expect(c.entrees.fournisseurAlignement).toBeUndefined();
    expect(c.entrees.calerVoixSynthese).toBeUndefined();
    await ecrireParametre("fournisseur.alignement", "studio-aligneur");
    c = await fabrication.construireCommande("v-03");
    expect(c.entrees.fournisseurAlignement).toBe("studio-aligneur");
  });
});

/* ------------------------------------------------------------------ */
describe("R6 · ROUGE — prises filmées sans aligneur → alerte visible (C5)", () => {
  it("aligneur non relié : « Sous-titres approximatifs » sur la vidéo (note et chaque format), affiché par la carte Qualité", async () => {
    const m = creerMoteurMontageAvocat({ rendu: fauxRendu(), stockage });
    const r = await jusquAuBout(m, await commandeJeLis());
    const { note, sortie } = messages(r);
    expect(note.some((x) => APPROXIMATIFS.test(x))).toBe(true);
    expect(sortie.some((x) => APPROXIMATIFS.test(x))).toBe(true);
    expect(note.find((x) => APPROXIMATIFS.test(x))).toMatch(/Réglages > Connexions/);
    const html = renderToStaticMarkup(createElement(CarteQualite, { note: r.noteQualite! }));
    expect(html).toMatch(APPROXIMATIFS);
  });
});

describe("R6 — prises filmées : calées dès que l'aligneur est relié", () => {
  it("aligneur relié : la prise est calée sur son son, aucune alerte d'approximation", async () => {
    const al = aligneurReel();
    const m = creerMoteurMontageAvocat({ rendu: fauxRendu(), stockage, alignement: al.aligneur });
    const r = await jusquAuBout(m, await commandeJeLis());
    expect(al.demandes).toHaveLength(1);
    expect(al.demandes[0].audio).toContain("prises/0042-AV-TT-L-prise-1.mp4");
    const { note, sortie } = messages(r);
    expect([...note, ...sortie].some((x) => APPROXIMATIFS.test(x))).toBe(false);
  });

  it("aligneur relié mais en panne (3 essais) : la vidéo sort quand même, avec l'alerte", async () => {
    const al = aligneurReel("panne");
    const m = creerMoteurMontageAvocat({ rendu: fauxRendu(), stockage, alignement: al.aligneur });
    const r = await jusquAuBout(m, await commandeJeLis());
    expect(al.demandes).toHaveLength(3);
    const { note } = messages(r);
    expect(note.find((x) => APPROXIMATIFS.test(x))).toMatch(/n'a pas abouti/);
  });

  it("le réglage de la voix de synthèse ne change RIEN aux prises filmées (toujours calées si relié)", async () => {
    await ecrireParametre("alignement.voixSynthese", false);
    const al = aligneurReel();
    const m = creerMoteurMontageAvocat({ rendu: fauxRendu(), stockage, alignement: al.aligneur });
    await jusquAuBout(m, await commandeJeLis());
    expect(al.demandes).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
describe("R6 — relecture : voix réutilisée, panne définitive, adresses courtes, choix figés", () => {
  it("voix réutilisée d'une maquette tombée en panne, SANS horodatage : elle est calée (pas seulement la voix neuve)", async () => {
    const al = aligneurReel();
    const m = creerMoteurMontageAvocat({ rendu: fauxRendu(), stockage, alignement: al.aligneur, voix: voixHeygen(false), pauseMs: 0 });
    const c = await fabrication.construireCommande("v-03");
    const lue = await voixHeygen(false)().lire({ idExterne: "", texte: "Vous recevez un PV de 135 € ?", reglages: { vitesse: 1, stabilite: 45, emotion: 30 }, prononciations: [], motsParSeconde: 4.4 });
    const voixBrute = { fichierCle: lue.fichierCle, dureeSec: 3, mots: [{ mot: "Vous", debutSec: 0, finSec: 0.3 }], fournisseur: "heygen", caracteres: 30, empreinte: empreinteAudioMaitre(c), texte: "Vous recevez un PV de 135 € ?", motsEstimes: true };
    await m.maquette!(c, { voixBrute }).catch(() => undefined);
    expect(al.demandes).toHaveLength(1);
    // La même voix AVEC horodatage n'est pas calée (C6).
    const al2 = aligneurReel();
    const m2 = creerMoteurMontageAvocat({ rendu: fauxRendu(), stockage, alignement: al2.aligneur, voix: voixHeygen(), pauseMs: 0 });
    await m2.maquette!(c, { voixBrute: { ...voixBrute, motsEstimes: undefined } }).catch(() => undefined);
    expect(al2.demandes).toHaveLength(0);
  });

  it("maquette reprise APRÈS le calage (son déjà calé, panne de l'analyse) : la cause gardée est reprise, jamais recalculée", async () => {
    const c = await fabrication.construireCommande("v-03");
    // Studio-rendu en panne définitive : la maquette s'arrête à l'analyse du son, le son brut accompagne l'erreur.
    const renduEnPanne = (): ServiceRendu => ({
      soumettre: async (d: DemandeRendu) => ({ idRendu: d.idRendu }),
      etat: async () => ({ statut: "echec", erreur: { code: "indisponible", reessayable: false, message: "panne" } }),
    });
    const voixApres = async (aligneur: ReturnType<typeof aligneurReel>, voixBrute?: VoixBrutePayee) => {
      const m = creerMoteurMontageAvocat({ rendu: renduEnPanne(), stockage, alignement: aligneur.aligneur, voix: voixHeygen(false), pauseMs: 0 });
      const e = (await m.maquette!(c, voixBrute ? { voixBrute } : undefined).catch((x: unknown) => x)) as { voixBrute?: VoixBrutePayee };
      return e.voixBrute!;
    };
    // Voix sans horodatage, calée avec succès : plus rien d'approximatif, et pas de texte (le calage est fait).
    const calee = await voixApres(aligneurReel("echo"));
    expect(calee.texte).toBeUndefined();
    expect(calee.approximatif).toBeUndefined();
    expect(calee.motsEstimes).toBeUndefined();
    // Reprise : ni nouveau calage, ni « Reliez le calage » inventé.
    const al = aligneurReel("echo");
    const reprise = await voixApres(al, calee);
    expect(al.demandes).toHaveLength(0);
    expect(reprise.approximatif).toBeUndefined();
    // Calage sans succès : la cause « echec » est gardée telle quelle à la reprise (pas « non relié »).
    const ratee = await voixApres(aligneurReel("refus"));
    expect(ratee.approximatif).toBe("echec");
    expect((await voixApres(aligneurReel("echo"), ratee)).approximatif).toBe("echec");
  });

  it("panne NON réessayable : une seule demande, pas de nouvel essai ; la vidéo sort avec « Sous-titres approximatifs »", async () => {
    const al = aligneurReel("refus");
    const m = creerMoteurMontageAvocat({ rendu: fauxRendu(), stockage, alignement: al.aligneur });
    const r = await jusquAuBout(m, await commandeJeLis());
    expect(al.demandes).toHaveLength(1);
    expect(messages(r).note.find((x) => APPROXIMATIFS.test(x))).toMatch(/n'a pas abouti/);
  });

  it("panne NON réessayable sur la voix calée sur demande : une seule demande, horodatage de la voix gardé", async () => {
    await ecrireParametre("alignement.voixSynthese", true);
    const al = aligneurReel("refus");
    const m = creerMoteurMontageAvocat({ rendu: renduSimule(), stockage, alignement: al.aligneur, voix: voixHeygen() });
    const t = await voixJusquAuBout(m, await fabrication.construireCommande("v-03"));
    expect(al.demandes).toHaveLength(1);
    expect(audioDe(t).alignement?.source).toBe("voix");
  });

  it("l'aligneur reçoit des adresses du son valables 15 min (prises et voix), pas une heure", async () => {
    const al = aligneurReel();
    await jusquAuBout(creerMoteurMontageAvocat({ rendu: fauxRendu(), stockage, alignement: al.aligneur }), await commandeJeLis());
    await ecrireParametre("alignement.voixSynthese", true);
    await voixJusquAuBout(creerMoteurMontageAvocat({ rendu: renduSimule(), stockage, alignement: al.aligneur, voix: voixHeygen() }), await fabrication.construireCommande("v-03"));
    expect(al.demandes).toHaveLength(2);
    for (const d of al.demandes) expect(d.audio).toMatch(/\?valable=900$/);
  });

  it("travail lancé, PUIS calage et voix de synthèse changés : le travail garde les choix de son lancement", async () => {
    const { versionId } = await fabrication.lancerFabrication("v-03", { confirme: true });
    await ecrireParametre("fournisseur.alignement", "studio-aligneur");
    await ecrireParametre("alignement.voixSynthese", true);
    await boucle.tourDeBoucle();
    const figee = (await depots().versions.obtenir(versionId))!.commande;
    expect(figee.entrees.fournisseurAlignement).toBeUndefined();
    expect(figee.entrees.calerVoixSynthese).toBeUndefined();
    // Une nouvelle commande, elle, prend les nouveaux choix.
    const neuve = await fabrication.construireCommande("v-03");
    expect(neuve.entrees).toMatchObject({ fournisseurAlignement: "studio-aligneur", calerVoixSynthese: true });
  });
});
