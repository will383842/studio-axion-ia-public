/**
 * L5-02d · GARDE d'un créneau déjà confié au diffuseur.
 *
 * Un créneau validé dont l'envoi est préparé, en cours de promotion, programmé ou parti chez le diffuseur ne se décale plus et ne
 * se dévalide plus en silence : le post partirait à l'ANCIENNE date, avec l'ANCIEN texte, alors que l'écran afficherait la nouvelle.
 * Le niveau est DÉRIVÉ des envois planifiés du créneau (toutes versions, tous réseaux) et des états durables `envoi-calendrier:*`.
 *
 * Règles :
 *  - la garde ne lit AUCUN réglage et n'importe ni le service du diffuseur, ni un fournisseur, ni les notifications : un post
 *    programmé reste programmé même si l'on éteint tout ;
 *  - aucun envoi pour le créneau : « libre », sans lire aucun paramètre (interrupteurs jamais allumés = comportement d'avant) ;
 *  - lecture seule : aucune écriture, aucun appel au diffuseur ;
 *  - à appeler SOUS `sousVerrou`, dans la même section que l'écriture qu'elle protège (jamais de notification sous ce verrou).
 */
import "server-only";
import type { EnvoiPlanifie } from "@/domaine/envoi-planifie";
import { depots, lireParametre } from "./_commun";

/** Recopié de `branchement-envoi-calendrier.ts` (`PREFIXE_ETATS_ENVOI_CALENDRIER`) ; le test échoue si les deux diffèrent. */
export const PREFIXE_ETATS_GARDE = "envoi-calendrier:";

export type NiveauDiffuseur = "libre" | "brouillon" | "en-cours" | "a-verifier" | "programme" | "parti";

export interface NiveauCreneau {
  niveau: NiveauDiffuseur;
  /** AAAA-MM-JJ, heure de Paris : celle de l'envoi programmé (niveau « programme » seulement). */
  jour?: string;
  /** HH:MM, heure de Paris : celle de l'envoi programmé (niveau « programme » seulement). */
  heure?: string;
  reseau?: string;
}

const STATUTS_PROGRAMMES: readonly string[] = ["programme", "confirme", "a-envoyer"];

/** Version la plus récente d'abord, puis clé : le choix de l'envoi qui donne la date est stable. */
const plusRecent = (a: EnvoiPlanifie, b: EnvoiPlanifie): number => b.versionCreneau - a.versionCreneau || a.cle.localeCompare(b.cle);

export async function niveauDiffuseurDuCreneau(creneauId: string): Promise<NiveauCreneau> {
  const envois = (await depots().envoisPlanifies.lister((e) => e.creneauId === creneauId)).sort(plusRecent);
  if (envois.length === 0) return { niveau: "libre" };
  const etat = async (nom: string, cle: string): Promise<unknown> => lireParametre<unknown>(`${PREFIXE_ETATS_GARDE}${nom}:${cle}`, undefined);

  let programme: EnvoiPlanifie | undefined;
  let parti = false;
  let aVerifier = false;
  let enCours = false;
  let brouillon = false;
  for (const e of envois) {
    const annule = e.statut === "annule";
    const promotion = await etat("promotion", e.cle);
    const verification = await etat("a-verifier", e.cle);
    const creation = await etat("creation", e.cle);
    if (e.statut === "envoye") parti = true;
    // Ne jamais se fier au seul statut : après un plantage entre le PUT et l'écriture locale, c'est la marque qui fait foi.
    if (STATUTS_PROGRAMMES.includes(e.statut) || promotion === "programme") programme ??= e;
    // Un envoi annulé ne compte que par sa marque de promotion (le brouillon chez le diffuseur n'est plus promu).
    if (promotion === "a-verifier" || (!annule && verification === "a-verifier")) aVerifier = true;
    if (promotion === "en-cours" || (!annule && creation === "en-cours")) enCours = true;
    if (!annule && (e.statut === "brouillon" || e.statut === "valide") && (typeof e.cleDiffuseur === "string" || creation === "cree")) brouillon = true;
  }
  if (parti) return { niveau: "parti" };
  if (programme) return { niveau: "programme", jour: programme.jour, ...(programme.heure ? { heure: programme.heure } : {}), reseau: programme.reseau };
  if (aVerifier) return { niveau: "a-verifier" };
  if (enCours) return { niveau: "en-cours" };
  if (brouillon) return { niveau: "brouillon" };
  return { niveau: "libre" };
}

/** JJ/MM (et HH:MM) pris tels quels de l'envoi : jour et heure de Paris déjà stockés, aucune conversion. */
function quand(jour: string | undefined, heure: string | undefined): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(jour ?? "");
  if (!m) return "la date prévue";
  return `${m[2]}/${m[1]}${heure ? ` à ${heure}` : ""}`;
}

/** Vouvoiement, aucun nom d'outil ; chaque phrase finit par dire quoi faire (sauf « parti », où il n'y a plus rien à faire). */
export const PHRASES_CRENEAU_CONFIE = {
  programme: (jour?: string, heure?: string): string =>
    `Cette publication est déjà programmée chez le diffuseur pour le ${quand(jour, heure)} (heure de Paris) : elle partira à cette heure-là. Rien n'a été changé ici. Pour la déplacer, la modifier ou l'annuler, faites-le dans l'outil de publication.`,
  parti: "Cette publication est déjà partie : elle ne se modifie plus ici.",
  "a-verifier":
    "Le Studio ne sait pas si cette publication est déjà programmée chez le diffuseur : rien n'a été changé ici. Vérifiez-la dans l'outil de publication ; si elle y est, déplacez-la ou annulez-la là-bas.",
  "en-cours": "Un envoi vers le diffuseur est en cours pour cette publication : rien n'a été changé. Réessayez dans une minute.",
  brouillon:
    "Le brouillon de cette publication est déjà préparé chez le diffuseur avec ce texte : il ne se modifie plus ici. Rien n'a été changé. Pour changer le texte, modifiez-le dans l'outil de publication.",
} as const;

/** Niveau « brouillon » : le décalage est accepté ; l'écran affichera cet avertissement (L5-02e). */
export const AVERTISSEMENT_DECALAGE_BROUILLON =
  "Le brouillon déjà préparé chez le diffuseur reste à l'ancienne date et ne sera pas programmé : cette publication ne partira pas seule à sa nouvelle date. Programmez-la vous-même dans l'outil de publication.";

/**
 * La phrase du refus, ou `null` quand le geste est permis.
 * `decaler` : permis en « libre » et « brouillon ». `texte` (modification, donc dévalidation) : permis en « libre » seulement.
 */
export function refusModificationCreneau(n: NiveauCreneau, geste: "decaler" | "texte"): string | null {
  switch (n.niveau) {
    case "libre":
      return null;
    case "brouillon":
      return geste === "decaler" ? null : PHRASES_CRENEAU_CONFIE.brouillon;
    case "programme":
      return PHRASES_CRENEAU_CONFIE.programme(n.jour, n.heure);
    case "parti":
      return PHRASES_CRENEAU_CONFIE.parti;
    case "a-verifier":
      return PHRASES_CRENEAU_CONFIE["a-verifier"];
    case "en-cours":
      return PHRASES_CRENEAU_CONFIE["en-cours"];
  }
}
