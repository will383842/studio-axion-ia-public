/**
 * RÉPARTIR UN LOT SUR 2 À 4 SEMAINES (PUR : aucune écriture, aucun réseau, aucune horloge système, rien n'est envoyé).
 * Un seul moteur de placement : chaque élément passe par `planifierAvecContexte` (L3-16), qui fait respecter le week-end
 * LinkedIn, le quota par jour, l'écart minimal et la règle pilier+cible. Ce fichier choisit seulement le jour de départ
 * de chaque élément pour étaler le lot sur la fenêtre. Ordre d'entrée sans effet (rotation par identifiant) : même lot, même plan.
 */
import { ordreRotation } from "@/domaine/cadence/rotation";
import { planifierAvecContexte, type CreneauPlanifie, type OptionsPlanification, type PostExistant, type SujetAPlanifier } from "@/domaine/cadence/planifier";
import { verifierEspacement, type Constat } from "@/domaine/cadence/verifier";
import { ajouterJoursParis } from "@/lib/horloge-paris";
import type { ReseauDeclinaison } from "@/domaine/types";

export const SEMAINES_MIN = 2;
export const SEMAINES_MAX = 4;

export interface ResultatLot {
  creneaux: CreneauPlanifie[];
  /** Créneaux placés après la fin de la fenêtre (jamais cachés). */
  horsFenetre: CreneauPlanifie[];
  /** Avertissements (quota, week-end) ; les violations dures sont écartées par construction. */
  avertissements: Constat[];
  /** Violations dures restantes au sens du planificateur (déclinaisons d'un même sujet exemptées de pilier+cible) : vide par construction. */
  violations: Constat[];
  erreur?: string;
}

const vide = (erreur: string): ResultatLot => ({ creneaux: [], horsFenetre: [], avertissements: [], violations: [], erreur });

function jourReel(jour: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return false;
  const d = new Date(`${jour}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === jour;
}

export function repartirLot(
  debut: string,
  semaines: number,
  sujets: readonly SujetAPlanifier[],
  reseaux: readonly ReseauDeclinaison[],
  existants: readonly PostExistant[],
  options: OptionsPlanification = {},
): ResultatLot {
  if (!jourReel(debut)) return vide("Le jour de début n'est pas une date valide (AAAA-MM-JJ).");
  if (!Number.isInteger(semaines) || semaines < SEMAINES_MIN || semaines > SEMAINES_MAX) return vide(`Le lot se répartit sur ${SEMAINES_MIN} à ${SEMAINES_MAX} semaines.`);
  if (sujets.length === 0) return vide("Le lot est vide.");
  if (reseaux.length === 0) return vide("Aucun réseau choisi.");

  const ordre = ordreRotation(sujets);
  const jours = semaines * 7;
  const fin = ajouterJoursParis(debut, jours - 1);
  const ids = new Set(ordre.map((s) => s.id));
  const contexte: PostExistant[] = existants.filter((p) => !(p.sujet !== undefined && ids.has(p.sujet)));
  const creneaux: CreneauPlanifie[] = [];
  for (const [i, s] of ordre.entries()) {
    const depart = ajouterJoursParis(debut, Math.floor((i * jours) / ordre.length));
    let plan = planifierAvecContexte(depart, reseaux, s, contexte, options);
    // Un départ trop tardif (week-end LinkedIn, jours déjà pris) peut sortir de la fenêtre : on recule le départ jusqu'à tenir dedans.
    for (let k = 1; k <= Math.floor((i * jours) / ordre.length) && plan.some((c) => c.jour > fin); k++) {
      const essai = planifierAvecContexte(ajouterJoursParis(depart, -k), reseaux, s, contexte, options);
      if (essai.every((c) => c.jour <= fin)) plan = essai;
    }
    contexte.push(...plan);
    creneaux.push(...plan);
  }
  const siens = new Set(creneaux.map((c) => c.id));
  const touche = (c: Constat) => c.posts.some((id) => siens.has(id));
  const sujetDe = new Map(creneaux.map((c) => [c.id, c.sujet]));
  const memeSujet = (c: Constat) => c.posts.every((id) => sujetDe.get(id) === sujetDe.get(c.posts[0]));
  const constats = verifierEspacement([...contexte]).filter(touche);
  return {
    creneaux,
    horsFenetre: creneaux.filter((c) => c.jour > fin),
    avertissements: constats.filter((c) => c.niveau === "avertissement"),
    violations: constats.filter((c) => c.niveau === "violation" && !(c.code === "repetition" && memeSujet(c))),
  };
}
