/**
 * CHAÎNE DU TUTORIEL D'OUTIL (lot I) — script → voix → calage → plan de scènes → montage 4:5 → autres formats.
 * Pilotée PAS À PAS : `avancerEtape` fait UN pas de l'étape demandée et rend le nouvel état (gardé dans le travail par le
 * moteur). Rien n'est attendu longtemps : un rendu en cours rend l'état tel quel.
 *
 * Pièces réutilisées, sans rien changer :
 *  - voix : la sous-machine `voix-maitre` (lecture HeyGen épinglée, payée une fois, calage des mots, nettoyage) ; la voix
 *    est contrôlée AVANT la lecture (`exigerVoixMaitre`) ;
 *  - calage et sous-titres : `fabriquerSousTitres` (report des mots lus sur le texte validé, groupes) et `donneesCalque` ;
 *  - plan : `genererPlan` (lot C, Opus 5.5, fournisseur injecté) puis `validerPlan` (repli par scène, jamais de refus) ;
 *    niveau 3 interdit (le validateur le replie), pas de visage (`facecam: false`) ;
 *  - rendu : la composition Remotion `TutorielOutil` (plan + voix + sous-titres + carte de fin Axion), opération
 *    `composition` de `studio-rendu`.
 * Retouche « parties touchées seulement » : le plan de la version d'avant est repris tel quel si le texte et le minutage
 * n'ont pas changé ; sinon chaque scène dont les mots sont les mêmes garde sa pièce et ses paramètres, et seules les
 * scènes à l'empreinte changée sont comptées « touchées » (`scenesARerendre`).
 * Jamais d'échec pour une qualité : les remarques deviennent des réserves « À vérifier · … » sur la vidéo.
 */
import { empreinteAudioMaitre } from "@/briques/empreinte-audio";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import { genererPlan } from "@/briques/plan-scenes/generateur";
import { fnv1a64, jsonCanonique, scenesARerendre } from "@/briques/plan-scenes/empreinte";
import type { MotMinute, PlanValide, SceneValide } from "@/briques/plan-scenes/schema";
import { validerPlan, type Remarque } from "@/briques/plan-scenes/validateur";
import { planNiveau1, planNu } from "@/briques/plan-scenes/plan-nu";
import { baseRetenue, donneesCalque, fabriquerSousTitres } from "@/briques/sous-titres";
import { avancerVoixMaitre, type EtatVoixMaitre, type OutilsVoixMaitre } from "@/briques/voix-maitre/machine";
import { exigerVoixMaitre, VOIX_MAITRE_HEYGEN_ID } from "@/briques/voix-maitre/voix-epinglee";
import { lecturesVoixMax } from "@/briques/voix-maitre/reference";
import type { AudioMaitre } from "@/briques/voix-maitre/types";
import { horodaterTexte } from "@/domaine/derivations";
import type { BaseSousTitres, CommandeFabrication, IntensiteSousTitres, MotHorodate, Ratio, SegmentSousTitres, ValeurStyleSousTitres } from "@/domaine/types";
import { empreinteEffetsFilm, empreinteFormat, filmReutilisable, formatsARefaire, type FilmTutoriel } from "./rendu-partiel";
import { demandesRecollage, ENTREE_AVANT, ENTREE_VOIX, entreePlage, plagesARerendre, planRecollage, type PlageImages } from "@/briques/rendu-par-plages";
import { TRANSITION_MAX_MS } from "@/briques/plan-scenes/zones";
import { ErreurRendu, suivreRendu } from "@/fournisseurs/rendu/client";
import type { DemandeRendu, ServiceRendu } from "@/fournisseurs/types";
import { hautBandeSousTitresPct } from "../../briques/plan-scenes/tutoriel/motion-film";
import { planCacheLeFilm, plagesFixesSortie, type NavigationFilmee } from "../../briques/plan-scenes/tutoriel/navigation-filmee";
import type { InstantRegard, LectureRegard, VerdictRegard } from "@/briques/regardeur";
import type { RapportControleImage } from "@/briques/controle-image";
import { instantsTutoriel, textesPermisDuRegistre, verdictRegardTutoriel } from "./equipe/regardeur";
import type { VerdictControleur } from "./equipe/controleur";
import type { RegistreTextes } from "./equipe/registre-textes";
import { noterTutoriel, type GrilleTutoriel } from "./grille-qualite";
import { ENTREE_TUTORIEL, estSansVoix, lireEntreesTutoriel } from "./entrees";
import { cibleSon, lireMesure, parametresMesure, parametresMixage, parametresVignette, type MesureSon } from "./finitions";
import { finDuTutoriel, type FinDuTutoriel } from "./fin";
import { COMPOSITION_TUTORIEL, dureeImagesTutoriel, formatDuRatio, type ProprietesTutorielOutil } from "./proprietes";
import { MOTS_PAR_SECONDE, remarquesScript, scriptRetenu, type SourceScript } from "./script";
import type { EntreeRole } from "@/generateur/roles/types";
import { calerScenario } from "./calage-scenario";
import { controlerApresCalage } from "./equipe/controleur";
import { appliquerSortie, prochainPas, type DossierLu, type EtatEquipe } from "./equipe/orchestre";
import { noterRole, type IdRole, type LigneJournal } from "./journal-roles";
import { dejaPaye, payerUneFois, type RegistrePaye } from "./reprise";

export const ETAPES_TUTORIEL = ["script", "voix", "calage", "plan", "montage", "exports"] as const;
export type CleEtapeTutoriel = (typeof ETAPES_TUTORIEL)[number];

/** Nouvelles demandes au rendu après un échec passager, avant de rendre l'étape en échec (réessayable). */
export const ESSAIS_RENDU_TUTORIEL = 3;

/**
 * Nombre de pas CONSÉCUTIFS où la lecture de l'état d'un rendu déjà soumis peut rester sans réponse (coupure réseau, service
 * qui se fige à la fin d'un rendu long) avant d'échouer comme avant. Une lecture réussie remet le compte à zéro. À une
 * relecture par seconde environ, 120 pas laissent environ deux minutes au service pour revenir ; le « Réessayer » relit ensuite
 * l'ancienne demande avant d'en soumettre une neuve (T-EXT-45b).
 */
export const ATTENTES_RESEAU_MAX = 120;

type SuiviLu = { e?: Awaited<ReturnType<typeof suivreRendu>>; panne?: ErreurRendu };

/**
 * Suit une demande DÉJÀ soumise. Une `ErreurRendu` réessayable levée par la LECTURE de l'état (pas par une soumission) n'est
 * pas un échec : `panne` est rendue, l'appelant garde l'état tel quel et relira au pas suivant. Jamais de nouvel identifiant.
 */
async function suivreSansEchec(service: ServiceRendu, demande: DemandeRendu): Promise<SuiviLu> {
  let panne: ErreurRendu | undefined;
  const lecteur: ServiceRendu = {
    soumettre: (d) => service.soumettre(d),
    async etat(id) {
      try {
        return await service.etat(id);
      } catch (err) {
        if (err instanceof ErreurRendu && err.reessayable) {
          panne = err;
          return { statut: "en_cours", progression: 0 };
        }
        throw err;
      }
    },
  };
  const e = await suivreRendu(lecteur, demande);
  return panne ? { panne } : { e };
}

/** Compte d'attente suivant ; au-delà de la borne, la panne est levée telle quelle (échec réessayable, comme avant). */
function attenteSuivante(avant: number | undefined, panne: ErreurRendu): number {
  const n = (avant ?? 0) + 1;
  if (n > ATTENTES_RESEAU_MAX) throw panne;
  return n;
}

/* ------------------------------------------------------------------ */
/* Outils injectés (services réels, ou doubles des tests)               */
/* ------------------------------------------------------------------ */

/** La voix : mêmes outils que la sous-machine `voix-maitre` (comme le tableau animé), plus la clé des fichiers. */
export type OutilsVoixTutoriel = Pick<
  OutilsVoixMaitre,
  "voix" | "stockage" | "aligneur" | "rendu" | "renduEstSimule" | "idVoix" | "reglages" | "tauxUsdEur" | "fournisseurVoix" | "caler" | "regles" | "erreurStockage" | "ressemblance"
> & { cle: (nom: string) => string; avantLecture?: (l: { caracteres: number; lecturesMax: number }) => void | Promise<void> };

export interface OutilsTutoriel {
  /** Absente : aucune voix reliée (la vidéo sort muette, avec une réserve). */
  voix?: OutilsVoixTutoriel;
  /** Claude (écriture du script depuis une idée, plan de scènes) : un double dans les tests. */
  claude: AppelClaude;
  rendu: {
    service: () => ServiceRendu;
    /** Adresses signées : lectures (par nom d'entrée) et dépôt du résultat. */
    signer: (lectures: Record<string, string>, depot: { cle: string; mime: string }) => Promise<{ lectures: Record<string, string>; urlDepot: string }>;
    /** Clé de stockage d'un fichier de la vidéo. */
    cle: (nom: string) => string;
  };
  /** T-EXT-27b : regard de Claude sur les images-clés du format maître (service ; le moteur n'en importe aucun). Absent = éteint, rien ne change. */
  regarder?: (x: { demandeMaitre: DemandeRendu; instants: InstantRegard[] }) => Promise<LectureRegard | null>;
  /** T-EXT-31 : mixage de la voix, mesure du son et vignette. Absent = éteint (chemin d'avant, inchangé). */
  finitions?: { actif: true };
  /** T-EXT-52b : retouche sans tout refaire (un format dont rien ne change est repris tel quel). Seul `true` allume ; absent = éteint, comportement d'avant. */
  retouchePartielle?: boolean;
  /** T-EXT-26a : fin commune (« Aucune » par défaut, « Prendre rendez-vous » si choisie). Absent = carte « Axion IA » d'aujourd'hui. */
  fin?: { actif: boolean };
  /** Style des sous-titres résolu par le studio ; absent : style par défaut. */
  sousTitres?: { style?: ValeurStyleSousTitres | null; base?: BaseSousTitres; intensite?: IntensiteSousTitres };
  /**
   * T-EXT-55 : l'équipe de rôles (chef de projet, analyste, stratège, scénariste…) qui écrit le script depuis le dossier ou la
   * phrase de Williams. Absent = éteint : script collé ou validé comme avant, une idée seule attend un script collé.
   */
  equipe?: PortEquipe;
  /**
   * T-EXT-42 : devis et plafond par vidéo, EN QUANTITÉS, montrés avant toute dépense. Absent = comportement d'avant, inchangé.
   * Présent : le moteur s'arrête en pause claire (jamais en échec, sans aucun appel) tant que Williams n'a pas accepté CE devis.
   */
  devis?: {
    roles: readonly { id: string; essaisMax: number }[];
    accord: { empreinte: string; le: string } | null;
    /** Ce qui a déjà été dépensé pour ce travail (appels revenus, caractères lus, rendus demandés), lu dans son état. */
    consomme(etat: EtatTutoriel): Promise<{ appelsClaude: number; caracteresVoix: number; rendus: number }>;
  };
}

/** Ports réels de l'équipe (T-EXT-55) : un double dans les tests. Le moteur n'importe aucun service. */
export interface PortEquipe {
  /** UN appel payant d'un rôle, par le chemin gardé de l'argent ; lève si l'appel n'a pas eu lieu (rien n'est alors compté). */
  appelerRole(role: IdRole, entree: EntreeRole): Promise<unknown>;
  /** Le dossier de Williams (zip déjà contrôlé) ; `null` : pas de dossier lisible. */
  lireDossier(): Promise<DossierLu | null>;
  /** Horloge (ISO) pour le registre des appels payés et le journal ; absente : l'heure du système. */
  maintenant?: () => string;
  /** V2-08 : vidéo partie d'une phrase ET création ouverte (lu par le service). Absent ou autre que `true` : comportement d'avant. */
  phraseOuverte?: boolean;
  /**
   * Briques du tronc commun des scripts (chantier SC), si elles sont sur master : elles COMMENTENT, jamais ne réécrivent.
   * Absent = rien (cas de master).
   */
  tronc?: {
    /** Remarques sur les versions proposées (porte A sans IA, puis juge si son réglage l'allume). */
    evaluer?: (versions: readonly { id: string; texte: string }[]) => Promise<string[]> | string[];
    /** Une correction de Williams devient une règle durable : avant / après. */
    noterCorrection?: (avant: string, apres: string) => Promise<void> | void;
  };
}

/* ------------------------------------------------------------------ */
/* État gardé dans le travail                                           */
/* ------------------------------------------------------------------ */

export interface AudioTutoriel {
  /** Absent : aucune voix (vidéo muette). */
  fichierCle?: string;
  dureeSec: number;
  mots: MotHorodate[];
  empreinte: string;
  reutilise: boolean;
  coutCentimes: number;
  caracteres: number;
  fournisseur: string;
  approximatif?: boolean;
}

export interface PlanRetenu {
  plan: PlanValide;
  remarques: Remarque[];
  source: "llm" | "repli" | "repris";
  /** Empreinte de l'entrée du plan (texte, minutage, format) : la même = plan repris sans appel. */
  empreinteEntree: string;
  /** Scènes nouvelles ou changées par rapport à la version d'avant (toutes pour une première fabrication). */
  scenesTouchees: string[];
}

/** Une opération de finition (mesure ou vignette) : sa demande, son essai, son résultat ou son échec définitif. */
export interface FinitionTutoriel<R> {
  /** Absent quand la signature ou la soumission a échoué avant toute demande (`resultat: "echec"`). */
  demande?: DemandeRendu;
  essai: number;
  resultat?: R | "echec";
  /** Pas consécutifs sans réponse du suivi (coupure réseau) ; remis à zéro dès qu'une lecture réussit. */
  attentesReseau?: number;
}

export interface RenduTutoriel {
  ratio: Ratio;
  demande: DemandeRendu;
  essai: number;
  sortie?: { fichierCle: string; dureeSec: number; taille: number };
  /** T-EXT-52b : fichier repris tel quel de la version d'avant (aucune demande de rendu, même `fichierCle`). */
  reprise?: true;
  /** T-EXT-45b : série de « Réessayer » (absente = jamais relancé). Elle entre dans l'identifiant de la demande : jamais un identifiant déjà vu par `studio-rendu`. */
  serie?: number;
  /** T-EXT-45b : « Réessayer » a remis ce rendu tombé à zéro ; le prochain pas le redemande. */
  aSoumettre?: true;
  /** T-EXT-45b : la demande est déjà inscrite dans l'état mais pas encore soumise ; le pas suivant la soumet SOUS CE MÊME identifiant (idempotent chez `studio-rendu`). */
  aEnvoyer?: true;
  /** Pas consécutifs où le suivi n'a pas eu de réponse (coupure réseau) : on relit au pas suivant ; remis à zéro dès qu'une lecture réussit. */
  attentesReseau?: number;
  /** T-EXT-31 : son mesuré du mp4 rendu. */
  mesure?: FinitionTutoriel<MesureSon>;
  /** T-EXT-31 : vignette produite (clé du .jpg). */
  vignette?: FinitionTutoriel<{ cle: string }>;
}

/** T-EXT-31 : voix passée par la chaîne son (une fois pour tous les formats). `echec` : voix brute gardée, réserve posée. */
export interface SonMixeTutoriel {
  fichierCle: string;
  lufs?: number;
  /** Absent quand la première signature a échoué (`echec: true`). */
  demande?: DemandeRendu;
  essai: number;
  fini: boolean;
  echec?: boolean;
  /** Pas consécutifs sans réponse du suivi du mixage (coupure réseau) ; remis à zéro dès qu'une lecture réussit. */
  attentesReseau?: number;
}

/** T-EXT-52b : le fichier rendu d'un format, gardé pour être repris par la version suivante (jamais recopié sous une autre clé). */
export interface SortieFormatTutoriel {
  fichierCle: string;
  dureeSec: number;
  taille: number;
  /** Résultat de la mesure du son de la version d'avant (finitions allumées seulement), remis tel quel sur le rendu repris. */
  mesure?: MesureSon | "echec";
  /** Résultat de la vignette de la version d'avant (finitions allumées seulement), remis tel quel sur le rendu repris. */
  vignette?: { cle: string } | "echec";
}

/** T-EXT-52b : la sortie gardée d'un format = son fichier + les résultats de ses finitions (seulement ceux qui existent). */
export function sortieGardee(r: RenduTutoriel): SortieFormatTutoriel | undefined {
  if (!r.sortie) return undefined;
  return { ...r.sortie, ...(r.mesure?.resultat !== undefined ? { mesure: r.mesure.resultat } : {}), ...(r.vignette?.resultat !== undefined ? { vignette: r.vignette.resultat } : {}) };
}

export interface EtatTutoriel {
  script?: { texte: string; source: SourceScript; remarques: string[] };
  /** Script écrit depuis l'idée, en attente de la relecture de Williams. */
  proposition?: string;
  /** T-EXT-55 : l'équipe de rôles (forme lue par l'écran de validation, T-EXT-24, et les actions de T-EXT-33). Absent = équipe éteinte. */
  equipe?: EtatEquipe;
  /** T-EXT-34 : journal des rôles (l'état de chaque rôle, jamais ses sorties). */
  roles?: LigneJournal[];
  voix?: EtatVoixMaitre;
  audio?: AudioTutoriel;
  sonMixe?: SonMixeTutoriel;
  sousTitres?: SegmentSousTitres[];
  motsPlan?: MotMinute[];
  plan?: PlanRetenu;
  /** Formats à rendre, dans l'ordre (le premier est le maître). */
  ratios: Ratio[];
  rendus: RenduTutoriel[];
  reserves: string[];
  /** Version d'avant (retouche, réexport) : ce qui peut être repris sans être refait ni repayé. */
  parent?: {
    plan?: PlanValide;
    audio?: AudioTutoriel;
    /** T-EXT-52b : rendus terminés de la version d'avant, ses empreintes de formats et son film. */
    rendus?: Partial<Record<Ratio, SortieFormatTutoriel>>;
    empreintesFormats?: Partial<Record<Ratio, string>>;
    film?: FilmTutoriel;
    /** T-EXT-52b : navigation entière du film de la version d'avant (pour le garder quand le film change). */
    navigationFilm?: NavigationFilmee;
    /** T-EXT-26a : fin de la version d'avant, reprise telle quelle. */
    fin?: FinDuTutoriel;
  };
  /** T-EXT-26a : fin retenue, gardée pour que la retouche et le réexport gardent la même fin (aucun nouveau tirage). */
  fin?: FinDuTutoriel;
  /** T-EXT-52b : empreinte de chaque format de CETTE version (écrite seulement réglage allumé). */
  empreintesFormats?: Partial<Record<Ratio, string>>;
  /** T-EXT-52b : film de CETTE version (réglage allumé et film dans les entrées). */
  film?: FilmTutoriel;
  /** T-EXT-53c : réglages du film de CETTE version (retouche par chat) ; absents : film réglé comme avant. */
  reglagesFilm?: unknown;
  /** T-EXT-52b : navigation du film RETENUE pour CETTE version (celle des entrées, ou celle de la version d'avant quand le film change). */
  navigationFilm?: NavigationFilmee;
  echecSimuleFait?: boolean;
  /** Appels Claude REVENUS sans lever (un appel refusé ou en panne n'est pas compté). Absent tant qu'aucun n'est revenu. */
  appelsClaude?: { plan: number; regard?: number; roles?: Record<string, number>; /** Hérité : plus écrit (T-EXT-55 retire l'écrivain hors équipe). */ script?: number };
  /** T-EXT-27b : ce que le regard a vu (une fois par version) ; absent tant que le pas n'a pas eu lieu. */
  regard?: { instants: number; relues: number; verdict: VerdictRegard };
  /** T-EXT-27b : grille de qualité chiffrée, seulement quand le verdict du contrôleur et celui du contrôle de l'image sont dans l'état. */
  grille?: GrilleTutoriel;
  /** T-EXT-45b : appels payants déjà revenus (étape + empreinte de l'entrée) : une reprise ne les repaie pas. Résultats seulement. */
  payes?: RegistrePaye;
}

/** Enveloppe d'un appel Claude : ne compte que les appels revenus sans lever. */
function compterAppels(appeler: AppelClaude, n: { v: number }): AppelClaude {
  return async (requete) => {
    const r = await appeler(requete);
    n.v++;
    return r;
  };
}

const avecAppels = (etat: EtatTutoriel, cle: "plan" | "regard", n: number): EtatTutoriel => (n > 0 ? { ...etat, appelsClaude: { plan: 0, ...etat.appelsClaude, [cle]: (etat.appelsClaude?.[cle] ?? 0) + n } } : etat);

/** T-EXT-55 : un appel de rôle REVENU (un appel repris par `payerUneFois` n'est pas recompté). */
const avecAppelRole = (etat: EtatTutoriel, role: IdRole): EtatTutoriel => ({ ...etat, appelsClaude: { plan: 0, ...etat.appelsClaude, roles: { ...etat.appelsClaude?.roles, [role]: (etat.appelsClaude?.roles?.[role] ?? 0) + 1 } } });

/** T-EXT-45b : le registre ne garde que ce qui a été payé ET utilisable (appel revenu, résultat rendu) ; le reste reste refaisable. `faitLe` = date de la commande (l'état reste déterministe). */
const avecPayes = (etat: EtatTutoriel, registre: RegistrePaye, paye: boolean): EtatTutoriel => (paye ? { ...etat, payes: registre } : etat);

/** Ordre des formats : 4:5 d'abord, puis les autres formats demandés, dans leur ordre. */
export function ratiosTutoriel(ratios: readonly Ratio[]): Ratio[] {
  const demandes = ratios.length ? ratios : (["4:5"] as Ratio[]);
  return demandes.includes("4:5") ? ["4:5", ...demandes.filter((r) => r !== "4:5")] : [...demandes];
}

export function etatInitial(commande: Pick<CommandeFabrication, "ratios">): EtatTutoriel {
  return { ratios: ratiosTutoriel(commande.ratios), rendus: [], reserves: [] };
}

/* ------------------------------------------------------------------ */
/* Résultat d'un pas                                                    */
/* ------------------------------------------------------------------ */

export type PasTutoriel =
  | { statut: "faite"; etat: EtatTutoriel }
  | { statut: "en-cours"; etat: EtatTutoriel }
  /** Attente de Williams (script à valider) ou d'un outil : pause claire, jamais un échec. */
  | { statut: "pause"; etat: EtatTutoriel; code: string; message: string };

/** Erreur d'une étape (typée, lisible) : le moteur la rend en échec d'étape réessayable ou non. */
export class ErreurTutoriel extends Error {
  constructor(
    readonly code: string,
    readonly messagePourWill: string,
    readonly reessayable: boolean,
  ) {
    super(messagePourWill);
    this.name = "ErreurTutoriel";
  }
}

/* ------------------------------------------------------------------ */
/* Étapes                                                               */
/* ------------------------------------------------------------------ */

const texteLu = (texte: string, prononciations: readonly { mot: string; prononciation: string }[]): string =>
  prononciations.reduce((t, p) => t.replace(new RegExp(`(?<![\\p{L}\\p{N}])${p.mot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "giu"), p.prononciation), texte);

/** Ce que Williams a donné, pour le chef de projet : sa phrase (ou son idée), la fin et le parcours choisis, les formats. */
function demandeEquipe(commande: CommandeFabrication, e: ReturnType<typeof lireEntreesTutoriel>): EtatEquipe["demande"] {
  const brut = commande.entrees?.[ENTREE_TUTORIEL];
  const fin = brut && typeof brut === "object" ? (brut as { fin?: unknown }).fin : undefined;
  const phrase = e.depot?.mode === "phrase" ? e.depot.phrase : e.idee;
  return { ...(phrase ? { phrase } : {}), ...(fin === "prendre-rendez-vous" || fin === "aucune" ? { fin } : {}), ...(e.gabarit ? { gabaritImpose: e.gabarit } : {}), ratios: [...commande.ratios] };
}

/** Phrases d'un script de version, pour retrouver de quelle version vient une correction. */
const phrasesDe = (v: { phrases: readonly { texte: string }[] }): Set<string> => new Set(v.phrases.map((p) => p.texte.replace(/\s+/g, " ").trim()));

/** T-EXT-55 : la correction de Williams est notée au tronc (avant = la version dont elle reprend le plus de phrases), une seule fois, sans rien réécrire. */
async function noterCorrection(etat: EtatTutoriel, outils: OutilsTutoriel): Promise<EtatTutoriel> {
  const equipe = etat.equipe;
  const noter1 = outils.equipe?.tronc?.noterCorrection;
  if (!noter1 || !equipe?.scriptChoisi || equipe.scriptChoisi.source !== "corrige" || equipe.correctionNotee || !equipe.propositionScripts) return etat;
  const gardes = new Set(equipe.scriptChoisi.phrases.map((p) => p.texte.replace(/\s+/g, " ").trim()));
  const [a, b] = equipe.propositionScripts.versions;
  const commun = (v: typeof a) => [...phrasesDe(v)].filter((t) => gardes.has(t)).length;
  const avant = commun(b) > commun(a) ? b : a;
  try {
    await noter1(avant.phrases.map((p) => p.texte).join(" "), equipe.scriptChoisi.texte);
  } catch {
    // Le tronc ne bloque jamais.
  }
  return { ...etat, equipe: { ...equipe, correctionNotee: true } };
}

async function pasScript(etat: EtatTutoriel, commande: CommandeFabrication, outils: OutilsTutoriel): Promise<PasTutoriel> {
  if (etat.script) return { statut: "faite", etat: await noterCorrection(etat, outils) };
  const entrees = lireEntreesTutoriel(commande.entrees);
  const r = scriptRetenu(commande.script.texteComplet, entrees);
  if ("texte" in r) return { statut: "faite", etat: { ...etat, script: { texte: r.texte, source: r.source, remarques: remarquesScript(r.texte) } } };
  // Équipe allumée : un dossier ou une phrase déposés, ou une idée, passent par l'équipe, un rôle par pas.
  if (outils.equipe && (entrees.depot || "aEcrire" in r)) return pasEquipe(etat, commande, outils.equipe, entrees);
  if ("vide" in r) return { statut: "pause", etat, code: "TO_SCRIPT_ABSENT", message: "Aucun script ni idée : collez votre script ou donnez un titre. Rien n'a échoué." };
  if (etat.proposition) return { statut: "pause", etat, code: "TO_SCRIPT_A_VALIDER", message: "Relisez le script, modifiez-le si besoin, puis validez : la vidéo se fabrique ensuite." };
  // Équipe éteinte : plus d'écrivain hors équipe (T-EXT-55). L'idée attend un script collé, sans rien dépenser.
  return { statut: "pause", etat, code: "TO_SCRIPT_NON_ECRIT", message: "L'écriture depuis une idée n'est pas encore ouverte : collez votre script. Rien n'a échoué." };
}

/**
 * T-EXT-55 · Le prochain pas de l'étape script PAIERA-t-il un appel de rôle ? Lecture seule, 0 €, jamais un appel.
 * Sert à la garde du devis : le « +1 appel à venir » ne se compte que si le pas suivant paie vraiment (un pas sans IA, la lecture
 * d'une sortie déjà payée ou une pause ne dépensent rien). Doute (lecture en échec) : oui, c'est le sens prudent.
 */
export async function prochainPasPaye(etat: EtatTutoriel, commande: CommandeFabrication, outils: OutilsTutoriel): Promise<boolean> {
  const port = outils.equipe;
  if (!port) return true;
  try {
    const entrees = lireEntreesTutoriel(commande.entrees);
    const equipe: EtatEquipe = etat.equipe ?? { demande: demandeEquipe(commande, entrees), payes: {} };
    let dossier: DossierLu | null = null;
    if (entrees.depot?.mode === "dossier") {
      try {
        dossier = await port.lireDossier();
      } catch {
        return true; // lecture en échec : le pas réel peut la réussir et payer un rôle, donc on réserve (sens prudent)
      }
      if (dossier === null) return true; // idem : lecture sans résultat
    }
    const pas = prochainPas(equipe, { dossier }, { phraseOuverte: port.phraseOuverte === true });
    if (!("faire" in pas) || !pas.payant) return false;
    return dejaPaye(equipe.payes, `Tutoriel · ${pas.faire}`, pas.empreinteEntree) === null;
  } catch {
    return true;
  }
}

const ROLES_LIBELLE: Partial<Record<IdRole, string>> = { "chef-de-projet": "le chef de projet", analyste: "l'analyste", maquettiste: "le maquettiste", stratege: "le stratège de valeur", scenariste: "le scénariste" };

/** Note l'état d'un rôle au journal (jamais ses sorties). */
const noter = (etat: EtatTutoriel, role: IdRole, e: LigneJournal["etat"], le: string, resume?: string): EtatTutoriel => noterRole(etat, { role, etat: e, le, ...(resume ? { resume } : {}) });

/**
 * T-EXT-55 · UN rôle par pas : jamais deux appels payants dans le même pas (une panne au second ferait repayer le premier).
 * Un rôle payant passe par `payerUneFois` (même entrée = jamais repayé) ; le pas qui paie rend son état tout de suite, le
 * traitement de la sortie se fait au pas suivant (règle de T-EXT-45a). Le texte de Williams n'est jamais repassé par un rôle.
 */
async function pasEquipe(etat: EtatTutoriel, commande: CommandeFabrication, port: PortEquipe, entrees: ReturnType<typeof lireEntreesTutoriel>): Promise<PasTutoriel> {
  const le = port.maintenant?.() ?? new Date().toISOString();
  const equipe: EtatEquipe = etat.equipe ?? { demande: demandeEquipe(commande, entrees), payes: {} };
  let dossier: DossierLu | null = null;
  if (entrees.depot?.mode === "dossier") {
    try {
      dossier = await port.lireDossier();
    } catch {
      dossier = null;
    }
    // Lecture ratée : pause reprenable, SANS rien écrire dans etat.equipe (sinon un classement « phrase seule » resterait pour toujours).
    if (dossier === null) return { statut: "pause", etat, code: "TO_DOSSIER_INCOMPLET", message: "Votre dossier n'a pas pu être lu pour l'instant : la vidéo reprend dès qu'il est lisible. Rien n'a échoué." };
  }
  const lecture = { dossier };
  const pas = prochainPas(equipe, lecture, { phraseOuverte: port.phraseOuverte === true });
  if ("fini" in pas) return { statut: "faite", etat };
  if ("pause" in pas) {
    let suite: EtatTutoriel = { ...etat, equipe: pas.etat ?? equipe };
    if (pas.pause.code === "TO_SCRIPT_A_VALIDER" && suite.roles?.findLast((l) => l.role === "scenariste")?.etat !== "attend-williams") suite = noter(suite, "scenariste", "attend-williams", le, "Deux versions attendent votre choix.");
    return { statut: "pause", etat: suite, code: pas.pause.code, message: pas.pause.message };
  }
  if (!pas.payant) return { statut: "en-cours", etat: noter({ ...etat, equipe: pas.etat }, pas.faire, "fait", le, pas.resume) };

  const etape = `Tutoriel · ${pas.faire}`;
  const gardee = dejaPaye(equipe.payes, etape, pas.empreinteEntree);
  if (gardee === null) {
    let paye: Awaited<ReturnType<typeof payerUneFois<unknown>>>;
    try {
      paye = await payerUneFois<unknown>(equipe.payes, etape, pas.empreinteEntree, () => port.appelerRole(pas.faire, pas.entree), le);
    } catch {
      // Appel refusé ou en panne : rien n'est compté ; « Réessayer » reprend ce rôle, les rôles déjà faits ne sont pas rappelés.
      throw new ErreurTutoriel("TO_EQUIPE_PANNE", `Une étape de préparation (${ROLES_LIBELLE[pas.faire] ?? "un rôle de l'équipe"}) s'est arrêtée : « Réessayer » la reprend, sans refaire ce qui est fait.`, true);
    }
    // Le résultat payé est rangé tout de suite ; sa lecture se fait au pas suivant.
    const rendu = avecAppelRole({ ...etat, equipe: { ...equipe, payes: paye.registre } }, pas.faire);
    return { statut: "en-cours", etat: noter(rendu, pas.faire, "en-cours", le) };
  }
  const a = await appliquerSortie(equipe, pas.faire, gardee, lecture);
  if (!a.ok) {
    const suite: EtatTutoriel = { ...etat, equipe: a.etat };
    if (a.bloquee) return { statut: "pause", etat: noter(suite, pas.faire, "a-revoir", le), code: "TO_EQUIPE_BLOQUEE", message: "Une étape de préparation n'a pas abouti : réessayez ou collez votre script." };
    return { statut: "en-cours", etat: noter(suite, pas.faire, "a-revoir", le, "Relecture : la réponse est refaite avec les remarques.") };
  }
  let suite: EtatTutoriel = noter({ ...etat, equipe: a.etat }, pas.faire, "fait", le, a.resume);
  // Tronc commun (SC), facultatif : il commente les versions écrites, jamais ne les réécrit.
  if (pas.faire === "scenariste" && port.tronc?.evaluer && a.etat.propositionScripts) {
    try {
      const versions = a.etat.propositionScripts.versions.map((v) => ({ id: v.id, texte: v.phrases.map((p) => p.texte).join(" ") }));
      const remarques = (await port.tronc.evaluer(versions)).filter((m) => typeof m === "string" && m.trim());
      if (remarques.length) suite = { ...suite, equipe: { ...a.etat, remarquesTronc: remarques } };
    } catch {
      // Le tronc ne bloque jamais.
    }
  }
  return { statut: "en-cours", etat: suite };
}

/**
 * T-EXT-55 · Après le calage (équipe allumée seulement) : le contrôleur relit les durées réelles (sans IA ; ses remarques
 * deviennent des réserves, jamais un échec), puis la vidéo attend le film de navigation, fait sur le poste de capture.
 */
function pasApresCalage(pas: PasTutoriel, commande: CommandeFabrication, outils: Pick<OutilsTutoriel, "fin">): PasTutoriel {
  const equipe = pas.etat.equipe;
  // Décision sur l'ÉTAT de la vidéo, jamais sur le port : le port est recréé à chaque pas et peut manquer un tour (réglage lu en échec).
  if (!equipe?.parcours || pas.statut !== "faite") return pas;
  let etat = pas.etat;
  const nav = lireEntreesTutoriel(commande.entrees).navigationFilmee;
  if (!equipe.verdictCalage && etat.audio && etat.script) {
    const cal = calerScenario(equipe.parcours.scenario, etat.audio.mots, Math.round(etat.audio.dureeSec * 1000));
    const phrases = equipe.scriptChoisi?.phrases ?? [{ texte: etat.script.texte, aRevoir: false }];
    const verdict = controlerApresCalage({ script: { phrases }, parcours: equipe.parcours, etapes: cal.ok ? cal.etapes : [], dureeVoixMs: Math.round(etat.audio.dureeSec * 1000), dureeFinMs: finRetenue(etat, commande, outils).finMs, ...(nav ? { navigation: nav } : {}) });
    const reserves = verdict.controles.filter((c) => c.etat === "echoue").flatMap((c) => c.details.map((d) => `À vérifier · ${d}`));
    etat = { ...etat, equipe: { ...equipe, verdictCalage: verdict }, reserves: [...etat.reserves, ...reserves.filter((m) => !etat.reserves.includes(m))] };
  }
  if (!nav) return { statut: "pause", etat, code: "TO_FILM_A_CAPTURER", message: "Le film de navigation se fabrique sur le poste de capture : déposez-le, la vidéo reprend. Rien n'a échoué." };
  return { statut: "faite", etat };
}

function audioDe(a: AudioMaitre): AudioTutoriel {
  return { fichierCle: a.fichierCle, dureeSec: a.dureeSec, mots: a.mots, empreinte: a.empreinte, reutilise: a.reutilise, coutCentimes: a.coutCentimes, caracteres: a.caracteres, fournisseur: a.fournisseur, ...(a.sousTitresApproximatifs ? { approximatif: true } : {}) };
}

/** Outils complets de la sous-machine voix : texte lu, empreinte, voix épinglée contrôlée avant la lecture payante. */
export function outilsVoixMaitre(o: OutilsVoixTutoriel, commande: CommandeFabrication, texte: string, existant?: AudioTutoriel): OutilsVoixMaitre {
  const empreinte = empreinteAudioMaitre({ ...commande, script: { ...commande.script, texteComplet: texte } });
  return {
    ...o,
    idBase: `to-${commande.videoId}`,
    texte: () => texteLu(texte, commande.prononciations),
    empreinte: () => empreinte,
    ...(existant?.fichierCle ? { existant: { fichierCle: existant.fichierCle, empreinte: existant.empreinte, mots: existant.mots, dureeSec: existant.dureeSec } } : {}),
    avantLecture: async () => {
      // Voix HeyGen épinglée, rien d'autre (L1-05) : refus avant toute dépense.
      exigerVoixMaitre(o.fournisseurVoix ?? "heygen", o.idVoix);
      await o.avantLecture?.({ caracteres: texteLu(texte, commande.prononciations).length, lecturesMax: lecturesVoixMax(o.ressemblance) });
    },
  };
}

async function pasVoix(etat: EtatTutoriel, commande: CommandeFabrication, outils: OutilsTutoriel): Promise<PasTutoriel> {
  if (etat.audio) return { statut: "faite", etat };
  const texte = etat.script!.texte;
  // T-EXT-SV : mode « sans voix » choisi = silence total, rythme = vitesse de lecture du texte, 0 appel de voix, 0 €, aucune réserve.
  const sansVoix = estSansVoix(commande.entrees);
  if (sansVoix || !outils.voix || !commande.distribution.length) {
    const mots = horodaterTexte(texte, MOTS_PAR_SECONDE);
    const audio: AudioTutoriel = { dureeSec: mots.at(-1)?.finSec ?? 1, mots, empreinte: "sans-voix", reutilise: false, coutCentimes: 0, caracteres: 0, fournisseur: "aucune" };
    const reserves = !sansVoix && commande.distribution.length ? [...etat.reserves, "À vérifier · Voix : aucune voix n'est reliée, la vidéo sort muette."] : etat.reserves;
    return { statut: "faite", etat: { ...etat, audio, reserves } };
  }
  // Seule la voix HeyGen épinglée parle : refus clair avant tout appel (aucune dépense).
  if (outils.voix.idVoix !== VOIX_MAITRE_HEYGEN_ID) exigerVoixMaitre(outils.voix.fournisseurVoix ?? "heygen", outils.voix.idVoix);
  const o = outilsVoixMaitre(outils.voix, commande, texte, etat.parent?.audio);
  const suivant = await avancerVoixMaitre(etat.voix ?? { phase: "a-lire" }, o);
  if (suivant.phase !== "faite") return { statut: "en-cours", etat: { ...etat, voix: suivant } };
  const audio = audioDe(suivant.audio);
  const reserves = audio.approximatif ? [...etat.reserves, "À vérifier · Sous-titres : les mots suivent une estimation du son."] : etat.reserves;
  return { statut: "faite", etat: { ...etat, voix: undefined, audio, reserves } };
}

function pasCalage(etat: EtatTutoriel, commande: CommandeFabrication, outils: OutilsTutoriel): PasTutoriel {
  if (etat.sousTitres && etat.motsPlan) return { statut: "faite", etat };
  const audio = etat.audio!;
  const st = outils.sousTitres;
  const sousTitres = fabriquerSousTitres({
    texte: etat.script!.texte,
    dureeSec: audio.dureeSec,
    mots: audio.mots,
    prononciations: commande.prononciations,
    ratio: etat.ratios[0],
    ...(st?.style !== undefined ? { style: st.style } : {}),
    ...(st?.base ? { base: st.base } : {}),
    ...(st?.intensite ? { intensite: st.intensite } : {}),
  });
  const motsPlan: MotMinute[] = sousTitres.flatMap((s) => s.mots).map((m) => ({ texte: m.mot, debutMs: Math.round(m.debutSec * 1000), finMs: Math.max(Math.round(m.debutSec * 1000), Math.round(m.finSec * 1000)) }));
  return { statut: "faite", etat: { ...etat, sousTitres, motsPlan } };
}

/** Texte des mots couverts par une scène (sert à retrouver la même scène d'une version à l'autre). */
function motsDeScene(s: Pick<SceneValide, "mots">, mots: readonly MotMinute[]): string {
  return mots
    .slice(s.mots.premier, s.mots.dernier + 1)
    .map((m) => m.texte.toLowerCase())
    .join(" ");
}

/** Garde le contenu des scènes d'avant dont les mots n'ont pas changé (nouveau minutage), puis revalide. */
function fusionnerAvecParent(nouveau: PlanValide, parent: PlanValide): PlanValide {
  const avant = new Map(parent.scenes.map((s) => [motsDeScene(s, parent.mots), s]));
  const scenes = nouveau.scenes.map((s) => {
    const p = avant.get(motsDeScene(s, nouveau.mots));
    if (!p) return s;
    const { empreinte: _e, ...contenu } = p;
    void _e;
    return { ...contenu, id: s.id, version: p.version, mots: s.mots, debutMs: s.debutMs, finMs: s.finMs };
  });
  return validerPlan({ ...nouveau, scenes }, { mots: nouveau.mots, format: nouveau.format, facecam: false, dureeMs: nouveau.dureeMs }).plan;
}

const secondes = (ms: number) => (ms / 1000).toFixed(1).replace(".", ",");

/** Réserves du film de navigation (T-EXT-38) : jamais un échec ; le refus des 1,5 s est la décision de T-EXT-23. */
function reservesNavigation(plan: PlanValide, nav: NavigationFilmee): string[] {
  const r: string[] = [];
  const plages = plagesFixesSortie(nav);
  if (plages === null) r.push("À vérifier · Navigation : immobilité non mesurée");
  else for (const p of plages) r.push(`À vérifier · Navigation : écran immobile de ${secondes(p.debutMs)} s à ${secondes(p.finMs)} s`);
  if (planCacheLeFilm(plan, nav).length) r.push("À vérifier · Navigation : une scène plein écran cache le film");
  if (nav.dureeVoixMs < plan.dureeMs - 200) r.push("À vérifier · Navigation : film plus court que la voix");
  return r;
}

async function pasPlan(etat: EtatTutoriel, commande: CommandeFabrication, outils: OutilsTutoriel): Promise<PasTutoriel> {
  if (etat.plan) return { statut: "faite", etat };
  const pas = await pasPlanSansFilm(etat, commande, outils);
  const nav = lireEntreesTutoriel(commande.entrees).navigationFilmee;
  if (!nav || !pas.etat.plan) return pas;
  const nouvelles = reservesNavigation(pas.etat.plan.plan, nav).filter((m) => !pas.etat.reserves.includes(m));
  return nouvelles.length ? { ...pas, etat: { ...pas.etat, reserves: [...pas.etat.reserves, ...nouvelles] } } : pas;
}

async function pasPlanSansFilm(etat: EtatTutoriel, commande: CommandeFabrication, outils: OutilsTutoriel): Promise<PasTutoriel> {
  const texte = etat.script!.texte;
  const mots = etat.motsPlan!;
  const format = formatDuRatio(etat.ratios[0] as "4:5");
  const empreinteEntree = fnv1a64(jsonCanonique({ texte, mots, format }));
  // X3-06 : cran du dosage figé dans la commande. Absent (dosage éteint) = chemin d'avant, inchangé.
  const cran = commande.dosageMotion?.cran;
  if (cran === "aucun") {
    // Plan nu : l'écran seul, aucune pièce, aucun calque ; `genererPlan` n'est pas appelé (0 appel Claude).
    const nu = planNu({ mots, format, facecam: false, dureeMs: mots.at(-1)?.finMs ?? 0 });
    return { statut: "faite", etat: { ...etat, plan: { plan: nu, remarques: [], source: "repli", empreinteEntree, scenesTouchees: nu.scenes.map((s) => s.id) } } };
  }
  const suite = await pasPlanClassique(etat, outils, { texte, mots, format, empreinteEntree, faitLe: commande.construiteLe });
  if (cran !== "sobre" || !suite.etat.plan) return suite;
  const plan = suite.etat.plan;
  const niveau1 = planNiveau1(plan.plan);
  return { ...suite, etat: { ...suite.etat, plan: { ...plan, plan: niveau1, scenesTouchees: plan.scenesTouchees.filter((id) => niveau1.scenes.some((s) => s.id === id)) } } };
}

async function pasPlanClassique(etat: EtatTutoriel, outils: OutilsTutoriel, e: { texte: string; mots: MotMinute[]; format: ReturnType<typeof formatDuRatio>; empreinteEntree: string; faitLe: string }): Promise<PasTutoriel> {
  const { texte, mots, format, empreinteEntree } = e;
  const parent = etat.parent?.plan;
  // Retouche sans changement de texte ni de minutage : le plan d'avant, tel quel, sans appel.
  if (parent && fnv1a64(jsonCanonique({ texte, mots: parent.mots, format: parent.format })) === empreinteEntree) {
    return { statut: "faite", etat: { ...etat, plan: { plan: parent, remarques: [], source: "repris", empreinteEntree, scenesTouchees: [] } } };
  }
  const n = { v: 0 };
  const payee = await payerUneFois(etat.payes, "plan", empreinteEntree, () => genererPlan({ script: texte, mots, format, facecam: false }, compterAppels(outils.claude, n)), e.faitLe);
  const r = payee.resultat;
  etat = avecAppels(avecPayes(etat, payee.registre, n.v > 0), "plan", n.v);
  const plan = parent ? fusionnerAvecParent(r.plan, parent) : r.plan;
  const scenesTouchees = parent ? scenesARerendre(parent, plan) : plan.scenes.map((s) => s.id);
  const reserves = r.source === "repli" ? [...etat.reserves, `À vérifier · Plan de scènes : ${r.remarques[0]?.message ?? "plan simple."}`] : etat.reserves;
  return { statut: "faite", etat: { ...etat, plan: { plan, remarques: r.remarques, source: r.source, empreinteEntree, scenesTouchees }, reserves } };
}

/** Le plan au format d'un ratio (positions en %, revalidé : empreintes du format). */
export function planPourRatio(plan: PlanValide, ratio: Ratio): PlanValide {
  const format = formatDuRatio(ratio);
  if (format.largeur === plan.format.largeur && format.hauteur === plan.format.hauteur) return plan;
  return validerPlan({ ...plan, format }, { mots: plan.mots, format, facecam: false, dureeMs: plan.dureeMs }).plan;
}

/** T-EXT-26a : la fin retenue (état d'abord : une fois choisie, elle ne change plus ; puis celle du parent ; puis l'entrée et l'interrupteur). */
function finRetenue(etat: EtatTutoriel, commande: Pick<CommandeFabrication, "entrees">, outils: Pick<OutilsTutoriel, "fin">): FinDuTutoriel {
  return etat.fin ?? etat.parent?.fin ?? finDuTutoriel(lireEntreesTutoriel(commande.entrees).fin, outils.fin?.actif === true);
}

/** Propriétés de la composition pour un ratio (l'adresse de la voix arrive par l'entrée « audio »). */
export function proprietesTutoriel(etat: EtatTutoriel, ratio: Ratio, avecSousTitres: boolean, outils: Pick<OutilsTutoriel, "sousTitres" | "fin">, navigation?: NavigationFilmee, commande?: Pick<CommandeFabrication, "entrees">): Omit<ProprietesTutorielOutil, "audio" | "filmNavigation"> {
  const st = outils.sousTitres;
  const sousTitres =
    avecSousTitres && etat.sousTitres?.length ? donneesCalque({ segments: etat.sousTitres, base: baseRetenue(st?.base, st?.style ?? null), ratio, ...(st?.style ? { style: st.style } : {}) }) : undefined;
  const laFin = commande ? finRetenue(etat, commande, outils) : (etat.fin ?? etat.parent?.fin ?? finDuTutoriel(undefined, outils.fin?.actif === true));
  const { videoCle: _cle, ...sansFilm } = navigation ?? ({} as NavigationFilmee);
  void _cle;
  // T-EXT-44 : la caméra garde la zone visée au-dessus de la bande des sous-titres (lue dans les sous-titres déjà calculés).
  const haut = sousTitres ? hautBandeSousTitresPct(sousTitres.positions.basPct) : undefined;
  const navigationFinale = navigation ? { ...sansFilm, ...(haut !== undefined ? { hautSousTitresPct: haut } : {}), ...(etat.reglagesFilm !== undefined ? { reglagesFilm: etat.reglagesFilm } : {}) } : undefined;
  return { plan: planPourRatio(etat.plan!.plan, ratio), ...(sousTitres ? { sousTitres } : {}), ...(laFin.fin ? { fin: { ...laFin.fin } } : {}), finMs: laFin.finMs, ...(navigationFinale ? { navigation: navigationFinale } : {}), ...(etat.reglagesFilm !== undefined ? { reglagesFilm: etat.reglagesFilm } : {}) };
}

const nomRatio = (r: Ratio) => r.replace(":", "x");

async function demandeRendu(etat: EtatTutoriel, ratio: Ratio, essai: number, commande: CommandeFabrication, outils: OutilsTutoriel, travailId: string, serie?: number): Promise<DemandeRendu> {
  const cle = outils.rendu.cle(`tutoriel-${nomRatio(ratio)}.mp4`);
  // Voix mixée (T-EXT-31) quand elle existe, sinon la voix brute, comme avant.
  const voix = etat.sonMixe?.fini && !etat.sonMixe.echec ? etat.sonMixe.fichierCle : etat.audio?.fichierCle;
  // T-EXT-52b : la navigation retenue (film d'avant gardé quand le film change) ; absente, celle des entrées.
  const nav = etat.navigationFilm ?? lireEntreesTutoriel(commande.entrees).navigationFilmee;
  // Le film de navigation (T-EXT-38) arrive par l'entrée « filmNavigation » (jamais « navigation » : elle écraserait l'objet).
  const lectures: Record<string, string> = { ...(voix ? { audio: voix } : {}), ...(nav ? { filmNavigation: nav.videoCle } : {}) };
  const signe = await outils.rendu.signer(lectures, { cle, mime: "video/mp4" });
  return {
    idRendu: serie ? `${travailId}-${nomRatio(ratio)}-r${serie}-${essai}` : `${travailId}-${nomRatio(ratio)}-${essai}`,
    operation: "composition",
    file: "longue",
    entrees: signe.lectures,
    sortie: { urlDepot: signe.urlDepot, cle },
    parametres: { composition: COMPOSITION_TUTORIEL, proprietes: proprietesTutoriel(etat, ratio, commande.briques["sous-titres"] !== false, outils, nav && commande.dosageMotion?.cran ? { ...nav, cran: commande.dosageMotion.cran } : nav, commande) },
  };
}

/**
 * T-EXT-52c : retouche par plages. Réglage allumé, finitions éteintes et SEUL le plan a changé (voix, effets du film et fin
 * identiques à la version d'avant : preuve par l'empreinte du format d'avant recalculée avec le nouveau reste) : les plages d'images
 * des scènes touchées. Sinon (ou « entier » / « aucun ») : `undefined`, le rendu est celui d'aujourd'hui.
 * Les images clés du fichier d'avant ne sont pas connues ici (le rendu du tutoriel ne les fixe pas) : `imagesCle` n'est pas passé,
 * et l'opération de recollage refuse toute borne qui n'est pas une image clé (alors : rendu entier, voir `pasRenduRecollage`).
 */
function choixPlages(etat: EtatTutoriel, ratio: Ratio, commande: CommandeFabrication, outils: OutilsTutoriel): { plages: PlageImages[]; avant: string; voix: string; total: number } | undefined {
  const p = etat.parent;
  const plan = etat.plan?.plan;
  const sortieAvant = p?.rendus?.[ratio];
  const voixAvant = p?.audio?.fichierCle;
  if (outils.retouchePartielle !== true || outils.finitions?.actif || !p?.plan || !plan || !sortieAvant || !voixAvant || !p.empreintesFormats?.[ratio]) return undefined;
  if (!etat.audio || etat.audio.fichierCle !== voixAvant || !p.audio?.empreinte || p.audio.empreinte !== etat.audio.empreinte) return undefined;
  if (p.plan.dureeMs !== plan.dureeMs) return undefined;
  if (empreinteDuFormat({ ...etat, plan: { ...etat.plan!, plan: p.plan } }, ratio, commande, outils) !== p.empreintesFormats[ratio]) return undefined;
  const avant = planPourRatio(p.plan, ratio);
  const apres = planPourRatio(plan, ratio);
  const memesScenes = avant.scenes.length === apres.scenes.length && avant.scenes.every((s, i) => s.id === apres.scenes[i]!.id && s.debutMs === apres.scenes[i]!.debutMs && s.finMs === apres.scenes[i]!.finMs);
  if (!memesScenes) return undefined;
  const total = dureeImagesTutoriel({ plan: apres, finMs: finRetenue(etat, commande, outils).finMs });
  if (Math.abs(sortieAvant.dureeSec * apres.format.fps - total) > 1) return undefined;
  const r = plagesARerendre(apres, scenesARerendre(avant, apres), { fps: 25, dureeTotaleImages: total, transitionMaxMs: TRANSITION_MAX_MS });
  return r.mode === "plages" ? { plages: r.plages, avant: sortieAvant.fichierCle, voix: voixAvant, total } : undefined;
}

/** Une demande `composition` en `mode: "plage"`, MUETTE (aucune entrée « audio »), mêmes propriétés complètes que le rendu d'origine. */
async function demandePlage(etat: EtatTutoriel, ratio: Ratio, i: number, plage: PlageImages, commande: CommandeFabrication, outils: OutilsTutoriel, travailId: string): Promise<DemandeRendu> {
  const cle = outils.rendu.cle(`tutoriel-${nomRatio(ratio)}-plage${i}.mp4`);
  const nav = etat.navigationFilm ?? lireEntreesTutoriel(commande.entrees).navigationFilmee;
  const signe = await outils.rendu.signer(nav ? { filmNavigation: nav.videoCle } : {}, { cle, mime: "video/mp4" });
  return {
    idRendu: `${travailId}-${nomRatio(ratio)}-plage${i}-0`,
    operation: "composition",
    file: "longue",
    entrees: signe.lectures,
    sortie: { urlDepot: signe.urlDepot, cle },
    parametres: {
      composition: COMPOSITION_TUTORIEL,
      proprietes: proprietesTutoriel(etat, ratio, commande.briques["sous-titres"] !== false, outils, nav && commande.dosageMotion?.cran ? { ...nav, cran: commande.dosageMotion.cran } : nav, commande),
      mode: "plage",
      debut: plage.debut,
      fin: plage.fin,
      recollable: true,
    },
  };
}

/** La demande `recollage-plages` : fichier d'avant + morceaux muets + VOIX D'AVANT. `avecAdresses` faux : forme seulement (adresses signées au moment d'envoyer). */
async function demandeRecollage(etat: EtatTutoriel, ratio: Ratio, ch: NonNullable<ReturnType<typeof choixPlages>>, outils: OutilsTutoriel, travailId: string, avecAdresses: boolean): Promise<DemandeRendu> {
  const cle = outils.rendu.cle(`tutoriel-${nomRatio(ratio)}.mp4`);
  const parametres = demandesRecollage(planRecollage({ plages: ch.plages, dureeTotaleImages: ch.total, fichierAvant: ch.avant, voixAvant: ch.voix }), { fps: 25, dureeTotaleImages: ch.total });
  const lectures: Record<string, string> = { [ENTREE_AVANT]: ch.avant, [ENTREE_VOIX]: ch.voix, ...Object.fromEntries(ch.plages.map((_, i) => [entreePlage(i), outils.rendu.cle(`tutoriel-${nomRatio(ratio)}-plage${i}.mp4`)])) };
  const signe = avecAdresses ? await outils.rendu.signer(lectures, { cle, mime: "video/mp4" }) : { lectures: {}, urlDepot: "" };
  void etat;
  return { idRendu: `${travailId}-${nomRatio(ratio)}-recollage-0`, operation: "recollage-plages", file: "longue", entrees: signe.lectures, sortie: { urlDepot: signe.urlDepot, cle }, parametres: { ...parametres } };
}

/** Le suivi d'un format rendu par plages : plages muettes, puis recollage. Tout refus ou échec : rendu entier comme aujourd'hui (+ réserve). */
async function pasRenduRecollage(etat: EtatTutoriel, ratio: Ratio, courant: RenduTutoriel, commande: CommandeFabrication, outils: OutilsTutoriel, travailId: string): Promise<EtatTutoriel> {
  const service = outils.rendu.service();
  const remplacer = (r: RenduTutoriel): EtatTutoriel => ({ ...etat, rendus: [...etat.rendus.filter((x) => x.ratio !== ratio), r] });
  // T-EXT-45b : le rendu entier de repli est inscrit dans l'état AVANT d'être envoyé (`aEnvoyer`, le pas suivant le soumet), sous la série de « Réessayer ».
  const entier = async (): Promise<EtatTutoriel> => {
    const demande = await demandeRendu(etat, ratio, 0, commande, outils, travailId, courant.serie);
    const reserve = `Le format ${ratio} a été refait en entier (le rendu par morceaux n'a pas pu servir).`;
    return { ...remplacer({ ratio, demande, essai: 0, ...(courant.serie ? { serie: courant.serie } : {}), aEnvoyer: true }), reserves: etat.reserves.includes(reserve) ? etat.reserves : [...etat.reserves, reserve] };
  };
  const ch = choixPlages(etat, ratio, commande, outils);
  if (!ch) return entier();
  // « Réessayer » (`aSoumettre`) : on suit TOUJOURS les plages / le recollage d'avant ; le rendu entier n'est soumis que s'ils sont en échec.
  const { aSoumettre: _s, attentesReseau: _r, ...sansReprise } = courant;
  void _s;
  void _r;
  if (courant.aEnvoyer) {
    const demandes = await Promise.all(ch.plages.map((p, i) => demandePlage(etat, ratio, i, p, commande, outils, travailId)));
    const lus = await Promise.all(demandes.map((d) => suivreSansEchec(service, d)));
    const panneLue = lus.find((l) => l.panne)?.panne;
    // Coupure réseau pendant le suivi : on relit au pas suivant (jamais un rendu de repli ni un nouvel identifiant).
    if (panneLue) return remplacer({ ...courant, attentesReseau: attenteSuivante(courant.attentesReseau, panneLue) });
    const suivis = lus.map((l) => l.e!);
    if (suivis.some((e) => e.statut === "echec")) return entier();
    if (suivis.some((e) => e.statut !== "termine")) return courant.aSoumettre ? remplacer(sansReprise) : remplacer({ ...sansAttente(courant) });
    const demande = await demandeRecollage(etat, ratio, ch, outils, travailId, true);
    await service.soumettre(demande);
    const { aEnvoyer: _e, ...envoye } = sansReprise;
    void _e;
    return remplacer({ ...envoye, demande });
  }
  const lu = await suivreSansEchec(service, courant.demande);
  if (lu.panne) return remplacer({ ...courant, attentesReseau: attenteSuivante(courant.attentesReseau, lu.panne) });
  const e = lu.e!;
  if (e.statut === "echec") return entier();
  if (e.statut !== "termine") return courant.aSoumettre ? remplacer(sansReprise) : remplacer(sansAttente(courant));
  const dureeSec = typeof e.mesures?.dureeSec === "number" ? e.mesures.dureeSec : ch.total / 25;
  // La demande gardée prend la forme d'un rendu entier (jamais soumise) : le regard et les dimensions du résultat la lisent.
  const forme = await demandeRendu(etat, ratio, 0, commande, outils, travailId);
  return remplacer({ ratio, demande: forme, essai: 0, sortie: { fichierCle: e.sortieCle, dureeSec, taille: typeof e.mesures?.taille === "number" ? e.mesures.taille : 0 } });
}

/** Un pas de rendu d'un ratio : soumettre, suivre, ressoumettre après un échec passager. */
async function pasRendu(etat: EtatTutoriel, ratio: Ratio, commande: CommandeFabrication, outils: OutilsTutoriel, travailId: string): Promise<EtatTutoriel> {
  const service = outils.rendu.service();
  // T-EXT-26a : la fin est fixée une fois pour toutes au premier rendu et gardée dans l'état.
  if (!etat.fin) etat = { ...etat, fin: finRetenue(etat, commande, outils) };
  const courant = etat.rendus.find((r) => r.ratio === ratio);
  const remplacer = (r: RenduTutoriel) => ({ ...etat, rendus: [...etat.rendus.filter((x) => x.ratio !== ratio), r] });
  if (!courant) {
    // T-EXT-52c : seules les scènes touchées sont rendues (muettes), puis recollées dans le fichier d'avant. Éteint : jamais ici.
    const ch = choixPlages(etat, ratio, commande, outils);
    if (ch) {
      const plages = await Promise.all(ch.plages.map((p, i) => demandePlage(etat, ratio, i, p, commande, outils, travailId)));
      for (const d of plages) await service.soumettre(d);
      return remplacer({ ratio, demande: await demandeRecollage(etat, ratio, ch, outils, travailId, false), essai: 0, aEnvoyer: true });
    }
    const demande = await demandeRendu(etat, ratio, 0, commande, outils, travailId);
    await service.soumettre(demande);
    return remplacer({ ratio, demande, essai: 0 });
  }
  if (courant.sortie) return etat;
  if (courant.demande?.operation === "recollage-plages") return pasRenduRecollage(etat, ratio, courant, commande, outils, travailId);
  // T-EXT-45b : une demande inscrite mais pas encore soumise est soumise telle quelle (même identifiant), AVANT tout calcul de série neuve.
  // Si `soumettre` lève après acceptation (réponse perdue), l'état gardé porte cette demande : le « Réessayer » suivant la ressoumet sous le même identifiant.
  if (courant.aEnvoyer) {
    await service.soumettre(courant.demande);
    const { aEnvoyer: _e, aSoumettre: _s, ...envoye } = courant;
    void _e;
    void _s;
    return remplacer(envoye);
  }
  const serie = courant.serie ? { serie: courant.serie } : {};
  // T-EXT-45b : « Réessayer » a pu remettre à zéro un rendu qui tourne encore (ou est déjà fini) chez `studio-rendu` : on suit TOUJOURS
  // l'ancienne demande avant d'en soumettre une neuve. Une demande neuve (identifiant neuf) n'est soumise que si l'ancienne est en échec.
  const lu = courant.demande ? await suivreSansEchec(service, courant.demande) : undefined;
  // Coupure réseau pendant le suivi d'une demande déjà soumise : l'état est rendu tel quel, on relira au pas suivant (borne : `ATTENTES_RESEAU_MAX`).
  if (lu?.panne) return remplacer({ ...courant, attentesReseau: attenteSuivante(courant.attentesReseau, lu.panne) });
  if (courant.attentesReseau) etat = remplacer(sansAttente(courant));
  const e = lu?.e;
  if (courant.aSoumettre && (!e || e.statut === "echec")) {
    // La demande neuve est inscrite dans l'état AVANT d'être payée ; le pas suivant la soumet (verdict Opus c23c27a4).
    const demande = await demandeRendu(etat, ratio, courant.essai, commande, outils, travailId, courant.serie);
    return remplacer({ ratio, demande, essai: courant.essai, ...serie, aEnvoyer: true });
  }
  if (!e) return etat;
  if (e.statut === "echec") {
    const essai = courant.essai + 1;
    if (!e.erreur.reessayable || essai >= ESSAIS_RENDU_TUTORIEL) throw new ErreurRendu(e.erreur);
    const demande = await demandeRendu(etat, ratio, essai, commande, outils, travailId, courant.serie);
    return remplacer({ ratio, demande, essai, ...serie, aEnvoyer: true });
  }
  // L'ancienne demande est en file, en cours ou finie : on la garde (plus de « à soumettre »), rien n'est payé deux fois.
  const { aSoumettre: _a, attentesReseau: _b, ...suivi } = courant;
  void _a;
  void _b;
  if (e.statut !== "termine") return courant.aSoumettre ? remplacer(suivi) : etat;
  const dureeAttendue = (etat.plan!.plan.dureeMs + finRetenue(etat, commande, outils).finMs) / 1000;
  const dureeSec = typeof e.mesures?.dureeSec === "number" ? e.mesures.dureeSec : dureeAttendue;
  return remplacer({ ...suivi, sortie: { fichierCle: e.sortieCle, dureeSec, taille: typeof e.mesures?.taille === "number" ? e.mesures.taille : 0 } });
}

/** Le rendu sans son compte d'attente réseau (une lecture vient de réussir). */
function sansAttente(r: RenduTutoriel): RenduTutoriel {
  const { attentesReseau: _n, ...reste } = r;
  void _n;
  return reste;
}

type SuiteFinition<R> = { f: FinitionTutoriel<R>; fini: boolean };

/** Suit une finition : après un échec passager, une nouvelle demande (au plus `ESSAIS_RENDU_TUTORIEL`) ; sinon échec définitif, jamais une erreur. */
async function suivreFinition<R>(service: ServiceRendu, f: FinitionTutoriel<R>, refaire: (essai: number) => Promise<DemandeRendu>, lire: (e: Extract<Awaited<ReturnType<typeof suivreRendu>>, { statut: "termine" }>) => R | null): Promise<SuiteFinition<R>> {
  if (f.resultat !== undefined) return { f, fini: true };
  let lu: SuiviLu;
  try {
    lu = await suivreSansEchec(service, f.demande!);
  } catch {
    return { f: { ...f, resultat: "echec" }, fini: true };
  }
  if (lu.panne) {
    // Coupure réseau : on relit au pas suivant ; au-delà de la borne, l'échec définitif d'avant (la vidéo est livrée).
    if ((f.attentesReseau ?? 0) + 1 > ATTENTES_RESEAU_MAX) return { f: { ...f, resultat: "echec" }, fini: true };
    return { f: { ...f, attentesReseau: (f.attentesReseau ?? 0) + 1 }, fini: false };
  }
  const e = lu.e!;
  if (f.attentesReseau) {
    const { attentesReseau: _n, ...net } = f;
    void _n;
    f = net;
  }
  if (e.statut === "echec") {
    const essai = f.essai + 1;
    if (!e.erreur.reessayable || essai >= ESSAIS_RENDU_TUTORIEL) return { f: { ...f, resultat: "echec" }, fini: true };
    try {
      const demande = await refaire(essai);
      await service.soumettre(demande);
      return { f: { demande, essai }, fini: false };
    } catch {
      return { f: { ...f, resultat: "echec" }, fini: true };
    }
  }
  if (e.statut !== "termine") return { f, fini: false };
  return { f: { ...f, resultat: lire(e) ?? "echec" }, fini: true };
}

const nomFinition = (ratio: Ratio, ext: string) => `tutoriel-${nomRatio(ratio)}${ext}`;

async function demandeMesure(rendu: RenduTutoriel, essai: number, outils: OutilsTutoriel, travailId: string): Promise<DemandeRendu> {
  const cle = outils.rendu.cle(nomFinition(rendu.ratio, "-son.json"));
  const signe = await outils.rendu.signer({ media: rendu.sortie!.fichierCle }, { cle, mime: "application/json" });
  return { idRendu: `${travailId}-${nomRatio(rendu.ratio)}-son-${essai}`, operation: "mesure-son", file: "courte", entrees: signe.lectures, sortie: { urlDepot: signe.urlDepot, cle }, parametres: parametresMesure() };
}

async function demandeVignette(rendu: RenduTutoriel, essai: number, outils: OutilsTutoriel, travailId: string): Promise<DemandeRendu> {
  const cle = outils.rendu.cle(nomFinition(rendu.ratio, ".jpg"));
  const signe = await outils.rendu.signer({ video: rendu.sortie!.fichierCle }, { cle, mime: "image/jpeg" });
  return { idRendu: `${travailId}-${nomRatio(rendu.ratio)}-vignette-${essai}`, operation: "miniature", file: "courte", entrees: signe.lectures, sortie: { urlDepot: signe.urlDepot, cle }, parametres: parametresVignette(rendu.ratio, rendu.sortie!.dureeSec) };
}

/** Une finition est finie quand son résultat est là ou en échec définitif. */
const finitionsFinies = (r: RenduTutoriel | undefined): boolean => !!r?.sortie && r.mesure?.resultat !== undefined && r.vignette?.resultat !== undefined;

/** Un pas des finitions d'un ratio rendu : d'abord la mesure du son, puis la vignette. Jamais un échec de la vidéo. */
async function pasFinitions(etat: EtatTutoriel, ratio: Ratio, outils: OutilsTutoriel, travailId: string): Promise<EtatTutoriel> {
  const rendu = etat.rendus.find((r) => r.ratio === ratio)!;
  const service = outils.rendu.service();
  const remplacer = (r: RenduTutoriel): EtatTutoriel => ({ ...etat, rendus: etat.rendus.map((x) => (x.ratio === ratio ? r : x)) });
  try {
    if (rendu.mesure?.resultat === undefined) {
      if (!rendu.mesure) {
        const demande = await demandeMesure(rendu, 0, outils, travailId);
        await service.soumettre(demande);
        return remplacer({ ...rendu, mesure: { demande, essai: 0 } });
      }
      const s = await suivreFinition(service, rendu.mesure, (essai) => demandeMesure(rendu, essai, outils, travailId), (e) => lireMesure(e.mesures));
      return remplacer({ ...rendu, mesure: s.f });
    }
    if (rendu.vignette?.resultat === undefined) {
      if (!rendu.vignette) {
        const demande = await demandeVignette(rendu, 0, outils, travailId);
        await service.soumettre(demande);
        return remplacer({ ...rendu, vignette: { demande, essai: 0 } });
      }
      const s = await suivreFinition(service, rendu.vignette, (essai) => demandeVignette(rendu, essai, outils, travailId), (e) => ({ cle: e.sortieCle }));
      return remplacer({ ...rendu, vignette: s.f });
    }
  } catch {
    // Signature ou soumission impossible : réserve (rapport « non mesuré » / « vignette non produite »), la vidéo est livrée.
    return remplacer({ ...rendu, ...(rendu.mesure?.resultat === undefined ? { mesure: { ...(rendu.mesure ?? { essai: 0 }), resultat: "echec" as const } } : { vignette: { ...(rendu.vignette ?? { essai: 0 }), resultat: "echec" as const } }) });
  }
  return etat;
}

/** Un pas du mixage de la voix (une seule fois pour tous les formats). Rend l'état et `true` quand il est fini (réussi ou en échec). */
async function pasMixage(etat: EtatTutoriel, commande: CommandeFabrication, outils: OutilsTutoriel, travailId: string): Promise<{ etat: EtatTutoriel; fini: boolean }> {
  const voix = etat.audio?.fichierCle;
  if (!outils.finitions?.actif || !voix || commande.briques.son === false) return { etat, fini: true };
  if (etat.sonMixe?.fini) return { etat, fini: true };
  const service = outils.rendu.service();
  const demander = async (essai: number): Promise<DemandeRendu> => {
    const cle = outils.rendu.cle("tutoriel-voix-mixee.wav");
    const signe = await outils.rendu.signer({ voix }, { cle, mime: "audio/wav" });
    return { idRendu: `${travailId}-mixage-${essai}`, operation: "mixage", file: "longue", entrees: signe.lectures, sortie: { urlDepot: signe.urlDepot, cle }, parametres: parametresMixage(cibleSon(commande), etat.audio!.dureeSec) };
  };
  const abandon = (): { etat: EtatTutoriel; fini: boolean } => {
    const c = etat.sonMixe;
    const reserves = [...etat.reserves, "À vérifier · Son : la chaîne son n'a pas abouti, voix non traitée."];
    return { etat: { ...etat, reserves, sonMixe: { fichierCle: c?.fichierCle ?? voix, ...(c?.demande ? { demande: c.demande } : {}), essai: c?.essai ?? 0, fini: true, echec: true } }, fini: true };
  };
  try {
    let courant = etat.sonMixe;
    if (!courant) {
      const demande = await demander(0);
      await service.soumettre(demande);
      return { etat: { ...etat, sonMixe: { fichierCle: demande.sortie.cle, demande, essai: 0, fini: false } }, fini: false };
    }
    const lu = await suivreSansEchec(service, courant.demande!);
    // Coupure réseau : on relit au pas suivant ; au-delà de la borne, `attenteSuivante` lève et la voix brute est gardée (abandon, comme avant).
    if (lu.panne) return { etat: { ...etat, sonMixe: { ...courant, attentesReseau: attenteSuivante(courant.attentesReseau, lu.panne) } }, fini: false };
    const e = lu.e!;
    if (courant.attentesReseau) {
      const { attentesReseau: _n, ...net } = courant;
      void _n;
      courant = net;
      etat = { ...etat, sonMixe: courant };
    }
    if (e.statut === "echec") {
      const essai = courant.essai + 1;
      if (!e.erreur.reessayable || essai >= ESSAIS_RENDU_TUTORIEL) return abandon();
      const demande = await demander(essai);
      await service.soumettre(demande);
      return { etat: { ...etat, sonMixe: { ...courant, demande, essai } }, fini: false };
    }
    if (e.statut !== "termine") return { etat, fini: false };
    const lufs = lireMesure(e.mesures)?.lufs;
    return { etat: { ...etat, sonMixe: { ...courant, fichierCle: e.sortieCle, ...(lufs !== undefined ? { lufs } : {}), fini: true } }, fini: true };
  } catch {
    return abandon();
  }
}

/**
 * T-EXT-52b : le film de navigation de la version, avec son empreinte. // en attendant T-EXT-38 / 03b : l'empreinte du film
 * (scénario + calage + maquette + poste) n'est pas encore dans les entrées ; on prend ici ce qui fait le film SANS ses effets
 * (clé de la vidéo, maquette, taille, cibles, plages figées), jamais le cran, la bascule ni la bande des sous-titres.
 */
function filmDeNavigation(nav: NavigationFilmee): FilmTutoriel {
  const { cran: _c, basculeMs: _b, hautSousTitresPct: _h, ...sansEffets } = nav;
  void _c;
  void _b;
  void _h;
  return { videoCle: nav.videoCle, empreinte: fnv1a64(jsonCanonique(sansEffets)) };
}

/** T-EXT-52b : empreinte d'un format = plan du ratio + voix + effets du film + (carte de fin, sous-titres). Une seule fonction d'empreinte d'export (R4). */
function empreinteDuFormat(etat: EtatTutoriel, ratio: Ratio, commande: CommandeFabrication, outils: OutilsTutoriel): string {
  const nav = etat.navigationFilm ?? lireEntreesTutoriel(commande.entrees).navigationFilmee;
  // T-EXT-53c : les réglages du chat n'entrent PAS dans l'empreinte du format tant que le rendu les ignore (en attendant T-EXT-53a) : sinon une version réglée ferait refaire tous les formats pour un film identique.
  const effetsFilm = empreinteEffetsFilm({ ...(nav ? { reglagesFilm: { cran: nav.cran, basculeMs: nav.basculeMs }, film: filmDeNavigation(nav) } : {}), ...(commande.dosageMotion?.cran ? { cran: commande.dosageMotion.cran } : {}) });
  const laFin = finRetenue(etat, commande, outils);
  const fin = fnv1a64(jsonCanonique({ fin: laFin.fin ?? null, finMs: laFin.finMs, sousTitres: commande.briques["sous-titres"] !== false ? (etat.sousTitres ?? null) : null, style: outils.sousTitres ?? null }));
  return empreinteFormat(planPourRatio(etat.plan!.plan, ratio), ratio, { voix: etat.audio?.empreinte ?? "", effetsFilm, fin });
}

/** Demande de forme seulement (jamais soumise) : le rendu repris garde la résolution de son format dans le résultat. */
function demandeReprise(etat: EtatTutoriel, ratio: Ratio, sortie: SortieFormatTutoriel, travailId: string): DemandeRendu {
  return {
    idRendu: `${travailId}-${nomRatio(ratio)}-reprise`,
    operation: "composition",
    file: "longue",
    entrees: {},
    sortie: { urlDepot: "", cle: sortie.fichierCle },
    parametres: { composition: COMPOSITION_TUTORIEL, proprietes: { plan: planPourRatio(etat.plan!.plan, ratio) } },
  };
}

/**
 * T-EXT-52b : réglage allumé et plan connu : calcule l'empreinte du format et, si elle est celle de la version d'avant,
 * reprend son fichier (aucune demande de rendu). Éteint : l'état est rendu tel quel.
 */
function reprendreFormat(etat: EtatTutoriel, ratio: Ratio, commande: CommandeFabrication, outils: OutilsTutoriel, travailId: string): EtatTutoriel {
  if (outils.retouchePartielle !== true || !etat.plan) return etat;
  let e = etat;
  const nouvelle = lireEntreesTutoriel(commande.entrees).navigationFilmee;
  if (nouvelle && !e.navigationFilm) {
    const nouveauFilm = filmDeNavigation(nouvelle);
    const avant = e.parent?.navigationFilm;
    const voixInchangee = !e.parent?.audio?.empreinte || e.parent.audio.empreinte === e.audio?.empreinte;
    // Le film change sans que la voix change : on GARDE le film d'avant (aucune capture n'est demandée, le moteur n'en sait pas faire),
    // seuls les effets (cran, bascule) viennent de la commande. Une version d'avant sans navigation gardée : le film des entrées est pris.
    if (avant && e.parent?.film && !filmReutilisable(e.parent.film, nouveauFilm) && voixInchangee) {
      const { cran: _c, basculeMs: _b, hautSousTitresPct: _h, ...base } = avant;
      void _c;
      void _b;
      void _h;
      const gardee: NavigationFilmee = { ...base, ...(nouvelle.cran !== undefined ? { cran: nouvelle.cran } : {}), ...(nouvelle.basculeMs !== undefined ? { basculeMs: nouvelle.basculeMs } : {}) };
      const reserve = "Le film de navigation est celui de la version d'avant.";
      e = { ...e, navigationFilm: gardee, film: filmDeNavigation(gardee), reserves: e.reserves.includes(reserve) ? e.reserves : [...e.reserves, reserve] };
    } else {
      e = { ...e, navigationFilm: nouvelle, film: nouveauFilm };
    }
  }
  const empreinte = empreinteDuFormat(e, ratio, commande, outils);
  e = { ...e, empreintesFormats: { ...e.empreintesFormats, [ratio]: empreinte } };
  const sortieAvant = e.parent?.rendus?.[ratio];
  if (e.rendus.some((r) => r.ratio === ratio) || !sortieAvant || !e.parent?.empreintesFormats) return e;
  if (formatsARefaire(e.parent.empreintesFormats, { [ratio]: empreinte }, [ratio]).gardes.length === 0) return e;
  // Les résultats de mesure et de vignette de la version d'avant sont remis tels quels : jamais une alerte « non mesuré » fausse.
  const { mesure, vignette, ...fichier } = sortieAvant;
  return {
    ...e,
    rendus: [
      ...e.rendus,
      {
        ratio,
        demande: demandeReprise(e, ratio, fichier, travailId),
        essai: 0,
        sortie: fichier,
        reprise: true,
        ...(mesure !== undefined ? { mesure: { essai: 0, resultat: mesure } } : {}),
        ...(vignette !== undefined ? { vignette: { essai: 0, resultat: vignette } } : {}),
      },
    ],
  };
}

async function pasMontage(etat: EtatTutoriel, ratios: Ratio[], commande: CommandeFabrication, outils: OutilsTutoriel, travailId: string, avecMixage = false): Promise<PasTutoriel> {
  let e = etat;
  const finitions = !!outils.finitions?.actif;
  if (finitions && avecMixage) {
    const m = await pasMixage(e, commande, outils, travailId);
    if (!m.fini) return { statut: "en-cours", etat: m.etat };
    e = m.etat;
  }
  const faitRatio = (r: Ratio) => {
    const x = e.rendus.find((y) => y.ratio === r);
    return x?.reprise ? true : finitions ? finitionsFinies(x) : !!x?.sortie;
  };
  for (const ratio of ratios) {
    e = reprendreFormat(e, ratio, commande, outils, travailId);
    if (faitRatio(ratio)) continue;
    if (e.rendus.find((r) => r.ratio === ratio)?.sortie) {
      e = await pasFinitions(e, ratio, outils, travailId);
      continue;
    }
    const avant = e.rendus.find((r) => r.ratio === ratio)?.demande;
    e = await pasRendu(e, ratio, commande, outils, travailId);
    // T-EXT-45b : un pas qui paie rend son état dès que le résultat payé est là. Une demande neuve vient d'être soumise : si un format
    // plus loin levait dans ce même pas, `avancer` jetterait l'état et la série suivante repayerait ce format sous un autre identifiant.
    if (e.rendus.find((r) => r.ratio === ratio)?.demande !== avant) return { statut: "en-cours", etat: e };
  }
  return { statut: ratios.every(faitRatio) ? "faite" : "en-cours", etat: e };
}

/** Textes permis à l'écran pour le regard : le registre des textes choisis quand l'état le porte ; sinon le script validé, les textes du plan et la carte de fin. */
function textesPermisDuRegard(etat: EtatTutoriel, laFin: FinDuTutoriel): string[] {
  const registre = (etat as EtatTutoriel & { registre?: RegistreTextes }).registre;
  if (registre?.entrees) return textesPermisDuRegistre(registre);
  const dansPlan = (v: unknown): string[] => (typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(dansPlan) : v && typeof v === "object" ? Object.values(v).flatMap(dansPlan) : []);
  return [etat.script?.texte ?? "", ...(etat.plan ? dansPlan(etat.plan.plan.scenes.map((sc) => [sc.parametres, sc.calques])) : []), ...(laFin.fin ? [laFin.fin.titre, laFin.fin.sousTitre] : [])];
}

/** T-EXT-27b : UN regard par version fabriquée, sur le format maître. Ne fait jamais échouer ni attendre : il range un verdict. */
async function pasRegarder(pas: PasTutoriel, outils: OutilsTutoriel): Promise<PasTutoriel> {
  const etat = pas.etat;
  const maitre = etat.rendus.find((r) => r.ratio === etat.ratios[0]);
  // T-EXT-52b : un maître repris n'a ni film, ni sous-titres, ni fin dans sa demande : aucun regard payé (rien n'a changé dans ce format).
  if (!outils.regarder || pas.statut !== "faite" || etat.regard || !etat.plan || !maitre?.sortie || maitre.reprise) return pas;
  const registre = (etat as EtatTutoriel & { registre?: RegistreTextes }).registre;
  const laFin = etat.fin ?? etat.parent?.fin ?? finDuTutoriel(undefined, outils.fin?.actif === true);
  const instants = instantsTutoriel(etat.plan.plan, { finMs: laFin.finMs, ...(registre?.entrees ? { registre } : {}) });
  let lecture: LectureRegard | null = null;
  try {
    lecture = await outils.regarder({ demandeMaitre: maitre.demande, instants });
  } catch {
    lecture = null;
  }
  const verdict = verdictRegardTutoriel(instants, lecture, { textesPermis: textesPermisDuRegard(etat, laFin), ...(laFin.fin ? { fin: { texte: `${laFin.fin.titre} ${laFin.fin.sousTitre}`, motCle: laFin.fin.titre } } : {}) });
  let suite: EtatTutoriel = { ...(lecture ? avecAppels(etat, "regard", 1) : etat), regard: { instants: instants.length, relues: verdict.relues, verdict } };
  if (!lecture) suite = { ...suite, reserves: [...suite.reserves, "À vérifier · Les images n'ont pas pu être relues."] };
  // Grille chiffrée : seulement si le contrôle de l'image et le verdict du contrôleur sont déjà dans l'état ; sinon pas de grille (rapport de master).
  const porte = suite as EtatTutoriel & { controleImage?: RapportControleImage; controleur?: VerdictControleur };
  if (porte.controleImage && porte.controleur) suite = { ...suite, grille: noterTutoriel({ controleImage: porte.controleImage, controleur: porte.controleur, regardeur: verdict, dureeSec: maitre.sortie.dureeSec }) };
  return { ...pas, etat: suite };
}

/** Un pas de l'étape `cle`. Lève `ErreurTutoriel`, une erreur de la voix ou du rendu : le moteur la rend lisible. */
export async function avancerEtape(cle: CleEtapeTutoriel, etat: EtatTutoriel, commande: CommandeFabrication, outils: OutilsTutoriel, travailId: string): Promise<PasTutoriel> {
  switch (cle) {
    case "script":
      return pasScript(etat, commande, outils);
    case "voix":
      return pasVoix(etat, commande, outils);
    case "calage":
      // Sans étape « voix » (aucune distribution), le calage part de l'estimation du texte.
      return pasApresCalage(pasCalage(etat.audio ? etat : (await pasVoix(etat, commande, outils)).etat, commande, outils), commande, outils);
    case "plan":
      return pasPlan(etat, commande, outils);
    case "montage":
      return pasRegarder(await pasMontage(etat, etat.ratios.slice(0, 1), commande, outils, travailId, true), outils);
    case "exports":
      return pasMontage(etat, etat.ratios.slice(1), commande, outils, travailId);
  }
}
