/**
 * CHAÎNE VIDÉO DU FACE CAMÉRA (plan facecam v4, lot B). Machine à états avancée à chaque tour de la boucle de fond
 * (`avancer` du moteur) : jamais d'attente longue, chaque tour interroge les travaux soumis au `studio-aligneur` et
 * soumet les suivants dès que leurs entrées sont prêtes. L'état ne garde que des CLÉS R2, des identifiants de
 * travail et de petits résultats (coupes, plans) : jamais les mots, les points ni les images.
 *
 * Ordre (v4, mission du lot B) :
 *   1. transcription au mot de toute la prise (`/transcrire`) et points du visage (`/visages`), soumis ensemble ;
 *   2. consignes « Monteur, … » repérées AVANT les coupes (brique `coupes`), puis coupes : texte validé (dernière
 *      occurrence complète de chaque phrase) ou vidéo libre ;
 *   3. son monté (`/son` : DeepFilterNet à 85 %, fondus à chaque coupe, ton de pièce, −14 LUFS) ;
 *   4. réalisation (brique `realisation` : cadre fixe, tailles, punch-ins, rythme Équilibré, grammaire) ;
 *   5. passe image 10 bits avec le Look Will (`/image`, étape « passe ») sur la bande utile ;
 *   6. piste montée pré-cadrée + contrôles machine (`/image`, étape « cadrage ») : noirs, images figées, image isolée,
 *      niveau sonore, synchro son-image ; bruit du visage ≤ original (mesuré par la passe).
 * Raccords du lot E (dépendances facultatives : absentes, la chaîne du lot B est inchangée) :
 *   - agent monteur (lot D) une fois les coupes posées : consignes « Monteur, … », demandes écrites, habitudes ;
 *   - Décor IA (lot E1) après la passe image, avant le cadrage : option coupée par défaut (étape ignorée) ;
 *   - habillage (lot C) après la piste montée : cartes rendues (opération `composition` sans mode), puis composition
 *     finale (sous-titres calés, écrans partagés, cartes plein écran, export 8 bits unique) dans `studio-rendu`.
 * Règle de panne (v4 n° 24) : une brique ratée n'empêche jamais la livraison — transcription ratée : aucune coupe ;
 * visages ratés : cadre centré ; passe image ratée : la prise est recadrée telle quelle (préparée). Seuls le son et
 * le montage final sont indispensables (une vidéo sans son n'est pas livrable) : leur échec est réessayable.
 */
import type { AlerteQualite, CommandeFabrication, MotHorodate, SegmentSousTitres } from "@/domaine/types";
import { lireEntreesFacecam, type CoupeFacecam, type EntreesFacecam } from "@/domaine/facecam";
import type { DemandeFacecam, EtatTravailFacecam, FournisseurFacecam, RouteFacecam } from "@/fournisseurs/facecam/client";
import { appliquerRecalages, calculerCoupes, controlerCoupes, motsDuMontage, resumeCoupes, texteDesSousTitres, versConsignesFacecam, type ConsigneReperee, type Intervalle, type RecalageMot } from "@/briques/coupes";
import { appliquerZooms, controlerRealisation, realiser, type PisteVisage, type PlanCamera } from "@/briques/realisation";
import type { FournisseurAlignement } from "@/fournisseurs/types";
import { appliquerAlignement, demandeAlignement } from "@/briques/calage/alignement";
import { horodaterMotsPrononces } from "@/briques/calage/report";
import { avancerDeclinaisons, avancerHabillagesFormats, bandeAvecDeclinaisons, declinaisonsFinies, habillagesFormatsRegles, preparerDeclinaisons, preparerHabillagesFormats, type EtatDeclinaisons } from "./declinaisons";
import { avancerCompositions, type BaseComposition, type EtatMontage, type OutilsMontage } from "@/briques/composition/montage";
import { ErreurRendu, suivreRendu } from "@/fournisseurs/rendu/client";
import type { DemandeRendu } from "@/fournisseurs/types";
import { multicameraPourComposition, type PisteMulticamera } from "@/briques/multicamera";
import { corrigerMots, habillageFacecam, type CartePosee, type HabillageFacecam } from "./habillage";
import { ajustementsAuMontage, priseVersMonteeGardes, type AjustementCarteAutoMonte, type CarteAutoVue } from "./cartes-video";
import { cartePosee, demandeRenduCarte, type CarteMonteur } from "./raccords";
import type { CodeCarte } from "./monteur/operations";
// Lot I : effets spéciaux du lot F3 branchés dans l'habillage.
import { avancerEffetsChaine, bruitagesDemandes, commandeAvecVerre, effetsDesPassages, preparerEffetsChaine, type EffetChaine, type ImageRvb } from "./effets-chaine";
import type { CarteAutoFacecam, PassageFacecam } from "@/domaine/facecam";
import { lireReglagesMonteur } from "./monteur/appliquer";
import { coupesActives } from "./monteur/temps";
import { aSoumettre, apresSoumission, prochaineSoumission, sansReprise, suiviSansEssai } from "./reprise";
import { empreinte, etatPourRetouche, gardesDepuisCoupes, partiesARefaire, repriseDeLaChaine, signatureMontage, VERSION_CONTROLES } from "./retouche";
import { instantsDeControle, type InstantControle } from "./relecture";
import { cartesDesPassages as cartesDe } from "./raccords";
import type { PassageMonteur } from "./monteur/appliquer";
import { MESSAGE_EFFET_RATE, planAvecEffets, plansLargesPendant, selonEffetsRealistes, type EffetRealistePrepare, type ResultatEffetRealiste } from "@/briques/effet-realiste";
import { effetDuPassage } from "./monteur/effet-realiste";
import type { ControleCouleurs } from "@/briques/composition/scene";
import { couleursBloquent, MESSAGE_COULEURS, pairesCouleurs } from "./garde-couleurs";

export const VERSION_CHAINE_FACECAM = "chaine-facecam-1";

/** Une étape de la chaîne : un travail du `studio-aligneur`. */
export type CleTravailChaine = "transcrire" | "visages" | "son" | "passe" | "cadrage" | "controle";
const ROUTE: Record<CleTravailChaine, RouteFacecam> = { transcrire: "transcrire", visages: "visages", son: "son", passe: "image", cadrage: "image", controle: "image" };

export interface SuiviTravail {
  id: string;
  statut: "soumis" | "termine" | "echec";
  progression?: number;
  /** Petit résultat (clés, mesures) ; jamais de données lourdes. */
  resultat?: Record<string, unknown>;
  erreur?: { code: string; message: string; reessayable: boolean };
  essais: number;
  /** Vérif V5 : conteneur sans réponse depuis cet instant (ms) ; aucun essai consommé pendant 30 min (`reprise.ts`). */
  injoignableDepuis?: number;
  /** Vérif V5 : la prochaine soumission garde l'identifiant et le nombre d'essais (la précédente n'a pas eu lieu). */
  memeId?: boolean;
  /** Vérif V5 : resoumissions après un 404 (conteneur recréé sans ses travaux), 3 au plus. */
  relances?: number;
}

export interface EtatChaine {
  version: string;
  travaux: Partial<Record<CleTravailChaine, SuiviTravail>>;
  coupes?: {
    mode: "texte" | "libre";
    texteNonRetrouve: boolean;
    liste: CoupeFacecam[];
    gardes: Intervalle[];
    consignes: ConsigneReperee[];
    dureeSourceSec: number;
    dureeSortieSec: number;
    resume: string;
    phrasesManquantes: number[];
    /** (10/10) Phrases du texte dites autrement, gardées au montage : sous-titrées d'après la parole, jamais bloquantes. */
    phrasesDitesAutrement?: number[];
    /** V6 : suites de mots entendues deux fois dans le montage (contrôle « aucune phrase en double »). */
    phrasesEnDouble?: { texte: string; debutSec: number }[];
    /**
     * Mode texte : les phrases du texte validé gardées dans le montage, dans l'ordre (le texte que l'on cale) ; une
     * phrase dite autrement y est remplacée par les mots dits (10/10 : avant, elle manquait et laissait un trou).
     */
    texteMonte?: string;
    /** Mode texte : mots recalés sur la prise complète d'une reprise absorbée par l'alignement forcé (10/10). */
    recalages?: RecalageMot[];
    /** Vérif V2 : transcription RECALÉE déposée sur R2 (reprise absorbée), livrée à la vidéo à la place de l'originale. */
    transcriptionCle?: string;
  };
  plans?: PlanCamera[];
  /**
   * Mots de la vidéo MONTÉE (temps du montage) pour les sous-titres et l'agent monteur : le texte validé calé sur le son
   * monté par l'aligneur existant, sinon les mots de la transcription remis sur le temps du montage.
   */
  mots?: { statut: "soumis" | "fait"; id?: string; essais: number; cle?: string; source?: "aligneur" | "transcription" | "texte"; nombre?: number };
  /**
   * Lot D : cartes posées par l'agent monteur (temps du montage ; le code sur mesure reste sur R2). Lot G : `entrees`
   * = `facecam` et `facecamMonteur` rendus par le monteur à la fabrication (gardés sur la version).
   */
  monteur?: { statut: "fait"; cartes: CarteMonteur[]; entrees?: Record<string, unknown>; /** Lot I : passages d'effets spéciaux (drapeaux d'échec à jour). */ effets?: PassageFacecam[] };
  /** Lot E1 : Décor IA (`ignore` : option coupée). Le plan (morceaux sur R2) est donné au cadrage s'il est appliqué. */
  decor?: { statut: "ignore" | "applique" | "repli"; message?: string; plan?: Record<string, unknown> };
  /**
   * Lot K : effets réalistes par IA (Higgsfield, payants, confirmés) : résultats par effet. Les réussis entrent dans le
   * plan du cadrage (morceaux `effet`) ; les passages liés (vitre brisée / objet 3D) sont filtrés d'après eux.
   */
  effetsRealistes?: { resultats: ResultatEffetRealiste[] };
  /** Lot C : cartes rendues puis composition finale dans `studio-rendu`. */
  habillage?: EtatHabillage;
  /** Mission H (facultatif) : piste multicaméra (brique commune `multicamera`). Absent : une seule caméra. */
  multicamera?: { statut: "fait"; piste?: PisteMulticamera };
  /** Briques ratées, livrées sans elles (« 1 élément non fait — Réessayer »). */
  sauts: { brique: string; message: string }[];
  fini?: boolean;
  /** Échec bloquant (son ou montage final), réessayable. */
  /** 10/10 : `export` = composition finale refusée par le garde-fou des couleurs (jamais livrée). */
  echec?: { brique: CleTravailChaine | "export"; message: string; reessayable: boolean };
  /** Lot G (retouche) : vérifier, une fois les plans refaits, que la passe image reprise couvre encore les cadres. */
  verifierBande?: boolean;
  /** Lot G (retouche) : cartes déjà rendues par une version d'avant (empreinte des paramètres → clé R2), reprises. */
  cartesReprises?: { empreinte: string; cle: string }[];
  /**
   * Lot G : relecture Claude ciblée de la vidéo finie (B.24) — images extraites, UN appel, 1 correction au plus
   * appliquée par la retouche (`entrees` corrigées), jamais de seconde relecture.
   */
  relecture?: { statut: "images" | "faite" | "ignoree"; instants?: InstantControle[]; defauts?: { elementId: string | null; defaut: string; detail: string }[]; correction?: string | null; entrees?: Record<string, unknown> };
  /** Lot G : tour de la chaîne (une correction de la relecture refait des étapes : nouveaux identifiants de travail). */
  tour?: number;
  /** Lot G : sous-titres corrigés par Will (onglet Sous-titres, « Appliquer à la vidéo ») : posés tels quels. */
  sousTitres?: SegmentSousTitres[];
  /** Lot F1 (facultatif) : déclinaisons 4:5, 1:1, 16:9. Absent : 9:16 seul, comme avant. */
  declinaisons?: EtatDeclinaisons;
  /** Vérif V2 : tours de suite où `studio-rendu` n'a pas répondu (redémarrage) ; absent dès qu'il répond. */
  renduInjoignable?: number;
}

export interface EtatHabillage {
  cartes: { id: string; demande: DemandeRendu; statut: "soumise" | "faite" | "echec"; essais: number }[];
  /** Entrée de la composition (calculée une fois : mots montés, sous-titres, cartes) ; les cartes ratées en sont retirées. */
  base: BaseComposition;
  composition?: EtatMontage;
  /** Sortie finale (vidéo 8 bits, master, vignette) ; absente tant que la composition n'est pas faite. */
  sortie?: { fichierCle: string; masterCle?: string; vignetteCle: string; alertes: AlerteQualite[]; mesures?: Record<string, number> };
  /** Habillage abandonné (panne définitive) : la piste montée est livrée sans lui. */
  abandonne?: boolean;
  /**
   * 10/10 : cartes automatiques (vue de chacune, fiche « Cartes et effets ») et gestes de Will résolus en temps du
   * montage, avec les retraits du chat (formats ajoutés après coup).
   */
  cartesAutoFiche?: { vues: CarteAutoVue[]; ajustements: AjustementCarteAutoMonte[]; retirees?: string[] };
  /** Lot I : effets spéciaux rendus avant la composition (posés comme des cartes plein écran). */
  effets?: EffetChaine[];
  /** Vérif V1 : cartes automatiques posées (livrées dans `entrees.facecam.cartesAuto`, vues par le monteur du chat). */
  cartesAuto?: CarteAutoFacecam[];
}

/** Lot G : fenêtre 9:16 du décor dans la SOURCE (px) : le passage extrait, retouché puis reposé à cette taille. */
export interface FenetreDecor {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

/** Fenêtre 9:16 pleine hauteur centrée sur la médiane des cadres (tous les plans y tiennent au mieux). */
export function fenetreDecor(plans: PlanCamera[], source: { largeur: number; hauteur: number }): FenetreDecor {
  const largeur = 2 * Math.floor(Math.min(source.largeur, Math.round((source.hauteur * 9) / 16)) / 2);
  const centres = plans.map((p) => p.cadre.x + p.cadre.largeur / 2).sort((a, b) => a - b);
  const milieu = centres.length ? centres[Math.floor(centres.length / 2)] : source.largeur / 2;
  const x = 2 * Math.floor(Math.min(Math.max(0, milieu - largeur / 2), source.largeur - largeur) / 2);
  return { x, y: 0, largeur, hauteur: 2 * Math.floor(source.hauteur / 2) };
}

/**
 * Décor appliqué : zooms limités à `zoomMax` (110 %) — un cadre plus serré est élargi autour de son centre, et chaque
 * cadre reste dans la fenêtre du décor (le passage retouché ne couvre qu'elle).
 */
export function plansSousDecor(plans: PlanCamera[], fenetre: FenetreDecor, zoomMax = 1.1): PlanCamera[] {
  const largeurMin = fenetre.largeur / zoomMax;
  return plans.map((p) => {
    const c = p.cadre;
    const largeur = Math.min(fenetre.largeur, Math.max(c.largeur, largeurMin));
    const hauteur = Math.min(fenetre.hauteur, (largeur * c.hauteur) / c.largeur);
    const cx = c.x + c.largeur / 2;
    const cy = c.y + c.hauteur / 2;
    const x = Math.min(Math.max(fenetre.x, cx - largeur / 2), fenetre.x + fenetre.largeur - largeur);
    const y = Math.min(Math.max(fenetre.y, cy - hauteur / 2), fenetre.y + fenetre.hauteur - hauteur);
    const pair = (v: number) => 2 * Math.round(v / 2);
    return { ...p, cadre: { ...c, x: pair(x), y: pair(y), largeur: pair(largeur), hauteur: pair(hauteur) } };
  });
}

/** Décor IA vu par la chaîne (lot E1) : `null` = option coupée, étape ignorée. */
export interface ResultatDecorChaine {
  applique: boolean;
  /** Phrase pour Will (sans montant). */
  message: string;
  /** Plan du décor (morceaux sur R2, filtre de retour à 25 i/s, zoom maximal), donné au cadrage. */
  plan?: Record<string, unknown>;
}

export interface DependancesChaine {
  facecam: FournisseurFacecam;
  /** Adresse signée de lecture d'une clé R2 (réel) ; ignorée en simulation. */
  urlLecture?: (cle: string) => Promise<string>;
  /** Adresse signée de dépôt (PUT) d'une clé R2 (réel) ; ignorée en simulation. */
  urlDepot?: (cle: string, mime: string) => Promise<string>;
  /** Lit un json.gz déposé sur R2 (piste du visage, transcription) ; absent ou en panne : `null`. */
  lireJsonGz?: (cle: string) => Promise<unknown>;
  /** Glossaire maison donné à Whisper (Axion-IA, Certifexemple, OPCO, noms propres…). */
  glossaire?: string[];
  /** Aligneur existant (`/alignements`) pour caler le texte validé sur le son monté ; absent : horodatage de Whisper. */
  alignement?: FournisseurAlignement;
  /** Dépose un json.gz sur R2 (mots montés) ; absent : rien n'est déposé (simulation). */
  ecrireJsonGz?: (cle: string, donnees: unknown) => Promise<void>;
  /**
   * Lot D : UN tour de l'agent monteur une fois les coupes posées (`monteurPourFabrication` côté service : consignes,
   * habitudes, plafond → version simple sans appel). Reçoit les entrées avec les coupes calculées (temps du montage
   * justes) ; rend les cartes posées. Absent : écrans partagés choisis d'office d'après le texte (lot C).
   */
  monteur?: (e: { entrees: Record<string, unknown>; mots: MotHorodate[]; dureePriseSec: number }) => Promise<{ cartes: CarteMonteur[]; entrees?: Record<string, unknown>; /** Lot I : passages du monteur (les effets spéciaux en sont tirés). */ passages?: PassageFacecam[] }>;
  /** Lot E1 : Décor IA après la passe image (`passeDecorFacecam`). Rend `null` quand l'option est coupée. */
  decor?: (e: { imageCle?: string; mots: MotHorodate[]; dureeUtileSec: number; fenetre?: FenetreDecor; priseCle?: string; bandeX?: number }) => Promise<ResultatDecorChaine | null>;
  /**
   * Lot C : `studio-rendu` pour les cartes et la composition finale (brique commune « composition »). Absent : la
   * piste montée du lot B est livrée telle quelle (sans sous-titres ni cartes).
   */
  habillage?: OutilsMontage;
  /**
   * Mission H : multicaméra (brique commune, `passeMulticameraFacecam`) — la face = la piste montée de Will, deux angles
   * fabriqués par son double sur le même son. Rend `null` quand l'option est coupée (réglage `facecam.multicamera`, ni
   * consigne « 3 caméras »). Absent : une seule caméra, comme avant.
   */
  multicamera?: (e: { pisteCle: string; dureeSec: number; mots: MotHorodate[]; coupesPrefereesSec: number[]; consignes: string[] }) => Promise<PisteMulticamera | null>;
  /**
   * Lot K : fabrique les effets réalistes par IA de la version (`passeEffetsRealistesFacecam` : jamais sans confirmation
   * valide, garde serveur du lot J). Ne lève pas ; absente : aucun effet réaliste (repli gratuit).
   */
  effetsRealistes?: (e: { effets: EffetRealistePrepare[]; imageCle?: string; priseCle: string; fenetre?: FenetreDecor; bandeX?: number; decorApplique: boolean }) => Promise<ResultatEffetRealiste[]>;
  /** Lot I : image de contrôle (JPEG sur R2) décodée en RVB, pour la lumière de l'objet 3D ; absente : repli. */
  lireImageRvb?: (cle: string) => Promise<ImageRvb | null>;
  /**
   * Lot G : relecture Claude des images de contrôle (UN appel) et sa correction (1 au plus) convertie en entrées. Ne
   * lève pas ; `null` : rien relu. Absente : pas de relecture.
   */
  /** Horloge (ms) : attente bornée d'un studio-aligneur injoignable (vérif V5). Absente : `Date.now`. */
  maintenant?: () => number;
  relire?: (e: { images: { cle: string; legende: string; elementId: string | null }[]; entrees: Record<string, unknown> }) => Promise<{ defauts: { elementId: string | null; defaut: string; detail: string }[]; entrees?: Record<string, unknown>; correction?: string } | null>;
}

/** Essais d'un travail de la chaîne (aussi ceux des déclinaisons, lot F1 : règle écrite une seule fois). */
export const ESSAIS_MAX = 2;

/**
 * Vérif V2 (10/10) : tours sans réponse de `studio-rendu` tolérés (≈ 5 min à un tour toutes les 5 s) avant un échec
 * définitif. Côté `studio-aligneur`, la règle est celle de la vérif V5 (`reprise.ts` : 30 min sans consommer d'essai,
 * même identifiant).
 */
export const INJOIGNABLE_MAX = 60;

/**
 * Vérif V2 (10/10) : `studio-rendu` injoignable un instant (redémarrage, 5xx, réseau) — vrai : on attend le tour suivant,
 * INJOIGNABLE_MAX tours de suite au plus ; faux : échec définitif. Avant, la moindre absence de réponse pendant le rendu
 * des cartes ou de la composition abandonnait tout l'habillage : vidéo livrée sans sous-titres ni cartes.
 */
export function renduPassager(etat: EtatChaine, e: ErreurRendu): boolean {
  if (!e.reessayable) return false;
  etat.renduInjoignable = (etat.renduInjoignable ?? 0) + 1;
  return etat.renduInjoignable <= INJOIGNABLE_MAX;
}

export function etatChaineInitial(): EtatChaine {
  return { version: VERSION_CHAINE_FACECAM, travaux: {}, sauts: [] };
}

/**
 * Dimensions de la prise préparée (après rotation) : celles de `/visages`, sinon celles de `/transcrire` (Vérif V2,
 * 10/10 : visage non suivi sur une prise portrait d'iPhone, le cadre ne déborde plus la prise), sinon la source 4K
 * paysage d'origine.
 */
export function dimensionsSource(etat: Pick<EtatChaine, "travaux">): { largeur: number; hauteur: number } {
  for (const nom of ["visages", "transcrire"] as const) {
    const r = etat.travaux[nom]?.resultat as { largeurSource?: unknown; hauteurSource?: unknown } | undefined;
    const largeur = Number(r?.largeurSource);
    const hauteur = Number(r?.hauteurSource);
    if (largeur > 0 && hauteur > 0) return { largeur, hauteur };
  }
  return { largeur: 3840, hauteur: 2160 };
}

/** La prise à monter : la prise « version » (séance) ou la première prise reçue. */
export function priseDe(c: Pick<CommandeFabrication, "prises">): { cle: string; dureeSec: number; mime: string } | null {
  const prises = c.prises ?? [];
  const p = prises.find((x) => x.partie === "version") ?? prises[0];
  return p ? { cle: p.cle, dureeSec: p.dureeSec, mime: p.mime } : null;
}

/** Clé R2 d'un résultat de la chaîne (rangée sous la vidéo et la version : rien n'écrase la prise d'origine). */
export function cleResultat(c: Pick<CommandeFabrication, "videoId">, versionId: string, nom: string): string {
  return `facecam/${c.videoId}/${versionId}/${nom}`;
}

const identifiant = (travailId: string, cle: CleTravailChaine, essai: number, tour = 0) => `${travailId}-${cle}${tour ? `-t${tour}` : ""}${essai ? `-e${essai}` : ""}`.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 200);

/** Bande utile de la passe image : l'union des cadres de tous les plans, avec une marge, en pixels pairs. */
export function bandeDesPlans(plans: PlanCamera[], source: { largeur: number; hauteur: number }): { x: number; largeur: number } {
  if (!plans.length) {
    const largeur = Math.min(source.largeur, Math.round((source.hauteur * 9) / 16) * 1.35);
    return { x: 2 * Math.floor((source.largeur - largeur) / 4), largeur: 2 * Math.floor(largeur / 2) };
  }
  const marge = 32;
  const x0 = Math.max(0, Math.min(...plans.map((p) => p.cadre.x)) - marge);
  const x1 = Math.min(source.largeur, Math.max(...plans.map((p) => p.cadre.x + p.cadre.largeur)) + marge);
  const x = 2 * Math.floor(x0 / 2);
  return { x, largeur: 2 * Math.floor((x1 - x) / 2) };
}

/* ------------------------------------------------------------------ */
/* Contrôles machine → alertes                                         */
/* ------------------------------------------------------------------ */

export interface ControlesMontage {
  /**
   * Version des contrôles du studio-aligneur (absente = 1). 2 (10/10, `docs/facecam/JOURNAL-CONTROLES-QUALITE.md`) :
   * synchro mesurée contre le son de la prise, visage mesuré sur la piste montée.
   */
  version?: number;
  noirs?: unknown[];
  figes?: unknown[];
  imagesIsolees?: number[];
  niveauLufs?: number | null;
  cretedBTP?: number | null;
  /** > 0 : le son arrive après l'image. Ignoré en version 1 (mesure biaisée : bouche contre voix, fenêtre ± 5). */
  decalageSynchroImages?: number | null;
  synchro?: { images: number; ms: number; sonMs: number; fluxMs: number; correlation: number };
  /** Peau du visage lue dans la piste montée (après la passe, la LUT et l'encodage) : luma BT.709 0-255, teinte h_ab. */
  visage?: { luminance: number; teinteDeg: number; peauLab?: number[]; images?: number };
}

export interface MesuresImage {
  luminanceVisageAvant?: number | null;
  luminanceVisageApres?: number | null;
  bruitVisageAvant?: number | null;
  bruitVisageApres?: number | null;
  bruitRatio?: number;
  teintePeauDeg?: number;
  deltaE00Peau?: number;
}

export { VERSION_CONTROLES };
/**
 * Luma BT.709 de la peau (0-255, pleine plage) jugée correcte : 90 à 190, soit ≈ 35 % à 75 % du signal. Repères de
 * l'exposition vidéo : peau claire vers 60-70 %, peau foncée vers 40-50 % ; la charte ColorChecker donne 158 (« light
 * skin ») et 88 (« dark skin »). L'ancienne borne 100-140 (39-55 %) déclarait « trop clair » un visage bien exposé.
 */
export const LUMINANCE_VISAGE = { min: 90, max: 190 } as const;
/**
 * Teinte CIELAB (h_ab) de la peau jugée naturelle : 50° ± 20°. ColorChecker : 51° (« light skin »), 49° (« dark
 * skin ») ; les peaux claires et les joues rosées descendent vers 35-40°, les peaux mates montent vers 60-65°.
 */
export const TEINTE_PEAU = { centreDeg: 50, toleranceDeg: 20 } as const;

/**
 * Contrôles machine avant Claude (v4 n° 24, n° 17) : chaque écart devient une alerte lisible. Luminance et teinte du
 * visage viennent de la PISTE MONTÉE (`ctrl.visage`), jamais de la passe image : celle-ci les mesurait avant la LUT et
 * avant l'encodage, et elles restaient figées d'une version à l'autre tant que la passe était reprise.
 */
export function alertesControles(ctrl: ControlesMontage | undefined, mesures: MesuresImage | undefined, coupes: EtatChaine["coupes"], consignesAudibles: number): AlerteQualite[] {
  const a: AlerteQualite[] = [];
  const alerte = (message: string, gravite: AlerteQualite["gravite"] = "attention") => a.push({ code: "defaut-visuel", gravite, message });
  if (ctrl?.noirs?.length) a.push({ code: "image-noire", gravite: "bloquant", message: `${ctrl.noirs.length} passage(s) noir(s) dans la vidéo.` });
  if (ctrl?.figes?.length) alerte(`${ctrl.figes.length} image(s) figée(s) plus de 2 s.`);
  if (ctrl?.imagesIsolees?.length) alerte(`${ctrl.imagesIsolees.length} plan(s) de moins de 3 images à une coupe.`);
  if (typeof ctrl?.niveauLufs === "number" && Math.abs(ctrl.niveauLufs + 14) > 1) a.push({ code: "niveau-sonore", gravite: "attention", message: `Niveau sonore ${ctrl.niveauLufs.toFixed(1)} LUFS (cible −14).` });
  if ((ctrl?.version ?? 1) >= VERSION_CONTROLES && typeof ctrl?.decalageSynchroImages === "number" && Math.abs(ctrl.decalageSynchroImages) > 1) {
    const n = Math.abs(ctrl.decalageSynchroImages);
    a.push({ code: "synchronisation", gravite: "bloquant", message: `Son et image décalés de ${n} image(s) (le son arrive ${ctrl.decalageSynchroImages > 0 ? "après" : "avant"} l'image).` });
  }
  if (typeof mesures?.bruitRatio === "number" && mesures.bruitRatio > 1.0) alerte("Le visage est plus granuleux que l'original.", "bloquant");
  const visage = (ctrl?.version ?? 1) >= VERSION_CONTROLES ? ctrl?.visage : undefined;
  if (typeof visage?.luminance === "number" && (visage.luminance < LUMINANCE_VISAGE.min || visage.luminance > LUMINANCE_VISAGE.max)) alerte(`Visage trop ${visage.luminance < LUMINANCE_VISAGE.min ? "sombre" : "clair"} (${Math.round(visage.luminance)}).`);
  if (typeof mesures?.deltaE00Peau === "number" && mesures.deltaE00Peau >= 4) alerte(`Teint éloigné du Look Will (ΔE ${mesures.deltaE00Peau.toFixed(1)}).`);
  if (typeof visage?.teinteDeg === "number" && Math.abs(visage.teinteDeg - TEINTE_PEAU.centreDeg) > TEINTE_PEAU.toleranceDeg) alerte(`Teinte de peau hors des tons chair (${Math.round(visage.teinteDeg)}°).`, "info");
  // V6 P0 n° 8 : une phrase perdue ou dite deux fois est bloquante (EXIGENCES-WILL l. 27).
  if (coupes?.phrasesManquantes.length) a.push({ code: "export", gravite: "bloquant", message: `${coupes.phrasesManquantes.length} phrase(s) du texte absente(s) du montage.` });
  // 10/10 : une phrase dite autrement n'est pas perdue ; simple information (sous-titres d'après la parole).
  if (coupes?.phrasesDitesAutrement?.length) a.push({ code: "export", gravite: "info", message: `${coupes.phrasesDitesAutrement.length} phrase(s) dite(s) autrement : sous-titres d'après la parole.` });
  if (coupes?.phrasesEnDouble?.length) a.push({ code: "export", gravite: "bloquant", message: `${coupes.phrasesEnDouble.length} passage(s) entendu(s) deux fois : « ${coupes.phrasesEnDouble[0].texte.slice(0, 60)} ».` });
  if (consignesAudibles) a.push({ code: "export", gravite: "bloquant", message: `${consignesAudibles} consigne(s) « Monteur » encore audible(s).` });
  return a;
}

/* ------------------------------------------------------------------ */
/* Avancer la chaîne                                                   */
/* ------------------------------------------------------------------ */

export interface ContexteChaine {
  travailId: string;
  versionId: string;
  /** Lot G : relire la vidéo finie (fabrication en version complète seulement ; jamais une retouche). */
  relecture?: boolean;
}

/**
 * Un tour de la chaîne : interroge les travaux soumis, calcule ce qui peut l'être, soumet la suite. Rend le nouvel
 * état (l'ancien n'est jamais modifié). Ne lève jamais : toute panne devient un saut ou un échec typé.
 */
export async function avancerChaine(etatPrecedent: EtatChaine, commande: CommandeFabrication, ctx: ContexteChaine, deps: DependancesChaine): Promise<EtatChaine> {
  const etat: EtatChaine = structuredClone(etatPrecedent);
  if (etat.fini || etat.echec) return etat;
  // Lot G : entrées EFFECTIVES — celles de la commande, puis ce que le monteur a posé à la fabrication, puis la
  // correction de la relecture (coupes demandées, image, son, passages).
  const entreesEffectives = () => ({ ...(commande.entrees ?? {}), ...(etat.monteur?.entrees ?? {}), ...(etat.relecture?.entrees ?? {}) });
  const c: CommandeFabrication = { ...commande, entrees: entreesEffectives() };
  const prise = priseDe(c);
  if (!prise) {
    etat.echec = { brique: "transcrire", message: "Aucune vidéo reçue pour ce montage.", reessayable: false };
    return etat;
  }
  const simule = deps.facecam.mode === "simulation";
  const lire = async (cle: string) => (simule || !deps.urlLecture ? `https://simulation.invalid/${cle}` : deps.urlLecture(cle));
  const deposer = async (cle: string, mime: string) => (simule || !deps.urlDepot ? `https://simulation.invalid/${cle}` : deps.urlDepot(cle, mime));
  const cle = (nom: string) => cleResultat(c, ctx.versionId, nom);
  let entrees = lireEntreesFacecam(c.entrees);

  const maintenant = () => deps.maintenant?.() ?? Date.now();
  async function soumettre(nom: CleTravailChaine, demande: Omit<DemandeFacecam, "idTravail">): Promise<void> {
    const precedent = etat.travaux[nom];
    // Vérif V5 : une soumission que le conteneur n'a pas reçue (redémarrage) est refaite sous le même identifiant.
    const s = prochaineSoumission(precedent, (essais) => identifiant(ctx.travailId, nom, essais, etat.tour ?? 0));
    const r = await deps.facecam.soumettre(ROUTE[nom], { ...demande, idTravail: s.id });
    etat.travaux[nom] = apresSoumission(s, precedent, r, maintenant());
  }

  async function suivre(nom: CleTravailChaine): Promise<void> {
    const t = etat.travaux[nom];
    if (!t || t.statut !== "soumis") return;
    const r: EtatTravailFacecam = await deps.facecam.suivre(ROUTE[nom], t.id);
    // Vérif V5 : conteneur qui redémarre (injoignable) ou recréé (travail inconnu) → aucun essai consommé.
    const repris = suiviSansEssai(t, r, maintenant());
    if (repris) etat.travaux[nom] = repris;
    else if (r.statut === "termine") etat.travaux[nom] = { ...sansReprise(t), statut: "termine", progression: 100, resultat: r.resultat as unknown as Record<string, unknown> };
    else if (r.statut === "en_cours") etat.travaux[nom] = { ...sansReprise(t), progression: r.progression };
    else if (r.statut === "en_file") etat.travaux[nom] = sansReprise(t);
    else if (r.statut === "echec") {
      // Panne réessayable du travail : on soumet à nouveau, ESSAIS_MAX fois au plus.
      const erreur = { code: r.erreur.code, message: r.erreur.message };
      if (r.erreur.reessayable && t.essais < ESSAIS_MAX) etat.travaux[nom] = { ...sansReprise(t), statut: "echec", erreur: { ...erreur, reessayable: true } };
      else etat.travaux[nom] = { ...sansReprise(t), statut: "echec", erreur: { ...erreur, reessayable: false } };
    }
  }

  /** Un travail en échec réessayable est soumis à nouveau ; sinon il reste en échec (définitif). */
  const aRelancer = (nom: CleTravailChaine) => aSoumettre(etat.travaux[nom], ESSAIS_MAX);
  const termine = (nom: CleTravailChaine) => etat.travaux[nom]?.statut === "termine";
  const rate = (nom: CleTravailChaine) => etat.travaux[nom]?.statut === "echec" && !aRelancer(nom);
  const sauter = (brique: string, message: string) => {
    if (!etat.sauts.some((s) => s.brique === brique)) etat.sauts.push({ brique, message });
  };

  for (const nom of Object.keys(etat.travaux) as CleTravailChaine[]) await suivre(nom);

  // 1. Transcription et visages, soumis ensemble (le serveur les fait l'un après l'autre).
  const source = await lire(prise.cle);
  if (aRelancer("transcrire")) {
    await soumettre("transcrire", {
      source,
      depots: { transcription: await deposer(cle("transcription.json.gz"), "application/gzip") },
      parametres: { glossaire: deps.glossaire ?? [], cles: { transcription: cle("transcription.json.gz") }, ...(simule ? { texte: c.script.texteComplet } : {}) },
    });
  }
  if (aRelancer("visages")) {
    await soumettre("visages", {
      source,
      depots: { piste: await deposer(cle("piste.json.gz"), "application/gzip"), points: await deposer(cle("points.json.gz"), "application/gzip") },
      parametres: { cles: { piste: cle("piste.json.gz"), points: cle("points.json.gz") } },
    });
  }

  // 2. Consignes puis coupes (dès la transcription), ou aucune coupe si elle a raté.
  let mots: MotHorodate[] | null = null;
  /** Mots de la prise tels que transcrits (avant tout recalage). */
  const motsBruts = async (): Promise<MotHorodate[]> => {
    if (mots) return mots;
    const r = etat.travaux.transcrire?.resultat as { mots?: MotHorodate[]; transcriptionCle?: string } | undefined;
    if (Array.isArray(r?.mots)) return (mots = r.mots);
    const brut = r?.transcriptionCle && deps.lireJsonGz ? ((await deps.lireJsonGz(r.transcriptionCle).catch(() => null)) as { mots?: MotHorodate[] } | null) : null;
    return (mots = Array.isArray(brut?.mots) ? brut.mots : []);
  };
  /** Mots de la prise, recalés sur la prise complète d'une reprise absorbée une fois les coupes posées. */
  const motsDeLaTranscription = async (): Promise<MotHorodate[]> => appliquerRecalages(await motsBruts(), etat.coupes?.recalages);
  if (!etat.coupes && (termine("transcrire") || rate("transcrire"))) {
    const m = termine("transcrire") ? await motsBruts() : [];
    const resultat = etat.travaux.transcrire?.resultat as { dureeSec?: number; motsLibres?: unknown } | undefined;
    const duree = Number(resultat?.dureeSec) || prise.dureeSec;
    // Transcription libre (Whisper) rendue EN PLUS d'un alignement forcé : elle situe exactement une reprise absorbée.
    const motsLibres = Array.isArray(resultat?.motsLibres) ? (resultat.motsLibres as MotHorodate[]) : undefined;
    if (rate("transcrire")) sauter("Les coupes", "La transcription n'a pas abouti : la vidéo est gardée entière.");
    const texte = c.script.texteComplet?.trim();
    const plan = calculerCoupes({ mots: m, dureeSec: duree, ...(texte ? { texteValide: texte } : {}), ...(motsLibres?.length ? { motsLibres } : {}) });
    // Les coupes déjà rétablies par Will (retouche) restent rétablies ; celles qu'il a demandées (« coupe ce passage »)
    // s'ajoutent (lot G : avant, elles étaient ignorées par la chaîne).
    const retablies = new Set(entrees.coupes.retablies);
    const demandees = lireReglagesMonteur(c.entrees).coupesDemandees;
    const liste = plan.coupes;
    const gardes = demandees.length ? gardesDepuisCoupes(coupesActives({ coupes: { auto: liste, retablies: [...retablies] } }, demandees), plan.dureeSourceSec) : retablies.size ? gardesSans(liste, retablies, plan.dureeSourceSec) : plan.gardes;
    etat.coupes = {
      mode: plan.mode,
      texteNonRetrouve: plan.texteNonRetrouve,
      liste,
      gardes,
      consignes: plan.consignes,
      dureeSourceSec: plan.dureeSourceSec,
      dureeSortieSec: +gardes.reduce((s, g) => s + g.finSec - g.debutSec, 0).toFixed(3),
      resume: resumeCoupes(plan, [...retablies]),
      ...(() => {
        const ctrl = controlerCoupes(plan, m, [...retablies]);
        return { phrasesManquantes: ctrl.phrasesManquantes, phrasesEnDouble: ctrl.phrasesEnDouble, ...(ctrl.phrasesDitesAutrement.length ? { phrasesDitesAutrement: ctrl.phrasesDitesAutrement } : {}) };
      })(),
      ...(plan.mode === "texte" ? { texteMonte: texteDesSousTitres(plan.phrases) } : {}),
      ...(plan.recalages.length ? { recalages: plan.recalages } : {}),
    };
    // Vérif V2 (10/10) : la vidéo garde la transcription RECALÉE (le monteur, aux demandes de Will après coup, relit la
    // transcription livrée : sans recalage, les mots repris tombaient dans la première tentative coupée et disparaissaient).
    if (plan.recalages.length && deps.ecrireJsonGz && !simule) {
      const cleRecalee = cle("transcription-recalee.json.gz");
      const deposee = await deps.ecrireJsonGz(cleRecalee, { version: 1, mots: appliquerRecalages(m, plan.recalages), recalages: plan.recalages }).then(() => true, () => false);
      if (deposee) etat.coupes.transcriptionCle = cleRecalee;
    }
  }

  // 2 bis. Agent monteur (lot D) : une fois, dès les coupes (ses cartes sont calées sur le temps du montage).
  if (etat.coupes && deps.monteur && !etat.monteur) {
    const coupes = etat.coupes;
    const facecamBrut = ((c.entrees ?? {}) as { facecam?: Record<string, unknown> }).facecam ?? {};
    const avecCoupes = { ...c.entrees, facecam: { ...facecamBrut, coupes: { auto: coupes.liste, retablies: entrees.coupes.retablies } } };
    try {
      const r = await deps.monteur({ entrees: avecCoupes, mots: termine("transcrire") ? await motsDeLaTranscription() : [], dureePriseSec: coupes.dureeSourceSec });
      const effets = effetsDesPassages(r.passages ?? []); // Lot I
      etat.monteur = { statut: "fait", cartes: r.cartes, ...(r.entrees ? { entrees: r.entrees } : {}), ...(effets.length ? { effets } : {}) };
      // V6 : ce que le monteur vient de poser (son, image, zooms) vaut DÈS ce tour (le son et la passe partent ensuite).
      c.entrees = entreesEffectives();
      entrees = lireEntreesFacecam(c.entrees);
      // V6 : « coupe ce passage » dit pendant la prise vaut dès la première fabrication (avant : seulement en retouche).
      const demandees = lireReglagesMonteur(c.entrees).coupesDemandees;
      if (demandees.length && !etat.travaux.son) {
        const gardes = gardesDepuisCoupes(coupesActives({ coupes: { auto: coupes.liste, retablies: entrees.coupes.retablies } }, demandees), coupes.dureeSourceSec);
        etat.coupes = { ...coupes, gardes, dureeSortieSec: +gardes.reduce((s, g) => s + g.finSec - g.debutSec, 0).toFixed(3) };
      }
    } catch {
      etat.monteur = { statut: "fait", cartes: [] };
      sauter("Le monteur", "Les consignes n'ont pas pu être appliquées : la vidéo est montée sans elles.");
    }
  }

  // 3. Son monté sur les passages gardés.
  const reglagesSon = lireReglagesMonteur(c.entrees).son;
  if (etat.coupes && aRelancer("son")) {
    const debut = etat.coupes.liste.find((x) => x.type === "debut" && x.debutSec === 0);
    await soumettre("son", {
      source,
      depots: { son: await deposer(cle("son.flac"), "audio/flac") },
      parametres: {
        gardes: etat.coupes.gardes,
        // Les 3 s de pièce vide filmées au début (fiche de tournage) : le ton de pièce sous les raccords.
        ...(debut && debut.finSec >= 1.5 ? { plaqueSec: [0.3, Math.min(3.3, debut.finSec - 0.3)] } : {}),
        // Lot G : réglages du son demandés au monteur (débruitage, plus / moins fort) ; par défaut, rien ne change.
        ...(reglagesSon.nettoyer === false || reglagesSon.volume !== "normal" ? { voix: { nettoyer: reglagesSon.nettoyer, volume: reglagesSon.volume } } : {}),
        cles: { son: cle("son.flac") },
      },
    });
  }
  if (rate("son")) {
    etat.echec = { brique: "son", message: etat.travaux.son?.erreur?.message ?? "Le son n'a pas abouti.", reessayable: true };
    return etat;
  }

  // 4. Réalisation (dès les coupes et les visages ; visages ratés : cadre centré).
  const visages = etat.travaux.visages?.resultat as { pisteVisageCle?: string; pointsCle?: string; largeurSource?: number; hauteurSource?: number } | undefined;
  if (etat.coupes && !etat.plans && (termine("visages") || rate("visages"))) {
    let piste: PisteVisage | null = null;
    if (termine("visages") && visages?.pisteVisageCle && deps.lireJsonGz && !simule) piste = ((await deps.lireJsonGz(visages.pisteVisageCle).catch(() => null)) as PisteVisage | null) ?? null;
    if (rate("visages")) sauter("Le cadrage du visage", "Le visage n'a pas été suivi : cadre centré.");
    const sourceDim = piste?.largeurSource && piste.hauteurSource ? { largeur: piste.largeurSource, hauteur: piste.hauteurSource } : dimensionsSource(etat);
    const m = termine("transcrire") ? await motsDeLaTranscription() : [];
    const r = realiser({ gardes: etat.coupes.gardes, mots: m, piste, source: sourceDim, rythme: "equilibre" });
    // V6 « interdit de mentir » : les zooms demandés au monteur deviennent des plans serrés (rendus au cadrage).
    etat.plans = appliquerZooms(r.plans, zoomsDesPassages(entrees.passages), sourceDim);
    // Lot F1 : plans des autres formats demandés (aucun : rien n'est écrit).
    preparerDeclinaisons(etat, c, { piste, source: sourceDim });
  }

  // 4 bis. Retouche (lot G) : la passe image reprise est gardée si sa bande couvre encore tous les nouveaux cadres.
  if (etat.verifierBande && etat.plans) {
    const bandePasse = (etat.travaux.passe?.resultat as { bande?: { x: number; largeur: number } } | undefined)?.bande;
    const src = dimensionsSource(etat);
    const besoin = bandeAvecDeclinaisons(etat, src) ?? bandeDesPlans(etat.plans, src);
    const couvre = !!bandePasse && besoin.x >= bandePasse.x && besoin.x + besoin.largeur <= bandePasse.x + bandePasse.largeur;
    if (!couvre && etat.travaux.passe) {
      delete etat.travaux.passe;
      if (etat.decor?.statut === "applique") delete etat.decor;
    }
    delete etat.verifierBande;
  }

  // 5. Passe image (Look Will) sur la bande utile ; ratée : la prise est recadrée telle quelle.
  const avecPasse = c.briques.etalonnage !== false;
  if (etat.plans && avecPasse && aRelancer("passe")) {
    const sourceDim = dimensionsSource(etat);
    const lut = c.styles.lut && c.styles.lut.id !== "aucune" ? c.medias?.[c.styles.lut.id] : undefined;
    const look = (c.entrees as { facecamLookWill?: { peauLab?: number[]; murLab?: number[] } }).facecamLookWill;
    await soumettre("passe", {
      source,
      depots: { image: await deposer(cle("image-10bits.mp4"), "video/mp4") },
      parametres: {
        etape: "passe",
        bande: bandeAvecDeclinaisons(etat, sourceDim) ?? bandeDesPlans(etat.plans, sourceDim),
        image: entrees.image,
        ...(termine("visages") && visages?.pointsCle ? { points: await lire(visages.pointsCle), ...(visages.pisteVisageCle ? { piste: await lire(visages.pisteVisageCle) } : {}) } : {}),
        ...(lut ? { lut: { adresse: await lire(lut.cle), intensite: c.styles.lut?.intensite ?? 60 } } : {}),
        ...(look?.peauLab ? { lookWill: look } : {}),
        // Lot G : « plus chaud » / « plus froid » demandé au monteur.
        ...(lireReglagesMonteur(c.entrees).teinte !== "neutre" ? { teinte: lireReglagesMonteur(c.entrees).teinte } : {}),
        cles: { image: cle("image-10bits.mp4") },
      },
    });
  }
  if (rate("passe")) sauter("L'image", "La retouche de l'image n'a pas abouti : la vidéo garde l'image d'origine.");

  // 5 bis. Décor IA (lot E1) : option coupée par défaut (étape ignorée) ; tout ou rien, jamais bloquant.
  const passeFaite = !avecPasse || termine("passe") || rate("passe");
  if (deps.decor && passeFaite && etat.coupes && !etat.decor) {
    try {
      const imageCle = (etat.travaux.passe?.resultat as { fichierCle?: string } | undefined)?.fichierCle;
      const src = dimensionsSource(etat);
      const fenetre = etat.plans ? fenetreDecor(etat.plans, src) : undefined;
      const bandeX = (etat.travaux.passe?.resultat as { bande?: { x: number } } | undefined)?.bande?.x;
      const r = await deps.decor({ ...(imageCle ? { imageCle } : {}), mots: termine("transcrire") ? await motsDeLaTranscription() : [], dureeUtileSec: etat.coupes.dureeSourceSec, ...(fenetre ? { fenetre } : {}), priseCle: prise.cle, ...(bandeX !== undefined ? { bandeX } : {}) });
      etat.decor = !r ? { statut: "ignore" } : r.applique ? { statut: "applique", message: r.message, ...(r.plan ? { plan: { ...r.plan, ...(fenetre ? { fenetre } : {}) } } : {}) } : { statut: "repli", message: r.message };
      // Lot G : décor appliqué → zooms limités à 110 % et cadres gardés dans la fenêtre retouchée.
      if (etat.decor.statut === "applique" && fenetre && etat.plans) etat.plans = plansSousDecor(etat.plans, fenetre, Number((r?.plan as { zoomMax?: number } | undefined)?.zoomMax) || 1.1);
    } catch {
      etat.decor = { statut: "repli", message: "Décor non réussi : la vidéo est livrée avec son vrai décor." };
    }
    if (etat.decor.statut === "repli") sauter("Le décor", etat.decor.message ?? "Décor non réussi : la vidéo est livrée avec son vrai décor.");
  }

  // 5 ter. Lot K : effets réalistes par IA (payants, confirmés), après le décor, avant le cadrage ; jamais bloquant.
  if (passeFaite && etat.coupes && (!deps.decor || !!etat.decor) && (!deps.monteur || !!etat.monteur) && !etat.effetsRealistes) {
    const effets = lireEntreesFacecam(c.entrees).passages.map(effetDuPassage).filter((e): e is EffetRealistePrepare => !!e);
    let resultats: ResultatEffetRealiste[] = [];
    const src = dimensionsSource(etat);
    const fenetre = etat.plans ? fenetreDecor(etat.plans, src) : undefined;
    if (effets.length && deps.effetsRealistes) {
      const passe = etat.travaux.passe?.resultat as { fichierCle?: string; bande?: { x: number } } | undefined;
      resultats = await deps
        .effetsRealistes({ effets, ...(passe?.fichierCle ? { imageCle: passe.fichierCle } : {}), priseCle: prise.cle, ...(fenetre ? { fenetre } : {}), ...(passe?.bande ? { bandeX: passe.bande.x } : {}), decorApplique: etat.decor?.statut === "applique" })
        .catch(() => effets.map((e): ResultatEffetRealiste => ({ id: e.id, statut: "rate", raison: "panne", creditsDebites: 0, message: MESSAGE_EFFET_RATE })));
    } else resultats = effets.map((e): ResultatEffetRealiste => ({ id: e.id, statut: "non-lance", raison: "non-confirme", creditsDebites: 0, message: MESSAGE_EFFET_RATE }));
    etat.effetsRealistes = { resultats };
    // Vitre brisée seulement si l'effet a réussi ; objet 3D (repli gratuit) seulement s'il a raté.
    if (etat.monteur?.effets) etat.monteur = { ...etat.monteur, effets: selonEffetsRealistes(etat.monteur.effets, resultats) };
    const reussis = resultats.filter((r) => r.statut === "reussi");
    const morceaux = reussis.map((r) => (r as Extract<ResultatEffetRealiste, { statut: "reussi" }>).morceau);
    const fenetreEffets = morceaux.find((m) => m.fenetre)?.fenetre ?? fenetre;
    if (morceaux.length && fenetreEffets && etat.plans) etat.plans = plansLargesPendant(etat.plans, morceaux, fenetreEffets);
    // « Effet non réussi — Réessayer » quand Will l'avait confirmé (une version sans accord n'en parle pas).
    if (resultats.some((r) => r.statut === "rate")) sauter("Un effet réaliste", "Effet non réussi — Réessayer : la vidéo est livrée dans sa version gratuite.");
  }

  // 6. Piste montée pré-cadrée et contrôles machine.
  const imagePrete = passeFaite && (!deps.decor || !!etat.decor) && !!etat.effetsRealistes;
  if (etat.plans && termine("son") && imagePrete && aRelancer("cadrage")) {
    const passe = etat.travaux.passe?.resultat as { fichierCle?: string; bande?: { x: number } } | undefined;
    const sonCle = (etat.travaux.son?.resultat as { fichierCle?: string } | undefined)?.fichierCle ?? cle("son.flac");
    const avecImage = termine("passe") && !!passe?.fichierCle;
    await soumettre("cadrage", {
      source: avecImage ? await lire(passe!.fichierCle!) : source,
      depots: { montage: await deposer(cle("montage.mov"), "video/quicktime"), vignette: await deposer(cle("vignette.jpg"), "image/jpeg") },
      parametres: {
        etape: "cadrage",
        ...(avecImage ? { bande: passe!.bande ?? { x: 0 } } : { preparer: true, bande: { x: 0 } }),
        plans: etat.plans.map((p) => ({ debutSec: p.debutSec, finSec: p.finSec, priseDebutSec: p.priseDebutSec, priseFinSec: p.priseFinSec, cadre: p.cadre })),
        son: await lire(sonCle),
        // Contrôle de synchro (10/10) : le son de chaque plan est comparé à celui de la prise au même instant.
        prise: source,
        ...(termine("visages") && visages?.pisteVisageCle ? { piste: await lire(visages.pisteVisageCle) } : {}),
        sortie: { largeur: 1080, hauteur: 1920 },
        // Lot E1 : morceaux du décor IA (son de la prise gardé, zoom limité) ; absent : image de la passe.
        ...(planCadrage() ? { decor: await planDecorPourCadrage(planCadrage()!) } : {}),
        cles: { montage: cle("montage.mov"), vignette: cle("vignette.jpg") },
      },
    });
  }
  // 6 bis. Mots de la vidéo montée (sous-titres, agent monteur) : texte validé calé sur le son monté.
  if (etat.coupes && termine("son") && etat.mots?.statut !== "fait") await calerMots();

  if (rate("cadrage")) {
    etat.echec = { brique: "cadrage", message: etat.travaux.cadrage?.erreur?.message ?? "Le montage n'a pas abouti.", reessayable: true };
    return etat;
  }
  // Lot F1 : pistes pré-cadrées des autres formats (aucun demandé : rien n'est soumis).
  await avancerDeclinaisons(etat, c, ctx, deps);
  if (termine("cadrage") && etat.mots?.statut === "fait" && declinaisonsFinies(etat)) {
    // 7. Habillage (lot C) : cartes puis composition finale ; panne définitive → piste montée livrée sans lui.
    if (deps.habillage && !etat.habillage?.abandonne && !etat.habillage?.sortie && (!deps.monteur || etat.monteur)) {
      try {
        await habiller(deps.habillage);
        delete etat.renduInjoignable;
      } catch (e) {
        if (!(e instanceof ErreurRendu)) throw e;
        // Panne passagère (studio-rendu qui redémarre) : on reprend au tour suivant ; définitive : livrée sans habillage.
        if (!renduPassager(etat, e)) {
          etat.habillage = { ...(etat.habillage ?? { cartes: [], base: baseVide() }), abandonne: true };
          sauter("Les sous-titres et cartes", "L'habillage n'a pas abouti : la vidéo est livrée sans sous-titres ni cartes.");
        }
      }
    }
    // 10/10 : couleurs de l'export aberrantes face à la prise étalonnée → jamais livrée (la version d'avant reste en ligne).
    if (couleursBloquent(etat.habillage?.sortie?.mesures)) {
      etat.echec = { brique: "export", message: MESSAGE_COULEURS, reessayable: false };
      return etat;
    }
    // Lot F1 : compositions des autres formats (aucun demandé : rien n'est fait).
    if (deps.habillage && etat.habillage && etat.declinaisons) await avancerHabillagesFormats(etat, c, ctx, deps.habillage);
    const habillageRegle = !deps.habillage || !!etat.habillage?.sortie || !!etat.habillage?.abandonne;
    if (habillageRegle && (!deps.habillage || !etat.habillage || habillagesFormatsRegles(etat)) && (await relectureReglee())) etat.fini = true;
  }
  return etat;

  /**
   * Lot G : relecture ciblée de la vidéo finie. Rend vrai quand elle est réglée (faite, ignorée ou pas demandée) ; une
   * correction remet la chaîne en route sur les seules étapes qu'elle touche (comme une retouche).
   */
  async function relectureReglee(): Promise<boolean> {
    if (!ctx.relecture || !deps.relire || c.plafondClaudeAtteint || etat.relecture?.statut === "faite" || etat.relecture?.statut === "ignoree") return true;
    const montage = etat.travaux.cadrage?.resultat as { fichierCle?: string; dureeSec?: number } | undefined;
    const finale = etat.habillage?.sortie?.fichierCle ?? montage?.fichierCle;
    if (!finale) {
      etat.relecture = { statut: "ignoree" };
      return true;
    }
    if (!etat.relecture) {
      const dureeSec = Number(montage?.dureeSec) || etat.coupes?.dureeSortieSec || 0;
      const raccords: number[] = [];
      let t = 0;
      for (const g of etat.coupes?.gardes.slice(0, -1) ?? []) raccords.push(+(t += g.finSec - g.debutSec).toFixed(3));
      const sup = etat.habillage?.base.supplements;
      // Lot I : un effet spécial est relu au milieu, sous l'identifiant de son passage.
      const parCle = new Map([...(etat.habillage?.cartes ?? []), ...(etat.habillage?.effets ?? [])].map((x) => [x.demande.sortie.cle, x.id]));
      const cartes = [
        ...(sup?.ecransPartages ?? []).map((x) => ({ id: parCle.get(x.carteCle) ?? x.carteCle, debutSec: x.debutSec, finSec: x.finSec, ecranPartage: true })),
        ...(sup?.cartesPleinEcran ?? []).map((x) => ({ id: parCle.get(x.carteCle) ?? x.carteCle, debutSec: x.debutSec, finSec: x.finSec, ecranPartage: false })),
        ...(etat.habillage?.base.supplementsMiseEnPage?.misesEnPage ?? []).map((x) => ({ id: parCle.get(x.carteCle) ?? x.carteCle, debutSec: x.debutSec, finSec: x.finSec, ecranPartage: true })),
      ];
      const idsEffets = new Set((etat.habillage?.effets ?? []).map((x) => x.id));
      const instants = instantsDeControle({ dureeSec, raccordsSec: raccords, cartes }).map((i) => (i.elementId && idsEffets.has(i.elementId) ? { ...i, legende: `${i.legende.replace(/^Carte/, "Effet spécial")} — le visage doit rester visible` } : i));
      const depots: Record<string, string> = {};
      const cles: Record<string, string> = {};
      for (const i of instants) {
        cles[i.nom] = cle(`controle/${i.nom}.jpg`);
        depots[i.nom] = await deposer(cles[i.nom], "image/jpeg");
      }
      await soumettre("controle", { source: await lire(finale), depots, parametres: { etape: "images", instants: instants.map((i) => ({ nom: i.nom, instantSec: i.instantSec })), largeur: 540, cles } });
      etat.relecture = { statut: "images", instants };
      return false;
    }
    // La relecture est facultative : une extraction ratée (même réessayable) n'est pas refaite, la vidéo est livrée.
    if (etat.travaux.controle?.statut === "echec") {
      etat.relecture = { statut: "ignoree" };
      sauter("La relecture", "Les images de contrôle n'ont pas pu être extraites : la vidéo est livrée sans relecture.");
      return true;
    }
    if (!termine("controle")) return false;
    const rendues = ((etat.travaux.controle?.resultat as { images?: { nom: string; cle: string }[] } | undefined)?.images ?? []).filter((x) => x && typeof x.cle === "string");
    const images = (etat.relecture.instants ?? []).flatMap((i) => {
      const r = rendues.find((x) => x.nom === i.nom);
      return r ? [{ cle: r.cle, legende: i.legende, elementId: i.elementId }] : [];
    });
    const r = images.length ? await deps.relire({ images, entrees: c.entrees ?? {} }).catch(() => null) : null;
    if (!r?.entrees) {
      etat.relecture = { statut: "faite", defauts: r?.defauts ?? [], correction: null };
      return true;
    }
    // Correction : appliquée par la retouche (seules les étapes touchées sont refaites), dans ce même travail.
    const avant = signatureMontage(c.entrees);
    const parties = partiesARefaire(avant, signatureMontage(r.entrees));
    const reprise = repriseDeLaChaine(etat, avant, Number(montage?.dureeSec) || 0);
    const cartesCorrigees = cartesDe(lireEntreesFacecam(r.entrees).passages as PassageMonteur[]);
    const suite = etatPourRetouche(reprise, { entrees: r.entrees }, parties, cartesCorrigees);
    const sauts = etat.sauts;
    const monteurEntrees = etat.monteur?.entrees;
    for (const k of Object.keys(etat) as (keyof EtatChaine)[]) delete etat[k];
    Object.assign(etat, suite, {
      sauts,
      tour: (etatPrecedent.tour ?? 0) + 1,
      monteur: { ...suite.monteur!, ...(monteurEntrees ? { entrees: monteurEntrees } : {}) },
      relecture: { statut: "faite", defauts: r.defauts, correction: r.correction ?? null, entrees: r.entrees },
    } satisfies Partial<EtatChaine>);
    return false;
  }

  /** Lot G : le plan du décor avec une adresse de lecture par morceau retouché (le studio-aligneur lit des adresses). */
  async function planDecorPourCadrage(plan: Record<string, unknown>): Promise<Record<string, unknown>> {
    const morceaux = Array.isArray(plan.morceaux) ? (plan.morceaux as { source?: string; fichierCle?: string }[]) : [];
    return { ...plan, morceaux: await Promise.all(morceaux.map(async (m) => ((m.source === "decor" || m.source === "effet") && m.fichierCle ? { ...m, adresse: await lire(m.fichierCle) } : m))) };
  }

  /** Plan donné au cadrage : décor appliqué et / ou morceaux des effets réalistes réussis (lot K) ; sinon rien. */
  function planCadrage(): Record<string, unknown> | undefined {
    const decor = etat.decor?.statut === "applique" ? etat.decor.plan : undefined;
    const morceaux = (etat.effetsRealistes?.resultats ?? []).flatMap((r) => (r.statut === "reussi" ? [r.morceau] : []));
    const src = dimensionsSource(etat);
    return planAvecEffets(decor, morceaux, etat.plans ? fenetreDecor(etat.plans, src) : undefined);
  }

  /**
   * 10/10 : garde-fou des couleurs de la composition finale — la prise étalonnée (passe image) et les instants comparés.
   * Rien quand l'image ne vient pas de la passe (décor IA, effet réaliste réussi, multicaméra) ou sans passe.
   */
  function controleCouleurs(couverts: { debutSec: number; finSec: number }[], dureeSec: number, multicamera: boolean): { controleCouleurs?: { referenceCle: string; paires: ControleCouleurs["paires"] } } {
    const passe = etat.travaux.passe?.resultat as { fichierCle?: string; bande?: { x: number } } | undefined;
    const effetReussi = etat.effetsRealistes?.resultats.some((r) => r.statut === "reussi");
    if (!termine("passe") || !passe?.fichierCle || !etat.plans?.length || multicamera || effetReussi || etat.decor?.statut === "applique") return {};
    const paires = pairesCouleurs(etat.plans, passe.bande?.x ?? 0, couverts, dureeSec);
    return paires.length ? { controleCouleurs: { referenceCle: passe.fichierCle, paires } } : {};
  }

  function baseVide(): BaseComposition {
    return { plans: [], segments: [], dureeSec: 0 };
  }

  /** Mots de la vidéo montée : ceux déposés sur R2 (calés), sinon ceux de la transcription remis sur le montage. */
  async function motsMontesActuels(): Promise<MotHorodate[]> {
    const depose = etat.mots?.cle && deps.lireJsonGz && !simule ? ((await deps.lireJsonGz(etat.mots.cle).catch(() => null)) as { mots?: MotHorodate[] } | null) : null;
    if (Array.isArray(depose?.mots)) return depose.mots;
    const montes = motsDuMontage(termine("transcrire") ? await motsDeLaTranscription() : [], etat.coupes!.gardes);
    return etat.coupes!.texteMonte && montes.length ? horodaterMotsPrononces(etat.coupes!.texteMonte.split(/\s+/).filter(Boolean), montes) : montes;
  }

  async function habiller(outils: OutilsMontage): Promise<void> {
    const montage = etat.travaux.cadrage?.resultat as { fichierCle?: string; dureeSec?: number; vignetteCle?: string } | undefined;
    if (!etat.habillage) {
      // Vérif V1 : mots corrigés dans les sous-titres depuis le fil, réappliqués à chaque habillage.
      const mots = corrigerMots(await motsMontesActuels(), lireReglagesMonteur(c.entrees).correctionsSousTitres).mots;
      const dureeSec = Number(montage?.dureeSec) || etat.coupes!.dureeSortieSec;
      // Mission H : multicaméra (une fois ; panne ou option coupée : une seule caméra).
      if (deps.multicamera && !etat.multicamera) {
        const piste = await deps.multicamera({ pisteCle: montage?.fichierCle ?? cle("montage.mov"), dureeSec, mots, coupesPrefereesSec: [], consignes: etat.coupes!.consignes.map((x) => x.texte) }).catch(() => null);
        etat.multicamera = { statut: "fait", ...(piste ? { piste } : {}) };
      }
      const multicamera = multicameraPourComposition(etat.multicamera?.piste, !simule);
      // Raccords du montage (temps monté) : les groupes de sous-titres s'y calent.
      const coupesSec: number[] = [];
      let t = 0;
      for (const g of etat.coupes!.gardes.slice(0, -1)) coupesSec.push(+(t += g.finSec - g.debutSec).toFixed(3));
      let cartes: CartePosee[] | undefined;
      if (etat.monteur?.cartes.length) {
        cartes = [];
        for (const m of etat.monteur.cartes.map((x) => carteDansLaVideo(x, dureeSec)).filter((x): x is CarteMonteur => !!x)) {
          const code = m.codeCle && deps.lireJsonGz && !simule ? ((await deps.lireJsonGz(m.codeCle).catch(() => null)) as CodeCarte | null) : null;
          const posee = cartePosee(m, code, c.intensite?.niveau);
          if (posee) cartes.push(posee);
        }
      }
      const lut = c.styles.lut && c.styles.lut.id !== "aucune" ? c.medias?.[c.styles.lut.id] : undefined;
      // Vérif V1 : les cartes automatiques retirées depuis le chat ne reviennent pas.
      const retirees = lireReglagesMonteur(c.entrees).cartesAutoRetirees;
      const cartesAutoRetirees = retirees.length ? { cartesAutoRetirees: retirees } : {};
      // 10/10 : gestes de Will sur les cartes automatiques depuis la fiche (retirée, déplacée, texte), de la prise au montage.
      const gardes = etat.coupes!.gardes;
      const cartesAuto = ajustementsAuMontage(lireReglagesMonteur(c.entrees).cartesAuto, (s) => priseVersMonteeGardes(s, gardes));
      // V6 P0 n° 9 : les effets spéciaux occupent leur passage (aucune carte automatique dessus).
      const occupes = (etat.monteur?.effets ?? []).filter((p) => p.finSec > p.debutSec).map((p) => ({ debutSec: p.debutSec, finSec: p.finSec }));
      const h: HabillageFacecam = habillageFacecam({
        pisteMonteeCle: montage?.fichierCle ?? cle("montage.mov"),
        dureeSec,
        mots,
        coupesSec,
        ...(cartes ? { cartes } : {}),
        ...cartesAutoRetirees,
        ...(cartesAuto.length ? { cartesAuto } : {}),
        ...(occupes.length ? { occupes } : {}),
        versionSimple: !!c.plafondClaudeAtteint,
        ...(lut ? { lookLutCle: lut.cle } : {}),
        prefixeCartes: cle("cartes"),
      });
      const demandes: EtatHabillage["cartes"] = [];
      const e = h.entree;
      // Lot G : sous-titres corrigés par Will (recalque) : ses groupes et ses mots, tels quels.
      if (etat.sousTitres?.length) e.segments = etat.sousTitres;
      for (const carte of h.cartes) {
        // Lot G : une carte identique déjà rendue par une version d'avant est reprise telle quelle (rien n'est rendu).
        const deja = etat.cartesReprises?.find((x) => x.empreinte === empreinte(JSON.stringify(carte.parametres)));
        if (deja) {
          const remplacer = <T extends { carteCle: string }>(l?: T[]) => l?.map((x) => (x.carteCle === carte.cle ? { ...x, carteCle: deja.cle } : x));
          e.ecransPartages = remplacer(e.ecransPartages);
          e.cartesPleinEcran = remplacer(e.cartesPleinEcran);
          e.misesEnPage = remplacer(e.misesEnPage);
          demandes.push({ id: carte.id, demande: demandeRenduCarte({ ...carte, cle: deja.cle }, ""), statut: "faite", essais: 0 });
          continue;
        }
        const signe = await outils.signer({}, [{ cle: carte.cle, mime: "video/mp4" }]);
        const demande = demandeRenduCarte(carte, signe.depots[carte.cle] ?? "");
        await outils.rendu().soumettre(demande);
        demandes.push({ id: carte.id, demande, statut: "soumise", essais: 0 });
      }
      // Lot I : effets spéciaux (après les cartes) ; leur carte révélée part avec les autres cartes.
      const fx = etat.monteur?.effets?.length ? await effetsDeLaChaine(montage, coupesSec, dureeSec, outils) : null;
      // V6 : bruitages demandés au monteur (banque du studio), posés au mixage avec ceux des effets.
      const bruitages = [...(fx?.bruitages ?? []), ...bruitagesDemandes(lireReglagesMonteur(c.entrees).son.bruitages, dureeSec)];
      for (const carte of fx?.cartes ?? []) {
        await outils.rendu().soumettre(carte.demande);
        demandes.push({ ...carte, statut: "soumise", essais: 0 });
      }
      // Lot F1 : habillage des autres formats (mêmes mots, mêmes raccords, mêmes cartes ; aucun format : rien). APRÈS les
      // cartes du 9:16 (Vérif V2) : studio-rendu rend un long travail à la fois, la vidéo attendue passe d'abord.
      if (etat.declinaisons) await preparerHabillagesFormats(etat, { dureeSec, mots, coupesSec, ...(cartes ? { cartes } : {}), ...cartesAutoRetirees, ...(cartesAuto.length ? { cartesAuto } : {}), ...(occupes.length ? { occupes } : {}), versionSimple: !!c.plafondClaudeAtteint, ...(lut ? { lookLutCle: lut.cle } : {}), prefixeCartes: cle("cartes") }, outils);
      etat.habillage = {
        ...(fx?.effets.length ? { effets: fx.effets } : {}),
        ...(h.cartesAuto.length ? { cartesAuto: h.cartesAuto } : {}),
        ...(h.cartesAutoVues.length || cartesAuto.length || retirees.length ? { cartesAutoFiche: { vues: h.cartesAutoVues, ajustements: cartesAuto, ...(retirees.length ? { retirees } : {}) } } : {}),
        cartes: demandes,
        base: {
          ...(bruitages.length ? { bruitages } : {}),
          plans: e.plans,
          segments: e.segments,
          dureeSec: e.dureeSec,
          mots: e.mots,
          audioCle: e.audioCle,
          pistesDouble: e.pistesDouble,
          pistesDepuisLook: true,
          supplements: { sourcePreCadree: e.sourcePreCadree, source10bits: e.source10bits, positionSousTitresPct: e.positionSousTitresPct, ecransPartages: e.ecransPartages, cartesPleinEcran: fx?.cartesPleinEcran.length ? [...(e.cartesPleinEcran ?? []), ...fx.cartesPleinEcran] : e.cartesPleinEcran, lookBroll: e.lookBroll, ...(e.textesAffiches?.length ? { textesAffiches: e.textesAffiches } : {}), ...controleCouleurs([...(e.cartesPleinEcran ?? []), ...(fx?.cartesPleinEcran ?? []), ...(e.ecransPartages ?? []), ...(e.misesEnPage ?? []), ...occupes], dureeSec, !!multicamera) },
          // Lot G : mises en page (côté, vignette).
          ...(e.misesEnPage?.length ? { supplementsMiseEnPage: { misesEnPage: e.misesEnPage } } : {}),
          ...(multicamera ? { multicamera } : {}),
        },
      };
      return;
    }
    const hab = etat.habillage;
    // Cartes : suivies, une nouvelle demande au plus ; une carte ratée est retirée (« 1 élément non fait »).
    for (const carte of hab.cartes) {
      if (carte.statut !== "soumise") continue;
      const s = await suivreRendu(outils.rendu(), carte.demande);
      if (s.statut === "termine") carte.statut = "faite";
      else if (s.statut === "echec") {
        if (s.erreur.reessayable && carte.essais < 1) {
          const signe = await outils.signer({}, [{ cle: carte.demande.sortie.cle, mime: "video/mp4" }]);
          carte.essais += 1;
          carte.demande = { ...carte.demande, idRendu: `${carte.demande.idRendu.replace(/-e\d+$/, "")}-e${carte.essais}`, sortie: { ...carte.demande.sortie, urlDepot: signe.depots[carte.demande.sortie.cle] ?? carte.demande.sortie.urlDepot } };
          await outils.rendu().soumettre(carte.demande);
        } else {
          carte.statut = "echec";
          const cleCarte = carte.demande.sortie.cle;
          const sup = hab.base.supplements ?? {};
          hab.base.supplements = { ...sup, ecransPartages: sup.ecransPartages?.filter((x) => x.carteCle !== cleCarte), cartesPleinEcran: sup.cartesPleinEcran?.filter((x) => x.carteCle !== cleCarte) };
          if (hab.base.supplementsMiseEnPage?.misesEnPage) hab.base.supplementsMiseEnPage = { misesEnPage: hab.base.supplementsMiseEnPage.misesEnPage.filter((x) => x.carteCle !== cleCarte) };
          sauter("Une carte", "Une animation n'a pas pu être rendue : la vidéo est livrée sans elle.");
        }
      }
    }
    // Lot I : effets spéciaux (soumis quand leur carte est prête, suivis, ratés retirés).
    if (hab.effets?.length && (await avancerEffetsChaine(hab, outils, sauter))) return;
    if (hab.cartes.some((x) => x.statut === "soumise")) return;
    // Composition finale (une seule, 9:16) : mêmes reprises que l'avocat (séries d'essais, échec définitif).
    hab.composition = await avancerCompositions(hab.composition ?? {}, commandeAvecVerre(c, hab.base), ["9:16"], hab.base, "complet", `${ctx.travailId}-facecam`, outils);
    const faite = hab.composition["9:16"];
    if (faite?.phase === "faite") hab.sortie = { fichierCle: faite.sortieCle, ...(faite.masterCle ? { masterCle: faite.masterCle } : {}), vignetteCle: faite.vignetteCle, alertes: faite.alertes, ...(faite.mesures ? { mesures: faite.mesures } : {}) };
  }

  /** Lot I : effets spéciaux préparés (piste `/visages`, coupes actives, cadre des plans, raccords, lumière). */
  async function effetsDeLaChaine(montage: { fichierCle?: string; vignetteCle?: string } | undefined, coupesSec: number[], dureeSec: number, outils: OutilsMontage) {
    const v = etat.travaux.visages?.resultat as { pisteVisageCle?: string; largeurSource?: number; hauteurSource?: number } | undefined;
    const piste = termine("visages") && v?.pisteVisageCle && deps.lireJsonGz ? (((await deps.lireJsonGz(v.pisteVisageCle).catch(() => null)) as PisteVisage | null) ?? null) : null;
    const vignette = deps.lireImageRvb ? await deps.lireImageRvb(montage?.vignetteCle ?? cle("vignette.jpg")).catch(() => null) : null;
    const fx = await preparerEffetsChaine(
      {
        passages: etat.monteur!.effets!,
        piste,
        gardes: etat.coupes!.gardes,
        dureeSourceSec: etat.coupes!.dureeSourceSec,
        plans: etat.plans,
        source: piste?.largeurSource && piste.hauteurSource ? { largeur: piste.largeurSource, hauteur: piste.hauteurSource } : dimensionsSource(etat),
        raccordsSec: coupesSec,
        pisteMonteeCle: montage?.fichierCle ?? cle("montage.mov"),
        prefixe: cle("effets"),
        vignette,
        dureeSec,
      },
      outils,
    );
    etat.monteur = { ...etat.monteur!, effets: fx.passages };
    if (fx.rates) sauter("Un effet spécial", "La main n'a pas été trouvée assez longtemps : la vidéo est livrée sans l'effet (« Refaire l'effet » sur Votre vidéo).");
    return fx;
  }

  async function calerMots(): Promise<void> {
    const coupes = etat.coupes!;
    const montes = motsDuMontage(termine("transcrire") ? await motsDeLaTranscription() : [], coupes.gardes);
    const duree = coupes.dureeSortieSec;
    // Texte validé horodaté par la transcription (orthographe du texte, jamais celle de Whisper : « Certifexemple »).
    const voix = coupes.texteMonte && montes.length ? horodaterMotsPrononces(coupes.texteMonte.split(/\s+/).filter(Boolean), montes) : montes;
    let mots = voix;
    let source: NonNullable<EtatChaine["mots"]>["source"] = coupes.texteMonte ? "texte" : "transcription";
    if (deps.alignement && deps.alignement.mode !== "simulation" && coupes.texteMonte && voix.length) {
      const suivi = etat.mots;
      if (!suivi) {
        const sonCle = (etat.travaux.son?.resultat as { fichierCle?: string } | undefined)?.fichierCle ?? cle("son.flac");
        const demande = demandeAlignement({ idBase: `${ctx.travailId}-facecam`, audio: await lire(sonCle), texte: coupes.texteMonte, reference: voix });
        try {
          await deps.alignement.soumettre(demande);
          etat.mots = { statut: "soumis", id: demande.idAlignement, essais: 0 };
        } catch {
          etat.mots = { statut: "fait", essais: 0, source, nombre: mots.length };
        }
        return;
      }
      const r = await deps.alignement.suivre(suivi.id!).catch(() => null);
      if (!r || r.statut === "en_file" || r.statut === "en_cours") return;
      if (r.statut === "termine") {
        const cale = appliquerAlignement(voix, r.resultat, duree);
        mots = cale.mots;
        if (cale.rapport.source !== "voix") source = "aligneur";
      }
      // Échec du calage : on garde l'horodatage de la transcription (jamais bloquant).
    }
    const cleMots = cle("mots-montes.json.gz");
    let depose = false;
    if (deps.ecrireJsonGz && !simule) {
      depose = await deps.ecrireJsonGz(cleMots, { version: 1, source, mots }).then(() => true, () => false);
    }
    etat.mots = { statut: "fait", essais: 0, source, nombre: mots.length, ...(depose ? { cle: cleMots } : {}) };
  }
}

function gardesSans(coupes: CoupeFacecam[], retablies: Set<string>, duree: number): Intervalle[] {
  const appliquees = coupes.filter((x) => !retablies.has(x.id)).sort((a, b) => a.debutSec - b.debutSec);
  const gardes: Intervalle[] = [];
  let t = 0;
  for (const x of appliquees) {
    if (x.debutSec > t + 1e-6) gardes.push({ debutSec: t, finSec: x.debutSec });
    t = Math.max(t, x.finSec);
  }
  if (duree > t + 1e-6) gardes.push({ debutSec: t, finSec: duree });
  return gardes;
}

/** V6 : zooms demandés au monteur (passages `zoom`, temps du montage). */
export function zoomsDesPassages(passages: PassageFacecam[]): { debutSec: number; finSec: number }[] {
  return passages.filter((p) => (p as PassageMonteur).operation?.type === "zoom" && p.finSec >= p.debutSec).map((p) => ({ debutSec: p.debutSec, finSec: p.finSec }));
}

/**
 * V6 : carte ramenée dans la vidéo montée. Un générique de fin (posé à la fin de la prise) occupe les dernières
 * secondes ; une carte qui déborde est coupée à la fin ; une carte tout entière après la fin est écartée.
 */
export function carteDansLaVideo(carte: CarteMonteur, dureeSec: number): CarteMonteur | null {
  if (!(dureeSec > 0) || carte.finSec <= dureeSec) return carte;
  const longueur = Math.min(carte.finSec - carte.debutSec, dureeSec);
  if (carte.debutSec >= dureeSec - 1) return { ...carte, debutSec: +Math.max(0, dureeSec - longueur).toFixed(3), finSec: +dureeSec.toFixed(3) };
  return carte.debutSec < dureeSec ? { ...carte, finSec: +dureeSec.toFixed(3) } : null;
}

/* ------------------------------------------------------------------ */
/* Résultat                                                            */
/* ------------------------------------------------------------------ */

/** Ce que la chaîne livre : la piste montée, les données du face caméra (clés R2 + coupes + consignes), les alertes. */
export function livraisonChaine(etat: EtatChaine): {
  montageCle?: string;
  /** Mots de la vidéo montée (json.gz sur R2) : sous-titres et agent monteur. */
  motsMontesCle?: string;
  dureeSec: number;
  facecam: Partial<EntreesFacecam> & { coupes: EntreesFacecam["coupes"] };
  alertes: AlerteQualite[];
  version: "complete" | "partielle";
} {
  const montage = etat.travaux.cadrage?.resultat as { fichierCle?: string; dureeSec?: number; controles?: ControlesMontage } | undefined;
  const passe = etat.travaux.passe?.resultat as { mesures?: MesuresImage } | undefined;
  const visages = etat.travaux.visages?.resultat as { pisteVisageCle?: string; pointsCle?: string } | undefined;
  const transcription = etat.travaux.transcrire?.resultat as { transcriptionCle?: string } | undefined;
  const coupes = etat.coupes;
  const consignesAudibles = coupes ? coupes.consignes.filter((x) => coupes.gardes.some((g) => x.finSec > g.debutSec + 0.02 && x.debutSec < g.finSec - 0.02)).length : 0;
  const alertes = alertesControles(montage?.controles, passe?.mesures, coupes, consignesAudibles);
  for (const s of etat.sauts) alertes.push({ code: "export", gravite: "attention", message: `1 élément non fait — ${s.brique} : ${s.message}` });
  return {
    montageCle: montage?.fichierCle,
    motsMontesCle: etat.mots?.cle,
    dureeSec: Number(montage?.dureeSec) || coupes?.dureeSortieSec || 0,
    facecam: {
      ...(visages?.pisteVisageCle ? { pisteVisageCle: visages.pisteVisageCle } : {}),
      ...(visages?.pointsCle ? { masquesCle: visages.pointsCle } : {}),
      ...(coupes?.transcriptionCle || transcription?.transcriptionCle ? { transcriptionCle: coupes?.transcriptionCle ?? transcription?.transcriptionCle } : {}),
      coupes: { auto: coupes?.liste ?? [], retablies: [] },
      consignes: versConsignesFacecam(coupes?.consignes ?? []),
      // Lot I : passages d'effets à jour (drapeaux « Effet non réussi — Réessayer »), recopiés par identifiant.
      ...(etat.monteur?.effets?.length ? { passages: etat.monteur.effets } : {}),
      // Vérif V1 : cartes automatiques réellement posées dans cette version (liste vide : aucune).
      ...(etat.habillage && !etat.habillage.abandonne ? { cartesAuto: etat.habillage.cartesAuto ?? [] } : {}),
    },
    alertes,
    version: etat.sauts.length ? "partielle" : "complete",
  };
}

/** Mots entendus dans la vidéo montée (temps du montage), pour les sous-titres et l'agent monteur (lot C / D). */
export function motsMontes(mots: MotHorodate[], etat: EtatChaine): MotHorodate[] {
  return etat.coupes ? motsDuMontage(mots, etat.coupes.gardes) : mots;
}

export { controlerRealisation };
