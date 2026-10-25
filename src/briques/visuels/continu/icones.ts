/**
 * Noms des icônes de la maquette v3 : clé technique `icone` des schémas (liste fermée). Les tracés vivent dans
 * `studio-rendu/compositions/visuels/continu/commun/icones-continu.ts` (un test vérifie que les deux listes sont identiques).
 */
export const NOMS_ICONES = [
  "mail", "clock", "shield", "layers", "users", "check", "x", "arrow", "bookmark", "send", "calendar", "target", "doc", "chat", "gear", "chart",
  "spark", "bolt", "lock", "search", "bell", "folder", "euro", "receipt", "bulb", "cursor", "flag", "link", "eye", "trend", "hourglass",
] as const;

export type NomIcone = (typeof NOMS_ICONES)[number];
