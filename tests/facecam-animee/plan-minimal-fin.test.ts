/**
 * GV2-05 — le plan minimal (version simple) couvre toujours la prise jusqu'à l'horizon, et passe les contrôles bloquants.
 * Sonde du rapport A3 : prises simulées (6 à 150 s, trois débits de parole, graines fixes). PUR, aucun appel réseau.
 */
import { describe, expect, it } from "vitest";
import { assemblerPlan, planMinimalV4, verifierPlan, type EntreeRealisateur, type MotTranscrit } from "@/moteurs/montage-facecam-animee/realisateur";

const VOCABULAIRE = [
  "automatiser", "clients", "facture", "relance", "agenda", "équipe", "devis", "rendez-vous", "message", "gagner", "temps", "outil",
  "réponse", "suivi", "tableau", "commande", "projet", "contrat", "analyse", "rapport", "vente", "site", "courriel", "dossier",
];

/** Une prise simulée : un mot toutes les 1/débit seconde, jusqu'à `duree`. */
function prise(duree: number, debit: number, decalage: number): MotTranscrit[] {
  const pas = 1 / debit;
  const mots: MotTranscrit[] = [];
  for (let k = 0, t = 0.3; t + pas * 0.8 < duree; k++, t += pas) {
    mots.push({ w: VOCABULAIRE[(k * 7 + decalage) % VOCABULAIRE.length], a: Math.round(t * 100) / 100, f: Math.round((t + pas * 0.8) * 100) / 100 });
  }
  return mots;
}

const DUREES = [6, 8, 10, 12, 14, 17, 20, 25, 30, 40, 55, 70, 90, 120, 150, 6.7, 12.4, 13.3, 21.8, 33.9];
const DEBITS = [1.5, 2.6, 3.8];
const GRAINES = [0, 1, 3, 7];

function jugee(duree: number, debit: number, graine: number) {
  const mots = prise(duree, debit, graine);
  const el = planMinimalV4({ mots, horizon: duree, graine });
  const entree: EntreeRealisateur = { mots, dureeSec: duree, prise: { src: "prise.mp4", finSec: duree }, fin: { debut: duree, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: [] } };
  const plan = assemblerPlan(entree, { cartes: [], fenetres: [], calques: [], zooms: [], elementsV4: el });
  return { el, v: verifierPlan(plan, mots) };
}

describe("GV2-05 · plan minimal : la dernière plaquette finit à l'horizon", () => {
  const refus: string[] = [];
  for (const duree of DUREES) for (const debit of DEBITS) for (const graine of GRAINES) {
    const { el, v } = jugee(duree, debit, graine);
    const fin = el.length ? Math.abs(el[el.length - 1].fin - duree) <= 1e-6 : false;
    const contigu = el.every((e, k) => (k === 0 ? Math.abs(e.debut) <= 1e-6 : Math.abs(e.debut - el[k - 1].fin) <= 1e-6));
    if (!v.rendable || !fin || !contigu) refus.push(`${duree}s ${debit}mot/s graine ${graine}: ${v.erreurs.slice(0, 2).join(" ; ")}${fin ? "" : " [fin≠horizon]"}`);
  }
  it("aucune prise simulée refusée (plan rendable, fin = horizon, plaquettes contiguës)", () => {
    expect(refus).toEqual([]);
  });
  it("mesure : nombre de prises simulées", () => {
    expect(DUREES.length * DEBITS.length * GRAINES.length).toBe(240);
  });
});
