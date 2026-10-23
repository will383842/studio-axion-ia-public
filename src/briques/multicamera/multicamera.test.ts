import { describe, expect, it } from "vitest";
import { doubleSimulationMulticamera } from "@/fournisseurs/multicamera";
import {
  anglesRetenus,
  coupeDansUnMot,
  demandeRenduAngle,
  estConsigneTroisCameras,
  fabriquerAngles,
  pisteMulticameraAvocat,
  realiserMulticamera,
  verifierAngle,
  type MotRealisation,
  type PlanCamera,
} from ".";
import { lireReglageMulticamera, multicameraDemandee } from "./reglage";

/** Horodate un texte, bloc par bloc : 0,25 s par mot, blanc 0,08 s entre mots, 0,4 s après une phrase. */
function horodater(blocs: [string, string][]): MotRealisation[] {
  const mots: MotRealisation[] = [];
  let t = 0.2;
  for (const [bloc, texte] of blocs) {
    for (const mot of texte.split(/\s+/).filter(Boolean)) {
      mots.push({ mot, debutSec: +t.toFixed(3), finSec: +(t + 0.25).toFixed(3), bloc });
      t += 0.25 + (/[.!?]$/.test(mot) ? 0.4 : 0.08);
    }
  }
  return mots;
}

const SCRIPT: [string, string][] = [
  ["accroche", "Votre patron lit vos mails ? C'est interdit !"],
  ["promesse", "Je vous explique comment réagir, en trois points simples."],
  [
    "coeur",
    "D'abord, la loi protège vos messages personnels, même sur l'ordinateur du bureau. Ensuite, un message marqué personnel ne peut pas être ouvert sans vous. Concrètement, votre employeur doit vous prévenir avant tout contrôle. Enfin, le code du travail encadre chaque étape de la procédure.",
  ],
  ["preuve", "En 2023, un salarié a obtenu 15 000 € pour ce motif !"],
  ["appel", "Abonnez-vous et écrivez-moi en commentaire."],
];

const ANGLES3 = ["face", "cote", "contre-plongee"] as const;

function verifierRegles(plans: PlanCamera[], mots: MotRealisation[], angles: readonly string[]) {
  for (let k = 1; k < plans.length; k++) {
    expect(plans[k].debutSec).toBeCloseTo(plans[k - 1].finSec, 6);
    expect(coupeDansUnMot(plans[k].debutSec, mots)).toBe(false);
    if (angles.length > 1) expect(plans[k].angle).not.toBe(plans[k - 1].angle);
  }
}

describe("F4 — réalisation multicaméra : règles de coupe", () => {
  const mots = horodater(SCRIPT);
  const plans = realiserMulticamera({ mots, anglesDisponibles: ANGLES3 });

  it("coupe jamais au milieu d'un mot, jamais deux fois le même angle de suite, couvre toute la vidéo", () => {
    expect(plans.length).toBeGreaterThan(3);
    expect(plans[0].debutSec).toBe(0);
    expect(plans.at(-1)!.finSec).toBeCloseTo(mots.at(-1)!.finSec, 3);
    verifierRegles(plans, mots, ANGLES3);
  });

  it("rythme 3-6 s (l'appel d'un seul tenant excepté)", () => {
    for (const p of plans.filter((x) => x.raison !== "appel")) {
      const d = p.finSec - p.debutSec;
      expect(d).toBeGreaterThanOrEqual(3 - 1e-6);
      expect(d).toBeLessThanOrEqual(8);
    }
    const moyenne = plans.reduce((s, p) => s + p.finSec - p.debutSec, 0) / plans.length;
    expect(moyenne).toBeGreaterThanOrEqual(3);
    expect(moyenne).toBeLessThanOrEqual(6);
  });

  it("change d'angle au début d'une phrase ou d'une idée", () => {
    for (const p of plans.slice(1)) {
      const i = p.premierMot;
      const avant = mots[i - 1];
      const debutIdee = /[.!?,;:]$/.test(avant.mot) || avant.bloc !== mots[i].bloc || mots[i].debutSec - avant.finSec >= 0.35 || /^(d'abord|ensuite|enfin|concrètement|mais|donc)/i.test(mots[i].mot);
      expect(debutIdee, `coupe avant « ${mots[i].mot} »`).toBe(true);
    }
  });

  it("accroche de face, explication de côté, phrase forte en contre-plongée, appel de face", () => {
    expect(plans[0]).toMatchObject({ angle: "face", raison: "accroche" });
    expect(plans.at(-1)).toMatchObject({ angle: "face", raison: "appel" });
    const explications = plans.filter((p) => p.raison === "explication");
    expect(explications.filter((p) => p.angle === "cote").length).toBeGreaterThanOrEqual(explications.length / 2);
    expect(explications.some((p) => p.angle === "contre-plongee")).toBe(false);
    expect(plans.some((p) => p.raison === "phrase-forte" && p.angle === "contre-plongee")).toBe(true);
  });

  it("déterministe", () => {
    expect(realiserMulticamera({ mots, anglesDisponibles: ANGLES3 })).toEqual(plans);
  });

  it("coupes préférées (fins des plans du format) : la coupe d'angle s'y aligne quand elle le peut", () => {
    const preferees = plans.slice(1).map((p) => p.debutSec);
    const autre = realiserMulticamera({ mots, anglesDisponibles: ANGLES3, coupesPrefereesSec: preferees });
    expect(autre.map((p) => p.debutSec)).toEqual(plans.map((p) => p.debutSec));
  });

  it("un texte sans ponctuation coupe tout de même dans un blanc entre deux mots", () => {
    const sans = horodater([["coeur", Array.from({ length: 60 }, (_, i) => `mot${i}`).join(" ")]]);
    const p = realiserMulticamera({ mots: sans, anglesDisponibles: ANGLES3 });
    verifierRegles(p, sans, ANGLES3);
    expect(p.length).toBeGreaterThan(1);
  });
});

describe("F4 — repli si un angle manque", () => {
  const mots = horodater(SCRIPT);

  it("un seul angle fabriqué : alternance face / cet angle, jamais l'angle manquant", () => {
    const plans = realiserMulticamera({ mots, anglesDisponibles: ["face", "cote"] });
    expect(plans.some((p) => p.angle === "contre-plongee")).toBe(false);
    verifierRegles(plans, mots, ["face", "cote"]);
  });

  it("aucun angle fabriqué : un seul plan de face (montage d'origine)", () => {
    const plans = realiserMulticamera({ mots, anglesDisponibles: [] });
    expect(plans).toEqual([{ angle: "face", debutSec: 0, finSec: mots.at(-1)!.finSec, raison: "repli", premierMot: 0, dernierMot: mots.length - 1 }]);
  });

  it("cohérence : durée, synchro et visage contrôlés ; la face toujours retenue", () => {
    expect(verifierAngle("cote", 30, { dureeSec: 30.04, decalageAudioMs: 20, visagePresentPct: 99 }).ok).toBe(true);
    expect(verifierAngle("cote", 30, { dureeSec: 30.5, decalageAudioMs: 0, visagePresentPct: 100 }).ok).toBe(false);
    expect(verifierAngle("cote", 30, { dureeSec: 30, decalageAudioMs: 120, visagePresentPct: 100 }).ok).toBe(false);
    expect(verifierAngle("cote", 30, { dureeSec: 30, decalageAudioMs: 0, visagePresentPct: 60 }).ok).toBe(false);
    const r = anglesRetenus([verifierAngle("cote", 30, { dureeSec: 30, decalageAudioMs: 0, visagePresentPct: 100 }), verifierAngle("contre-plongee", 30, null, "refus")]);
    expect(r.angles).toEqual(["face", "cote"]);
    expect(r.replis).toHaveLength(1);
    expect(r.replis[0].angle).toBe("contre-plongee");
  });

  it.each(["rendu", "duree", "synchro", "visage", "panne"] as const)("fabrication : échec « %s » sur la contre-plongée → repli, l'autre angle reste", async (echec) => {
    const f = doubleSimulationMulticamera({ dureeSec: 30, echecs: { "contre-plongee": echec } });
    const r = await fabriquerAngles({ fournisseur: f, travailId: "t1", priseCle: "prise.mp4", audioCle: "son.wav", dureePriseSec: 30, ratio: "9:16", looks: { cote: "sim-look-v-cote", "contre-plongee": "sim-look-v-contre-plongee" }, attendre: async () => {} });
    expect(r.angles).toEqual(["face", "cote"]);
    expect(r.sources).toEqual({ face: "prise.mp4", cote: "simulation/multicamera/cote.mp4" });
    expect(r.replis[0].angle).toBe("contre-plongee");
  });

  it("fabrication : look absent → angle écarté sans aucun rendu", async () => {
    const f = doubleSimulationMulticamera({ dureeSec: 30 });
    const r = await fabriquerAngles({ fournisseur: f, travailId: "t1", priseCle: "prise.mp4", audioCle: "son.wav", dureePriseSec: 30, ratio: "9:16", looks: {}, attendre: async () => {} });
    expect(r.angles).toEqual(["face"]);
    expect(f.appels).toEqual([]);
  });

  it("rendu jamais terminé → repli après le nombre de suivis permis", async () => {
    const f = doubleSimulationMulticamera({ dureeSec: 30 });
    f.suivre = async () => ({ statut: "en_cours", progression: 10 });
    const r = await fabriquerAngles({ fournisseur: f, travailId: "t1", priseCle: "p", audioCle: "s", dureePriseSec: 30, ratio: "9:16", looks: { cote: "sim-look-v-cote" }, attendre: async () => {}, suivisMax: 3 });
    expect(r.angles).toEqual(["face"]);
  });
});

describe("F4 — consignes", () => {
  it("demande HeyGen : même son, clé d'idempotence stable, look de l'angle, gestes appris sur le look filmé", () => {
    const d = demandeRenduAngle({ angle: "contre-plongee", lookId: "look-cp", referenceLookId: "look-filme", audioCle: "son.wav", ratio: "9:16", fond: "decor-du-look", travailId: "t9", essai: 1 });
    expect(d).toMatchObject({ visageId: "look-cp", audioCle: "son.wav", referenceLookId: "look-filme", cleIdempotence: "multicam:t9:contre-plongee:e1", fond: "decor-du-look" });
    expect(d.motionPrompt).toMatch(/authoritative/);
  });

  it("« Monteur, fais-le en 3 caméras » et variantes ; jamais sur une négation", () => {
    for (const t of ["fais-le en 3 caméras", "fais le en trois caméras.", "passe en multicaméra", "mets trois angles"]) expect(estConsigneTroisCameras(t), t).toBe(true);
    for (const t of ["ne le fais pas en 3 caméras", "sans multicaméra", "mets une carte liste ici", "3 points clés"]) expect(estConsigneTroisCameras(t), t).toBe(false);
  });

  it("réglage caché coupé par défaut, lecture tolérante", () => {
    expect(lireReglageMulticamera(undefined)).toEqual({ actif: false, reel: false, looks: {} });
    expect(lireReglageMulticamera({ actif: "oui", reel: 1, looks: { v: { cote: "l1", autre: "x" }, "": { cote: "y" } } })).toEqual({ actif: false, reel: false, looks: { v: { cote: "l1" } } });
    const coupe = lireReglageMulticamera(null);
    expect(multicameraDemandee(coupe)).toBe(false);
    expect(multicameraDemandee(coupe, ["fais-le en 3 caméras"])).toBe(true);
    expect(multicameraDemandee({ ...coupe, actif: true })).toBe(true);
  });
});

describe("F4 — couche avocat", () => {
  const mots = horodater(SCRIPT).map((m, i) => ({ ...m, segmentId: `s-${m.bloc}`, i }));
  const segments = SCRIPT.map(([bloc]) => ({ id: `s-${bloc}`, bloc }));
  const plans = [
    { debutSec: 0, finSec: 4.1 },
    { debutSec: 4.1, finSec: 9 },
    { debutSec: 9, finSec: mots.at(-1)!.finSec },
  ];

  it("option absente ou coupée : null (l'avocat ne change pas)", () => {
    expect(pisteMulticameraAvocat({ plans, mots, segments, sources: { face: "p", cote: "c" } })).toBeNull();
    expect(pisteMulticameraAvocat({ actif: false, plans, mots, segments, sources: { face: "p", cote: "c" } })).toBeNull();
  });

  it("option allumée : couche multicaméra sur les trois sources, plans de l'avocat non modifiés", () => {
    const copie = JSON.parse(JSON.stringify(plans));
    const piste = pisteMulticameraAvocat({ actif: true, plans, mots, segments, sources: { face: "p", cote: "c", "contre-plongee": "cp" } })!;
    expect(piste.version).toBe(1);
    expect(new Set(piste.plans.map((p) => p.angle))).toEqual(new Set(ANGLES3));
    expect(plans).toEqual(copie);
    verifierRegles(piste.plans, mots, ANGLES3);
  });
});
