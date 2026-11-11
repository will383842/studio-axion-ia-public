/**
 * PLANIFICATEUR MULTI-SUJETS (PUR : aucune écriture, aucun réseau, aucune horloge système).
 * `planifierAvecContexte` appelle `planifierPublications` (plan d'un sujet), puis décale chaque publication
 * vers le prochain jour libre du réseau (week-end LinkedIn et quota par jour, via le noyau d'espacement),
 * en tenant compte des posts déjà planifiés. `planifierLot` enchaîne plusieurs sujets dans l'ordre de rotation.
 * Relance : les posts du sujet (identifiant `<sujet>:<réseau>`) déjà présents dans le contexte sont ignorés,
 * donc le même lot redonne le même plan.
 */
import { planifierPublications } from "@/domaine/classement-generateur";
import type { ReseauDeclinaison } from "@/domaine/types";
import { ordreRotation } from "./rotation";
import { prochainJourLibre, REGLES_PAR_DEFAUT, type PostPlanifie, type ReglesEspacement } from "./verifier";

export interface SujetAPlanifier {
  id: string;
  pilier: string;
  cible: string;
}

export interface CreneauPlanifie extends PostPlanifie {
  sujet: string;
}

export interface OptionsPlanification {
  ordre?: readonly string[];
  heures?: Partial<Record<ReseauDeclinaison, string>>;
  regles?: ReglesEspacement;
  /** Heure par défaut (HH:MM, Paris) d'un créneau sans heure choisie. */
  heureParDefaut?: string;
}

export const idCreneau = (sujet: string, reseau: string) => `${sujet}:${reseau}`;

export function planifierAvecContexte(
  jourJ: string,
  reseaux: readonly ReseauDeclinaison[],
  sujet: SujetAPlanifier,
  existants: readonly PostPlanifie[],
  options: OptionsPlanification = {},
): CreneauPlanifie[] {
  const regles = options.regles ?? REGLES_PAR_DEFAUT;
  const prefixe = `${sujet.id}:`;
  const pris: PostPlanifie[] = existants.filter((p) => !p.id.startsWith(prefixe));
  const propose = planifierPublications(jourJ, reseaux, options.ordre, options.heures);
  const resultat: CreneauPlanifie[] = [];
  for (const c of propose) {
    const jour = prochainJourLibre(c.reseau, c.jour, pris, regles);
    const post: CreneauPlanifie = {
      id: idCreneau(sujet.id, c.reseau),
      sujet: sujet.id,
      reseau: c.reseau,
      jour,
      heure: c.heure ?? options.heureParDefaut ?? "09:00",
      pilier: sujet.pilier,
      cible: sujet.cible,
    };
    pris.push(post);
    resultat.push(post);
  }
  return resultat;
}

/** Plan de plusieurs sujets lancés le même jour : chacun prend les jours libres laissés par les précédents. */
export function planifierLot(
  jourJ: string,
  sujets: readonly SujetAPlanifier[],
  reseaux: readonly ReseauDeclinaison[],
  existants: readonly PostPlanifie[],
  options: OptionsPlanification = {},
): CreneauPlanifie[] {
  const ids = new Set(sujets.map((s) => s.id));
  const contexte: PostPlanifie[] = existants.filter((p) => !ids.has(p.id.split(":")[0]));
  const tout: CreneauPlanifie[] = [];
  for (const s of ordreRotation(sujets)) {
    const plan = planifierAvecContexte(jourJ, reseaux, s, contexte, options);
    contexte.push(...plan);
    tout.push(...plan);
  }
  return tout;
}
