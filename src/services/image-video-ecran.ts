/**
 * ÉCRANS DE L'ONGLET « IMAGE → VIDÉO » (lot L16, plan § 8) : ce que les 5 écrans lisent et les gestes de Will, posés
 * sur la machine du lot L15 (services `image-video-carte.ts` et `image-video-scripts.ts`, moteur `montage-image-video`).
 *
 *  1. `deposerImageVideo` : l'image envoyée (dépôt par morceaux), les réseaux, l'offre → un brouillon du format (avec
 *     son script provisoire : le texte est écrit après la lecture de l'image) puis le lancement commun
 *     (`lancerAvecAccord`), REFUSÉ tant que le montant affiché n'est pas confirmé ; lancement refusé : brouillon archivé ;
 *  2. `validerCarteEtReprendre` : la carte (corrigée ou non) est gardée, puis l'étape arrêtée reprend (rien n'est repayé) ;
 *  3. `validerScriptEtReprendre` : le script (modifié ou non) et les choix sur les formules sont gardés, puis la
 *     fabrication reprend avec l'accord du prix affiché ; la voix n'est payée qu'après ;
 *  4. `vueImageVideo` : l'écran à montrer et tout ce qu'il affiche (avancement, dépense, refus en une phrase) ;
 *  5. `reessayerImageVideo` : « Refaire cette partie » après un arrêt.
 *
 * Fabrication menée par le LANCEUR (travail vitrine `lanceurIV`) : seul le lanceur l'avance. Les validations y sont
 * seulement gardées (le lanceur les relit ; le script avec l'accord du prix, dans la même écriture) ; « Refaire cette
 * partie » le dit en une phrase (relancer le lanceur) au lieu de marquer « en cours » un travail que rien n'avance.
 *
 * Le format reste masqué : aucune ligne de menu ; l'adresse directe `/image-video` suffit. Tant que les 5 raccords
 * partagés ne sont pas posés (lot L17), le studio ne connaît pas le format : le dépôt le dit en une phrase, rien n'est créé.
 */
import "server-only";
import type { AccordPrix } from "@/domaine/accord";
import type { CarteImage } from "@/domaine/image-video/carte";
import type { FicheImage } from "@/domaine/image-video/fiche";
import { PHRASE_TIKTOK_RETIRE_IV, RESEAUX_IV, type ReseauIV } from "@/domaine/image-video/plafonds";
import { depenseDesEtapes } from "@/domaine/suivi";
import { cleFichierRef, clesFichier, type CandidatSujet, type Confirmation, type NiveauSujet, type Precedent, type Suggestion } from "@/domaine/sujets-traites";
import type { BlocScript, CommandeFabrication, Distribution, Fichier, Id, Montant, Travail } from "@/domaine/types";
import { OFFRES, type Offre } from "@/formats/cas-concret/cas";
import { ID_FORMAT_IMAGE_VIDEO } from "@/formats/image-video";
import { additionner, TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";
import { CLE_LANCEUR_IV, engageCentimes, euros, estimerImageVideo, plafondProposeIV, releverPlafondIV, type EtatFabricationIV, type FormuleATrancherIV, type PrixIV } from "@/moteurs/montage-image-video";
import { avecVersionsPrudentes, type ChoixFormule } from "@/domaine/image-video/versions-prudentes";
// Ré-export : la fonction vit désormais dans le domaine (pure, utilisable côté client).
export { avecVersionsPrudentes, cleFormule } from "@/domaine/image-video/versions-prudentes";
import { variantesPossiblesIV } from "@/moteurs/montage-image-video/fabrication";
import type { AxeVariete, RecetteVarieteIV } from "@/briques/schema-motion/variete";
import {
  barreDe,
  cartesReseaux,
  ecranDe,
  PHRASE_IMAGE_TROP_LOURDE,
  refusDimensions,
  TAILLE_MAX_IMAGE_OCTETS,
  vueDeLaCarte,
  vueFabrication,
  type CarteReseauIV,
  type EcranIV,
  type VueCarte,
  type VueFabrication,
} from "@/components/formats/image-video/vue";
import { empreinteAvantControle, phraseRefusEmpreinte, type DependancesAvantControle } from "./empreintes-fichiers";
import { creerVerrou, depots, ErreurStudio, fournisseur, journaliser, lireParametre, sousVerrou } from "./_commun";
import type { SourcesSujets } from "./sujets-traites";
import { exigerSession } from "./auth";

// ─── Phrases ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export const PHRASES_IV = Object.freeze({
  pasRaccorde: "« Image → vidéo » n'est pas encore relié au studio : le dépôt ouvrira dès son raccordement. Rien n'a été créé.",
  sansVoix: "Ajoutez d'abord votre voix dans Personnages : la vidéo est dite avec elle.",
  sansReseau: "Cochez au moins un réseau.",
  tiktokRetire: PHRASE_TIKTOK_RETIRE_IV,
  fichier: "L'image n'est pas arrivée. Déposez-la à nouveau.",
  introuvable: "Cette vidéo n'existe plus.",
  rienAReprendre: "Rien à reprendre pour cette vidéo.",
  panne: "Le studio ne répond pas pour l'instant. Réessayez dans un instant.",
  lanceur: "Cette vidéo est fabriquée par le lanceur, hors du studio : relancez le lanceur (la même commande) pour reprendre. Rien de déjà payé n'est refait.",
  plafondEnCours: "La fabrication avance : relevez le plafond quand elle est arrêtée.",
  plafondLanceur: "Cette vidéo est fabriquée par le lanceur, hors du studio : son plafond se règle au lancement.",
  plafondMontant: "Indiquez un montant en euros.",
  plafondChange: "La vidéo a changé entre-temps : rechargez la page.",
});

/** Accord de Will pour un essai réel tant que le format est masqué (réglage du studio, posé par Will). */
export const PARAM_ACCORD_ESSAI_IV = "imageVideo.accordEssaiReel";

/** Réglage ÉTEINT par défaut : allumé, le script passe par l'écran commun « Relire le script » (sinon l'ancien parcours). */
export const PARAM_RELIRE_SCRIPT_IV = "imageVideo.relireScript";

// ─── Prix du dépôt ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Prix au pire de la vidéo, affiché sur le bouton du dépôt (même calcul que le moteur au lancement). PUR. */
export function prixDuDepot(reseaux: readonly ReseauIV[], tauxUsdEur = TAUX_USD_EUR_PAR_DEFAUT): number {
  const commande = { entrees: { imageVideo: { reseaux: [...reseaux] } }, tauxUsdEur, dureeCibleSec: 50 } as unknown as CommandeFabrication;
  return estimerImageVideo(commande).total.centimes;
}

// ─── Écran 1 · Déposer ───────────────────────────────────────────────────────────────────────────────────────────────

export interface EtatDepotIV {
  /** Le studio connaît le format (raccords posés). */
  ouvert: boolean;
  voixPrete: boolean;
  /** Prix pour les quatre réseaux (centimes d'euro). */
  montantCentimes: number;
  /** Taux dollar → euro du studio (le même pour tous les prix affichés). */
  tauxUsdEur: number;
  /** Phrase qui empêche le dépôt (avant tout clic) ; absente : rien ne s'y oppose. */
  blocage?: string;
}

export interface DemandeDepotIV {
  fichierId: string;
  reseaux: string[];
  offre?: string;
  largeur: number;
  hauteur: number;
  /** Montant affiché et confirmé (centimes d'euro). */
  accordCentimes?: AccordPrix;
  titre?: string;
  /** « Refaire quand même » : le choix et le jeton du refus « image déjà traitée », renvoyés tels quels. */
  sujet?: { choix: "refaire" | "nouvel-angle"; jeton: string };
}

/** Image déjà traitée (lot L6) : rien n'est créé ni payé ; l'écran propose « Choisir une autre image » ou « Refaire quand même ». */
export interface RefusSujetImageVideo {
  statut: "sujet-deja-traite";
  niveau: NiveauSujet;
  precedents: Precedent[];
  suggestions: Suggestion[];
  jeton: string;
  /** La confirmation reçue ne correspond plus aux vidéos d'aujourd'hui : redemander. */
  jetonPerime?: boolean;
  phrase: string;
}

export type IssueDepotIV =
  | { statut: "lancee"; videoId: Id; avertissement?: { niveau: NiveauSujet; precedents: Precedent[] } }
  | { statut: "accord-requis"; centimes: number; phrase: string }
  | RefusSujetImageVideo
  | { statut: "refusee"; phrase: string };

/** Générateur du contrôle « sujet déjà traité ». */
export const GENERATEUR_SUJET_IV = "image-video";

/** Phrases du refus (le sujet d'une image est l'image elle-même). */
export const PHRASE_IMAGE_DEJA_TRAITEE = "Cette image est déjà traitée.";

/** Candidat du contrôle pour une image : empreinte, nom + taille et références du fichier ; le texte n'est pas utilisé. PUR. */
export function candidatImageIV(f: { id: string; cleStockage: string; nom: string; taille?: number; sha256?: string }): CandidatSujet {
  const cles = [...clesFichier({ ...(f.sha256 ? { sha256: f.sha256 } : {}), nom: f.nom, ...(typeof f.taille === "number" ? { taille: f.taille } : {}) }), cleFichierRef(f.id), cleFichierRef(f.cleStockage)];
  return { generateur: GENERATEUR_SUJET_IV, cles: [...new Set(cles)] };
}

/** La confirmation reçue de l'écran (donnée non sûre) : un choix connu et un jeton, sinon rien. */
export function confirmationPropreIV(brut: unknown): Confirmation | undefined {
  const b = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  return (b.choix === "refaire" || b.choix === "nouvel-angle") && typeof b.jeton === "string" && b.jeton ? { choix: b.choix, jeton: b.jeton } : undefined;
}

/** Un seul dépôt à la fois : le contrôle « déjà traité » et le lancement qui suit ne s'entrecroisent pas (double clic, deux onglets). */
const verrouDepotUnique = creerVerrou();

/** Ce que le dépôt lit du studio (doubles dans les tests). */
export interface DependancesEcranIV {
  formatOuvert?: () => boolean | Promise<boolean>;
  voix?: () => Promise<{ voixId: Id; personnageId: Id } | null>;
  fichier?: (fichierId: string) => Promise<Pick<Fichier, "id" | "cleStockage" | "mime" | "sha256" | "nom" | "taille">>;
  /** Rend le fichier AVEC son empreinte sha256 (copie renommée reconnue) ; échec = dépôt refusé. Défaut : `empreinteAvantControle`. */
  empreinte?: <T extends Pick<Fichier, "id" | "cleStockage" | "sha256">>(f: T) => Promise<T>;
  /** Tests : stockage et délais de l'empreinte par défaut. */
  optionsEmpreinte?: DependancesAvantControle;
  accordEssai?: () => Promise<boolean>;
  taux?: () => Promise<number>;
  brouillon?: (e: { titre: string; sujet: string; distribution: Distribution[]; entrees: Record<string, unknown> }) => Promise<{ id: Id }>;
  lancer?: (videoId: Id, accord: AccordPrix | undefined, montantCentimes: number) => Promise<{ statut: "lancee"; travailId: Id } | { statut: "accord-requis"; centimes: number; phrase: string }>;
  /** Brouillon d'un dépôt dont le lancement est refusé : archivé (jamais effacé). */
  abandonner?: (videoId: Id) => Promise<void>;
  /** Sources du contrôle « image déjà traitée » (tests : de faux dépôts) ; par défaut les dépôts du studio. */
  sourcesSujets?: SourcesSujets;
  /** Réservé au serveur : « Refaire » d'un lot est voulu, aucun contrôle de sujet. */
  sansControleSujet?: boolean;
}

async function formatOuvertParDefaut(): Promise<boolean> {
  const { trouverFormat } = await import("@/formats");
  return !!trouverFormat(ID_FORMAT_IMAGE_VIDEO);
}

async function voixParDefaut() {
  const { voixDeReference } = await import("./cas-concret");
  return voixDeReference();
}

async function fichierParDefaut(fichierId: string) {
  const { fichierEnvoye } = await import("./fichiers");
  return fichierEnvoye(fichierId, "entree");
}

const tauxDuStudio = () => lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT);

/** L'état de l'écran « Déposer » : ouvert ou non, voix prête, prix des quatre réseaux. Jamais d'exception. */
export async function etatDepotImageVideo(dep: DependancesEcranIV = {}): Promise<EtatDepotIV> {
  await exigerSession();
  let ouvert = false;
  let voixPrete = false;
  let taux = TAUX_USD_EUR_PAR_DEFAUT;
  try {
    [ouvert, voixPrete, taux] = await Promise.all([(dep.formatOuvert ?? formatOuvertParDefaut)(), (dep.voix ?? voixParDefaut)().then((v) => !!v), (dep.taux ?? tauxDuStudio)()]);
  } catch {
    // Lecture impossible : le dépôt reste fermé, avec la phrase.
  }
  const blocage = !ouvert ? PHRASES_IV.pasRaccorde : !voixPrete ? PHRASES_IV.sansVoix : undefined;
  return { ouvert, voixPrete, montantCentimes: prixDuDepot(RESEAUX_IV, taux), tauxUsdEur: taux, ...(blocage ? { blocage } : {}) };
}

/** « Lancer » (écran 1) : voir l'en-tête. Rien n'est créé tant que l'accord manque ; lancement refusé : rien ne reste en brouillon. */
export async function deposerImageVideo(d: DemandeDepotIV, dep: DependancesEcranIV = {}): Promise<IssueDepotIV> {
  await exigerSession();
  const refusImage = refusDimensions(Number(d.largeur), Number(d.hauteur));
  if (refusImage) return { statut: "refusee", phrase: refusImage };
  const reseaux = RESEAUX_IV.filter((r) => d.reseaux.includes(r));
  if (!reseaux.length) return { statut: "refusee", phrase: (d.reseaux as readonly string[]).includes("tiktok") ? PHRASES_IV.tiktokRetire : PHRASES_IV.sansReseau };
  const offre = OFFRES.includes(d.offre as Offre) ? (d.offre as Offre) : undefined;
  if (!(await (dep.formatOuvert ?? formatOuvertParDefaut)())) return { statut: "refusee", phrase: PHRASES_IV.pasRaccorde };
  const voix = await (dep.voix ?? voixParDefaut)();
  if (!voix) return { statut: "refusee", phrase: PHRASES_IV.sansVoix };
  let fichier: Awaited<ReturnType<NonNullable<DependancesEcranIV["fichier"]>>>;
  try {
    fichier = await (dep.fichier ?? fichierParDefaut)(d.fichierId);
  } catch (e) {
    return { statut: "refusee", phrase: e instanceof ErreurStudio ? e.message : PHRASES_IV.fichier };
  }
  if (!/^image\/(png|jpeg|webp)$/.test(fichier.mime)) return { statut: "refusee", phrase: "Déposez une image PNG, JPEG ou WebP." };
  if (!(fichier.taille <= TAILLE_MAX_IMAGE_OCTETS)) return { statut: "refusee", phrase: PHRASE_IMAGE_TROP_LOURDE };
  // Empreinte du contenu AVANT le contrôle « déjà traité » et hors de tout verrou : une copie renommée est reconnue. Échec : rien n'est créé.
  // Garde « éteint » (ou contrôle coupé) : aucune lecture du stockage, exactement comme avant.
  if (!dep.sansControleSujet) {
    const { lireGardeSujets } = await import("./sujets-traites");
    const { sourcesSujetsIV } = await import("./image-video-lot");
    if ((await lireGardeSujets(await sourcesSujetsIV(dep.sourcesSujets))) !== "eteint") {
      try {
        fichier = await (dep.empreinte ?? ((f) => empreinteAvantControle(f, dep.optionsEmpreinte)))(fichier);
      } catch (e) {
        console.error("[empreinte] dépôt image → vidéo", e);
        return { statut: "refusee", phrase: phraseRefusEmpreinte(e) };
      }
    }
  }
  const montant = prixDuDepot(reseaux, await (dep.taux ?? tauxDuStudio)());
  return verrouDepotUnique<IssueDepotIV>(async () => {
    // Image déjà traitée (lot L6) : SEULEMENT pour un nouveau dépôt, AVANT le prix, le brouillon et toute dépense. Un refus
    // ne crée rien. Une vidéo en échec ne compte pas au registre : la relancer ou redéposer l'image reste libre.
    let avertissement: { niveau: NiveauSujet; precedents: Precedent[] } | undefined;
    let choixForce: string | undefined;
    if (!dep.sansControleSujet) {
      const { verifierSujet } = await import("./sujets-traites");
      const { sourcesSujetsIV } = await import("./image-video-lot");
      const v = await verifierSujet(candidatImageIV(fichier), confirmationPropreIV(d.sujet), await sourcesSujetsIV(dep.sourcesSujets));
      if (!v.ok) {
        // Pas de suggestions : la banque de l'Usine propose des sujets de script, rien qui aide à choisir une autre image.
        const { niveau, precedents, jeton, jetonPerime } = v;
        const suggestions: Suggestion[] = [];
        return { statut: "sujet-deja-traite" as const, niveau, precedents, suggestions, jeton, ...(jetonPerime ? { jetonPerime: true } : {}), phrase: PHRASE_IMAGE_DEJA_TRAITEE };
      }
      avertissement = v.avertissement;
      choixForce = v.confirme;
    }
    const accord = typeof d.accordCentimes === "number" && Number.isFinite(d.accordCentimes) ? d.accordCentimes : undefined;
    // Accord absent ou plus bas que le prix : rien n'est créé, le prix est redemandé.
    if (accord === undefined || accord < montant) return { statut: "accord-requis", centimes: montant, phrase: `Cette vidéo coûte au plus ${(montant / 100).toFixed(2).replace(".", ",")} €. Confirmez ce prix pour lancer.` };
    const accordEssaiReel = await (dep.accordEssai ?? (() => lireParametre<boolean>(PARAM_ACCORD_ESSAI_IV, false)))();
    const titre = (d.titre?.trim() || fichier.nom.replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[-_]+/g, " ").trim() || "Image → vidéo").slice(0, 80);
    const entrees = {
      imageVideo: {
        imageCle: fichier.cleStockage,
        fichierId: fichier.id,
        ...(fichier.sha256 ? { empreinte: fichier.sha256 } : {}),
        reseaux,
        ...(offre ? { offre } : {}),
        largeur: Math.round(d.largeur),
        hauteur: Math.round(d.hauteur),
        // Décision de Will (15/10) : le plafond de la caisse (et le plafond Claude propre, qui le suit) est le prix « au
        // plus » affiché et confirmé, jamais un plafond fixe qui arrêterait la vidéo en cours de route.
        plafondCentimes: montant,
        accordEssaiReel: accordEssaiReel === true,
      },
    };
    const distribution: Distribution[] = [{ role: "voix", source: "double", personnageId: voix.personnageId, voixId: voix.voixId }];
    const video = await (dep.brouillon ?? brouillonParDefaut)({ titre, sujet: titre, distribution, entrees });
    // Lancement refusé (ou prix redemandé) : le brouillon de ce dépôt est abandonné (archivé, jamais effacé) ; le
    // prochain dépôt en crée un neuf. Seul ce brouillon est touché.
    const abandonner = () => (dep.abandonner ?? abandonnerParDefaut)(video.id).catch(() => undefined);
    try {
      const issue = await (dep.lancer ?? lancerParDefaut)(video.id, accord, montant);
      if (issue.statut === "accord-requis") {
        await abandonner();
        return issue;
      }
      await journaliser("video", "Image déposée : « Image → vidéo » lancée", { type: "video", id: video.id }).catch(() => undefined);
      // Choix forcé (« Refaire quand même ») : la trace reste dans le journal.
      if (choixForce) await journaliser("video", `Image → vidéo : image déjà traitée, dépôt voulu quand même (choix « ${choixForce} »)`, { type: "video", id: video.id }).catch(() => undefined);
      return { statut: "lancee", videoId: video.id, ...(avertissement ? { avertissement } : {}) };
    } catch (e) {
      if (e instanceof ErreurStudio) await abandonner();
      if (e instanceof ErreurStudio && e.code === "CONFIRMATION_REQUISE" && typeof e.montant === "number") return { statut: "accord-requis", centimes: e.montant, phrase: e.message };
      if (e instanceof ErreurStudio) return { statut: "refusee", phrase: e.message };
      throw e;
    }
  });
}

/**
 * Le script PROVISOIRE du dépôt : ce format écrit son texte APRÈS la lecture de l'image (écran « Votre script »), mais
 * le lancement commun exige un script rattaché, comme pour les autres formats (le tableau animé et le cas concret
 * rattachent le leur par `enregistrerScriptDuBrouillon` avant le lancement). Un bloc vide : la durée reste celle du
 * format (`dureeVideo` sans texte), donc le prix du lancement est celui affiché au dépôt. Le moteur ne le lit pas.
 */
export const BLOCS_SCRIPT_PROVISOIRE_IV = (videoId: Id): BlocScript[] => [{ id: `${videoId}-b1`, blocRecette: "explication", segments: [{ id: `${videoId}-s1`, texte: "" }] }];

async function brouillonParDefaut(e: { titre: string; sujet: string; distribution: Distribution[]; entrees: Record<string, unknown> }) {
  const { nouveauBrouillonFormat } = await import("./creation-format");
  const video = await nouveauBrouillonFormat({ formatId: ID_FORMAT_IMAGE_VIDEO, ...e });
  const { enregistrerScriptDuBrouillon } = await import("./videos");
  await enregistrerScriptDuBrouillon(video.id, BLOCS_SCRIPT_PROVISOIRE_IV(video.id));
  return video;
}

async function abandonnerParDefaut(videoId: Id) {
  const { abandonnerBrouillon } = await import("./videos");
  await abandonnerBrouillon(videoId);
}

async function lancerParDefaut(videoId: Id, accord: AccordPrix | undefined, montant: number) {
  const { lancerAvecAccord } = await import("./creation-format");
  return lancerAvecAccord(videoId, accord, montant);
}

// ─── Écrans 2 à 5 · la vue ───────────────────────────────────────────────────────────────────────────────────────────

export interface VueImageVideo {
  videoId: Id;
  titre: string;
  travailId: Id | null;
  /** Fabrication menée par le studio (pas le lanceur) et en cours : le bouton « Arrêter » est tenu. */
  arret?: { travailId: Id; depense: Montant };
  /** Fabrication arrêtée par Will. */
  arretee?: boolean;
  ecran: EcranIV;
  /** Étape allumée dans la barre des 5 écrans. */
  barre: EcranIV;
  imageUrl: string | null;
  carte?: { vue: VueCarte; carte: CarteImage; empreinte: string };
  script?: {
    fiche: FicheImage;
    formules: FormuleATrancherIV[];
    aTrancher: string[];
    prix: PrixIV;
    empreinte: string;
    avecQuestion: boolean;
    /** Vrai : le script se relit dans l'écran commun « Relire le script » (réglage `imageVideo.relireScript`). */
    relireScript?: boolean;
    /** Recette de variété tirée, et ce que l'image permet axe par axe (absente : fabrication d'avant la variété). */
    variete?: { recette: RecetteVarieteIV; possibles: Record<AxeVariete, string[]> };
  };
  fabrication: VueFabrication;
  videos?: (CarteReseauIV & { url?: string | null; urlFil?: string | null })[];
  verdict?: { ok: boolean; phrase: string; mentions: string[] };
  /** La fabrication avance seule (l'écran se relit). */
  enCours: boolean;
  /** Lot d'images : la vidéo est mise de côté à cette porte (« Mise de côté : motif »), en tête de l'écran. */
  miseDeCote?: string;
  /** Lot d'images : le lot de cette vidéo (retour de la page). */
  lot?: { id: Id; n: number };
  /** « Relever le plafond » possible (hors fabrication en cours, hors lanceur) : montant proposé, arrêt sur le plafond. */
  plafond?: { proposeCentimes: number; arrete: boolean };
}

/** Ce que la vue lit du studio (doubles dans les tests). */
export interface DependancesVueIV {
  video?: (videoId: Id) => Promise<{ id: Id; titre: string; formatId: string; entrees?: Record<string, unknown> } | null>;
  travail?: (videoId: Id) => Promise<Travail | null>;
  url?: (cle: string) => Promise<string | null>;
  relireScript?: () => Promise<boolean>;
  /** Dépenses déjà enregistrées pour ce travail (lecture, écriture, voix) ; défaut : le dépôt du studio. */
  depenses?: (travailId: Id) => Promise<Montant[]>;
}

const objet = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function etatDe(t: Travail | null): EtatFabricationIV | null {
  const e = t?.parametres?.imageVideo as EtatFabricationIV | undefined;
  return e && typeof e === "object" && e.version === "fabrication-iv/1" ? e : null;
}

async function urlParDefaut(cle: string): Promise<string | null> {
  try {
    return (await (await fournisseur("stockage")).urlLecture(cle)) || null;
  } catch {
    return null;
  }
}

/** Vue PURE (hors lecture du studio) : l'écran et ce qu'il montre, d'après le travail et son état. */
export function construireVueImageVideo(video: { id: Id; titre: string }, travail: Travail | null, imageUrl: string | null): VueImageVideo {
  const etat = etatDe(travail);
  const enCours = travail?.statut === "en_cours" || travail?.statut === "en_file";
  const arretee = travail?.statut === "annule";
  const base = {
    videoId: video.id,
    titre: video.titre,
    travailId: travail?.id ?? null,
    imageUrl,
    enCours,
    ...(arretee ? { arretee: true } : {}),
    // « Arrêter » seulement si l'arrêt est tenu : le lanceur ne lit jamais l'annulation et continuerait de payer.
    ...(travail && enCours && !meneParLeLanceur(travail) ? { arret: { travailId: travail.id, depense: depenseDesEtapes(travail.etapes ?? []) } } : {}),
  };
  if (!etat) {
    // Lancement refusé ou travail sans état : la phrase du travail, jamais un code.
    const phrase = travail?.erreur?.messagePourWill ?? (travail ? "La fabrication démarre." : "La fabrication n'a pas encore démarré.");
    const fabrication: VueFabrication = { pas: [], engageCentimes: 0, plafondCentimes: 0, payeCentimes: 0, attente: false, ...(travail?.statut === "echec" ? { refus: { phrase, details: [], reessayable: travail.erreur?.reessayable !== false } } : {}) };
    return { ...base, ecran: "fabrication", barre: "carte", fabrication };
  }
  const fabrication = vueFabrication(etat);
  // Arrêt hors machine (outils non reliés, plafond du studio) : dit comme un refus de l'étape en cours.
  if (!fabrication.refus && travail?.statut === "echec" && travail.erreur && !etat.propositionCarte && !etat.propositionScript) {
    fabrication.refus = { phrase: travail.erreur.messagePourWill, details: [], reessayable: travail.erreur.reessayable !== false };
  }
  const vue: VueImageVideo = { ...base, ecran: ecranDe(etat), barre: barreDe(etat), fabrication };
  if (!enCours && !arretee && etat.etape !== "prete" && !meneParLeLanceur(travail)) vue.plafond = { proposeCentimes: plafondProposeIV(etat), arrete: etat.refus?.code === "IV_PLAFOND" };
  if (vue.ecran === "carte" && etat.propositionCarte) {
    const p = etat.propositionCarte;
    vue.carte = { vue: vueDeLaCarte(p.carte, p.doutes), carte: p.carte, empreinte: p.empreinte };
  }
  if (vue.ecran === "script" && etat.propositionScript) {
    const p = etat.propositionScript;
    vue.script = {
      fiche: p.fiche,
      formules: p.formules,
      aTrancher: p.aTrancher.filter((m) => !m.regle.startsWith("Q05")).map((m) => m.message),
      prix: p.prix,
      empreinte: p.empreinte,
      avecQuestion: etat.demande.appelCommentaire === "question-puis-fin",
      ...(etat.variete && etat.carte ? { variete: { recette: etat.variete.recette, possibles: variantesPossiblesIV(etat.carte.carte) } } : {}),
    };
  }
  if (etat.miseDeCote) vue.miseDeCote = `Mise de côté : ${etat.miseDeCote.motif}`;
  if (etat.controles?.verdict) vue.verdict = { ok: etat.controles.verdict.ok, phrase: etat.controles.verdict.phrase, mentions: [...etat.controles.verdict.mentions] };
  if (etat.livraison?.length) vue.videos = cartesReseaux(etat.livraison);
  return vue;
}

/** Le dernier travail « Image → vidéo » d'une vidéo (même lecture que les services du lot L15). */
async function travailParDefaut(videoId: Id): Promise<Travail | null> {
  const { travailImageVideo } = await import("./image-video-carte");
  return travailImageVideo(videoId);
}

/** Tout ce que les écrans 2 à 5 montrent ; `null` : vidéo inconnue ou d'un autre format. */
export async function vueImageVideo(videoId: Id, dep: DependancesVueIV = {}): Promise<VueImageVideo | null> {
  await exigerSession();
  const video = await (dep.video ?? ((id: Id) => depots().videos.obtenir(id)))(videoId);
  if (!video) return null;
  if (video.formatId !== ID_FORMAT_IMAGE_VIDEO) return null;
  const travail = await (dep.travail ?? travailParDefaut)(videoId);
  const url = dep.url ?? urlParDefaut;
  const imageCle = objet(objet(video.entrees).imageVideo).imageCle;
  const vue = construireVueImageVideo(video, travail, typeof imageCle === "string" && imageCle ? await url(imageCle) : null);
  const lotId = objet(objet(objet(video.entrees).imageVideo).lot).id;
  if (typeof lotId === "string" && lotId) {
    const { lireLotIV } = await import("./image-video-lot");
    const lot = await lireLotIV(lotId).catch(() => null);
    if (lot) vue.lot = { id: lot.id, n: lot.videos.length };
  }
  if (vue.arret) {
    // Même total que l'arrêt (`annulerTravail`) : tout ce que ce travail a déjà coûté, lecture et écriture comprises.
    const lues = await (dep.depenses ?? ((id: Id) => depots().depenses.lister((x) => x.travailId === id).then((l) => l.map((x) => x.total))))(vue.arret.travailId).catch(() => [] as Montant[]);
    const total = additionner(...lues);
    if (total.centimes > vue.arret.depense.centimes) vue.arret = { ...vue.arret, depense: total };
  }
  if (vue.script && (await (dep.relireScript ?? (() => lireParametre<boolean>(PARAM_RELIRE_SCRIPT_IV, false)))())) vue.script.relireScript = true;
  if (vue.videos) vue.videos = await Promise.all(vue.videos.map(async (v) => ({ ...v, url: v.fichierCle ? await url(v.fichierCle) : null, ...(v.fil ? { urlFil: await url(v.fil.fichierCle) } : {}) })));
  return vue;
}

// ─── Gestes de Will ──────────────────────────────────────────────────────────────────────────────────────────────────

export type IssueRepriseIV = { statut: "reprise" } | { statut: "accord-requis"; centimes: number; phrase: string } | { statut: "refusee"; phrase: string };

/** Ce que les gestes appellent (doubles dans les tests). */
export interface DependancesGestesIV {
  travail?: (videoId: Id) => Promise<Travail | null>;
  validerCarte?: (videoId: Id, e: { carte?: CarteImage }) => Promise<unknown>;
  validerScript?: (videoId: Id, e: { fiche?: FicheImage; choixFormules?: Record<string, ChoixFormule>; ajoutsWill?: string[]; variete?: Partial<RecetteVarieteIV> }, accord?: AccordPrix) => Promise<unknown>;
  reessayer?: (travailId: Id, accord?: AccordPrix) => Promise<unknown>;
}

async function reessayerParDefaut(travailId: Id, accord?: AccordPrix) {
  const { reessayerTravail } = await import("./travaux");
  return reessayerTravail(travailId, accord !== undefined ? { confirme: accord } : {});
}

const meneParLeLanceur = (t: Travail | null) => t?.parametres?.[CLE_LANCEUR_IV] === true;

/**
 * Reprise du travail arrêté (porte de Will franchie ou refus) ; prix à confirmer : rendu à l'écran. Vitrine du lanceur :
 * jamais relancée ici (rien ne l'avancerait) ; après une validation, le lanceur relit la décision (`apresValidation`).
 */
async function reprendre(videoId: Id, accord: AccordPrix | undefined, dep: DependancesGestesIV, apresValidation = false): Promise<IssueRepriseIV> {
  const travail = await (dep.travail ?? travailParDefaut)(videoId);
  if (meneParLeLanceur(travail)) return apresValidation ? { statut: "reprise" } : { statut: "refusee", phrase: PHRASES_IV.lanceur };
  if (!travail || travail.statut !== "echec") return { statut: "refusee", phrase: PHRASES_IV.rienAReprendre };
  try {
    await (dep.reessayer ?? reessayerParDefaut)(travail.id, accord);
    return { statut: "reprise" };
  } catch (e) {
    if (e instanceof ErreurStudio && e.code === "CONFIRMATION_REQUISE" && typeof e.montant === "number") return { statut: "accord-requis", centimes: e.montant, phrase: e.message };
    if (e instanceof ErreurStudio) return { statut: "refusee", phrase: e.message };
    throw e;
  }
}

/** « Valider la carte » (écran 2), puis la suite (écriture du script). */
export async function validerCarteEtReprendre(videoId: Id, carte: CarteImage | undefined, dep: DependancesGestesIV = {}): Promise<IssueRepriseIV> {
  await exigerSession();
  try {
    if (dep.validerCarte) await dep.validerCarte(videoId, carte ? { carte } : {});
    else {
      const { validerCarteImageVideo } = await import("./image-video-carte");
      await validerCarteImageVideo(videoId, carte ? { carte } : {});
    }
  } catch (e) {
    if (e instanceof ErreurStudio) return { statut: "refusee", phrase: e.message };
    throw e;
  }
  return reprendre(videoId, undefined, dep, true);
}

/** « Valider et fabriquer » (écran 3) : `accord` = le prix affiché et confirmé. */
export async function validerScriptEtReprendre(
  videoId: Id,
  decision: { fiche?: FicheImage; choixFormules: Record<string, ChoixFormule>; ajoutsWill: string[]; variete?: Partial<RecetteVarieteIV> },
  accord: AccordPrix | undefined,
  dep: DependancesGestesIV = {},
): Promise<IssueRepriseIV> {
  await exigerSession();
  if (Object.values(decision.choixFormules).includes("reformuler")) {
    const base = decision.fiche ?? etatDe(await (dep.travail ?? travailParDefaut)(videoId))?.propositionScript?.fiche;
    const prudente = base ? avecVersionsPrudentes(base, decision.choixFormules) : null;
    if (prudente) decision = { ...decision, fiche: prudente };
  }
  try {
    if (dep.validerScript) await dep.validerScript(videoId, decision, accord);
    else {
      const { validerScriptImageVideo } = await import("./image-video-scripts");
      await validerScriptImageVideo(videoId, decision, accord);
    }
  } catch (e) {
    if (e instanceof ErreurStudio) return { statut: "refusee", phrase: e.message };
    throw e;
  }
  return reprendre(videoId, accord, dep, true);
}

/** « Refaire cette partie » (écrans 4 et 5) : seule l'étape arrêtée repart ; ce qui est payé reste. */
export async function reessayerImageVideo(videoId: Id, accord?: AccordPrix, dep: DependancesGestesIV = {}): Promise<IssueRepriseIV> {
  await exigerSession();
  return reprendre(videoId, accord, dep);
}

// ─── « Relever le plafond » ──────────────────────────────────────────────────────────────────────────────────────────

export interface DemandeRelevePlafondIV {
  /** Nouveau plafond demandé (centimes d'euro). */
  montantCentimes: number;
  /** Montant confirmé par Will (« Confirmer X € ») : doit être exactement le montant demandé. */
  accordCentimes?: AccordPrix;
  /** « Relever et reprendre » : l'étape arrêtée repart aussitôt (sinon rien n'est relancé). */
  reprendre?: boolean;
}

export type IssueRelevePlafondIV = { statut: "releve"; plafondCentimes: number; reprise?: IssueRepriseIV } | { statut: "accord-requis"; centimes: number; phrase: string } | { statut: "refusee"; phrase: string };

/** Ce que le relevé lit et écrit (doubles dans les tests) ; défaut : les dépôts du studio. */
export interface DependancesRelevePlafondIV extends DependancesGestesIV {
  enregistrerTravail?: (t: Travail) => Promise<unknown>;
  /** Le plafond suit dans les entrées de la vidéo et la commande figée de la version (plafond Claude propre). */
  porterPlafond?: (videoId: Id, versionId: Id | undefined, plafondCentimes: number) => Promise<void>;
}

async function porterPlafondParDefaut(videoId: Id, versionId: Id | undefined, plafondCentimes: number): Promise<void> {
  const d = depots();
  const avecPlafond = (entrees: Record<string, unknown> | undefined) => ({ ...(entrees ?? {}), imageVideo: { ...objet(entrees?.imageVideo), plafondCentimes } });
  const video = await d.videos.obtenir(videoId);
  if (video) await d.videos.modifier(videoId, { entrees: avecPlafond(video.entrees) });
  const version = versionId ? await d.versions.obtenir(versionId) : null;
  if (version) await d.versions.modifier(version.id, { commande: { ...version.commande, entrees: avecPlafond(version.commande.entrees) } });
}

/**
 * « Relever le plafond » (écran 4) : le plafond de la caisse de la vidéo MONTE au montant confirmé par Will (jamais sous
 * le plafond actuel ni sous l'engagé), et le plafond Claude propre du format le suit (entrées de la vidéo et commande de
 * la version). Rien n'est relancé, sauf « Relever et reprendre » (`reprendre`) : la même reprise que « Refaire cette
 * partie » ; ce qui est payé reste. Vitrine du lanceur et fabrication en cours : refusé, rien n'est touché.
 */
export async function releverPlafondImageVideo(videoId: Id, d: DemandeRelevePlafondIV, dep: DependancesRelevePlafondIV = {}): Promise<IssueRelevePlafondIV> {
  await exigerSession();
  const montant = Number(d.montantCentimes);
  if (!Number.isFinite(montant) || montant <= 0) return { statut: "refusee", phrase: PHRASES_IV.plafondMontant };
  const nouveau = Math.round(montant);
  const travail = await (dep.travail ?? travailParDefaut)(videoId);
  if (meneParLeLanceur(travail)) return { statut: "refusee", phrase: PHRASES_IV.plafondLanceur };
  const etat = etatDe(travail);
  if (!travail || !etat || etat.etape === "prete") return { statut: "refusee", phrase: PHRASES_IV.rienAReprendre };
  if (travail.statut === "en_cours" || travail.statut === "en_file") return { statut: "refusee", phrase: PHRASES_IV.plafondEnCours };
  const engage = engageCentimes(etat);
  const actuel = etat.caisse.plafondCentimes;
  if (nouveau < engage) return { statut: "refusee", phrase: `Le plafond ne peut pas descendre sous ce qui est déjà engagé (${euros(engage)}).` };
  if (nouveau <= actuel) return { statut: "refusee", phrase: `Le nouveau plafond doit dépasser le plafond actuel (${euros(actuel)}).` };
  // Confirmation explicite du montant, comme « Confirmer ce prix » : un autre montant (ou aucun) est redemandé.
  if (d.accordCentimes !== nouveau) return { statut: "accord-requis", centimes: nouveau, phrase: `Le plafond de cette vidéo passera de ${euros(actuel)} à ${euros(nouveau)}. Confirmez ce montant.` };
  // Relecture et écriture SOUS le verrou de la boucle (comme `reessayerTravail`) : un « Refaire cette partie » passé
  // entre-temps (voix peut-être déjà payée) n'est jamais écrasé par la lecture d'avant ; rien n'est écrit, Will recharge.
  const ecrit = await sousVerrou(async () => {
    const frais = await (dep.travail ?? travailParDefaut)(videoId);
    const etatFrais = etatDe(frais);
    if (!frais || !etatFrais || frais.id !== travail.id || meneParLeLanceur(frais) || frais.statut === "en_cours" || frais.statut === "en_file") return false;
    if (frais.statut !== travail.statut || frais.tentatives !== travail.tentatives || frais.modifieLe !== travail.modifieLe) return false;
    if (etatFrais.etape === "prete" || engageCentimes(etatFrais) !== engage || etatFrais.caisse.plafondCentimes !== actuel) return false;
    const apres = releverPlafondIV(etatFrais, nouveau);
    await (dep.enregistrerTravail ?? ((t: Travail) => depots().travaux.enregistrer(t)))({ ...frais, parametres: { ...frais.parametres, imageVideo: apres }, modifieLe: new Date().toISOString() });
    await (dep.porterPlafond ?? porterPlafondParDefaut)(videoId, frais.versionId, nouveau);
    await journaliser("video", `Image → vidéo : plafond relevé de ${euros(actuel)} à ${euros(nouveau)}`, { type: "video", id: videoId }).catch(() => undefined);
    return true;
  });
  if (!ecrit) return { statut: "refusee", phrase: PHRASES_IV.plafondChange };
  // Hors du verrou : `reessayerTravail` le prend lui-même (le verrou n'est pas réentrant).
  if (!d.reprendre) return { statut: "releve", plafondCentimes: nouveau };
  return { statut: "releve", plafondCentimes: nouveau, reprise: await reprendre(videoId, undefined, dep) };
}

// ─── Les dernières vidéos du format ──────────────────────────────────────────────────────────────────────────────────

/** Les dernières vidéos « Image → vidéo » (titre et date), pour y revenir depuis le dépôt. Jamais d'exception. */
export async function dernieresImageVideo(max = 6): Promise<{ videoId: Id; titre: string; le: string }[]> {
  await exigerSession();
  try {
    const videos = await depots().videos.lister((v) => v.formatId === ID_FORMAT_IMAGE_VIDEO && v.statut !== "archivee");
    return videos
      .sort((a, b) => (b.creeLe ?? "").localeCompare(a.creeLe ?? "") || a.id.localeCompare(b.id))
      .slice(0, max)
      .map((v) => ({ videoId: v.id, titre: v.titre, le: v.creeLe ?? "" }));
  } catch {
    return [];
  }
}
