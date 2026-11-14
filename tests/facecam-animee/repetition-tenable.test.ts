/**
 * FACE CAMÉRA ANIMÉE v4 — GV2-47 : la règle D17b (trop de plaquettes déjà prises) n'est plus impossible à tenir. Le seuil
 * tient compte des plaquettes actives encore jamais prises : on ne demande pas plus de neuves que le catalogue n'en a.
 * AUCUN appel réseau.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ElementV4Plan } from "@/domaine/facecam-animee/plan";
import { assemblerPlan, verifierPlan, type EntreeRealisateur, type HistoriqueVideo, type MotTranscrit } from "@/moteurs/montage-facecam-animee/realisateur";
import { CATALOGUE_V4 } from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v4";

const REPETITION = join(__dirname, "..", "..", "docs/facecam-animee-v4/repetition-generale");
const TRANS = JSON.parse(readFileSync(join(REPETITION, "transcription.json"), "utf8")) as { dureeMonteeSec: number; motsMontesTexteValide: MotTranscrit[] };
const MOTS = TRANS.motsMontesTexteValide;
const DUREE = TRANS.dureeMonteeSec;
const ENTREE: EntreeRealisateur = { mots: MOTS, dureeSec: DUREE, prise: { src: "prise-montee.mp4", finSec: DUREE }, fin: { debut: DUREE, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: [] } };

const actives = CATALOGUE_V4.filter((f) => f.actif).map((f) => f.id);
const video = (plaquettesV4: string[]): HistoriqueVideo => ({ types: [], entrees: [], plaquettesV4 });
const d17b = (l: readonly string[]) => l.filter((x) => x.startsWith("D17b"));

/** Plan de plaquettes différentes (les autres erreurs du plan ne nous regardent pas : on ne lit que D17b). */
function planAvec(ids: string[]) {
  const elements = ids.map((id, k) => ({ id, debut: k * 3, fin: k * 3 + 2 }) as unknown as ElementV4Plan);
  return assemblerPlan(ENTREE, { cartes: [], fenetres: [], calques: [], zooms: [], elementsV4: elements });
}

describe("D17b tenable", () => {
  it("le catalogue a bien 26 plaquettes actives", () => expect(actives).toHaveLength(26));

  const prises = actives.slice(0, 24);
  const neuves = actives.slice(24);
  const historique = [video(prises.slice(0, 12)), video(prises.slice(12))];

  it("2 vidéos couvrent 24 des 26 : un plan de 16 plaquettes dont les 2 neuves → aucun D17b", () => {
    const plan = [...neuves, ...prises.slice(0, 14)];
    expect(plan).toHaveLength(16);
    expect(d17b(verifierPlan(planAvec(plan), MOTS, { historique }).erreurs)).toEqual([]);
  });

  it("même historique, plan sans aucune des 2 neuves alors qu'il pourrait → D17b, qui dit le seuil appliqué", () => {
    const erreurs = d17b(verifierPlan(planAvec(prises.slice(0, 16)), MOTS, { historique }).erreurs);
    expect(erreurs).toHaveLength(1);
    expect(erreurs[0]).toContain("au plus 98 %");
  });

  it("sans historique : rien", () => {
    expect(d17b(verifierPlan(planAvec(prises.slice(0, 16)), MOTS).erreurs)).toEqual([]);
    expect(d17b(verifierPlan(planAvec(prises.slice(0, 16)), MOTS, { historique: [] }).erreurs)).toEqual([]);
  });
});
