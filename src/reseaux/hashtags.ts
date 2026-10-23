/**
 * « VOS HASHTAGS » : FAMILLE DE MOTS-DIÈSE FIXE PAR RÉSEAU (équipe 7, docs/conception/TIKTOK-SERIES-HASHTAGS.md). PUR :
 * importable côté client.
 *
 * Le générateur et les textes écrits par Claude piochent UNIQUEMENT dans la famille du réseau ; le CODE l'applique
 * après Claude (`choisirDansFamille`), la consigne seule ne suffit pas. Les mots-dièse « fourre-tout » (#fyp, #viral,
 * #pourtoi, #foryou et leurs variantes) ne partent jamais, sur aucun réseau : ils n'aident pas TikTok à comprendre que
 * le compte parle d'IA. Un réseau sans famille reste libre (comportement d'avant).
 */
import type { IdReseau } from "@/domaine/types";

/** Famille de Will pour TikTok (demande validée). */
export const HASHTAGS_TIKTOK_PAR_DEFAUT: readonly string[] = ["#IA", "#intelligenceartificielle", "#IAentreprise", "#ChatGPT", "#formationIA"];

export type FamillesHashtags = Partial<Record<IdReseau, string[]>>;

/** Valeur par défaut du réglage `hashtags.parReseau` : TikTok prérempli, les autres réseaux libres. */
export const HASHTAGS_PAR_DEFAUT: FamillesHashtags = { tiktok: [...HASHTAGS_TIKTOK_PAR_DEFAUT] };

/** Minimum d'une famille saisie (TikTok demande 3 mots-dièse au moins). */
export const FAMILLE_MINIMUM: Partial<Record<IdReseau, number>> = { tiktok: 3 };
/** Au plus 10 mots-dièse dans une famille. */
export const FAMILLE_MAXIMUM = 10;

/** Forme publiable : « # » puis lettres, chiffres ou « _ » (comme `FORME_MOT_DIESE` du rôle publication). */
const FORME = /^#[\p{L}\p{N}_]{2,40}$/u;

/** Clé de comparaison : minuscules, sans « # », sans accents. */
export function cleMotDiese(m: string): string {
  return m
    .trim()
    .replace(/^#+/, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/** Mots-dièse fourre-tout, jamais publiés (exacts, puis par début de mot). */
const INTERDITS_EXACTS = new Set(["fyp", "fy", "fypp", "viral", "pourtoi", "foryou", "foryoupage", "fypage", "xyzbca", "pourtoipage", "pourtoii"]);
const INTERDITS_DEBUT = /^(fyp|foryou|pourtoi|viral)/;

export function estInterdit(m: string): boolean {
  const c = cleMotDiese(m).replace(/[^\p{L}\p{N}_]/gu, "");
  return INTERDITS_EXACTS.has(c) || INTERDITS_DEBUT.test(c);
}

/** « #mot » propre (sans espace, un seul #), ou null si la forme n'est pas publiable. */
export function formeMotDiese(brut: string): string | null {
  const m = `#${brut.trim().replace(/^#+/, "").replace(/\s+/g, "")}`;
  return FORME.test(m) ? m : null;
}

/** Famille d'un réseau (null : réseau libre). */
export function famillePour(reseau: IdReseau, reglage: FamillesHashtags | undefined): string[] | null {
  const liste = reglage?.[reseau];
  return liste && liste.length ? liste : null;
}

/**
 * Mots-dièse retenus. Avec une famille : ceux qui y sont (graphie de la famille), dans l'ordre proposé, complétés dans
 * l'ordre de la famille jusqu'au minimum, coupés au maximum. Sans famille : la proposition, sans interdit ni doublon.
 */
export function choisirDansFamille(proposes: string[], famille: readonly string[] | null, [min, max]: [number, number]): string[] {
  const vus = new Set<string>();
  const out: string[] = [];
  const poser = (m: string) => {
    const c = cleMotDiese(m);
    if (!c || vus.has(c) || estInterdit(m)) return;
    vus.add(c);
    out.push(m);
  };
  if (!famille) {
    for (const p of proposes) poser(p);
    return out.slice(0, max);
  }
  const parCle = new Map(famille.map((f) => [cleMotDiese(f), f]));
  for (const p of proposes) {
    const f = parCle.get(cleMotDiese(p));
    if (f) poser(f);
  }
  for (const f of famille) {
    if (out.length >= min) break;
    poser(f);
  }
  return out.slice(0, max);
}

export type ResultatFamille = { ok: true; liste: string[] } | { ok: false; message: string };

/** Valide une famille saisie dans Réglages (forme, interdits, minimum du réseau) ; nettoie et dédoublonne. */
export function validerFamille(reseau: IdReseau, saisie: string[]): ResultatFamille {
  const liste: string[] = [];
  const vus = new Set<string>();
  for (const brut of saisie) {
    if (!brut.trim()) continue;
    const m = formeMotDiese(brut);
    if (!m) return { ok: false, message: `« ${brut.trim()} » : lettres et chiffres seulement, sans espace.` };
    if (estInterdit(m)) return { ok: false, message: `« ${m} » n'aide pas à comprendre votre sujet : choisissez un mot-dièse sur l'IA.` };
    if (vus.has(cleMotDiese(m))) continue;
    vus.add(cleMotDiese(m));
    liste.push(m);
  }
  const min = FAMILLE_MINIMUM[reseau] ?? 0;
  if (liste.length < min) return { ok: false, message: `Gardez au moins ${min} mots-dièse.` };
  if (liste.length > FAMILLE_MAXIMUM) return { ok: false, message: `${FAMILLE_MAXIMUM} mots-dièse au plus.` };
  return { ok: true, liste };
}
