/**
 * MISE EN PAGE des composants « Image → vidéo » (corrections de la direction après lecture des galeries). PUR : ni React
 * ni `remotion`. Pixels de l'écran de référence 1080 × 1920.
 *
 * 1. ZONE UTILE : entre le bas de l'en-tête et la bande des sous-titres (elle-même hors des 20 % du bas, comme la
 *    maquette validée). Le bloc de contenu y est CENTRÉ verticalement et agrandi pour la remplir (≥ 70 % de sa hauteur
 *    aux instants clés) : plus d'écran au contenu tassé dans le haut et au bas vide.
 * 2. MARGES : aucun bloc ne touche le bord (≥ 5 % de la largeur de chaque côté), sauf un FOND (aplat d'écran partagé)
 *    déclaré comme tel ; son texte garde la marge.
 * 3. LISIBILITÉ : aucun libellé sous le plancher de la charte (0,03 × hauteur).
 * 4. ICÔNES : jamais la même icône pour deux éléments différents d'une même image.
 *
 * `controlerMiseEnPage` lit l'EMPRISE d'un instant (blocs, textes, icônes — `emprise.ts`) et rend une phrase par défaut.
 */
import { TAILLE_PLANCHER_DUO } from "../habillage/charte-duo";
import { BAS_ENTETE_IV, BANDE_SOUS_TITRES_IV, ECRAN_IV, ZONE_UTILE_IV } from "./types";

/** Rectangle en pixels de l'écran de référence. */
export type ZoneIV = { x: number; y: number; largeur: number; hauteur: number };

const W = ECRAN_IV.largeur;
const H = ECRAN_IV.hauteur;

/**
 * Bas de l'en-tête, bande des sous-titres et zone utile : SEULE SOURCE dans `src/briques/schema-motion/types.ts` (le moteur
 * les lit aussi : sous-titres et contrôle Q22 de L11), ré-exportés ici pour les composants.
 */
export { BAS_ENTETE_IV, BANDE_SOUS_TITRES_IV, ZONE_UTILE_IV };

/** Haut de la zone utile d'un écran sans titre (marque et repère au-dessus). */
export const HAUT_SANS_TITRE_IV = 0.15;

/** Marge latérale minimale (fraction de la largeur) et marge posée par les composants (pixels, ≥ 5 %). */
export const MARGE_LATERALE_MIN_IV = 0.05;
export const MARGE_IV = 60;

/** Remplissage vertical minimal de la zone utile aux instants clés. */
export const REMPLISSAGE_MIN_IV = 0.7;

/** Plancher de lisibilité (pixels de l'écran de référence). */
export const PLANCHER_PX_IV = TAILLE_PLANCHER_DUO * H;

/** Zone utile en pixels, marges latérales comprises (`sansTitre` : écran sans titre, ex. bandeau des chiffres). */
export function zoneUtile(o: { sansTitre?: boolean } = {}): ZoneIV {
  const haut = Math.round((o.sansTitre ? HAUT_SANS_TITRE_IV : ZONE_UTILE_IV.haut) * H);
  const bas = Math.round(ZONE_UTILE_IV.bas * H);
  return { x: MARGE_IV, y: haut, largeur: W - 2 * MARGE_IV, hauteur: bas - haut };
}

/** Haut d'un bloc de hauteur `hauteur` centré verticalement dans `zone` (collé en haut s'il est plus grand). */
export function centrer(hauteur: number, zone: ZoneIV): number {
  return zone.y + Math.max(0, (zone.hauteur - hauteur) / 2);
}

/** Un bloc posé (carte, objet, texte) ; `fond` = aplat qui peut aller bord à bord (sans texte propre). */
export type BlocIV = ZoneIV & { nom: string; fond?: boolean };
/** Un texte posé : sa taille en pixels (et s'il échappe au plancher par la charte : étiquette espacée, marque). */
export type TexteIV = { texte: string; taille: number; horsPlancher?: boolean };

/** Ce qui est à l'écran à un instant : blocs, textes, icônes (une par élément distinct). */
export type EmpriseIV = { zone: ZoneIV; blocs: BlocIV[]; textes: TexteIV[]; icones: { element: string; icone: string }[]; remplir?: boolean };

/** Part de la hauteur de la zone couverte par le contenu (du haut du premier bloc au bas du dernier, bornés à la zone). */
export function tauxRemplissage(blocs: readonly ZoneIV[], zone: ZoneIV): number {
  if (blocs.length === 0 || zone.hauteur <= 0) return 0;
  const haut = Math.max(zone.y, Math.min(...blocs.map((b) => b.y)));
  const bas = Math.min(zone.y + zone.hauteur, Math.max(...blocs.map((b) => b.y + b.hauteur)));
  return Math.max(0, bas - haut) / zone.hauteur;
}

/** Contrôle pur d'une emprise : une phrase par défaut (vide = mise en page conforme). */
export function controlerMiseEnPage(e: EmpriseIV, o: { remplissageMin?: number } = {}): string[] {
  const defauts: string[] = [];
  const min = o.remplissageMin ?? REMPLISSAGE_MIN_IV;
  if (e.remplir !== false) {
    const taux = tauxRemplissage(e.blocs.filter((b) => !b.fond), e.zone);
    if (taux < min - 1e-9) defauts.push(`Remplissage vertical de ${Math.round(taux * 100)} % (< ${Math.round(min * 100)} %) : contenu à agrandir.`);
  }
  const marge = MARGE_LATERALE_MIN_IV * W;
  for (const b of e.blocs) {
    if (!b.fond && (b.x < marge - 0.5 || b.x + b.largeur > W - marge + 0.5)) defauts.push(`« ${b.nom} » touche le bord (marge < 5 % de la largeur).`);
    if (b.y + b.hauteur > BANDE_SOUS_TITRES_IV.haut * H + 0.5) defauts.push(`« ${b.nom} » descend dans la bande des sous-titres.`);
    if (b.y < e.zone.y - 0.5 && !b.fond) defauts.push(`« ${b.nom} » monte sous l'en-tête.`);
  }
  for (const t of e.textes) if (!t.horsPlancher && t.taille < PLANCHER_PX_IV - 1e-6) defauts.push(`« ${t.texte} » sous le plancher de lisibilité (${Math.round(t.taille)} px).`);
  defauts.push(...controlerIcones(e.icones));
  return defauts;
}

/** Deux éléments différents d'une même image ne portent jamais la même icône. */
export function controlerIcones(icones: readonly { element: string; icone: string }[]): string[] {
  const parIcone = new Map<string, Set<string>>();
  for (const { element, icone } of icones) parIcone.set(icone, (parIcone.get(icone) ?? new Set()).add(element));
  return [...parIcone].filter(([, els]) => els.size > 1).map(([icone, els]) => `Icône « ${icone} » portée par ${els.size} éléments différents (${[...els].join(", ")}).`);
}

/**
 * TÉMOIN des sous-titres (galeries seulement) : une phrase courte posée dans la bande des sous-titres, au style de la
 * maquette validée (Inter Bold, mot `*accent*` en orange, trait orange dessous), pour juger l'image entière. En vidéo,
 * ce sont les vrais sous-titres de la voix (hors de ce module).
 */
export function planTemoinSousTitres(texte: string) {
  const y = BANDE_SOUS_TITRES_IV.haut * H;
  const hauteur = (BANDE_SOUS_TITRES_IV.bas - BANDE_SOUS_TITRES_IV.haut) * H;
  return { x: MARGE_IV, y, largeur: W - 2 * MARGE_IV, hauteur, taille: PLANCHER_PX_IV, mots: texte.split(/\s+/).filter(Boolean).map((m) => ({ mot: m.replace(/\*/g, ""), accent: /^\*.*\*[.,!?…:]*$/.test(m) })) };
}
