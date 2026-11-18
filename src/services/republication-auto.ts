/**
 * RC-16 : jours proposés pour relancer un contenu. « Automatique » veut dire que le Studio SUGGÈRE un jour, rien de plus.
 * Il ne crée rien, ne valide rien, n'envoie rien : calcul à l'ouverture de la page, aucune écriture, aucune tâche de fond.
 * Éteint par défaut : seule la valeur `true` allume ; toute autre valeur, ou une lecture en erreur, éteint.
 * Un seul moteur : les contrôles de placement et le rang viennent de L8-11a, la liste des candidats de L8-12a (jamais recopiés).
 * Seule la lecture des jours déjà pris (existants) reprend la forme de L8-11b, faute de pouvoir modifier ce fichier ici.
 * Aucun import d'envoi, de fournisseur, de validation, de création de créneau ni de changement de statut.
 * Toute valeur ci-dessous est une PROPOSITION (statut « hypothese »).
 */
import "server-only";
import { heureAffichageParis } from "@/domaine/plan-editorial/statuts";
import { PREFIXE_REPUBLICATION, verifierPlacement, rangSuivant, type ExistantPlacement } from "@/domaine/republication/nouvelle-version";
import { sourceSure, type IdReseau, type Publication } from "@/domaine/types";
import { cleJour } from "@/lib/dates";
import { ajouterJoursParis } from "@/lib/horloge-paris";
import type { LigneARelancer } from "./contenus-a-relancer";
import { depots, lireParametre } from "./_commun";

/** Clé du réglage : éteint par défaut. */
export const PARAM_PROPOSITION_AUTO = "republication.proposition_auto";
/** PROPOSITION : nombre maximal de suggestions affichées. */
export const PROPOSITIONS_AUTO_MAX = { statut: "hypothese", valeur: 3 } as const;
/** PROPOSITION : nombre de jours regardés à partir de demain. */
export const HORIZON_JOURS = { statut: "hypothese", valeur: 14 } as const;
/** PROPOSITION : heure proposée (heure de Paris). */
export const HEURE_PAR_DEFAUT = { statut: "hypothese", valeur: "09:00" } as const;
/** Réseaux jamais suggérés. */
export const RESEAUX_EXCLUS: readonly IdReseau[] = ["linkedin", "tiktok"];

export interface SuggestionJour {
  publicationId: string;
  reseau: IdReseau;
  debutTexte: string;
  raison: string;
  /** AAAA-MM-JJ, jour de Paris. */
  jour: string;
  heure: string;
}

/** Dépôts INJECTÉS, en lecture seule : aucune écriture n'est possible par cette interface. */
export interface DepsAuto {
  /** Candidats de L8-12a, du meilleur au moins bon. */
  candidats(): Promise<readonly LigneARelancer[]>;
  /** Créneaux du plan. */
  creneaux(): Promise<readonly { id: string; statut: string; heuresParReseau: Partial<Record<string, string>> }[]>;
  publications: {
    obtenir(id: string): Promise<Publication | null>;
    lister(filtre?: (p: Publication) => boolean): Promise<Publication[]>;
  };
}

/** Allumé seulement si le réglage vaut exactement `true` ; toute erreur de lecture éteint. */
export async function propositionAutoAllumee(): Promise<boolean> {
  try {
    return (await lireParametre<boolean>(PARAM_PROPOSITION_AUTO, false)) === true;
  } catch {
    return false;
  }
}

export function depsAutoParDefaut(candidats: readonly LigneARelancer[]): DepsAuto {
  const d = depots();
  return {
    candidats: async () => candidats,
    creneaux: () => d.creneauxEditoriaux.lister(),
    publications: d.publications,
  };
}

/** Jour et heure de Paris d'un instant ; un instant illisible donne un jour vide (le contrôle le refuse). */
function enParis(instant: string): { jour: string; heure: string } {
  try {
    return { jour: cleJour(instant), heure: heureAffichageParis(instant) };
  } catch {
    return { jour: "", heure: "" };
  }
}

/** 0 = dimanche, 6 = samedi, pour un jour AAAA-MM-JJ (midi UTC : aucun glissement). */
const estWeekEnd = (jour: string): boolean => [0, 6].includes(new Date(`${jour}T12:00:00Z`).getUTCDay());

/**
 * Pour chaque candidat (dans l'ordre reçu), le premier jour de semaine libre qui passe le contrôle de placement,
 * dans l'horizon. Au plus PROPOSITIONS_AUTO_MAX lignes ; un candidat sans jour libre n'a pas de ligne.
 * Lecture seule : rien n'est écrit, aucun brouillon n'est créé.
 */
export async function suggererJours(deps: DepsAuto, maintenant: Date): Promise<SuggestionJour[]> {
  const t = maintenant.getTime();
  if (!Number.isFinite(t)) return [];
  const candidats = (await deps.candidats()).filter((l) => !RESEAUX_EXCLUS.includes(l.reseau));
  if (candidats.length === 0) return [];

  const creneaux = await deps.creneaux();
  const ids = creneaux.map((c) => c.id);
  const publications = await deps.publications.lister((p) => p.statut !== "brouillon");
  const demain = ajouterJoursParis(cleJour(maintenant), 1);
  // Jours déjà suggérés dans cet appel : deux suggestions ne se partagent pas un jour sur un même réseau.
  const reserves: ExistantPlacement[] = [];
  const resultat: SuggestionJour[] = [];

  for (const l of candidats) {
    if (resultat.length >= PROPOSITIONS_AUTO_MAX.valeur) break;
    const original = await deps.publications.obtenir(l.publicationId);
    if (!original || original.statut !== "publiee" || original.via === "simulation") continue;
    const source = sourceSure(original);
    if (!source) continue;
    const media = source.famille === "video" ? source.videoId : source.visuelId;
    const reseau = original.reseau;
    if (RESEAUX_EXCLUS.includes(reseau)) continue;
    // Une nouvelle version non archivée existe déjà : L8-11b la rendrait telle quelle, rien à proposer.
    const prefixe = `${PREFIXE_REPUBLICATION}${l.publicationId}-`;
    if (creneaux.some((c) => c.id.startsWith(prefixe) && /^\d+$/.test(c.id.slice(prefixe.length)) && c.statut !== "archive")) continue;
    const rang = rangSuivant(l.publicationId, ids);

    const existants: ExistantPlacement[] = [...reserves];
    for (const c of creneaux) {
      const instant = c.heuresParReseau[reseau];
      if (instant) existants.push({ id: c.id, reseau, ...enParis(instant), statut: c.statut });
    }
    for (const p of publications) {
      if (p.reseau === reseau) existants.push({ id: p.id, reseau, ...enParis(p.date), statut: p.statut, simulee: p.via === "simulation" });
    }

    for (let i = 0; i < HORIZON_JOURS.valeur; i++) {
      const jour = ajouterJoursParis(demain, i);
      if (estWeekEnd(jour)) continue;
      const verdict = verifierPlacement({
        reseau,
        jour,
        heure: HEURE_PAR_DEFAUT.valeur,
        maintenant: t,
        publicationId: l.publicationId,
        mediaOrigine: media,
        mediaNouveau: media,
        datePublicationOrigine: Date.parse(original.date),
        rang,
        existants,
      });
      if (!verdict.ok) continue;
      resultat.push({ publicationId: l.publicationId, reseau, debutTexte: l.debutTexte, raison: l.raison, jour, heure: HEURE_PAR_DEFAUT.valeur });
      reserves.push({ id: `suggestion-${l.publicationId}`, reseau, jour, heure: HEURE_PAR_DEFAUT.valeur, statut: "a_valider" });
      break;
    }
  }
  return resultat;
}

/** Garde de la page : éteint = liste vide et AUCUNE lecture des dépôts ; allumé = les suggestions. */
export async function proposerSiAllume(deps: DepsAuto, maintenant: Date): Promise<SuggestionJour[]> {
  if (!(await propositionAutoAllumee())) return [];
  return suggererJours(deps, maintenant);
}
