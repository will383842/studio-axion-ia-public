/**
 * Niveau de chaque contrôle selon l'auteur du texte (plan v5 B.7.2, colonnes « Machine » et « Will »), corrigé par
 * l'addendum du 02/10 (C3 bis assoupli, C8 à 5 s / 20 mots, C63 à 47 mots, exception et appel facultatifs). PUR.
 * `null` : le contrôle ne s'applique pas à cet auteur.
 */
import type { NiveauControle } from "./types";

type Ligne = { machine: NiveauControle | null; will: NiveauControle | null };
const l = (machine: NiveauControle | null, will: NiveauControle | null): Ligne => ({ machine, will });

export const NIVEAUX: Readonly<Record<string, Ligne>> = {
  C1: l("bloquant", "info"),
  "C1 bis": l("bloquant", "info"),
  "C1 ter": l("bloquant", null),
  C2: l("bloquant", "info"),
  C3: l("bloquant", "info"),
  "C3 bis": l("bloquant", "info"),
  C4: l("bloquant", "alerte"),
  C5: l("bloquant", "info"),
  "C5 bis": l("bloquant", "info"),
  "C5 ter": l("bloquant", "info"),
  C6: l("bloquant", null),
  "C6 bis": l("bloquant", "info"),
  C7: l("bloquant", "info"),
  C8: l("bloquant", "info"),
  C9: l("alerte", "alerte"),
  "C9 bis": l("alerte", "alerte"),
  C10: l("bloquant", null),
  "C10 bis": l("bloquant", "info"),
  "C10 ter": l("bloquant", "info"),
  /* Équipe 7 : un terme du compte (IA) dit avant 5 s sur les réseaux qui en ont (TikTok). */
  "C10 quater": l("alerte", null),
  C11: l("alerte", null),
  C12: l("correction", "info"),
  C13: l("bloquant", "alerte"),
  C14: l("bloquant", "info"),
  C15: l("bloquant", "info"),
  C16: l("bloquant", "info"),
  "C16 bis": l("alerte", null),
  C17: l("bloquant", null),
  "C17 bis": l("bloquant", null),
  C18: l("bloquant", "info"),
  C19: l("bloquant", "alerte"),
  C20: l("bloquant", null),
  C21: l("bloquant", null),
  "C21 bis": l("bloquant", null),
  C22: l("bloquant", "alerte"),
  C23: l("alerte", "alerte"),
  C24: l("bloquant", "alerte"),
  C25: l("alerte", null),
  "C25 bis": l("alerte", null),
  C26: l("alerte", null),
  C27: l("bloquant", null),
  C28: l("bloquant", "info"),
  C29: l("alerte", null),
  C30: l("bloquant", "info"),
  "C30 bis": l("bloquant", null),
  "C30 ter": l("bloquant", "info"),
  C31: l("bloquant", "info"),
  C32: l("bloquant", null),
  C33: l("bloquant", "info"),
  C34: l("bloquant", "info"),
  C35: l("bloquant", null),
  C36: l("bloquant", null),
  C37: l("bloquant", "info"),
  C38: l("alerte", "info"),
  "C38 bis": l("alerte", "info"),
  /* V4 : les 5 étapes d'une même solution (« Elle s'inscrit… Elle reçoit… ») ; relevé, jamais bloquant. */
  C39: l("info", "info"),
  C40: l("bloquant", "info"),
  C41: l("bloquant", "info"),
  C42: l("bloquant", "alerte"),
  C43: l("bloquant", "info"),
  C44: l("alerte", null),
  C45: l("alerte", null),
  "C45 bis": l("alerte", null),
  C46: l("alerte", null),
  "C46 bis": l("alerte", null),
  C47: l("bloquant", null),
  C48: l("info", null),
  C49: l("bloquant", "info"),
  C50: l("bloquant", "info"),
  C51: l("bloquant", null),
  C52: l("bloquant", "info"),
  C53: l("bloquant", "info"),
  C54: l("bloquant", "alerte"),
  C55: l("bloquant", "alerte"),
  C56: l("alerte", "info"),
  C57: l("bloquant", "alerte"),
  C58: l("bloquant", null),
  C59: l("bloquant", "alerte"),
  C60: l("bloquant", "info"),
  C61: l("bloquant", null),
  C62: l("bloquant", null),
  C63: l("bloquant", "info"),
  C64: l("bloquant", "info"),
  C65: l("correction", null),
  C66: l("alerte", null),
  C67: l("bloquant", null),
  C68: l("bloquant", null),
  C69: l("bloquant", null),
  C70: l("bloquant", null),
  C71: l("bloquant", null),
  C72: l("bloquant", "info"),
  C73: l("bloquant", null),
  C74: l("bloquant", null),
  C75: l("bloquant", "info"),
  C76: l("alerte", null),
  /* G4 : addendum §2 bis, « résoudre un problème douloureux ». */
  C77: l("bloquant", "info"),
  /* V4 : la v4 de Will dit le coût vers 12 s ; la fenêtre de 5 s reste une information. */
  C78: l("info", "info"),
  C79: l("bloquant", "info"),
  C80: l("alerte", "alerte"),
  /* G4 : addendum §2 ter, récit du cas client. */
  C81: l("alerte", "info"),
  /* G4 : addendum §2 quinquies, le spectateur se reconnaît dans le client. */
  C82: l("alerte", "info"),
  /* G4 : ordre de Will du 03/10, jamais de faux cas client. */
  C83: l("bloquant", "alerte"),
  /* G4 : addendum §2 sexies, diversité et ruptures (contrôles de série, jamais bloquants). */
  C84: l("alerte", "info"),
  C85: l("alerte", "info"),
  C86: l("alerte", "info"),
  C87: l("alerte", "info"),
  C88: l("info", "info"),
  /* Rétention (étalonnage sur la v4) : informations, poids modeste dans la note (`RETRAIT_INFO_RETENTION`). */
  C89: l("info", "info"),
  C90: l("info", "info"),
  C91: l("info", "info"),
  C92: l("info", "info"),
  C93: l("info", "info"),
  /* Audit du 17/10 : la douleur est nommée dans CHAQUE script (C80 ne règle que l'intensité en série). Jamais bloquant. */
  C94: l("alerte", "info"),
  /* Lot A2 : positionnement de Will partout (« jamais faites-le vous-même », jamais d'annonce d'outil). Garde-fou côté machine. */
  C95: l("bloquant", "info"),
  /* Lot A3 : contrôles de recette, ALERTES (tutoriel, aucune question, fin qui redit l accroche, pas de rupture). */
  C96: l("alerte", "info"),
  C97: l("alerte", "info"),
  C98: l("alerte", "info"),
  C99: l("alerte", "info"),
};

/**
 * Garde-fous (B.7.5) : un seul échec rend la version non présentable. Limités au LÉGAL et à l'INVENTION (preuves,
 * accords, C16, C18, C31, C32, C50, C54, C55 : jamais de faux cas, de faux témoignage ni de parole de Will inventée ;
 * interdits permanents et de Will), à l'APPEL, et aux tournures IA. Étalonnage sur la v4 de Will : le reste relève de
 * la note, pas d'un refus.
 */
export const GARDE_FOUS: readonly string[] = ["C1", "C1 bis", "C1 ter", "C2", "C15", "C16", "C18", "C31", "C32", "C50", "C54", "C55", "C42", "C57", "C59", "C83", "C3", "C34", "C63", "C64", "C72", "C4", "C5", "C5 bis", "C95"];
