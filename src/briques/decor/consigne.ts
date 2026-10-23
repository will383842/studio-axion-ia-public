/**
 * CONSIGNE DE DÉCOR (lot L10), construite avec les RÈGLES DE L'ESSAI V2 du 08/10. PUR.
 *
 * Remarque de Will sur la v1 : « on voit que l'arrière-plan est faux » (lumière incohérente, fond aussi net que le
 * sujet, bibliothèque collée derrière la tête). Les règles retenues corrigent chacun de ces défauts. La consigne est
 * écrite en anglais (langue la mieux suivie par FLUX et Kling) ; ses règles sont aussi données en français pour Will.
 * La MÊME consigne et la MÊME image de référence servent à tous les passages d'une vidéo.
 */

/** Les règles de l'essai v2, en mots simples (affichables dans Réglages ou le journal). */
export const REGLES_DECOR_V2 = [
  "Décor cohérent avec la vraie lumière du tournage (jour, lumineux).",
  "Pièce profonde : 4 à 6 m derrière le sujet.",
  "Fond légèrement flou, comme filmé par un vrai téléphone.",
  "La même lumière tombe sur le sujet et sur la pièce, avec la même balance des blancs.",
  "Photoréaliste : pas d'image de synthèse, pas de toile de fond.",
  "Visage, lèvres et mains identiques, image par image.",
] as const;

export interface DemandeDecor {
  /** Décor voulu, en mots simples (« bureau clair avec plantes et grande fenêtre »). */
  description: string;
  /** Lumière constatée au tournage (mesure de la passe image) ; défaut : jour, lumineux. */
  lumiere?: "jour" | "interieur-chaud" | "interieur-froid";
}

export const LONGUEUR_MAX_DESCRIPTION = 300;

const LUMIERES: Record<NonNullable<DemandeDecor["lumiere"]>, string> = {
  jour: "bright natural daylight, the same as in the original footage",
  "interieur-chaud": "warm indoor light, the same as in the original footage",
  "interieur-froid": "cool neutral indoor light, the same as in the original footage",
};

/** Nettoie la description de Will : une ligne, sans guillemets, 300 caractères au plus. Vide → `null`. */
export function nettoyerDescription(description: string): string | null {
  const propre = description
    .replace(/[\u0000-\u001f\u007f"“”«»`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LONGUEUR_MAX_DESCRIPTION)
    .trim();
  return propre.length >= 3 ? propre : null;
}

/** Consigne complète (anglais). `null` si la description est vide : la passe ne part pas. */
export function construireConsigneDecor(demande: DemandeDecor): string | null {
  const decor = nettoyerDescription(demande.description);
  if (!decor) return null;
  const lumiere = LUMIERES[demande.lumiere ?? "jour"];
  return [
    `Replace only the background with: ${decor}.`,
    `The background must match the real lighting of the shot: ${lumiere}.`,
    "Deep room: the back wall is 4 to 6 meters behind the person, with visible depth.",
    "The background is slightly out of focus, like a real smartphone camera.",
    "The same light falls on the person and on the room, with the same white balance.",
    "Photorealistic, no CGI, no backdrop, no painted wallpaper look.",
    "Keep the person exactly as filmed: face, lips, hands, hair and clothes identical frame by frame. Do not change the framing, timing or speed.",
  ].join(" ");
}
