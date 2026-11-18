/**
 * S-01 — une panne « non relié » RENDUE par un moteur (rien n'a été payé avant) attend et repart seule (24 h au plus),
 * au lieu de finir en « échec ». Chemin réel : `lireTravauxAAvancer` → `moteur.avancer` → `ecrireAvancement`, dépôts en
 * mémoire, moteurs RÉELS (tableau, face caméra), horloge pilotée (seul `Date` est truqué). Aucun réseau, 0 €.
 */
import { hash } from "@node-rs/argon2";
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { MoteurVideo } from "@/moteurs";
import type { FicheTableau } from "../../src/moteurs/montage-tableau/fiche";
import type { ContexteTableau } from "../../src/moteurs/montage-tableau/regles";
import { creerFacecamSimule } from "@/fournisseurs/facecam";
import { versOutils } from "../tableau/moteur/doubles";
import { doubles } from "../tableau/fabriquer/doubles";
import { texteScriptDe } from "../tableau/regles/exemples";
import { doubles as doublesCC } from "../cas-concret/fabriquer/doubles";
import { commandeCasConcret, versOutils as versOutilsCC } from "../cas-concret/moteur/doubles";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const travaux = await import("@/services/travaux");
const couts = await import("@/services/couts");
const { horodatage } = await import("@/services/_commun");
const { creerMoteurMontageTableau } = await import("@/moteurs/montage-tableau");
const { commandeTableau } = await import("@/moteurs/montage-tableau/fabriquer");
const { creerMoteurMontageFacecam } = await import("@/moteurs/montage-facecam");
const { creerMoteurMontageFacecamAnimee } = await import("@/moteurs/montage-facecam-animee");
const { creerMoteurMontageImageVideo } = await import("@/moteurs/montage-image-video");
const { creerMoteurMontageCasConcret } = await import("@/moteurs/montage-cas-concret");
const { choisirFinTableau } = await import("@/services/tableau-fin");
const { sortiesDesReseaux } = await import("@/moteurs/montage-tableau/formats-sortie");

const MDP = "s-01-pannes";
const T0 = Date.parse("2026-11-18T10:00:00.000Z");
const reelle = JSON.parse(readFileSync(new URL("../tableau/temoins/fiche-consigne-ia-prod.json", import.meta.url), "utf8")) as FicheTableau;
const TITRE_ATTENTE = "Une vidéo attend un outil";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  await auth.seConnecter(MDP, false);
  dejaLues = new Set((await depots().notifications.lister(() => true)).map((n) => n.id));
  for (const x of await depots().travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
});

afterEach(() => {
  vi.useRealTimers();
});

/* --- Aides ------------------------------------------------------------ */

const reservationsActives = (id: string) => depots().reservations.compter((r) => r.travailId === id && r.statut === "active");
let dejaLues = new Set<string>();
const notifs = async (type: string) => (await depots().notifications.lister((n) => n.type === type && !dejaLues.has(n.id))).filter((n) => type !== "info" || n.titre === TITRE_ATTENTE);

/** Pose un vrai travail de la vidéo d'exemple v-03, mais fabriqué par `moteur` avec `commande`, avec sa réservation. */
async function installer(moteur: MoteurVideo, commande: CommandeFabrication): Promise<{ id: string; videoId: string }> {
  const { travailId } = await fabrication.lancerFabrication("v-03", { confirme: true });
  const t = (await depots().travaux.obtenir(travailId))!;
  await depots().versions.modifier(t.versionId!, { commande });
  const neuf = await moteur.lancer(commande, { travailId: t.id, versionId: t.versionId!, titre: t.titre });
  await depots().travaux.enregistrer({ ...t, ...neuf, id: t.id, cibleId: t.cibleId, versionId: t.versionId, estDemo: t.estDemo });
  await depots().reservations.enregistrer({ id: `res-${t.id}`, fournisseur: "fal", videoId: t.cibleId, travailId: t.id, centimes: 120, devise: "USD", statut: "active", ...horodatage() });
  await couts.engagerBudget(t.id, { centimes: 100, devise: "EUR" }, t.cibleId);
  return { id: t.id, videoId: t.cibleId };
}

/** Un tour de la boucle de fond à l'instant donné : renvoie le nombre de travaux lus. */
async function tour(moteur: MoteurVideo, instant: number): Promise<number> {
  vi.setSystemTime(instant);
  const lus = await travaux.lireTravauxAAvancer(instant, () => moteur);
  for (const lu of lus) await travaux.ecrireAvancement(lu, await lu.moteur.avancer(structuredClone(lu.travail), lu.commande, instant));
  return lus.length;
}

/* --- Tableau (moteur réel) ------------------------------------------- */

function montageTableau() {
  const sorties = sortiesDesReseaux(["verticaux"]);
  const d = doubles(reelle);
  const fiches = new Map<string, FicheTableau>([[`studio/dev/fiches/${reelle.videoId}/1.json`, structuredClone(reelle)]]);
  const ids = [...new Set(reelle.scenes.flatMap((s) => s.elements).flatMap((e) => (e.type === "preuve" ? [e.preuveId] : [])))];
  const contexte = { aujourdhui: "2026-10-12", sourcesChiffres: [], preuves: [], matieres: ids.map((id) => ({ id, type: "demonstration", statut: "validee", perimeLe: "2027-01-09" })) } as unknown as Omit<ContexteTableau, "texteScript">;
  const etat = { relie: false };
  const outils = async () => (etat.relie ? versOutils(d, fiches, { contexte, choisirFin: choisirFinTableau({}, { sorties, mot: "CONSIGNE" }) }) : null);
  const moteur = creerMoteurMontageTableau({ outils });
  const cle = `studio/dev/fiches/${reelle.videoId}/1.json`;
  const commande: CommandeFabrication = {
    ...commandeTableau({ videoId: reelle.videoId, fiche: reelle, texteScript: texteScriptDe(reelle), dureeSec: 60, centreSousTitresPct: 80, scenes: [], personnageId: "williams" }),
    entrees: { tableau: { ficheScenesCle: cle, empreinte: "e1", version: 1, sorties, mot: "CONSIGNE", dejaVu: { coche: true, le: "2026-10-12" } } },
  };
  return { d, etat, moteur, commande };
}

async function messageDuMoteur(moteur: MoteurVideo, travailId: string): Promise<{ code?: string; message?: string }> {
  const t = (await depots().travaux.obtenir(travailId))!;
  const commande = (await depots().versions.obtenir(t.versionId!))!.commande;
  const { travail } = await moteur.avancer(structuredClone({ ...t, reprise: undefined }), commande, T0);
  return { code: travail.erreur?.code, message: travail.erreur?.messagePourWill };
}

describe("tableau : TABLEAU_NON_RELIE rendu par le moteur réel", () => {
  it("a) le serveur est coupé : le travail attend (30 s), la vidéo reste en fabrication, la réservation est gardée, 1 notification « attend un outil »", async () => {
    const m = montageTableau();
    const { id, videoId } = await installer(m.moteur, m.commande);
    expect(await tour(m.moteur, T0)).toBe(1);
    const t = (await depots().travaux.obtenir(id))!;
    expect(t.statut).toBe("en_cours");
    expect(t.erreur).toBeUndefined();
    expect(t.reprise).toMatchObject({ echecs: 1, prochainEssai: new Date(T0 + 30_000).toISOString() });
    expect((await depots().videos.obtenir(videoId))?.statut).toBe("en_fabrication");
    expect(await reservationsActives(id)).toBe(1);
    expect(await notifs("info")).toHaveLength(1);
    expect(await notifs("echec")).toHaveLength(0);
    expect(m.d.lectures()).toBe(0);
  });

  it("b) les outils reviennent : rien avant le prochain essai, puis la fabrication repart, la voix n'est lue qu'une fois, aucune notification de plus", { timeout: 120_000 }, async () => {
    const m = montageTableau();
    const { id } = await installer(m.moteur, m.commande);
    await tour(m.moteur, T0);
    m.etat.relie = true;
    expect(await tour(m.moteur, T0 + 10_000)).toBe(0);
    let instant = T0 + 31_000;
    for (let n = 0; n < 200; n++) {
      if ((await depots().travaux.obtenir(id))?.statut === "termine" || (await depots().travaux.obtenir(id))?.statut === "echec") break;
      await tour(m.moteur, instant);
      instant += 1_000;
    }
    const fin = (await depots().travaux.obtenir(id))!;
    expect(fin.statut).not.toBe("echec");
    expect(fin.erreur).toBeUndefined();
    // Témoin : la même fabrication sans aucune coupure lit la voix autant de fois (rien n'est payé deux fois).
    const temoin = montageTableau();
    temoin.etat.relie = true;
    let tw: Travail = await temoin.moteur.lancer(temoin.commande, { travailId: "trav-temoin", versionId: "ver-temoin", titre: "Témoin" });
    for (let n = 0; n < 200 && tw.statut !== "termine"; n++) tw = (await temoin.moteur.avancer(structuredClone(tw), temoin.commande, T0 + n)).travail;
    expect(tw.statut).toBe("termine");
    expect(temoin.d.lectures()).toBeGreaterThan(0);
    expect(m.d.lectures()).toBe(temoin.d.lectures());
    expect(fin.etapes.some((e) => e.statut === "terminee")).toBe(true);
    expect(await notifs("info")).toHaveLength(1);
    expect(await notifs("echec")).toHaveLength(0);
  });

  it("c) 24 h de « non relié » : l'échec arrive avec la phrase du moteur, réservation libérée, UNE notification d'échec", async () => {
    const m = montageTableau();
    const { id, videoId } = await installer(m.moteur, m.commande);
    const attendu = await messageDuMoteur(m.moteur, id);
    expect(attendu.code).toBe("TABLEAU_NON_RELIE");
    let instant = T0;
    let tours = 0;
    while ((await depots().travaux.obtenir(id))?.statut !== "echec" && tours++ < 400) {
      await tour(m.moteur, instant);
      const t = (await depots().travaux.obtenir(id))!;
      if (t.statut === "echec") break;
      expect(t.statut).toBe("en_cours");
      instant = Math.max(instant, new Date(t.reprise!.prochainEssai).getTime());
    }
    const fin = (await depots().travaux.obtenir(id))!;
    expect(fin.statut).toBe("echec");
    expect(instant - T0).toBeGreaterThanOrEqual(24 * 3600_000);
    expect(fin.erreur).toMatchObject({ code: "TABLEAU_NON_RELIE", messagePourWill: attendu.message });
    expect(await reservationsActives(id)).toBe(0);
    expect((await depots().videos.obtenir(videoId))?.statut).toBe("echec");
    expect(await notifs("echec")).toHaveLength(1);
    expect(await notifs("info")).toHaveLength(1);
  });

  it("f) « Arrêter » pendant l'attente : le travail est annulé et plus rien n'est relancé", async () => {
    const m = montageTableau();
    const { id } = await installer(m.moteur, m.commande);
    await tour(m.moteur, T0);
    await travaux.annulerTravail(id);
    expect((await depots().travaux.obtenir(id))?.statut).toBe("annule");
    expect(await tour(m.moteur, T0 + 24 * 3600_000)).toBe(0);
    expect((await depots().travaux.obtenir(id))?.statut).toBe("annule");
    expect(await reservationsActives(id)).toBe(0);
  });
});

/* --- Face caméra (moteur réel) --------------------------------------- */

const TEXTE = "Bonjour, je suis le fondateur. Aujourd'hui je vous parle de la formation. C'est faux. Avec un financement OPCO, la formation peut être prise en charge.";
function commandeFacecam(): CommandeFabrication {
  return {
    videoId: "v-03",
    formatId: "facecam",
    moteurId: "montage-facecam",
    ratios: ["9:16"],
    dureeCibleSec: 60,
    script: { blocs: [], texteComplet: TEXTE },
    distribution: [{ role: "Face caméra", source: "rush" }],
    prises: [{ id: "p1", partie: "version", cle: "studio/prod/rush/v-03/prise-1.mov", mime: "video/quicktime", dureeSec: 60, segmentIds: [] }],
    briques: { etalonnage: true, "sous-titres": true, "mention-ia": false },
    styles: { lut: null },
    entrees: {},
    reglages: {},
    plans: [],
    prononciations: [],
  } as unknown as CommandeFabrication;
}

describe("face caméra : FACECAM_NON_RELIE rendu par le moteur réel", () => {
  it("d) même issue que a) : attente de 30 s, vidéo en fabrication, réservation gardée, 1 notification", async () => {
    const etat = { relie: true };
    const moteur = creerMoteurMontageFacecam({ chaine: () => (etat.relie ? { facecam: creerFacecamSimule() } : null), relire: async () => undefined });
    const { id, videoId } = await installer(moteur, commandeFacecam());
    etat.relie = false;
    expect(await tour(moteur, T0)).toBe(1);
    const t = (await depots().travaux.obtenir(id))!;
    expect(t.statut).toBe("en_cours");
    expect(t.erreur).toBeUndefined();
    expect(t.reprise).toMatchObject({ echecs: 1, prochainEssai: new Date(T0 + 30_000).toISOString() });
    expect((await depots().videos.obtenir(videoId))?.statut).toBe("en_fabrication");
    expect(await reservationsActives(id)).toBe(1);
    expect(await notifs("info")).toHaveLength(1);
    expect(await notifs("echec")).toHaveLength(0);
  });
});

/* --- (c) bis : moteurs AVEC garde « sans avancement » (60 min) : l'attente dure bien 24 h ---------- */

const cas: [string, string, () => MoteurVideo, () => CommandeFabrication][] = [
  [
    "face caméra animée v4",
    "FACECAM_ANIMEE_NON_RELIE",
    () => creerMoteurMontageFacecamAnimee({ outils: async () => null, statutFormat: "masque" }),
    () => ({ videoId: "v-03", formatId: "facecam-animee", moteurId: "montage-facecam-animee", ratios: ["9:16"], entrees: { facecamAnimee: { priseCle: "k.mov", fichierId: "f-1", accordEssaiReel: true } }, briques: {}, distribution: [] }) as unknown as CommandeFabrication,
  ],
  [
    "image → vidéo",
    "IV_NON_RELIE",
    () => creerMoteurMontageImageVideo({ outils: async () => null, statutFormat: "masque", numeroVersion: async () => 1 }),
    () => ({ versionContrat: 2, moteurId: "montage-image-video", videoId: "v-03", formatId: "image-video", versionFormat: 1, profilRenduVersion: 1, dureeCibleSec: 50, ratios: ["9:16"], script: { blocs: [], texteComplet: "" }, distribution: [], styles: {}, briques: {}, entrees: { imageVideo: { imageCle: "studio/dev/image.png", empreinte: "e1", plafondCentimes: 500, codeSuivi: "essai", accordEssaiReel: true, reseaux: ["instagram"] } }, reglages: {}, plans: [], prononciations: [], mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false }, budgetMax: { centimes: 500, devise: "EUR" }, tauxUsdEur: 0.9, construiteLe: "2026-10-15T08:00:00.000Z" }) as unknown as CommandeFabrication,
  ],
];

describe("c) bis : un moteur gardé attend 24 h (pas 60 min) puis échoue avec sa phrase", () => {
  it.each(cas)("%s : en attente à 2 h, `echec` seulement à ≥ 24 h (%s, phrase du moteur), 1 notification d'échec, réservation libérée, aucune reprise gardée", async (_nom, code, fabriquer, commande) => {
    const moteur = fabriquer();
    const { id, videoId } = await installer(moteur, commande());
    const attendu = await messageDuMoteur(moteur, id);
    expect(attendu.code).toBe(code);
    let instant = T0;
    let vuA2h = false;
    let tours = 0;
    while (tours++ < 400) {
      await tour(moteur, instant);
      const t = (await depots().travaux.obtenir(id))!;
      if (t.statut === "echec") break;
      expect(t.statut).toBe("en_cours");
      expect(t.garde).toBeUndefined();
      if (!vuA2h && instant - T0 >= 2 * 3600_000) {
        vuA2h = true;
        expect(t.erreur).toBeUndefined();
        expect(await reservationsActives(id)).toBe(1);
        expect((await depots().videos.obtenir(videoId))?.statut).toBe("en_fabrication");
        expect(await notifs("echec")).toHaveLength(0);
      }
      instant = Math.max(instant, new Date(t.reprise!.prochainEssai).getTime());
    }
    expect(vuA2h).toBe(true);
    const fin = (await depots().travaux.obtenir(id))!;
    expect(fin.statut).toBe("echec");
    expect(instant - T0).toBeGreaterThanOrEqual(24 * 3600_000);
    expect(fin.erreur).toMatchObject({ code, messagePourWill: attendu.message });
    expect(fin.reprise).toBeUndefined();
    expect(await reservationsActives(id)).toBe(0);
    expect((await depots().videos.obtenir(videoId))?.statut).toBe("echec");
    expect(await notifs("echec")).toHaveLength(1);
    expect(await notifs("info")).toHaveLength(1);
  });
});

/* --- Contre-épreuves : ce qui n'est PAS une panne rendue reste comme avant -- */

describe("contre-épreuves : comportement de master inchangé", () => {
  async function ecrire(code: string, reessayable: boolean) {
    const { travailId } = await fabrication.lancerFabrication("v-03", { confirme: true });
    const t = (await depots().travaux.obtenir(travailId))!;
    const version = (await depots().versions.obtenir(t.versionId!))!;
    const moteur = (await import("@/moteurs")).moteurDeCommande(version.commande);
    await depots().reservations.enregistrer({ id: `res-${t.id}`, fournisseur: "fal", videoId: t.cibleId, travailId: t.id, centimes: 120, devise: "USD", statut: "active", ...horodatage() });
    const sortie: Travail = {
      ...t,
      statut: "echec",
      erreur: { code, reessayable, messagePourWill: "Phrase du moteur.", detailTechnique: "essai" },
      etapes: t.etapes.map((e, i) => (i === 0 ? { ...e, statut: "echec" as const } : e)),
      modifieLe: new Date(T0).toISOString(),
    };
    const r = await travaux.ecrireAvancement({ travail: t, commande: version.commande, moteur }, { travail: sortie });
    expect(r.ecrit).toBe(true);
    return { t, sortie, ecrit: (await depots().travaux.obtenir(t.id))!, videoId: t.cibleId };
  }

  it.each([
    ["CAS_CONCRET_NON_RELIE", false],
    ["CAS_CONCRET_FICHE_REFUSEE", true],
    ["PANNE_SANS_NOUVELLE", true],
    ["TABLEAU_DECOUPAGE_NON_RELIE", true],
  ] as const)("%s (reessayable %s) : échec immédiat, réservation libérée, notification d'échec, aucune attente", async (code, reessayable) => {
    const { t, sortie, ecrit, videoId } = await ecrire(code, reessayable);
    expect(ecrit).toEqual({ ...sortie, statut: "echec", reprise: undefined, estDemo: t.estDemo, urgent: t.urgent });
    expect(await reservationsActives(t.id)).toBe(0);
    expect((await depots().videos.obtenir(videoId))?.statut).toBe("echec");
    expect(await notifs("echec")).toHaveLength(1);
    expect(await notifs("info")).toHaveLength(0);
  });

  it("CAS_CONCRET_NON_RELIE sur l'étape « ecriture » (payée) : jamais relancée seule ; la même panne sur une étape gratuite l'est toujours", async () => {
    const etape = async (cle: string) => {
      const { travailId } = await fabrication.lancerFabrication("v-03", { confirme: true });
      const t = (await depots().travaux.obtenir(travailId))!;
      const version = (await depots().versions.obtenir(t.versionId!))!;
      const moteur = (await import("@/moteurs")).moteurDeCommande(version.commande);
      const sortie: Travail = {
        ...t,
        statut: "echec",
        erreur: { code: "CAS_CONCRET_NON_RELIE", reessayable: true, messagePourWill: "Phrase du moteur.", detailTechnique: "essai" },
        etapes: [{ ...t.etapes[0], cle, statut: "echec" as const }, ...t.etapes.slice(1)],
        modifieLe: new Date(T0).toISOString(),
      };
      await travaux.ecrireAvancement({ travail: t, commande: version.commande, moteur }, { travail: sortie });
      return (await depots().travaux.obtenir(t.id))!;
    };
    const payee = await etape("ecriture");
    expect(payee.statut).toBe("echec");
    expect(payee.reprise).toBeUndefined();
    const gratuite = await etape("rendu");
    expect(gratuite.statut).not.toBe("echec");
    expect(gratuite.reprise?.echecs).toBe(1);
  });

  it("IV_SCRIPT_A_VALIDER (attente de validation) : réservation gardée, travail en échec comme avant, pas de reprise automatique", async () => {
    const { t, sortie, ecrit } = await ecrire("IV_SCRIPT_A_VALIDER", true);
    expect(ecrit).toEqual({ ...sortie, statut: "echec", reprise: undefined, estDemo: t.estDemo, urgent: t.urgent });
    expect(await reservationsActives(t.id)).toBe(1);
    expect(await notifs("echec")).toHaveLength(0);
  });
});

/* --- Reprise bornée (4e correction) : R1 à R7, par la VRAIE boucle -------------------------------- */

const H = 3600_000;
const PAS = 5 * 60_000;
type Mode = { relie: boolean; progres?: boolean };

/**
 * Le moteur RÉEL, sauf quand l'outil « répond » (`mode.relie`) : ce tour-là rend un travail en cours qui n'avance pas
 * (ou, avec `progres`, qui termine UNE étape de plus). Quand l'outil est absent, c'est le moteur réel qui rend son « non relié ».
 */
function intermittent(reel: MoteurVideo, mode: Mode): MoteurVideo {
  return {
    ...reel,
    async avancer(travail, commande, maintenant) {
      if (!mode.relie) return reel.avancer(travail, commande, maintenant);
      const etapes = travail.etapes.map((e) => ({ ...e }));
      const i = etapes.findIndex((e) => e.statut !== "terminee" && e.statut !== "ignoree");
      if (i >= 0) etapes[i] = mode.progres ? { ...etapes[i], statut: "terminee", progression: 100 } : { ...etapes[i], statut: "en_cours" };
      if (mode.progres) mode.progres = false;
      return { travail: { ...travail, statut: "en_cours", erreur: undefined, etapes } };
    },
  };
}

/** Boucle : un tour, puis l'horloge avance d'au moins `PAS` et jamais avant le prochain essai. `regle(instant)` pose l'état de l'outil. */
async function boucle(moteur: MoteurVideo, id: string, jusqua: number, regle: (instant: number, n: number) => void | Promise<void>): Promise<{ instant: number; finA: number | null; tours: number }> {
  let instant = T0;
  let finA: number | null = null;
  let tours = 0;
  while (instant <= jusqua && tours < 2000) {
    await regle(instant, tours++);
    await tour(moteur, instant);
    const t = (await depots().travaux.obtenir(id))!;
    if (t.statut === "echec") finA ??= instant;
    instant = Math.max(instant + PAS, t.reprise ? new Date(t.reprise.prochainEssai).getTime() : 0);
  }
  return { instant, finA, tours };
}

describe("R1 · outil intermittent 50 h (tableau, moteur réel) : l'attente est bornée à 24 h depuis la 1re panne", () => {
  it("échec dans [24 h, 24 h + 20 min], 1 notif d'attente, 1 notif d'échec, plus jamais relu, réservation libérée", { timeout: 120_000 }, async () => {
    const m = montageTableau();
    const mode: Mode = { relie: false };
    const moteur = intermittent(m.moteur, mode);
    const { id, videoId } = await installer(moteur, m.commande);
    const attendu = await messageDuMoteur(m.moteur, id);
    const { finA } = await boucle(moteur, id, T0 + 50 * H, (_i, n) => { mode.relie = n % 2 === 1; });
    const fin = (await depots().travaux.obtenir(id))!;
    expect(fin.statut).toBe("echec");
    expect(fin.erreur).toMatchObject({ code: "TABLEAU_NON_RELIE", messagePourWill: attendu.message });
    expect(finA! - T0).toBeGreaterThanOrEqual(24 * H);
    expect(finA! - T0).toBeLessThanOrEqual(24 * H + 20 * 60_000);
    expect(fin.reprise).toBeUndefined();
    expect(await reservationsActives(id)).toBe(0);
    expect((await depots().videos.obtenir(videoId))?.statut).toBe("echec");
    expect(await notifs("echec")).toHaveLength(1);
    expect(await notifs("info")).toHaveLength(1);
    expect(fin.tentatives).toBeLessThan(300);
    expect(await tour(moteur, T0 + 50 * H)).toBe(0);
  });
});

describe("R2 · outil intermittent 50 h (face caméra animée v4, moteur gardé)", () => {
  it("échec avec FACECAM_ANIMEE_NON_RELIE (pas PANNE_SANS_NOUVELLE), même fenêtre, 1 + 1 notifications", { timeout: 120_000 }, async () => {
    const mode: Mode = { relie: false };
    const moteur = intermittent(cas[0][2](), mode);
    const { id, videoId } = await installer(moteur, cas[0][3]());
    const { finA } = await boucle(moteur, id, T0 + 50 * H, (_i, n) => { mode.relie = n % 2 === 1; });
    const fin = (await depots().travaux.obtenir(id))!;
    expect(fin.statut).toBe("echec");
    expect(fin.erreur?.code).toBe("FACECAM_ANIMEE_NON_RELIE");
    expect(finA! - T0).toBeGreaterThanOrEqual(24 * H);
    expect(finA! - T0).toBeLessThanOrEqual(24 * H + 20 * 60_000);
    expect(fin.reprise).toBeUndefined();
    expect(await reservationsActives(id)).toBe(0);
    expect((await depots().videos.obtenir(videoId))?.statut).toBe("echec");
    expect(await notifs("echec")).toHaveLength(1);
    expect(await notifs("info")).toHaveLength(1);
  });
});

describe("R3 · attente continue : toujours en attente à 2 h, échec à [24 h, 24 h + 10 min] de la 1re panne", () => {
  it.each(cas)("%s", async (_nom, code, fabriquer, commande) => {
    const moteur = fabriquer();
    const { id } = await installer(moteur, commande());
    let instant = T0;
    let vu = false;
    let fin: number | null = null;
    for (let n = 0; n < 400 && fin === null; n++) {
      await tour(moteur, instant);
      const t = (await depots().travaux.obtenir(id))!;
      if (t.statut === "echec") { fin = instant; break; }
      if (!vu && instant - T0 >= 2 * H) {
        vu = true;
        expect((await travaux.obtenirTravail(id))?.enAttenteFournisseur).toBe(true);
        expect(await notifs("echec")).toHaveLength(0);
      }
      instant = Math.max(instant, new Date(t.reprise!.prochainEssai).getTime());
    }
    expect(vu).toBe(true);
    expect((await depots().travaux.obtenir(id))?.erreur?.code).toBe(code);
    expect(fin! - T0).toBeGreaterThanOrEqual(24 * H);
    expect(fin! - T0).toBeLessThanOrEqual(24 * H + 10 * 60_000);
  });
});

describe("R4 · un vrai progrès remet la reprise à zéro (tableau)", () => {
  it("nouvelle attente = nouvelle borne de 24 h et nouvelle notification", { timeout: 120_000 }, async () => {
    const m = montageTableau();
    const mode: Mode = { relie: false };
    const moteur = intermittent(m.moteur, mode);
    const { id } = await installer(moteur, m.commande);
    const T1 = T0 + 23 * H; // l'outil répond : UNE étape de plus se termine
    const T2 = T1 + 30 * 60_000; // puis il retombe pour de bon
    let progres = false;
    let aVu25h = false;
    const fin = await boucle(moteur, id, T0 + 60 * H, async (i) => {
      mode.relie = i > T0 + 60_000 && i < T2;
      if (i >= T1 && !progres) {
        progres = true;
        mode.progres = true;
      }
      if (i >= T0 + 25 * H && !aVu25h) {
        aVu25h = true;
        const t = (await depots().travaux.obtenir(id))!;
        expect(t.statut).toBe("en_cours"); // sans la remise à zéro, l'échec serait tombé à T0 + 24 h
        expect(new Date(t.reprise!.premiereLe).getTime()).toBeGreaterThanOrEqual(T1);
        expect(await notifs("info")).toHaveLength(2);
        expect(await notifs("echec")).toHaveLength(0);
      }
    });
    expect(aVu25h).toBe(true);
    expect(fin.finA! - T2).toBeGreaterThanOrEqual(24 * H);
    expect(fin.finA! - T2).toBeLessThanOrEqual(24 * H + 20 * 60_000);
    expect(await notifs("info")).toHaveLength(2);
    expect(await notifs("echec")).toHaveLength(1);
  });
});

describe("R5 · outil revenu sans progrès : la vidéo ne dit plus « attend un outil », la garde du moteur joue comme sur master", () => {
  it("face caméra animée : garde 60 min, PANNE_SANS_NOUVELLE, pas de reprise sur l'échec, 1 notif d'échec", async () => {
    const mode: Mode = { relie: false };
    const moteur = intermittent(cas[0][2](), mode);
    const { id } = await installer(moteur, cas[0][3]());
    await tour(moteur, T0);
    const premiere = (await depots().travaux.obtenir(id))!.reprise!.premiereLe;
    mode.relie = true;
    let instant = T0 + 60_000;
    await tour(moteur, instant);
    const t = (await depots().travaux.obtenir(id))!;
    expect(t.statut).toBe("en_cours");
    expect((await travaux.obtenirTravail(id))?.enAttenteFournisseur).toBe(false);
    expect(t.reprise?.premiereLe).toBe(premiere);
    expect(t.reprise?.attenteDepuis).toBeUndefined();
    for (let n = 0; n < 40; n++) {
      instant += PAS;
      await tour(moteur, instant);
      if ((await depots().travaux.obtenir(id))!.statut === "echec") break;
    }
    const fin = (await depots().travaux.obtenir(id))!;
    expect(fin.statut).toBe("echec");
    expect(fin.erreur?.code).toBe("PANNE_SANS_NOUVELLE");
    expect(fin.reprise).toBeUndefined();
    expect(await reservationsActives(id)).toBe(0);
    expect(await notifs("echec")).toHaveLength(1);
    expect(await notifs("info")).toHaveLength(1);
  });
});

describe("R6 · contre-épreuves : une reprise qui n'est pas de S-01 reste remise à zéro comme sur master", () => {
  it.each([
    ["panne levée (non marquée)", undefined],
    ["crédit", "credit"],
  ] as const)("%s : tour sans progrès → reprise indéfinie", async (_nom, motif) => {
    const mode: Mode = { relie: true };
    const moteur = intermittent(cas[0][2](), mode);
    const { id } = await installer(moteur, cas[0][3]());
    const t0 = (await depots().travaux.obtenir(id))!;
    await depots().travaux.enregistrer({ ...t0, reprise: { echecs: 1, premiereLe: new Date(T0 - 60_000).toISOString(), prochainEssai: new Date(T0 - 1_000).toISOString(), derniereErreur: "Panne levée", ...(motif ? { motif } : {}) } });
    await tour(moteur, T0);
    const t = (await depots().travaux.obtenir(id))!;
    expect(t.statut).toBe("en_cours");
    expect(t.reprise).toBeUndefined();
  });
});

describe("R7 · cas concret, moteur RÉEL", () => {
  it("1er tour sans outil : l'échec tombe sur « ecriture » (payée) → échec immédiat, aucune reprise, réservation libérée", async () => {
    const d = doublesCC({});
    const moteur = creerMoteurMontageCasConcret({ outils: async () => null, retouchesAllumees: () => false });
    const { id } = await installer(moteur, commandeCasConcret(d));
    await tour(moteur, T0);
    const t = (await depots().travaux.obtenir(id))!;
    expect(t.etapes.find((e) => e.statut === "echec")?.cle).toBe("ecriture");
    expect(t.statut).toBe("echec");
    expect(t.reprise).toBeUndefined();
    expect(await reservationsActives(id)).toBe(0);
  });

  it("écriture faite, puis panne à la voix : repart seul, journal d'écriture inchangé", { timeout: 60_000 }, async () => {
    const d = doublesCC({});
    const etat = { relie: true };
    const moteur = creerMoteurMontageCasConcret({ outils: async () => (etat.relie ? versOutilsCC(d, new Map(), async () => null) : null), retouchesAllumees: () => false });
    const { id } = await installer(moteur, commandeCasConcret(d));
    let instant = T0;
    for (let n = 0; n < 60; n++) {
      await tour(moteur, instant);
      instant += 1_000;
      const t = (await depots().travaux.obtenir(id))!;
      if (t.etapes.some((e) => e.cle === "ecriture" && e.statut === "terminee") || t.statut !== "en_cours") break;
    }
    const avant = (await depots().travaux.obtenir(id))!;
    expect(avant.etapes.find((e) => e.cle === "ecriture")?.statut).toBe("terminee");
    const appels = d.appelsEcriture();
    etat.relie = false;
    await tour(moteur, instant);
    const t = (await depots().travaux.obtenir(id))!;
    expect(t.statut).toBe("en_cours");
    expect(t.reprise?.echecs).toBe(1);
    expect(await reservationsActives(id)).toBe(1);
    expect(d.appelsEcriture()).toBe(appels);
  });
});
