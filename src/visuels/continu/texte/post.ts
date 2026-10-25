/**
 * CARROUSEL CONTINU · Texte du post, textes alternatifs, premier commentaire. PUR.
 * Réutilise `choisirDansFamille` (mots-dièse du réseau) et `textesDe` (lecture des chaînes d'une spec) ; les interdits
 * passent par `ctx.interditsDans`, comme à la porte des autres carrousels.
 */
import { choisirDansFamille } from "../../../reseaux/hashtags";
import { textesDe } from "../../../domaine/controles-visuel/textes-de";
import { contientJAide, expressionsBannieDans, tutoiementDans } from "../../../domaine/controles-visuel/texte";

export type ReseauContinu = "instagram" | "facebook";

interface PageLue {
  alt?: string;
  [cle: string]: unknown;
}
interface ToileLue {
  pages: PageLue[];
}

export interface ContextePost {
  interditsDans: (texte: string) => string[];
  /** Famille de mots-dièse du réseau (réglage « Vos hashtags ») ; absente : liste par défaut ci-dessous. */
  famille?: readonly string[] | null;
}

export const LIMITES_POST: Record<ReseauContinu, { signes: number; diese: [number, number] }> = {
  instagram: { signes: 2200, diese: [3, 5] },
  facebook: { signes: 5000, diese: [0, 3] },
};
export const PREMIERE_LIGNE_MAX = 140;
export const ALT_MAX = 125;

const PROPOSES = ["#IA", "#intelligenceartificielle", "#IAentreprise", "#automatisation", "#PME"];
const APPELS: Record<ReseauContinu, string> = {
  instagram: "Enregistrez ce carrousel pour y revenir.",
  facebook: "Écrivez-nous en message privé pour en parler.",
};

/** Textes d'une page, hors alt et rubrique, dans l'ordre de la spec. */
function textesDePage(page: PageLue): string[] {
  const { alt: _alt, rubrique: _rubrique, ...reste } = page;
  return textesDe(reste).map((t) => t.texte.trim()).filter(Boolean);
}

const sansChiffre = (t: string) => !/\d/.test(t);
const coupe = (t: string, max: number) => {
  const s = t.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const c = s.slice(0, max + 1);
  const i = c.lastIndexOf(" ");
  return `${(i > 0 ? c.slice(0, i) : s.slice(0, max)).replace(/[,;:\s]+$/, "")}…`;
};
const phrase = (t: string) => (/[.!?…]$/.test(t) ? t : `${t}.`);

export interface TextePost {
  texte: string;
  hashtags: string[];
  /** Mots interdits trouvés par la porte : vide si le texte est publiable. */
  interdits: string[];
}

export function textePost(toile: ToileLue, reseau: ReseauContinu, ctx: ContextePost): TextePost {
  const lim = LIMITES_POST[reseau];
  const pages = toile.pages.map(textesDePage);
  const titre1 = pages[0]?.[0] ?? "";
  const premiere = coupe(titre1, PREMIERE_LIGNE_MAX - 1);
  const points = pages
    .slice(1)
    .map((p) => p.find((t) => sansChiffre(t)))
    .filter((t): t is string => !!t)
    .map((t) => phrase(coupe(t, 120)));
  const hashtags = choisirDansFamille(PROPOSES, ctx.famille ?? null, lim.diese);
  const corps = [premiere, ...points, APPELS[reseau]];
  const bloc = (c: string[]) => [c.join("\n\n"), hashtags.join(" ")].filter(Boolean).join("\n\n");
  // Au-delà de la limite, on retire les points du milieu (jamais la 1re ligne, l'appel ni les mots-dièse).
  const milieu = corps.slice(1, -1);
  while (milieu.length && bloc([corps[0], ...milieu, corps[corps.length - 1]]).length > lim.signes) milieu.pop();
  const texte = bloc([corps[0], ...milieu, corps[corps.length - 1]]);
  // Mêmes contrôles de texte que la porte des carrousels : interdits, expressions bannies, tutoiement, « J'aide », « commentez ».
  const tu = tutoiementDans(texte);
  const interdits = [
    ...ctx.interditsDans(texte),
    ...expressionsBannieDans(texte),
    ...(tu ? [`tutoiement « ${tu} »`] : []),
    ...(contientJAide(texte) ? ["J'aide"] : []),
    ...(/commentez/i.test(texte) ? ["commentez"] : []),
  ];
  return { texte, hashtags, interdits: [...new Set(interdits)] };
}

/** `alt` de chaque page, sinon un alt construit depuis ses textes : « Page N sur M : … » (≤ 125). */
export function textesAlternatifs(toile: ToileLue): string[] {
  const n = toile.pages.length;
  return toile.pages.map((p, i) => {
    const alt = (p.alt ?? "").trim();
    if (alt) return coupe(alt, ALT_MAX);
    const entete = `Page ${i + 1} sur ${n} : `;
    return entete + coupe(textesDePage(p).join(" ") || "page du carrousel", ALT_MAX - entete.length);
  });
}

/** Vide par défaut ; la source si une page cite un fait (aucune en V1). */
export function premierCommentaire(_toile: ToileLue): string {
  return "";
}
