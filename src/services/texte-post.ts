/**
 * TEXTE DE POST D'UN CARROUSEL OU D'UNE INFOGRAPHIE (L3-07). Deux essais de Claude au plus ; le texte déterministe est
 * le repli, toujours journalisé. Ce module n'appelle rien lui-même : l'appel (qui passe par la porte de dépense,
 * `depense-claude-contenu.ts`) est fourni par l'appelant. Sans appeleur (simulation), le repli est le résultat.
 */
import type { IdReseau } from "@/domaine/types";
import {
  ESSAIS_TEXTE_VISUEL,
  evaluerPublicationVisuel,
  schemaPublicationVisuel,
  libelleDesEchecs,
  texteDeterministeVisuel,
  type DonneesPublicationVisuel,
  type SortiePublicationVisuel,
} from "@/generateur/roles/publication-visuel";

export interface TextePost extends SortiePublicationVisuel {
  /** « claude » : sortie du modèle, validée ; « repli » : texte déterministe. */
  source: "claude" | "repli";
}

export interface OptionsTextePost {
  /** Un appel Claude. `null` : pas de réponse (crédit épuisé, quota, panne) ; aucun nouvel essai. */
  appeler?: (donnees: DonneesPublicationVisuel, corrections?: string[]) => Promise<SortiePublicationVisuel | null>;
  /** Ligne de journal (mots simples, aucun montant). */
  journaliser?: (message: string) => void;
}

export function textePostDeterministe(d: DonneesPublicationVisuel): TextePost {
  return { ...texteDeterministeVisuel(d), source: "repli" };
}

export async function ecrireTextePost(d: DonneesPublicationVisuel, options: OptionsTextePost = {}): Promise<TextePost> {
  const journaliser = options.journaliser ?? (() => {});
  const repli = (motif: string): TextePost => {
    journaliser(`Texte de post : repli sur le texte automatique (${motif}).`);
    return textePostDeterministe(d);
  };
  if (!options.appeler) return repli("aucun appel Claude");
  let corrections: string[] | undefined;
  let echecs: string[] = [];
  for (let essai = 1; essai <= ESSAIS_TEXTE_VISUEL; essai++) {
    let brute: SortiePublicationVisuel | null;
    try {
      brute = await options.appeler({ ...d, ...(corrections ? { corrections } : {}) }, corrections);
    } catch {
      return repli("erreur de l'appel Claude");
    }
    if (!brute) return repli("pas de réponse de Claude");
    const lue = schemaPublicationVisuel.safeParse(brute);
    if (!lue.success) {
      echecs = ["réponse illisible"];
      corrections = echecs;
      continue;
    }
    const sortie = lue.data;
    echecs = evaluerPublicationVisuel(sortie, d);
    if (echecs.length === 0) return { ...sortie, texte: sortie.texte.trim(), source: "claude" };
    corrections = echecs;
  }
  return repli(`deux réponses refusées : ${libelleDesEchecs(echecs).join(", ")}`);
}

/* ------------------------------------------------------------------ */
/* CAL-27 · texte et premier commentaire PROPOSÉS pour un contenu importé à la main                */
/* ------------------------------------------------------------------ */

export type TypeImporte = "video" | "carrousel" | "infographie";

export interface DemandeTexteImporte {
  type: TypeImporte;
  /** Une phrase saisie par le fondateur : la SEULE source des faits d'une vidéo (la transcription viendra en V2). */
  description?: string;
  /** Carrousel ou infographie : le texte lu des pages, s'il existe. */
  texteDesPages?: string;
  reseaux: IdReseau[];
  appeler?: OptionsTextePost["appeler"];
  /** Studio en simulation : le texte est un texte d'essai, signalé comme tel. */
  simulation?: boolean;
  journaliser?: (message: string) => void;
}

export interface PropositionReseau {
  reseau: IdReseau;
  texte: string;
  motsDiese: string[];
  titreDocument?: string;
  /** `null` : aucun premier commentaire pour ce réseau (TikTok). */
  premierCommentaire: string | null;
  source: TextePost["source"];
  /** Échecs du contrôleur de texte (longueurs, interdits de marque, vouvoiement) ; vide = le texte passe. */
  controle: string[];
}

export type ResultatProposition =
  | { ok: true; propositions: PropositionReseau[]; essai: boolean }
  | { ok: false; demande: string };

const DEMANDE_PHRASE: Record<TypeImporte, string> = {
  video: "Écrivez d'abord une phrase qui décrit votre vidéo : le texte proposé ne repose que sur elle.",
  carrousel: "Écrivez d'abord une phrase qui décrit votre carrousel : le texte proposé ne repose que sur elle.",
  infographie: "Écrivez d'abord une phrase qui décrit votre infographie : le texte proposé ne repose que sur elle.",
};

/** La seule source des faits d'un contenu importé : la phrase du fondateur, puis le texte des pages s'il existe. */
function sourceDuTexteImporte(description?: string, texteDesPages?: string): { source: string; titre: string } {
  const phrase = description?.trim() ?? "";
  const pages = texteDesPages?.trim() ?? "";
  return { source: [phrase, pages].filter(Boolean).join("\n"), titre: (phrase || pages.split("\n")[0] || "").trim() };
}

export interface TexteSaisi {
  reseau: IdReseau;
  texte: string;
  /** Mots-dièse et titre de la proposition ; absents (texte écrit à la main sans proposition), leurs contrôles ne s'appliquent pas. */
  motsDiese?: string[];
  titreDocument?: string;
  description?: string;
  texteDesPages?: string;
}

/** Contrôle d'un texte tel qu'il est AU MOMENT PRÉSENT (après chaque modification), avec les mêmes contrôles que la proposition. */
export function controlerTexteSaisi(t: TexteSaisi): string[] {
  const { source, titre } = sourceDuTexteImporte(t.description, t.texteDesPages);
  const sortie: SortiePublicationVisuel = { texte: t.texte, motsDiese: t.motsDiese ?? [], ...(t.titreDocument ? { titreDocument: t.titreDocument } : {}) };
  const echecs = evaluerPublicationVisuel(sortie, { reseau: t.reseau, titre, texteDesPages: source });
  return t.motsDiese ? echecs : echecs.filter((e) => !/^PV-0[25] /.test(e));
}

/**
 * Un texte par réseau choisi et un premier commentaire, à relire et modifier. Le contrôleur (PV-01 à PV-05 + charte)
 * passe sur chaque texte. Ne lève jamais d'exception et ne publie rien.
 */
export async function proposerTexteImporte(d: DemandeTexteImporte): Promise<ResultatProposition> {
  const { source, titre } = sourceDuTexteImporte(d.description, d.texteDesPages);
  if (!source) return { ok: false, demande: DEMANDE_PHRASE[d.type] };
  const { premierCommentaireImporte } = await import("./premier-commentaire");
  const propositions: PropositionReseau[] = [];
  for (const reseau of d.reseaux) {
    const donnees: DonneesPublicationVisuel = { reseau, titre, texteDesPages: source };
    const t = await ecrireTextePost(donnees, { appeler: d.simulation ? undefined : d.appeler, journaliser: d.journaliser });
    propositions.push({
      reseau,
      texte: t.texte,
      motsDiese: t.motsDiese,
      ...(t.titreDocument ? { titreDocument: t.titreDocument } : {}),
      premierCommentaire: premierCommentaireImporte(reseau),
      source: t.source,
      controle: evaluerPublicationVisuel(t, donnees),
    });
  }
  return { ok: true, propositions, essai: d.simulation === true };
}
