/**
 * FACE CAMÉRA ANIMÉE v4 — GV-MD-01 : la mémoire des animations déjà servies est une RÈGLE (D17a ouverture, D17b plaquettes reprises),
 * plus seulement un conseil. Bloquante au PREMIER essai du réalisateur seulement, simple avertissement ensuite : jamais d'échec de vidéo pour cette raison,
 * et jamais plus d'appels d'IA qu'avant (2 au plus pour une vidéo qui se répète). AUCUN appel réseau.
 * Données : celles de `lot-i.test.ts` (vraie prise montée ; le plan v4 minimal y a 0 erreur).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ElementV4Plan } from "@/domaine/facecam-animee/plan";
import {
  assemblerPlan,
  ESSAIS_MAX_REALISATEUR,
  PHRASE_REPETITION_GARDEE,
  planMinimalV4,
  realiser,
  verifierPlan,
  type EntreeRealisateur,
  type HistoriqueVideo,
  type MotTranscrit,
  type ReponseRealisateur,
  type RequeteRealisateur,
} from "@/moteurs/montage-facecam-animee/realisateur";
import { blocHistoriqueV4 } from "@/moteurs/montage-facecam-animee/realisateur/consignes";
import { SEUILS_V4 } from "@/moteurs/montage-facecam-animee/realisateur/regles-v4";

const REPETITION = join(__dirname, "..", "..", "docs/facecam-animee-v4/repetition-generale");
const TRANS = JSON.parse(readFileSync(join(REPETITION, "transcription.json"), "utf8")) as { dureeMonteeSec: number; motsMontesTexteValide: MotTranscrit[] };
const MOTS = TRANS.motsMontesTexteValide;
const DUREE = TRANS.dureeMonteeSec;
const ENTREE: EntreeRealisateur = { mots: MOTS, dureeSec: DUREE, prise: { src: "prise-montee.mp4", finSec: DUREE }, fin: { debut: DUREE, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: [] } };

const elements: ElementV4Plan[] = planMinimalV4({ mots: MOTS, horizon: DUREE });
const plan = () => assemblerPlan(ENTREE, { cartes: [], fenetres: [], calques: [], zooms: [], elementsV4: elements });
const reponsePlan = (): ReponseRealisateur => ({ ok: true, donnees: { cartes: [], fenetres: [], calques: [], zooms: [], elementsV4: elements } });

const ouverture = [...elements].sort((a, b) => a.debut - b.debut)[0].id;
const distinctes = [...new Set(elements.map((e) => e.id))];
const video = (extra: Partial<HistoriqueVideo>): HistoriqueVideo => ({ types: [], entrees: [], ...extra });
const d17 = (l: readonly string[]) => l.filter((x) => x.startsWith("D17"));
const HISTO_REPETE = [video({ ouvertureV4: ouverture, plaquettesV4: distinctes })];

function fauxClaude(reponses: ReponseRealisateur[]) {
  const requetes: RequeteRealisateur[] = [];
  const appeler = vi.fn(async (r: RequeteRealisateur) => {
    requetes.push(r);
    return reponses[Math.min(requetes.length - 1, reponses.length - 1)];
  });
  return { appeler, requetes };
}

describe("anti-répétition · le plan d'exemple", () => {
  it("n'a aucune erreur sans historique et assez de plaquettes différentes pour juger D17b", () => {
    expect(verifierPlan(plan(), MOTS).erreurs).toEqual([]);
    expect(distinctes.length).toBeGreaterThanOrEqual(SEUILS_V4.plaquettesMinPourReprise);
  });
});

describe("anti-répétition · D17a (ouverture)", () => {
  it("ouvre comme la vidéo précédente → erreur D17a, mais le plan reste rendable", () => {
    const v = verifierPlan(plan(), MOTS, { historique: [video({ ouvertureV4: ouverture })] });
    expect(v.erreurs).toHaveLength(1);
    expect(v.erreurs[0].startsWith("D17a")).toBe(true);
    expect(v.rendable).toBe(true);
  });
  it("ouvre comme la 3ᵉ dernière vidéo → erreur ; comme la 4ᵉ → rien", () => {
    const autre = video({ ouvertureV4: "AutrePlaquette" });
    expect(d17(verifierPlan(plan(), MOTS, { historique: [autre, autre, video({ ouvertureV4: ouverture })] }).erreurs)).toHaveLength(1);
    expect(verifierPlan(plan(), MOTS, { historique: [autre, autre, autre, video({ ouvertureV4: ouverture })] }).erreurs).toEqual([]);
  });
});

describe("anti-répétition · D17b (plaquettes reprises)", () => {
  const n = distinctes.length;
  const k = Math.floor(SEUILS_V4.partReprisePlaquettesMax * n) + 1; // juste au-dessus du seuil
  it("plus de 60 % des plaquettes déjà prises dans les 2 dernières vidéos → erreur D17b", () => {
    const v = verifierPlan(plan(), MOTS, { historique: [video({ plaquettesV4: distinctes.slice(0, k) })] });
    expect(v.erreurs).toHaveLength(1);
    expect(v.erreurs[0].startsWith("D17b")).toBe(true);
  });
  it("juste au seuil (une plaquette de moins) → rien", () => {
    expect(verifierPlan(plan(), MOTS, { historique: [video({ plaquettesV4: distinctes.slice(0, k - 1) })] }).erreurs).toEqual([]);
  });
  it("la 3ᵉ vidéo n'est plus regardée (2 dernières seulement)", () => {
    const vide = video({ plaquettesV4: ["AutrePlaquette"] });
    expect(verifierPlan(plan(), MOTS, { historique: [vide, vide, video({ plaquettesV4: distinctes })] }).erreurs).toEqual([]);
  });
});

describe("anti-répétition · sans historique, rien ne change", () => {
  it("pas d'historique, historique vide, historique sans plaquettes v4 : mêmes erreurs et avertissements", () => {
    const base = verifierPlan(plan(), MOTS);
    for (const historique of [[], [video({})], [video({ titre: "x" }), video({})]]) {
      const v = verifierPlan(plan(), MOTS, { historique });
      expect(v.erreurs).toEqual(base.erreurs);
      expect(v.avertissements).toEqual(base.avertissements);
    }
  });
  it("sans historique : le plan passe au premier essai, sans phrase", async () => {
    const { appeler, requetes } = fauxClaude([reponsePlan()]);
    const r = await realiser(ENTREE, { appeler });
    expect(requetes).toHaveLength(1);
    expect(r.version).toBe("complete");
    expect(r.essais).toBe(1);
    expect(r.phrase).toBeUndefined();
    expect(d17(r.avertissements)).toHaveLength(0);
  });
  it("historique sans rapport avec le plan : accepté au premier essai, sans avertissement D17", async () => {
    const { appeler, requetes } = fauxClaude([reponsePlan()]);
    const r = await realiser({ ...ENTREE, historique: [video({ ouvertureV4: "AutrePlaquette", plaquettesV4: ["AutrePlaquette"] })] }, { appeler });
    expect(requetes).toHaveLength(1);
    expect(d17(r.avertissements)).toHaveLength(0);
    expect(r.phrase).toBeUndefined();
  });
});

describe("anti-répétition · jamais d'échec ni d'appel de plus", () => {
  it("avec l'option « avertissement » : D17 passe d'erreur à avertissement, le reste est identique", () => {
    const bloquant = verifierPlan(plan(), MOTS, { historique: HISTO_REPETE });
    const doux = verifierPlan(plan(), MOTS, { historique: HISTO_REPETE, repetitionEnAvertissement: true });
    expect(d17(bloquant.erreurs).length).toBeGreaterThanOrEqual(2);
    expect(doux.erreurs).toEqual([]);
    expect(doux.avertissements).toEqual([...bloquant.avertissements, ...bloquant.erreurs]);
  });

  it("Opus répète le même plan : refusé au 1er essai (erreur renvoyée), gardé et signalé au 2e ; 2 appels au plus, jamais 3", async () => {
    const { appeler, requetes } = fauxClaude([reponsePlan()]);
    const r = await realiser({ ...ENTREE, historique: HISTO_REPETE }, { appeler });
    expect(ESSAIS_MAX_REALISATEUR).toBe(3);
    expect(requetes).toHaveLength(2);
    expect(requetes[1].message).toContain("D17a");
    expect(r.version).toBe("complete");
    expect(r.essais).toBe(2);
    expect(r.rendable).toBe(true);
    expect(r.phrase).toBe(PHRASE_REPETITION_GARDEE);
    expect(d17(r.avertissements).length).toBeGreaterThanOrEqual(2);
  });

  it("2e réponse illisible (GV-MD-01b : pas de 3e appel) : le plan refusé seulement pour D17 est rendu (pas la version simple)", async () => {
    const { appeler, requetes } = fauxClaude([reponsePlan(), { ok: true, donnees: { elementsV4: "rien" } }]);
    const r = await realiser({ ...ENTREE, historique: HISTO_REPETE }, { appeler });
    expect(requetes).toHaveLength(2);
    expect(r.version).toBe("complete");
    expect(r.rendable).toBe(true);
    expect(r.phrase).toBe(PHRASE_REPETITION_GARDEE);
    expect(r.plan.elementsV4).toEqual(elements);
    expect(r.avertissements.filter((a) => a.includes("D17")).length).toBeGreaterThanOrEqual(2);
  });

  it("GV-MD-01b · 1er plan refusé pour répétition, 2e refusé pour une AUTRE règle : 2 requêtes, plan du 1er essai rendu", async () => {
    const mauvais: ReponseRealisateur = { ok: true, donnees: { cartes: [], fenetres: [], calques: [], zooms: [{ debut: 0, fin: DUREE + 500, echelle: 1.2 }], elementsV4: elements } };
    expect(verifierPlan(assemblerPlan(ENTREE, { cartes: [], fenetres: [], calques: [], zooms: [[0, DUREE + 500, 1.2]], elementsV4: elements }), MOTS, { repetitionEnAvertissement: true }).erreurs.length).toBeGreaterThan(0);
    const { appeler, requetes } = fauxClaude([reponsePlan(), mauvais]);
    const r = await realiser({ ...ENTREE, historique: HISTO_REPETE }, { appeler });
    expect(requetes).toHaveLength(2);
    expect(r.version).toBe("complete");
    expect(r.rendable).toBe(true);
    expect(r.phrase).toBe(PHRASE_REPETITION_GARDEE);
    expect(r.plan.zooms).toEqual([]);
    expect(r.plan.elementsV4).toEqual(elements);
  });

  it("GV-MD-01b · 1er plan refusé pour une autre raison (sans répétition) : comportement inchangé, 3 appels puis version simple", async () => {
    const { appeler, requetes } = fauxClaude([{ ok: true, donnees: { elementsV4: "rien" } }]);
    const r = await realiser(ENTREE, { appeler });
    expect(requetes).toHaveLength(ESSAIS_MAX_REALISATEUR);
    expect(r.version).toBe("simple");
    expect(r.phrase).not.toBe(PHRASE_REPETITION_GARDEE);
  });

  it("panne d'Opus au 2e essai : le plan gardé est rendu", async () => {
    const { appeler, requetes } = fauxClaude([reponsePlan(), { ok: false, message: "panne" }]);
    const r = await realiser({ ...ENTREE, historique: HISTO_REPETE }, { appeler });
    expect(requetes).toHaveLength(2);
    expect(r.version).toBe("complete");
    expect(r.phrase).toBe(PHRASE_REPETITION_GARDEE);
  });

  it("panne dès le 1er essai (aucun plan lu) : la version simple, comme avant", async () => {
    const { appeler } = fauxClaude([{ ok: false, message: "panne" }]);
    const r = await realiser({ ...ENTREE, historique: HISTO_REPETE }, { appeler });
    expect(r.version).toBe("simple");
    expect(r.rendable).toBe(true);
  });
});

describe("anti-répétition · la consigne dit la règle", () => {
  it("le bloc d'historique annonce le refus, les ouvertures à éviter et le seuil", () => {
    const b = blocHistoriqueV4([video({ plaquettesV4: ["EtiquetteTete"], ouvertureV4: "EtiquetteTete" })]);
    expect(b).toContain("plan refusé et à refaire si");
    expect(b).toContain("EtiquetteTete");
    expect(b).toContain(`${Math.round(100 * SEUILS_V4.partReprisePlaquettesMax)} %`);
  });
  it("sans historique v4 : toujours aucun bloc", () => {
    expect(blocHistoriqueV4([])).toBe("");
    expect(blocHistoriqueV4([video({})])).toBe("");
  });
});
