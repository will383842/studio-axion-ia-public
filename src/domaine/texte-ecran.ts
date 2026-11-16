/** Réglages facultatifs du texte à l'écran d'un style de sous-titres (C2-U4 : contrat seul, aucune logique). */
export type TeinteMarqueur = "terracotta" | "ivoire" | "ardoise";
export type CibleMarqueur = "souligne" | "expression" | "mot-dit";
export interface ReglagesTexteEcran {
  /** Surlignage « marqueur » (fond derrière le mot) aux couleurs Axion. Absent : trait de soulignement (actuel). */
  marqueur?: { teinte: TeinteMarqueur; cible?: CibleMarqueur };
  /** Mot-clé en pavé (plaque inclinée). Absent : aucun pavé. */
  pave?: { mots: "forts" | "chiffres" | "forts-et-chiffres" };
  /** Noms d'outils en texte seul (étiquette), jamais de logo. Absent : rien. */
  outils?: "etiquette";
  /** Variantes d'une vidéo à l'autre, tirées dans le profil (U12). Absent : style fixe. */
  varier?: boolean;
}
