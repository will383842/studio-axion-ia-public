/**
 * PLANCHE « RACCORD PAR FORME » (PLANCHE-RACCORD-FORME-v21p) : construit, par la chaîne réelle du cas concret
 * (`adapterPlan` sans appel à Claude → `tranchePlan` → `habillerTranches` avec `raccordForme: true`), la première tranche
 * qui porte un raccord. Script FICTIF (aucun client, aucune personne). Aucun réglage lu, aucun réseau.
 */
import { msEnImages } from "@/briques/jetons-motion";
import { PLAFONDS_PAR_DEFAUT } from "@/briques/motion/habillage-commun/types";
import type { PlanHabille } from "@/briques/motion/habillage-commun/types";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { adapterPlan } from "@/briques/plan-scenes-generateurs/adaptateur";
import { tranchePlan } from "@/briques/plan-scenes-generateurs/tranche";
import { FORMAT_PLAN_CAS_CONCRET, cleTranche } from "@/moteurs/montage-cas-concret/plan-scenes";
import { graineHabillage, habillerTranches } from "@/moteurs/montage-cas-concret/habillage-plan";

/** Écrans fictifs (≥ 10, sinon `choisirTransitions` ne pose rien). */
export const ECRANS_FICTIFS: readonly string[] = [
  "Elle perdait 30 % de son pain chaque jour, sans savoir pourquoi.",
  "Elle accueille 40 clients avant midi et note chaque vente.",
  "Sa boutique, à Lyon, ouvre à six heures et sent le pain chaud.",
  "Après un mois, son gaspillage passe de 30 à 10 % de la fournée.",
  "« Le pain ne ment jamais », répète-t-elle à ses apprentis le matin.",
  "D'abord elle pèse la farine, ensuite elle pétrit la pâte, enfin elle enfourne les baguettes.",
  "Les 3 règles de son carnet : noter, comparer, ajuster.",
  "Le samedi, 60 % de ses ventes se font avant dix heures.",
  "Ses 25 baguettes de moins le mardi lui font gagner du temps.",
  "Son frère l'aide à Marseille pour les grosses commandes de fin de mois.",
  "En quelques semaines, ses ventes passent de 200 à 250 euros par jour.",
  "« Chaque jour est une page blanche », dit-elle en allumant le four.",
  "D'abord elle goûte, ensuite elle corrige, enfin elle sert ses premiers clients.",
  "Les 4 habitudes de sa journée : pétrir, cuire, vendre, noter.",
  "Désormais, 80 % de ses clients reviennent dans la même semaine.",
  "Elle sert 50 clients de plus le dimanche sans rien jeter le soir.",
  "Sa deuxième boutique, à Bordeaux, ouvre le mois prochain avec la même méthode.",
  "Son gaspillage passe de 10 à 5 % grâce à son carnet de ventes.",
  "« Un carnet vaut mieux qu'une intuition », conclut-elle un soir de décembre.",
  "D'abord elle compte, ensuite elle compare, enfin elle décide de la fournée du lendemain.",
  "Les 5 conseils qu'elle donne : peser, noter, goûter, ajuster, recommencer.",
  "Au total, 90 % de son pain trouve désormais un client chaque jour.",
  "Sa troisième boutique, à Nantes, ouvre l'an prochain.",
  "Son temps de pétrissage passe de 40 à 25 minutes chaque matin.",
  "Son carnet de ventes passe de 100 à 300 pages en deux ans.",
];
const DUREE_ECRAN_MS = 6000;

export interface TrancheRaccord {
  /** Tranche habillée, avec `habillageCommun.raccords`. */
  tranche: PlanHabille;
  /** La même tranche sans habillage (témoin éteint). */
  temoin: PlanValide;
  /** Id de la scène (de la tranche) qui porte le raccord. */
  sceneId: string;
  /** Image locale 0 de la scène (comme `Scene` du rendu : `msEnImages(debutMs)`) ; la scène n'est active qu'à partir de l'image suivante si son début tombe entre deux images. */
  imageDebut: number;
  /** Première image où la scène est active (≥ `imageDebut`). */
  premiereImage: number;
}

export async function trancheRaccordForme(): Promise<TrancheRaccord> {
  const segments = ECRANS_FICTIFS.map((texte, i) => ({ texte, debutMs: i * DUREE_ECRAN_MS, finMs: (i + 1) * DUREE_ECRAN_MS }));
  // Stock seulement : aucun `appeler`, donc aucun appel à Claude.
  const { plan } = await adapterPlan({ generateur: "cas-concret", script: segments.map((s) => s.texte).join(" "), segments, format: FORMAT_PLAN_CAS_CONCRET, facecam: false }, {});
  if (!plan) throw new Error("BLOQUÉ : le plan du script fictif n'a pas été validé");
  const ecrans = segments.map((s, i) => ({ cle: cleTranche("corps", `e${i}`), debutMs: s.debutMs, finMs: s.finMs }));
  const tranches: Record<string, PlanValide> = {};
  for (const e of ecrans) {
    const t = tranchePlan(plan, e.debutMs, e.finMs);
    if (t) tranches[e.cle] = t;
  }
  const habillees = habillerTranches({ actif: true, raccordForme: true, plan, ecrans, tranches, plafonds: PLAFONDS_PAR_DEFAUT, graine: graineHabillage("planche-raccord-forme/corps") });
  for (const e of ecrans) {
    const h = habillees[e.cle] as PlanHabille | undefined;
    const raccords = h?.habillageCommun?.raccords;
    const sceneId = raccords ? Object.keys(raccords)[0] : undefined;
    if (!h || !sceneId) continue;
    const scene = h.scenes.find((x) => x.id === sceneId);
    if (!scene) continue;
    const temoin: Partial<PlanHabille> = { ...h };
    delete temoin.habillageCommun;
    return { tranche: h, temoin: temoin as PlanValide, sceneId, imageDebut: msEnImages(scene.debutMs, h.format.fps), premiereImage: Math.ceil((scene.debutMs * h.format.fps) / 1000) };
  }
  throw new Error("BLOQUÉ : aucune tranche à raccord");
}
