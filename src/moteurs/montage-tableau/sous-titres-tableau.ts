/**
 * SOUS-TITRES DU TABLEAU ANIMÉ AU DESIGN CENTRAL (ordre de Will du 17/10/2026, puis son retour sur #330 : « ce ne sont
 * pas les bonnes couleurs, ce n'est pas ce qui est centralisé ; je parle du DESIGN »). Le tableau dessine ses
 * sous-titres EXACTEMENT comme la face caméra et l'avocat : style central (choix de la vidéo, sinon « Avocat »,
 * `st-avocat-v1`), couleurs de la marque par jeton (`couleursDepuisMarque` : texte crème, mot dit orange, contour et
 * ombre sombres), gabarits Karaoké / Minimal / Impact / Bandeau de `briques/sous-titres/style.ts`, aucune pastille. Le
 * tableau n'y ajoute que ses garde-fous :
 *
 * - position : partie pleine de la bande basse réservée par la mise en page (priorité sur la position du style) ;
 * - taille bornée par la hauteur de la bande, largeur au plus celle du style ou des zones protégées ;
 * - lisibilité sur les fonds clairs (tableau blanc, paperboard) SANS toucher au dessin : une bande sombre de fond (jeton
 *   `fond` de la marque) derrière le sous-titre, dans la bande, décidée par la règle centrale `sousTitresSurDecor` ;
 *   l'ardoise, déjà sombre, n'en a pas ;
 * - sous-titres dynamiques (mélange central) : voir `sousTitresDynamiquesTableau`.
 *
 * Anciens styles du tableau (page ivoire, avant « reference/3 ») : l'Encre d'avant. PUR.
 */
import type { AlerteQualite, BaseSousTitres, GabaritSousTitres, IdReseau, IntensiteSousTitres, Ratio, SegmentSousTitres, StyleGroupeSousTitres, StyleResolu, ValeurDecor, ValeurStyleSousTitres } from "@/domaine/types";
import { contraste, luminance, sousTitresSurDecor } from "@/domaine/decors";
import { baseDe, couleursDepuisMarque, dimensions, elementDe, gabaritDe, GABARITS, largeurElement, largeurLibrePx, melanger, type BandeFondSousTitres, type CouleursSousTitres, type DonneesCalque, type ElementDessine } from "@/briques/sous-titres";
import { estNombre, estUnite, normaliser } from "@/briques/sous-titres/typographie";
import { COULEURS_VIDEO } from "@/briques/habillage/charte-video";
import { COULEURS_REFERENCE_3 } from "@/briques/tableau-scene/reference/charte";
import { CHARTES_TABLEAU, estStyleTableau, melangeTableau, type StyleTableau } from "@/briques/tableau-scene/trois-styles/styles";
import { STYLE_SOUS_TITRES_AVOCAT, STYLE_SOUS_TITRES_MINIMAL } from "@/donnees/elements-avocat";
import { estStyleReference3, type FicheTableau } from "./fiche";

/** Contraste minimal du texte sur son fond (WCAG AA). */
export const CONTRASTE_MIN_SOUS_TITRES = 4.5;

/**
 * Style « Encre » des anciens styles du tableau (essai réel du 11/10 : le « Minimal » crème à ombre sombre était presque
 * illisible sur la page ivoire). Gabarit Minimal (groupes, fondu), écriture de la charte sur la page, ni contour ni
 * ombre, police de la charte (Inter Bold). Le « Minimal » des autres formats n'est pas touché.
 */
export const STYLE_SOUS_TITRES_ENCRE: ValeurStyleSousTitres = Object.freeze({
  ...STYLE_SOUS_TITRES_MINIMAL,
  police: "Inter Bold",
  contourPx: 0,
  ombrePx: 0,
  encre: Object.freeze({ texte: COULEURS_VIDEO.ecriture, page: COULEURS_VIDEO.page }),
});

/** Fond sur lequel les sous-titres sont posés (couleur de la surface sous la bande basse). */
export interface FondSousTitres {
  /** Style de tableau (trois styles du 16/10) ; absent : page de la charte des styles d'avant. */
  style?: StyleTableau;
  teinte: string;
  clair: boolean;
}

export function fondSousTitresTableau(fiche: Pick<FicheTableau, "habillage" | "styleTableau">): FondSousTitres {
  if (estStyleTableau(fiche.styleTableau)) {
    const style = fiche.styleTableau;
    return { style, teinte: CHARTES_TABLEAU[style].fond, clair: style !== "ardoise" };
  }
  return { teinte: estStyleReference3(fiche) ? COULEURS_REFERENCE_3.fond : COULEURS_VIDEO.page, clair: true };
}

/** Bande basse des sous-titres : hauteur (px de l'image) et échelle de la lettre (largeur de référence / 1 080). */
export interface BandeSousTitres {
  hauteurPx: number;
  echelle: number;
  /** Largeur de la bande en % de la largeur de l'image (la ligne n'en sort jamais). */
  largeurPct?: number;
  /** Hauteur de l'image du calque (px) : décalage du centre quand la bande de fond a un fondu en haut. */
  hauteurImagePx?: number;
}

/**
 * Bande d'une mise en page, dans les px du calque des sous-titres (`dimensions(ratio)`) ; échelle de la lettre : 1 en
 * vertical, largeur de référence / 1 080 ailleurs (comme `echelleSousTitres` de la composition).
 */
export function bandeDe(mise: { largeurPx: number; hauteurPx: number; reference?: { largeur: number }; bandeSousTitres: { px: { largeur: number; hauteur: number } } }, ratio: Ratio, verticale: boolean, reseaux: readonly IdReseau[] = []): BandeSousTitres {
  const b = mise.bandeSousTitres.px;
  const { largeur, hauteur } = dimensions(ratio);
  // La ligne ne sort ni de la bande ni des zones protégées des réseaux (la plus étroite des deux).
  const largeurPct = Math.min((b.largeur / mise.largeurPx) * 100, (largeurLibrePx(ratio, [...reseaux]) / largeur) * 100);
  return { hauteurPx: (b.hauteur / mise.hauteurPx) * hauteur, echelle: verticale ? 1 : (mise.reference?.largeur ?? mise.largeurPx) / 1080, largeurPct: Math.floor(largeurPct * 100) / 100, hauteurImagePx: hauteur };
}

/**
 * Style CENTRAL par défaut des sous-titres du tableau (retour de Will du 17/10 : « normalement nous avions tout
 * centralisé ») : celui de la face caméra et de l'avocat, « Avocat » (`st-avocat-v1`) — gabarit Karaoké, Poppins
 * ExtraBold, texte crème, mot dit à l'orange de la marque, contour et ombre sombres. Aucune couleur n'y est écrite :
 * le calque les lit dans la marque par jeton (`couleursDepuisMarque`), comme pour tous les autres formats.
 */
export const ID_STYLE_SOUS_TITRES_TABLEAU = "st-avocat-v1";
export const STYLE_SOUS_TITRES_TABLEAU: ValeurStyleSousTitres = STYLE_SOUS_TITRES_AVOCAT;

/**
 * Bande sombre de FOND derrière les sous-titres (fonds clairs) : opacité de départ (≈ 0,85, relevée par la mesure du
 * contraste), part de la bande prise par le dégradé doux du haut, et ce que le dégradé du bas déborde sous la bande (dans
 * le vide sous le contenu, jamais au-dessus).
 */
export const BANDE_FOND_TABLEAU = { opaciteMin: 0.85, fonduHautPart: 0.12, fonduBasPart: 0.2 } as const;

export interface SousTitresTableau {
  /** Style posé dans la commande (identifiant, nom, valeur complète). */
  style: Required<Pick<StyleResolu<ValeurStyleSousTitres>, "id" | "nom">> & { valeur: ValeurStyleSousTitres };
  base: BaseSousTitres;
  /** Gabarit des groupes de base (Karaoké ou Minimal ; Impact et Bandeau gardent leur dessin). */
  gabarit: GabaritSousTitres;
  /** Décor posé dans la commande : ce qui est réellement derrière le texte (la bande de fond, sinon le tableau). */
  decor?: ValeurDecor;
  /** Contraste le plus faible du texte (crème, mot dit) sur ce qui est derrière lui. */
  contraste: number;
  /** Couleurs effectivement dessinées (contrôle de la charte) : celles de la marque, rien d'autre. */
  couleurs: string[];
  /** Repli (texte encore sous 4,5:1) : dit dans le rapport, sans bloquer. */
  alerte?: AlerteQualite;
  /** Vrai quand le résultat diffère du rendu d'avant (empreinte de la composition). */
  personnalise: boolean;
  /** Accents du mélange central que le tableau peut dessiner (Impact, Bandeau du central, lisibles sur la bande). */
  accents: { impact: boolean; bandeau: boolean };
  /** Un mot en valeur (chiffre dit) peut prendre la couleur d'accent sans passer sous 4,5:1. */
  motsEnValeur: boolean;
  /** Centre de la ligne (% de la hauteur) : centre de la partie pleine de la bande de fond, sinon de la bande. */
  positionPct: number;
  /** Bande de fond (jeton `fond` de la marque) : absente sur un fond déjà sombre (ardoise). */
  bandeFond?: { couleur: string; opacite: number };
  /**
   * Échelle de la lettre (comme `echelleSousTitres`) : celle de la bande, réduite quand l'Impact central (×1,3, contour,
   * rebond) n'y tiendrait pas — tout le sous-titre rapetisse ensemble, le dessin reste celui du central. Absente sans bande.
   */
  echelle?: number;
}

/** Hauteur de la ligne d'un Impact central d'importance 1-2 (×1,3), contour compris, au plus fort du rebond (× 1,05). */
const HAUTEUR_IMPACT_CENTRAL = (GABARITS.impact.taillePx * 1.3 * 1.1 + GABARITS.impact.contourPx) * 1.05;

/** Couleurs du calque central (marque par jeton ; aucune marque transmise : les replis des jetons, comme partout). */
function couleursCentrales(v: ValeurStyleSousTitres): CouleursSousTitres {
  return couleursDepuisMarque(null, v.jetonEmphase ?? "orange-vif");
}

/** Plus grande taille relative dont la ligne la plus haute du gabarit tient dans `hauteurPx` (avec un peu d'air). */
function tailleRelativeMax(g: GabaritSousTitres, hauteurPx: number, echelle: number): number {
  const d = GABARITS[g];
  const facteur = g === "impact" ? 1.3 : 1;
  const hauteurLigne = (d.bandeau ? 1 + 2 * d.bandeau.margeYEm : 1.1) * d.taillePx * facteur + d.contourPx;
  return (hauteurPx * 0.9) / (hauteurLigne * echelle);
}

/**
 * Le style des sous-titres du tableau, depuis le style CHOISI (commande du studio) et le fond de la fiche.
 *
 * Charte Axion et trois fonds : le DESIGN CENTRAL exact (style choisi sans pastille ni encre, sinon « Avocat »), couleurs
 * de la marque par jeton, sans aucune pastille ; la lisibilité vient d'une bande sombre de fond (jeton `fond`) posée dans
 * la bande réservée, jamais d'une couleur inventée. La règle centrale `sousTitresSurDecor` décide : un fond où le crème
 * se lit déjà (ardoise) n'a pas de bande ; sinon la bande, à l'opacité la plus faible (≥ 0,85) où le texte et le mot dit
 * passent 4,5:1.
 * Anciens styles (page ivoire, avant « reference/3 ») : l'Encre d'avant, sauf choix explicite.
 */
export function sousTitresTableau(o: { fiche: Pick<FicheTableau, "habillage" | "styleTableau">; choisi?: StyleResolu<ValeurStyleSousTitres> | null; positionPct: number; bande?: BandeSousTitres }): SousTitresTableau {
  const fond = fondSousTitresTableau(o.fiche);
  const axion = estStyleReference3(o.fiche) || !!fond.style;
  const valeurChoisie = o.choisi?.valeur?.type === "style-sous-titres" ? o.choisi.valeur : undefined;
  // Un style à pastille (l'ancienne « Pastille Axion ») ou à encre n'est plus dessiné tel quel : design central.
  const choixCentral = valeurChoisie && !valeurChoisie.pastille && !valeurChoisie.encre ? valeurChoisie : undefined;
  if (!axion && !choixCentral) {
    const valeur = { ...STYLE_SOUS_TITRES_ENCRE, positionPct: o.positionPct };
    return { style: { id: "sous-titres-encre", nom: "Encre", valeur }, base: "minimal", gabarit: "minimal", contraste: contraste(COULEURS_VIDEO.ecriture, fond.teinte), couleurs: [COULEURS_VIDEO.ecriture], personnalise: false, accents: { impact: false, bandeau: false }, motsEnValeur: false, positionPct: o.positionPct };
  }
  const source = choixCentral ? { id: o.choisi!.id, nom: o.choisi!.nom, valeur: choixCentral } : { id: ID_STYLE_SOUS_TITRES_TABLEAU, nom: "Avocat", valeur: STYLE_SOUS_TITRES_TABLEAU };
  const gabaritStyle = gabaritDe(source.valeur);
  const c = couleursCentrales(source.valeur);

  // Règle centrale sur le fond réel : le crème s'y lit-il déjà ? Sinon, la bande de fond (jeton `fond`), opacité mesurée.
  const decorDe = (teinte: string): ValeurDecor => ({ type: "decor", mode: "teinte", teinte, profondeurFlou: 0, directionLumiere: "face", positionSujet: 0.5, clair: luminance(teinte) > 0.4 });
  const pire = (teinte: string) => Math.min(contraste(c.texte, teinte), contraste(c.accent, teinte));
  let bandeFond: SousTitresTableau["bandeFond"];
  let teinte = fond.teinte;
  if (sousTitresSurDecor({ ...decorDe(fond.teinte), clair: fond.clair }).mode !== "normal" || pire(fond.teinte) < CONTRASTE_MIN_SOUS_TITRES) {
    let opacite: number = BANDE_FOND_TABLEAU.opaciteMin;
    while (opacite < 1 && pire(melangeTableau(c.contour, fond.teinte, opacite)) < CONTRASTE_MIN_SOUS_TITRES + 0.1) opacite = Math.min(1, +(opacite + 0.01).toFixed(2));
    bandeFond = { couleur: c.contour, opacite };
    teinte = melangeTableau(c.contour, fond.teinte, opacite);
  }
  const decor = decorDe(teinte);
  const mesure = pire(teinte);
  const regle = sousTitresSurDecor(decor);
  const alerte: AlerteQualite | undefined = mesure < CONTRASTE_MIN_SOUS_TITRES || regle.mode !== "normal" ? { code: "debordement-sous-titres", gravite: "attention", message: `Sous-titres : le texte n'atteint que ${mesure.toFixed(1)}:1 sur le fond (il faut 4,5:1).` } : undefined;

  // Le texte se pose dans la partie PLEINE de la bande de fond (sous le dégradé du haut) ; sans bande, toute la bande.
  const fonduPx = bandeFond && o.bande ? o.bande.hauteurPx * BANDE_FOND_TABLEAU.fonduHautPart : 0;
  const positionPct = fonduPx && o.bande?.hauteurImagePx ? +(o.positionPct + ((fonduPx / 2) / o.bande.hauteurImagePx) * 100).toFixed(2) : o.positionPct;
  // Le central dessine ses accents à SA taille : si l'Impact ne tient pas dans la bande (carré, 16:9), tout rapetisse.
  const zonePx = o.bande ? o.bande.hauteurPx - fonduPx : Infinity;
  const echelle = o.bande ? +Math.min(o.bande.echelle, (zonePx * 0.98) / HAUTEUR_IMPACT_CENTRAL).toFixed(4) : undefined;
  const relMax = o.bande ? tailleRelativeMax(gabaritStyle, zonePx, echelle!) : Infinity;
  const largeurMaxPct = o.bande?.largeurPct !== undefined ? Math.min(source.valeur.largeurMaxPct ?? Infinity, o.bande.largeurPct) : source.valeur.largeurMaxPct;
  const valeur: ValeurStyleSousTitres = {
    ...source.valeur,
    // La bande prime sur la position du style (haut, centre, bas, % du style).
    position: "bas",
    positionPct,
    tailleRelative: Math.min(source.valeur.tailleRelative ?? 1, relMax),
    ...(largeurMaxPct !== undefined ? { largeurMaxPct } : {}),
  };
  // Le Bandeau central (rectangle crème, texte sombre) se lit partout ; l'Impact (crème cerné) sur la bande sombre.
  const accents = { impact: contraste(c.texte, teinte) >= CONTRASTE_MIN_SOUS_TITRES, bandeau: contraste(c.contour, c.texte) >= CONTRASTE_MIN_SOUS_TITRES };
  return {
    style: { id: source.id, nom: source.nom, valeur },
    base: baseDe(gabaritStyle),
    gabarit: gabaritStyle,
    decor,
    contraste: mesure,
    couleurs: [c.texte, c.accent, c.contour],
    personnalise: true,
    accents,
    motsEnValeur: GABARITS[gabaritStyle].motCle !== "aucun",
    positionPct,
    ...(bandeFond ? { bandeFond } : {}),
    ...(echelle !== undefined ? { echelle } : {}),
    ...(alerte ? { alerte } : {}),
  };
}

/**
 * Bande de fond du calque (px du calque) : toute la largeur de l'image, sur les lignes de la bande réservée ; dégradé
 * doux en haut (dans la bande), effacement doux sous la bande (dans le vide sous le contenu). Absente sans bande de fond.
 */
export function bandeFondCalque(st: Pick<SousTitresTableau, "bandeFond">, bande: BandeCalque, largeurCalquePx: number): BandeFondSousTitres | undefined {
  if (!st.bandeFond) return undefined;
  return { couleur: st.bandeFond.couleur, opacite: st.bandeFond.opacite, xPx: 0, yPx: bande.y, largeurPx: largeurCalquePx, hauteurPx: bande.hauteur, fonduPx: bande.hauteur * BANDE_FOND_TABLEAU.fonduHautPart, fonduBasPx: bande.hauteur * BANDE_FOND_TABLEAU.fonduBasPart };
}

/** Zone où le TEXTE se pose : la partie pleine de la bande de fond (sous son dégradé), sinon toute la bande. */
export function zoneTexteTableau(st: Pick<SousTitresTableau, "bandeFond">, bande: BandeCalque): BandeCalque {
  if (!st.bandeFond) return bande;
  const f = bande.hauteur * BANDE_FOND_TABLEAU.fonduHautPart;
  return { ...bande, y: bande.y + f, hauteur: bande.hauteur - f };
}

/** Inclinaison la plus forte d'un Impact du tableau (le central penche de ±4° ; ici, faible, pour rester dans la bande). */
export const INCLINAISON_MAX_TABLEAU = 2;

/** Nombres dits en toutes lettres (« trois jours », « dix minutes ») ; « un », « une » sont trop souvent des articles. */
const NOMBRES_DITS: ReadonlySet<string> = new Set(["deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "quinze", "vingt", "trente", "quarante", "cinquante", "soixante", "cent", "mille"]);

/**
 * Chiffres DITS du tableau : un nombre (en chiffres ou en lettres) suivi d'une unité (« trois jours », « dix minutes »,
 * « 3 min ») passe en valeur, comme un chiffre écrit pour le mélange central. Les groupes verrouillés ne bougent pas.
 * Rend aussi l'indice des groupes qui en portent un.
 */
export function marquerChiffresDits(segments: readonly SegmentSousTitres[]): { segments: SegmentSousTitres[]; chiffres: Set<number> } {
  const plats = segments.flatMap((s, i) => s.mots.map((m, k) => ({ i, k, m })));
  const marques = new Set<string>();
  plats.forEach(({ i, k, m }, n) => {
    const suivant = plats[n + 1];
    if (!suivant || segments[i].verrouille || segments[suivant.i].verrouille) return;
    if ((estNombre(m.mot) || NOMBRES_DITS.has(normaliser(m.mot))) && estUnite(suivant.m.mot)) {
      marques.add(`${i}:${k}`);
      marques.add(`${suivant.i}:${suivant.k}`);
    }
  });
  const chiffres = new Set<number>();
  const sortie = segments.map((s, i) => {
    if (!s.mots.some((_, k) => marques.has(`${i}:${k}`))) return { ...s };
    chiffres.add(i);
    return { ...s, mots: s.mots.map((m, k) => (marques.has(`${i}:${k}`) ? { ...m, enValeur: true } : m)) };
  });
  return { segments: sortie, chiffres };
}

/**
 * SOUS-TITRES DYNAMIQUES DU TABLEAU (ordre de Will du 17/10/2026 : « les sous-titres dépendent de l'importance du mot ou
 * du message, de façon automatique, comme dans le système central »). Le MÉLANGE CENTRAL (`melanger`) décide : base sur
 * la plupart des groupes, Impact (accroche, chiffres, mots forts ; jamais deux de suite), Bandeau (phrases clés), taille
 * selon l'importance, soulignement ; intensité de la vidéo (sobre, équilibré par défaut, très dynamique) ; groupes
 * verrouillés jamais réécrits. Le tableau n'y ajoute que ses garde-fous :
 * - les chiffres DITS (« dix minutes ») comptent comme des chiffres (`marquerChiffresDits`) ;
 * - tout reste dans la bande : position « auto » (centre de la bande, jamais le haut de la page), inclinaison ≤ 2° ;
 * - un accent que le style ne peut pas dessiner lisiblement sur ce fond (`st.accents`) retombe sur le style de base ;
 * - la taille est bornée par la hauteur de la bande ensuite (`bornerDansLaBande`, sur le calque réel).
 */
export function sousTitresDynamiquesTableau(segments: readonly SegmentSousTitres[], o: { st: Pick<SousTitresTableau, "gabarit" | "accents"> & Partial<Pick<SousTitresTableau, "motsEnValeur">>; intensite?: IntensiteSousTitres; coupesSec?: number[]; dureeSec?: number }): SegmentSousTitres[] {
  const chiffresDits = marquerChiffresDits(segments);
  const chiffres = chiffresDits.chiffres;
  // Le chiffre dit ne prend la couleur d'accent que si le style la rend lisible ; sinon seule sa taille le distingue.
  const marques = o.st.motsEnValeur === false ? segments.map((s) => ({ ...s })) : chiffresDits.segments;
  const melange = melanger(marques, { intensite: o.intensite ?? "equilibre", ...(o.coupesSec?.length ? { coupesSec: o.coupesSec } : {}), ...(o.dureeSec !== undefined ? { dureeSec: o.dureeSec } : {}) });
  const base = styleDeBase(o.st.gabarit);
  return melange.map((s, i) => {
    const importance = !s.verrouille && chiffres.has(i) && s.style === "base" ? 3 : s.importance;
    const garde = (s.style === "impact" && o.st.accents.impact) || (s.style === "bandeau" && o.st.accents.bandeau);
    const style: StyleGroupeSousTitres = garde ? s.style! : base;
    const inclinaison = style === "impact" && garde ? Math.max(-INCLINAISON_MAX_TABLEAU, Math.min(INCLINAISON_MAX_TABLEAU, s.inclinaison ?? 0)) : 0;
    // Bandeau central : texte sombre sur le rectangle crème ; un mot en valeur y resterait à l'orange sur le crème
    // (< 4,5:1) : il garde le texte sombre du Bandeau (sa place dans un Bandeau suffit à le distinguer).
    const mots = style === "bandeau" && !s.verrouille && s.mots.some((m) => m.enValeur) ? s.mots.map((m) => ({ mot: m.mot, debutSec: m.debutSec, finSec: m.finSec })) : s.mots;
    return { ...s, mots, style, importance, position: "auto" as const, inclinaison };
  });
}

/** Style des groupes de base dans le tableau : celui du gabarit (Impact et Bandeau gardent leur dessin). */
const styleDeBase = (g: GabaritSousTitres): StyleGroupeSousTitres => (g === "impact" ? "impact" : g === "bandeau" ? "bandeau" : "base");

/** Bande réservée aux sous-titres, dans les px du calque. */
export interface BandeCalque {
  y: number;
  hauteur: number;
  largeur: number;
}

/** Bande de la mise en page dans les px du calque (la mise en page peut avoir une autre taille d'image que le calque). */
export function bandeDuCalque(mise: { largeurPx: number; hauteurPx: number; bandeSousTitres: { px: { y: number; largeur: number; hauteur: number } } }, calque: Pick<DonneesCalque, "largeur" | "hauteur">): BandeCalque {
  const k = calque.hauteur / mise.hauteurPx;
  const b = mise.bandeSousTitres.px;
  return { y: b.y * k, hauteur: b.hauteur * k, largeur: (b.largeur / mise.largeurPx) * calque.largeur };
}

/** Encombrement d'un groupe dessiné autour de son centre (lettre, marges, contour, échelle d'entrée, inclinaison). */
export function encombrementTableau(el: ElementDessine, echelle: number): { demiHauteur: number; largeur: number } {
  const bordPx = el.pastille?.bord ? parseFloat(el.pastille.bord) || 0 : 0;
  const h = (el.pastille ? (el.taillePx * 1.15) / 2 + el.pastille.margeYPx + bordPx : el.fond ? el.taillePx / 2 + el.fond.margeYPx : (el.taillePx * 1.1) / 2 + (el.gabarit.contourPx * echelle) / 2) * el.echelle;
  const w = largeurElement(el) * el.echelle;
  const a = (Math.abs(el.rotationDeg) * Math.PI) / 180;
  return { demiHauteur: h * Math.cos(a) + (w / 2) * Math.sin(a), largeur: w * Math.cos(a) + 2 * h * Math.sin(a) };
}

/** Instants contrôlés d'un groupe : son entrée (glissement, rebond) et sa fin (chaque mot dit). */
const instantsDe = (s: SegmentSousTitres) => [s.debutSec + 1e-3, Math.min(s.finSec - 1e-3, Math.max(s.debutSec + 0.3, (s.mots.at(-1)?.debutSec ?? s.debutSec) + 0.01))];

/** Le groupe, dessiné sur ce calque, tient-il dans la bande (haut, bas, largeur) à chacun de ses instants ? */
export function tientDansLaBande(calque: DonneesCalque, s: SegmentSousTitres, bande: BandeCalque): boolean {
  const e = calque.echelleTexte ?? calque.largeur / 1080;
  return instantsDe(s).every((t) => {
    const el = elementDe(calque, s, t);
    const { demiHauteur, largeur } = encombrementTableau(el, e);
    const y = el.yPx + el.decalageYPx;
    return y - demiHauteur >= bande.y - 1 && y + demiHauteur <= bande.y + bande.hauteur + 1 && largeur <= bande.largeur + 1;
  });
}

/**
 * Taille des accents bornée par la BANDE, sur le calque réel : un groupe qui en sortirait essaie, dans l'ordre, une
 * inclinaison plus faible, une importance moindre, puis le style de base (16:9, carré : bande plus basse). PUR.
 */
export function bornerDansLaBande(segments: readonly SegmentSousTitres[], calque: DonneesCalque, bande: BandeCalque, gabarit: GabaritSousTitres): SegmentSousTitres[] {
  const base = styleDeBase(gabarit);
  return segments.map((s) => {
    if (tientDansLaBande(calque, s, bande)) return s;
    const imp = s.importance ?? 0;
    const essais: SegmentSousTitres[] = [
      ...(s.style === "impact" && s.inclinaison ? [{ ...s, inclinaison: Math.sign(s.inclinaison) }, { ...s, inclinaison: 0 }] : []),
      ...(imp >= 3 && s.style !== base ? [{ ...s, importance: 2, inclinaison: 0 }] : []),
      { ...s, style: base, inclinaison: 0, importance: imp },
      { ...s, style: base, inclinaison: 0, importance: Math.min(2, imp) },
    ];
    return essais.find((x) => tientDansLaBande(calque, x, bande)) ?? essais[essais.length - 1];
  });
}

/**
 * Groupes APLATIS (avant les sous-titres dynamiques du 17/10, gardés pour les bancs d'avant) : tous dans la bande basse,
 * à taille constante, sans soulignement ni inclinaison. `gabarit` Impact ou Bandeau : chaque groupe garde ce dessin.
 */
export function groupesTableau(segments: readonly SegmentSousTitres[], gabarit: GabaritSousTitres = "karaoke"): SegmentSousTitres[] {
  const style = gabarit === "impact" ? ("impact" as const) : gabarit === "bandeau" ? ("bandeau" as const) : ("base" as const);
  return segments.map((s) => ({ ...s, style, position: "auto" as const, inclinaison: 0, souligne: null, importance: 0 }));
}

/**
 * Supplements de la composition pour les sous-titres d'une sortie du tableau, la MÊME source pour la fabrication, les
 * tests et les aperçus : centre de la ligne, échelle de la lettre hors du vertical, accents sans glissement (sous-titres
 * dynamiques), bande de fond (fonds clairs). PUR.
 */
export function supplementsSousTitresTableau(o: { st: Pick<SousTitresTableau, "positionPct" | "bandeFond" | "echelle">; mise: { largeurPx: number; hauteurPx: number; reference?: { largeur: number }; bandeSousTitres: { px: { y: number; largeur: number; hauteur: number } } }; ratio: Ratio; verticale: boolean; dynamiques?: boolean }): { positionSousTitresPct: number; echelleSousTitres?: number; glissementSousTitres?: false; bandeFondSousTitres?: BandeFondSousTitres } {
  const calque = dimensions(o.ratio);
  const bandeFond = bandeFondCalque(o.st, bandeDuCalque(o.mise, calque), calque.largeur);
  return {
    positionSousTitresPct: o.st.positionPct,
    // Hors du vertical : la taille de la référence ; partout, réduite si l'Impact central ne tiendrait pas dans la bande.
    ...(o.st.echelle !== undefined && (!o.verticale || o.st.echelle !== 1) ? { echelleSousTitres: o.st.echelle } : o.verticale ? {} : { echelleSousTitres: (o.mise.reference?.largeur ?? o.mise.largeurPx) / 1080 }),
    ...(o.dynamiques ? { glissementSousTitres: false as const } : {}),
    ...(bandeFond ? { bandeFondSousTitres: bandeFond } : {}),
  };
}
