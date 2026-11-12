/**
 * MOTS (PV-3) · constructeur de graphe d'automatisation. FONCTION PURE : des textes validés → la définition du workflow à poser
 * chez Zernio. Rien n'est écrit en dur comme texte définitif : chaque texte vient de `TextesMot`. Refus si les textes ne sont
 * pas « validés par l'opérateur » (ou ont changé depuis), ou si le contrôle de sortie échoue.
 *
 * ⚠ Le schéma exact des workflows chez Zernio n'est pas confirmé (aucun essai réel) : la forme ci-dessous est celle du Studio,
 * versionnée (`schema`), à faire correspondre au format réel lors de l'essai. Aucune adresse e-mail n'y figure : l'adresse
 * est collectée par Zernio et lue par le travail de fond du parcours (parcours-mot), jamais conservée ici.
 */
import { estMotOpposition, MOTS_OPPOSITION } from "@/domaine/guide-reseau/opposition";
import { controlerTextesMot, type Refus } from "./mots-controle";
import { RE_MOT, textesValides, type TextesMot } from "./mots-textes";

export const SCHEMA_GRAPHE = "studio-mots-v1";
export { estMotOpposition, MOTS_OPPOSITION };
export const RESEAUX_AUTOMATIQUES = ["instagram", "facebook"] as const;

export type EtapeGraphe =
  | { id: string; type: "repondre_commentaire"; texte: string; suite: string | null }
  | { id: string; type: "envoyer_message_prive"; texte: string; suite: string | null }
  | { id: string; type: "attendre_reponse"; delaiHeures: number; siRepond: string | null; siSilence: string | null }
  | { id: string; type: "relancer"; texte: string; unSeulEnvoi: true; suite: string | null }
  | { id: string; type: "terminer"; texte: string | null }
  | { id: string; type: "mettre_a_l_ecart"; motif: "opposition" }
  | { id: string; type: "alerter_operateur"; motif: "opposition" };

export interface DefinitionWorkflow {
  schema: typeof SCHEMA_GRAPHE;
  nom: string;
  portee: "mot" | "stop_compte";
  declencheur:
    | { type: "commentaire_mot_seul"; mot: string; reseaux: readonly string[] }
    | { type: "message_prive_mot_seul"; mots: readonly string[] };
  etapes: EtapeGraphe[];
  /** Un seul envoi par commentaire et par personne (ADR-0005 P7). */
  unEnvoiParPersonne: true;
  /** Personne déjà opposée : aucune réponse, aucun guide. */
  siPersonneOpposee: "silence";
  /** Posé EN PAUSE : l'activation est un geste séparé de l'opérateur. */
  etatInitial: "pause";
}

export type ResultatGraphe = { ok: true; workflow: DefinitionWorkflow } | { ok: false; code: "textes_non_valides" | "mot_invalide" | "texte_refuse"; refus: Refus[] };

/** Délai laissé à la personne avant la fin ou la relance : un réglage, pas un texte. */
export const DELAI_ATTENTE_HEURES = 24;

export function construireGrapheMot(textes: TextesMot, options: { reseaux?: readonly string[] } = {}): ResultatGraphe {
  if (!RE_MOT.test(textes.mot)) return { ok: false, code: "mot_invalide", refus: [] };
  if (!textesValides(textes)) return { ok: false, code: "textes_non_valides", refus: [] };
  const refus = controlerTextesMot(textes);
  if (refus.length) return { ok: false, code: "texte_refuse", refus };
  const avecRelance = textes.relance !== null;
  const etapes: EtapeGraphe[] = [
    { id: "e1", type: "repondre_commentaire", texte: textes.reponsePublique, suite: "e2" },
    { id: "e2", type: "envoyer_message_prive", texte: textes.messagePrive, suite: "e3" },
    { id: "e3", type: "attendre_reponse", delaiHeures: DELAI_ATTENTE_HEURES, siRepond: "e5", siSilence: avecRelance ? "e4" : "e5" },
    ...(avecRelance ? [{ id: "e4", type: "relancer", texte: textes.relance!, unSeulEnvoi: true, suite: "e5" } as const] : []),
    { id: "e5", type: "terminer", texte: textes.fin },
  ];
  return {
    ok: true,
    workflow: {
      schema: SCHEMA_GRAPHE,
      nom: `studio-mot-${textes.mot.toLowerCase()}`,
      portee: "mot",
      declencheur: { type: "commentaire_mot_seul", mot: textes.mot, reseaux: options.reseaux ?? RESEAUX_AUTOMATIQUES },
      etapes,
      unEnvoiParPersonne: true,
      siPersonneOpposee: "silence",
      etatInitial: "pause",
    },
  };
}

/**
 * Workflow STOP d'un compte : un mot d'opposition (« stop », « arrêtez »…) ou une courte phrase (« stop, merci ») écrit par la personne en message privé met la personne à l'écart (opposition) et alerte
 * l'opérateur. AUCUN texte sortant (silence total après une opposition) ; `demande_effacement` n'est pas utilisé.
 */
export function construireGrapheStop(): DefinitionWorkflow {
  return {
    schema: SCHEMA_GRAPHE,
    nom: "studio-stop-compte",
    portee: "stop_compte",
    declencheur: { type: "message_prive_mot_seul", mots: MOTS_OPPOSITION },
    etapes: [
      { id: "s1", type: "mettre_a_l_ecart", motif: "opposition" },
      { id: "s2", type: "alerter_operateur", motif: "opposition" },
    ],
    unEnvoiParPersonne: true,
    siPersonneOpposee: "silence",
    etatInitial: "pause",
  };
}
