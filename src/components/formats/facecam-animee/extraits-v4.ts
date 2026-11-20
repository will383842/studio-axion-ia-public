/**
 * FACE CAMÉRA ANIMÉE v4 · panneau « Changer un extrait » : calculs et phrases PURS (aucun import, aucun envoi, rien de payant).
 * Forme de la demande = CONCEPTION-R4-03 § 3. `pourVersionId` n'est JAMAIS écrit ici : il est ajouté côté serveur.
 */

export interface TelephonePanneauV4 {
  rang: number;
  libelle: string;
  debut: number;
  fin: number;
}

export interface SourcePanneauV4 {
  videoId: string;
  titre: string;
}

export type DemandePanneauV4 =
  | { action: "remplacer"; rang: number; recherche: string; sourceVideoId?: string }
  | { action: "retirer"; rang: number }
  | { action: "deplacer"; rang: number; debut: number; fin: number };

export type ActionPanneauV4 = DemandePanneauV4["action"];

export interface SaisiePanneauV4 {
  rang: number | null;
  recherche: string;
  sourceVideoId: string;
  debut: string;
  fin: string;
}

export const LONGUEUR_MAX_RECHERCHE_V4 = 54;

export const PHRASES_PANNEAU_EXTRAITS_V4 = Object.freeze({
  titre: "Changer un extrait",
  aucunTelephone: "Cette version n'a aucun téléphone qui joue un extrait.",
  choisirTelephone: "Choisissez d'abord un téléphone.",
  quoiMontrer: "Dites ce que le téléphone doit montrer.",
  tropLong: "Ce texte est trop long.",
  tempsInvalide: "Indiquez un début et une fin valides.",
  champTexte: "Que doit montrer ce téléphone ?",
  champVideo: "Prendre dans la vidéo…",
  nImporteLaquelle: "N'importe laquelle",
  champDebut: "Début (secondes)",
  champFin: "Fin (secondes)",
  remplacer: "Remplacer",
  retirer: "Retirer",
  deplacer: "Déplacer",
});

/** « 12,5 » ou « 12.5 » → 12.5 ; tout le reste → null. */
function secondes(texte: string): number | null {
  const t = texte.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function demandeDuPanneauV4(
  action: ActionPanneauV4,
  saisie: SaisiePanneauV4,
  sources: readonly SourcePanneauV4[] = [],
): { demande: DemandePanneauV4 } | { erreur: string } {
  const rang = saisie.rang;
  if (rang === null || !Number.isFinite(rang)) return { erreur: PHRASES_PANNEAU_EXTRAITS_V4.choisirTelephone };
  if (action === "retirer") return { demande: { action: "retirer", rang } };
  if (action === "deplacer") {
    const debut = secondes(saisie.debut);
    const fin = secondes(saisie.fin);
    if (debut === null || fin === null || fin <= debut) return { erreur: PHRASES_PANNEAU_EXTRAITS_V4.tempsInvalide };
    return { demande: { action: "deplacer", rang, debut, fin } };
  }
  const sourceVideoId = saisie.sourceVideoId.trim();
  let recherche = saisie.recherche.trim();
  if (recherche === "" && sourceVideoId !== "") {
    const titre = sources.find((s) => s.videoId === sourceVideoId)?.titre.trim() ?? "";
    recherche = titre.slice(0, LONGUEUR_MAX_RECHERCHE_V4).trim();
  }
  if (recherche === "") return { erreur: PHRASES_PANNEAU_EXTRAITS_V4.quoiMontrer };
  if (recherche.length > LONGUEUR_MAX_RECHERCHE_V4) return { erreur: PHRASES_PANNEAU_EXTRAITS_V4.tropLong };
  return { demande: sourceVideoId === "" ? { action: "remplacer", rang, recherche } : { action: "remplacer", rang, recherche, sourceVideoId } };
}
