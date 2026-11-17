/**
 * C11-E4 : garde PURE des textes affichés par les écrans composés (Duel, fil social générique). Aucun React, imports relatifs seulement.
 * Un texte est refusé s'il nomme une marque, un outil ou un réseau, s'il contient un pseudo, un mot-dièse, une adresse, une mention
 * commerciale (partenaire, officiel, certifié, sponsorisé) ou un dénigrement, ou s'il dépasse 120 caractères.
 */
import { NOMS_OUTILS } from "../../sous-titres/noms-outils";

const nettoyer = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ");

/** Réseaux et marques (liste figée le 16/11/2026), en plus des formes de `NOMS_OUTILS`. */
const RESEAUX_ET_MARQUES = [
  "instagram", "tiktok", "facebook", "youtube", "linkedin", "whatsapp", "snapchat", "pinterest", "threads", "twitter", "telegram",
  "messenger", "reddit", "twitch", "google", "apple", "iphone", "android", "meta", "microsoft", "openai",
] as const;

/** Mots normalisés interdits (formes des outils, mot par mot et collées, plus les réseaux). */
export const MARQUES_INTERDITES: readonly string[] = Object.freeze(
  [...new Set([
    ...NOMS_OUTILS.flatMap((o) => o.formes.flatMap((f) => [...f.map(nettoyer), f.map(nettoyer).join("")])),
    ...RESEAUX_ET_MARQUES,
  ])].filter((m) => m !== ""),
);

export const LONGUEUR_MAX_TEXTE = 120;
const ENSEMBLE = new Set(MARQUES_INTERDITES);
const MENTIONS = ["partenair", "officiel", "certifie", "sponsoris"];

export function texteGenerique(texte: string): { ok: true } | { ok: false; raison: string } {
  if (typeof texte !== "string") return { ok: false, raison: "texte absent" };
  if (texte.length > LONGUEUR_MAX_TEXTE) return { ok: false, raison: `plus de ${LONGUEUR_MAX_TEXTE} caractères` };
  const n = nettoyer(texte);
  if (/@[\p{L}\p{N}_]/u.test(n)) return { ok: false, raison: "pseudo" };
  if (/#[\p{L}\p{N}_]/u.test(n)) return { ok: false, raison: "mot-dièse" };
  if (/http|www\.|\.com\b|\.fr\b/.test(n)) return { ok: false, raison: "adresse" };
  if (/\b(meilleur|meilleure|meilleurs|meilleures|pire|pires) que\b/.test(n)) return { ok: false, raison: "dénigrement" };
  const mots = n.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for (const m of mots) {
    if (ENSEMBLE.has(m)) return { ok: false, raison: `nom de marque ou d'outil : ${m}` };
    if (MENTIONS.some((x) => m.startsWith(x))) return { ok: false, raison: `mention commerciale : ${m}` };
  }
  return { ok: true };
}

/** Liste des refus (vide si tout passe). */
export function textesGeneriques(textes: readonly string[]): string[] {
  const refus: string[] = [];
  for (const t of textes) {
    const r = texteGenerique(t);
    if (!r.ok) refus.push(`${r.raison} : ${String(t).slice(0, 40)}`);
  }
  return refus;
}
