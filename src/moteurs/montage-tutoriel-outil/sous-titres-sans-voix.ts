/**
 * SOUS-TITRES DU TUTORIEL SANS VOIX COMPOSÉ (lot qualité 25-11, QUAL-5) — PUR, 0 €.
 * Règle : en sans voix, les sous-titres vivent SEULS dans la bande que la grammaire leur réserve (aucune scène n'y
 * entre) : base `minimal`, intensité `sobre` (aucun Impact, Bandeau ni inclinaison), cartes regroupées PAR PROPOSITION
 * (coupe de préférence à la ponctuation, 4 à 9 mots (et une ligne ≥ 53 px), ≥ 1,5 s à l'écran, pas de carte orpheline de 1-2 mots sauf la dernière),
 * texte noir sur une bande de fond gris charte opaque, mot actif terracotta. Tout passe par les paramètres EXISTANTS de
 * `src/briques/sous-titres` (aucun fichier de cette brique n'est modifié).
 */
import { donneesCalque, GABARITS, positionsVerticales, tailleQuiTient, type DonneesCalque } from "../../briques/sous-titres";
import type { PlanComposeSansVoix } from "../../briques/plan-scenes/tutoriel/sans-voix/types";
import type { BaseSousTitres, MotHorodate, IntensiteSousTitres, Ratio, SegmentSousTitres, ValeurStyleSousTitres } from "../../domaine/types";

/** Couleurs de la charte (src/briques/jetons-motion.ts CHARTE_AXION) : noir, terracotta, ivoire, gris. */
export const COULEURS_SANS_VOIX = { texte: "#141413", accent: "#B23F16", contour: "#FAF9F5", bande: "#E8E6DC" } as const;

/** Largeur maximale d'une ligne, en % de la largeur de l'image. */
export const LARGEUR_MAX_SANS_VOIX_PCT = 90;

/** Bande réservée (grammaire B1) : de `basPct − 9` à `basPct + 6` % de la hauteur (≈ 202 px sur 1350, centre 87 %). */
export const BANDE_SANS_VOIX_PCT = { avantPct: 9, apresPct: 6 } as const;

/** La bande de fond va jusqu'au bas de l'image seulement si cela ajoute au plus ce pourcentage de la hauteur. */
export const BANDE_BAS_MAX_PCT = 8;

/** Centre vertical de la bande des sous-titres (« bas » du registre des réseaux) pour un ratio, en % de la hauteur. */
export function basPctSansVoix(ratio: Ratio): number {
  return positionsVerticales(ratio, []).basPct;
}

/** Style fourni à `fabriquerSousTitres` / `donneesCalque` : en bas, au centre de la bande, 90 % de large. */
export function styleSansVoix(ratio: Ratio, basPct = basPctSansVoix(ratio)): ValeurStyleSousTitres {
  return {
    type: "style-sous-titres",
    police: "Manrope",
    tailleRelative: 1,
    motsParLigne: 6,
    motsParLigneMin: 3,
    casse: "normale",
    animation: "aucune",
    couleurAccent: "orange",
    position: "bas",
    positionPct: basPct,
    largeurMaxPct: LARGEUR_MAX_SANS_VOIX_PCT,
  };
}

/** Options du calage des sous-titres en sans voix (à passer à `fabriquerSousTitres`). */
export function optionsSousTitresSansVoix(ratio: Ratio): { style: ValeurStyleSousTitres; base: BaseSousTitres; intensite: IntensiteSousTitres } {
  return { style: styleSansVoix(ratio), base: "minimal", intensite: "sobre" };
}

/** Regroupement par proposition : bornes en mots par carte, durée minimale d'affichage (s). */
export const CARTE_MOTS_MIN = 4;
export const CARTE_MOTS_MAX = 9;
export const CARTE_DUREE_MIN_SEC = 1.5;

const MOTS_FAIBLES = new Set(["le", "la", "les", "l'", "un", "une", "des", "du", "de", "d'", "au", "aux", "à", "en", "et", "ou", "mais", "que", "qui", "ce", "cet", "cette", "ces", "son", "sa", "ses", "mon", "ma", "mes", "votre", "vos", "notre", "nos", "leur", "leurs", "pour", "par", "sur", "sous", "dans", "avec", "sans", "chez", "ne", "se", "y"]);
const sansPonctuation = (m: string) => m.toLowerCase().replace(/[\s\u00A0\u202F]*[.,;:!?…«»"()]+$/u, "");
const finFort = (m: string) => /[.?!…][»")]*$/u.test(m.trim());
const finMoyen = (m: string) => /[:;]$/u.test(m.trim());
const finFaible = (m: string) => /,$/u.test(m.trim());

/** Taille minimale d'un sous-titre (px sur 1080 de petit côté, exigence du contrôle de composition) ; une carte tient sur UNE ligne. */
const TAILLE_MIN_CARTE_PX = 53;
const GABARIT_SANS_VOIX = GABARITS.minimal;
/** Vrai si la carte tient sur une ligne de 90 % de 1080 px sans descendre sous la taille minimale. */
function carteTient(mots: MotHorodate[]): boolean {
  if (mots.length <= 1) return true;
  const options = { majuscules: false, chiffresTabulaires: true, espaceMotsEm: GABARIT_SANS_VOIX.espaceMotsEm };
  return tailleQuiTient(mots.map((m) => m.mot), GABARIT_SANS_VOIX.police, GABARIT_SANS_VOIX.taillePx, (LARGEUR_MAX_SANS_VOIX_PCT / 100) * 1080, options) >= TAILLE_MIN_CARTE_PX;
}

/** Coût de la coupe APRÈS le mot `m` (suivi de `suivant`) : gratuite à la ponctuation, chère en plein milieu d'un groupe. */
function coutCoupe(m: string, suivant: string | undefined): number {
  if (finFort(m)) return 0;
  if (finMoyen(m)) return 0.4;
  if (finFaible(m)) return 0.8;
  const aprèsFaible = MOTS_FAIBLES.has(sansPonctuation(m));
  const avantFaible = suivant !== undefined && MOTS_FAIBLES.has(sansPonctuation(suivant));
  return 8 + (aprèsFaible ? 8 : 0) - (avantFaible && !aprèsFaible ? 3 : 0);
}

/**
 * Regroupe les MOTS (textes et horaires inchangés) en cartes par proposition : programmation dynamique sur le coût
 * (coupe hors ponctuation, ponctuation forte traversée, carte de 1-2 mots, carte de 3 mots, carte trop brève).
 * Aucune carte au-dessus de 9 mots ; la dernière carte peut rester courte.
 */
function regrouperParProposition(mots: MotHorodate[]): MotHorodate[][] {
  const n = mots.length;
  if (n === 0) return [];
  const cout: number[] = Array(n + 1).fill(Infinity);
  const prec: number[] = Array(n + 1).fill(0);
  cout[0] = 0;
  for (let j = 1; j <= n; j++) {
    for (let i = Math.max(0, j - CARTE_MOTS_MAX); i < j; i++) {
      if (cout[i] === Infinity) continue;
      const taille = j - i;
      if (!carteTient(mots.slice(i, j))) continue;
      let c = 0;
      for (let k = i; k < j - 1; k++) c += finFort(mots[k].mot) ? 10 : finMoyen(mots[k].mot) ? 1.5 : finFaible(mots[k].mot) ? 0.4 : 0;
      if (j < n) c += coutCoupe(mots[j - 1].mot, mots[j]?.mot);
      // Carte courte : pénalisée sauf la DERNIÈRE (qui peut rester courte).
      if (j < n) c += taille === 1 ? 14 : taille === 2 ? 10 : taille === 3 ? 2 : 0;
      c += Math.abs(taille - 6) * 0.1;
      const duree = mots[j - 1].finSec - mots[i].debutSec;
      // Durée trop brève : pénalisée, sauf pour la dernière carte (elle se prolonge librement jusqu'à la fin).
      if (j < n && duree < CARTE_DUREE_MIN_SEC) c += Math.min(5, (4 * (CARTE_DUREE_MIN_SEC - duree)) / 0.5);
      if (cout[i] + c < cout[j]) {
        cout[j] = cout[i] + c;
        prec[j] = i;
      }
    }
  }
  const cartes: MotHorodate[][] = [];
  for (let j = n; j > 0; j = prec[j]) cartes.unshift(mots.slice(prec[j], j));
  return cartes;
}

/**
 * Aucun accent : position « auto » (donc le centre de la bande), pas d'inclinaison, style « base », pas de soulignement ni
 * d'importance. Les mots et leurs horaires sont inchangés ; seul le regroupement en cartes change (par proposition, 4 à 9
 * mots, ≥ 1,5 s à l'écran : la carte se prolonge jusqu'à la suivante au plus, jamais deux cartes à la fois).
 */
/** Trou maximal comblé entre deux cartes (s). */
export const TROU_COMBLE_SEC = 0.6;

export function normaliserSegments(segments: SegmentSousTitres[]): SegmentSousTitres[] {
  const cartes = regrouperParProposition(segments.flatMap((s) => s.mots));
  return cartes.map((mots, k) => {
    const debutSec = mots[0].debutSec;
    const finBrute = Math.max(mots.at(-1)!.finSec, debutSec);
    const suivant = cartes[k + 1]?.[0]?.debutSec;
    const finVoulue = Math.max(finBrute, debutSec + CARTE_DUREE_MIN_SEC);
    // Un trou court (< 0,6 s) entre deux cartes fait « clignoter » la bande : la carte reste jusqu'à la suivante.
    const finSec = suivant === undefined ? finVoulue : suivant - finVoulue < TROU_COMBLE_SEC ? suivant : Math.max(finBrute, Math.min(finVoulue, suivant));
    return { id: `st-${k}`, debutSec, finSec, mots, style: "base", souligne: null, position: "auto", inclinaison: 0, verrouille: false };
  });
}

/** Texte comparable : minuscules, espaces insécables et ponctuation d'espacement ramenés à l'espace simple. */
const comparable = (t: string) => t.toLowerCase().replace(/[\s\u00A0\u202F]+/gu, " ").replace(/\s+([?!:;.,])/gu, "$1").trim();

/**
 * Doublons (QUAL-5, tour 7) : une carte dont le texte est DÉJÀ affiché en grand à ce moment (titre = phrase d'accroche,
 * question de l'appel) est vidée : même carte, mêmes horaires, aucun mot, de sorte que la bande grise reste en place.
 * Les autres cartes ne sont pas touchées. `segments` doit être dans l'ordre des mots du plan (indices de `mots`).
 */
export function viderDoublonsAffiches(segments: SegmentSousTitres[], plan: Pick<PlanComposeSansVoix, "scenes">): SegmentSousTitres[] {
  const affiches = plan.scenes.flatMap((sc) => {
    const textes = sc.genre === "titre" ? [sc.texte, sc.surTitre] : sc.genre === "appel" ? [sc.question] : [];
    return textes.filter((t): t is string => !!t?.trim()).map((t) => ({ plage: sc.mots, texte: comparable(t) }));
  });
  if (!affiches.length) return segments;
  let rang = 0;
  return segments.map((s) => {
    const premier = rang;
    rang += s.mots.length;
    if (!s.mots.length) return s;
    const texte = comparable(s.mots.map((m) => m.mot).join(" "));
    const doublon = affiches.some((a) => premier >= a.plage.premier && rang - 1 <= a.plage.dernier && a.texte.includes(texte));
    return doublon ? { ...s, mots: [] } : s;
  });
}

/** Calque de sous-titres du tutoriel sans voix : segments normalisés, couleurs charte, bande de fond gris opaque. */
export function calqueSansVoix(entree: { segments: SegmentSousTitres[]; ratio: Ratio; basPct?: number; dureeMs?: number }): DonneesCalque {
  const basPct = entree.basPct ?? basPctSansVoix(entree.ratio);
  // La bande grise reste jusqu'à la dernière image : le dernier groupe se prolonge jusqu'à la fin du plan (sinon la bande fond après lui).
  // Segments déjà regroupés par `normaliserSegments` (à la calibration) et éventuellement vidés (doublons) : on ne regroupe plus ici.
  const segments = entree.segments.map((g) => {
    const reste: SegmentSousTitres = { ...g };
    delete reste.importance;
    return { ...reste, position: "auto" as const, inclinaison: 0, style: "base" as const, souligne: null };
  });
  const dernier = segments.at(-1);
  if (dernier && entree.dureeMs !== undefined && entree.dureeMs / 1000 > dernier.finSec) segments[segments.length - 1] = { ...dernier, finSec: entree.dureeMs / 1000 };
  const calque = donneesCalque({
    segments,
    base: "minimal",
    ratio: entree.ratio,
    style: styleSansVoix(entree.ratio, basPct),
    // Contour (= teinte de l'ombre douce du style « minimal ») : le gris de la bande, donc invisible sur elle.
    couleurs: { texte: COULEURS_SANS_VOIX.texte, accent: COULEURS_SANS_VOIX.accent, contour: COULEURS_SANS_VOIX.bande },
  });
  const { largeur, hauteur } = calque;
  const yPx = Math.round(((basPct - BANDE_SANS_VOIX_PCT.avantPct) / 100) * hauteur);
  // La bande ne descend jusqu'au bas de l'image que si cela ajoute au plus 8 % de la hauteur ; sinon (9:16) elle garde sa hauteur normale.
  const finNormalePx = Math.round(((basPct + BANDE_SANS_VOIX_PCT.apresPct) / 100) * hauteur);
  const jusquAuBas = hauteur - finNormalePx <= (BANDE_BAS_MAX_PCT / 100) * hauteur;
  const hauteurBandePx = jusquAuBas ? hauteur - yPx : Math.min(hauteur, finNormalePx) - yPx;
  return {
    ...calque,
    // Texte et bande lisibles à toute largeur : l'échelle suit le petit côté (60 px sur 1080), jamais la largeur du 16:9.
    echelleTexte: Math.min(largeur, hauteur) / 1080,
    // PAS d'`encre` : ce drapeau fait dessiner en Inter Bold (police de titre) ; sans lui, le rendu charge Manrope (Medium,
    // police du style « minimal »). L'ombre du style est de la teinte de la bande : elle ne se voit pas.
    // La bande de fond va de son haut jusqu au bas (ou à basPct+6 si le bas est trop loin, voir ci-dessus) ; le texte reste centré sur basPct.
    bandeFond: { couleur: COULEURS_SANS_VOIX.bande, opacite: 1, xPx: 0, yPx, largeurPx: largeur, hauteurPx: hauteurBandePx, fonduPx: 0 },
  };
}
