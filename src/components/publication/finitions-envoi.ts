/**
 * Page « À publier », finitions de l'envoi : la ligne « compte + date » près du bouton, le message après un envoi réussi
 * et la vidéo suivante à traiter. Pure mise en forme : aucune règle d'envoi ici.
 */
import { LIBELLES_ENVOI, NOMS_OUTILS_PUBLICATION } from "@/domaine/libelles";
import { FIN_BUFFER_ISO } from "@/domaine/outil-publication";
import type { IdReseau } from "@/domaine/types";
import { premierCommentaireTransmissibleZernio } from "@/fournisseurs/publication/zernio-corps";
import type { LigneAPublier } from "@/services/a-publier";
import { FILTRE_PAR_DEFAUT, TRANCHE, type FiltreListe } from "./liste-a-publier";
import { etatDeLigne, lienDetailReseau, type ReseauListe } from "./liste-par-reseau";

const FORMAT_DATE = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/** « lundi 5 octobre, 09:00 », ou rien si la date n'est pas lisible. */
export function dateLisible(valeur: string): string | null {
  const d = new Date(valeur);
  return Number.isNaN(d.getTime()) ? null : FORMAT_DATE.format(d);
}

/** Une ligne lisible : le compte Buffer et la date, visibles sans ouvrir le détail. `noms` : les comptes cochés ou mémorisés ; `aCocher` : l'écran demande de cocher un compte. */
export function ligneCompteEtDate(noms: string[], valeurDate: string, aCocher = false): string {
  const compte = noms.length ? noms.join(", ") : aCocher ? "aucun compte coché" : "Compte lu au premier envoi";
  const date = dateLisible(valeurDate);
  return date ? `Compte : ${compte} · Date : ${date}` : `Compte : ${compte} · Date à choisir`;
}

/** Message affiché après un envoi réussi : on reste sur la vidéo. */
export function messageSucces(mode: "brouillon" | "programmer" | undefined, comptes: number): string {
  const sur = comptes > 1 ? `${comptes} comptes` : "1 compte";
  return mode === "programmer"
    ? `Envoyé : programmée dans Buffer sur ${sur}.`
    : `Envoyé : la vidéo est en brouillon dans Buffer (${sur}). Relisez-la puis programmez-la dans Buffer.`;
}

const CATEGORIE_DU_FILTRE: Record<Exclude<FiltreListe, "toutes">, string> = { "a-envoyer": "a-envoyer", envoyees: "envoyee", publiees: "publiee", problemes: "probleme" };

/** La prochaine vidéo (autre que l'actuelle) du filtre actif, sur le réseau demandé (celui du panneau qui vient d'envoyer) ; son adresse de détail. */
export function videoSuivante(lignes: LigneAPublier[], actuelle: string, reseau: ReseauListe, filtre: FiltreListe = FILTRE_PAR_DEFAUT, affichees = TRANCHE): string | null {
  const suivante = lignes.find(
    (l) =>
      l.videoId !== actuelle &&
      (reseau === "tous" || l.reseau === reseau) &&
      (filtre === "toutes" ? etatDeLigne(l).categorie !== "essai" : etatDeLigne(l).categorie === CATEGORIE_DU_FILTRE[filtre]),
  );
  return suivante ? lienDetailReseau(suivante.videoId, suivante.reseau, filtre, affichees, reseau === "tous") : null;
}

/* ------------------------------------------------------------------------------------------------
 * Z3-E · écran d'envoi selon l'outil : pure mise en forme, aucune règle d'envoi (le serveur garde ses gardes).
 * ---------------------------------------------------------------------------------------------- */

export type OutilAffiche = keyof typeof NOMS_OUTILS_PUBLICATION;
export type EtatEnvoi = "brouillon" | "programmee" | "publiee" | "echec";

/** Date de fin du choix de Buffer, « 20/11 », lue sur l'unique source (heure de Paris). */
export const FIN_BUFFER = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "Europe/Paris" }).format(new Date(FIN_BUFFER_ISO));

/** Nom de l'outil, tel que le catalogue le donne. */
export function nomOutil(outil: OutilAffiche | undefined): string {
  return NOMS_OUTILS_PUBLICATION[outil ?? "buffer"];
}

/** « Mettre en brouillon » ou « Programmer » : le nom de l'outil vient du catalogue, jamais du texte du bouton. */
export function libelleEnvoiOutil(mode: "brouillon" | "programmer" | null | undefined, outil?: OutilAffiche): string {
  return `${mode === "programmer" ? LIBELLES_ENVOI.programmer : LIBELLES_ENVOI.brouillon} dans ${nomOutil(outil)}`;
}

/** La mention « contenu généré par IA » n'est montrée que là où l'outil a un champ pour elle. */
export function mentionIAVisible(reseau: IdReseau | string): boolean {
  return reseau === "instagram" || reseau === "tiktok";
}

/** Format du média montré dans l'aperçu : 9:16 (vertical) ou 4:5 (portrait). */
export function formatApercu(reseau: IdReseau | string, dimensions?: { largeur: number; hauteur: number } | null): "4:5" | "9:16" {
  if (dimensions) {
    const r = dimensions.largeur / dimensions.hauteur;
    return Math.abs(r - 0.8) < Math.abs(r - 0.5625) ? "4:5" : "9:16";
  }
  return reseau === "tiktok" ? "9:16" : "4:5";
}

/** Comment le premier commentaire part, selon l'outil : posé tout seul, transmis mais à confirmer, ou à poser à la main. */
export type EtatPremierCommentaire = "auto" | "a-confirmer" | "a-la-main";

/**
 * Buffer : Instagram, Facebook et LinkedIn le reçoivent. Zernio : seuls Facebook et LinkedIn le reçoivent (règle lue dans
 * zernio-corps.ts), et ils restent « à confirmer » tant que l'essai réel n'a rien prouvé ; Instagram, TikTok et YouTube : à la main.
 */
export function etatPremierCommentaire(outil: "buffer" | "zernio" | string | undefined, reseau: IdReseau | string): EtatPremierCommentaire {
  if (outil === "zernio") return premierCommentaireTransmissibleZernio(reseau) ? "a-confirmer" : "a-la-main";
  return reseau === "instagram" || reseau === "facebook" || reseau === "linkedin" ? "auto" : "a-la-main";
}

/** Le bloc « Premier commentaire » : sans état donné, comme avant (posé tout seul, sauf TikTok). Avec un état : titre propre et bouton Copier. */
export function blocPremierCommentaire(reseau: IdReseau | string, texte: string | undefined, etat?: EtatPremierCommentaire): { titre: string; texte?: string; alaMain: boolean; copier?: boolean } | null {
  const t = texte?.trim();
  if (etat === "a-la-main") return { titre: reseau === "tiktok" ? LIBELLES_ENVOI.premierCommentaireTiktok : LIBELLES_ENVOI.premierCommentaireALaMain, ...(t ? { texte: t, copier: true } : {}), alaMain: true };
  if (etat === "a-confirmer") return t ? { titre: LIBELLES_ENVOI.premierCommentaireAConfirmer, texte: t, alaMain: false, copier: true } : null;
  if (reseau === "tiktok") return { titre: LIBELLES_ENVOI.premierCommentaireTiktok, alaMain: true };
  return t ? { titre: LIBELLES_ENVOI.premierCommentaire, texte: t, alaMain: false } : null;
}

const JOUR_MS = 86_400_000;

/** Brouillon de plus de 5 jours : combien de jours il reste pour le programmer (7 jours en tout). `null` avant le 5e jour. */
export function joursRestantsBrouillon(creeLe: string | undefined, maintenant: Date = new Date()): number | null {
  const debut = creeLe ? Date.parse(creeLe) : NaN;
  if (Number.isNaN(debut)) return null;
  const age = Math.floor((maintenant.getTime() - debut) / JOUR_MS);
  return age > 5 ? Math.max(0, 7 - age) : null;
}

export function phraseBrouillonAProgrammer(jours: number): string {
  return `Brouillon à programmer dans les 7 jours : il en reste ${jours}.`;
}

/** « 14:32 » (heure de Paris), ou rien si la date est illisible. */
export function heureHHMM(iso: string | undefined): string | null {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(d).replace(/\s/g, "") : null;
}

export function phraseEchec(iso: string | undefined): string {
  const h = heureHHMM(iso);
  return h ? `Échec à ${h}.` : "Échec de l'envoi.";
}

/** « Partira lundi à 09:00. Vous pouvez encore la repasser en brouillon. » */
export function phraseProgrammee(iso: string | undefined): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "Programmée. Vous pouvez encore la repasser en brouillon.";
  const jour = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "Europe/Paris" }).format(d);
  return `Partira ${jour} à ${heureHHMM(iso)}. Vous pouvez encore la repasser en brouillon.`;
}

/** Pendant les essais (le réseau est en mode brouillon), la phrase le dit. */
export function phraseEssais(reseauNom: string): string {
  return `Pendant les essais, ${reseauNom} reçoit d'abord un brouillon.`;
}

/** Petite ligne sous le bouton principal : le jour et l'heure de l'envoi. */
export function jourHeureEnvoi(iso: string | undefined): string | null {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return `${new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(d)} à ${heureHHMM(iso)}`;
}

/** L'action principale UNIQUE d'une ligne, selon son état. */
export type ActionPrincipale =
  | { type: "valider"; libelle: string; petit: string | null; desactive: boolean; raison: string | null }
  | { type: "repasser"; libelle: string; phrase: string }
  | { type: "voir"; libelle: string; phrase: string; lien: string | null }
  | { type: "reessayer"; libelle: string; desactive: boolean };

export function actionPrincipale(e: { etat: EtatEnvoi; reseau: IdReseau | string; accordTiktok: boolean; dateEnvoi?: string; lien?: string }): ActionPrincipale {
  if (e.etat === "programmee") return { type: "repasser", libelle: LIBELLES_ENVOI.repasserBrouillon, phrase: phraseProgrammee(e.dateEnvoi) };
  if (e.etat === "publiee") return { type: "voir", libelle: LIBELLES_ENVOI.voirPublication, phrase: LIBELLES_ENVOI.publieeVerifiee, lien: e.lien ?? null };
  if (e.etat === "echec") return { type: "reessayer", libelle: LIBELLES_ENVOI.reessayer, desactive: e.reseau === "tiktok" && !e.accordTiktok };
  const bloque = e.reseau === "tiktok" && !e.accordTiktok;
  return { type: "valider", libelle: LIBELLES_ENVOI.validerEtProgrammer, petit: jourHeureEnvoi(e.dateEnvoi), desactive: bloque, raison: bloque ? LIBELLES_ENVOI.tiktokAccordManquant : null };
}

/** Choix d'outil POUR CE CONTENU : masqué si le réseau est configuré sans Buffer. */
export function choixOutilPropose(e: { bufferDisponible: boolean }): boolean {
  return e.bufferDisponible;
}

/** Sélection multiple : la barre « Valider et programmer les N » et sa note (TikTok en attente d'accord). */
export function barreSelection(lignes: { reseau: IdReseau | string; accordTiktok: boolean }[]): { libelle: string; note: string | null } | null {
  if (!lignes.length) return null;
  const attendTiktok = lignes.some((l) => l.reseau === "tiktok" && !l.accordTiktok);
  return { libelle: LIBELLES_ENVOI.validerLesN(lignes.length), note: attendTiktok ? LIBELLES_ENVOI.noteGroupee : null };
}
