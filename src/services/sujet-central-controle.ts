/**
 * SUJET DÉJÀ TRAITÉ DANS LA CHAÎNE CENTRALE (lot L5 : générateurs `avocat` et `facecam`, sujets numérotés « scripts
 * maîtres », écrits par Will ou venus de l'Usine). Un sujet déjà traité ne doit pas être regénéré : `creerSujet` appelle
 * ce contrôle AVANT de créer quoi que ce soit et avant toute dépense. Le refus est une erreur typée (`ErreurSujetDejaTraite`)
 * qui porte un statut structuré `sujet-deja-traite` : l'écran la transforme en panneau à choix, les appelants sans écran
 * (série, Usine) la reçoivent comme une erreur claire et ne passent jamais outre. « Refaire quand même » = la confirmation
 * (choix + jeton) renvoyée par l'écran ; un jeton périmé est refusé de nouveau. Réglage `sujets.garde` : « eteint » = aucun
 * contrôle, « avertissement » = ne bloque pas. Le contrôle ne lit que : rien n'est écrit, hors une ligne au journal en cas de refus.
 */
import "server-only";
import { cleUsine, type CandidatSujet, type Confirmation, type NiveauSujet, type Precedent, type Suggestion } from "@/domaine/sujets-traites";
import { ErreurStudio, journaliser } from "./_commun";
import type { BriefSujet } from "./generateur";
import type { SourcesSujets } from "./sujets-traites";

/** Ce que l'écran reçoit quand le sujet est déjà traité : niveau, précédents avec liens, trois suggestions, jeton. */
export interface RefusSujetDejaTraite {
  statut: "sujet-deja-traite";
  niveau: NiveauSujet;
  precedents: Precedent[];
  suggestions: Suggestion[];
  jeton: string;
  /** La confirmation reçue ne vaut plus (les vidéos ont changé) : l'écran redemande le choix. */
  jetonPerime?: true;
  phrase: string;
}

/** Refus du contrôle : une erreur du studio (message en français) qui garde le statut structuré. */
export class ErreurSujetDejaTraite extends ErreurStudio {
  constructor(public readonly refus: RefusSujetDejaTraite) {
    super("SUJET_DEJA_TRAITE", `${refus.phrase} Rien n'a été écrit ni payé.`);
    this.name = "ErreurSujetDejaTraite";
  }
}

export interface OptionsControleSujet {
  /** Reprise, retouche, relance : aucun contrôle. */
  reprise?: boolean;
  /** Nouvelle version d'un sujet qui existe déjà : il n'est pas comparé à lui-même. */
  versionDeSujetId?: string;
  /** Le contrôle a déjà eu lieu plus haut (l'Usine le fait avant d'écrire ses matières). */
  dejaControle?: boolean;
  /** Pas d'écran pour choisir et fichier filmé par Will : aucun contrôle (à confirmer par Will). */
  sansControle?: boolean;
  /** Sources remplaçables dans les tests. */
  sourcesSujets?: SourcesSujets;
}

/** La confirmation reçue de l'écran (donnée non sûre) : « refaire » et un jeton, sinon rien (« nouvel angle » n'est honoré nulle part ici). */
export function confirmationPropre(brut: unknown): Confirmation | undefined {
  const b = (brut && typeof brut === "object" ? brut : {}) as { choix?: unknown; jeton?: unknown };
  return b.choix === "refaire" && typeof b.jeton === "string" && b.jeton ? { choix: "refaire", jeton: b.jeton } : undefined;
}

/** Le sujet à comparer : le format du brief, sa clé Usine s'il en vient, sinon le texte de l'idée (« proche »). */
export function candidatDuBrief(brief: Pick<BriefSujet, "idee" | "formatId" | "origineUsine">, options: Pick<OptionsControleSujet, "reprise" | "versionDeSujetId"> = {}): CandidatSujet {
  const code = brief.origineUsine?.parts?.cas_usage;
  return {
    generateur: brief.formatId,
    texte: brief.idee.trim(),
    ...(typeof code === "string" && code.trim() ? { cles: [cleUsine(code)] } : {}),
    ...(options.reprise ? { estReprise: true } : {}),
    ...(options.versionDeSujetId ? { ignorerSujetId: options.versionDeSujetId } : {}),
  };
}

/** Refuse (en lançant `ErreurSujetDejaTraite`) un NOUVEAU sujet déjà traité ; sinon ne fait rien. Ne crée et ne paie rien. */
export async function controlerSujetCentral(brief: Pick<BriefSujet, "idee" | "formatId" | "origineUsine" | "estDemo" | "confirmationSujet">, options: OptionsControleSujet = {}): Promise<void> {
  // Un sujet de démonstration n'est jamais un vrai sujet : il ne compte pas, il n'est pas contrôlé non plus.
  if (options.dejaControle || options.sansControle || options.reprise || brief.estDemo) return;
  const { verifierSujet } = await import("./sujets-traites");
  const v = await verifierSujet(candidatDuBrief(brief, options), confirmationPropre(brief.confirmationSujet), options.sourcesSujets);
  if (v.ok) return;
  const { niveau, precedents, suggestions, jeton, jetonPerime } = v;
  await journaliser("sujet", `Sujet déjà traité, rien écrit : « ${brief.idee.trim().slice(0, 120)} »`);
  throw new ErreurSujetDejaTraite({
    statut: "sujet-deja-traite",
    niveau,
    precedents,
    suggestions,
    jeton,
    ...(jetonPerime ? { jetonPerime: true as const } : {}),
    phrase: niveau === "identique" ? "Ce sujet est déjà traité." : "Un sujet très proche est déjà traité.",
  });
}
