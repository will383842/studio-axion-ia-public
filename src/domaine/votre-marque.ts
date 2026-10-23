/**
 * « VOTRE MARQUE » (équipe 7, docs/conception/TIKTOK-SERIES-HASHTAGS.md § 2.4). PUR : importable côté client.
 *
 * Une vidéo qui met Axion IA en avant doit être déclarée dans TikTok (Divulgation du contenu → Votre marque). Buffer ne
 * permet pas de le cocher (aucun champ dans `createPost`, relevé du 03/10/2026) : le studio le RAPPELLE, dans la feuille
 * d'envoi et dans la notification. Rien n'est jamais publié directement (brouillon), aucune étiquette IA n'est ajoutée.
 */

/** Le geste à faire dans TikTok, mot pour mot. */
export const RAPPEL_VOTRE_MARQUE = "Dans TikTok : Divulgation du contenu → Votre marque";

/** Le texte parle-t-il d'Axion IA ou de son offre ? (pré-coche la case) */
const MOTIFS = [/\baxion[\s-]?ia\b/i, /\baxion-ia\.com\b/i, /\bnotre (offre|formation|accompagnement|programme)\b/i, /\bnos (offres|formations|accompagnements|programmes)\b/i];

export function parleDAxion(texte: string): boolean {
  return MOTIFS.some((re) => re.test(texte));
}

/** État de la case « Cette vidéo met en avant Axion IA » : le choix de Will, sinon déduit du texte (`auto`). */
export function votreMarque(video: { metEnAvantAxion?: boolean }, texte: string): { cochee: boolean; auto: boolean } {
  if (typeof video.metEnAvantAxion === "boolean") return { cochee: video.metEnAvantAxion, auto: false };
  return { cochee: parleDAxion(texte), auto: true };
}
