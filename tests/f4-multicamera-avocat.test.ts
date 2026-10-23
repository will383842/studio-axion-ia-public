/**
 * Lot F4 — multicaméra du format avocat : passe du service (simulation seulement) et avocat inchangé sans l'option.
 */
import { describe, expect, it } from "vitest";
import { REGLAGE_MULTICAMERA_PAR_DEFAUT } from "@/briques/multicamera";
import { formatAvocat } from "@/formats/avocat";
import { choisirFournisseurMulticamera } from "@/fournisseurs/multicamera";
import type { FournisseurVisage } from "@/fournisseurs/types";
import { passeMulticameraAvocat } from "@/services/multicamera-avocat";

const TEXTE: [string, string][] = [
  ["accroche", "Licencié par SMS ? C'est illégal !"],
  ["promesse", "Je vous explique pourquoi, et comment réagir."],
  ["coeur", "D'abord, la loi impose un entretien préalable. Ensuite, la lettre doit donner un motif précis. Concrètement, un simple message ne suffit jamais."],
  ["preuve", "En 2024, un salarié a obtenu 8 mois de salaire !"],
  ["appel", "Écrivez-moi en commentaire."],
];

function donnees() {
  const mots: { mot: string; debutSec: number; finSec: number; segmentId: string }[] = [];
  let t = 0.15;
  for (const [bloc, texte] of TEXTE) {
    for (const mot of texte.split(/\s+/)) {
      mots.push({ mot, debutSec: +t.toFixed(3), finSec: +(t + 0.27).toFixed(3), segmentId: `s-${bloc}` });
      t += 0.27 + (/[.!?]$/.test(mot) ? 0.45 : 0.07);
    }
  }
  const fin = +(mots.at(-1)!.finSec + 1.2).toFixed(3);
  const plans = [
    { debutSec: 0, finSec: 3.2 },
    { debutSec: 3.2, finSec: 8 },
    { debutSec: 8, finSec: fin },
  ];
  return { mots, plans, fin, segments: TEXTE.map(([bloc]) => ({ id: `s-${bloc}`, bloc })) };
}

const base = () => {
  const d = donnees();
  return { travailId: "trav-1", visageId: "heygen-will", priseCle: "prises/face.mp4", audioCle: "prises/face.wav", dureePriseSec: d.fin, ratio: "9:16" as const, plans: d.plans, mots: d.mots, segments: d.segments, attendre: async () => {} };
};

describe("F4 — passe multicaméra de l'avocat", () => {
  it("option coupée par défaut : null, aucun appel", async () => {
    expect(REGLAGE_MULTICAMERA_PAR_DEFAUT.actif).toBe(false);
    expect(await passeMulticameraAvocat({ ...base(), reglage: REGLAGE_MULTICAMERA_PAR_DEFAUT })).toBeNull();
    expect(await passeMulticameraAvocat({ ...base(), reglage: REGLAGE_MULTICAMERA_PAR_DEFAUT, consignes: ["mets une carte liste ici"] })).toBeNull();
  });

  it("consigne « Monteur, fais-le en 3 caméras » : trois angles en simulation", async () => {
    const piste = await passeMulticameraAvocat({ ...base(), reglage: REGLAGE_MULTICAMERA_PAR_DEFAUT, consignes: ["fais-le en 3 caméras"] });
    expect(piste).not.toBeNull();
    expect(Object.keys(piste!.sources).sort()).toEqual(["contre-plongee", "cote", "face"]);
    expect(piste!.sources.face).toBe("prises/face.mp4");
    expect(piste!.plans[0].angle).toBe("face");
    expect(piste!.plans.at(-1)!.angle).toBe("face");
    expect(piste!.replis).toEqual([]);
  });

  it("un angle raté : repli automatique, la vidéo reste montée sur les angles restants", async () => {
    const piste = await passeMulticameraAvocat({ ...base(), reglage: { ...REGLAGE_MULTICAMERA_PAR_DEFAUT, actif: true }, simulation: { echecs: { cote: "synchro" } } });
    expect(Object.keys(piste!.sources).sort()).toEqual(["contre-plongee", "face"]);
    expect(piste!.plans.some((p) => p.angle === "cote")).toBe(false);
    expect(piste!.replis).toEqual([{ angle: "cote", raison: "L'angle de côté : les lèvres ne suivent pas exactement la voix." }]);
  });

  it("deux angles ratés : un seul plan de face", async () => {
    const piste = await passeMulticameraAvocat({ ...base(), reglage: { ...REGLAGE_MULTICAMERA_PAR_DEFAUT, actif: true }, simulation: { echecs: { cote: "rendu", "contre-plongee": "visage" } } });
    expect(piste!.plans).toHaveLength(1);
    expect(piste!.plans[0].angle).toBe("face");
  });

  it("le réel n'est jamais choisi sans demande explicite ET ses dépendances", () => {
    const visageReel = { id: "heygen", mode: "reel" } as unknown as FournisseurVisage;
    const analyseur = { mesurer: async () => ({ dureeSec: 1, decalageAudioMs: 0, visagePresentPct: 100 }) };
    expect(choisirFournisseurMulticamera().mode).toBe("simulation");
    expect(choisirFournisseurMulticamera({ visage: visageReel, analyseur }).mode).toBe("simulation");
    expect(choisirFournisseurMulticamera({ reel: true, visage: visageReel }).mode).toBe("simulation");
    expect(choisirFournisseurMulticamera({ reel: true, visage: { ...visageReel, mode: "simulation" } as FournisseurVisage, analyseur }).mode).toBe("simulation");
    expect(choisirFournisseurMulticamera({ reel: true, visage: visageReel, analyseur }).mode).toBe("reel");
  });

  it("en réel, aucun look n'est créé à la volée (dépense) : un angle sans look préparé est écarté", async () => {
    const appels: string[] = [];
    const visageReel = {
      id: "heygen",
      mode: "reel",
      creerLook: async () => (appels.push("creerLook"), { idExterne: "x", statut: "pret" }),
      rendre: async () => (appels.push("rendre"), { idTravailExterne: "r" }),
    } as unknown as FournisseurVisage;
    const analyseur = { mesurer: async () => ({ dureeSec: 1, decalageAudioMs: 0, visagePresentPct: 100 }) };
    const piste = await passeMulticameraAvocat({ ...base(), reglage: { actif: true, reel: true, looks: {} }, visage: visageReel, analyseur });
    expect(appels).toEqual([]);
    expect(Object.keys(piste!.sources)).toEqual(["face"]);
  });
});

describe("F4 — l'avocat inchangé sans l'option", () => {
  it("aucun réglage visible ajouté au format avocat, schéma inchangé", () => {
    expect(formatAvocat.reglages.champs.map((c) => c.cle)).toEqual(["repartitionAngles", "cadrageDouble", "micro", "finEnBoucle", "ouvertureSurIllustration"]);
    expect(formatAvocat.reglages.schema.parse({})).toEqual({ repartitionAngles: "principal", micro: false, ouvertureSurIllustration: false, cadrageDouble: "taille", finEnBoucle: false });
  });
});
