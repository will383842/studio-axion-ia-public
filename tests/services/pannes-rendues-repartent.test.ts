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
