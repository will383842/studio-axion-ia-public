/**
 * PLANIFICATEUR MULTI-SUJETS (PUR : aucune écriture, aucun réseau, aucune horloge système).
 * `planifierAvecContexte` appelle `planifierPublications` (plan d'un sujet), puis décale chaque publication
 * vers le prochain jour libre du réseau (week-end LinkedIn et quota par jour, via le noyau d'espacement),
 * en tenant compte des posts déjà planifiés. `planifierLot` enchaîne plusieurs sujets dans l'ordre de rotation.
 * Le jour retenu respecte aussi l'écart minimal et la règle pilier+cible du noyau (`verifierEspacement`) : le plan ne
 * crée aucune violation. Les déclinaisons d'un MÊME sujet sur plusieurs réseaux sont exemptées de la règle
 * pilier+cible (choix du planificateur, à confirmer par le pilotage : le noyau la compte encore).
 * Relance : les posts dont le champ `sujet` est celui du sujet sont ignorés du contexte, donc le même lot redonne
 * le même plan.
 */
import { planifierPublications } from "@/domaine/classement-generateur";
import type { ReseauDeclinaison } from "@/domaine/types";
import { ordreRotation } from "./rotation";
import { ajouterJoursParis } from "@/lib/horloge-paris";
import { prochainJourLibre, REGLES_PAR_DEFAUT, verifierEspacement, type PostPlanifie, type ReglesEspacement } from "./verifier";

/** Un post déjà planifié, avec (si connu) le sujet dont il est une déclinaison : l'écart se fait sur ce champ, pas sur l'identifiant. */
export type PostExistant = PostPlanifie & { sujet?: string };

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

/** Le candidat crée-t-il une violation avec les posts pris ? (déclinaisons du même sujet exemptées de pilier+cible) */
function conflit(candidat: CreneauPlanifie, pris: readonly PostPlanifie[], siens: readonly CreneauPlanifie[], regles: ReglesEspacement): boolean {
  const memeSujet = new Set(siens.map((p) => p.id));
  return verifierEspacement([...pris, candidat], regles).some(
    (v) =>
      v.niveau === "violation" &&
      v.posts.includes(candidat.id) &&
      !(v.code === "repetition" && v.posts.every((id) => id === candidat.id || memeSujet.has(id))),
  );
}

export function planifierAvecContexte(
  jourJ: string,
  reseaux: readonly ReseauDeclinaison[],
  sujet: SujetAPlanifier,
  existants: readonly PostExistant[],
  options: OptionsPlanification = {},
): CreneauPlanifie[] {
  const regles = options.regles ?? REGLES_PAR_DEFAUT;
  const pris: PostPlanifie[] = existants.filter((p) => p.sujet !== sujet.id);
  const propose = planifierPublications(jourJ, reseaux, options.ordre, options.heures);
  const resultat: CreneauPlanifie[] = [];
  for (const c of propose) {
    const modele = {
      id: idCreneau(sujet.id, c.reseau),
      sujet: sujet.id,
      reseau: c.reseau,
      heure: c.heure ?? options.heureParDefaut ?? "09:00",
      pilier: sujet.pilier,
      cible: sujet.cible,
    };
    let jour = prochainJourLibre(c.reseau, c.jour, pris, regles);
    for (let i = 0; i < 366 && conflit({ ...modele, jour }, pris, resultat, regles); i++) {
      jour = prochainJourLibre(c.reseau, ajouterJoursParis(jour, 1), pris, regles);
    }
    const post: CreneauPlanifie = { ...modele, jour };
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
  existants: readonly PostExistant[],
  options: OptionsPlanification = {},
): CreneauPlanifie[] {
  const ids = new Set(sujets.map((s) => s.id));
  const contexte: PostExistant[] = existants.filter((p) => !(p.sujet !== undefined && ids.has(p.sujet)));
  const tout: CreneauPlanifie[] = [];
  for (const s of ordreRotation(sujets)) {
    const plan = planifierAvecContexte(jourJ, reseaux, s, contexte, options);
    contexte.push(...plan);
    tout.push(...plan);
  }
  return tout;
}
