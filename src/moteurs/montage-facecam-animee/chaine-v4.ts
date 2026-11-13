/**
 * CHAÎNE DE PRODUCTION du face caméra animé v4 (Lot I, 17/10/2026) — machine à états PURE, outils injectés.
 *
 *   prise déposée par Will → transcription horodatée (conteneur `studio-aligneur`, celle du studio) → coupes des silences (`calculerCoupes`,
 *   recalées sur 30 i/s) → réalisateur (Claude Opus, consigne v4, `verifierPlan`, 3 essais ; repli : plan v4 minimal) → rendu de la composition
 *   `InterfaceClaireFaceCameraV4` par le service de rendu (opération `composition`, mode `facecam-v4`) → vidéo finale rangée dans le studio.
 *
 * Chaque `avancerChaineV4` fait UN pas et rend le nouvel état (sérialisable, gardé dans le travail) : un « Réessayer » ne refait que l'étape
 * arrêtée. Un outil qui attend un travail extérieur (transcription, rendu) lève `EnCoursChaineV4` : le pas sera refait au passage suivant
 * de la boucle (les travaux extérieurs sont repris par leur identifiant, jamais relancés en double).
 * PRISE HORIZONTALE (essai réel du 17/10 : IMG_7747 filmée en 3840 × 2160 à l'iPhone) : à l'étape des coupes, le visage est repéré
 * (route `visages` du conteneur, `outils.reperer`) et la prise est recadrée en vertical par le service de rendu : colonne 9:16 de TOUTE la
 * hauteur, centrée sur le visage, FIXE (aucun zoom en plus, aucun mouvement de cadrage), ramenée à 1080 × 1920 (`recadrageVerticalV4`).
 * Visage introuvable : colonne centrée. Une prise verticale n'est jamais touchée.
 * Aucune musique, jamais : le plan v4 n'a pas de piste de sons (les plaquettes jouent leurs bruitages) et le service de rendu refuse un plan
 * qui en porterait.
 */
import { appliquerRecalages, calculerCoupes, controlerCoupes, corrigerLexique, motsDuMontage, versPrise, type PhraseRetrouvee, type PlanCoupes } from "@/briques/coupes";
import { estHesitation, tokens } from "@/briques/coupes/texte";
import { horodaterMotsPrononces } from "@/briques/calage/report";
import { DUREE_MIN_SEC } from "@/domaine/facecam-parcours";
import type { ElementV4Plan, PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import type { MotHorodate } from "@/domaine/types";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import { planPourVideo, type MemoPlanVideo } from "@/briques/plan-scenes-generateurs/video";
import { MENTION_PLAFOND_FACECAM_ANIMEE } from "./index";
import { PHRASE_REALISATEUR_PANNE, realiser, type DependancesRealisateur, type EntreeRealisateur, type HistoriqueVideo, type MotTranscrit } from "./realisateur";
import { controlerDiversiteV4, estRendableV4 } from "./realisateur/regles-v4";
import { indicesMotsInterditsEcran } from "./realisateur/mots";
import { plaquettesSansVideo, retirerPlaquettesSansVideo, type PlaquetteRetireeV4 } from "./videos-v4";
import { ESSAIS_REPLI_SANS_VIDEO_V4, IDS_PLAQUETTES_A_VIDEO_V4, elementsPourRepliV4, erreursRepliV4, nomsRetireesV4, phraseRepliEchecV4, phraseRepliOkV4 } from "./repli-sans-video-v4";

export const VERSION_CHAINE_V4 = "chaine-facecam-v4/1";
/** Nom de la prise montée dans le dossier servi par le service de rendu (`studio-rendu/src/operations/facecam-v4.ts`). */
export const PRISE_MONTEE_V4 = "prise-montee.mp4";
/** Cadence du rendu v4 : les intervalles gardés sont recalés sur cette grille. */
const GRILLE_V4 = 30;
/** Format du plan de scènes (1080 × 1920, 25 i/s) : le calque convertit les images vers les 30 i/s de la composition. */
const FORMAT_PLAN_FACECAM_ANIMEE = { largeur: 1080, hauteur: 1920, fps: 25 as const };

export type EtapeChaineV4 = "transcription" | "coupes" | "mise-en-scene" | "videos" | "rendu" | "prete";
export const ETAPES_CHAINE_V4: readonly EtapeChaineV4[] = Object.freeze(["transcription", "coupes", "mise-en-scene", "videos", "rendu", "prete"]);

/** Un fichier de vidéo d'illustration préparé par le studio : `nom` dans le dossier servi au rendu, `cle` de stockage. */
export interface FichierVideoV4 {
  nom: string;
  cle: string;
}

/** D'où vient une vidéo d'illustration (preuve de licence et de contrôle, pour le rapport). */
export interface ChoixVideoV4 {
  fichier: string;
  source: string;
  id: string;
  page?: string;
  auteur?: string;
  licence?: string;
  scene: string;
  verdict?: string;
}

export interface GardeV4 {
  debutSec: number;
  finSec: number;
}

/** GV2-24 : ce que le rapport dit des sous-titres (calculé aux coupes ; jamais un échec). */
export interface ControleSousTitresV4 {
  /** Un texte a été fourni mais pas retrouvé dans la prise : les sous-titres viennent de ce qui a été entendu. */
  texteNonRetrouve: boolean;
  /** Phrases du texte absentes du montage (`controlerCoupes`). */
  phrasesManquantes: number;
  /** Phrases dites autrement (information, pas d'alerte). */
  ditesAutrement: number;
  /** Passages gardés de plus de 1,2 s sans aucun mot sous-titré, début et fin compris (`compterTrousV4`). */
  trous: number;
  /** Mots dits retirés des sous-titres par la liste des mots interdits à l'écran. */
  motsInterdits: number;
}

/** GV2-24 : seuil des trous de transcription (prise de référence : plus long blanc entre deux mots montés 0,3 s). */
export const TROU_SOUS_TITRES_V4_SEC = 1.2;

/** GV2-24 : nombre de passages de plus de 1,2 s sans aucun mot, sur la ligne de temps montée (début et fin compris). PUR. */
export function compterTrousV4(mots: readonly MotTranscrit[], dureeSec: number): number {
  let trous = 0;
  let t = 0;
  for (const m of [...mots].sort((x, y) => x.a - y.a)) {
    if (m.a - t > TROU_SOUS_TITRES_V4_SEC) trous++;
    t = Math.max(t, m.f);
  }
  return dureeSec - t > TROU_SOUS_TITRES_V4_SEC ? trous + 1 : trous;
}

export interface DemandeChaineV4 {
  videoId: string;
  versionId: string;
  /** Clé de stockage de la prise BRUTE déposée par Will. */
  priseCle: string;
  titre?: string;
  /** Texte que Will a dit (facultatif) : coupes en mode « texte » et orthographe des sous-titres. */
  texteValide?: string;
}

export interface EtatChaineV4 {
  version: typeof VERSION_CHAINE_V4;
  etape: EtapeChaineV4;
  demande: DemandeChaineV4;
  /** `largeur` / `hauteur` : la prise après rotation (absentes : inconnues, prise traitée comme verticale). */
  transcription?: { mots: MotHorodate[]; dureeSec: number; largeur?: number; hauteur?: number };
  /** Prise horizontale : colonne 9:16 gardée (pixels de la prise) et visage dans cette colonne (fractions). */
  cadrage?: RecadrageV4;
  coupes?: { gardes: GardeV4[]; dureeSec: number; mots: MotTranscrit[]; /** GV2-24 : absent des anciens états (aucune alerte de sous-titres). */ controle?: ControleSousTitresV4 };
  realisation?: { version: "complete" | "simple"; /** GV2-04 : dernier filet, le repli sans vidéo a échoué et la version simple est livrée avec une alerte. */ filetSimple?: boolean; essais: number; erreurs?: string[]; avertissements: number; phrase?: string; plan: PlanFacecamAnimee; /** GV-MD-03 : plan tel qu'Opus l'a rendu, gardé pour comparer quand le calage au mot est actif. */ planAvantCalage?: PlanFacecamAnimee };
  /**
   * Étape « videos » (18/10) : fichiers préparés pour les plaquettes à vidéo, plaquettes RETIRÉES faute de vidéo littérale, manques,
   * dépense Claude du contrôle visuel (dollars) et résultat des contrôles du plan APRÈS retrait (rapport : rien n'est assoupli).
   * Absent des anciens états (un état à « rendu » sans ce champ relit son plan : s'il manque des vidéos, retour à « videos »).
   */
  videos?: { fichiers: FichierVideoV4[]; choix?: ChoixVideoV4[]; retirees: PlaquetteRetireeV4[]; manques: string[]; depenseUsd?: number; controle?: { rendable: boolean; erreurs: string[] } };
  /**
   * Repli « sans vidéo » (19/10) : aucune vidéo fidèle ET plan hors règles sans elles → UNE fois, retour à la mise en scène, plaquettes à vidéo interdites
   * (`repli-sans-video-v4.ts`). `fait` : le repli a réussi (pas de second repli) ; `essais` : appels Claude du repli.
   */
  repliSansVideo?: { retirees: PlaquetteRetireeV4[]; manques: string[]; elementsPrecedents: ElementV4Plan[]; fait?: boolean; essais?: number };
  rendu?: { cle: string; vignetteCle: string; dureeSec: number; taille: number };
  /** GV2-04 : tours de suite sans réponse du service de montage (remis à 0 dès qu'il répond). */
  muets?: { rendu?: number };
  /** GV2-04 : début (ISO) de la panne du conteneur de transcription ou de repérage du visage (la file normale n'est jamais comptée). */
  injoignableDepuis?: { transcription?: string; visage?: string };
  /** Lot R2 : plan de scènes (option éteinte par défaut), gardé pour ne pas rappeler l'IA à la reprise. Absent : option éteinte ou pas encore composé. */
  planScenes?: MemoPlanVideo;
}

export interface OutilsChaineV4 {
  /** Lot R2 : plan de scènes pour les scènes d'interface, de chiffres et d'accents. Absent (par défaut) : rendu inchangé. `appeler` absent : pièces du stock seulement. */
  planScenes?: { appeler?: AppelClaude };
  /** GV-MD-03 : calage des animations sur le début du mot dit. ÉTEINT par défaut (absent ou faux : plan d'Opus inchangé, rendu des vidéos existantes identique). */
  calageAuMot?: boolean;
  /** Transcription horodatée au mot de la prise brute (temps de la prise). Lève `EnCoursChaineV4` tant qu'elle n'est pas finie. */
  transcrire(d: { priseCle: string; appelId: string }): Promise<{ mots: MotHorodate[]; dureeSec: number; largeurSource?: number; hauteurSource?: number }>;
  /**
   * Prise horizontale : visage repéré sur la prise entière (fractions de la prise ; `null` : introuvable). Lève `EnCoursChaineV4` tant que
   * le repérage tourne. Absent : colonne centrée.
   */
  reperer?(d: { priseCle: string; appelId: string }): Promise<{ centreX: number; yeux?: number; largeurVisage?: number } | null>;
  /** Plafond Claude du mois atteint : version simple sans appel. */
  plafondClaudeAtteint(): Promise<boolean>;
  /** UN appel Claude Opus (rôle réalisateur) ; absent : version simple. */
  appelerRealisateur?: DependancesRealisateur["appeler"];
  /** Les 5 dernières vidéos v4 (variété d'une vidéo à l'autre). */
  historique?(): Promise<HistoriqueVideo[]>;
  /**
   * Vidéos d'illustration des plaquettes qui en exigent (AvantApres, MosaiqueVideos, duel-video) : cherche, contrôle (littéral) et prépare
   * une vidéo par `recherche`, rend le plan avec ses `medias` remplis, les fichiers préparés et les manques. Lève `EnCoursChaineV4` si
   * un travail extérieur tourne. Absent : les plaquettes à vidéo sont retirées du plan. Les plaquettes encore sans vidéo au retour sont retirées.
   */
  videos?(d: { videoId: string; plan: PlanFacecamAnimee; mots: MotTranscrit[] }): Promise<{ plan: PlanFacecamAnimee; fichiers: FichierVideoV4[]; manques: string[]; depenseUsd?: number; choix?: ChoixVideoV4[] }>;
  /** Rendu de la vidéo par le service de rendu (lève `EnCoursChaineV4` tant qu'il tourne). `videos` : fichiers d'illustration à envoyer avec la demande. */
  rendre(d: { idRendu: string; priseCle: string; plan: PlanFacecamAnimee; gardes: GardeV4[]; recadrage?: RecadrageV4; videos?: FichierVideoV4[] }): Promise<{ cle: string; vignetteCle: string; dureeSec: number; taille: number }>;
}

/** Un travail extérieur tourne encore : rien n'a changé, le même pas sera refait au passage suivant. */
export class EnCoursChaineV4 extends Error {
  /**
   * `etat` : état à ENREGISTRER dans le travail (compteurs de panne ; GV2-04). `nature` : « muet » = le service de montage n'a pas répondu à cette
   * interrogation ; « injoignable » = le conteneur est injoignable (à distinguer de la file normale, qui n'est jamais comptée).
   */
  constructor(public readonly quoi: string, public readonly etat?: EtatChaineV4, public readonly nature?: "muet" | "injoignable") {
    super(`${quoi} est en cours.`);
    this.name = "EnCoursChaineV4";
  }
}

/** Arrêt de la chaîne avec une phrase pour Will (réessayable ou non). */
export class ErreurChaineV4 extends Error {
  /** `etat` : état à GARDER dans le travail malgré l'arrêt (diagnostic ; la reprise repart de cet état). */
  constructor(message: string, public readonly reessayable: boolean, public readonly detail?: string, public readonly etat?: EtatChaineV4) {
    super(message);
    this.name = "ErreurChaineV4";
  }
}

export function etatInitialV4(demande: DemandeChaineV4): EtatChaineV4 {
  return { version: VERSION_CHAINE_V4, etape: "transcription", demande };
}

export function lireEtatV4(x: unknown): EtatChaineV4 | null {
  const e = x as EtatChaineV4 | undefined;
  return e && typeof e === "object" && e.version === VERSION_CHAINE_V4 && ETAPES_CHAINE_V4.includes(e.etape) ? e : null;
}

const r3 = (x: number) => +x.toFixed(3);

/** Taille de la vidéo v4 (verticale). */
export const SORTIE_V4 = Object.freeze({ largeur: 1080, hauteur: 1920 });

/** Colonne 9:16 gardée d'une prise horizontale (pixels de la prise, après rotation) et visage dans cette colonne (fractions). */
export interface RecadrageV4 {
  x: number;
  largeur: number;
  hauteur: number;
  /** Visage repéré (sinon colonne centrée). */
  visage: boolean;
  centreX: number;
  yeux?: number;
  largeurVisage?: number;
}

/** La prise est-elle horizontale (plus large que haute) ? PUR. */
export function priseHorizontale(t: { largeur?: number; hauteur?: number } | undefined): boolean {
  return !!t?.largeur && !!t.hauteur && t.largeur > t.hauteur;
}

/**
 * Recadrage vertical d'une prise horizontale : colonne 9:16 de TOUTE la hauteur (aucun zoom en plus : l'image est seulement ramenée à
 * 1080 × 1920), centrée sur le visage, bornée aux bords, coordonnées paires (YUV 4:2:0). FIXE : un seul cadre pour toute la vidéo. PUR.
 */
export function recadrageVerticalV4(prise: { largeur: number; hauteur: number }, visage: { centreX: number; yeux?: number; largeurVisage?: number } | null): RecadrageV4 {
  const hauteur = prise.hauteur - (prise.hauteur % 2);
  const largeur = Math.min(prise.largeur - (prise.largeur % 2), Math.round((hauteur * 9) / 16 / 2) * 2);
  const centre = visage && Number.isFinite(visage.centreX) ? Math.min(1, Math.max(0, visage.centreX)) : 0.5;
  let x = Math.round(centre * prise.largeur - largeur / 2);
  x = Math.max(0, Math.min(prise.largeur - largeur, x));
  x -= x % 2;
  const bornes = (v: number, min: number, max: number) => +Math.min(max, Math.max(min, v)).toFixed(4);
  return {
    x,
    largeur,
    hauteur,
    visage: !!visage,
    // Le visage dans la colonne (fractions de la colonne) : les plaquettes et les sous-titres l'évitent.
    centreX: bornes((centre * prise.largeur - x) / largeur, 0.1, 0.9),
    ...(visage?.yeux !== undefined ? { yeux: bornes(visage.yeux, 0.1, 0.7) } : {}),
    ...(visage?.largeurVisage !== undefined ? { largeurVisage: bornes((visage.largeurVisage * prise.largeur) / largeur, 0.15, 0.7) } : {}),
  };
}

/**
 * COUPES DE LA PRISE pour le rendu v4 (même calcul que la répétition générale validée, `outils/facecam-animee-v4/preparer-prise.ts`) :
 * `calculerCoupes` (silences, reprises, consignes) → intervalles gardés recalés sur la grille de 30 i/s → mots de la vidéo MONTÉE sur ces
 * intervalles (avec l'orthographe du texte dit quand Will l'a donné). PUR.
 */
export function couperPriseV4(e: { mots: MotHorodate[]; dureeSec: number; texteValide?: string }): { gardes: GardeV4[]; dureeSec: number; mots: MotTranscrit[]; controle: ControleSousTitresV4 } {
  const texteValide = e.texteValide?.trim() || undefined;
  const plan = calculerCoupes({ mots: e.mots, dureeSec: e.dureeSec, ...(texteValide ? { texteValide } : {}) });
  const mots = appliquerRecalages(e.mots, plan.recalages);
  const gardes = plan.gardes.map((g) => ({ debutSec: Math.round(g.debutSec * GRILLE_V4) / GRILLE_V4, finSec: Math.round(g.finSec * GRILLE_V4) / GRILLE_V4, debutOrigine: g.debutSec, finOrigine: g.finSec })).filter((g) => g.finSec > g.debutSec);
  const debuts: number[] = [];
  let cumul = 0;
  for (const g of gardes) {
    debuts.push(cumul);
    cumul += g.finSec - g.debutSec;
  }
  /** Instant de la prise brute → ligne de temps montée à 30 i/s (null : hors des intervalles gardés). */
  const versMontee = (t: number, milieu: number) => {
    const k = gardes.findIndex((g) => milieu >= g.debutOrigine && milieu <= g.finOrigine);
    if (k < 0) return null;
    const g = gardes[k];
    return r3(debuts[k] + Math.min(Math.max(t, g.debutOrigine), g.finOrigine) - g.debutOrigine);
  };
  const enMontee = (m: { mot: string; debutSec: number; finSec: number }): MotTranscrit | null => {
    const milieu = (m.debutSec + m.finSec) / 2;
    const a = versMontee(m.debutSec, milieu);
    const f = versMontee(m.finSec, milieu);
    return a === null || f === null ? null : { w: m.mot, a, f: Math.max(f, r3(a + 0.04)) };
  };
  // GV2-24 : vidéo libre (ou texte non retrouvé) : mots de la transcription, lexique de marque appliqué.
  let montes = lexiqueV4(mots.flatMap((m, rang) => { const x = enMontee(m); return x ? [{ rang, x }] : []; }));
  const retrouvees = plan.phrases.filter((p) => p.debutSec !== undefined);
  const phrases = retrouvees.map((p) => p.texte);
  if (texteValide && phrases.length) {
    // Orthographe du texte dit posée sur les instants de la voix (chaîne réelle du studio), puis ramenée sur la grille de 30 i/s.
    const motsTexte = horodaterMotsPrononces(phrases.join(" ").split(/\s+/).filter(Boolean), motsDuMontage(mots, plan.gardes));
    // GV2-24 : la phrase (rang dans `retrouvees`) de chaque mot du texte.
    const rangs = retrouvees.flatMap((p, k) => p.texte.split(/\s+/).filter(Boolean).map(() => k));
    const phraseDe = new Map<MotTranscrit, number>();
    const sansDuree = new Set<MotTranscrit>();
    const avecTexte = motsTexte
      .map((m, i) => {
        const brut = versPrise(m.debutSec, plan.gardes);
        const x = enMontee({ mot: m.mot, debutSec: brut, finSec: Math.max(versPrise(m.finSec, plan.gardes), brut + 0.04) });
        if (x) phraseDe.set(x, rangs[i]);
        if (x && m.finSec - m.debutSec < 1e-6) sansDuree.add(x);
        return x;
      })
      .filter((x): x is MotTranscrit => x !== null);
    if (avecTexte.length) montes = completerParLaVoixV4(avecTexte, phraseDe, sansDuree, retrouvees, mots, plan, enMontee);
  }
  // GV2-24 : contrôle pour le rapport (alertes « attention » dans `resultatV4`).
  const nonRetrouve = !!texteValide && (plan.texteNonRetrouve || !phrases.length);
  const ctrl = texteValide && !nonRetrouve ? controlerCoupes(plan, e.mots) : undefined;
  const controle: ControleSousTitresV4 = { texteNonRetrouve: nonRetrouve, phrasesManquantes: ctrl?.phrasesManquantes.length ?? 0, ditesAutrement: ctrl?.phrasesDitesAutrement.length ?? 0, trous: compterTrousV4(montes, cumul), motsInterdits: indicesMotsInterditsEcran(montes).size };
  return { gardes: gardes.map((g) => ({ debutSec: g.debutSec, finSec: g.finSec })), dureeSec: r3(cumul), mots: montes, controle };
}

/**
 * GV2-24 : lexique de marque sur des mots de la voix (« Action IA » → « Axion-IA ») : 1 à 3 mots QUI SE SUIVENT dans la prise (`rang`)
 * deviennent un mot, du début du premier à la fin du dernier. Les autres mots sont rendus tels quels.
 */
export function lexiqueV4(liste: { rang: number; x: MotTranscrit }[]): MotTranscrit[] {
  const sortie: MotTranscrit[] = [];
  for (let i = 0; i < liste.length; ) {
    let n = 1;
    for (const k of [3, 2]) {
      const g = liste.slice(i, i + k);
      if (n === 1 && g.length === k && g[k - 1].rang - g[0].rang === k - 1 && corrigerLexique(g.map((v) => v.x.w)).length === 1) n = k;
    }
    const groupe = liste.slice(i, i + n).map((v) => v.x);
    sortie.push(n === 1 ? { ...groupe[0], w: corrigerLexique([groupe[0].w])[0] } : { w: corrigerLexique(groupe.map((x) => x.w))[0], a: groupe[0].a, f: groupe[n - 1].f });
    i += n;
  }
  return sortie;
}

/** GV2-24 : formes comparables d'un mot (minuscules sans accents, chiffres en lettres : « 2. » → « deux »). */
const formesV4 = (mot: string) => tokens(mot).join("");
const bigrammesV4 = (s: string) => new Set(Array.from({ length: Math.max(0, s.length - 1) }, (_, i) => s.slice(i, i + 2)));
/** GV2-24 : proximité de deux écritures (bigrammes communs, 0 à 1) ; même règle que `texteSousTitresGardes` (GV2-14). */
function proximiteV4(a: string, b: string): number {
  const A = bigrammesV4(a);
  const B = bigrammesV4(b);
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return A.size + B.size ? (2 * n) / (A.size + B.size) : 0;
}

/**
 * GV2-24 : sous-titres avec un texte fourni. Les mots du texte (`texte`, orthographe du fondateur, instants de `horodaterMotsPrononces`)
 * ne bougent pas ; on RETIRE ceux que la voix ne dit pas et on AJOUTE les mots de la voix gardés que le texte ne couvre pas.
 * Zone d'une phrase retrouvée : les mots de la voix dont le milieu est dans sa plage (temps de la prise), plus une suite hors phrase
 * « absorbée » (collée à moins de 1,5 s et proche, en lettres, des mots de la phrase non entendus : même règle que GV2-14).
 *  - mot du texte gardé : sans lettres (« ? »), ou il recouvre dans le temps un mot de la zone de SA phrase ET un mot de cette zone
 *    a la même forme ou une écriture voisine (proximité ≥ 0,5 ; « 2. » / « Deux, », « weekend » / « week-ends ») ;
 *  - mot de la voix couvert : il est absorbé, ou il est dans la plage d'une phrase retrouvée et un mot du texte gardé le recouvre ;
 *  - jamais ajoutés : « euh », consignes au monteur, ponctuation seule.
 * Les mots ajoutés passent par le lexique de marque (1 à 3 mots qui se suivent → 1 mot ; début du premier, fin du dernier).
 */
function completerParLaVoixV4(texte: MotTranscrit[], phraseDe: Map<MotTranscrit, number>, sansDuree: Set<MotTranscrit>, retrouvees: PhraseRetrouvee[], motsPrise: MotHorodate[], plan: PlanCoupes, enMontee: (m: MotHorodate) => MotTranscrit | null): MotTranscrit[] {
  const milieu = (m: MotHorodate) => (m.debutSec + m.finSec) / 2;
  const dansPlage = (m: MotHorodate, p: { debutSec?: number; finSec?: number }) => p.debutSec !== undefined && p.finSec !== undefined && milieu(m) >= p.debutSec - 1e-3 && milieu(m) <= p.finSec + 1e-3;
  const recouvre = (x: MotTranscrit, y: MotTranscrit) => x.a < y.f - 1e-6 && x.f > y.a + 1e-6;
  const dites = plan.phrases.flatMap((p) => (p.debutSec === undefined && p.diteAutrement ? [p.diteAutrement] : []));
  const compte = (m: MotHorodate) => formesV4(m.mot).length > 0 && !estHesitation(m.mot) && !plan.consignes.some((c) => dansPlage(m, c));
  const voix = motsPrise.flatMap((m, rang) => {
    const x = enMontee(m);
    return x && compte(m) ? [{ m, rang, x, phrase: retrouvees.findIndex((p) => dansPlage(m, p)) }] : [];
  });
  // Suites hors phrase absorbées (GV2-14) : rattachées à la phrase voisine.
  const nonEntendus = (p: PhraseRetrouvee) => {
    const dits = new Set(motsPrise.filter((x) => dansPlage(x, p)).flatMap((x) => tokens(x.mot)));
    return tokens(p.texte).filter((t) => !dits.has(t)).join("");
  };
  const hors = voix.filter((v) => v.phrase < 0 && !dites.some((p) => dansPlage(v.m, p)));
  const absorbes = new Set<number>();
  for (let i = 0; i < hors.length; ) {
    let j = i;
    while (j + 1 < hors.length && hors[j + 1].rang === hors[j].rang + 1) j++;
    const suite = hors.slice(i, j + 1);
    const debut = suite[0].m.debutSec;
    const fin = suite[suite.length - 1].m.finSec;
    const k = retrouvees.findIndex((p) => (debut >= p.finSec! - 1e-3 && debut - p.finSec! < 1.5) || (fin <= p.debutSec! + 1e-3 && p.debutSec! - fin < 1.5));
    const manque = k >= 0 ? nonEntendus(retrouvees[k]) : "";
    if (manque && proximiteV4(suite.map((x) => formesV4(x.m.mot)).join(""), manque) >= 0.5)
      for (const x of suite) {
        absorbes.add(x.rang);
        x.phrase = k;
      }
    i = j + 1;
  }
  const gardes = texte.filter((t) => {
    const f = formesV4(t.w);
    if (!f) return true;
    const zone = voix.filter((v) => v.phrase === phraseDe.get(t));
    return zone.some((v) => recouvre(t, v.x)) && (!sansDuree.has(t) || zone.some((v) => formesV4(v.m.mot) === f || proximiteV4(formesV4(v.m.mot), f) >= 0.5));
  });
  const libres = voix.filter((v) => !absorbes.has(v.rang) && !(v.phrase >= 0 && gardes.some((t) => recouvre(t, v.x))));
  const ajoutes = lexiqueV4(libres);
  if (!ajoutes.length && gardes.length === texte.length) return texte;
  return [...gardes, ...ajoutes].sort((x, y) => x.a - y.a || x.f - y.f);
}

/** GV-MD-03 : avance d'une animation sur le début du mot qu'elle illustre (s), comme les autres générateurs. */
export const AVANCE_CALAGE_MOT_V4 = 0.15;
/** GV-MD-03 : fenêtre (s) dans laquelle un élément sans `motIndex` se cale sur le mot le plus proche de son début. */
export const FENETRE_CALAGE_MOT_V4 = 0.8;

/**
 * GV-MD-03 : étape PURE de recalage des plaquettes v4 sur le mot dit, après la réponse d'Opus et avant le rendu.
 * Avec `motIndex` : début = début du mot − 0,15 s. Sans : mot le plus proche du début demandé (fenêtre 0,8 s), même avance ; hors fenêtre :
 * seconde demandée gardée. La durée de l'élément est conservée (tout l'élément glisse). Jamais de chevauchement : si l'élément recalé
 * recouvre le précédent (déjà recalé) ou le suivant (à sa place d'origine), il garde sa place d'origine. Un glissement qui sortirait
 * une ligne ou un instant daté de l'élément, ou de la vidéo, est refusé. Ne modifie pas le plan reçu.
 */
export function recalerPlanAuMotV4(plan: PlanFacecamAnimee, mots: readonly MotTranscrit[]): PlanFacecamAnimee {
  const elements = plan.elementsV4;
  if (!elements?.length || !mots.length) return plan;
  const ordre = elements.map((_e, k) => k).sort((x, y) => elements[x].debut - elements[y].debut || elements[x].fin - elements[y].fin);
  const arrondi = (x: number) => Math.round(x * 1000) / 1000;
  const nouveaux = elements.map((e) => ({ ...e }));
  const deplace = new Set<number>();
  ordre.forEach((idx) => {
    const e = elements[idx];
    const cible = (() => {
      const m = e.motIndex !== undefined ? mots[e.motIndex] : undefined;
      if (m) return m;
      let meilleur: MotTranscrit | undefined;
      for (const w of mots) if (Math.abs(w.a - e.debut) <= FENETRE_CALAGE_MOT_V4 && (!meilleur || Math.abs(w.a - e.debut) < Math.abs(meilleur.a - e.debut))) meilleur = w;
      return meilleur;
    })();
    if (!cible) return;
    const debut = arrondi(Math.max(0, cible.a - AVANCE_CALAGE_MOT_V4));
    const fin = arrondi(e.fin + (debut - e.debut));
    const datees = [...(e.instants ?? []), ...(e.lignes ?? []).map((l) => l.a)];
    if (Math.abs(debut - e.debut) < 1e-9 || fin > plan.duree || !datees.every((t) => t >= debut && t <= fin)) return;
    nouveaux[idx].debut = debut;
    nouveaux[idx].fin = fin;
    deplace.add(idx);
  });
  // Jamais de chevauchement créé : à chaque recouvrement, le second (sinon le premier) retrouve sa place d'origine.
  for (let k = 1; k < ordre.length; ) {
    const [i, j] = [ordre[k - 1], ordre[k]];
    const chevauche = nouveaux[j].debut < nouveaux[i].fin - 1e-9 && !(elements[j].debut < elements[i].fin - 1e-9 && !deplace.has(i) && !deplace.has(j));
    const restaurable = deplace.has(j) ? j : deplace.has(i) ? i : -1;
    if (chevauche && restaurable >= 0) {
      nouveaux[restaurable] = { ...elements[restaurable] };
      deplace.delete(restaurable);
      k = Math.max(1, k - 1);
    } else k++;
  }
  return { ...plan, elementsV4: nouveaux };
}

/** GV-MD-03 : le plan à garder dans l'état. Réglage éteint (défaut) : plan d'Opus tel quel. Allumé : plan recalé + ancien plan gardé pour comparer. */
function planCaleV4(plan: PlanFacecamAnimee, mots: readonly MotTranscrit[] | undefined, actif: boolean | undefined): { plan: PlanFacecamAnimee; planAvantCalage?: PlanFacecamAnimee } {
  if (!actif || !mots?.length) return { plan };
  const cale = recalerPlanAuMotV4(plan, mots);
  return cale === plan ? { plan } : { plan: cale, planAvantCalage: plan };
}

/** Entrée du réalisateur pour la prise montée (sans écran de fin : la v4 se termine sur la dernière plaquette). PUR. */
export function entreeRealisateurV4(etat: Pick<EtatChaineV4, "demande" | "coupes" | "cadrage">, options: { plafondAtteint?: boolean; historique?: HistoriqueVideo[]; calageAuMot?: boolean } = {}): EntreeRealisateur {
  const c = etat.coupes;
  if (!c) throw new ErreurChaineV4("Les coupes de la prise manquent : réessayez.", true);
  return {
    mots: c.mots,
    dureeSec: c.dureeSec,
    ...(etat.demande.titre ? { titre: etat.demande.titre } : {}),
    ...(etat.demande.videoId ? { videoId: etat.demande.videoId } : {}),
    ...(options.historique?.length ? { historique: options.historique } : {}),
    ...(options.plafondAtteint ? { plafondAtteint: true } : {}),
    ...(options.calageAuMot ? { calageAuMot: true } : {}),
    prise: {
      src: PRISE_MONTEE_V4,
      finSec: c.dureeSec,
      // Prise recadrée sur le visage : sa position dans la colonne gardée (une prise verticale garde les valeurs par défaut, comme avant).
      ...(etat.cadrage?.visage ? { centreX: etat.cadrage.centreX, ...(etat.cadrage.yeux !== undefined ? { yeux: etat.cadrage.yeux } : {}), ...(etat.cadrage.largeurVisage !== undefined ? { largeurVisage: etat.cadrage.largeurVisage } : {}) } : {}),
    },
    fin: { debut: c.dureeSec, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: [] },
  };
}

/** Prise trop courte ou muette : aucune vidéo (phrase pour Will). */

/** GV2-04 : une panne du service de montage au-delà de ce nombre de tours muets de suite (un tour toutes les 5 s ≈ 5 min) arrête la chaîne. */
export const TOURS_MUETS_MAX_V4 = 60;
/** GV2-04 : un conteneur de transcription ou de repérage injoignable plus longtemps que cela arrête la chaîne (la file normale n'est jamais comptée). */
export const INJOIGNABLE_MAX_MS_V4 = 30 * 60 * 1000;

const sansInjoignable = (etat: EtatChaineV4, cle: "transcription" | "visage"): EtatChaineV4 => {
  if (!etat.injoignableDepuis?.[cle]) return etat;
  const reste = { ...etat.injoignableDepuis };
  delete reste[cle];
  const sans = { ...etat };
  delete sans.injoignableDepuis;
  return Object.keys(reste).length ? { ...sans, injoignableDepuis: reste } : sans;
};

/** Pose ou lit le début de la panne du conteneur ; 30 min : échec réessayable. Une réponse (même « en file » ou « en cours ») remet le compte à zéro. */
async function attendreInjoignable<T>(etat: EtatChaineV4, cle: "transcription" | "visage", maintenant: number, phraseEchec: string, appel: () => Promise<T>): Promise<T> {
  try {
    return await appel();
  } catch (err) {
    if (!(err instanceof EnCoursChaineV4)) throw err;
    if (err.nature !== "injoignable") {
      if (etat.injoignableDepuis?.[cle]) throw new EnCoursChaineV4(err.quoi, sansInjoignable(etat, cle));
      throw err;
    }
    const depuis = etat.injoignableDepuis?.[cle] ?? new Date(maintenant).toISOString();
    if (maintenant - new Date(depuis).getTime() > INJOIGNABLE_MAX_MS_V4) throw new ErreurChaineV4(phraseEchec, true, undefined, sansInjoignable(etat, cle));
    throw new EnCoursChaineV4(err.quoi, { ...etat, injoignableDepuis: { ...etat.injoignableDepuis, [cle]: depuis } }, "injoignable");
  }
}

/** Compte les tours muets de suite du service de montage (hors de l'outil : l'état de la chaîne est ici). Une réponse remet le compte à zéro. */
async function compterMuets<T>(etat: EtatChaineV4, appel: () => Promise<T>): Promise<T> {
  try {
    return await appel();
  } catch (err) {
    if (!(err instanceof EnCoursChaineV4)) throw err;
    const avant = etat.muets?.rendu ?? 0;
    if (err.nature !== "muet") {
      if (avant > 0) throw new EnCoursChaineV4(err.quoi, { ...etat, muets: { ...etat.muets, rendu: 0 } });
      throw err;
    }
    const n = avant + 1;
    if (n > TOURS_MUETS_MAX_V4) throw new ErreurChaineV4("Le service de montage ne répond plus depuis 5 minutes.", true, undefined, { ...etat, muets: { ...etat.muets, rendu: 0 } });
    throw new EnCoursChaineV4(err.quoi, { ...etat, muets: { ...etat.muets, rendu: n } }, "muet");
  }
}

/** Phrase de l'alerte quand la version simple est livrée en dernier filet. */
export const PHRASE_FILET_SIMPLE_V4 = "Mise en scène simple : aucune vidéo d'illustration fidèle n'a été trouvée.";

/** UN pas de la chaîne. */
export async function avancerChaineV4(etat: EtatChaineV4, outils: OutilsChaineV4, essai?: number, maintenant: number = Date.now()): Promise<EtatChaineV4> {
  // GV2-04 : « Réessayer » repart sur de NOUVEAUX identifiants (les services gardent un échec sous l'ancien). Premier essai : identifiants inchangés.
  const suffixe = essai !== undefined && essai > 1 ? `-e${essai}` : "";
  switch (etat.etape) {
    case "transcription": {
      const t = await attendreInjoignable(etat, "transcription", maintenant, "L'outil de transcription ne répond plus depuis 30 minutes.", () => outils.transcrire({ priseCle: etat.demande.priseCle, appelId: `fa4-mots-${etat.demande.versionId}${suffixe}` }));
      if (!t.mots.length) throw new ErreurChaineV4("Je n'entends aucun mot dans cette vidéo : vérifiez le son de la prise, puis déposez-la à nouveau.", false);
      const dims = t.largeurSource && t.hauteurSource ? { largeur: t.largeurSource, hauteur: t.hauteurSource } : {};
      return { ...sansInjoignable(etat, "transcription"), etape: "coupes", transcription: { mots: t.mots, dureeSec: t.dureeSec, ...dims } };
    }
    case "coupes": {
      const t = etat.transcription;
      if (!t) return { ...etat, etape: "transcription" };
      const coupes = couperPriseV4({ mots: t.mots, dureeSec: t.dureeSec, texteValide: etat.demande.texteValide });
      if (coupes.dureeSec < DUREE_MIN_SEC || !coupes.mots.length) throw new ErreurChaineV4("Après les coupes, il reste moins de 5 secondes de parole : la vidéo est trop courte pour être animée.", false);
      // Prise horizontale : cadre vertical fixe sur le visage (repérage extérieur repris au passage suivant tant qu'il tourne).
      let cadrage = etat.cadrage;
      if (!cadrage && priseHorizontale(t)) {
        let visage: Awaited<ReturnType<NonNullable<OutilsChaineV4["reperer"]>>> = null;
        if (outils.reperer) {
          try {
            visage = await attendreInjoignable(etat, "visage", maintenant, "L'outil de repérage du visage ne répond plus depuis 30 minutes.", () => (outils.reperer as NonNullable<OutilsChaineV4["reperer"]>)({ priseCle: etat.demande.priseCle, appelId: `fa4-visage-${etat.demande.versionId}${suffixe}` }));
          } catch (e) {
            if (e instanceof EnCoursChaineV4) throw e;
            visage = null; // repérage raté : colonne centrée (la vidéo est quand même fabriquée)
          }
        }
        cadrage = recadrageVerticalV4({ largeur: t.largeur as number, hauteur: t.hauteur as number }, visage);
      }
      return { ...sansInjoignable(etat, "visage"), etape: "mise-en-scene", coupes, ...(cadrage ? { cadrage } : {}) };
    }
    case "mise-en-scene": {
      const [plafondAtteint, historique] = await Promise.all([outils.plafondClaudeAtteint(), outils.historique?.() ?? Promise.resolve([])]);
      const repli = etat.repliSansVideo && !etat.repliSansVideo.fait ? etat.repliSansVideo : null;
      // État abîmé (repli commencé mais plan d'Opus perdu) : on le dit, on ne refait pas une mise en scène ordinaire à la place.
      if (repli && !etat.realisation) throw new ErreurChaineV4(phraseRepliEchecV4(repli.retirees), true, "repli sans vidéo : le plan précédent est introuvable", etat);
      const entree = entreeRealisateurV4(etat, { plafondAtteint, historique, ...(outils.calageAuMot ? { calageAuMot: true } : {}) });
      const r = await realiser(
        repli ? { ...entree, repli: { interdites: IDS_PLAQUETTES_A_VIDEO_V4, elementsPrecedents: repli.elementsPrecedents, erreurs: erreursRepliV4(etat.realisation!.plan, repli.retirees), essaisMax: ESSAIS_REPLI_SANS_VIDEO_V4 } } : entree,
        { appeler: outils.appelerRealisateur },
      );
      if (repli) {
        // Repli : une version complète et rendable est acceptée. Sinon (refus, plafond, panne) : DERNIER FILET (GV2-04), la version simple, sans appel
        // Claude, livrée avec une alerte. Si elle ne passe pas non plus les contrôles, l'échec reste (phrase claire, état gardé à la mise en scène).
        const filet = async (erreur: ErreurChaineV4): Promise<EtatChaineV4> => {
          const s = await realiser(entree, {});
          if (s.version !== "simple" || !s.rendable || !s.plan.elementsV4?.length || plaquettesSansVideo(s.plan).length) throw erreur;
          return { ...etat, etape: "videos", repliSansVideo: { ...repli, fait: true, essais: r.essais }, realisation: { version: "simple", filetSimple: true, essais: (etat.realisation?.essais ?? 0) + r.essais, avertissements: s.avertissements.length, phrase: PHRASE_FILET_SIMPLE_V4, plan: s.plan } };
        };
        if (r.essais === 0 || r.phrase === MENTION_PLAFOND_FACECAM_ANIMEE) return filet(new ErreurChaineV4("Le plafond Claude de cette vidéo est atteint : la mise en scène sans vidéo n'a pas pu être refaite. Reprendre la relancera quand Claude sera de nouveau disponible.", true, undefined, etat));
        if (r.phrase === PHRASE_REALISATEUR_PANNE) return filet(new ErreurChaineV4("Claude est indisponible : la mise en scène sans vidéo n'a pas pu être refaite. Reprendre la relancera dans un instant.", true, (r.erreurs ?? []).slice(0, 2).join(" | "), etat));
        if (r.version !== "complete" || !r.rendable || !r.plan.elementsV4?.length) {
          return filet(new ErreurChaineV4(phraseRepliEchecV4(repli.retirees), true, (r.erreurs ?? []).slice(0, 5).join(" | "), etat));
        }
        return { ...etat, etape: "videos", repliSansVideo: { ...repli, fait: true, essais: r.essais }, realisation: { version: r.version, essais: (etat.realisation?.essais ?? 0) + r.essais, avertissements: r.avertissements.length, phrase: phraseRepliOkV4(repli.retirees), ...planCaleV4(r.plan, etat.coupes?.mots, outils.calageAuMot) } };
      }
      if (!r.rendable || !r.plan.elementsV4?.length) {
        throw new ErreurChaineV4("La mise en scène n'a pas passé les contrôles : la vidéo n'est pas fabriquée. Réessayez.", true, (r.erreurs ?? []).slice(0, 5).join(" | "));
      }
      return { ...etat, etape: "videos", realisation: { version: r.version, essais: r.essais, ...(r.erreurs?.length ? { erreurs: r.erreurs.slice(0, 20) } : {}), avertissements: r.avertissements.length, ...(r.phrase ? { phrase: r.phrase } : {}), ...planCaleV4(r.plan, etat.coupes?.mots, outils.calageAuMot) } };
    }
    case "videos": {
      if (!etat.realisation || !etat.coupes) return { ...etat, etape: etat.coupes ? "mise-en-scene" : "coupes" };
      let plan = etat.realisation.plan;
      let fichiers = etat.videos?.fichiers ?? [];
      let manques: string[] = [];
      let choix = etat.videos?.choix;
      let depenseUsd = etat.videos?.depenseUsd;
      // Seules les plaquettes qui exigent des vidéos qu'elles n'ont pas déclenchent la recherche (une reprise ne refait pas ce qui est fait).
      if (plaquettesSansVideo(plan).length) {
        if (outils.videos) {
          const r = await outils.videos({ videoId: etat.demande.videoId, plan, mots: etat.coupes.mots });
          plan = r.plan;
          // Fusion avec les fichiers déjà prêts (reprise d'un plan à moitié rempli), un seul fichier par nom ; le plus récent l'emporte.
          fichiers = [...fichiers.filter((f) => !r.fichiers.some((n) => n.nom === f.nom)), ...r.fichiers];
          manques = r.manques;
          depenseUsd = r.depenseUsd;
          choix = r.choix;
        }
      }
      // Décision de Will (18/10) : sans vidéo littérale, la plaquette est RETIRÉE (le visage reste seul), jamais remplacée par une approximation.
      const retrait = retirerPlaquettesSansVideo(plan);
      // Contrôles relancés sur le plan APRÈS retrait (le visage seul peut violer H1, H2 : c'est noté dans le rapport, aucune règle n'est assouplie).
      const controle = retrait.retirees.length ? controlerDiversiteV4(retrait.plan, { mots: etat.coupes.mots }) : null;
      const resume = {
        fichiers: [] as FichierVideoV4[],
        retirees: retrait.retirees,
        manques,
        ...(depenseUsd !== undefined ? { depenseUsd } : {}),
        ...(controle ? { controle: { rendable: estRendableV4(controle.erreurs), erreurs: controle.erreurs.slice(0, 20) } } : {}),
      };
      // H1 et H2 sont BLOQUANTS (règle de Will) : un plan hors règles, ou vidé de ses plaquettes, n'est jamais rendu. Décision de Will : on bloque.
      if (retrait.retirees.length && (!retrait.plan.elementsV4?.length || (controle && !estRendableV4(controle.erreurs)))) {
        // Repli « sans vidéo » (une seule fois) : Opus refait sa mise en scène sans plaquette à vidéo ; l'état garde le plan qu'il avait écrit.
        if (!etat.repliSansVideo && outils.appelerRealisateur) {
          return { ...etat, etape: "mise-en-scene", repliSansVideo: { retirees: retrait.retirees, manques, elementsPrecedents: elementsPourRepliV4(plan) }, videos: { ...resume, fichiers, ...(choix?.length ? { choix } : {}) } };
        }
        // Seulement le nom lisible de la plaquette (fiche du catalogue) et l'instant : jamais le texte écrit par Claude.
        const quoi = nomsRetireesV4(retrait.retirees);
        throw new ErreurChaineV4(
          `Je n'ai pas trouvé de vidéo fidèle à ce que vous dites pour ${quoi} : monter la vidéo sans elle casserait votre rythme. Reprendre relance la recherche.`,
          true,
          (controle?.erreurs ?? []).slice(0, 5).join(" | "),
          // état gardé : le plan PARTIELLEMENT rempli, sans retrait (la reprise ne cherche que les plaquettes manquantes et ne repaie pas les contrôles faits) + le diagnostic
          { ...etat, etape: "videos", realisation: { ...etat.realisation, plan }, videos: { ...resume, fichiers, ...(choix?.length ? { choix } : {}) } },
        );
      }
      return {
        ...etat,
        etape: "rendu",
        realisation: { ...etat.realisation, plan: retrait.plan },
        videos: {
          fichiers: fichiers.filter((f) => (retrait.plan.elementsV4 ?? []).some((e) => (e.medias ?? []).some((m) => m.endsWith(`/${f.nom}`) || m === f.nom))),
          ...(choix?.length ? { choix: choix.filter((c) => (retrait.plan.elementsV4 ?? []).some((e) => (e.medias ?? []).some((m) => m.endsWith(`/${c.fichier}`) || m === c.fichier))) } : {}),
          retirees: retrait.retirees,
          manques,
          ...(depenseUsd !== undefined ? { depenseUsd } : {}),
          ...(controle ? { controle: { rendable: estRendableV4(controle.erreurs), erreurs: controle.erreurs.slice(0, 20) } } : {}),
        },
      };
    }
    case "rendu": {
      if (!etat.realisation || !etat.coupes) return { ...etat, etape: etat.coupes ? "mise-en-scene" : "coupes" };
      // Jamais de rendu d'une plaquette à vidéo sans vidéo (v-60359dd080b1 : `broll/` sans nom de fichier, 404 à 99 %) ; sert aussi à reprendre un travail déjà à « rendu ».
      if (plaquettesSansVideo(etat.realisation.plan).length) return { ...etat, etape: "videos" };
      // Lot R2 : le plan de scènes se compose (et se garde) AVANT le rendu : un pas à lui seul, jamais refait à la reprise.
      if (outils.planScenes && !etat.planScenes) {
        const memo = await planPourVideo({ generateur: "facecam-animee", mots: etat.coupes.mots.map((m) => ({ texte: m.w, debutSec: m.a, finSec: m.f })), dureeSec: etat.coupes.dureeSec, facecam: true, format: FORMAT_PLAN_FACECAM_ANIMEE, appeler: outils.planScenes.appeler });
        return { ...etat, planScenes: memo };
      }
      const planRendu = etat.planScenes?.plan ? { ...etat.realisation.plan, planScenes: etat.planScenes.plan } : etat.realisation.plan;
      const gardes = etat.coupes.gardes;
      const rendu = await compterMuets(etat, () => outils.rendre({ idRendu: `fa4-${etat.demande.versionId}${suffixe}`, priseCle: etat.demande.priseCle, plan: planRendu, gardes, ...(etat.cadrage ? { recadrage: etat.cadrage } : {}), ...(etat.videos?.fichiers.length ? { videos: etat.videos.fichiers } : {}) }));
      return { ...etat, ...(etat.muets ? { muets: { ...etat.muets, rendu: 0 } } : {}), etape: "prete", rendu };
    }
    case "prete":
      return etat;
  }
}
