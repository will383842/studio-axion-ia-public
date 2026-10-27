/**
 * RENDU RÉEL D'UNE VERSION « IMAGE → VIDÉO » sur le serveur de rendu EXISTANT, comme le cas concret (aucune opération
 * nouvelle) :
 *  1. SCÈNES : chaque bloc de la ligne de temps est rendu en MP4 par l'opération `composition` SANS mode (brique
 *     `motion`, `demandeRenduCarteMotion`), avec la composition du bloc et ses propriétés :
 *       écran v4 → `CasConcretEcran` (propriétés de la brique `ecrans-motion`, zone pleine image du cas concret) ;
 *       toile → `ImageVideoScene` ; objets → `ImageVideoObjets` ; moments → `ImageVideoMoments`.
 *     Clé PAR EMPREINTE (`cleSceneParEmpreinte`) : une scène déjà déposée n'est jamais rendue de nouveau.
 *  2. MONTAGE : UNE composition `complet` (brique commune `composition/montage`, celle des finitions du cas concret) :
 *     scènes bout à bout, piste VOIX SEULE (WAV) + bruitages validés mixés à −14 LUFS par le serveur, sous-titres mot à
 *     mot de la ligne de temps (mot fort en orange, encre sombre sur l'ivoire), VARIÉS par le mélange de la brique
 *     commune (Impact, Bandeau ; `sous-titres-varies.ts`), toujours dans la bande. Jamais de musique.
 *  3. MESURES : celles du serveur (volume, crête, taille, cadence…) ; les images noires et figées (Q24) et l'empreinte
 *     des octets sont mesurées sur le fichier final par FFmpeg LOCAL (comme la découpe de l'image), sans opération
 *     nouvelle ; FFmpeg absent : non mesurées (le contrôle le dit « non vérifié »).
 * SANS ÉTAT : chaque passage relit l'état des demandes au serveur (`suivreRendu` : soumise si inconnue) ; tant qu'une
 * pièce n'est pas finie, une ATTENTE (`RenduEnCoursIV`) rend la main. Le rendu n'a pas de coût par appel (serveur du
 * studio) : rien n'est réservé ici ; la caisse ne compte que les fournisseurs payants.
 * Un échec lève une phrase simple (le détail du serveur part dans `console.warn`) ; « Réessayer » (`essai` suivant)
 * soumet les pièces ratées sous un autre identifiant et reprend les scènes déjà déposées.
 * FORMAT (lot F45) : lu dans la ligne de temps (1080 × 1350 → 4:5, LinkedIn et fil Facebook ; sinon 9:16). En 4:5 :
 * toiles et écrans v4 rendus en 1080 × 1350 (écrans : zone utile au-dessus de la bande 4:5), montage au ratio 4:5,
 * sous-titres au centre de la bande 4:5. Le 9:16 est inchangé (mêmes propriétés, mêmes empreintes, même demande).
 * Aucun « server-only » : service et stockage sont injectés (tests : doubles).
 */
import { createHash } from "node:crypto";
import type { BruitagePlace } from "@/briques/intensite/types";
import { demandeComposition, type BaseComposition, type OutilsMontage } from "@/briques/composition/montage";
import type { RecetteComposition } from "@/briques/composition/recette";
import { commandeMinimale } from "@/briques/chaine-scenes/commande";
import { plansDesScenes, type ScenePosee } from "@/briques/chaine-scenes/plans";
import { cleSceneParEmpreinte, demandeRenduCarteMotion } from "@/briques/motion/rendu-cartes";
import type { CommandeFabrication, MediaCommande } from "@/domaine/types";
import { suivreRendu } from "@/fournisseurs/rendu/client";
import type { DemandeRendu, ServiceRendu } from "@/fournisseurs/types";
import { COMPOSITION_ECRAN, CRF_ECRAN, DECOR_NUIT, RECETTE_COMPOSITION_CAS_CONCRET } from "@/moteurs/montage-cas-concret/fabriquer";
import { dessinAuDessusDesSousTitres } from "@/moteurs/montage-cas-concret/zone-objets";
import { controlerProprietes, proprietesEcrans, type ProprietesEcran } from "@/briques/ecrans-motion";
import { ErreurRenduDefinitifIV, RenduEnCoursIV, VERSION_COMPOSITIONS_IV, type DemandeRenduIV } from "@/moteurs/montage-image-video/fabrication";
import type { BlocRenduIV, LigneDeTempsIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { LIGNES_MAX_ECRAN_IV, proprietesEcranIV916 } from "@/moteurs/montage-image-video/ecrans-v4";
import { BANDE_SOUS_TITRES_IV, ECRAN_IV, formatDeHauteurIV, MISE_EN_PAGE_IV, type FormatEcranIV } from "@/briques/schema-motion/types";
import { passagesIvoireIV, segmentsDeBaseIV, sousTitresVariesIV, STYLE_SOUS_TITRES_IV, surlignageSousTitresIV } from "@/moteurs/montage-image-video/sous-titres-varies";
import { figeHorsVoixMaxSec, type PassageFigeIV } from "@/moteurs/montage-image-video/commandes-ffmpeg";

/* ------------------------------------------------------------------ */
/* Réglages                                                              */
/* ------------------------------------------------------------------ */

/**
 * Compositions de production du format (inscrites dans `Racine.tsx`) ; les écrans v4 sont ceux du cas concret, sauf le
 * DERNIER quand la version a une queue animée : `ImageVideoEcranFin` (le même écran, trait de fin par-dessus).
 */
export const COMPOSITIONS_RENDU_IV = Object.freeze({ ecran: COMPOSITION_ECRAN, ecranFin: "ImageVideoEcranFin", toile: "ImageVideoScene", objets: "ImageVideoObjets", moments: "ImageVideoMoments", variete: "ImageVideoVariete" });
/** Qualité des scènes : celle des écrans du cas concret (quasi sans perte, réencodées une fois au montage). */
export const CRF_SCENE_IV = CRF_ECRAN;
const MOTEUR_IV = "montage-image-video";
const FORMAT_IV = "image-video";

/** Ratio d'une ligne de temps (lu dans sa hauteur : 1350 → 4:5 ; sinon 9:16, comme avant). */
export const ratioDeLaLigneIV = (ligne: Pick<LigneDeTempsIV, "hauteur">): FormatEcranIV => formatDeHauteurIV(ligne.hauteur);

/** Centre de la bande des sous-titres du format, en % de la hauteur (seule source : `BANDE_SOUS_TITRES_IV`). */
export const CENTRE_SOUS_TITRES_IV_PCT = +(((BANDE_SOUS_TITRES_IV.haut + BANDE_SOUS_TITRES_IV.bas) / 2) * 100).toFixed(2);
/** Centre de la bande 4:5 (y 1042 → 1176 sur 1350), en % de la hauteur (seule source : `MISE_EN_PAGE_IV`). */
export const CENTRE_SOUS_TITRES_IV_4X5_PCT = +(((MISE_EN_PAGE_IV["4:5"].bandeSousTitres.haut + MISE_EN_PAGE_IV["4:5"].bandeSousTitres.bas) / 2) * 100).toFixed(2);
/** Centre des sous-titres d'un format (% de la hauteur). */
export const centreSousTitresPct = (format: FormatEcranIV) => (format === "4:5" ? CENTRE_SOUS_TITRES_IV_4X5_PCT : CENTRE_SOUS_TITRES_IV_PCT);

/**
 * Recette de composition : celle du cas concret (teinte nuit, ni grain, ni vignette, ni LUT, bords sûrs), sous-titres
 * dans la bande du format, SANS fin propre (la fin du format est dans sa ligne de temps, contrôlée par Q19).
 */
export const RECETTE_COMPOSITION_IV: RecetteComposition = (() => {
  const { finPropre: _sansFinPropre, ...reste } = RECETTE_COMPOSITION_CAS_CONCRET;
  void _sansFinPropre;
  return { ...reste, id: FORMAT_IV, centreSousTitres: { "9:16": CENTRE_SOUS_TITRES_IV_PCT, "4:5": CENTRE_SOUS_TITRES_IV_PCT, "1:1": CENTRE_SOUS_TITRES_IV_PCT, "16:9": CENTRE_SOUS_TITRES_IV_PCT } };
})();

/** Recette du montage 4:5 : la même, sous-titres au centre de la bande 4:5 (celle du 9:16 reste octet pour octet). */
export const RECETTE_COMPOSITION_IV_4X5: RecetteComposition = { ...RECETTE_COMPOSITION_IV, centreSousTitres: { ...RECETTE_COMPOSITION_IV.centreSousTitres, "4:5": CENTRE_SOUS_TITRES_IV_4X5_PCT } };

/**
 * Zone « pleine image » des écrans v4 en 4:5 (% de 1080 × 1350) : sous la marque (y 120), côtés comme le 9:16 (40 px),
 * bas au haut de la zone utile 4:5 (y 1015, au-dessus de la bande des sous-titres) ; aucune bande propre à l'écran.
 */
const H45 = MISE_EN_PAGE_IV["4:5"].hauteur;
export const ZONE_ECRAN_IV_4X5 = Object.freeze({ haut: (120 / H45) * 100, droite: (40 / 1080) * 100, bas: (1 - MISE_EN_PAGE_IV["4:5"].zoneUtile.bas) * 100, gauche: (40 / 1080) * 100 });
/** Fil des étapes de l'écran 4:5 : juste sous la bande des sous-titres, au-dessus de la barre de lecture (y 1188). */
const BAS_FIL_IV_4X5 = 1188;

export const PHRASES_RENDU_IV = Object.freeze({
  scene: (quoi: string, n: number, total: number) => `Le rendu d'une scène de la vidéo ${quoi} n'a pas abouti (scène ${n} sur ${total}). Réessayez : les scènes déjà rendues sont gardées, rien n'est repayé.`,
  montage: (quoi: string) => `Le montage final de la vidéo ${quoi} n'a pas abouti. Réessayez : les scènes déjà rendues sont gardées, rien n'est repayé.`,
  attenteScenes: (quoi: string, faites: number, total: number) => `Le rendu des scènes ${quoi} (${faites} sur ${total} faites)`,
  attenteMontage: (quoi: string) => `Le montage final ${quoi}`,
  irrendable: (quoi: string, n: number) =>
    `La mise en scène de la vidéo ${quoi} a ${n} écran${n > 1 ? "s" : ""} trop chargé${n > 1 ? "s" : ""} pour la mise en page v4 : rien n'a été envoyé au rendu, la voix et le script sont gardés. Raccourcissez ${n > 1 ? "ces écrans" : "cet écran"} dans le script (« Refaire le script »).`,
});

/* ------------------------------------------------------------------ */
/* Pièces pures                                                          */
/* ------------------------------------------------------------------ */

const empreinte = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 32);
const arrondi = (x: number) => Math.round(x * 1000) / 1000;

/** Une scène à rendre : un bloc de la ligne de temps. */
export interface SceneIV {
  id: string;
  sorte: BlocRenduIV["sorte"];
  debutSec: number;
  finSec: number;
  parametres: { composition: string; proprietes: Record<string, unknown>; crf: number };
  empreinte: string;
  cle: string;
}

/**
 * Propriétés de la composition d'un bloc (PUR). Instants des blocs : depuis le début du bloc. La variété du bloc (s'il
 * en a une) passe telle quelle dans ses propriétés ; sans elle, rien ne change (mêmes empreintes, mêmes fichiers).
 * Le bloc qui finit la vidéo reçoit la queue animée de la ligne (`queue`, ramenée au début du bloc) : sa composition
 * dessine le trait de fin ; un écran v4 passe alors par `ImageVideoEcranFin`.
 */
export function parametresDuBloc(b: BlocRenduIV, ligne: Pick<LigneDeTempsIV, "largeur" | "hauteur" | "fps" | "repere"> & Partial<Pick<LigneDeTempsIV, "dureeSec" | "queue" | "affiche">>, premier = false): SceneIV["parametres"] {
  const p = parametresSansVariete(b, ligne);
  const avecVariete = b.variete ? { ...p, proprietes: { ...p.proprietes, variete: b.variete } } : p;
  const q = queueDuBloc(b, ligne);
  // Affiche : seulement le PREMIER bloc de la ligne (sa première image montre l'accroche écrite en entier).
  const a = premier && ligne.affiche ? ligne.affiche : null;
  if (!q && !a) return avecVariete;
  // Un écran v4 passe par `ImageVideoEcranFin` dès qu'il porte une queue ou une affiche (même écran, calques par-dessus).
  return {
    ...avecVariete,
    ...(b.sorte === "ecran" ? { composition: COMPOSITIONS_RENDU_IV.ecranFin } : {}),
    proprietes: { ...avecVariete.proprietes, ...(q ? { queue: q } : {}), ...(a ? { affiche: a } : {}) },
  };
}

/** Queue animée d'un bloc (secondes depuis son début) : seulement le bloc qui finit la vidéo et contient la queue. */
function queueDuBloc(b: BlocRenduIV, ligne: Partial<Pick<LigneDeTempsIV, "dureeSec" | "queue">>): { debutSec: number; finSec: number } | null {
  const q = ligne.queue;
  if (!q || ligne.dureeSec === undefined || b.fin < ligne.dureeSec - 1e-6 || q.finSec <= b.debut + 1e-6) return null;
  return { debutSec: arrondi(Math.max(0, q.debutSec - b.debut)), finSec: arrondi(q.finSec - b.debut) };
}

function parametresSansVariete(b: BlocRenduIV, ligne: Pick<LigneDeTempsIV, "largeur" | "hauteur" | "fps" | "repere">): SceneIV["parametres"] {
  const cadre = { largeur: ligne.largeur, hauteur: ligne.hauteur, fps: ligne.fps, dureeSec: arrondi(b.fin - b.debut) };
  switch (b.sorte) {
    case "ecran": {
      // Durée de la scène = place du bloc au montage (`fin − debut`, comme les autres sortes) : la mise en scène allonge
      // le dernier bloc jusqu'à la fin de la vidéo sans toucher `finMs` ; sans cela, fin noire ou figée.
      const ecran = { ...b.ecran, finMs: b.ecran.debutMs + Math.round((b.fin - b.debut) * 1000) };
      const p = ratioDeLaLigneIV(ligne) === "4:5" ? proprietesEcran4x5(ecran, ligne) : proprietesEcranIV916(ecran);
      return { composition: COMPOSITIONS_RENDU_IV.ecran, proprietes: p as unknown as Record<string, unknown>, crf: CRF_SCENE_IV };
    }
    case "toile":
      // 4:5 : la toile se rend dans le cadre de la ligne (la composition lit la mise en page du format dans sa hauteur).
      return { composition: COMPOSITIONS_RENDU_IV.toile, proprietes: { ...b.proprietes, ...(ratioDeLaLigneIV(ligne) === "4:5" ? { largeur: ligne.largeur, hauteur: ligne.hauteur } : {}) } as unknown as Record<string, unknown>, crf: CRF_SCENE_IV };
    case "objets":
      return { composition: COMPOSITIONS_RENDU_IV.objets, proprietes: { ...cadre, fond: b.fond, marque: "axion-ia.com", entetes: b.entetes, objets: b.objets }, crf: CRF_SCENE_IV };
    case "moments": {
      const repere = repereDuBloc(b, ligne);
      // Sans repère : `repere: null` explicite (Remotion fusionne les propriétés par défaut de la composition, qui en ont un).
      return { composition: COMPOSITIONS_RENDU_IV.moments, proprietes: { ...cadre, marque: "axion-ia.com", moments: b.moments, repere: repere ?? null }, crf: CRF_SCENE_IV };
    }
    case "variete": {
      // Un bloc `moments` devenu `variete` (bandeau de chiffres…) garde le repère « k/N » de sa place.
      const repere = repereDuBloc(b, ligne);
      return { composition: COMPOSITIONS_RENDU_IV.variete, proprietes: { ...cadre, marque: "axion-ia.com", bloc: { axe: b.axe, code: b.code, donnees: b.donnees }, ...(repere ? { repere } : {}) }, crf: CRF_SCENE_IV };
    }
  }
}

/** Repère « k/N » d'un bloc : ses changements ramenés au début du bloc, s'il en a un pendant le bloc. */
function repereDuBloc(b: BlocRenduIV, ligne: Pick<LigneDeTempsIV, "repere">) {
  const r = ligne.repere;
  const dans = r?.changements.some((c) => c.t >= b.debut - 1e-6 && c.t < b.fin) ?? false;
  return r && dans ? { changements: r.changements.map((c) => ({ ...c, t: arrondi(c.t - b.debut) })), total: r.total, ...(r.prefixe ? { prefixe: r.prefixe } : {}) } : undefined;
}

/** Écran v4 en 4:5 (PUR) : la brique des écrans dans le cadre 1080 × 1350, zone au-dessus de la bande des sous-titres. */
function proprietesEcran4x5(ecran: Extract<BlocRenduIV, { sorte: "ecran" }>["ecran"], ligne: Pick<LigneDeTempsIV, "largeur" | "hauteur">): ProprietesEcran {
  // 25/10 : la question de fin garde en 4:5 la taille de lettres du 9:16 (niveau « ligne » mesuré sur 1920, pas sur 1350 : ~30 px au lieu de 42).
  const ecranIV = ecran.type === "question" ? { ...ecran, hauteurLigneRef: ECRAN_IV.hauteur } : ecran;
  const brutes = proprietesEcrans({ ecrans: [ecranIV], captures: {}, zoneProtegee: { ...ZONE_ECRAN_IV_4X5 }, bandeSousTitres: 0, largeur: ligne.largeur, hauteur: ligne.hauteur });
  return dessinAuDessusDesSousTitres(brutes).map((e) => ({ ...e, basFil: BAS_FIL_IV_4X5 }))[0];
}

/** Les scènes d'une version (PUR) : une par bloc, clé par empreinte (même bloc = même fichier, rendu une seule fois). */
export function scenesDeLaLigne(ligne: LigneDeTempsIV, o: { env: string; videoId: string }): SceneIV[] {
  return ligne.blocs.map((b, rang) => {
    const parametres = parametresDuBloc(b, ligne, rang === 0);
    // Version de la clé : "/2" (18/10/2026) = fond ivoire des vues d'ensemble, pastille « 80 % » de REC-B (nouvelle place),
    // chute de l'alerte. Sans ce changement, une vidéo refaite réutiliserait ses anciennes scènes de toile (clé identique).
    // 23/10/2026 : VERSION_COMPOSITIONS_IV y entre aussi : une correction de studio-rendu/compositions/image-video (bulle du récit,
    // dossier seul…) ne change pas les propriétés d'une scène, donc sa clé restait la même et l'ancien dessin était réutilisé.
    const e = `iv-${empreinte(["scene-iv/2", VERSION_COMPOSITIONS_IV, parametres])}`;
    return { id: b.id, sorte: b.sorte, debutSec: b.debut, finSec: b.fin, parametres, empreinte: e, cle: cleSceneParEmpreinte(o.env, o.videoId, e) };
  });
}

/** Sous-titres de la ligne de temps → segments (mot fort = mot « en valeur », orange), sans style. PUR. */
export const segmentsSousTitresIV = segmentsDeBaseIV;

/** Passages sur fond ivoire : sous-titres à l'encre sombre de la v4 (comme le cas concret). PUR. */
export { passagesIvoireIV };

/** Lignes qu'un écran v4 sait montrer, par type : seule source dans le moteur (`ecrans-v4.ts`, lue aussi par L11). */
export { LIGNES_MAX_ECRAN_IV };

/**
 * Écrans v4 que la composition ne sait pas montrer tels quels (PUR) : trop de lignes pour leur type (le composant
 * casserait au rendu), ou le contrôle de la brique (`controlerProprietes`, celui du cas concret avant ses rendus). Une
 * phrase par écran, sans identifiant ; le détail part dans `console.warn`. Dernier filet : la mise en scène (L11)
 * découpe déjà un écran trop chargé avec la même règle.
 */
export function ecransIrrendables(scenes: readonly SceneIV[]): string[] {
  return ecransIrrendablesDetail(scenes).map((x) => x.phrase);
}

/** Les mêmes écrans irrendables avec l'identifiant de leur scène (bloc de la ligne de temps) : sert à les passer en texte seul. PUR. */
export function ecransIrrendablesDetail(scenes: readonly SceneIV[]): { id: string; phrase: string }[] {
  const irrendables: { id: string; phrase: string }[] = [];
  let rang = 0;
  for (const s of scenes) {
    if (s.sorte !== "ecran") continue;
    rang++;
    const p = s.parametres.proprietes as unknown as ProprietesEcran;
    const lignes = "lignes" in p && Array.isArray(p.lignes) ? p.lignes.length : 0;
    const max = LIGNES_MAX_ECRAN_IV[p.type];
    // Un chiffre sans unité (« au lieu de 45 ») a sa boîte d'unité vide : le composant ne dessine rien, ce n'est pas un écran irrendable
    // (27/10/2026, vidéo v-218d8e98ceef arrêtée en IV_PANNE pour « texte vide (unite) »).
    const defauts = controlerProprietes(p).filter((d) => !/· texte vide \(unite\)\./.test(d));
    if (max !== undefined && lignes > max) irrendables.push({ id: s.id, phrase: `écran n° ${rang} : ${lignes} lignes de texte, ${max} au plus pour ce genre d'écran.` });
    else if (defauts.length) irrendables.push({ id: s.id, phrase: `écran n° ${rang} : un texte ne tient pas à sa place.` });
    if (defauts.length || (max !== undefined && lignes > max)) console.warn(`[image-video] écran ${s.id} irrendable : ${[`${p.type} de ${lignes} ligne(s)`, ...defauts].join(" ; ")}`);
  }
  return irrendables;
}

/** Une version dite pour Will : « pour TikTok, YouTube Shorts ». */
const pourQui = (reseaux: readonly string[]) => `pour ${reseaux.join(", ")}`;

/* ------------------------------------------------------------------ */
/* Le rendu                                                              */
/* ------------------------------------------------------------------ */

/** Un son validé (banque des bruitages) : sa clé de stockage, pour les médias de la composition. */
export interface SonValideIV {
  elementId: string;
  cle: string;
  mime: string;
  dureeSec: number;
}

/** Mesures prises sur le fichier final (FFmpeg local) ; absentes : non mesurées. */
export interface MesuresLocalesIV {
  empreinte?: string;
  noirMaxSec?: number;
  figeMaxSec?: number;
  /** Passages figés (début, durée) : jugés avec la voix de la ligne (`figeHorsVoixMaxSec`). */
  figes?: PassageFigeIV[];
}

export interface OutilsRenduIV {
  rendu: ServiceRendu;
  /** `prod` ou `dev` (clés de stockage). */
  env: string;
  signerLecture: (cle: string) => Promise<string>;
  signerDepot: (cle: string, mime: string) => Promise<string>;
  /** Le fichier est-il déjà déposé ? (scènes : rien n'est rendu deux fois.) */
  existe: (cle: string) => Promise<boolean>;
  /** Sons validés (clés et durées) ; seuls ceux posés par la ligne de temps sont lus. */
  sons: readonly SonValideIV[];
  /** Mesures locales du fichier final (défaut : aucune). */
  mesurer?: (cle: string, dureeSec: number) => Promise<MesuresLocalesIV>;
}

/** Erreur de rendu : une phrase simple pour Will (jamais le message du serveur). */
export class ErreurRenduIV extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurRenduIV";
  }
}

/** Commande minimale de la composition finale d'une version (PUR). */
export function commandeDuMontageIV(d: Pick<DemandeRenduIV, "videoId" | "ligne" | "mixage" | "piste">, scenes: readonly ScenePosee[], sons: readonly SonValideIV[]): CommandeFabrication {
  const format = ratioDeLaLigneIV(d.ligne);
  const style = { id: "sous-titres-duo", nom: "Charte duo", valeur: { ...STYLE_SOUS_TITRES_IV, ...(format === "4:5" ? { positionPct: CENTRE_SOUS_TITRES_IV_4X5_PCT } : {}), ...surlignageSousTitresIV(d.ligne) } };
  const c = commandeMinimale({
    moteurId: MOTEUR_IV,
    formatId: FORMAT_IV,
    versionFormat: 1,
    videoId: d.videoId,
    texteScript: d.piste.mots.map((m) => m.mot).join(" "),
    dureeSec: d.ligne.dureeSec,
    scenes,
    styleSousTitres: style,
    decor: { id: "teinte-nuit", nom: "Nuit de la charte", valeur: DECOR_NUIT },
  });
  const poses = new Set(d.mixage.bruitages.map((b: BruitagePlace) => b.elementId));
  const medias: Record<string, MediaCommande> = Object.fromEntries(sons.filter((s) => poses.has(s.elementId)).map((s) => [s.elementId, { cle: s.cle, mime: s.mime, dureeSec: s.dureeSec }]));
  return { ...c, medias: { ...c.medias, ...medias } };
}

/** Base de la composition finale : scènes bout à bout, voix seule, bruitages, sous-titres VARIÉS dans la bande (PUR). */
export function baseDuMontageIV(d: Pick<DemandeRenduIV, "ligne" | "mixage" | "piste">, scenes: readonly ScenePosee[]): BaseComposition {
  const clairs = passagesIvoireIV(d.ligne);
  return {
    plans: plansDesScenes(scenes),
    segments: sousTitresVariesIV(d.ligne),
    dureeSec: d.ligne.dureeSec,
    mots: d.piste.mots.map((m) => ({ ...m })),
    audioCle: d.mixage.voix.cle,
    // Jamais montée (les scènes couvrent toute la durée) : garde le chemin rapide du rendu, comme le cas concret.
    pistesDouble: { face: scenes[0]?.cle ?? "" },
    supplements: { positionSousTitresPct: centreSousTitresPct(ratioDeLaLigneIV(d.ligne)), ...(clairs.length ? { passagesClairs: clairs } : {}) },
    ...(d.mixage.bruitages.length ? { bruitages: [...d.mixage.bruitages] } : {}),
  };
}

/** Outils de la brique « composition » : service, adresses signées, clés des sorties de la vidéo. */
function outilsMontageIV(o: Pick<OutilsRenduIV, "rendu" | "env" | "signerLecture" | "signerDepot">, videoId: string, format: FormatEcranIV = "9:16"): OutilsMontage {
  return {
    rendu: () => o.rendu,
    signer: async (lectures, depots) => ({
      lectures: Object.fromEntries(await Promise.all(Object.entries(lectures).map(async ([n, cle]) => [n, await o.signerLecture(cle)] as const))),
      depots: Object.fromEntries(await Promise.all(depots.map(async (x) => [x.cle, await o.signerDepot(x.cle, x.mime)] as const))),
    }),
    cle: (_c, nom) => `studio/${o.env}/videos/${videoId}/${nom}`,
    recette: format === "4:5" ? RECETTE_COMPOSITION_IV_4X5 : RECETTE_COMPOSITION_IV,
  };
}

/**
 * Un passage du rendu d'une version (voir l'en-tête). Fini : le fichier final, sa durée et ses mesures ; pas fini :
 * `RenduEnCoursIV` ; raté : `ErreurRenduIV` (phrase simple).
 */
export async function rendreVersionIV(d: DemandeRenduIV, o: OutilsRenduIV): Promise<{ cle: string; empreinte?: string; dureeSec: number; mesures: Record<string, number> }> {
  const essai = Math.max(0, (d.essai ?? 1) - 1);
  const quoi = pourQui(d.reseaux);
  const scenes = scenesDeLaLigne(d.ligne, { env: o.env, videoId: d.videoId });
  // 0. Un écran que la composition ne sait pas montrer : refus AVANT tout envoi (relancer donnerait le même refus).
  const irrendables = ecransIrrendablesDetail(scenes);
  if (irrendables.length) throw new ErreurRenduDefinitifIV(PHRASES_RENDU_IV.irrendable(quoi, irrendables.length), irrendables.map((x) => x.phrase), irrendables.map((x) => x.id));

  // 1. Scènes : déposées → faites ; sinon relues (soumises si le serveur ne les connaît pas).
  let faites = 0;
  for (const [k, s] of scenes.entries()) {
    if (await o.existe(s.cle)) {
      faites++;
      continue;
    }
    const demande = demandeRenduCarteMotion(s.cle, s.parametres as never, await o.signerDepot(s.cle, "video/mp4"), essai);
    const e = await suivreRendu(o.rendu, demande);
    if (e.statut === "termine") faites++;
    else if (e.statut === "echec") {
      console.warn(`[image-video] scène ${s.id} (${s.sorte}) ratée : ${e.erreur.message}`);
      throw new ErreurRenduIV(PHRASES_RENDU_IV.scene(quoi, k + 1, scenes.length));
    }
  }
  if (faites < scenes.length) throw new RenduEnCoursIV(PHRASES_RENDU_IV.attenteScenes(quoi, faites, scenes.length));

  // 2. Montage final : une composition `complet` (son, sous-titres, export).
  const posees: ScenePosee[] = scenes.map((s) => ({ id: s.id, debutSec: s.debutSec, finSec: s.finSec, cle: s.cle }));
  const commande = commandeDuMontageIV(d, posees, o.sons);
  const ratio = ratioDeLaLigneIV(d.ligne);
  const outilsMontage = outilsMontageIV(o, d.videoId, ratio);
  const { demande } = await demandeComposition(commande, ratio, baseDuMontageIV(d, posees), "complet", d.id, outilsMontage, essai);
  const e = await suivreRendu(o.rendu, demande);
  if (e.statut === "echec") {
    console.warn(`[image-video] montage ${d.version} raté : ${e.erreur.message}`);
    throw new ErreurRenduIV(PHRASES_RENDU_IV.montage(quoi));
  }
  if (e.statut !== "termine") throw new RenduEnCoursIV(PHRASES_RENDU_IV.attenteMontage(quoi));

  // 3. Mesures : celles du serveur, plus les mesures locales du fichier final.
  const serveur = e.mesures ?? {};
  const dureeSec = typeof serveur.dureeSec === "number" && serveur.dureeSec > 0 ? serveur.dureeSec : d.ligne.dureeSec;
  const locales = o.mesurer ? await o.mesurer(e.sortieCle, dureeSec).catch((err: unknown) => (console.warn(`[image-video] mesures locales impossibles : ${err instanceof Error ? err.message : String(err)}`), {} as MesuresLocalesIV)) : {};
  const mesures: Record<string, number> = { ...serveur };
  if (typeof locales.noirMaxSec === "number") mesures.noirMaxSec = locales.noirMaxSec;
  if (typeof locales.figeMaxSec === "number") mesures.figeMaxSec = locales.figeMaxSec;
  if (locales.figes) mesures.figeHorsVoixMaxSec = figeHorsVoixMaxSec(locales.figes, parolesDeLaLigneIV(d.ligne));
  return { cle: e.sortieCle, ...(locales.empreinte ? { empreinte: locales.empreinte } : {}), dureeSec, mesures };
}

/** Demande de la composition finale d'une version, telle que le rendu la soumet (tests, diagnostic). */
export async function demandeMontageIV(d: DemandeRenduIV, o: Pick<OutilsRenduIV, "rendu" | "env" | "signerLecture" | "signerDepot" | "sons">): Promise<DemandeRendu> {
  const scenes = scenesDeLaLigne(d.ligne, { env: o.env, videoId: d.videoId }).map((s) => ({ id: s.id, debutSec: s.debutSec, finSec: s.finSec, cle: s.cle }));
  const ratio = ratioDeLaLigneIV(d.ligne);
  const outilsMontage = outilsMontageIV(o, d.videoId, ratio);
  return (await demandeComposition(commandeDuMontageIV(d, scenes, o.sons), ratio, baseDuMontageIV(d, scenes), "complet", d.id, outilsMontage, Math.max(0, (d.essai ?? 1) - 1))).demande;
}

/* ------------------------------------------------------------------ */
/* Mesures locales (FFmpeg)                                              */
/* ------------------------------------------------------------------ */

/** Arguments et lecture du journal : module pur `commandes-ffmpeg` (copié dans l'image du studio, exécuté avant mise en ligne). */
export { argumentsNoirEtFige, lireNoirEtFige, lirePassagesFiges } from "@/moteurs/montage-image-video/commandes-ffmpeg";

/** Les mots dits d'une ligne de temps (ceux des sous-titres, calés sur la voix) : ce qui « parle » pour l'image figée. */
export function parolesDeLaLigneIV(ligne: Pick<LigneDeTempsIV, "sousTitres">): { debutSec: number; finSec: number }[] {
  return ligne.sousTitres.groupes.flatMap((g) => g.mots.map((m) => ({ debutSec: m.debutSec, finSec: m.finSec })));
}
