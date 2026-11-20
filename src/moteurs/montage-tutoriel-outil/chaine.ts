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
import type { AudioMaitre } from "@/briques/voix-maitre/types";
import { horodaterTexte } from "@/domaine/derivations";
import type { BaseSousTitres, CommandeFabrication, IntensiteSousTitres, MotHorodate, Ratio, SegmentSousTitres, ValeurStyleSousTitres } from "@/domaine/types";
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
import { lireEntreesTutoriel } from "./entrees";
import { cibleSon, lireMesure, parametresMesure, parametresMixage, parametresVignette, type MesureSon } from "./finitions";
import { CARTE_FIN_AXION, COMPOSITION_TUTORIEL, DUREE_CARTE_FIN_MS, formatDuRatio, type ProprietesTutorielOutil } from "./proprietes";
import { payerUneFois, type RegistrePaye } from "./reprise";
import { ecrireScript, MOTS_PAR_SECONDE, remarquesScript, scriptRetenu, type SourceScript } from "./script";

export const ETAPES_TUTORIEL = ["script", "voix", "calage", "plan", "montage", "exports"] as const;
export type CleEtapeTutoriel = (typeof ETAPES_TUTORIEL)[number];

/** Nouvelles demandes au rendu après un échec passager, avant de rendre l'étape en échec (réessayable). */
export const ESSAIS_RENDU_TUTORIEL = 3;

/* ------------------------------------------------------------------ */
/* Outils injectés (services réels, ou doubles des tests)               */
/* ------------------------------------------------------------------ */

/** La voix : mêmes outils que la sous-machine `voix-maitre` (comme le tableau animé), plus la clé des fichiers. */
export type OutilsVoixTutoriel = Pick<
  OutilsVoixMaitre,
  "voix" | "stockage" | "aligneur" | "rendu" | "renduEstSimule" | "idVoix" | "reglages" | "tauxUsdEur" | "fournisseurVoix" | "caler" | "regles" | "erreurStockage" | "ressemblance" | "avantLecture"
> & { cle: (nom: string) => string };

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
  /** Style des sous-titres résolu par le studio ; absent : style par défaut. */
  sousTitres?: { style?: ValeurStyleSousTitres | null; base?: BaseSousTitres; intensite?: IntensiteSousTitres };
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
}

export interface RenduTutoriel {
  ratio: Ratio;
  demande: DemandeRendu;
  essai: number;
  sortie?: { fichierCle: string; dureeSec: number; taille: number };
  /** T-EXT-45b : série de « Réessayer » (absente = jamais relancé). Elle entre dans l'identifiant de la demande : jamais un identifiant déjà vu par `studio-rendu`. */
  serie?: number;
  /** T-EXT-45b : « Réessayer » a remis ce rendu tombé à zéro ; le prochain pas le redemande. */
  aSoumettre?: true;
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
}

export interface EtatTutoriel {
  script?: { texte: string; source: SourceScript; remarques: string[] };
  /** Script écrit depuis l'idée, en attente de la relecture de Williams. */
  proposition?: string;
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
  parent?: { plan?: PlanValide; audio?: AudioTutoriel };
  echecSimuleFait?: boolean;
  /** Appels Claude REVENUS sans lever (un appel refusé ou en panne n'est pas compté). Absent tant qu'aucun n'est revenu. */
  appelsClaude?: { script: number; plan: number; regard?: number };
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

const avecAppels = (etat: EtatTutoriel, cle: "script" | "plan" | "regard", n: number): EtatTutoriel => (n > 0 ? { ...etat, appelsClaude: { script: 0, plan: 0, ...etat.appelsClaude, [cle]: (etat.appelsClaude?.[cle] ?? 0) + n } } : etat);

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

async function pasScript(etat: EtatTutoriel, commande: CommandeFabrication, outils: OutilsTutoriel): Promise<PasTutoriel> {
  if (etat.script) return { statut: "faite", etat };
  const r = scriptRetenu(commande.script.texteComplet, lireEntreesTutoriel(commande.entrees));
  if ("texte" in r) return { statut: "faite", etat: { ...etat, script: { texte: r.texte, source: r.source, remarques: remarquesScript(r.texte) } } };
  if ("vide" in r) return { statut: "pause", etat, code: "TO_SCRIPT_ABSENT", message: "Aucun script ni idée : collez votre script ou donnez un titre. Rien n'a échoué." };
  if (etat.proposition) return { statut: "pause", etat, code: "TO_SCRIPT_A_VALIDER", message: "Relisez le script, modifiez-le si besoin, puis validez : la vidéo se fabrique ensuite." };
  const n = { v: 0 };
  const empreinte = fnv1a64(jsonCanonique({ aEcrire: r.aEcrire }));
  const payee = await payerUneFois(etat.payes, "script", empreinte, () => ecrireScript(r.aEcrire, compterAppels(outils.claude, n)), commande.construiteLe);
  const proposition = payee.resultat;
  etat = avecAppels(avecPayes(etat, payee.registre, n.v > 0 && !!proposition), "script", n.v);
  if (!proposition) return { statut: "pause", etat, code: "TO_SCRIPT_NON_ECRIT", message: "Le script n'a pas pu être écrit pour l'instant : collez votre script, ou relancez plus tard. Rien n'a échoué." };
  return { statut: "pause", etat: { ...etat, proposition }, code: "TO_SCRIPT_A_VALIDER", message: "Relisez le script, modifiez-le si besoin, puis validez : la vidéo se fabrique ensuite." };
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
      await o.avantLecture?.();
    },
  };
}

async function pasVoix(etat: EtatTutoriel, commande: CommandeFabrication, outils: OutilsTutoriel): Promise<PasTutoriel> {
  if (etat.audio) return { statut: "faite", etat };
  const texte = etat.script!.texte;
  if (!outils.voix || !commande.distribution.length) {
    const mots = horodaterTexte(texte, MOTS_PAR_SECONDE);
    const audio: AudioTutoriel = { dureeSec: mots.at(-1)?.finSec ?? 1, mots, empreinte: "sans-voix", reutilise: false, coutCentimes: 0, caracteres: 0, fournisseur: "aucune" };
    const reserves = commande.distribution.length ? [...etat.reserves, "À vérifier · Voix : aucune voix n'est reliée, la vidéo sort muette."] : etat.reserves;
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

/** Propriétés de la composition pour un ratio (l'adresse de la voix arrive par l'entrée « audio »). */
export function proprietesTutoriel(etat: EtatTutoriel, ratio: Ratio, avecSousTitres: boolean, outils: Pick<OutilsTutoriel, "sousTitres">, navigation?: NavigationFilmee): Omit<ProprietesTutorielOutil, "audio" | "filmNavigation"> {
  const st = outils.sousTitres;
  const sousTitres =
    avecSousTitres && etat.sousTitres?.length ? donneesCalque({ segments: etat.sousTitres, base: baseRetenue(st?.base, st?.style ?? null), ratio, ...(st?.style ? { style: st.style } : {}) }) : undefined;
  const { videoCle: _cle, ...sansFilm } = navigation ?? ({} as NavigationFilmee);
  void _cle;
  // T-EXT-44 : la caméra garde la zone visée au-dessus de la bande des sous-titres (lue dans les sous-titres déjà calculés).
  const haut = sousTitres ? hautBandeSousTitresPct(sousTitres.positions.basPct) : undefined;
  const navigationFinale = navigation ? { ...sansFilm, ...(haut !== undefined ? { hautSousTitresPct: haut } : {}) } : undefined;
  return { plan: planPourRatio(etat.plan!.plan, ratio), ...(sousTitres ? { sousTitres } : {}), fin: { ...CARTE_FIN_AXION }, finMs: DUREE_CARTE_FIN_MS, ...(navigationFinale ? { navigation: navigationFinale } : {}) };
}

const nomRatio = (r: Ratio) => r.replace(":", "x");

async function demandeRendu(etat: EtatTutoriel, ratio: Ratio, essai: number, commande: CommandeFabrication, outils: OutilsTutoriel, travailId: string, serie?: number): Promise<DemandeRendu> {
  const cle = outils.rendu.cle(`tutoriel-${nomRatio(ratio)}.mp4`);
  // Voix mixée (T-EXT-31) quand elle existe, sinon la voix brute, comme avant.
  const voix = etat.sonMixe?.fini && !etat.sonMixe.echec ? etat.sonMixe.fichierCle : etat.audio?.fichierCle;
  const nav = lireEntreesTutoriel(commande.entrees).navigationFilmee;
  // Le film de navigation (T-EXT-38) arrive par l'entrée « filmNavigation » (jamais « navigation » : elle écraserait l'objet).
  const lectures: Record<string, string> = { ...(voix ? { audio: voix } : {}), ...(nav ? { filmNavigation: nav.videoCle } : {}) };
  const signe = await outils.rendu.signer(lectures, { cle, mime: "video/mp4" });
  return {
    idRendu: serie ? `${travailId}-${nomRatio(ratio)}-r${serie}-${essai}` : `${travailId}-${nomRatio(ratio)}-${essai}`,
    operation: "composition",
    file: "longue",
    entrees: signe.lectures,
    sortie: { urlDepot: signe.urlDepot, cle },
    parametres: { composition: COMPOSITION_TUTORIEL, proprietes: proprietesTutoriel(etat, ratio, commande.briques["sous-titres"] !== false, outils, nav && commande.dosageMotion?.cran ? { ...nav, cran: commande.dosageMotion.cran } : nav) },
  };
}

/** Un pas de rendu d'un ratio : soumettre, suivre, ressoumettre après un échec passager. */
async function pasRendu(etat: EtatTutoriel, ratio: Ratio, commande: CommandeFabrication, outils: OutilsTutoriel, travailId: string): Promise<EtatTutoriel> {
  const service = outils.rendu.service();
  const courant = etat.rendus.find((r) => r.ratio === ratio);
  const remplacer = (r: RenduTutoriel) => ({ ...etat, rendus: [...etat.rendus.filter((x) => x.ratio !== ratio), r] });
  if (!courant) {
    const demande = await demandeRendu(etat, ratio, 0, commande, outils, travailId);
    await service.soumettre(demande);
    return remplacer({ ratio, demande, essai: 0 });
  }
  if (courant.sortie) return etat;
  const serie = courant.serie ? { serie: courant.serie } : {};
  // T-EXT-45b : « Réessayer » a pu remettre à zéro un rendu qui tourne encore (ou est déjà fini) chez `studio-rendu` : on suit TOUJOURS
  // l'ancienne demande avant d'en soumettre une neuve. Une demande neuve (identifiant neuf) n'est soumise que si l'ancienne est en échec.
  const e = courant.demande ? await suivreRendu(service, courant.demande) : undefined;
  if (courant.aSoumettre && (!e || e.statut === "echec")) {
    const demande = await demandeRendu(etat, ratio, courant.essai, commande, outils, travailId, courant.serie);
    await service.soumettre(demande);
    return remplacer({ ratio, demande, essai: courant.essai, ...serie });
  }
  if (!e) return etat;
  if (e.statut === "echec") {
    const essai = courant.essai + 1;
    if (!e.erreur.reessayable || essai >= ESSAIS_RENDU_TUTORIEL) throw new ErreurRendu(e.erreur);
    const demande = await demandeRendu(etat, ratio, essai, commande, outils, travailId, courant.serie);
    await service.soumettre(demande);
    return remplacer({ ratio, demande, essai, ...serie });
  }
  // L'ancienne demande est en file, en cours ou finie : on la garde (plus de « à soumettre »), rien n'est payé deux fois.
  const { aSoumettre: _a, ...suivi } = courant;
  void _a;
  if (e.statut !== "termine") return courant.aSoumettre ? remplacer(suivi) : etat;
  const dureeAttendue = (etat.plan!.plan.dureeMs + DUREE_CARTE_FIN_MS) / 1000;
  const dureeSec = typeof e.mesures?.dureeSec === "number" ? e.mesures.dureeSec : dureeAttendue;
  return remplacer({ ...suivi, sortie: { fichierCle: e.sortieCle, dureeSec, taille: typeof e.mesures?.taille === "number" ? e.mesures.taille : 0 } });
}

type SuiteFinition<R> = { f: FinitionTutoriel<R>; fini: boolean };

/** Suit une finition : après un échec passager, une nouvelle demande (au plus `ESSAIS_RENDU_TUTORIEL`) ; sinon échec définitif, jamais une erreur. */
async function suivreFinition<R>(service: ServiceRendu, f: FinitionTutoriel<R>, refaire: (essai: number) => Promise<DemandeRendu>, lire: (e: Extract<Awaited<ReturnType<typeof suivreRendu>>, { statut: "termine" }>) => R | null): Promise<SuiteFinition<R>> {
  if (f.resultat !== undefined) return { f, fini: true };
  let e;
  try {
    e = await suivreRendu(service, f.demande!);
  } catch {
    return { f: { ...f, resultat: "echec" }, fini: true };
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
    const courant = etat.sonMixe;
    if (!courant) {
      const demande = await demander(0);
      await service.soumettre(demande);
      return { etat: { ...etat, sonMixe: { fichierCle: demande.sortie.cle, demande, essai: 0, fini: false } }, fini: false };
    }
    const e = await suivreRendu(service, courant.demande!);
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
    return finitions ? finitionsFinies(x) : !!x?.sortie;
  };
  for (const ratio of ratios) {
    if (faitRatio(ratio)) continue;
    e = e.rendus.find((r) => r.ratio === ratio)?.sortie ? await pasFinitions(e, ratio, outils, travailId) : await pasRendu(e, ratio, commande, outils, travailId);
  }
  return { statut: ratios.every(faitRatio) ? "faite" : "en-cours", etat: e };
}

/** Textes permis à l'écran pour le regard : le registre des textes choisis quand l'état le porte ; sinon le script validé, les textes du plan et la carte de fin. */
function textesPermisDuRegard(etat: EtatTutoriel): string[] {
  const registre = (etat as EtatTutoriel & { registre?: RegistreTextes }).registre;
  if (registre?.entrees) return textesPermisDuRegistre(registre);
  const dansPlan = (v: unknown): string[] => (typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(dansPlan) : v && typeof v === "object" ? Object.values(v).flatMap(dansPlan) : []);
  return [etat.script?.texte ?? "", ...(etat.plan ? dansPlan(etat.plan.plan.scenes.map((sc) => [sc.parametres, sc.calques])) : []), CARTE_FIN_AXION.titre, CARTE_FIN_AXION.sousTitre];
}

/** T-EXT-27b : UN regard par version fabriquée, sur le format maître. Ne fait jamais échouer ni attendre : il range un verdict. */
async function pasRegarder(pas: PasTutoriel, outils: OutilsTutoriel): Promise<PasTutoriel> {
  const etat = pas.etat;
  const maitre = etat.rendus.find((r) => r.ratio === etat.ratios[0]);
  if (!outils.regarder || pas.statut !== "faite" || etat.regard || !etat.plan || !maitre?.sortie) return pas;
  const registre = (etat as EtatTutoriel & { registre?: RegistreTextes }).registre;
  const instants = instantsTutoriel(etat.plan.plan, { finMs: DUREE_CARTE_FIN_MS, ...(registre?.entrees ? { registre } : {}) });
  let lecture: LectureRegard | null = null;
  try {
    lecture = await outils.regarder({ demandeMaitre: maitre.demande, instants });
  } catch {
    lecture = null;
  }
  const verdict = verdictRegardTutoriel(instants, lecture, { textesPermis: textesPermisDuRegard(etat), fin: { texte: `${CARTE_FIN_AXION.titre} ${CARTE_FIN_AXION.sousTitre}`, motCle: CARTE_FIN_AXION.titre } });
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
      return pasCalage(etat.audio ? etat : (await pasVoix(etat, commande, outils)).etat, commande, outils);
    case "plan":
      return pasPlan(etat, commande, outils);
    case "montage":
      return pasRegarder(await pasMontage(etat, etat.ratios.slice(0, 1), commande, outils, travailId, true), outils);
    case "exports":
      return pasMontage(etat, etat.ratios.slice(1), commande, outils, travailId);
  }
}
