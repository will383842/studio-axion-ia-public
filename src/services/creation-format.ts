/**
 * PARTIE COMMUNE DE LA CRÉATION D'UN FORMAT (tâche S0) : ce que `tableau-creation.ts` fait pour le tableau animé,
 * extrait en pièces neuves pour qu'un autre format n'ait pas à refaire un second écran de création.
 *  - `nouveauBrouillonFormat` : un brouillon de vidéo, même pour un format `masque` (rien n'est lancé) ;
 *  - `lancerAvecAccord` : le lancement commun, refusé tant qu'un MONTANT au moins égal au prix n'est pas confirmé.
 * `tableau-creation.ts` n'est pas modifié et n'importe pas ce fichier : le passage se fera quand la session tableau voudra.
 */
import "server-only";
import { MENTION_IA_PAR_DEFAUT } from "@/domaine/derivations";
import { accordPropre, type AccordPrix } from "@/domaine/accord";
import type { Distribution, Id, MentionIA, Video } from "@/domaine/types";
import { dureeParDefaut, reglagesParDefaut, trouverFormat } from "@/formats";
import { nouvelId } from "@/lib/ids";
import { formaterMontant } from "@/lib/montants";
import { depots, ErreurStudio, horodatage, lireParametre } from "./_commun";
import { exigerSession } from "./auth";

export interface EntreeBrouillonFormat {
  formatId: string;
  titre: string;
  sujet: string;
  distribution: Distribution[];
  /** Entrées propres au format (`video.entrees`), rangées telles quelles. */
  entrees: Record<string, unknown>;
}

/** Brouillon neuf (statut `brouillon`, rien de lancé). Session exigée ; le format peut être masqué. */
export async function nouveauBrouillonFormat(e: EntreeBrouillonFormat): Promise<Video> {
  await exigerSession();
  const format = trouverFormat(e.formatId);
  if (!format) throw new ErreurStudio("FORMAT_INCONNU", "Ce format n'existe pas.");
  const mention = await lireParametre<MentionIA>("mentionIA.parDefaut", MENTION_IA_PAR_DEFAUT);
  const video: Video = {
    id: nouvelId("v"),
    titre: e.titre.slice(0, 80),
    sujet: e.sujet,
    formatId: format.id,
    versionFormat: format.version,
    profilRenduVersion: format.profilRendu?.version ?? 1,
    marqueId: "marque-axion",
    statut: "brouillon",
    dureeCibleSec: dureeParDefaut(format),
    ratios: ["9:16"],
    distribution: e.distribution,
    entrees: e.entrees,
    reglages: reglagesParDefaut(format),
    styles: {},
    briquesCoupees: [],
    // La mention IA suit le réglage de Will (Réglages > Mention IA), comme les autres formats.
    briquesAllumees: mention.incrustee ? ["mention-ia"] : [],
    mentionIA: mention,
    adresse: "vous",
    langue: "fr-FR",
    ...horodatage(),
  };
  await depots().videos.enregistrer(video);
  return video;
}

export type IssueLancement = { statut: "lancee"; travailId: Id } | { statut: "accord-requis"; centimes: number; phrase: string };

export interface DependancesLancement {
  /** Lancement commun (tests : un double) ; par défaut `lancerFabrication`. */
  lancer?: (videoId: Id, accord: number) => Promise<{ travailId: Id }>;
}

async function lancerCommun(videoId: Id, accord: number): Promise<{ travailId: Id }> {
  const { lancerFabrication } = await import("./fabrication");
  return lancerFabrication(videoId, { confirme: accord });
}

/**
 * Lance la fabrication seulement si l'accord est un MONTANT (centimes d'euro) au moins égal à `montantCentimes` :
 * `true` ne suffit pas. Sinon rien n'est lancé et le prix à confirmer est rendu.
 */
export async function lancerAvecAccord(videoId: Id, accordBrut: AccordPrix | unknown, montantCentimes: number, dependances: DependancesLancement = {}): Promise<IssueLancement> {
  await exigerSession();
  const accord = accordPropre(accordBrut);
  if (typeof accord !== "number" || accord < montantCentimes) {
    return { statut: "accord-requis", centimes: montantCentimes, phrase: `La voix coûte environ ${formaterMontant({ centimes: montantCentimes, devise: "EUR" })}. Confirmez ce prix pour lancer.` };
  }
  const { travailId } = await (dependances.lancer ?? lancerCommun)(videoId, accord);
  return { statut: "lancee", travailId };
}
