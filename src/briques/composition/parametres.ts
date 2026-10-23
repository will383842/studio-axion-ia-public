/**
 * PARAMÈTRES DE LA COMPOSITION depuis la commande — brique commune « composition » (centralisée le 02/10 ; née au
 * lot M4 dans le moteur avocat ; plan B.2, B.3, B.5, B.7). PUR : ne lit que la commande (les fichiers arrivent par
 * `commande.medias`, résolus par le service), ce que le moteur a produit (plans, sous-titres, audio maître) et la
 * RECETTE du format (`recette.ts`). Il dit, pour UN format d'image :
 *  - les calques image (décor, double, accessoire, recadrage, illustrations) et texte (incrustations, encadré,
 *    sous-titres), géométrie calculée depuis les zones protégées des réseaux conseillés, jamais en dur ;
 *  - la LUT de chaque plan, le grain en luminance et la vignette (calque 6, posés par FFmpeg) ;
 *  - le son (chaîne de la voix, ton de pièce, niveau, crête vraie) et l'export ;
 *  - les contrôles qui ne dépendent que de la composition (encadré trop long, montant dit ≠ montant affiché,
 *    double non ancré en bas, décor à vérifier, LUT sans fichier).
 */
import { REGLES_BRUITAGES, type BruitagePlace } from "@/briques/intensite/types";
import { donneesCalque } from "@/briques/sous-titres";
import { positionsVerticales } from "@/briques/sous-titres/largeur";
import type { BandeFondSousTitres, DonneesCalque } from "@/briques/sous-titres/scene";
import { sousTitresSurDecor } from "@/domaine/decors";
import type { AlerteQualite, AngleVisage, CommandeFabrication, IdReseau, MotHorodate, SegmentSousTitres } from "@/domaine/types";
import { reseauxDeCommande, reseauxDesCalques, zoneAuMoins, zonesProtegeesUnion } from "@/briques/declinaison";
import { trouverFormat } from "@/formats";
import { FOND_UNI_AVATAR } from "@/fournisseurs/heygen/rendus";
import type { PlanProduit } from "@/moteurs/types";
import { basSousTitres, placerEncadre } from "./encadre";
import { coteContour, decorScene, plagesDesLuts, sourceDuDouble } from "./image";
import { masquerMontantsDits, masquerPendantCartesPleinEcran, masquerTextesAffiches, placerIncrustations, recalerObjets } from "./incrustations";
import type { RecetteComposition } from "./recette";
import { poserEcransPartages } from "../habillage-facecam/ecran-partage";
import { poserMisesEnPage, type CoteWill, type MiseEnPageScene, type ModeMiseEnPage } from "../habillage-facecam/mise-en-page";
import { plagesLookBroll } from "../habillage-facecam/broll";
import { centreJonctionPct } from "../habillage-facecam/sous-titres";
import { poserCartesPleinEcran } from "../motion/pose";
import { poserPlansCamera, type MulticameraComposition } from "../multicamera/composition";
import {
  basDuDoubleAuBas,
  DIMENSIONS_SCENE,
  PREFIXE_ENTREE,
  type AccessoireScene,
  type ControleCouleurs,
  type DecorScene,
  type EncadreScene,
  type ParametresCouleurs,
  type ParametresExport,
  type ParametresSon,
  type PlanScene,
  type ProprietesImageComposition,
  type ProprietesTexteComposition,
  type RatioScene,
} from "./scene";

export interface EntreeComposition {
  ratio: RatioScene;
  plans: PlanProduit[];
  /** Sous-titres groupés (lot M2) à l'horodatage réel. */
  segments: SegmentSousTitres[];
  dureeSec: number;
  /** 12/10 (ajout pur) : instants (s) de la mesure des bords noirs, quand la recette la demande (`exportBordsSurs`). */
  instantsBords?: number[];
  /** Mots de l'audio maître (pauses mesurées sur le fichier exporté). */
  mots?: MotHorodate[];
  /** Clé de l'audio maître. */
  audioCle?: string;
  /** Pistes du visage (webm transparents, lot M6), par angle. */
  pistesDouble?: Partial<Record<AngleVisage, string>>;
  /** Lot R7d : passages du second angle (un webm par passage, ± 1 s), quand il n'a pas de piste continue. */
  tranchesDouble?: Partial<Record<AngleVisage, { cle: string; debutSec: number; finSec: number }[]>>;
  /** Lot R7e : l'avatar a été rendu sur un fond uni (repli, ou choix de Will) : pistes opaques, ni liseré. */
  doubleFondUni?: boolean;
  /**
   * Lot B1 : les pistes du double viennent du Look du décor (Will généré DANS la pièce). Le décor est alors dans la
   * vidéo : ni décor ni liseré ne sont posés, et la piste n'est pas transparente. Absent : pistes détourées.
   */
  pistesDepuisLook?: boolean;
  /** Lot « bruitages » (02/10, D1) : sons posés par le chef d'orchestre (absents : piste de bruitages vide). */
  bruitages?: BruitagePlace[];
  /**
   * Facecam lot C (plan v4 B.9, ajout pur) : la piste du visage est DÉJÀ au format du ratio (cadrage par calque fait
   * en amont) : ni bandes ni second recadrage. Absent : comportement d'avant (l'avocat ne change pas).
   */
  sourcePreCadree?: boolean;
  /** Facecam lot C (B.8, ajout pur) : piste 10 bits ; master 10 bits et UNE seule compression 8 bits à l'export. */
  source10bits?: boolean;
  /**
   * Facecam lot C (B.19, B.22, ajout pur) : écrans partagés par passages — carte (MP4 déjà rendu par l'opération
   * `composition` sans mode) en haut, la personne en bas (`sourceY` : cadrage par calque) ; sous-titres à la jonction.
   */
  ecransPartages?: {
    debutSec: number;
    finSec: number;
    carteCle: string;
    sourceY: number;
    /**
     * Facecam lot F1 (ajouts purs) : côte à côte (16:9), carte à gauche sur `largeurCarte` px, la personne à droite à
     * partir de la colonne `sourceX` de l'image ; `ligne` : place des sous-titres pendant le passage (centre et colonne).
     * Absents : carte en haut, ligne à la jonction (lot C).
     */
    cote?: "gauche";
    largeurCarte?: number;
    sourceX?: number;
    ligne?: { centrePct: number; colonne?: { gauchePx: number; largeurPx: number } };
  }[];
  /** Facecam lot C (B.22, ajout pur) : centre de la ligne des sous-titres (55-72 % en face caméra). */
  positionSousTitresPct?: number;
  /**
   * Facecam lot G (ajout pur) : mises en page par passages — Will sur un côté (la carte de l'autre, sous-titres dans sa
   * colonne) ou en vignette dans un coin (la carte plein écran derrière). Absent : plans inchangés.
   */
  misesEnPage?: { debutSec: number; finSec: number; carteCle: string; mode: ModeMiseEnPage; cote: CoteWill; geometrie: MiseEnPageScene["geometrie"] }[];
  /**
   * Lot C, brique `motion` (ajout pur, TOUS les formats, l'avocat compris) : cartes de motion design plein écran (MP4
   * déjà rendus), posées comme des plans d'illustration vidéo. Absent : plans inchangés.
   */
  cartesPleinEcran?: { debutSec: number; finSec: number; carteCle: string }[];
  /**
   * Facecam, finitions du 10/10 (ajout pur) : textes déjà affichés par une carte (titre d'appel à l'action, carte plein
   * écran). Un groupe de sous-titres qui les répète pendant la carte n'est pas dessiné (les sous-titres restent entiers
   * dans les données et l'export). Absent : rien ne change.
   */
  textesAffiches?: { debutSec: number; finSec: number; texte: string }[];
  /** Facecam lot C (B.21, ajout pur) : LUT du Look Will posée sur les B-roll (plans d'illustration). */
  lookBroll?: { lutCle: string; intensite?: number };
  /**
   * Mission H, brique `multicamera` (ajout pur, TOUS les formats) : plans de caméra et vidéo de chaque angle fabriqué
   * (même son). Les plans « double » sont coupés aux instants des plans de caméra ; les zooms s'appliquent sur l'angle
   * montré. Absent : une seule caméra, paramètres identiques.
   */
  multicamera?: MulticameraComposition;
  /** Facecam lot F1 (ajout pur) : échelle de la lettre des sous-titres (16:9 : 0,9). Absente : largeur / 1 080. */
  echelleSousTitres?: number;
  /**
   * Tableau animé, sous-titres dynamiques du 17/10 (ajout pur) : `false`, un accent (Impact, Bandeau) entre sans glisser,
   * pour ne jamais sortir de la bande réservée. Absent : glissement d'entrée, comme avant.
   */
  glissementSousTitres?: false;
  /**
   * Tableau animé, design central (ajout pur) : bande sombre de fond derrière les sous-titres (fonds clairs), dans la
   * bande réservée. Absente : rien n'est dessiné, paramètres identiques.
   */
  bandeFondSousTitres?: BandeFondSousTitres;
  /**
   * 10/10 (ajout pur) : garde-fou des couleurs — clé de la prise étalonnée (passe image) et instants comparés. Absent :
   * aucune comparaison, paramètres identiques.
   */
  controleCouleurs?: { referenceCle: string; paires: ControleCouleurs["paires"] };
  /**
   * Cas concret (ajout pur, essai réel du 14/10) : écrans CLAIRS, où les sous-titres passent en texte foncé sans contour
   * ni ombre (`texte`), comme la v4. Absent : inchangé.
   */
  passagesClairs?: { debutSec: number; finSec: number; texte: string }[];
}

/**
 * Correcteur réel 2 (04/10) : durée du fondu de fin (au noir, image et son) : ce qui reste après le dernier mot, au plus
 * `maxSec` ; jamais avant le dernier mot. Undefined : aucun (fin en boucle, ou moins de 0,2 s après le dernier mot).
 */
export function fonduDeFin(o: { dureeSec: number; dernierMotSec?: number; finEnBoucle: boolean; maxSec?: number }): number | undefined {
  if (o.finEnBoucle || !o.maxSec || o.dernierMotSec === undefined) return undefined;
  const d = Math.min(o.maxSec, o.dureeSec - o.dernierMotSec);
  return d >= 0.2 ? +d.toFixed(3) : undefined;
}

export interface ParametresComposition {
  ratio: RatioScene;
  image: ProprietesImageComposition;
  texte: ProprietesTexteComposition;
  couleurs: ParametresCouleurs;
  son: ParametresSon;
  export: ParametresExport;
  /** Entrées à signer : nom → clé de stockage. */
  entrees: Record<string, string>;
  alertes: AlerteQualite[];
  /** 10/10 : garde-fou des couleurs (absent sans `controleCouleurs` dans l'entrée). */
  controleCouleurs?: ControleCouleurs;
}

const ref = (nom: string) => `${PREFIXE_ENTREE}${nom}`;

function hache(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Pauses (après le premier mot) où le niveau est mesuré : blancs d'au moins 150 ms, marges de 30 ms. */
export function pausesDesMots(mots: MotHorodate[] | undefined): [number, number][] {
  const p: [number, number][] = [];
  for (let i = 1; i < (mots?.length ?? 0); i++) {
    const a = mots![i - 1].finSec + 0.03;
    const b = mots![i].debutSec - 0.03;
    if (b - a >= 0.09) p.push([+a.toFixed(3), +b.toFixed(3)]);
  }
  return p;
}

/** Paramètres complets de la composition d'UN format d'image, selon la recette du format. */
export function parametresComposition(c: CommandeFabrication, e: EntreeComposition, recette: RecetteComposition): ParametresComposition {
  const ratio = e.ratio;
  const { largeur, hauteur } = DIMENSIONS_SCENE[ratio];
  const format = trouverFormat(c.formatId);
  // G6 : les réseaux cochés pour cette fabrication (union des zones pour les sous-titres) ; l'encadré et l'incrustation
  // d'appel d'une version suivent SON réseau (B.6.17).
  const reseaux: IdReseau[] = reseauxDeCommande(c, format?.reseauxConseilles ?? []);
  const reseauxCalques: IdReseau[] = reseauxDesCalques(c, format?.reseauxConseilles ?? []);
  const angles = c.recetteMontage?.angles ?? recette.angles;
  const fps = c.profilRendu?.export?.fps ?? format?.export?.fps ?? 25;
  const alertes: AlerteQualite[] = [];
  const entrees: Record<string, string> = {};

  // --- Décor, doubles, accessoire, contour ---
  const dec = decorScene(c, recette, e.pistesDepuisLook ? { angle: angles.principal, pisteDepuisLook: !!e.pistesDouble?.[angles.principal] } : undefined);
  Object.assign(entrees, dec.entrees);
  alertes.push(...dec.alertes);
  // G6b : prises filmées (« je lis ») : la vidéo est opaque et porte déjà la pièce ; ni micro dessiné ni liseré.
  const prisesFilmees = c.distribution[0]?.source === "rush" && !!e.pistesDepuisLook;
  // Lot R7e : avatar rendu sur un fond uni (repli, ou choix de Will) : piste opaque, ni liseré.
  const fondUni = c.distribution[0]?.source === "double" && !!e.doubleFondUni && !dec.lookReel;
  const opaque = !!dec.lookReel || prisesFilmees || fondUni;
  // Fond uni : le décor devient la MÊME couleur unie. En 4:5 / 1:1 la boîte du double, réduite et ancrée en bas, ne
  // couvre pas le cadre : sans cela, un rectangle gris se posait sur le décor (relecture R7e n° 4).
  const decor: DecorScene = fondUni ? { teinte: FOND_UNI_AVATAR, directionLumiere: dec.decor.directionLumiere, flouPx: 0, clair: false } : dec.decor;
  if (fondUni) delete entrees.decor;
  const principal = sourceDuDouble(c, angles.principal, "double-principal", e.pistesDouble?.[angles.principal], opaque);
  Object.assign(entrees, principal.entrees);
  const avecSecond = c.distribution[0]?.modeAngles === "deux-angles" && !!angles.second;
  const second = avecSecond && angles.second ? sourceDuDouble(c, angles.second, "double-second", e.pistesDouble?.[angles.second], opaque, e.tranchesDouble?.[angles.second]) : undefined;
  if (second) Object.assign(entrees, second.entrees);
  let accessoire: AccessoireScene | undefined;
  const acc = c.accessoires?.[0];
  const pos = acc?.valeur?.positionParAngle[angles.principal] ?? acc?.valeur?.positionParAngle.face;
  if (acc?.valeur && pos && !prisesFilmees) {
    const media = c.medias?.[acc.id];
    if (media) entrees.accessoire = media.cle;
    accessoire = { url: media ? ref("accessoire") : undefined, x: pos.x, y: pos.y, largeurPct: pos.largeurPct, flouPx: acc.valeur.flouPx };
  }

  // --- Plans ---
  const plans: PlanScene[] = e.plans.map((p) => {
    const cadrage = { valeur: p.cadrage.valeur ?? (p.cadrage.zoom > 1.05 ? ("poitrine" as const) : ("large" as const)), zoom: p.cadrage.zoom || 1, zoomFin: p.cadrage.zoomFin ?? p.cadrage.zoom ?? 1, pointX: p.cadrage.pointInteret.x, pointY: p.cadrage.pointInteret.y };
    const angle = second && p.angle === angles.second ? ("second" as const) : ("principal" as const);
    if (p.sourceImage === "illustration") {
      const media = p.illustration?.elementId ? c.medias?.[p.illustration.elementId] : undefined;
      if (media) {
        const nom = `illu-${p.ordre}`;
        entrees[nom] = media.cle;
        return { debutSec: p.debutSec, finSec: p.finSec, type: "illustration", angle, cadrage, illustration: { url: ref(nom), video: media.mime.startsWith("video") } };
      }
      alertes.push({ code: "defaut-visuel", gravite: "info", message: `Plan ${p.ordre} : l'illustration n'a pas de fichier, votre double la remplace.` });
    }
    return { debutSec: p.debutSec, finSec: p.finSec, type: "double", angle, cadrage };
  });
  // Mission H, brique multicaméra : source du visage plan par plan (absente : plans inchangés).
  let cameras: ProprietesImageComposition["cameras"];
  if (e.multicamera?.plans.length) {
    for (const angle of ["cote", "contre-plongee"] as const) {
      const cle = e.multicamera.sources[angle];
      if (!cle) continue;
      entrees[`camera-${angle}`] = cle;
      cameras = { ...cameras, [angle]: { type: "video", url: ref(`camera-${angle}`), transparent: !opaque } };
    }
    if (cameras) plans.splice(0, plans.length, ...poserPlansCamera(plans, e.multicamera));
  }
  // Brique motion : cartes plein écran (absentes : plans inchangés).
  if (e.cartesPleinEcran?.length) {
    const cartes = e.cartesPleinEcran.map((cp, i) => {
      entrees[`carte-pe-${i + 1}`] = cp.carteCle;
      return { debutSec: cp.debutSec, finSec: cp.finSec, entree: `carte-pe-${i + 1}` };
    });
    plans.splice(0, plans.length, ...poserCartesPleinEcran(plans, cartes));
  }
  // Facecam lot C : écrans partagés par passages (absents : plans inchangés).
  const hauteurHaut = Math.round((hauteur * (ratio === "9:16" ? 0.5 : 0.45)) / 2) * 2;
  if (e.ecransPartages?.length) {
    const passages = e.ecransPartages.map((ep, i) => {
      entrees[`carte-ep-${i + 1}`] = ep.carteCle;
      return { debutSec: ep.debutSec, finSec: ep.finSec, carte: ref(`carte-ep-${i + 1}`), sourceY: ep.sourceY, ...(ep.cote === "gauche" ? { cote: ep.cote, largeurCarte: ep.largeurCarte, sourceX: ep.sourceX } : {}) };
    });
    plans.splice(0, plans.length, ...poserEcransPartages(plans, passages, hauteurHaut));
  }
  // Facecam lot G : mises en page par passages (côté, vignette) ; absentes : plans inchangés.
  if (e.misesEnPage?.length) {
    const passages = e.misesEnPage.map((mp, i) => {
      entrees[`carte-mp-${i + 1}`] = mp.carteCle;
      return { debutSec: mp.debutSec, finSec: mp.finSec, carte: ref(`carte-mp-${i + 1}`), mode: mp.mode, cote: mp.cote, geometrie: mp.geometrie };
    });
    plans.splice(0, plans.length, ...poserMisesEnPage(plans, passages));
  }
  if (ratio !== "9:16" && !e.sourcePreCadree) {
    const flottant = plans.find((p) => p.type === "double" && !basDuDoubleAuBas(ratio, p, (p.debutSec + p.finSec) / 2, recette.reductionLarge));
    if (flottant) alertes.push({ code: "zone-protegee", gravite: "attention", message: `En ${ratio}, le bas du double ne touche pas le bas de l'image.` });
  }
  const images = Math.max(1, Math.round(e.dureeSec * fps));
  const image: ProprietesImageComposition = {
    ratio,
    largeur,
    hauteur,
    fps,
    images,
    decor,
    doubles: { principal: principal.source, second: second?.source },
    accessoire,
    // Look réel : la lumière est déjà dans la vidéo, aucun liseré ajouté.
    contour: dec.decor.teinteLumiere && !dec.lookReel && !prisesFilmees && !fondUni ? { couleur: dec.decor.teinteLumiere, cote: coteContour(dec.decor.directionLumiere) } : undefined,
    plans,
    reductionLarge: recette.reductionLarge,
  };
  const fondu = fonduDeFin({ dureeSec: e.dureeSec, dernierMotSec: e.mots?.at(-1)?.finSec, finEnBoucle: c.reglages?.finEnBoucle === true, maxSec: recette.fonduFinMaxSec });
  if (fondu) image.fonduFinSec = fondu;
  // Facecam lot C : paramètres FACULTATIFS, posés seulement quand ils sont demandés (sinon, paramètres identiques).
  if (e.sourcePreCadree) image.sourcePreCadree = true;
  if (e.source10bits) image.source10bits = true;
  if (cameras) image.cameras = cameras;

  // --- Texte : sous-titres (M2), encadré, incrustations ---
  const style = c.styles.sousTitres?.valeur;
  const base = c.sousTitres?.base ?? (style?.gabarit === "minimal" ? "minimal" : "karaoke");
  // Style « Encre » (tableau animé) : l'encre sur la page claire se lit sans ombre ni bandeau. Absent : inchangé.
  const encre = style?.encre;
  const regle = encre ? { mode: "normal" as const, facteurOmbre: 1 } : sousTitresSurDecor(c.styles.decor?.valeur);
  const segments = regle.mode === "bandeau" ? e.segments.map((s) => ({ ...s, style: "bandeau" as const })) : e.segments;
  // 4:5 et 1:1 : le double, réduit et ancré en bas, a le visage plus haut dans l'image ; à 48 %, la ligne tomberait
  // sur le visage. Elle descend sur la poitrine (réglé sur les captures du lot M4).
  const styleRatio0 = style && ratio !== "9:16" ? { ...style, positionPct: recette.centreSousTitres[ratio] ?? style.positionPct } : style;
  // Facecam lot C : ligne face caméra (55-72 %), seulement quand le moteur la donne.
  const styleRatio = e.positionSousTitresPct !== undefined && styleRatio0 ? { ...styleRatio0, positionPct: e.positionSousTitresPct } : styleRatio0;
  if (regle.mode !== "normal") alertes.push({ code: "debordement-sous-titres", gravite: "info", message: regle.mode === "bandeau" ? "Décor clair : sous-titres passés en bandeau pour rester lisibles." : "Décor clair : ombre des sous-titres renforcée." });

  // Encadré d'ouverture : son existence et ses instants d'abord (les incrustations et la ligne des sous-titres en
  // dépendent), sa position ensuite, sous les sous-titres RÉELLEMENT dessinés.
  const habillage = c.styles.habillage === null ? null : c.styles.habillage?.valeur;
  const encadreDef = c.profilRendu?.encadreOuverture ?? format?.accrocheVisuelle?.encadreOuverture;
  // G6 : le texte de l'encadré de la version (≤ 5 mots, complémentaire de la parole) prime sur celui des plans.
  const texteEncadre = c.encadreTexte?.trim() || (e.plans.find((p) => p.texteEcran?.style === "encadre")?.texteEcran?.texte ?? e.plans[0]?.texteEcran?.texte);
  const encadreActif = !!(encadreDef && habillage !== null && (habillage?.encadreOuverture ?? encadreDef) && texteEncadre?.trim());
  const instantsEncadre = encadreActif && encadreDef ? { de: habillage?.encadreOuverture?.de ?? encadreDef.de, a: habillage?.encadreOuverture?.a ?? encadreDef.a } : null;

  const texteSegments = Object.fromEntries(c.script.blocs.flatMap((b) => b.segments.map((s) => [s.id, s.texte])));
  const inc = placerIncrustations(e.plans, ratio, reseauxCalques, { encadreFinSec: instantsEncadre?.a, medias: c.medias, texteSegments, geometrie: recette.incrustations });
  Object.assign(entrees, inc.entrees);
  alertes.push(...inc.alertes);

  const plansPoitrine = ratio === "9:16" ? e.plans.filter((p) => p.sourceImage === "double" && (p.cadrage.valeur === "poitrine" || p.cadrage.zoom > 1.05)).map((p) => ({ debutSec: p.debutSec, finSec: p.finSec })) : undefined;
  // Un montant incrusté n'est pas écrit une seconde fois en sous-titre (même instant).
  // Facecam : un groupe qui répète le texte d'une carte affichée en même temps n'est pas écrit une seconde fois, et
  // aucun groupe n'est posé pendant une carte plein écran (il couvrait la dernière ligne du titre).
  const segmentsImage = masquerPendantCartesPleinEcran(masquerTextesAffiches(masquerMontantsDits(segments, inc.incrustations), e.textesAffiches), e.cartesPleinEcran);
  const avecSousTitres = c.briques["sous-titres"] !== false && c.styles.sousTitres !== null && segmentsImage.length > 0;
  // Facecam lot G : pendant un passage « côté », la ligne se tient dans la colonne de Will (même hauteur).
  const colonnesCote = (e.misesEnPage ?? []).filter((mp) => mp.mode === "cote" && mp.geometrie.cote).map((mp) => ({ debutSec: mp.debutSec, finSec: mp.finSec, centrePct: e.positionSousTitresPct ?? recette.centreSousTitres[ratio] ?? 60, colonne: { gauchePx: mp.geometrie.cote!.xPersonne, largeurPx: mp.geometrie.cote!.largeurPersonne } }));
  const jonctionsEcrans = e.ecransPartages?.length ? e.ecransPartages.map((ep) => ({ debutSec: ep.debutSec, finSec: ep.finSec, ...(ep.ligne ? { centrePct: ep.ligne.centrePct, ...(ep.ligne.colonne ? { colonne: ep.ligne.colonne } : {}) } : { centrePct: centreJonctionPct(hauteurHaut, hauteur) }) })) : undefined;
  const jonctions = jonctionsEcrans || colonnesCote.length ? [...(jonctionsEcrans ?? []), ...colonnesCote] : undefined;
  const calque = (ouverture?: DonneesCalque["ouverture"]): DonneesCalque | undefined =>
    avecSousTitres ? { ...donneesCalque({ segments: segmentsImage, base, ratio, reseaux, style: styleRatio, plansPoitrine, ...(encre ? { couleurs: { texte: encre.texte, accent: encre.accent ?? encre.texte, contour: encre.page } } : {}) }), facteurOmbre: regle.facteurOmbre, ...(encre ? { encre: true } : {}), ouverture, ...(jonctions ? { passagesJonction: jonctions } : {}), ...(e.passagesClairs?.length ? { passagesClairs: e.passagesClairs } : {}), ...(e.echelleSousTitres !== undefined ? { echelleTexte: e.echelleSousTitres } : {}), ...(e.glissementSousTitres === false ? { glissement: false as const } : {}), ...(e.bandeFondSousTitres ? { bandeFond: e.bandeFondSousTitres } : {}) } : undefined;
  let sousTitres = calque();

  // Encadré d'ouverture SOUS les sous-titres réellement dessinés (≥ 80 px), au-dessus de la zone protégée du bas
  // (B.2). Pendant ses 3 s, la ligne garde sa place (pas de descente sur la poitrine) ; si la place manque encore
  // (accent agrandi, format 1:1), la ligne des groupes de l'ouverture monte d'autant, jamais plus haut que la zone
  // haute. Défaut corrigé de la démonstration M4 : sous-titre et encadré se touchaient.
  let encadre: EncadreScene | undefined;
  if (encadreActif && encadreDef && instantsEncadre && texteEncadre) {
    const positions = positionsVerticales(ratio, reseaux, styleRatio?.positionPct ?? 48);
    let milieuPct = sousTitres?.positions.milieuPct ?? positions.milieuPct;
    const plancherPct = (sousTitres?.positions.hautPct ?? positions.hautPct) + 4;
    let r: ReturnType<typeof placerEncadre> | undefined;
    for (let essai = 0; essai < 3; essai++) {
      sousTitres = calque({ finSec: instantsEncadre.a, milieuPct });
      const sousTitresBasPx = sousTitres ? basSousTitres(sousTitres, instantsEncadre.de, instantsEncadre.a, fps) : null;
      r = placerEncadre(texteEncadre, ratio, reseauxCalques, { encadre: { ...encadreDef, ...instantsEncadre }, sousTitresCentrePct: milieuPct, tailleSousTitresPx: style?.taillePx ?? recette.tailleSousTitresPx, sousTitresBasPx });
      if (r.manquePx <= 0.5 || !sousTitres || milieuPct <= plancherPct + 1e-6) break;
      milieuPct = Math.max(plancherPct, milieuPct - ((r.manquePx + 1) / hauteur) * 100);
    }
    encadre = r!.encadre;
    alertes.push(...r!.alertes);
  }
  // E2E-1 n° 12 : l'objet incrusté (logo d'appel) se pose sous les sous-titres RÉELLEMENT dessinés, avec un écart
  // visible constant, et garde la même taille d'un réseau à l'autre.
  const calqueFinal = sousTitres;
  const incrustations = recalerObjets(inc.incrustations, ratio, reseauxCalques, { geometrie: recette.incrustations, basSousTitres: calqueFinal ? (de, a) => basSousTitres(calqueFinal, de, a, fps) : undefined });
  const texte: ProprietesTexteComposition = { ratio, largeur, hauteur, fps, images, encadre, incrustations, sousTitres };
  // G6 : la commande annonce l'union des zones des réseaux cochés ; la géométrie calculée doit la respecter.
  if (c.zonesProtegees && ratio === "9:16") {
    const calculee = zonesProtegeesUnion(reseaux, "9:16");
    if (calculee && !zoneAuMoins(calculee, c.zonesProtegees)) alertes.push({ code: "zone-protegee", gravite: "attention", message: "Les zones protégées annoncées sont plus strictes que celles des réseaux cochés." });
  }

  // --- Couleurs (calque 6) ---
  const luts: ParametresCouleurs["luts"] = [];
  const intensite = (c.styles.lut?.intensite ?? recette.lutIntensiteParDefaut) / 100;
  let n = 0;
  for (const [id, plages] of plagesDesLuts(c, e.plans, angles)) {
    const media = c.medias?.[id];
    if (!media) {
      alertes.push({ code: "defaut-visuel", gravite: "info", message: "Une LUT n'a pas de fichier : ces plans gardent leurs couleurs d'origine." });
      continue;
    }
    const nom = `lut-${++n}`;
    entrees[nom] = media.cle;
    luts.push({ entree: nom, intensite, plages });
  }
  // Facecam lot C : LUT du Look Will sur les B-roll (les plans de Will ont déjà le Look, passe image du lot B).
  if (e.lookBroll && c.briques.etalonnage !== false) {
    const plages = plagesLookBroll(plans);
    if (plages.length) {
      entrees["lut-look"] = e.lookBroll.lutCle;
      luts.push({ entree: "lut-look", intensite: e.lookBroll.intensite ?? 1, plages });
    }
  }
  const realisme = c.profilRealisme ?? c.profilRendu?.realisme;
  const couleurs: ParametresCouleurs = { luts: c.briques.etalonnage === false ? [] : luts, grainPct: realisme?.grainPct ?? recette.realisme.grainPct, grainTaillePx: recette.realisme.grainTaillePx, vignettePct: realisme?.vignettePct ?? recette.realisme.vignettePct };

  // --- Son ---
  const ps = c.styles.profilSon?.valeur;
  if (e.audioCle) entrees.voix = e.audioCle;
  const tonId = ps?.tonPieceId;
  const ton = tonId ? c.medias?.[tonId] : undefined;
  if (ton) entrees["ton-piece"] = ton.cle;
  const [tonMin, tonMax] = ps?.tonPieceDb ?? [-45, -40];
  const son: ParametresSon = {
    entreeVoix: "voix",
    entreeTonPiece: ton && c.briques.son !== false ? "ton-piece" : undefined,
    tonPieceDb: (tonMin + tonMax) / 2,
    lufs: ps?.niveauCibleLufs ?? -14,
    toleranceLufs: ps?.toleranceLufs ?? 1,
    creteVraieMaxDbtp: ps?.creteVraieMaxDbtp ?? -1.5,
    passeHautHz: ps?.passeHautHz ?? 80,
    seuilLraCompression: 3,
    ratioCompression: Math.min(3, ps?.ratioCompression ?? 3),
    pauses: pausesDesMots(e.mots),
    graine: hache(c.videoId) % 1000,
  };
  // Lot « bruitages » (02/10) : seulement les sons dont le fichier est dans la commande ; jamais si la brique son est
  // coupée. Aucun son : le champ reste absent (paramètres identiques à ceux d'avant le lot).
  const bruitages = c.briques.son === false ? [] : (e.bruitages ?? []).flatMap((b, i) => {
    const media = c.medias?.[b.elementId];
    if (!media) return [];
    const nom = `bruitage-${i + 1}`;
    entrees[nom] = media.cle;
    return [{ entree: nom, debutSec: b.debutSec, gainDb: b.gainDb, passeHautHz: REGLES_BRUITAGES.passeHautHz }];
  });
  if (bruitages.length) son.bruitages = bruitages;

  // --- Export (B.7) : 25 i/s, H.264 plafonné à 16 Mb/s ; lot M4b : CRF 17 en une passe (variante admise par B.7),
  // AAC 256 kb/s 48 kHz (l'encodeur AAC de FFmpeg ne dépasse pas ≈ 240 kb/s sur une voix en double mono) ---
  const ex = c.profilRendu?.export ?? format?.export;
  const min = ex?.debitMbpsMin ?? 12;
  const max = ex?.debitMbpsMax ?? 16;
  const exportP: ParametresExport = { fps, debitKbps: Math.round(((min + max) / 2) * 1000), debitMaxKbps: max * 1000, audioKbps: ex?.audio.kbps ?? 256, audioHz: ex?.audio.hz ?? 48000, mode: "crf", crf: 17 };
  if (e.source10bits) exportP.source10bits = true;
  if (recette.finPropre) exportP.finPropre = { ...recette.finPropre, dureeSec: e.dureeSec };
  if (recette.exportBordsSurs) Object.assign(exportP, { conversionRvbSure: true, mesurerBords: true, ...(e.instantsBords?.length ? { instantsBords: [...e.instantsBords] } : {}) });

  // 10/10 : garde-fou des couleurs — la prise étalonnée est une entrée de plus (lue à distance par studio-rendu).
  let controleCouleurs: ControleCouleurs | undefined;
  if (e.controleCouleurs?.paires.length && e.controleCouleurs.referenceCle) {
    entrees["reference-couleurs"] = e.controleCouleurs.referenceCle;
    controleCouleurs = { entree: "reference-couleurs", paires: e.controleCouleurs.paires };
  }

  return { ratio, image, texte, couleurs, son, export: exportP, entrees, alertes, ...(controleCouleurs ? { controleCouleurs } : {}) };
}
