/**
 * BRIQUE COMMUNE « SOUS-TITRES » (moteur avocat B.5, lot M2 ; catalogue des styles, décision de Will du 01/10).
 * Texte validé ← horodatage de la voix → groupes de 2 à 4 mots (largeur depuis les zones protégées, mesure réelle)
 * → calage sur les coupes → emphase (jeton de la marque) → mélange des styles (base + Impact + Bandeau, intensité)
 * → contrôles. Le rendu (Remotion et aperçu) lit `scene.ts`. Rien de propre au format avocat ici.
 */
import type {
  AlerteQualite,
  BaseSousTitres,
  GabaritSousTitres,
  IdReseau,
  IntensiteSousTitres,
  MotHorodate,
  Ratio,
  SegmentSousTitres,
  ValeurStyleSousTitres,
} from "@/domaine/types";
import { motsSousTitres } from "@/domaine/derivations";
import { phrasesTropDenses } from "@/domaine/lecture";
import { sourceMotif } from "@/domaine/prononciations";
import { grouperMots, recalerSurCoupes, sansChevauchement, type OptionsGroupement } from "./groupement";
import { dimensions, largeurLibrePx, positionsVerticales } from "./largeur";
import { melanger, reporterVerrouilles, type ContexteMelange, type VariationSousTitres } from "./melange";
import { largeurLigne } from "./mesure";
import { reporterSurTexteValide } from "./report";
import { elementDe, largeurElement, type DonneesCalque, type SurlignageSousTitres } from "./scene";
import { baseDe, couleursDepuisMarque, gabaritDe, GABARITS, type CouleursSousTitres } from "./style";
import { PASTILLE_AXION, PASTILLE_AXION_ARDOISE } from "./pastille";
import { normaliser } from "./typographie";
import type { BaseRendu, GabaritRendu, SegmentRendu, StyleBibliothequeRendu } from "./types-rendu";

export * from "./groupement";
export * from "./largeur";
export * from "./melange";
export * from "./mesure";
export * from "./pastille";
export * from "./report";
export * from "./scene";
export * from "./style";
export type * from "./types-rendu";
export { estMotOutil, estNombre, normaliser } from "./typographie";
export { exporterSrt, exporterVtt } from "./export";

export const VERSION_BRIQUE_SOUS_TITRES = "m2-1";

/* Les types du rendu (sans import, lus par Remotion) restent compatibles avec ceux du domaine. */
type Egaux<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const verifierTypes: [
  Egaux<SegmentSousTitres, SegmentRendu>,
  Egaux<BaseSousTitres, BaseRendu>,
  Egaux<GabaritSousTitres, GabaritRendu>,
  ValeurStyleSousTitres extends StyleBibliothequeRendu ? true : false,
] = [true, true, true, true];
void verifierTypes;

export interface DemandeSousTitres {
  /** Texte VALIDÉ (script) : c'est lui qui s'affiche, mot pour mot. */
  texte: string;
  dureeSec: number;
  /** Horodatage des mots (voix réelle ou simulée) ; absent : réparti sur la durée. */
  mots?: MotHorodate[];
  prononciations?: { mot: string; prononciation: string }[];
  /** Mots en valeur (orange). */
  emphase?: string[];
  /** Style de base de la Bibliothèque (valeur complète). */
  style?: ValeurStyleSousTitres | null;
  base?: BaseSousTitres;
  intensite?: IntensiteSousTitres;
  /** Mots par ligne au plus (contrat d'avant le lot M2). */
  motsParLigne?: number;
  coupesSec?: number[];
  ratio?: Ratio;
  reseaux?: IdReseau[];
  motsTitre?: string[];
  ancres?: number[];
  occupe?: ContexteMelange["occupe"];
  /** Version précédente : ses groupes VERROUILLÉS par Will sont reportés tels quels. */
  anciens?: SegmentSousTitres[];
  /** Variation facultative du mélange (cas concret, lot L3b) ; absente : sous-titres inchangés au caractère près. */
  variation?: VariationSousTitres;
}

/** Style de la Bibliothèque + surlignage facultatif (lot L3b, ajout pur) ; sans `surlignage` : rendu inchangé. */
export type StyleSousTitresVarie = ValeurStyleSousTitres & { surlignage?: SurlignageSousTitres };

/** Base retenue : celle de la vidéo, sinon celle du style de la Bibliothèque, sinon Karaoké. */
export function baseRetenue(base: BaseSousTitres | undefined, style: ValeurStyleSousTitres | null | undefined): BaseSousTitres {
  return base ?? baseDe(gabaritDe(style));
}

/** Options de groupement du style de base : gabarit, puis réglages de l'élément de la Bibliothèque. */
export function optionsGroupement(demande: Pick<DemandeSousTitres, "style" | "base" | "motsParLigne" | "ratio" | "reseaux">): Partial<OptionsGroupement> {
  const base = baseRetenue(demande.base, demande.style);
  const g = GABARITS[base];
  const st = demande.style && gabaritDe(demande.style) === base ? demande.style : null;
  const motsMax = Math.min(g.motsMax, Math.max(g.motsMin, demande.motsParLigne ?? st?.motsParLigne ?? g.motsMax));
  const taille = g.taillePx * (st?.tailleRelative ?? 1);
  const largeurMaxPx = st?.largeurMaxPct ? Math.floor((st.largeurMaxPct / 100) * 1080) : largeurLibrePx(demande.ratio ?? "9:16", demande.reseaux ?? []);
  return {
    motsMin: Math.min(motsMax, st?.motsParLigneMin ?? g.motsMin),
    motsMax,
    dureeMinSec: st?.dureeMinGroupeSec ?? g.dureeMinSec,
    dureeMaxSec: st?.dureeMaxGroupeSec ?? g.dureeMaxSec,
    dureeCibleSec: Math.min(st?.dureeMaxGroupeSec ?? g.dureeMaxSec, Math.max(st?.dureeMinGroupeSec ?? g.dureeMinSec, base === "minimal" ? 1 : 0.6)),
    largeurMaxPx,
    mesurer: (mots) => largeurLigne(mots, g.police, taille, { majuscules: g.casse === "majuscules", chiffresTabulaires: true, espaceMotsEm: g.espaceMotsEm }) + g.contourPx,
  };
}

/** Graphie imposée par les prononciations (« axion ia » → « Axion-IA »), sans rien réécrire d'autre. */
function texteAffiche(texte: string, prononciations: { mot: string }[] = []): string {
  let propre = texte;
  for (const p of prononciations) {
    propre = propre.replace(new RegExp(`(?<![\\p{L}\\p{N}])${sourceMotif(p.mot)}(?![\\p{L}\\p{N}])`, "giu"), p.mot);
  }
  return propre;
}

/** Mots en valeur : chaque mot de chaque expression d'emphase, comparé sans ponctuation ni casse. */
function marquerEmphase(mots: MotHorodate[], emphase: string[]): MotHorodate[] {
  const cibles = new Set(emphase.flatMap((e) => e.split(/\s+/)).map(normaliser).filter((x) => x.length > 0));
  return mots.map((m) => ({ ...m, enValeur: cibles.has(normaliser(m.mot)) || undefined }));
}

/** Mode « groupe entier » : un groupe qui contient un mot en valeur passe entièrement en orange (≤ 40 % des groupes). */
export function emphaseParGroupe(segments: SegmentSousTitres[], partMax = 0.4): SegmentSousTitres[] {
  let restant = Math.floor(segments.length * partMax);
  return segments.map((s) => {
    if (restant <= 0 || !s.mots.some((m) => m.enValeur)) return s;
    restant--;
    return { ...s, mots: s.mots.map((m) => ({ ...m, enValeur: true })) };
  });
}

/** Fabrique les sous-titres d'une vidéo (groupes, calage, emphase, mélange). */
export function fabriquerSousTitres(demande: DemandeSousTitres): SegmentSousTitres[] {
  const affiche = motsSousTitres(texteAffiche(demande.texte, demande.prononciations));
  if (!affiche.length) return [];
  let mots: MotHorodate[];
  if (demande.mots?.length) mots = reporterSurTexteValide(affiche, demande.mots);
  else {
    const pas = demande.dureeSec / affiche.length;
    mots = affiche.map((mot, i) => ({ mot, debutSec: +(i * pas).toFixed(3), finSec: +((i + 1) * pas).toFixed(3) }));
  }
  mots = marquerEmphase(mots, demande.emphase ?? []);
  const options = optionsGroupement(demande);
  let segments = grouperMots(mots, options);
  if (demande.coupesSec?.length) segments = recalerSurCoupes(segments, demande.coupesSec, { dureeMinSec: options.dureeMinSec });
  if (demande.style?.modeEmphase === "groupe") segments = emphaseParGroupe(segments);
  if (demande.anciens?.length) segments = reporterVerrouilles(demande.anciens, segments);
  return melanger(segments, {
    intensite: demande.intensite ?? "equilibre",
    coupesSec: demande.coupesSec,
    motsTitre: demande.motsTitre,
    ancres: demande.ancres,
    occupe: demande.occupe,
    dureeSec: demande.dureeSec,
    ...(demande.variation ? { variation: demande.variation } : {}),
  });
}

/** Centre de la base : `positionPct` du style, sinon sa position (haut / bas dans la zone libre), sinon 48 %. */
function positionsDuStyle(ratio: Ratio, reseaux: IdReseau[], style: ValeurStyleSousTitres | null | undefined) {
  const zones = positionsVerticales(ratio, reseaux);
  const milieu = style?.positionPct ?? (style?.position === "haut" ? zones.hautPct : style?.position === "bas" ? zones.basPct : 48);
  return positionsVerticales(ratio, reseaux, milieu);
}

/** Données du calque de rendu (Remotion et aperçu) pour une vidéo. */
export function donneesCalque(entree: {
  segments: SegmentSousTitres[];
  base: BaseSousTitres;
  ratio?: Ratio;
  reseaux?: IdReseau[];
  style?: StyleSousTitresVarie | null;
  couleurs?: CouleursSousTitres;
  marque?: Parameters<typeof couleursDepuisMarque>[0];
  plansPoitrine?: DonneesCalque["plansPoitrine"];
}): DonneesCalque {
  const ratio = entree.ratio ?? "9:16";
  const { largeur, hauteur } = dimensions(ratio);
  const reseaux = entree.reseaux ?? [];
  return {
    largeur,
    hauteur,
    segments: sansChevauchement(entree.segments),
    base: entree.base,
    couleurs: entree.couleurs ?? couleursDepuisMarque(entree.marque, entree.style?.jetonEmphase ?? "orange-vif"),
    largeurMaxPx: entree.style?.largeurMaxPct ? Math.floor((entree.style.largeurMaxPct / 100) * largeur) : largeurLibrePx(ratio, reseaux),
    positions: positionsDuStyle(ratio, reseaux, entree.style),
    plansPoitrine: entree.plansPoitrine,
    tailleRelative: entree.style && gabaritDe(entree.style) === entree.base ? entree.style.tailleRelative : 1,
    // Style nommé « Pastille Axion » (ajout pur) : absent pour tous les autres styles.
    ...(entree.style?.pastille === "axion" ? { pastille: PASTILLE_AXION } : entree.style?.pastille === "axion-ardoise" ? { pastille: PASTILLE_AXION_ARDOISE } : {}),
    // Lot L3b (ajout pur) : surlignage au lieu du trait, seulement quand le style le porte.
    ...(entree.style?.surlignage ? { surlignage: entree.style.surlignage } : {}),
  };
}

/**
 * Contrôles des sous-titres (B.5) : débordement de la zone libre (mesure réelle de chaque groupe à sa taille de
 * rendu), phrase trop dense pour être lue (> 5,5 mots/s), chevauchement avec l'encadré de titre. Jamais bloquant.
 */
export function controlerSousTitres(donnees: DonneesCalque, options: { texte?: string; occupe?: ContexteMelange["occupe"] } = {}): AlerteQualite[] {
  const alertes: AlerteQualite[] = [];
  const debordants = donnees.segments.filter((s) => {
    const el = elementDe(donnees, s, s.finSec);
    return largeurElement(el) * el.echelle > donnees.largeurMaxPx + 1;
  });
  if (debordants.length) alertes.push({ code: "debordement-sous-titres", gravite: "attention", message: `${debordants.length} groupe(s) dépasse(nt) la zone libre.` });
  if (options.texte) {
    const mots = donnees.segments.flatMap((s) => s.mots);
    const denses = phrasesTropDenses(options.texte, 4.4, dureesDesPhrases(mots));
    if (denses.length) alertes.push({ code: "vitesse-lecture", gravite: "info", message: `${denses.length} phrase(s) trop dense(s) pour être lue(s).` });
  }
  const chevauche = donnees.segments.filter((s) => (options.occupe ?? []).some((o) => o.debutSec < s.finSec && o.finSec > s.debutSec && ((o.zone === "haut" && s.position === "haut") || (o.zone === "bas" && s.position === "bas"))));
  if (chevauche.length) alertes.push({ code: "zone-protegee", gravite: "info", message: "Un sous-titre croise l'encadré de titre." });
  return alertes;
}

/** Durée réelle de chaque phrase du texte, depuis les mots horodatés (même découpage que `phrasesDe`). */
export function dureesDesPhrases(mots: MotHorodate[]): number[] | undefined {
  if (!mots.length) return undefined;
  const durees: number[] = [];
  let debut = mots[0].debutSec;
  for (let i = 0; i < mots.length; i++) {
    if (/[.?!…]\s*[»"”]?$/.test(mots[i].mot.replace(/[\u00a0\u202f]/g, "")) || i === mots.length - 1) {
      durees.push(Math.max(0.1, mots[i].finSec - debut));
      if (mots[i + 1]) debut = mots[i + 1].debutSec;
    }
  }
  return durees;
}
