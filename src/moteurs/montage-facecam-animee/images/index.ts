/**
 * LES PHOTOS ET LOGOS (lot D du face caméra animé) — remplit les fenêtres d'illustration du plan de mise en scène.
 *
 * Passe 3 (revue passe 2, point 2 ; Will : « des mini-vidéos dans les animations », « ça bouge trop ») : une fenêtre
 * montre une MINI-VIDÉO qui bouge, ou elle n'existe pas. Plus AUCUNE photo fixe (sans zoom, une photo est une image morte).
 * Pour chaque fenêtre (`media` = « fenetre-1 » écrit par le réalisateur, `recherche` = la SCÈNE à montrer,
 * `illustre` = les mots exacts dits) :
 *  1. requêtes anglaises LITTÉRALES construites depuis la SCÈNE (`requetes.ts`), jamais depuis la phrase de Will ;
 *  2. sources : Mes images (vidéos de Will) puis Pexels ET Pixabay, requête par requête et PAGE par page (3 pages) ;
 *     une fenêtre `capture: true` essaie d'abord la capture du site (elle défile : ce n'est pas une image morte) ;
 *  3. classement (`choisir.ts`) ; la vidéo est PRÉPARÉE (`preparerMiniVideo` : passage sans coupe dans la plage de
 *     mouvement, 4 s au plus, 1080×1350, H.264 25 i/s sans son, ≤ 8 Mo) puis MESURÉE : moins de 3 % ou plus de 35 % des
 *     pixels qui changent (médiane, 25 i/s) → candidat suivant ;
 *  4. contrôle visuel par Claude sur une planche d'images EXTRAITES de l'extrait retenu : seul « littéral » passe ;
 *  5. PASSE 4 (« ne plus jamais supprimer une fenêtre faute de vidéo ») — rien ne convient → on ÉLARGIT la même
 *     scène : synonymes et scène reconnue dans les mots dits (`requetesElargies`), pages 1 à 3, puis les pages 4 et 5
 *     des requêtes littérales, sur Pexels ET Pixabay (12 essais de plus) ;
 *  6. toujours rien → AUTRE SCÈNE demandée au réalisateur (`autreScene`, 3 cherchées au plus, 6 demandes) ; chaque
 *     proposition passe d'abord le CONTRÔLE DE LITTÉRALITÉ du plan (`controleScene` : reprend un mot dit, qui fait quoi
 *     où, ni métaphore ni action invisible) — refusée, son motif est rendu au réalisateur pour la suivante ;
 *  7. puis les SCÈNES DE SECOURS écrites d'avance pour les mots dits (`scenesDeSecours`, contrôlées elles aussi) ;
 *  8. seulement alors, la fenêtre est SUPPRIMÉE du plan (`manques`, `supprimees`), jamais remplacée par une photo.
 * Jamais de banque payante, jamais d'image générée : seules les sources de `ORDRE_SOURCES` sont lues, un candidat
 * d'une autre source est ignoré. Le plan reçu n'est pas modifié : un nouveau plan est rendu.
 * Les dépendances sont injectées : `production.ts` les branche sur le studio (`adaptateur.ts`) ; l'outil
 * `scripts/approvisionner-fenetres.ts` sur les API directement.
 */
import type { FenetrePlan } from "@/domaine/facecam-animee/plan";
import { classerCandidats, empreinte, raisonEcartMiniVideo, type CandidatImage, type LicenceCandidat } from "./choisir";
import { controleScene, ditsAutour, scenesDeSecours } from "./litteralite";
import { GENRES_PAR_SOURCE, ordreDesSources, requetesDe, requetesElargies, SOURCES_EN_ANGLAIS, sourcePermise, type SourceImage } from "./requetes";
import { consigneVerification, consigneVerificationMiniVideo, imageDeControle, phraseDite, type Litteralite, type VerdictImage, type VerdictMiniVideo } from "./verification";

export { ORDRE_SOURCES, LEXIQUE_SCENES, requetesDe, requetesElargies, requetesLitterales, scene, ordreDesSources, sourcePermise, type SourceImage } from "./requetes";
export { consigneAutreScene, controleScene, ditsAutour, SCENES_DE_SECOURS, scenesDeSecours } from "./litteralite";
export {
  classerCandidats,
  ecartMoyen,
  empreinte,
  formatDe,
  formatMiniVideo,
  licenceAcceptee,
  mesureMouvement,
  passageLePlusAnime,
  raisonEcart,
  raisonEcartMiniVideo,
  COTE_COURT_MIN_VIDEO,
  MARGE_DUREE_VIDEO_SEC,
  SEUIL_MOUVEMENT,
  SEUIL_PIXEL,
  SEUIL_PIXELS_CHANGES,
  SEUIL_PIXELS_CHANGES_MAX,
  SEUIL_COUPE,
  LARGEUR_CONTROLE,
  IMAGES_PAR_SEC_MESURE,
  mediane,
  partsChangees,
  passageDansLaPlage,
  PART_FIGEE_MAX,
  type CandidatImage,
  type LicenceCandidat,
} from "./choisir";
export {
  argumentsEncodage,
  argumentsPlanche,
  recadrage45,
  argumentsProfil,
  decouperImages,
  ecartsSuccessifs,
  longueurExtrait,
  preparateurMiniVideo,
  PREFIXE_CLE_MINI_VIDEO,
  type OutilsPreparation,
} from "./preparation";
export {
  CONSIGNE_VERIFICATION_IMAGE,
  CONSIGNE_VERIFICATION_MINI_VIDEO,
  consigneVerification,
  consigneVerificationMiniVideo,
  lireVerdict,
  lireVerdictMiniVideo,
  type Litteralite,
  type VerdictImage,
  type VerdictMiniVideo,
} from "./verification";
export { chercheurVideosBanques, PAGES_PAR_REQUETE, plusPetiteSuffisante, videosPexels, videosPixabay, type ClesBanques, type Recuperer } from "./banques";

/** Contrôles visuels au plus par fenêtre pour une capture du site. */
export const ESSAIS_MAX_PAR_FENETRE = 3;
/** Mini-vidéos préparées et contrôlées au plus pour UNE scène, avant de demander une autre scène. */
export const ESSAIS_MAX_MINI_VIDEO = 12;
/** Mini-vidéos essayées EN PLUS pour une scène pendant la recherche élargie (synonymes, pages suivantes). */
export const ESSAIS_MAX_ELARGIS = 12;
/** Autres scènes du réalisateur CHERCHÉES au plus (passe 4 : 3), et propositions demandées au plus (refusées comprises). */
export const SCENES_ALTERNATIVES_MAX = 3;
export const DEMANDES_AUTRE_SCENE_MAX = 6;
/** Scènes de secours cherchées au plus, après le réalisateur. */
export const SCENES_SECOURS_MAX = 3;
/** Pages de résultats lues par requête et par banque (recherche littérale), puis pages suivantes (recherche élargie). */
export const PAGES_RECHERCHE = 3;
export const PAGES_RECHERCHE_ELARGIE = 5;
/** Durée maximale de l'extrait d'une mini-vidéo (la mise en page la lit en boucle si la fenêtre est plus longue). */
export const DUREE_MAX_EXTRAIT_SEC = 4;

export interface DemandeRecherche {
  source: SourceImage;
  genre: "photo" | "video";
  /** La scène cherchée (la `recherche` de la fenêtre, ou l'autre scène donnée par le réalisateur). */
  recherche: string;
  /** Mots exacts dits (`illustre` de la fenêtre). */
  illustre?: string;
  motsFr: string[];
  /** La requête anglaise de CET appel (une des requêtes littérales). */
  requeteEn: string;
  /** Durée minimale d'une vidéo (celle de la fenêtre). */
  dureeMinSec: number;
  /** Page de résultats (1, 2, 3…). */
  page?: number;
  /** Recherche de repli (captures du site) : la source peut rendre une image moins proche du sujet. */
  repli?: boolean;
}

/** Une mini-vidéo préparée : fichier prêt pour le rendu et mesures du passage retenu. */
export interface MiniVideoPreparee {
  /** Clé du fichier (« videos/fenetre-1.mp4 »). */
  cle: string;
  /** Seconde du fichier où commencer la lecture (0 quand l'extrait commence au passage retenu). */
  depuisSec: number;
  /** Écart moyen entre images du passage retenu (`ecartMoyen`). */
  mouvement: number;
  /** Mouvement VISIBLE de l'extrait préparé (`mesureMouvement`, 25 i/s) : moyenne et MÉDIANE des pixels changés, images figées, coupes. */
  pixelsChanges?: number;
  pixelsChangesMedian?: number;
  partFigee?: number;
  coupes?: number;
  /** Dossier de travail local du candidat (à libérer par `liberer` quand le contrôle est fait). */
  dossier?: string;
  /** Début du passage dans la vidéo d'origine (rapport). */
  debutSourceSec?: number;
  dureeSec?: number;
  octets?: number;
  /** Image (planche) du passage pour le contrôle visuel (chemin local). */
  image?: string;
}

export interface DemandeAutreScene {
  fenetre: number;
  /** La dernière scène essayée. */
  recherche: string;
  illustre?: string;
  /** Toutes les scènes déjà essayées pour cette fenêtre. */
  essayees: string[];
  /** Pourquoi les candidats (et les scènes proposées non littérales) ont été refusés. */
  refus: string[];
  /** La phrase dite autour de la fenêtre (quand la transcription est fournie). */
  phrase?: string;
}

export interface DependancesImages {
  /** La recherche (adaptateur de la recherche B-roll existante). Une source en panne rend une liste vide ou lève. */
  chercher(d: DemandeRecherche): Promise<CandidatImage[]>;
  /** Téléchargement et stockage du candidat RETENU ; rend la clé du fichier dans le dossier de rendu. */
  stocker(c: CandidatImage): Promise<string>;
  /**
   * Mini-vidéo d'une banque : téléchargement, passage dans la plage de mouvement, recadrage 4:5 1080×1350, H.264 25 i/s
   * sans son, ≤ 8 Mo. Absente : la vidéo passe par `stocker` telle quelle (sans mesure).
   */
  preparerMiniVideo?(c: CandidatImage, d: { fenetre: number; dureeFenetreSec: number }): Promise<MiniVideoPreparee>;
  /** Retire un fichier préparé puis refusé. */
  abandonner?(cle: string): Promise<void>;
  /** Libère le dossier de travail d'une mini-vidéo préparée (extrait, planche de contrôle) une fois le candidat jugé, accepté ou refusé. */
  liberer?(prep: MiniVideoPreparee): Promise<void>;
  /** Contrôle visuel d'une capture du site par Claude. */
  verifierImage?(d: { candidat: CandidatImage; recherche: string; consigne: string }): Promise<VerdictImage>;
  /** Contrôle visuel d'une mini-vidéo par Claude : « littéral », « métaphore » ou « hors sujet ». */
  verifierMiniVideo?(d: { candidat: CandidatImage; image?: string; recherche: string; illustre?: string; consigne: string }): Promise<VerdictMiniVideo>;
  /**
   * Le réalisateur propose une AUTRE scène filmable (60 caractères au plus) pour les mêmes mots dits, quand rien ne
   * convient ; null : il n'en a pas (la fenêtre sera supprimée).
   */
  autreScene?(d: DemandeAutreScene): Promise<string | null>;
  /** Empreintes (`source:id`) des vidéos précédentes, la plus récente en dernier (les 5 dernières comptent). */
  historique?: readonly (readonly string[])[];
  /**
   * Transcription (mots datés) : le contrôle visuel juge chaque candidat contre la PHRASE DITE autour de la fenêtre
   * (`phraseDite`), pas contre la recherche (passe 3). Absente : le juge reste `illustre`.
   */
  mots?: readonly { w: string; a: number }[];
}

export interface ChoixFenetre {
  /** Rang de la fenêtre dans le plan REÇU. */
  fenetre: number;
  /** Clé écrite par le réalisateur (« fenetre-1 »). */
  mediaInitial: string;
  source: SourceImage;
  /** Identifiant chez la source. */
  id: string;
  genre: "photo" | "video";
  /** Clé du fichier stocké (nouvelle valeur de `media`). */
  cle: string;
  /** Scène qui a trouvé le média (différente de la recherche initiale si le réalisateur en a donné une autre). */
  scene: string;
  /** Adresse d'origine quand elle vient d'une banque. */
  url?: string;
  /** Page d'origine (preuve de la licence). */
  page?: string;
  auteur?: string;
  licence?: LicenceCandidat;
  /** Requête anglaise qui a trouvé le média. */
  requete?: string;
  /** Mini-vidéo : verdict du contrôle visuel, mesures. */
  verdict?: Litteralite;
  depuisSec?: number;
  dureeSec?: number;
  mouvement?: number;
  pixelsChanges?: number;
  pixelsChangesMedian?: number;
  partFigee?: number;
  octets?: number;
  /** Planche d'images montrée au contrôle visuel : chemin LOCAL, fichier supprimé par `liberer` dès le contrôle fait (garde la trace du chemin pour le rapport seulement). */
  imageControle?: string;
  empreinte: string;
  raison: string;
}

export interface ManqueFenetre {
  fenetre: number;
  media: string;
  recherche: string;
  raison: string;
  /** Vrai : la fenêtre a été retirée du plan (rien de vivant ne convenait). */
  supprimee?: boolean;
}

export interface ResultatImages<P> {
  plan: P;
  choix: ChoixFenetre[];
  manques: ManqueFenetre[];
  /** Rangs (dans le plan reçu) des fenêtres supprimées. */
  supprimees: number[];
  /** Empreintes utilisées dans cette vidéo (à ajouter à l'historique). */
  empreintes: string[];
}

const estAdresse = (s: string) => /^https?:\/\//.test(s);

/** Une mini-vidéo préparée est montrée en PLANCHE (`argumentsPlanche`) : on le dit au contrôle. */
export const NOTE_PLANCHE = "\nPrécision : l'image est une PLANCHE de trois images du même passage, côte à côte (début, milieu, fin). Juge l'ensemble ; une caméra qui court d'un sujet à l'autre (travelling) n'est pas « littéral ». Quand les mots dits sont ABSTRAITS (une idée sans objet filmable : « votre entreprise avance », « chaque jour »), la scène demandée en est la traduction filmable choisie par le réalisateur : « littéral » si les images montrent concrètement CETTE scène (la personne et l'action dites), « métaphore » seulement pour un symbole (horloge, sablier, goutte, ampoule…).";

async function sansPanne<T>(f: () => Promise<T[]>): Promise<T[]> {
  try {
    return (await f()) ?? [];
  } catch {
    return []; // une source en panne n'empêche pas les suivantes
  }
}

interface Retenu {
  c: CandidatImage;
  cle: string;
  raison: string;
  scene: string;
  requete?: string;
  verdict?: Litteralite;
  prep?: MiniVideoPreparee;
}

/** Remplit toutes les fenêtres du plan (une à une, dans l'ordre : l'anti-doublon suit la vidéo). */
export async function remplirFenetres<P extends { fenetres: FenetrePlan[] }>(plan: P, dep: DependancesImages): Promise<ResultatImages<P>> {
  const dejaPris = new Set<string>();
  const choix: ChoixFenetre[] = [];
  const manques: ManqueFenetre[] = [];
  const supprimees: number[] = [];
  const fenetres: FenetrePlan[] = [];

  for (const [index, f] of plan.fenetres.entries()) {
    const duree = Math.max(0, f.fin - f.debut);
    // Le juge du contrôle visuel : la phrase dite (passe 3), pour TOUS les candidats, réutilisations comprises.
    const phrase = dep.mots?.length ? phraseDite(dep.mots, f.debut, f.fin) || undefined : undefined;
    const refusees = new Set<string>();
    const raisonsRefus: string[] = [];

    const chercherSource = async (source: SourceImage, genre: "photo" | "video", recherche: string, motsFr: string[], requeteEn: string, page: number, repli = false) => {
      const brut = await sansPanne(() => dep.chercher({ source, genre, recherche, illustre: f.illustre, motsFr, requeteEn, dureeMinSec: duree, page, repli }));
      // Garde : seule la source demandée, seules les sources permises, seul le genre demandé.
      return { n: brut.length, candidats: brut.filter((c) => c.source === source && sourcePermise(c.source) && c.genre === genre && !refusees.has(empreinte(c))) };
    };
    const refuser = (c: CandidatImage, raison: string) => {
      refusees.add(empreinte(c));
      raisonsRefus.push(`${c.source} ${c.id} : ${raison}`);
    };

    /** Essai d'une mini-vidéo : préparation, mesure du mouvement (plage 3-35 %), contrôle « littéral ». */
    const essayerMiniVideo = async (c: CandidatImage, requete: string, scene: string): Promise<Retenu | null> => {
      let prep: MiniVideoPreparee | undefined;
      if (dep.preparerMiniVideo && estAdresse(c.cle)) {
        try {
          prep = await dep.preparerMiniVideo(c, { fenetre: index, dureeFenetreSec: duree });
        } catch (e) {
          // Outil absent du serveur (ex. ffprobe) : une panne, pas un refus de la vidéo ; elle remonte sans être maquillée.
          const sys = e as NodeJS.ErrnoException;
          if (sys.code === "ENOENT" && String(sys.syscall ?? "").startsWith("spawn")) throw e;
          refuser(c, `préparation impossible (${(e as Error).message ?? "erreur"})`);
          return null;
        }
        const ecart = raisonEcartMiniVideo({ ...c, mouvement: prep.mouvement, pixelsChanges: prep.pixelsChanges, pixelsChangesMedian: prep.pixelsChangesMedian, partFigee: prep.partFigee, coupes: prep.coupes }, duree);
        if (ecart) {
          await dep.abandonner?.(prep.cle).catch(() => undefined);
          await dep.liberer?.(prep).catch(() => undefined);
          refuser(c, ecart);
          return null;
        }
      }
      let verdict: VerdictMiniVideo | VerdictImage = { accepte: true, raison: "conforme aux règles (sans contrôle visuel)" };
      try {
        if (dep.verifierMiniVideo) {
          // Une mini-vidéo PRÉPARÉE est jugée sur des images EXTRAITES du passage montré, jamais sur la vignette de la
          // banque ; sans image extraite, refus (on ne juge pas à l'aveugle).
          const image = prep ? imageDeControle(prep) : c.vignette;
          verdict = prep && !image
            ? { accepte: false, raison: "aucune image extraite du passage pour le contrôle visuel" }
            : await dep.verifierMiniVideo({ candidat: c, image: image ?? undefined, recherche: scene, illustre: f.illustre, consigne: consigneVerificationMiniVideo(scene, f.illustre, phrase) + (prep ? NOTE_PLANCHE : "") });
        } else if (dep.verifierImage) {
          verdict = await dep.verifierImage({ candidat: c, recherche: scene, consigne: consigneVerification(scene, f.illustre, phrase) });
        }
      } catch {
        verdict = { accepte: false, raison: "contrôle visuel impossible" };
      }
      // Le contrôle est fait : la planche et l'extrait local ne servent plus (le clip déposé reste, s'il est retenu).
      if (prep) await dep.liberer?.(prep).catch(() => undefined);
      if (!verdict.accepte) {
        if (prep) await dep.abandonner?.(prep.cle).catch(() => undefined);
        refuser(c, verdict.raison);
        return null;
      }
      const v = "verdict" in verdict ? verdict.verdict : undefined;
      if (prep) return { c, cle: prep.cle, raison: verdict.raison, scene, requete, verdict: v, prep };
      try {
        return { c, cle: await dep.stocker(c), raison: verdict.raison, scene, requete, verdict: v };
      } catch {
        refuser(c, "recopie impossible");
        return null;
      }
    };

    /** Capture du site (fenêtre `capture: true`) : elle DÉFILE dans la fenêtre, ce n'est pas une photo morte. */
    const essayerCapture = async (c: CandidatImage, scene: string): Promise<Retenu | null> => {
      let verdict: VerdictImage = { accepte: true, raison: "capture du site (défile dans la fenêtre)" };
      if (dep.verifierImage) {
        try {
          verdict = await dep.verifierImage({ candidat: c, recherche: scene, consigne: consigneVerification(scene, f.illustre, phrase) });
        } catch {
          verdict = { accepte: false, raison: "contrôle visuel impossible" };
        }
      }
      if (!verdict.accepte) {
        refuser(c, verdict.raison);
        return null;
      }
      try {
        return { c, cle: await dep.stocker(c), raison: verdict.raison, scene };
      } catch {
        refuser(c, "recopie impossible");
        return null;
      }
    };

    /** Une scène : capture (si demandée), puis mini-vidéos page par page, requête par requête, banque par banque. */
    const chercherScene = async (scene: string): Promise<Retenu | null> => {
      const req = requetesDe(scene, f.illustre);
      if (f.capture) {
        const { candidats } = await chercherSource("capture-site", "photo", scene, req.motsFr, req.requeteEn, 1, true);
        let n = 0;
        for (const c of classerCandidats(candidats, { video: false, dureeFenetreSec: 0, dejaPris, historique: dep.historique })) {
          if (n++ >= ESSAIS_MAX_PAR_FENETRE) break;
          const r = await essayerCapture(c, scene);
          if (r) return r;
        }
      }
      const litterales = req.litterales.length ? req.litterales : [req.requeteEn];
      const sources = ordreDesSources({}).filter((s) => GENRES_PAR_SOURCE[s].includes("video"));
      const epuisees = new Set<string>();
      let essais = 0;
      /** Parcourt des requêtes page par page, banque par banque, jusqu'à `plafond` essais pour cette scène. */
      const parcourir = async (requetes: readonly string[], pages: readonly number[], plafond: number, bibliotheque: boolean): Promise<Retenu | null> => {
        for (const page of pages) {
          for (const requete of requetes) {
            for (const source of sources) {
              const anglais = SOURCES_EN_ANGLAIS.includes(source);
              // La Bibliothèque lit les mots français : une seule fois (page 1, 1re requête de la recherche littérale).
              if (!anglais && (!bibliotheque || page > 1 || requete !== requetes[0])) continue;
              const cle = `${source}|${requete}`;
              if (epuisees.has(cle)) continue;
              const { n, candidats } = await chercherSource(source, "video", scene, req.motsFr, anglais ? requete : req.requeteEn, page);
              if (n === 0) epuisees.add(cle);
              const classes = classerCandidats(candidats, { video: true, dureeFenetreSec: duree, requeteEn: requete, dejaPris, historique: dep.historique });
              for (const c of classes) {
                if (essais >= plafond) return null;
                if (refusees.has(empreinte(c))) continue; // déjà essayé par une requête ou une page précédente
                essais++;
                const r = await essayerMiniVideo(c, requete, scene);
                if (r) return r;
              }
            }
          }
        }
        return null;
      };
      const pages = (de: number, a: number) => Array.from({ length: Math.max(0, a - de + 1) }, (_, k) => de + k);
      // 1) Recherche littérale : 3 pages des 2 ou 3 requêtes littérales.
      const strict = await parcourir(litterales, pages(1, PAGES_RECHERCHE), ESSAIS_MAX_MINI_VIDEO, true);
      if (strict) return strict;
      // 2) Recherche ÉLARGIE de la même scène (passe 4) : synonymes et scène des mots dits (3 pages), puis pages 4-5.
      const plafond = essais + ESSAIS_MAX_ELARGIS;
      const elargies = requetesElargies(scene, f.illustre).filter((q) => !litterales.includes(q));
      return (await parcourir(elargies, pages(1, PAGES_RECHERCHE), plafond, false)) ?? (await parcourir(litterales, pages(PAGES_RECHERCHE + 1, PAGES_RECHERCHE_ELARGIE), plafond, false));
    };

    // Mots dits autour de la fenêtre : un objet DIT n'est pas une métaphore (contrôle des scènes de remplacement).
    const dits = ditsAutour(dep.mots, f.debut, f.fin);
    /** Une scène de remplacement passe le contrôle de littéralité du plan AVANT d'être cherchée (passe 4). */
    const sceneRefusee = (s: string): string | null => {
      if (s.length > 60) return `« ${s} » : plus de 60 caractères`;
      const d = controleScene(s, f.illustre, dits);
      return d.length ? `scène « ${s} » refusée avant recherche : ${d.join(" ; ")}` : null;
    };

    const essayees = [f.recherche];
    let retenu = await chercherScene(f.recherche);
    let demandes = 0;
    while (!retenu && dep.autreScene && essayees.length <= SCENES_ALTERNATIVES_MAX && demandes < DEMANDES_AUTRE_SCENE_MAX) {
      demandes++;
      let autre: string | null = null;
      try {
        autre = (await dep.autreScene({ fenetre: index, recherche: essayees[essayees.length - 1], illustre: f.illustre, essayees: [...essayees], refus: [...raisonsRefus], ...(phrase ? { phrase } : {}) }))?.trim() || null;
      } catch {
        autre = null;
      }
      if (!autre) break;
      if (essayees.includes(autre)) {
        raisonsRefus.push(`scène « ${autre} » déjà essayée`);
        continue;
      }
      const refus = sceneRefusee(autre);
      if (refus) {
        raisonsRefus.push(refus);
        continue;
      }
      essayees.push(autre);
      retenu = await chercherScene(autre);
    }
    // Scènes de secours écrites d'avance pour les mots dits (déjà contrôlées) : avant toute suppression.
    for (const s of scenesDeSecours(f.illustre, dits, essayees).slice(0, SCENES_SECOURS_MAX)) {
      if (retenu) break;
      essayees.push(s);
      retenu = await chercherScene(s);
    }

    const motifManque = raisonsRefus.length ? `refusées (${raisonsRefus.join(" ; ")})` : "aucun candidat dans les sources gratuites";
    if (!retenu) {
      // Rien de vivant ne convient : la fenêtre est SUPPRIMÉE, jamais remplacée par une photo morte.
      supprimees.push(index);
      manques.push({ fenetre: index, media: f.media, recherche: essayees.join(" | "), raison: `${motifManque} ; fenêtre supprimée (aucune mini-vidéo littérale qui bouge)`, supprimee: true });
      continue;
    }

    const e = empreinte(retenu.c);
    dejaPris.add(e);
    const remplie: FenetrePlan = { ...f, media: retenu.cle, recherche: retenu.scene };
    if (retenu.c.genre === "video") {
      remplie.video = true;
      remplie.depuisSec = retenu.prep?.depuisSec ?? 0;
    } else {
      // Capture du site : une image qui défile, pas une vidéo.
      delete remplie.video;
      delete remplie.depuisSec;
    }
    fenetres.push(remplie);
    const c = retenu.c;
    const p = retenu.prep;
    const planche = p ? imageDeControle(p) : null;
    choix.push({
      fenetre: index,
      mediaInitial: f.media,
      source: c.source,
      id: c.id,
      genre: c.genre,
      cle: retenu.cle,
      scene: retenu.scene,
      ...(estAdresse(c.cle) ? { url: c.cle } : {}),
      ...(c.page ? { page: c.page } : {}),
      ...(c.auteur ? { auteur: c.auteur } : {}),
      ...(c.licence ? { licence: c.licence } : {}),
      ...(retenu.requete ? { requete: retenu.requete } : {}),
      ...(retenu.verdict ? { verdict: retenu.verdict } : {}),
      ...(p
        ? {
            depuisSec: p.depuisSec,
            dureeSec: p.dureeSec,
            mouvement: p.mouvement,
            ...(p.pixelsChanges !== undefined ? { pixelsChanges: p.pixelsChanges, partFigee: p.partFigee } : {}),
            ...(p.pixelsChangesMedian !== undefined ? { pixelsChangesMedian: p.pixelsChangesMedian } : {}),
            ...(planche ? { imageControle: planche } : {}),
            octets: p.octets,
          }
        : {}),
      empreinte: e,
      raison: retenu.raison,
    });
    if (retenu.scene !== f.recherche) manques.push({ fenetre: index, media: f.media, recherche: f.recherche, raison: `${motifManque} ; autre scène retenue : « ${retenu.scene} »` });
  }

  const planRempli = { ...plan, fenetres } as P;
  const sons = (plan as { sons?: unknown }).sons;
  if (supprimees.length && Array.isArray(sons)) {
    (planRempli as { sons?: unknown }).sons = sonsSansFenetresSupprimees(sons, supprimees.map((i) => plan.fenetres[i]), plan);
  }
  return { plan: planRempli, choix, manques, supprimees, empreintes: [...dejaPris] };
}

/**
 * Bruitages ORPHELINS d'une fenêtre supprimée (passe 3) : son « whoosh » d'entrée (au début), de sortie (dans la
 * dernière fraction) et le son de son étiquette (à l'instant `etiquette.a`). Un bruitage sans rien à l'écran sonne
 * faux : on les retire, sauf si un élément gardé (carte, calque, fenêtre) commence au même instant.
 */
export function sonsSansFenetresSupprimees(sons: unknown[], supprimees: readonly FenetrePlan[], plan: { fenetres?: unknown; cartes?: unknown; calques?: unknown }): unknown[] {
  const debutsGardes: number[] = [];
  for (const k of ["cartes", "calques"] as const) {
    const l = plan[k];
    if (Array.isArray(l)) for (const e of l) if (e && typeof (e as { debut?: unknown }).debut === "number") debutsGardes.push((e as { debut: number }).debut);
  }
  if (Array.isArray(plan.fenetres)) for (const f of plan.fenetres as FenetrePlan[]) if (!supprimees.includes(f)) debutsGardes.push(f.debut);
  const partage = (t: number) => debutsGardes.some((d) => Math.abs(d - t) <= 0.05);
  const orphelin = (t: number, nom: string) =>
    supprimees.some((f) => {
      const a = (f as { etiquette?: { a?: unknown } }).etiquette?.a;
      if (/^whoosh-in/.test(nom)) return Math.abs(t - f.debut) <= 0.06;
      if (/^whoosh-out/.test(nom)) return t >= f.fin - 0.3 && t <= f.fin + 0.05;
      return typeof a === "number" && Math.abs(t - a) <= 0.02;
    });
  return sons.filter((s) => {
    if (!Array.isArray(s) || typeof s[0] !== "number" || typeof s[1] !== "string") return true;
    return !(orphelin(s[0], s[1]) && !partage(s[0]));
  });
}
