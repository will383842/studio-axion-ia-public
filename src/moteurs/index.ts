/**
 * REGISTRE DES MOTEURS (PLAN B.6.3). Un format désigne son moteur par une clé
 * (`DefinitionFormat.moteur`). Ajouter un moteur = l'inscrire ici.
 *
 * Moteur avocat (B.1, « Activation ») : le moteur est choisi AU LANCEMENT (réglage `moteur.<format>` en base,
 * puis variable d'environnement `MOTEUR_<FORMAT>`, puis `format.moteur`) et FIGÉ dans `CommandeFabrication.moteurId`.
 * Retouches, réexports, reprises et boucle de fond lisent ensuite `moteurDeCommande(commande)`, jamais le format :
 * un travail lancé en simulation finit en simulation, quelle que soit la bascule faite entre-temps.
 */
import { trouverFormat } from "@/formats";
import type { CommandeFabrication } from "@/domaine/types";
import { moteurMontageAvocat } from "./montage-avocat";
import { moteurMontageFacecam } from "./montage-facecam";
import { moteurMontageTableau } from "./montage-tableau";
import { moteurMontageCasConcret } from "./montage-cas-concret";
import { moteurMontageFacecamAnimee } from "./montage-facecam-animee";
import { moteurMontageImageVideo } from "./montage-image-video";
import { moteurSimulation } from "./simulation";
import type { MoteurVideo } from "./types";
import { idMoteurDeCommande, moteurExiste, type IdMoteur } from "./ids";

export { idMoteurDeCommande, moteurExiste } from "./ids";

export type * from "./types";

// Les clés suivent `IDS_MOTEURS` (ids.ts) : le type refuse un moteur inscrit ici sans y être déclaré.
const MOTEURS: Record<IdMoteur, MoteurVideo> = {
  simulation: moteurSimulation,
  // Lot M1 : inscrit, mais la production reste en simulation tant que le réglage `moteur.avocat` n'est pas posé (B.1).
  "montage-avocat": moteurMontageAvocat,
  // Plan facecam v4 (lot A) : squelette, désigné par le seul `format.moteur` du format facecam (rien côté avocat).
  "montage-facecam": moteurMontageFacecam,
  "montage-tableau": moteurMontageTableau,
  "montage-cas-concret": moteurMontageCasConcret,
  // Face caméra animée (lot A) : squelette, désigné par le seul `format.moteur` du format facecam-animee.
  "montage-facecam-animee": moteurMontageFacecamAnimee,
  "montage-image-video": moteurMontageImageVideo,
};

export function obtenirMoteur(id: string): MoteurVideo {
  const m = moteurExiste(id) ? MOTEURS[id as IdMoteur] : undefined;
  if (!m) throw new Error(`Moteur inconnu : ${id}`);
  return m;
}

export function listerMoteurs(): MoteurVideo[] {
  return Object.values(MOTEURS);
}

function cleEnv(formatId: string): string {
  return `MOTEUR_${formatId.replace(/-/g, "_").toUpperCase()}`;
}

/**
 * Moteur à figer au lancement d'une fabrication : réglage en base > variable d'environnement > format.
 * Un choix inconnu (moteur pas encore inscrit) retombe sur celui du format : jamais d'erreur au lancement.
 */
export function choisirMoteurAuLancement(formatId: string, valeurEnBase?: string | null): string {
  const format = trouverFormat(formatId);
  const parDefaut = format?.moteur ?? "simulation";
  for (const demande of [valeurEnBase, process.env[cleEnv(formatId)]]) {
    if (demande && moteurExiste(demande)) return demande;
  }
  return parDefaut;
}

/**
 * CORRECTEUR FINAL A (VERIF-E2E-1, fil rouge des bloquants 2 à 7) : une version est un ESSAI quand le moteur figé dans
 * sa commande est la simulation (vidéo de démonstration, rien de payé), quelles que soient les connexions « Reliées ».
 * C'est CE test qui décide partout : refus, prix, pastilles, notification, envoi à Buffer.
 */
export function commandeEnEssai(commande: Pick<CommandeFabrication, "moteurId" | "formatId"> | null | undefined): boolean {
  return !!commande && idMoteurDeCommande(commande) === "simulation";
}

/** Moteur qui fait foi pour tout travail lancé (B.0 §7). */
export function moteurDeCommande(commande: Pick<CommandeFabrication, "moteurId" | "formatId">): MoteurVideo {
  return obtenirMoteur(idMoteurDeCommande(commande));
}

/* ------------------------------------------------------------------ */
/* Lot R6 : vidéos « je lis » montées pour de vrai, avant le double     */
/* ------------------------------------------------------------------ */

/**
 * Moteur réel qui sait monter les PRISES FILMÉES d'un format (« je lis » : Will filme, ni voix ni double à payer).
 * Le moteur avocat le fait déjà (G6b) ; il ne lui faut que le montage (studio-rendu) et le stockage des fichiers.
 */
const MOTEUR_PRISES_FILMEES: Record<string, string> = { avocat: "montage-avocat" };

export function moteurPrisesFilmees(formatId: string): string | null {
  const id = MOTEUR_PRISES_FILMEES[formatId];
  return id && moteurExiste(id) ? id : null;
}

/** Ce que lit le service : l'interrupteur « je lis » (réglage `moteur.<format>.jeLis`) et les connexions. */
export interface ContexteJeLis {
  allume: boolean;
  montageRelie: boolean;
  stockageRelie: boolean;
}

/** La décision, SEULE source de vérité du lancement ET de la carte Montage. */
export interface DecisionJeLis {
  /** Moteur à figer au lancement d'une vidéo à prises filmées. */
  moteurId: string;
  /** Vrai quand c'est l'interrupteur qui fait monter les prises pour de vrai (le format seul ne le ferait pas). */
  effectif: boolean;
  /** Ce qui manque, en mots simples (`null` : rien). */
  manque: string | null;
}

/**
 * Le moteur du format (`choisirMoteurAuLancement`, inchangé) s'il est réel ; sinon, interrupteur allumé ET montage et
 * stockage reliés, le moteur qui sait monter les prises. Jamais d'erreur : tout ce qui manque laisse la simulation.
 */
export function deciderJeLis(formatId: string, valeurEnBase: string | null | undefined, ctx: ContexteJeLis): DecisionJeLis {
  const duFormat = choisirMoteurAuLancement(formatId, valeurEnBase);
  const prises = moteurPrisesFilmees(formatId);
  const manquants = [!ctx.montageRelie && "le montage", !ctx.stockageRelie && "le stockage des fichiers"].filter(Boolean);
  const manque = manquants.length ? manquants.join(" et ") : null;
  if (duFormat === "simulation" && prises && ctx.allume && !manque) return { moteurId: prises, effectif: true, manque };
  return { moteurId: duFormat, effectif: false, manque };
}

/* ------------------------------------------------------------------ */
/* Lot R8 : montage réel des vidéos avocat (double, voix, réseaux)      */
/* ------------------------------------------------------------------ */

/** Moteur réel qui monte une vidéo AVEC le double (voix, avatar, montage, réseaux) pour un format. */
const MOTEUR_MONTAGE_REEL: Record<string, string> = { avocat: "montage-avocat" };

export function moteurMontageReel(formatId: string): string | null {
  const id = MOTEUR_MONTAGE_REEL[formatId];
  return id && moteurExiste(id) ? id : null;
}

/** Ce que lit le service : l'interrupteur (réglage `moteur.<format>.montageReel`), les connexions et le double. */
export interface ContexteMontageReel {
  allume: boolean;
  /** Connexions « Relié » (Réglages > Connexions). */
  doubleRelie: boolean;
  voixRelie: boolean;
  textesRelies: boolean;
  /** Le serveur de rendu (studio-rendu) : un autre montage relié ne suffit pas. */
  montageRelie: boolean;
  stockageRelie: boolean;
  /** Au moins un double réel prêt est choisi pour un personnage (Personnages, « Votre double HeyGen »). */
  doubleChoisi: boolean;
  /** Le studio fait parler le double (lot R7e, « Votre avatar parle dans le studio »). Éteint : Will fait ses vidéos dans HeyGen. */
  renduAvatarAllume: boolean;
}

/** La décision, SEULE source de vérité du lancement ET de l'interrupteur de la carte Montage. */
export interface DecisionMontageReel {
  /** Moteur à figer au lancement d'une vidéo du format. */
  moteurId: string;
  /** Vrai quand c'est l'interrupteur qui fait monter la vidéo pour de vrai. */
  effectif: boolean;
  /** Connexions qui manquent, en mots simples (`null` : rien). */
  manque: string | null;
  /** GARDE ROUGE : pourquoi le double ne peut pas encore parler depuis le studio (`null` : il peut). */
  doublePasPret: string | null;
}

/** Phrases de la garde rouge : « Ma vidéo HeyGen » reste le chemin proposé tant que le double n'est pas prêt. */
export const DOUBLE_PAS_CHOISI = "Choisissez d'abord votre double dans Personnages, « Votre double HeyGen ». En attendant, faites la vidéo dans l'application HeyGen, puis « Ma vidéo HeyGen » sur sa version.";
export const DOUBLE_PARLE_DANS_HEYGEN = "Allumez d'abord « Votre avatar parle dans le studio » (Réglages, Connexions). En attendant, faites la vidéo dans l'application HeyGen, puis « Ma vidéo HeyGen » sur sa version.";

/**
 * Lot R8 : le moteur du format (`choisirMoteurAuLancement`, inchangé) s'il est déjà réel ; sinon, interrupteur allumé,
 * tout relié ET double prêt, le moteur réel du format. Jamais d'erreur : tout ce qui manque laisse l'essai.
 * GARDE ROUGE : sans double prêt (aucun choisi, ou rendu d'avatar éteint), jamais de montage réel par l'interrupteur.
 */
export function deciderMontageReel(formatId: string, valeurEnBase: string | null | undefined, ctx: ContexteMontageReel): DecisionMontageReel {
  const duFormat = choisirMoteurAuLancement(formatId, valeurEnBase);
  const reel = moteurMontageReel(formatId);
  const manquants = [
    !ctx.doubleRelie && "le double (visage)",
    !ctx.voixRelie && "la voix",
    !ctx.textesRelies && "les textes de publication",
    !ctx.montageRelie && "le serveur de rendu",
    !ctx.stockageRelie && "le stockage des fichiers",
  ].filter((x): x is string => !!x);
  const manque = manquants.length ? (manquants.length === 1 ? manquants[0] : `${manquants.slice(0, -1).join(", ")} et ${manquants.at(-1)}`) : null;
  const doublePasPret = !ctx.doubleChoisi ? DOUBLE_PAS_CHOISI : !ctx.renduAvatarAllume ? DOUBLE_PARLE_DANS_HEYGEN : null;
  if (duFormat === "simulation" && reel && ctx.allume && !manque && !doublePasPret) return { moteurId: reel, effectif: true, manque, doublePasPret };
  return { moteurId: duFormat, effectif: false, manque, doublePasPret };
}
