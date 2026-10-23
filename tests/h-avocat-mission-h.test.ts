/**
 * Mission H — l'avocat sur les briques communes, de bout en bout dans son moteur (prises filmées « je lis », aligneur
 * et rendu injectés, réponse réelle enregistrée de studio-aligneur ; aucun appel réseau, aucune dépense) :
 *  - options ABSENTES : composition et projet de montage identiques à avant (aucune clé nouvelle) ;
 *  - motion commune (`avocat.motionCommune`) : carte de la brique rendue par l'opération `composition` sans mode, posée
 *    en plein écran à la place du plan ;
 *  - multicaméra (`avocat.multicamera`) : piste rangée dans `projetMontage.multicamera`, sources lues par la composition ;
 *    piste du double de SIMULATION jamais lue par une composition réelle ;
 *  - monteur commun (`avocat.monteur`) : « Monteur, fais-le en 3 caméras » allume la multicaméra, une demande que
 *    l'avocat ne sait pas faire reçoit une réponse claire.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");

import type { PisteMulticamera } from "@/briques/multicamera";
import type { BlocScript, CommandeFabrication, Travail } from "@/domaine/types";
import type { DemandeRendu, EtatRendu, FournisseurAlignement, ResultatAlignement, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import type { MoteurVideo, ResultatFabrication } from "@/moteurs";
import type { DemandeMulticameraMoteur } from "@/moteurs/montage-avocat/branchements";
import type { ParametresCompositionAvocat } from "@/moteurs/montage-avocat/scene";

const MDP = "essai-mission-h";
const T0 = Date.UTC(2026, 9, 9, 9, 0, 0);
const CALE = JSON.parse(readFileSync(join(process.cwd(), "tests", "fixtures", "d3-calage-voix-essai.json"), "utf8")) as ResultatAlignement;

beforeAll(async () => {
  process.env.SESSION_SECRET = "a".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
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
  urlLectureDuree: async (cle) => `https://r2.exemple/${cle}`,
  urlDepotDuree: async (cle) => `https://r2.exemple/${cle}?depot`,
});

function fauxRendu() {
  const recues: DemandeRendu[] = [];
  const etats = new Map<string, EtatRendu>();
  const service: ServiceRendu = {
    async soumettre(d) {
      recues.push(d);
      etats.set(d.idRendu, { statut: "termine", sortieCle: d.sortie.cle, mesures: d.operation === "composition" ? { largeur: 1080, hauteur: 1920, fps: 25, dureeSec: 11, lufs: -14 } : { dureeSec: 11 } });
      return { idRendu: d.idRendu };
    },
    etat: async (id) => etats.get(id) ?? { statut: "inconnu" },
  };
  return { recues, service };
}

function aligneur() {
  const a = {
    id: "studio-aligneur",
    type: "alignement",
    nom: "Calage des mots",
    reelPrevu: "studio-aligneur",
    mode: "reel",
    capacites: { asynchrone: true, accordExige: false },
    soumettre: async () => undefined,
    suivre: async () => ({ statut: "termine", resultat: CALE }),
  } as unknown as FournisseurAlignement;
  return () => a;
}

async function jusquAuBout(moteur: MoteurVideo, c: CommandeFabrication, t: Travail): Promise<{ travail: Travail; resultat: ResultatFabrication }> {
  let travail = t;
  let resultat: ResultatFabrication | undefined;
  for (let ms = T0; ms < T0 + 10 * 60_000; ms += 500) {
    const r = await moteur.avancer(travail, c, ms);
    travail = r.travail;
    resultat = r.resultat ?? resultat;
    if (travail.statut === "termine") return { travail, resultat: resultat! };
    if (travail.statut === "echec") throw new Error(JSON.stringify(travail.erreur));
  }
  throw new Error(`bloqué : ${travail.statut}`);
}

const SEGMENTS = [
  { id: "s1", texte: "Vous recevez un PV de 135 € ?" },
  { id: "s2", texte: "Surtout, ne le payez pas tout de suite.", titreEcran: "Ne payez pas tout de suite" },
  { id: "s3", texte: "Je vous explique pourquoi, en trois points." },
];
const DITS = ["Vous recevez un pé vé de cent trente-cinq euros ?", "Surtout, ne le payez pas tout de suite.", "Je vous explique pourquoi, en trois points."];

async function commande(entrees: Record<string, unknown> = {}): Promise<CommandeFabrication> {
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
    ratios: ["9:16"],
    plans: [],
    prononciations: [],
    texteDitParSegment: DITS,
    distribution: [{ ...c0.distribution[0], source: "rush", modeAngles: "un-angle", visagesResolus: undefined }],
    briques: { ...c0.briques, illustrations: false },
    prises: [{ id: "p1", partie: "version", cle: "prises/0042-AV-TT-L-prise-1.mp4", mime: "video/mp4", dureeSec: 10.921, segmentIds: ["s1", "s2", "s3"] }],
    entrees: { ...c0.entrees, ...entrees },
  };
}

/** Passe multicaméra imposée (le service réel n'est jamais appelé) : sources fabriquées, simulées ou réelles. */
function passe(simulation: boolean) {
  const appels: DemandeMulticameraMoteur[] = [];
  const fn = async (d: DemandeMulticameraMoteur): Promise<PisteMulticamera> => {
    appels.push(d);
    return {
      version: 1,
      plans: [
        { angle: "face", debutSec: 0, finSec: 3.5, raison: "accroche", premierMot: 0, dernierMot: 5 },
        { angle: "cote", debutSec: 3.5, finSec: 7, raison: "explication", premierMot: 6, dernierMot: 12 },
        { angle: "face", debutSec: 7, finSec: d.dureeSec, raison: "appel", premierMot: 13, dernierMot: 20 },
      ],
      sources: { face: d.priseCle, cote: "angles/cote.mp4" },
      replis: [{ angle: "contre-plongee", raison: "L'angle d'en bas : les lèvres ne suivent pas exactement la voix." }],
      ...(simulation ? { simulation: true as const } : {}),
    };
  };
  return { appels, fn };
}

const compositionFinale = (recues: DemandeRendu[]) => recues.find((d) => d.operation === "composition" && (d.parametres as { mode?: string }).mode === "complet")!;

describe("Mission H · avocat sur les briques communes", () => {
  it("options absentes : composition et projet identiques à avant (aucune clé nouvelle)", async () => {
    const rendu = fauxRendu();
    const m = creerMoteurMontageAvocat({ rendu: rendu.service, stockage, alignement: aligneur() });
    const c = await commande();
    expect(Object.keys(c.entrees ?? {}).filter((k) => /^avocat/.test(k))).toEqual([]);
    const { resultat } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "t-0", versionId: "v-0", titre: "x", maintenant: T0 }));
    const compo = compositionFinale(rendu.recues);
    const p = compo.parametres as Extract<ParametresCompositionAvocat, { mode: "complet" }>;
    expect(Object.keys(compo.entrees).filter((n) => n.startsWith("camera-") || n.startsWith("carte-"))).toEqual([]);
    expect(p.image.cameras).toBeUndefined();
    expect(p.image.plans.some((x) => x.camera)).toBe(false);
    expect(rendu.recues.filter((d) => d.operation === "composition")).toHaveLength(1);
    const projet = resultat.projetMontage as Record<string, unknown>;
    expect(projet.motionCommune).toBeUndefined();
    expect(projet.multicamera).toBeUndefined();
    expect(projet.monteur).toBeUndefined();
  });

  it("motion commune : la carte titre de la brique est rendue (`composition` sans mode) puis posée en plein écran", async () => {
    const rendu = fauxRendu();
    const m = creerMoteurMontageAvocat({ rendu: rendu.service, stockage, alignement: aligneur() });
    const c = await commande({ avocatMotionCommune: { actif: true } });
    const { resultat } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "t-m", versionId: "v-m", titre: "x", maintenant: T0 }));
    const carte = rendu.recues.find((d) => d.operation === "composition" && (d.parametres as { composition?: string }).composition)!;
    expect(carte).toBeDefined();
    expect((carte.parametres as { mode?: string }).mode).toBeUndefined();
    expect((carte.parametres as { composition: string }).composition).toBe("MotionTitre");
    expect(JSON.stringify(carte.parametres)).toContain("Ne payez pas tout de suite");
    const compo = compositionFinale(rendu.recues);
    expect(compo.entrees["carte-pe-1"]).toContain(carte.sortie.cle);
    const p = compo.parametres as Extract<ParametresCompositionAvocat, { mode: "complet" }>;
    expect(p.image.plans.find((x) => x.illustration?.url === "entree:carte-pe-1")).toMatchObject({ type: "illustration" });
    const projet = resultat.projetMontage as { motionCommune?: { cartes: { modele: string; statut: string }[] } };
    expect(projet.motionCommune?.cartes).toEqual([expect.objectContaining({ modele: "titre", statut: "faite" })]);
    // Jamais de bandeau « nom · Axion-IA ».
    expect(JSON.stringify(carte.parametres)).not.toMatch(/Axion-IA/);
  });

  it("motion commune (vérif A2) : le texte de la carte plein écran n'est pas réécrit en sous-titre pendant la carte", async () => {
    const rendu = fauxRendu();
    const m = creerMoteurMontageAvocat({ rendu: rendu.service, stockage, alignement: aligneur() });
    const c = await commande({ avocatMotionCommune: { actif: true } });
    const { resultat } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "t-m2", versionId: "v-m2", titre: "x", maintenant: T0 }));
    const carte = (resultat.projetMontage as { motionCommune: { cartes: { debutSec: number; finSec: number }[] } }).motionCommune.cartes[0];
    const p = compositionFinale(rendu.recues).parametres as { texte: { sousTitres?: { segments: { debutSec: number; finSec: number; mots: { mot: string }[] }[] } } };
    const affiche = new Set("ne payez pas tout de suite".split(" "));
    const norme = (m: string) => m.toLowerCase().replace(/[^a-zà-ÿ]/g, "");
    const repetes = (p.texte.sousTitres?.segments ?? []).filter((g) => g.debutSec < carte.finSec && carte.debutSec < g.finSec && g.mots.every((x) => affiche.has(norme(x.mot)))).map((g) => g.mots.map((x) => x.mot).join(" "));
    expect(repetes).toEqual([]);
  });

  it("multicaméra : piste rangée au projet, angles lus par la composition, zooms sur l'angle montré ; simulée : jamais en réel", async () => {
    for (const simulation of [false, true]) {
      const rendu = fauxRendu();
      const p0 = passe(simulation);
      const m = creerMoteurMontageAvocat({ rendu: rendu.service, stockage, alignement: aligneur(), multicamera: p0.fn });
      const c = await commande({ avocatMulticamera: { actif: true } });
      const { resultat } = await jusquAuBout(m, c, await m.lancer(c, { travailId: `t-mc-${simulation}`, versionId: "v-mc", titre: "x", maintenant: T0 }));
      expect(p0.appels).toHaveLength(1);
      expect(p0.appels[0].priseCle).toContain("prises-assemblees.mp4");
      const projet = resultat.projetMontage as { multicamera?: PisteMulticamera };
      expect(projet.multicamera?.sources.cote).toBe("angles/cote.mp4");
      const compo = compositionFinale(rendu.recues);
      const p = compo.parametres as Extract<ParametresCompositionAvocat, { mode: "complet" }>;
      if (simulation) {
        expect(compo.entrees["camera-cote"]).toBeUndefined();
        expect(p.image.cameras).toBeUndefined();
      } else {
        expect(compo.entrees["camera-cote"]).toContain("angles/cote.mp4");
        expect(p.image.cameras?.cote).toMatchObject({ type: "video", transparent: false });
        const cote = p.image.plans.filter((x) => x.camera === "cote");
        expect(cote.length).toBeGreaterThan(0);
        expect(Math.min(...cote.map((x) => x.debutSec))).toBeCloseTo(3.5, 2);
        // Les sous-titres ne bougent pas : même son, même horloge.
        expect(p.texte.sousTitres).toBeDefined();
      }
    }
  });

  it("multicaméra demandée sur une vidéo SANS prise filmée : rien n'est appelé", async () => {
    const p0 = passe(false);
    const m = creerMoteurMontageAvocat({ multicamera: p0.fn });
    const c0 = await commande({ avocatMulticamera: { actif: true } });
    const c: CommandeFabrication = { ...c0, prises: undefined, distribution: [{ ...c0.distribution[0], source: "double" }] };
    const t = await m.lancer(c, { travailId: "t-sans", versionId: "v", titre: "x", maintenant: T0 });
    for (let ms = T0, k = 0; k < 40; k++, ms += 1000) {
      const r = await m.avancer(t, c, ms);
      if (r.travail.statut !== "en_file") break;
    }
    expect(p0.appels).toHaveLength(0);
  });

  it("monteur commun : « fais-le en 3 caméras » allume la multicaméra ; « mets-moi à droite » reçoit une réponse claire", async () => {
    const rendu = fauxRendu();
    const p0 = passe(false);
    const m = creerMoteurMontageAvocat({ rendu: rendu.service, stockage, alignement: aligneur(), multicamera: p0.fn });
    const c = await commande({ avocatMonteur: { consignes: [{ id: "v1", origine: "voix", texte: "fais-le en 3 caméras" }, { id: "f1", origine: "fil", texte: "mets-moi à droite pendant l'explication" }] } });
    const { resultat } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "t-mo", versionId: "v-mo", titre: "x", maintenant: T0 }));
    expect(p0.appels).toHaveLength(1);
    expect(p0.appels[0].consignes).toEqual(["fais-le en 3 caméras"]);
    const projet = resultat.projetMontage as { monteur?: { consignes: { id: string; comprise: boolean; resume: string }[] } };
    expect(projet.monteur?.consignes).toEqual([
      expect.objectContaining({ id: "v1", comprise: true }),
      expect.objectContaining({ id: "f1", comprise: false, resume: expect.stringMatching(/^Pour une vidéo avocat, je ne sais pas encore faire une mise en page/) }),
    ]);
  });
});
