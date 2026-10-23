import { estTexteColle } from "./matieres";

/** Écran « Nouveau sujet » : un texte déjà écrit y sert de matière (il sera réécrit). Renvoie vers « Nouvelle vidéo » pour le garder tel quel. */
export function avertissementTexteColle(idee: string, formatNom: string | undefined): string | null {
  if (!estTexteColle(idee)) return null;
  return `Vous avez déjà votre texte ? Pour le garder mot pour mot, collez-le dans Nouvelle vidéo › ${formatNom ?? "votre format"}. Ici, il sert de matière et sera réécrit.`;
}
