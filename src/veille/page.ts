/**
 * Source « page publique » (journal des nouveautés HeyGen, ElevenLabs ; pages d'aide des réseaux ; outil ajouté par Will).
 * - Le texte lisible est extrait (scripts, styles et balises retirés) ; une page qui ne s'affiche qu'avec un navigateur
 *   (texte quasi vide) est une source MUETTE, jamais une page « à jour ».
 * - Version = date la plus récente citée dans la page, sans dépasser aujourd'hui (« September 28, 2026 »,
 *   « Added - September 2026 », « 2026-09-28 », « 28 septembre 2026 ») ; à défaut, l'empreinte du texte seule.
 */
import { empreinte, lireTexte, SourceMuette } from "./http";
import type { ContexteLecture, Lecture } from "./types";

/** En dessous : page rendue par un navigateur seulement (TikTok, Instagram), illisible ici. */
export const TEXTE_MINIMAL = 400;

export function texteLisible(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MOIS_EN = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export interface DateTrouvee {
  /** « 2026-09-28 » ou « 2026-09 » (mois seul). */
  cle: string;
  index: number;
}

/** Toutes les dates citées dans un texte (PUR). */
export function datesCitees(texte: string): DateTrouvee[] {
  const res: DateTrouvee[] = [];
  const p2 = (n: number) => String(n).padStart(2, "0");
  const en = new RegExp(`\\b(${MOIS_EN.join("|")})\\s+(?:(\\d{1,2})(?:st|nd|rd|th)?,?\\s+)?(20\\d\\d)\\b`, "gi");
  for (const m of texte.matchAll(en)) {
    const mois = MOIS_EN.indexOf(m[1].toLowerCase()) + 1;
    res.push({ cle: m[2] ? `${m[3]}-${p2(mois)}-${p2(Number(m[2]))}` : `${m[3]}-${p2(mois)}`, index: m.index ?? 0 });
  }
  const fr = new RegExp(`\\b(?:(\\d{1,2})(?:er)?\\s+)?(${MOIS_FR.join("|")})\\s+(20\\d\\d)\\b`, "gi");
  for (const m of texte.matchAll(fr)) {
    const mois = MOIS_FR.indexOf(m[2].toLowerCase()) + 1;
    res.push({ cle: m[1] ? `${m[3]}-${p2(mois)}-${p2(Number(m[1]))}` : `${m[3]}-${p2(mois)}`, index: m.index ?? 0 });
  }
  for (const m of texte.matchAll(/\b(20\d\d)-(\d\d)-(\d\d)\b/g)) res.push({ cle: `${m[1]}-${m[2]}-${m[3]}`, index: m.index ?? 0 });
  return res;
}

/** Date la plus récente citée, sans dépasser `maintenant` (une date d'arrêt annoncée n'est pas une nouveauté). */
export function dateLaPlusRecente(texte: string, maintenant: Date): DateTrouvee | null {
  const aujourdhui = maintenant.toISOString().slice(0, 10);
  let meilleure: DateTrouvee | null = null;
  for (const d of datesCitees(texte)) {
    if (d.cle.length === 10 ? d.cle > aujourdhui : d.cle > aujourdhui.slice(0, 7)) continue;
    // À date égale, le mois seul (« September 2026 ») cède au jour précis.
    if (!meilleure || d.cle > meilleure.cle || (d.cle === meilleure.cle && d.index < meilleure.index)) meilleure = d;
  }
  return meilleure;
}

export async function lirePage(url: string, c: ContexteLecture): Promise<Lecture> {
  let html: string;
  try {
    html = await lireTexte(c.appeler, url, c.delaiMs, { accept: "text/html,*/*" });
  } catch (e) {
    return { ok: false, raison: e instanceof SourceMuette ? e.raison : "La source ne répond pas." };
  }
  return lecturePage(url, html, c.maintenant);
}

/**
 * Texte servant à l'empreinte : sans ce qui change à chaque affichage (identifiants de plusieurs chiffres de l'aide
 * Google, drapeaux techniques true/false, année du copyright). Sinon chaque lecture serait une fausse nouveauté.
 */
export function texteStable(texte: string): string {
  return texte
    .replace(/\b[0-9a-f]{12,}\b/gi, " ")
    .replace(/\b\d{6,}\b/g, " ")
    .replace(/\b(true|false|null|undefined)\b/g, " ")
    .replace(/©\s*\d{4}/g, "©")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lecture d'une page déjà téléchargée (PUR, testé sur des pages enregistrées). */
export function lecturePage(url: string, html: string, maintenant: Date): Lecture {
  const texte = texteLisible(html);
  if (texte.length < TEXTE_MINIMAL) return { ok: false, raison: "Page lisible seulement dans un navigateur." };
  const d = dateLaPlusRecente(texte, maintenant);
  const notes = d ? texte.slice(d.index, d.index + 1500) : texte.slice(0, 1500);
  return { ok: true, version: d?.cle, ...(d && d.cle.length === 10 ? { date: `${d.cle}T00:00:00.000Z` } : {}), lien: url, notes, empreinte: empreinte(texteStable(texte)) };
}
