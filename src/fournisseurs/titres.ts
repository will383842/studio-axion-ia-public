/**
 * Titre FIXE de chaque service, indépendant du fournisseur relié (ordre de Will : aucun nom technique à l'écran). Le
 * service relié n'apparaît que comme valeur choisie, sous son nom simple (catalogue). PUR et partagé : l'écran
 * Réglages > Connexions et le Journal (côté serveur) emploient la même liste.
 */
import type { TypeFournisseur } from "./types";

export const TITRES_SERVICES: Record<TypeFournisseur, string> = {
  script: "Écriture des scripts",
  visage: "Double (visage)",
  voix: "Voix",
  montage: "Montage",
  illustration: "Images d'illustration",
  etalonnage: "Étalonnage des couleurs",
  son: "Son et mixage",
  miniature: "Miniatures",
  publication: "Publication",
  "texte-reseaux": "Textes de publication",
  notification: "Notifications (téléphone, e-mail)",
  stockage: "Stockage des fichiers",
  alignement: "Calage des sous-titres",
  site: "Vidéos sur le site",
};
