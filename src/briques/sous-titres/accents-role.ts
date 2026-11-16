/**
 * Accents par rôle (C11-T12) : chaque rôle (marque, chiffre, validation) prend une teinte de `MARQUEURS`,
 * donc une paire de la charte (`PAIRES_TEXTE`), jamais une couleur libre. Pur, sans alias `@/`.
 * ÉTEINT : rien ne l'importe ; `ACCENTS_ROLE_ACTIFS` reste `false` (seul `true` allume).
 */
import { MARQUEURS } from "./marqueur";
import type { SurlignageSousTitres } from "./scene";
import type { TeinteMarqueurRendu } from "./types-rendu";

export type RoleAccent = "marque" | "chiffre" | "validation";

/** DV-14 : à valider par Williams avant allumage (proposition : marque → terracotta, chiffre → ardoise, validation → ivoire). */
export const ACCENTS_PAR_ROLE: Readonly<Record<RoleAccent, TeinteMarqueurRendu>> = Object.freeze({
  marque: "terracotta",
  chiffre: "ardoise",
  validation: "ivoire",
});

/** Éteint par défaut ; l'allumage attend la décision DV-14 et un geste de Williams. */
export const ACCENTS_ROLE_ACTIFS = false;

/** Surlignage de `MARQUEURS` pour ce rôle sur un écran `clair` ou `sombre` ; rôle inconnu : `null`. */
export function accentPourRole(role: RoleAccent, fond: "clair" | "sombre"): SurlignageSousTitres | null {
  if (typeof role !== "string" || !Object.prototype.hasOwnProperty.call(ACCENTS_PAR_ROLE, role)) return null;
  const m = MARQUEURS[ACCENTS_PAR_ROLE[role]];
  return fond === "clair" ? { fond: m.fond, texte: m.texte } : { fond: m.fondClair ?? m.fond, texte: m.texteClair ?? m.texte };
}
