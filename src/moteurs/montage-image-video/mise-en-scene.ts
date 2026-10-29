/**
 * IMAGE → VIDÉO · Mise en scène DÉTERMINISTE (lot L11, plan 50 § 1 [8], § 5, § 7 Q12-Q15, Q20-Q23, Q25). PUR.
 *
 * Fiche validée + heures des mots (piste voix seule de L12, tempo final) → ligne de temps complète d'UNE version :
 *  - un PLAN par écran de la fiche (et des sous-plans quand un écran est trop long), chacun avec sa scène, son fond
 *    (sombre / ivoire, alternés par la fiche) et ses textes (`*mot*` orange, un au plus par plan) ;
 *  - chaque élément (nœud, chiffre, ligne de texte, objet, coche) apparaît AU MOT QUI LE NOMME (0,15 s avant) ; un
 *    chiffre dit apparaît sur SON mot (Q13) ; ce qui n'est nommé par aucun mot se pose aux appuis de la phrase (début
 *    de proposition) qui équilibrent le rythme ;
 *  - schéma : séquences de toile (`ProprietesSceneIV`) dont la caméra est celle de L2 (cadrage propre, zoom 0,8-1,6) ;
 *    scène « Ensemble » (≤ 1,5 s) à l'ouverture de chaque chapitre et après les branches ;
 *  - bénéfices : une grande carte à la fois (repère « k/N »), son micro-objet, puis le récapitulatif ;
 *  - sous-titres mot à mot dans la bande de la mise en page (#224) ; bruitages posés par L4 sur les changements visibles ;
 *  - rythme : un trou de plus de 2,4 s est relancé par un VRAI changement (bascule de fond d'un écran v4, vue
 *    d'ensemble sur une toile) ; un en-tête ou un texte de comblement ne compte jamais ;
 *  - segment de fin du réseau (question de commentaire quand la fin en porte une, puis la fin de la banque ; rien seulement dans le plan d'une vidéo d'avant le 26/10/2026, LinkedIn muet).
 * Puis les contrôles BLOQUANTS (`controles-scene.ts`) : une ligne de temps qui ne les passe pas est refusée, avec une
 * phrase pour Will. Rien n'est tiré au hasard : mêmes entrées = même ligne de temps.
 */
import { sceneApresGarde } from "@/domaine/image-video/analyste/garde-additionneur";
import type { BruitagePlace } from "@/briques/intensite/types";
import type { EcranCale } from "@/briques/ecrans-motion/types";
import {
  AVANCE_NOEUD_IV,
  BAS_ENTETE_IV,
  ZONE_UTILE_IV,
  ECRAN_IV,
  miseEnPageDeHauteurIV,
  VITESSE_FRAPPE,
  disposerEtCadrer,
  type BoiteNoeud,
  type CadrageCamera,
  type DispositionToile,
  type EnsembleSceneIV,
  type EnteteSceneIV,
  type MotParle,
  type ProprietesSceneIV,
  type SchemaEntree,
  type TrajectoireCamera,
} from "@/briques/schema-motion";
import { MARGE_CADRE, type EtiquetteToile } from "@/briques/schema-motion/camera";
import { planEnsemble } from "@/briques/schema-motion/plan-objets";
import { CADRES_IV, type BlocVarieteDonnees, type FormatIV, type RecetteVarieteIV, type VarieteBlocIV } from "@/briques/schema-motion/variete";
import { TAILLE_LIBELLE_IV } from "@/briques/schema-motion/lisibilite";
import { proposerMicroObjet, type NomMicroObjet } from "@/briques/schema-motion/micro-objets";
import { queueDeFinIV, type QueueFinIV } from "@/briques/schema-motion/queue-fin";
import type { CarteImage, NoeudCarte } from "@/domaine/image-video/carte";
import { motsDits, type EcranFiche, type FicheImage, type Fond, type Partie, type Scene } from "@/domaine/image-video/fiche";
import { iconeDe } from "@/domaine/image-video/icones";
import type { ReseauIV } from "@/domaine/image-video/plafonds";
import type { MotHorodate } from "@/domaine/types";
import { poserBruitagesIV, type BruitageValideIV, type EvenementIV, type GenreEvenement } from "./bruitages";
import { calerFiche, cleMot, type CalageIV, type MotCale } from "./calage";
import { ecranV4Tient } from "./ecrans-v4";
import { cleChiffre, clesDeLaCarte, clesDuTexte, controlerMiseEnSceneIV, instantsVisibles, type RapportMiseEnSceneIV } from "./controles-scene";
import type { FinIV } from "./fins";
import { chiffresDuTexte } from "./regles";
import { REGLES_SCENE_IV } from "./regles-scene";
import { sousTitresIV, type MotFort, type SousTitresIV } from "./sous-titres";
import { appliquerVarieteIV, type RepliVarieteIV } from "./variete";
import { afficheIV, type AfficheIV } from "./variete/axes/ouverture";

/* ------------------------------------------------------------------ */
/* Réglages                                                              */
/* ------------------------------------------------------------------ */

const R = REGLES_SCENE_IV;
const MARQUE = "axion-ia.com" as const;

/**
 * Étiquette de repli d'un en-tête (aucun groupe, aucune étiquette écrite) : le titre de l'image, sauf s'il redit la marque
 * (déjà écrite en haut de l'écran) ; alors « Vue d'ensemble » sur l'écran d'ensemble, sinon rien (25/10).
 */
function etiquetteDeRepli(carte: Pick<CarteImage, "titre">, scene?: string): string {
  const net = (t: string) => t.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "");
  const t = net(carte.titre);
  if (t !== net(MARQUE) && t !== net(MARQUE.replace(/\.com$/, ""))) return carte.titre;
  return scene === "ensemble" ? "Vue d'ensemble" : "";
}

/* ------------------------------------------------------------------ */
/* Types publics                                                         */
/* ------------------------------------------------------------------ */

export interface EntreeMiseEnSceneIV {
  carte: CarteImage;
  fiche: FicheImage;
  /** Piste voix seule de la version (L12) : mots à l'heure finale, nombre de mots du corps, fin mesurée. */
  voix: { mots: readonly MotHorodate[]; motsCorps: number; dureeSec: number; finVoixSec: number };
  /** Fin de la version (plan des fins, L14) ; muette ou absente : rien après la phrase-choc (LinkedIn). */
  fin: Pick<FinIV, "id" | "reseaux" | "muet" | "question" | "appels"> | null;
  reseaux: readonly ReseauIV[];
  /** Sons validés par Will (L4) : aucun = refus explicite. */
  bruitagesValides: readonly BruitageValideIV[];
  /** Recette de variété de la version (tirée par `variete/tirage`) ; absente : le rendu de référence, inchangé. */
  variete?: RecetteVarieteIV;
  /** Format d'image (défaut 9:16). */
  format?: FormatIV;
  /** Graine de la vidéo (son identifiant) : variante de départ des bruitages (lot TIR) ; absente : départ à 0. */
  graine?: string;
}

/** Ce que montre un plan : le composant qui le rend. */
export type SortePlanIV = "emotion" | "toile" | "objets" | "moment" | "ensemble" | "recap" | "fin";

export interface PlanIV {
  id: string;
  debut: number;
  fin: number;
  /** Écran de la fiche (absent pour une insertion « Ensemble » ou un récapitulatif). */
  ecran?: string;
  partie: Partie | "fin";
  scene: Scene | "question" | "appel" | "recap";
  sorte: SortePlanIV;
  fond: Fond;
  /** Textes d'écran visibles pendant le plan (`*mot*` = orange). */
  textes: string[];
  /** Pourquoi ce plan commence : un écran, un sous-plan d'un écran trop long, une insertion, une relance du rythme (vue d'ensemble). */
  coupe: "ecran" | "sous-plan" | "insertion" | "relance";
  marque: typeof MARQUE;
}

/** Un changement de la ligne de temps (forme lue par la pose des bruitages, L4), avec ce qu'il montre. */
export interface EvenementTempsIV extends EvenementIV {
  /** Faux : mouvement de caméra ou simple rappel d'un nœud déjà posé (ne compte pas pour le rythme). */
  visible: boolean;
  /**
   * Vrai : changement d'en-tête ou texte posé pour combler un trou (ligne de mots dits, relance, seconde moitié d'une
   * ligne coupée). Montré (et sonorisé), mais NE COMPTE PAS pour le rythme (Q14) : seuls comptent nœuds, chiffres de la
   * carte, objets dessinés, coches, changements de fond et de scène.
   */
  remplissage?: true;
  plan: string;
  ecran?: string;
  ref?: string;
  texte?: string;
  /** Chiffres montrés (clés « valeur|unité »). */
  chiffres: string[];
}

/* Données de rendu (formes recopiées des compositions de `studio-rendu`, sans les importer : `src/` n'importe jamais
 * `studio-rendu/`). Un test vérifie qu'elles s'y assignent. Instants en secondes DEPUIS LE DÉBUT DU BLOC. */

export type BeneficePlanIV = { id: string; titre: string; ligne?: string; icone?: string; micro?: NomMicroObjet };
export type MomentIV =
  | { sorte: "benefices"; benefices: BeneficePlanIV[]; heures: number[]; microObjets: { carte: string; nom: NomMicroObjet; t: number }[]; heuresLignes: number[] }
  | { sorte: "recap"; benefices: BeneficePlanIV[] }
  | { sorte: "bandeau"; chiffres: { texte: string; legende?: string; t: number }[]; etiquette?: string }
  | { sorte: "recherche"; requete: string; frappe: number; mots?: number[]; trouve?: { texte: string; t: number } }
  | { sorte: "alerte"; source: string; moment?: string; message: string; t0: number; frappe?: number; declencheurs?: { texte: string; t: number }[]; tampon?: { texte: string; t: number }[] }
  | { sorte: "email"; champs: { nom: string; valeur?: string; t: number; libre?: true }[]; tampon?: { texte: string; t: number }[] }
  | { sorte: "dossiers"; dossiers: { nom: string; t: number }[] }
  | { sorte: "sources"; sources: { icone: string; nom?: string; t: number }[]; cible: { icone: string } }
  | { sorte: "phrase-choc"; phrase: string; heures: number[] }
  | { sorte: "ensemble"; schema: SchemaEntree; options: { allumes?: string[]; chiffresCles?: string[] } };
export type MomentPlanIV = MomentIV & { debut: number; fin: number; fond: Fond; entete?: { etiquette: string; titre: string } };

export type ObjetPlanIV = { debut: number; fin: number } & (
  | { sorte: "entonnoir"; proprietes: { quantite: number; icone: string; moteur: string; sorties: [SortiePlanIV, SortiePlanIV]; chutes: number[] } }
  | { sorte: "nuee"; proprietes: { quantite: number; cochees: number; icone: string; apparition: number; debutCoches: number; finCoches: number; distinctions?: number[] } }
  | { sorte: "ecran-partage"; proprietes: { avant: ColonnePlanIV; apres: ColonnePlanIV; bascule: number } }
  | {
      sorte: "additionneur";
      proprietes: { termes: { libelle: string; valeur: number; t: number }[]; unite: string; total: { valeur: number; t: number }; detail?: { libelle: string; valeur?: string; t: number; tValeur?: number } };
    }
);
export type SortiePlanIV = { libelle: string; compte: number; couleur: "orange" | "noir" | "vert" | "neutre" };
export type ColonnePlanIV = { titre: string; lignes: { texte?: string; valeur?: string; coche?: boolean; t: number }[] };

/**
 * Propriétés d'une séquence de toile : `ProprietesSceneIV` (L7) + deux propriétés NOUVELLES, à brancher par le lot
 * « mise en page » (signalées dans la PR) : `dejaVus` (nœuds posés dans une séquence précédente, montrés « vus » dès
 * le début) et `accents` (un chiffre déjà posé qui claque à nouveau sur son mot).
 */
export type ProprietesToileIV = ProprietesSceneIV & { dejaVus?: string[]; accents?: { noeud: string; t: number; texte: string }[] };

export type BlocRenduIV = { id: string; debut: number; fin: number; variete?: VarieteBlocIV } & (
  | { sorte: "ecran"; ecran: EcranCale }
  | { sorte: "toile"; proprietes: ProprietesToileIV; trajectoire: TrajectoireCamera; toile: DispositionToile; cadrage: CadrageCamera }
  | { sorte: "objets"; fond: Fond; entetes: EnteteSceneIV[]; objets: ObjetPlanIV[] }
  | { sorte: "moments"; moments: MomentPlanIV[] }
  | ({ sorte: "variete" } & BlocVarieteDonnees)
);

export interface RepereIV {
  changements: { t: number; numero: number }[];
  total: number;
  prefixe?: string;
}

export interface LigneDeTempsIV {
  version: string;
  reseaux: ReseauIV[];
  largeur: number;
  hauteur: number;
  fps: number;
  dureeSec: number;
  /** Fin sonore de la voix (Q19 : ≥ 1,5 s avant la fin de la vidéo). */
  finVoixSec: number;
  plans: PlanIV[];
  evenements: EvenementTempsIV[];
  blocs: BlocRenduIV[];
  sousTitres: SousTitresIV;
  repere: RepereIV | null;
  bruitages: BruitagePlace[];
  /** Segment de fin : début, question dite ou non, version muette (plan d'avant le 26/10/2026 : LinkedIn seul). */
  segmentFin: { debut: number; question: boolean; muet: boolean };
  /** Clés des chiffres de la carte (Q12/Q13) et chiffres dits avec leur heure. */
  chiffresDits: { cle: string; brut: string; t: number; ecran: string }[];
  /** Ce que le calage n'a pas retrouvé tel quel dans la voix (part). */
  partCalee: number;
  /** Variété appliquée (seulement avec une recette) : la recette, le format et les axes revenus à leur référence. */
  variete?: { recette: RecetteVarieteIV; format: FormatIV; replis: RepliVarieteIV[] };
  /**
   * Queue animée (secondes de la version) : après le dernier mot dit, le trait de fin se dessine jusqu'à 0,2 s avant la
   * fin (`queue-fin.ts`), dans le dernier bloc : la queue exigée par Q19 n'est plus une image figée hors voix (Q24).
   */
  queue?: QueueFinIV;
  /**
   * Affiche de la première image (aperçu des réseaux) : l'accroche écrite en entier, posée par-dessus le premier bloc
   * pendant `images` image(s) seulement (`variete/axes/ouverture.ts`). Absente si l'accroche n'a aucun texte.
   */
  affiche?: AfficheIV;
}

export interface ResultatMiseEnSceneIV {
  ok: boolean;
  ligne: LigneDeTempsIV;
  rapport: RapportMiseEnSceneIV;
  /** Phrases pour Will (vide si tout passe). */
  phrases: string[];
}

/* ------------------------------------------------------------------ */
/* Outils                                                                */
/* ------------------------------------------------------------------ */

const arrondi = (x: number) => Math.round(x * 1000) / 1000;

/** Une nuée paraît au plus tard 2 s après le début de son écran (issue 119). */
export const APPARITION_NUEE_MAX_SEC = 2;
const sansBalises = (t: string) => t.replace(/\*/g, "");

/** Mots vides : jamais un mot qui « nomme ». */
const VIDES = new Set(
  "dans pour avec sans vous votre vos nous notre leur leurs cette ces plus tout toute tous toutes elle elles sont etre avoir chez quand alors puis aussi tres bien comme mais donc encore deja enfin chaque meme".split(" "),
);

/** Deux formes comparables se correspondent : égales, ou même radical (5 lettres) pour un mot plein. */
function correspond(a: string, b: string): boolean {
  if (a === b) return true;
  return a.length >= 4 && b.length >= 4 && !VIDES.has(a) && !VIDES.has(b) && a.slice(0, 5) === b.slice(0, 5);
}
const plein = (m: string) => m.length >= 4 && !VIDES.has(m) && !/^\d/.test(m);
/** Formes comparables d'un texte (« l'objet » → « l », « objet » ; « e-mail » → « email »). */
const formes = (t: string) => cleMot(sansBalises(t)).split(" ").filter(Boolean);
const formesMot = (m: string): string[] => {
  const f = formes(m);
  const entier = f.join("");
  return f.length > 1 && entier.length >= 4 ? [...f, entier] : f;
};

/** Contexte d'un écran calé. */
interface Ctx {
  e: EcranFiche;
  mots: MotCale[];
  ecrits: string[];
  /** Formes comparables de chaque mot dit. */
  formes: string[][];
  /** Propositions (coupées après une ponctuation forte ou une virgule). */
  propositions: { de: number; a: number }[];
  debut: number;
  fin: number;
  /** Chiffres dits dans l'écran : clé, écriture, rangs du premier et du dernier mot qui les disent. */
  chiffres: { cle: string; brut: string; rang: number; dernier: number }[];
}

function contexte(e: EcranFiche, mots: MotCale[], debut: number, fin: number): Ctx {
  const ecrits = motsDits(e.texteDit);
  return { e, mots, ecrits, formes: ecrits.map(formesMot), propositions: propositionsDe(ecrits), debut, fin, chiffres: chiffresDitsDe(ecrits) };
}

/** Propositions d'une suite de mots : coupées après une ponctuation forte ou une virgule. */
function propositionsDe(ecrits: readonly string[]): { de: number; a: number }[] {
  const res: { de: number; a: number }[] = [];
  let de = 0;
  ecrits.forEach((m, k) => {
    if (/[.,!?:;…]["»”)]*$/u.test(m) || k === ecrits.length - 1) {
      res.push({ de, a: k });
      de = k + 1;
    }
  });
  return res;
}

/** Chiffres dits dans une suite de mots : clé, écriture et rangs du premier et du dernier mot qui les disent. */
export function chiffresDitsDe(ecrits: readonly string[]): { cle: string; brut: string; rang: number; dernier: number }[] {
  const complet = chiffresDuTexte(ecrits.join(" "));
  const vus = new Map<string, number>();
  const res: { cle: string; brut: string; rang: number; dernier: number }[] = [];
  for (const c of complet) {
    const cle = cleChiffre(c);
    const n = (vus.get(cle) ?? 0) + 1;
    vus.set(cle, n);
    // Plus court préfixe qui contient n fois la clé : son dernier mot ; puis le plus court suffixe qui la contient.
    let dernier = ecrits.length - 1;
    for (let k = 0; k < ecrits.length; k++) {
      if (chiffresDuTexte(ecrits.slice(0, k + 1).join(" ")).filter((x) => cleChiffre(x) === cle).length >= n) {
        dernier = k;
        break;
      }
    }
    let rang = dernier;
    while (rang > 0 && !chiffresDuTexte(ecrits.slice(rang, dernier + 1).join(" ")).some((x) => cleChiffre(x) === cle)) rang--;
    res.push({ cle, brut: c.brut, rang, dernier });
  }
  return res;
}

/** Heure d'apparition d'un élément calé sur le mot de rang `k` de l'écran (0,15 s avant, jamais avant l'écran). */
const heureMot = (c: Ctx, k: number) => Math.max(c.debut, arrondi((c.mots[Math.min(k, c.mots.length - 1)]?.debutSec ?? c.debut) - R.avance));
/** Heure du mot lui-même. */
const heureDite = (c: Ctx, k: number) => c.mots[Math.min(k, c.mots.length - 1)]?.debutSec ?? c.debut;

/**
 * Où la voix dit un texte : plus longue suite commune entre ses formes et celles des mots dits (à partir de `apres`).
 * `fort` = au moins un mot plein retrouvé. Rend les rangs des mots couverts, ou `null`.
 */
function ancrage(c: Ctx, texte: string, apres = 0): { de: number; a: number; couverts: number[]; fort: boolean } | null {
  const t = formes(texte).filter((x) => /[a-z0-9]/.test(x));
  const n = t.length;
  const m = c.ecrits.length - apres;
  if (n === 0 || m <= 0) return null;
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const egal = (i: number, k: number) => c.formes[apres + k].some((f) => correspond(f, t[i]));
  for (let i = n - 1; i >= 0; i--) for (let k = m - 1; k >= 0; k--) L[i][k] = egal(i, k) ? L[i + 1][k + 1] + 1 : Math.max(L[i + 1][k], L[i][k + 1]);
  const couverts: number[] = [];
  let fort = false;
  let i = 0;
  let k = 0;
  while (i < n && k < m) {
    if (egal(i, k) && L[i][k] === L[i + 1][k + 1] + 1) {
      couverts.push(apres + k);
      if (plein(t[i])) fort = true;
      i++;
      k++;
    } else if (L[i + 1][k] >= L[i][k + 1]) i++;
    else k++;
  }
  if (!couverts.length) return null;
  return { de: couverts[0], a: couverts[couverts.length - 1], couverts: [...new Set(couverts)], fort };
}

/** Premier rang (≥ `apres`) d'un mot dit qui nomme `texte` (un mot plein en commun), ou `null`. */
function rangQuiNomme(c: Ctx, texte: string, apres = 0): number | null {
  const t = formes(texte).filter(plein);
  for (let k = apres; k < c.formes.length; k++) if (c.formes[k].some((f) => t.some((x) => correspond(f, x)))) return k;
  // « Email » = « e-mail », « WhatsApp » = « whatsapp » : forme compacte.
  const entier = t.join("");
  for (let k = apres; k < c.formes.length; k++) if (entier.length >= 3 && c.formes[k].includes(entier)) return k;
  return null;
}

/** Rang du mot orange de l'écran (événement « apparait » de la fiche), sinon 0. */
const rangOrange = (c: Ctx): number => c.e.surMot.find((s) => s.action === "apparait")?.mot ?? 0;

/** Premier chiffre dit dans l'écran parmi des clés montrées. */
const chiffreDit = (c: Ctx, cles: readonly string[]) => c.chiffres.find((ch) => cles.includes(ch.cle)) ?? null;

/** Mot le plus proche d'une heure visée, dans [mini, maxi] : début de proposition à 0,5 s près de préférence. */
function motVers(c: Ctx, cible: number, mini: number, maxi: number, pris: ReadonlySet<number> = new Set()): number | null {
  const permis = c.mots.map((_, k) => k).filter((k) => !pris.has(k) && heureMot(c, k) >= mini - 1e-9 && heureMot(c, k) <= maxi + 1e-9);
  if (!permis.length) return null;
  const distance = (k: number) => Math.abs(heureMot(c, k) - cible);
  const debuts = permis.filter((k) => c.propositions.some((p) => p.de === k) && distance(k) <= 0.5);
  const liste = debuts.length ? debuts : permis;
  return liste.sort((a, b) => distance(a) - distance(b) || a - b)[0];
}

/* ------------------------------------------------------------------ */
/* Éléments                                                              */
/* ------------------------------------------------------------------ */

type RoleEl =
  | "ligne"
  | "entete"
  | "noeud"
  | "mention"
  | "coche"
  | "separation"
  | "accent"
  | "carte"
  | "micro"
  | "ligne-carte"
  | "recap"
  | "champ"
  | "dossier"
  | "source"
  | "alerte"
  | "declencheur"
  | "tampon"
  | "message"
  | "porte"
  | "frappe"
  | "frappe-mot"
  | "trouve"
  | "chute"
  | "coche-nuee"
  | "distinction"
  | "terme"
  | "total"
  | "detail"
  | "valeur-detail"
  | "chiffre"
  | "bascule"
  | "objet"
  | "bandeau"
  | "choc"
  | "question"
  | "appel";

interface El {
  id: string;
  role: RoleEl;
  genre: GenreEvenement;
  t: number;
  ecran: string;
  ref?: string;
  texte?: string;
  chiffres: string[];
  visible: boolean;
  /** Commence un sous-plan. */
  coupe?: boolean;
  /** Mots dits que ce texte affiche (rangs dans l'écran) : le comblement ne les répète pas. */
  couverts?: number[];
  /** Ligne révélée en plusieurs temps : les étapes d'une même ligne partagent ce nom (la dernière l'emporte). */
  groupe?: string;
  /** Retard d'apparition (s) laissé à la caméra pour arriver sur ce bloc. */
  decalage?: number;
  /** Changement d'en-tête ou texte de comblement : montré, mais ne compte pas pour le rythme (Q14). */
  remplissage?: boolean;
}

/* ------------------------------------------------------------------ */
/* Schéma de la carte (toile)                                            */
/* ------------------------------------------------------------------ */

/** Le schéma lu par la toile : nœuds (icônes résolues par la table de L1 ; photo de personnes jamais reprise), liens, groupes, chiffres. */
export function schemaDeLaCarte(carte: CarteImage): SchemaEntree {
  const noeuds = carte.noeuds
    .filter((n) => !n.photoPersonnes)
    .map((n) => {
      const icone = n.icone ? iconeDe(n.icone) : null;
      return { id: n.id, libelle: n.libelle, ...(n.detail ? { detail: n.detail } : {}), role: n.role, couleur: n.couleur, ordre: n.ordre, ...(n.groupe ? { groupe: n.groupe } : {}), ...(icone ? { icone } : {}) };
    });
  const ids = new Set(noeuds.map((n) => n.id));
  return {
    noeuds,
    liens: carte.liens
      .filter((l) => ids.has(l.de) && ids.has(l.vers))
      .map((l) => ({ id: l.id, de: l.de, vers: l.vers, couleur: l.couleur, style: l.style, ...(l.part !== undefined ? { part: l.part } : {}), ...(l.etiquette ? { etiquette: l.etiquette } : {}) })),
    groupes: carte.groupes.map((g) => ({ id: g.id, sorte: g.sorte, noeuds: g.noeuds.filter((x) => ids.has(x)), ...(g.titre ? { titre: g.titre } : {}), ...(g.majoritaire ? { majoritaire: true } : {}) })).filter((g) => g.noeuds.length > 0),
    chiffres: carte.chiffres.map((c) => ({ brut: c.brut, aDire: c.aDire, ...(c.dansNoeud ? { dansNoeud: c.dansNoeud } : {}) })),
  };
}

/* ------------------------------------------------------------------ */
/* Sortes de scène                                                       */
/* ------------------------------------------------------------------ */

const SCENES_EMOTION = new Set<string>(["accroche", "chiffre", "titre"]);
const SCENES_TOILE = new Set<string>(["toile", "embranchement"]);
const SCENES_OBJETS = new Set<string>(["entonnoir", "nuee", "ecran-partage", "additionneur"]);
const SCENES_BENEFICES = new Set<string>(["carte-benefice", "micro-objet"]);
/** Moments qui portent eux-mêmes leurs textes (aucun en-tête de relance). */
const SANS_ENTETE = new Set<string>(["bandeau-chiffres", "phrase-choc", "carte-benefice", "micro-objet"]);

function sorteDe(scene: string, partie: Partie, refs: readonly string[], carte: CarteImage): SortePlanIV {
  if (SCENES_EMOTION.has(scene)) return "emotion";
  if (SCENES_TOILE.has(scene)) return "toile";
  if (SCENES_OBJETS.has(scene)) return "objets";
  if (scene === "carte-benefice" && refs.filter((r) => carte.noeuds.some((n) => n.id === r && n.role === "benefice")).length > 1) return "recap";
  // Écran « Ensemble » : vue d'ensemble au début, puis la toile (explication) ou ses textes (écran v4).
  if (scene === "ensemble") return partie === "explication" ? "toile" : "emotion";
  return "moment";
}

/* ------------------------------------------------------------------ */
/* La mise en scène                                                      */
/* ------------------------------------------------------------------ */

interface EcranPlace {
  c: Ctx;
  sorte: SortePlanIV;
  els: El[];
  /** Ensemble ou récapitulatif posé au début de l'écran (insertion). */
  insertion?: { debut: number; fin: number; sorte: "ensemble" | "recap"; chiffresCles: string[]; allumes: string[] };
  /** Instants où le fond bascule (sombre ↔ ivoire) dans l'écran : relance du rythme par un VRAI changement (écran v4). */
  bascules?: number[];
  /** Vues d'ensemble posées au milieu d'une toile : relance du rythme par un VRAI changement de scène (≤ 1,5 s). */
  relances?: { debut: number; fin: number; allumes: string[] }[];
}

/**
 * 17/10 (prod, carte « chatbot support client ») : « micro-objet » est permis à Claude sur toute carte
 * (`SCENES_COMMUNES`), mais un écran de bénéfice ne dessine qu'un bloc « bénéfice ». Celui qui n'en cite aucun (et cite
 * des blocs) est mis en scène sur la toile : sinon ses blocs n'apparaissent jamais (Q12), son chiffre dit n'est pas
 * montré (Q13) et rien ne bouge pendant qu'il est dit (Q14).
 * 25/10 (prod, carte « chatbot ») : même trou pour « dossiers », « sources » et « recherche » qui ne citent AUCUN bloc de la
 * carte : ils ne posent rien qui compte comme nouveauté (leurs en-têtes de remplissage ne comptent pas), d'où 6 s sans rien
 * de neuf (Q14). Ils passent en texte seul (« titre »), qui pose ses lignes l'une après l'autre. Les autres moments (email,
 * alerte...) relancent eux-mêmes le rythme et gardent leurs liens cités : ils ne sont pas touchés.
 */
const MOMENTS_SANS_RELANCE = new Set<string>(["dossiers", "sources", "recherche"]);

export function ficheMiseEnScene(fiche: FicheImage, carte: CarteImage): FicheImage {
  const sansBenefice = (e: EcranFiche) => {
    const noeuds = e.refs.map((r) => carte.noeuds.find((n) => n.id === r)).filter((n): n is NoeudCarte => !!n && !n.photoPersonnes);
    return SCENES_BENEFICES.has(e.scene) && noeuds.length > 0 && !noeuds.some((n) => n.role === "benefice");
  };
  // 25/10 (v-b54bb4798246) : une scène « micro-objet » / « carte-bénéfice » sans bloc cité mais avec du texte d'écran restait vide 5,3 s.
  const momentVide = (e: EcranFiche) =>
    (MOMENTS_SANS_RELANCE.has(e.scene) || SCENES_BENEFICES.has(e.scene)) && e.textesEcran.length > 0 && !e.refs.some((r) => carte.noeuds.some((n) => n.id === r && !n.photoPersonnes));
  // R5 : un calcul faux ne finit jamais en « additionneur », un entonnoir qui croît jamais en « entonnoir » (retombent sur la toile).
  const gardee = (e: EcranFiche): EcranFiche["scene"] => sceneApresGarde(e.scene, carte, [e.texteDit, ...e.textesEcran]);
  const aGarder = (e: EcranFiche) => gardee(e) !== e.scene;
  if (!fiche.ecrans.some((e) => sansBenefice(e) || momentVide(e) || aGarder(e))) return fiche;
  return { ...fiche, ecrans: fiche.ecrans.map((e) => (aGarder(e) ? { ...e, scene: gardee(e) } : sansBenefice(e) ? { ...e, scene: "toile" as const } : momentVide(e) ? { ...e, scene: "titre" as const } : e)) };
}

/** Met en scène une version. Rend toujours la ligne de temps et le rapport des contrôles (`ok` = aucun bloquant). */
export function mettreEnSceneIV(entree: EntreeMiseEnSceneIV): ResultatMiseEnSceneIV {
  const { carte } = entree;
  const fiche = ficheMiseEnScene(entree.fiche, carte);
  const fin = entree.fin && !entree.fin.muet ? entree.fin : null;
  const calage = calerFiche(fiche, entree.voix, fin);
  const finVoix = Math.max(entree.voix.finVoixSec, calage.voix.at(-1)?.finSec ?? 0);
  const dureeSec = Math.ceil(Math.max(finVoix + R.queue, entree.voix.dureeSec) * R.fps) / R.fps;
  const clesCarte = clesDeLaCarte(carte);
  const toutesCles = new Set(clesCarte.values());
  const parId = new Map(carte.noeuds.map((n) => [n.id, n]));

  // 1. Bornes des écrans du corps.
  const debutFin = fin && calage.fin.length ? Math.max(0, arrondi(calage.fin[0].debutSec - R.avance)) : dureeSec;
  const debuts = calage.ecrans.map((x, i) => (i === 0 ? 0 : Math.max(0, arrondi((x.mots[0]?.debutSec ?? 0) - R.avance))));
  const ctxs = fiche.ecrans.map((e, i) => contexte(e, calage.ecrans[i].mots, debuts[i], i + 1 < debuts.length ? debuts[i + 1] : debutFin));

  // 2. Éléments de chaque écran.
  const microDedie = new Set(fiche.ecrans.filter((e) => e.scene === "micro-objet").flatMap((e) => e.refs));
  const etat: EtatScene = { montres: new Set(), cartes: [], microDedie };
  const places: EcranPlace[] = ctxs.map((c) => ({ c, sorte: sorteDe(c.e.scene, c.e.partie, c.e.refs, carte), els: elementsDe(c, carte, parId, clesCarte, toutesCles, etat) }));
  objetsEnSerie(places, carte);
  // Filet par construction (Q12) : un écran qui cite un bloc qu'aucun écran ne DESSINE repasse sur la toile.
  const aToile = ecransADessiner(places, parId);
  if (aToile.size) return mettreEnSceneIV({ ...entree, fiche: { ...fiche, ecrans: fiche.ecrans.map((e) => (aToile.has(e.id) ? { ...e, scene: "toile" as const } : e)) } });

  // 3. Insertions : « Ensemble » aux ouvertures de chapitre et après les branches ; récapitulatif des bénéfices.
  inserer(places, carte, fiche, clesCarte);

  // 4. Comblement du rythme : les mots dits et pas encore écrits deviennent une ligne (ou relancent l'en-tête).
  for (const p of places) combler(p, toutesCles);
  for (const p of places) repartirEcran(p);

  // 5. Segment de fin.
  const finEls: El[] = [];
  const finPlans: PlanIV[] = [];
  if (fin) segmentFin(fin, fiche, calage, debutFin, dureeSec, finEls, finPlans);

  // 6-8. Plans, blocs de rendu (toile, objets, moments, écrans v4), événements (L4). Un trou de plus de 2,4 s sans
  // changement qui COMPTE (un texte de comblement ou un en-tête ne compte pas) est relancé par un vrai changement : le
  // fond d'un écran v4 (corps ou segment de fin) bascule, ou une vue d'ensemble s'ouvre sur la toile ; puis tout est
  // recalculé.
  let plans: PlanIV[] = [];
  let blocs: BlocRenduIV[] = [];
  let evenements: EvenementTempsIV[] = [];
  let replis: RepliVarieteIV[] = [];
  const format = entree.format ?? "9:16";
  const chiffresDitsDesEcrans = () => ctxs.flatMap((c) => c.chiffres.filter((x) => toutesCles.has(x.cle)).map((x) => ({ cle: x.cle, brut: x.brut, t: arrondi(heureDite(c, x.rang)), ecran: c.e.id })));
  for (let tour = 0; tour <= 40; tour++) {
    plans = construirePlans(places, carte, dureeSec, debutFin, finPlans);
    const caches = new Set<string>();
    blocs = construireBlocs(places, plans, carte, dureeSec, debutFin, finPlans, finEls, caches, format);
    if (entree.variete) {
      ({ blocs, replis } = appliquerVarieteIV({ blocs, plans, recette: entree.variete, format, carte, fiche, chiffresDits: chiffresDitsDesEcrans(), reseaux: entree.reseaux, replis: [], mots: calage.voix }));
    }
    evenements = construireEvenements(places, finEls, plans, blocs, finVoix, caches);
    if (!relancerRythme(places, finPlans, finEls, plans, evenements, finVoix)) break;
  }

  // 9. Repère de progression.
  const repere = construireRepere(places, fiche, carte);

  // 10. Sous-titres mot à mot, mot fort orange.
  const forts: MotFort[] = plans.flatMap((p) => p.textes.flatMap((t) => [...t.matchAll(/\*([^*]+)\*/g)].map((m) => ({ debutSec: p.debut, finSec: p.fin, mot: m[1] }))));
  const sousTitres = sousTitresIV(calage.voix, { reseaux: entree.reseaux, motsForts: forts, ...(format === "4:5" ? { format } : {}) });

  // 11. Bruitages (L4).
  const poses = poserBruitagesIV({ evenements, dureeSec, valides: entree.bruitagesValides, ...(entree.graine !== undefined ? { graine: entree.graine } : {}) });

  const chiffresDits = chiffresDitsDesEcrans();
  // 12. Queue de fin : du dernier mot des sous-titres (ce qui « parle » pour l'image figée) à la fin de la vidéo.
  const queue = queueDeFinIV(Math.max(0, ...sousTitres.groupes.flatMap((g) => g.mots.map((m) => m.finSec))), dureeSec);
  const affiche = afficheIV(carte, fiche);
  const ligne: LigneDeTempsIV = {
    version: entree.fin?.id ?? "corps",
    reseaux: [...entree.reseaux],
    largeur: CADRES_IV[format].largeur,
    hauteur: CADRES_IV[format].hauteur,
    fps: R.fps,
    dureeSec: arrondi(dureeSec),
    finVoixSec: arrondi(finVoix),
    plans,
    evenements,
    blocs,
    sousTitres,
    repere,
    bruitages: poses.ok ? poses.bruitages : [],
    segmentFin: { debut: debutFin, question: !!fin?.question, muet: !fin },
    chiffresDits,
    partCalee: calage.partCalee,
    ...(entree.variete ? { variete: { recette: entree.variete, format, replis } } : {}),
    ...(queue ? { queue } : {}),
    ...(affiche ? { affiche } : {}),
  };
  const rapport = controlerMiseEnSceneIV(ligne, { carte, fiche, reseaux: entree.reseaux, bruitages: poses, voix: calage.voix });
  return { ok: rapport.bloquants.length === 0, ligne, rapport, phrases: rapport.bloquants.map((b) => b.phrase) };
}

/* ------------------------------------------------------------------ */
/* 2. Éléments d'un écran                                                */
/* ------------------------------------------------------------------ */

interface EtatScene {
  /** Nœuds déjà posés à l'écran (une seconde mention ne fait que guider la caméra). */
  montres: Set<string>;
  /** Cartes de bénéfice déjà posées (ordre). */
  cartes: string[];
  /** Cartes dont le micro-objet a son propre écran dans la fiche. */
  microDedie: Set<string>;
  /** Heure du dernier minuteur posé dans un additionneur (le total non dit se pose entre lui et le détail). */
  dernierTerme?: number;
}

function nouvelEl(c: Ctx, role: RoleEl, genre: GenreEvenement, t: number, extra: Partial<El> = {}): El {
  return { id: `${c.e.id}-${role}-${extra.ref ?? ""}${Math.round(t * 1000)}`, role, genre, t: arrondi(t), ecran: c.e.id, chiffres: [], visible: role !== "mention", ...(role === "entete" ? { remplissage: true } : {}), ...extra };
}

/** Chiffres que montre un nœud (ses textes et les chiffres de la carte qu'il porte). */
function clesDuNoeud(n: NoeudCarte, carte: CarteImage, clesCarte: Map<string, string>): string[] {
  const c = new Set([...clesDuTexte(n.libelle), ...(n.detail ? clesDuTexte(n.detail) : [])]);
  for (const ch of carte.chiffres) if (ch.dansNoeud === n.id) c.add(clesCarte.get(ch.id)!);
  return [...c];
}

/** Un texte d'écran posé : ses parties (« A · B ») révélées chacune sur le mot qui la dit quand elles sont espacées. */
interface TextePose {
  t: number;
  texte: string;
  chiffres: string[];
  couverts: number[];
}

/** Heure et mots couverts d'un texte d'écran : sur son chiffre dit, sinon là où la voix le dit, sinon sur le mot orange. */
function poserTexte(c: Ctx, texte: string, toutesCles: Set<string>, apres = 0): TextePose {
  const cles = clesDuTexte(texte);
  const ch = chiffreDit(c, cles.filter((k) => toutesCles.has(k)));
  const a = ancrage(c, texte, apres);
  const couverts = [...(a?.couverts ?? []), ...(ch ? Array.from({ length: ch.dernier - ch.rang + 1 }, (_, i) => ch.rang + i) : [])];
  let rang: number;
  if (ch) rang = ch.rang;
  else if (a?.fort) rang = a.de;
  else if (texte.includes("*")) rang = rangOrange(c);
  else rang = 0;
  return { t: heureMot(c, rang), texte, chiffres: cles, couverts: [...new Set(couverts)].sort((x, y) => x - y) };
}

/** Parties d'un texte « A · B · C » révélées l'une après l'autre (au moins 0,6 s d'écart), sinon le texte entier. */
function partiesDe(c: Ctx, texte: string, toutesCles: Set<string>): TextePose[] {
  const morceaux = texte.split(/\s+·\s+/);
  const entier = poserTexte(c, texte, toutesCles);
  if (morceaux.length < 2) return [entier];
  const poses = morceaux.map((m) => poserTexte(c, m, toutesCles));
  // Un morceau que rien ne nomme apparaît avec le précédent.
  for (let k = 1; k < poses.length; k++) if (!poses[k].couverts.length) poses[k].t = poses[k - 1].t;
  const espacees = poses.every((p, k) => k === 0 || p.t - poses[k - 1].t >= R.ecartMin - 1e-9 || p.t === poses[k - 1].t);
  const croissantes = poses.every((p, k) => k === 0 || p.t >= poses[k - 1].t);
  if (!espacees || !croissantes || poses.every((p) => p.t === poses[0].t)) return [entier];
  // Révélation cumulée : chaque étape montre les morceaux déjà dits.
  const res: TextePose[] = [];
  poses.forEach((p, k) => {
    const cumul = morceaux.slice(0, k + 1).join(" · ");
    if (res.length && res[res.length - 1].t === p.t) res[res.length - 1] = { ...p, texte: cumul, chiffres: clesDuTexte(cumul), couverts: [...res[res.length - 1].couverts, ...p.couverts] };
    else res.push({ ...p, texte: cumul, chiffres: clesDuTexte(cumul), couverts: [...(res.at(-1)?.couverts ?? []), ...p.couverts] });
  });
  return res;
}

/**
 * Nœud de la carte qu'un texte nomme parmi les références de l'écran. Un texte qui ne nomme aucun bloc n'en montre
 * aucun (règle d'or : rien de compté qui ne soit dessiné) ; un bloc cité que rien ne montre passe sur la toile (filet).
 */
function refDuTexte(texte: string, refs: readonly NoeudCarte[]): string | undefined {
  const t = formes(texte).filter(plein);
  return refs.find((n) => formes(`${n.libelle} ${n.detail ?? ""}`).some((f) => t.some((x) => correspond(f, x))))?.id;
}

function elementsDe(c: Ctx, carte: CarteImage, parId: Map<string, NoeudCarte>, clesCarte: Map<string, string>, toutesCles: Set<string>, etat: EtatScene): El[] {
  const e = c.e;
  const els: El[] = [];
  const sorte = sorteDe(e.scene, e.partie, e.refs, carte);
  const dits = c.chiffres.filter((x) => toutesCles.has(x.cle));
  const noeudsRefs = e.refs.map((r) => parId.get(r)).filter((n): n is NoeudCarte => !!n && !n.photoPersonnes);

  if (sorte === "emotion") {
    e.textesEcran.forEach((ligne, i) => {
      // Chaque étape d'une ligne révélée montre le bloc que nomme son dernier morceau (« CRM ✓ · *Compta* ✓ »).
      for (const p of partiesDe(c, ligne, toutesCles)) {
        const ref = refDuTexte(p.texte.split(/\s+·\s+/).at(-1)!, noeudsRefs) ?? refDuTexte(p.texte, noeudsRefs);
        els.push(nouvelEl(c, "ligne", p.chiffres.some((k) => toutesCles.has(k)) ? "chiffre" : "objet", p.t, { texte: p.texte, chiffres: p.chiffres, couverts: p.couverts, groupe: `${e.id}-l${i}`, ...(ref ? { ref } : {}) }));
      }
    });
    return trier(els);
  }

  if (sorte === "toile") elementsToile(c, carte, parId, noeudsRefs, clesCarte, dits, etat, els);
  else if (sorte === "objets") els.push(...elementsObjets(c, carte, noeudsRefs, clesCarte, dits, etat));
  else if (sorte === "recap") {
    const ids = noeudsRefs.filter((n) => n.role === "benefice");
    els.push(nouvelEl(c, "recap", "objet", c.debut, { texte: ids.map((n) => n.libelle).join(" · "), ref: ids[0]?.id }));
  } else els.push(...elementsMomentAvecRappel(c, carte, noeudsRefs, clesCarte, dits, etat));

  // En-têtes (toile, objets, moments) : l'étiquette et le titre de la fiche. Au début de l'écran, sauf si son chiffre
  // dit n'est montré par rien d'autre sur son mot (il apparaît alors avec lui, Q13).
  if (!SANS_ENTETE.has(e.scene) && sorte !== "recap" && e.textesEcran.length) enTetes(c, carte, toutesCles, els);
  return trier(els);
}

/**
 * Étiquette tirée d'une ligne « X · Y » : seulement X. L'étiquette est une ligne d'interlettrage large qui ne tient pas sur
 * une ligne avec la paire entière : elle passait à la ligne et recouvrait le titre (« OUI · Autoliquidation » sur « VALIDÉ … »).
 * Y reste dit et montré par le bloc qu'il nomme.
 */
function etiquetteDePaire(texte: string): string {
  return sansBalises(texte.split(/\s+·\s+/)[0]!);
}

function enTetes(c: Ctx, carte: CarteImage, toutesCles: Set<string>, els: El[]): void {
  const lignes = c.e.textesEcran;
  const titre = lignes.find((t) => t.includes("*")) ?? lignes[0];
  const autre = lignes.find((t) => t !== titre);
  // Étiquette : « Situation type » / « Exemple » s'ils sont écrits, sinon le groupe du bloc montré (branche, avant,
  // après…), sinon le titre de l'image.
  const groupe = c.e.refs.map((r) => carte.noeuds.find((n) => n.id === r)?.groupe).find((g) => g);
  const titreGroupe = carte.groupes.find((g) => g.id === groupe)?.titre;
  const etiquette = autre && /situation type|exemple/i.test(autre) ? sansBalises(autre) : (titreGroupe ?? etiquetteDeRepli(carte, c.e.scene));
  const parties = partiesDe(c, titre, toutesCles);
  const montreAilleurs = (k: string) => {
    const d = c.chiffres.find((x) => x.cle === k);
    return !d || els.some((x) => x.chiffres.includes(k) && Math.abs(x.t - heureMot(c, d.rang)) <= R.chiffreApres - 0.05);
  };
  parties.forEach((p, k) => {
    const doitAttendre = p.chiffres.some((x) => toutesCles.has(x) && !montreAilleurs(x));
    const t = k === 0 && !doitAttendre ? c.debut : p.t;
    els.push(nouvelEl(c, "entete", p.chiffres.some((x) => toutesCles.has(x)) ? "chiffre" : "objet", t, { texte: `${etiquette}|${p.texte}`, chiffres: p.chiffres, couverts: p.couverts, coupe: k > 0 }));
  });
  // Seconde ligne (hors « Situation type ») nommée plus tard : elle relance l'en-tête.
  if (autre && !/situation type|exemple/i.test(autre)) {
    const p = poserTexte(c, autre, toutesCles);
    const dernier = els.filter((x) => x.role === "entete").at(-1)!;
    // 25/10 (v-b54bb4798246) : une ligne qui porte un chiffre de la carte dit plus tard (« J+30 ») ne se replie plus en étiquette SANS ses chiffres : elle se pose en en-tête sur son mot.
    const aMontrer = p.couverts.length > 0 && p.chiffres.some((x) => toutesCles.has(x) && !montreAilleurs(x));
    if (p.couverts.length && p.t - dernier.t >= 1.2) els.push(nouvelEl(c, "entete", p.chiffres.length ? "chiffre" : "objet", p.t, { texte: `${etiquette}|${autre}`, chiffres: p.chiffres, couverts: p.couverts, coupe: true }));
    else if (aMontrer) {
      const avant = els.some((x) => x.role === "entete" && x.t < p.t - 1e-9);
      if (!avant) for (const x of els) if (x.role === "entete") x.coupe = true;
      // 25/10 (zéro blocage) : l'en-tête précédent reste lisible au moins 0,6 s (l'idéal est 1,2 s, mais le chiffre doit rester montré dans la fenêtre de Q13) :
      // on pose le nouveau à max(son mot, dernier + 0,6), sans sortir de la fenêtre de Q13 de ses chiffres à montrer ; si elle est déjà dépassée, il reste sur son mot.
      const fenetre = Math.min(...p.chiffres.filter((x) => toutesCles.has(x) && !montreAilleurs(x)).map((x) => { const d = c.chiffres.find((y) => y.cle === x); return d ? heureMot(c, d.rang) + R.chiffreApres - 0.05 : Infinity; }));
      const tPose = Math.max(p.t, Math.min(arrondi(dernier.t + 0.6), fenetre));
      els.push(nouvelEl(c, "entete", "chiffre", tPose, { texte: `${etiquette}|${autre}`, chiffres: p.chiffres, couverts: p.couverts, coupe: avant }));
    }
    // 25/10 : la seconde ligne ne passe en étiquette que si elle PRÉCÈDE le titre ; après lui, « 20 % — Limite atteinte » au-dessus de
    // « 80 % — Réponse connue » se contredisait.
    // Après le titre, nommée trop tôt pour relancer, sans chiffre à montrer sur son mot : elle relance l'en-tête 1,2 s après le dernier, s'il reste de la place avant la fin de l'écran.
    else if (lignes.indexOf(autre) > lignes.indexOf(titre)) {
      if (p.couverts.length && !p.chiffres.length && dernier.t + 1.2 < c.fin - 0.3) els.push(nouvelEl(c, "entete", "objet", arrondi(dernier.t + 1.2), { texte: `${etiquette}|${autre}`, chiffres: [], couverts: p.couverts, coupe: true }));
    } else dernier.texte = `${etiquetteDePaire(autre)}|${dernier.texte!.split("|")[1]}`;
  }
}

function elementsToile(c: Ctx, carte: CarteImage, parId: Map<string, NoeudCarte>, noeudsRefs: NoeudCarte[], clesCarte: Map<string, string>, dits: Ctx["chiffres"], etat: EtatScene, els: El[]): void {
  const e = c.e;
  // Séparation : à l'annonce (« deux chemins »), sinon au mot orange ; les parts des flèches apparaissent avec elle.
  const decision = noeudsRefs.find((n) => n.role === "decision") ?? (e.scene === "embranchement" ? carte.noeuds.find((n) => n.role === "decision") : undefined);
  if (decision && e.scene === "embranchement" && !etat.montres.has(`sep-${decision.id}`)) {
    etat.montres.add(`sep-${decision.id}`);
    const kAnnonce = c.ecrits.findIndex((m) => /^(deux|trois|quatre|chemins?|voies?)[.,!?:;…]*$/iu.test(m));
    const k = kAnnonce >= 0 ? kAnnonce : rangOrange(c);
    const parts = carte.liens.filter((l) => l.de === decision.id && typeof l.part === "number" && l.part > 0).map((l) => `${l.part}|%`);
    if (!etat.montres.has(decision.id)) {
      etat.montres.add(decision.id);
      const kd = rangQuiNomme(c, decision.libelle) ?? 0;
      els.push(nouvelEl(c, "noeud", "noeud", heureMot(c, Math.min(kd, Math.max(0, k - 1))), { ref: decision.id, texte: decision.libelle, chiffres: clesDuNoeud(decision, carte, clesCarte) }));
    }
    els.push(nouvelEl(c, "separation", "separation", heureMot(c, k) + 0.15, { ref: decision.id, chiffres: parts }));
  }
  const pris = new Set<number>();
  const sansAncre: NoeudCarte[] = [];
  for (const n of noeudsRefs) {
    if (els.some((x) => x.ref === n.id)) continue;
    if (etat.montres.has(n.id)) {
      // Déjà posé : la caméra y revient au mot qui le nomme (à défaut, au mot 0).
      const k = rangQuiNomme(c, n.libelle);
      // Grands vides (issue 119) : cité mais jamais nommé, il reçoit quand même sa mention au mot 0 (la caméra a une trajectoire).
      els.push(nouvelEl(c, "mention", "noeud", heureMot(c, k ?? 0), { ref: n.id, visible: false }));
      continue;
    }
    const cles = clesDuNoeud(n, carte, clesCarte);
    const ch = chiffreDit(c, cles);
    // Au premier mot qui le nomme (son nom, ou son chiffre) ; un chiffre dit après claque sur son mot (accent).
    const nomme = rangQuiNomme(c, n.libelle);
    const k = nomme !== null && ch ? Math.min(nomme, ch.rang) : (nomme ?? ch?.rang ?? null);
    if (k === null) {
      sansAncre.push(n);
      continue;
    }
    pris.add(k);
    etat.montres.add(n.id);
    els.push(nouvelEl(c, "noeud", "noeud", heureMot(c, k), { ref: n.id, texte: n.libelle, chiffres: cles }));
  }
  // Nœuds que rien ne nomme : posés au mot qui coupe le plus grand trou de l'écran.
  for (const n of sansAncre) {
    const cible = trouCentral(els.filter((x) => x.visible).map((x) => x.t), c.debut, c.fin);
    const k = motVers(c, cible, c.debut, c.fin - 0.3, pris) ?? 0;
    pris.add(k);
    etat.montres.add(n.id);
    els.push(nouvelEl(c, "noeud", "noeud", heureMot(c, k), { ref: n.id, texte: n.libelle, chiffres: clesDuNoeud(n, carte, clesCarte) }));
  }
  // Coches : un nœud « fait » (icône coche, « ✓ ») se coche sur le mot qui le dit fait, sinon 0,6 s après lui.
  for (const x of els.filter((y) => y.role === "noeud")) {
    const n = parId.get(x.ref!)!;
    // Bloc « fait » : icône coche, « ✓ », ou libellé qui le dit fait (clôturé, résolu, validé, terminé).
    if (!(n.icone && iconeDe(n.icone) === "coche") && !/✓|cl[oô]tur|r[ée]solu|valid[ée]|termin[ée]/iu.test(`${n.libelle} ${n.detail ?? ""}`)) continue;
    const kf = c.ecrits.findIndex((m, k) => heureMot(c, k) >= x.t + 0.2 && /^(fait|faite|ferm|clotur|clôtur|résol|resol|trouv|régl|regl)/iu.test(m));
    const t = kf >= 0 ? heureMot(c, kf) + 0.1 : x.t + 0.6;
    if (t < c.fin - 0.05) els.push(nouvelEl(c, "coche", "coche", t, { ref: n.id }));
  }
  // Chiffre dit porté par un nœud déjà posé : il claque sur son mot (accent).
  for (const d of dits) {
    if (els.some((x) => x.chiffres.includes(d.cle) && Math.abs(x.t - heureMot(c, d.rang)) <= R.chiffreApres - 0.05)) continue;
    const porteur = carte.chiffres.find((ch) => clesCarte.get(ch.id) === d.cle && ch.dansNoeud && etat.montres.has(ch.dansNoeud));
    if (porteur) els.push(nouvelEl(c, "accent", "chiffre", heureMot(c, d.rang), { ref: porteur.dansNoeud, texte: porteur.brut, chiffres: [d.cle] }));
  }
}

/** Heure au milieu du plus grand trou d'une suite d'instants dans [debut, fin]. */
function trouCentral(ts: readonly number[], debut: number, fin: number): number {
  const pts = [debut, ...ts.filter((t) => t > debut && t < fin), fin].sort((a, b) => a - b);
  let meilleur = { a: debut, b: fin };
  for (let i = 1; i < pts.length; i++) if (pts[i] - pts[i - 1] > meilleur.b - meilleur.a) meilleur = { a: pts[i - 1], b: pts[i] };
  return (meilleur.a + meilleur.b) / 2;
}

const trier = (els: El[]) => els.sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));

/** Source en nombre (20 e-mails) et sorties chiffrées d'une image « entonnoir ». */
const sourceEnNombre = (carte: CarteImage) => carte.noeuds.find((n) => (n.quantite ?? 0) >= 2 && (n.role === "declencheur" || n.role === "source"));
const sortiesEnNombre = (carte: CarteImage) => carte.noeuds.filter((n) => n.role === "sortie" && (n.quantite ?? 0) > 0).sort((x, y) => (y.quantite ?? 0) - (x.quantite ?? 0) || x.id.localeCompare(y.id));

/** Objets de L8 : entonnoir, nuée, écran partagé, additionneur. */
function elementsObjets(c: Ctx, carte: CarteImage, refs: NoeudCarte[], clesCarte: Map<string, string>, dits: Ctx["chiffres"], etat: EtatScene): El[] {
  const e = c.e;
  const els: El[] = [];
  const poser = (n: NoeudCarte, role: RoleEl, genre: GenreEvenement, repli: number) => {
    const cles = clesDuNoeud(n, carte, clesCarte);
    const k = chiffreDit(c, cles)?.rang ?? rangQuiNomme(c, n.libelle) ?? repli;
    etat.montres.add(n.id);
    els.push(nouvelEl(c, role, genre, heureMot(c, k), { ref: n.id, texte: n.libelle, chiffres: cles }));
  };
  if (e.scene === "entonnoir" || e.scene === "nuee") {
    // La source, le moteur et les sorties SONT l'objet : l'objet s'anime sur leur mot (la nuée apparaît, les chutes
    // partent, les coches tombent, les objets « pour vous » se distinguent : `objetsEnSerie`, `blocObjets`). Le moteur
    // et les sorties sont les étiquettes fixes de l'entonnoir : posés (Q12), ils n'y sont pas un changement de plus. Un
    // autre bloc cité (le moteur dans la nuée…) n'y est pas dessiné (filet : l'écran passe sur la toile).
    const moteur = carte.noeuds.find((n) => n.role === "moteur")?.id;
    const sorties = sortiesEnNombre(carte).map((n) => n.id);
    const portes = new Set(e.scene === "entonnoir" ? [sourceEnNombre(carte)?.id, moteur, ...sorties] : [sourceEnNombre(carte)?.id, ...sorties]);
    const fixes = new Set(e.scene === "entonnoir" ? [moteur, ...sorties] : []);
    for (const n of refs) if (!etat.montres.has(n.id)) poser(n, portes.has(n.id) ? "porte" : "objet", "objet", rangOrange(c));
    for (const x of els) if (x.role === "porte" && fixes.has(x.ref)) x.visible = false;
    for (const d of dits) if (!els.some((x) => x.chiffres.includes(d.cle))) els.push(nouvelEl(c, "accent", "chiffre", heureMot(c, d.rang), { texte: d.brut, chiffres: [d.cle] }));
    return els;
  }
  if (e.scene === "ecran-partage") {
    const kB = c.ecrits.findIndex((m) => /^(apr[eè]s|maintenant)/iu.test(m));
    if (kB > 0) els.push(nouvelEl(c, "bascule", "fond", heureMot(c, kB), { texte: "après" }));
    for (const d of dits) {
      const porteur = carte.chiffres.find((ch) => clesCarte.get(ch.id) === d.cle && ch.dansNoeud);
      if (porteur?.dansNoeud) etat.montres.add(porteur.dansNoeud);
      els.push(nouvelEl(c, "chiffre", "chiffre", heureMot(c, d.rang), { ref: porteur?.dansNoeud, texte: d.brut, chiffres: [d.cle] }));
    }
    return els;
  }
  // Additionneur : un minuteur par nœud chiffré, sur le mot de son chiffre ; le total sur le nœud résultat.
  for (const n of refs) {
    const cles = clesDuNoeud(n, carte, clesCarte);
    const ch = chiffreDit(c, cles);
    etat.montres.add(n.id);
    if (n.role === "resultat") {
      // Détail du résultat lu sur la carte (« risque erreur : élevé ») : son libellé sur le mot qui le nomme, sa valeur
      // (après les deux-points) sur le sien. Deux apparitions nouvelles dans l'additionneur. Un total que la voix ne dit
      // pas se pose à mi-chemin entre le dernier minuteur et le détail (répartition du rythme, Q14).
      const [libelle, valeur] = (n.detail ?? "").split(/\s*:\s*/u).map((x) => x.trim());
      const kNomme = libelle ? rangQuiNomme(c, libelle) : null;
      const avant = etat.dernierTerme ?? c.debut;
      // Total non dit : le mot qui coupe au mieux l'écart entre le dernier minuteur et le détail (le plus grand des deux
      // trous le plus petit) ; sans détail, 1,2 s après le début de l'écran.
      const auMieux = (kD: number) =>
        c.mots
          .map((_, k) => k)
          .filter((k) => heureMot(c, k) >= c.debut + R.ecartMin - 1e-9 && k < kD)
          .sort((x, y) => Math.max(heureMot(c, x) - avant, heureMot(c, kD) - heureMot(c, x)) - Math.max(heureMot(c, y) - avant, heureMot(c, kD) - heureMot(c, y)) || x - y)[0];
      const kTotal = ch?.rang ?? (kNomme !== null ? auMieux(kNomme) : undefined) ?? motVers(c, c.debut + 1.2, c.debut + R.ecartMin, c.fin - 0.3) ?? 0;
      const t = heureMot(c, kTotal);
      els.push(nouvelEl(c, "total", "chiffre", t, { ref: n.id, texte: n.libelle, chiffres: cles }));
      if (libelle) {
        const kL = rangQuiNomme(c, libelle, kTotal + 1) ?? motVers(c, t + R.ecartMin + 0.6, t + R.ecartMin, c.fin - 0.3);
        if (kL !== null && heureMot(c, kL) > t + 1e-6) {
          const tL = heureMot(c, kL);
          els.push(nouvelEl(c, "detail", "objet", tL, { ref: n.id, texte: libelle, chiffres: clesDuTexte(libelle) }));
          const kV = valeur ? (rangQuiNomme(c, valeur, kL + 1) ?? motVers(c, tL + R.ecartMin + 0.4, tL + R.ecartMin, c.fin - 0.3)) : null;
          if (valeur && kV !== null && heureMot(c, kV) > tL + 1e-6) els.push(nouvelEl(c, "valeur-detail", "objet", heureMot(c, kV), { ref: n.id, texte: valeur, chiffres: clesDuTexte(valeur) }));
        }
      }
      continue;
    }
    const k = ch?.rang ?? rangQuiNomme(c, n.libelle) ?? 0;
    etat.dernierTerme = heureMot(c, k);
    els.push(nouvelEl(c, cles.length ? "terme" : "objet", cles.length ? "chiffre" : "objet", heureMot(c, k), { ref: n.id, texte: n.libelle, chiffres: cles }));
  }
  return els;
}

/**
 * Objets en série (après les éléments) : les N objets qui tombent dans l'entonnoir, régulièrement, de la source à la
 * fin des écrans « entonnoir » ; les coches de la nuée en cascade (une par objet coché), depuis la sortie majoritaire.
 */
function objetsEnSerie(places: EcranPlace[], carte: CarteImage): void {
  // Chaque suite d'écrans de suite d'une scène est un objet (un écran d'une autre scène entre deux coupe la série).
  const series = (scene: string) => {
    const res: { idx: number[]; debut: number; fin: number }[] = [];
    places.forEach((p, i) => {
      if (p.c.e.scene !== scene) return;
      const der = res.at(-1);
      if (der && der.idx.at(-1) === i - 1) der.idx.push(i);
      else res.push({ idx: [i], debut: 0, fin: 0 });
    });
    for (const r of res) Object.assign(r, { debut: places[r.idx[0]].c.debut, fin: places[r.idx[r.idx.length - 1]].c.fin });
    return res;
  };
  const poserDans = (t: number, idx: number[], role: RoleEl, genre: GenreEvenement, n: number) => {
    const p = idx.map((i) => places[i]).find((q) => t >= q.c.debut - 1e-9 && t < q.c.fin) ?? places[idx[idx.length - 1]];
    p.els.push(nouvelEl(p.c, role, genre, t, { id: `${p.c.e.id}-${role}-${n}` } as Partial<El>));
    trier(p.els);
  };
  const source = sourceEnNombre(carte);
  for (const ent of series("entonnoir")) {
    if (!source?.quantite) break;
    const tSource = places[ent.idx[0]].els.find((x) => x.ref === source.id)?.t ?? ent.debut;
    const a = tSource + 0.1;
    const b = Math.max(a + 0.4, ent.fin - 0.8);
    for (let q = 0; q < source.quantite; q++) poserDans(arrondi(a + ((b - a) * q) / Math.max(1, source.quantite - 1)), ent.idx, "chute", "chute", q);
  }
  const majoritaire = sortiesEnNombre(carte)[0];
  for (const nuee of series("nuee")) {
    if (!majoritaire?.quantite) break;
    const t0 = nuee.idx.flatMap((i) => places[i].els).find((x) => x.ref === majoritaire.id)?.t ?? nuee.debut + 0.3;
    const a = t0 + 0.1;
    const b = Math.max(a, Math.min(nuee.fin - 0.4, t0 + 2.2));
    for (let q = 0; q < majoritaire.quantite; q++) poserDans(arrondi(a + ((b - a) * q) / Math.max(1, majoritaire.quantite - 1)), nuee.idx, "coche-nuee", "coche", q);
    // Les objets NON cochés (ceux « pour vous ») se distinguent ensuite un par un, régulièrement, de leur mot (la sortie
    // minoritaire nommée) ou de la dernière coche jusqu'à la fin de la nuée : de vrais changements visibles (Q14).
    const reste = Math.max(0, (source?.quantite ?? 0) - majoritaire.quantite);
    if (reste > 0) {
      const minoritaire = sortiesEnNombre(carte)[1];
      const tMin = minoritaire ? nuee.idx.flatMap((i) => places[i].els).find((x) => x.ref === minoritaire.id)?.t : undefined;
      // Sur le mot de la sortie minoritaire s'il tombe après les coches, sinon 0,5 s après la dernière.
      const c0 = tMin !== undefined && tMin >= b + 0.5 ? tMin : b + 0.5;
      const c1 = Math.max(c0, nuee.fin - 0.4);
      for (let q = 0; q < reste; q++) poserDans(arrondi(c0 + ((c1 - c0) * q) / Math.max(1, reste - 1)), nuee.idx, "distinction", "objet", q);
    }
  }
}

/** Nom de l'application et message affichés dans la notification : sans « Alerte » ni émoji (cloche comprise). */
export function sourceEtMessageAlerte(n: Pick<NoeudCarte, "libelle" | "detail"> | undefined): { source: string; message: string; messageDit: string } {
  const sansEmoji = (t: string) =>
    t
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
      // L'émoji retiré ne laisse pas d'espace contre un guillemet ou une parenthèse (les « » gardent leurs espaces françaises).
      .replace(/([“‘(\[])\s+/gu, "$1")
      .replace(/\s+([”’)\]])/gu, "$1")
      .replace(/\s{2,}/gu, (m) => (/[  ]/u.test(m) ? " " : " "));
  const source = sansEmoji(n?.libelle ?? "").replace(/^\s*alerte\s+/i, "").replace(/[:\s]+$/, "").trim() || "Alerte";
  const message = sansEmoji(n?.detail ?? n?.libelle ?? "").trim();
  // `messageDit` : le détail seul (vide si la carte n'en a pas) ; `message` retombe sur le libellé pour l'affichage.
  return { source, message, messageDit: sansEmoji(n?.detail ?? "").trim() };
}

/** Nœud qui EST l'alerte parmi les nœuds cités : celui dont le libellé nomme l'alerte, la notification, le message ; sinon le dernier cité. */
function noeudAlerte(refs: readonly NoeudCarte[]): NoeudCarte | undefined {
  const nomme = (re: RegExp) => refs.find((n) => formes(n.libelle).some((m) => re.test(m)));
  return nomme(/^(alertes?|notifications?|notifs?)$/) ?? nomme(/^(messages?|sms)$/) ?? refs.at(-1);
}

/**
 * Pose un nœud cité sur le mot qui le nomme (ou son chiffre dit, sinon le mot orange), dans le rôle que le composant de
 * l'écran dessine : un déclencheur de l'alerte, un champ de l'e-mail.
 */
function poserNoeud(c: Ctx, carte: CarteImage, clesCarte: Map<string, string>, etat: EtatScene, els: El[], n: NoeudCarte, role: "declencheur" | "champ"): void {
  if (etat.montres.has(n.id) || els.some((x) => x.ref === n.id)) return;
  const cles = clesDuNoeud(n, carte, clesCarte);
  const k = chiffreDit(c, cles)?.rang ?? rangQuiNomme(c, n.libelle) ?? rangOrange(c);
  etat.montres.add(n.id);
  els.push(nouvelEl(c, role, role === "champ" ? "frappe" : "objet", heureMot(c, k), { ref: n.id, texte: n.libelle, chiffres: cles, couverts: [k] }));
}

/** Plus long trou entre deux changements visibles d'un écran, de son début (ou `depuis`) à sa fin. */
function trouMoment(c: Ctx, els: readonly El[], depuis = c.debut): { a: number; b: number } {
  const pts = [depuis, ...els.filter((x) => x.visible).map((x) => x.t).filter((t) => t > depuis && t < c.fin), c.fin].sort((x, y) => x - y);
  let trou = { a: pts[0], b: pts[1] };
  for (let i = 2; i < pts.length; i++) if (pts[i] - pts[i - 1] > trou.b - trou.a) trou = { a: pts[i - 1], b: pts[i] };
  return trou;
}

/**
 * Tampon qui clôt un écran « email » ou « alerte » quand plus rien d'autre ne peut relancer son rythme : sa dernière
 * étape seule, ou les deux quand le trou est trop long pour une seule.
 */
const TAMPONS: Readonly<Record<"declencheur" | "champ", readonly string[]>> = { champ: ["Prêt", "Envoyé"], declencheur: ["Reçu", "Lu"] };

/**
 * Rythme d'un écran « email » ou « alerte » (un seul objet sur ~4 s), par construction : tant qu'un trou de plus de
 * 2,2 s sépare deux changements visibles de l'écran, le nœud d'un lien cité qui n'est pas encore posé arrive, DESSINÉ
 * par l'écran (un champ de plus dans l'e-mail, un déclencheur de plus sous l'alerte), au mot qui le nomme s'il tombe
 * dans le trou, sinon à son milieu. S'il reste un trou, un tampon dessiné le coupe : « Envoyé ✓ » dans l'en-tête de
 * l'e-mail, « Lu ✓ » sur la notification, au milieu du trou ; un trou de plus de 4,4 s en prend deux étapes à intervalles
 * égaux (« Prêt » puis « Envoyé », « Reçu » puis « Lu »), chacune sur un mot à 0,3 s près. TOUS les trous de plus de
 * 2,2 s sont coupés ainsi (pas seulement le plus long) : les étapes se répètent par paires, donc le rythme tient pour
 * toute durée de voix ; l'écran trop long pour un plan (5 s) se coupe en moments sur un tampon (`recouper`).
 */
function relancerMoment(c: Ctx, carte: CarteImage, clesCarte: Map<string, string>, etat: EtatScene, els: El[], role: "declencheur" | "champ"): void {
  const liens = carte.liens.filter((l) => c.e.refs.includes(l.id));
  const voisins = liens.flatMap((l) => [l.de, l.vers]).map((id) => carte.noeuds.find((n) => n.id === id)).filter((n): n is NoeudCarte => !!n && !n.photoPersonnes);
  for (const n of [...new Set(voisins)]) {
    if (etat.montres.has(n.id) || els.some((x) => x.ref === n.id)) continue;
    const trou = trouMoment(c, els);
    if (trou.b - trou.a <= R.ecartMax - 0.2) break;
    const nomme = rangQuiNomme(c, n.libelle);
    const kNomme = nomme !== null && heureMot(c, nomme) > trou.a + R.ecartMin && heureMot(c, nomme) < trou.b - R.ecartMin ? nomme : null;
    const k = kNomme ?? motVers(c, (trou.a + trou.b) / 2, trou.a + R.ecartMin, trou.b - R.ecartMin);
    if (k === null) continue;
    etat.montres.add(n.id);
    els.push(nouvelEl(c, role, role === "champ" ? "frappe" : "objet", heureMot(c, k), { ref: n.id, texte: n.libelle, chiffres: clesDuNoeud(n, carte, clesCarte) }));
  }
  // Les trous se comptent depuis la notification (« Reçu » avant que son message soit écrit) ; le « Lu ✓ » ne s'allume
  // qu'une fois ce message écrit.
  const depuis = role === "declencheur" ? Math.max(c.debut, ...els.filter((x) => x.role === "alerte").map((x) => x.t)) : c.debut;
  const tMessage = Math.max(c.debut, ...els.filter((x) => x.role === "message").map((x) => x.t));
  const pas = R.ecartMax - 0.2;
  const pts = [depuis, ...els.filter((x) => x.visible).map((x) => x.t).filter((t) => t > depuis && t < c.fin), c.fin].sort((x, y) => x - y);
  // TOUS les trous de plus de 2,2 s sont coupés, chacun en parts égales (le dernier mot dit à 0,3 s près, tant que la
  // part voisine reste sous 2,3 s) : le rythme tient pour toute durée de voix. Chaque part se mesure depuis le tampon
  // posé juste avant (un tampon tiré tôt vers son mot ne rallonge pas la part suivante).
  const heures: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    const n = Math.ceil((b - a) / pas) - 1;
    let avant = a;
    for (let j = 1; j <= n; j++) {
      const cible = avant + (b - avant) / (n - j + 2);
      const k = motVers(c, cible, cible - 0.3, cible + 0.3);
      const mot = k === null ? null : heureMot(c, k);
      const t = mot !== null && mot - avant <= pas + 0.1 && b - mot <= (n - j + 1) * (pas + 0.1) ? mot : cible;
      heures.push(t);
      avant = t;
    }
  }
  // Étapes dans l'ordre : un seul tampon garde sa dernière étape (« Envoyé », « Lu ») ; au-delà de deux, les étapes
  // se répètent par paires (« Prêt » puis « Envoyé », encore « Prêt » puis « Envoyé »…), chaque paire couvrant ~6,6 s.
  // Avant le message de la notification, seul « Reçu » est vrai ; ensuite les étapes se suivent depuis la première.
  const etapes = TAMPONS[role];
  const apres = heures.filter((t) => role !== "declencheur" || t >= tMessage);
  heures.forEach((t) => {
    const i = apres.indexOf(t);
    els.push(nouvelEl(c, "tampon", "coche", t, { texte: i < 0 ? etapes[0] : apres.length === 1 ? etapes[etapes.length - 1] : etapes[i % etapes.length] }));
  });
}

/** Rang d'un sous-élément que la voix ne nomme pas : étalé sur l'écran (le i-ième de `total`), jamais avant `apres`. */
const rangEtale = (c: Ctx, i: number, total: number, apres: number) => Math.min(c.ecrits.length - 1, Math.max(apres, Math.floor(((i + 0.5) * c.ecrits.length) / total)));

/**
 * Champs qu'un écran « email » écrit en liste (« Objet · Contexte · Demande · Urgence », « … : Objet / Contexte ») :
 * deux à six noms courts, hors le libellé du nœud. Vide sans liste.
 */
function champsEcrits(textes: readonly string[], libelle: string): string[] {
  for (const t of textes) {
    for (const part of sansBalises(t).split("|")) {
      const liste = part.replace(/^[^:]*:\s*/, "").split(/\s*[·/,;]\s*/).map((x) => x.replace(/[.:!?…]+$/u, "").trim()).filter(Boolean);
      if (liste.length >= 2 && liste.length <= 6 && liste.every((x) => x.split(/\s+/).length <= 3 && x.length <= 24) && !liste.some((x) => formes(x).join(" ") === formes(libelle).join(" "))) return liste;
    }
  }
  return [];
}

/**
 * Filet par construction (Q12, règle d'or « rien de compté qui ne soit dessiné ») : écrans à remettre sur la toile.
 * Un nœud cité que ni son écran ni aucun autre ne DESSINE (une scène qui ne sait pas montrer ce bloc : bandeau,
 * phrase-choc, dossiers, écran « émotion » qui ne le nomme pas, additionneur sans chiffre…) n'est jamais posé en objet
 * muet : le premier écran qui le cite passe sur la toile, qui pose tous les blocs qu'il cite (comme `ficheMiseEnScene`).
 */
function ecransADessiner(places: EcranPlace[], parId: Map<string, NoeudCarte>): Set<string> {
  const dessines = new Set(places.flatMap((p) => p.els.filter((x) => x.role !== "objet").map((x) => x.ref).filter((r): r is string => !!r)));
  // Un bloc qu'aucun composant de son écran ne reçoit (un nœud sans chiffre dans l'additionneur…) n'y est pas compté.
  for (const p of places) p.els = p.els.filter((x) => x.role !== "objet" || !x.ref);
  const res = new Set<string>();
  for (const p of places) {
    if (SCENES_TOILE.has(p.c.e.scene)) continue;
    for (const r of p.c.e.refs) {
      const n = parId.get(r);
      if (!n || n.photoPersonnes || dessines.has(n.id)) continue;
      dessines.add(n.id);
      res.add(p.c.e.id);
    }
  }
  return res;
}

/**
 * Grands vides (issue 119) : un moment dont les blocs cités ont tous DÉJÀ été montrés ailleurs (`etat.montres`) ne posait
 * aucun contenu, il ne restait que l'en-tête. Il les reprend alors, sans tenir compte de `montres`, comme un rappel posé
 * au début de l'écran (les éléments qui portent un chiffre gardent l'heure de leur mot : Q13). L'état réel n'est pas touché.
 */
function elementsMomentAvecRappel(c: Ctx, carte: CarteImage, refs: NoeudCarte[], clesCarte: Map<string, string>, dits: Ctx["chiffres"], etat: EtatScene): El[] {
  const pose = elementsMoment(c, carte, refs, clesCarte, dits, etat);
  if (!refs.length || pose.some((x) => x.visible && !x.remplissage && x.role !== "entete" && x.role !== "mention")) return pose;
  const rappel = elementsMoment(c, carte, refs, clesCarte, dits, { ...etat, montres: new Set<string>(), cartes: [] });
  if (!rappel.length) return pose;
  const t0 = Math.min(...rappel.map((x) => x.t));
  const decale = (x: El): El => {
    // Toujours suffixé : un élément rappelé ne prend jamais l'identifiant (donc la place) d'un élément posé.
    if (x.chiffres.length || x.t <= c.debut) return { ...x, id: `${x.id}-rappel` };
    const t = arrondi(x.t - (t0 - c.debut));
    return { ...x, t, id: `${x.id}-rappel${Math.round(t * 1000)}` };
  };
  return trier([...pose, ...rappel.map(decale)]);
}

/** Moments de L9a : bénéfices, bandeau, recherche, alerte, e-mail, dossiers, sources, phrase-choc. */
function elementsMoment(c: Ctx, carte: CarteImage, refs: NoeudCarte[], clesCarte: Map<string, string>, dits: Ctx["chiffres"], etat: EtatScene): El[] {
  const e = c.e;
  const els: El[] = [];
  if (SCENES_BENEFICES.has(e.scene)) {
    const b = refs.find((n) => n.role === "benefice");
    if (!b) return els;
    const nouvelle = !etat.cartes.includes(b.id);
    const duree = c.fin - c.debut;
    const pris = new Set<number>([0]);
    if (nouvelle) {
      etat.cartes.push(b.id);
      etat.montres.add(b.id);
      els.push(nouvelEl(c, "carte", "objet", c.debut, { ref: b.id, texte: b.libelle, chiffres: clesDuNoeud(b, carte, clesCarte), coupe: true }));
    }
    // Micro-objet : sur son propre écran s'il en a un, sinon au tiers de la carte ; la ligne de la carte aux deux tiers.
    const dedie = etat.microDedie.has(b.id);
    if (e.scene === "micro-objet" || !dedie) {
      const k = e.scene === "micro-objet" ? 0 : motVers(c, c.debut + duree / 3, c.debut + R.ecartMin, c.fin - R.ecartMin, pris);
      if (k !== null && !etat.montres.has(`micro-${b.id}`)) {
        pris.add(k);
        etat.montres.add(`micro-${b.id}`);
        els.push(nouvelEl(c, "micro", "objet", heureMot(c, k), { ref: b.id, texte: b.libelle, coupe: e.scene !== "micro-objet" }));
      }
    }
    if (nouvelle && b.detail) {
      // La ligne qui porte un chiffre dit (« impact dès le 1er jour ») s'écrit sur ce mot : c'est elle qui le montre
      // (Q13), la carte n'a pas d'autre accent à dessiner.
      const detail = b.detail;
      const porte = dits.find((d) => clesDuTexte(detail).includes(d.cle) && heureMot(c, d.rang) >= c.debut + R.ecartMin - 1e-9 && heureMot(c, d.rang) <= c.fin - 0.3 && !pris.has(d.rang));
      const vise = dedie ? c.debut + duree / 2 : c.debut + (2 * duree) / 3;
      const k = porte?.rang ?? motVers(c, vise, c.debut + R.ecartMin, c.fin - 0.3, pris);
      if (k !== null) els.push(nouvelEl(c, "ligne-carte", "objet", heureMot(c, k), { ref: b.id, texte: b.detail, chiffres: clesDuTexte(b.detail) }));
    }
    // Chiffre dit dans un bénéfice (« dès le premier jour ») : il claque sur son mot.
    for (const d of dits) {
      if (els.some((x) => x.chiffres.includes(d.cle) && Math.abs(x.t - heureMot(c, d.rang)) <= R.chiffreApres - 0.05)) continue;
      const ligne = e.textesEcran.find((t) => clesDuTexte(t).includes(d.cle));
      els.push(nouvelEl(c, "accent", "chiffre", heureMot(c, d.rang), { ref: b.id, texte: ligne ?? d.brut, chiffres: [d.cle] }));
    }
    return els;
  }
  if (e.scene === "bandeau-chiffres") {
    for (const id of e.refs.filter((r) => clesCarte.has(r))) {
      const cle = clesCarte.get(id)!;
      const ch = carte.chiffres.find((x) => x.id === id)!;
      const d = c.chiffres.find((x) => x.cle === cle);
      els.push(nouvelEl(c, "bandeau", "chiffre", d ? heureMot(c, d.rang) : c.debut, { ref: id, texte: ch.brut, chiffres: [cle] }));
    }
    return els;
  }
  if (e.scene === "phrase-choc") {
    // Chaque écran de la phrase-choc ouvre une ligne ; un chiffre affiché claque sur le mot qui le dit.
    els.push(nouvelEl(c, "choc", "objet", c.debut, { texte: e.textesEcran.join(" "), couverts: c.ecrits.map((_, k) => k) }));
    for (const d of c.chiffres) {
      const affiche = e.textesEcran.some((t) => clesDuTexte(t).includes(d.cle));
      if (affiche) els.push(nouvelEl(c, "accent", "chiffre", heureMot(c, d.rang), { texte: d.brut, chiffres: [d.cle] }));
    }
    return els;
  }
  if (e.scene === "recherche") {
    const req = refs.find((n) => n.role !== "resultat");
    const trouve = refs.find((n) => n.role === "resultat");
    if (req) {
      etat.montres.add(req.id);
      const k = rangQuiNomme(c, req.libelle, 1) ?? Math.min(1, c.ecrits.length - 1);
      // La requête se tape MOT PAR MOT (chaque mot qui apparaît est un changement visible) : du début de l'écran (après
      // l'entrée de la barre) jusqu'au mot qui nomme son dernier mot ; jamais deux mots plus vite qu'ils ne se tapent.
      const mots = req.libelle.split(/\s+/).filter(Boolean);
      const dernier = rangQuiNomme(c, mots[mots.length - 1], k) ?? Math.min(c.ecrits.length - 1, k + mots.length - 1);
      const tFin = Math.max(heureMot(c, k), heureMot(c, dernier));
      const tDebut = Math.min(heureMot(c, k), c.debut + R.ecartMin);
      const heures = mots.length > 1 ? mots.map((_, i) => tDebut + ((tFin - tDebut) * i) / (mots.length - 1)) : [heureMot(c, k)];
      for (let i = 1; i < heures.length; i++) heures[i] = Math.max(heures[i], heures[i - 1] + mots[i - 1].length / VITESSE_FRAPPE + 0.05);
      // La frappe tient dans l'écran : un mot qui ne tient pas n'a pas d'heure propre (la composition le tape à la suite du précédent, rien n'est compté après l'écran).
      const limite = c.fin - 0.05;
      const recul = Math.min(heures[heures.length - 1] - limite, heures[0] - Math.min(heures[0], c.debut + R.ecartMin));
      if (recul > 0) for (let i = 0; i < heures.length; i++) heures[i] -= recul;
      els.push(nouvelEl(c, "frappe", "frappe", arrondi(heures[0]), { ref: req.id, texte: req.libelle }));
      for (let i = 1; i < mots.length; i++) if (heures[i] <= limite) els.push(nouvelEl(c, "frappe-mot", "frappe", arrondi(heures[i]), { ref: req.id, texte: mots[i] }));
    }
    if (trouve) {
      etat.montres.add(trouve.id);
      const cles = clesDuNoeud(trouve, carte, clesCarte);
      const k = chiffreDit(c, cles)?.rang ?? rangQuiNomme(c, trouve.libelle) ?? 0;
      els.push(nouvelEl(c, "trouve", "coche", heureMot(c, k), { ref: trouve.id, texte: trouve.libelle, chiffres: cles }));
    }
    return els;
  }
  if (e.scene === "alerte") {
    const n = noeudAlerte(refs);
    if (n) {
      etat.montres.add(n.id);
      const tNom = heureMot(c, rangQuiNomme(c, n.libelle) ?? 0);
      const cles = clesDuNoeud(n, carte, clesCarte);
      if (tNom - c.debut > R.ecartMax - 0.2) {
        // Nommée tard : la notification tombe plus tôt (au plus 2,2 s après le début de l'écran, même si le mot qui la
        // nomme est tout à la fin), son message en pointillés « en train d'écrire », puis s'écrit sur le mot qui la
        // nomme (c'est lui qui montre ses chiffres) ; des tampons « Reçu » coupent l'attente (`relancerMoment`).
        const lo = Math.max(c.debut + 0.4, Math.min(tNom - (R.ecartMax - 0.2), c.debut + R.ecartMax - 0.2));
        const hi = Math.max(lo, Math.min(c.debut + R.ecartMax - 0.2, tNom - R.ecartMin));
        const k = motVers(c, (c.debut + tNom) / 2, lo, hi);
        const tChute = k === null ? Math.min(hi, Math.max(lo, (c.debut + tNom) / 2)) : heureMot(c, k);
        els.push(nouvelEl(c, "alerte", "alerte", tChute, { ref: n.id, texte: n.libelle }));
        els.push(nouvelEl(c, "message", "frappe", tNom, { ref: n.id, texte: n.libelle, chiffres: cles }));
      } else els.push(nouvelEl(c, "alerte", "alerte", tNom, { ref: n.id, texte: n.libelle, chiffres: cles }));
    }
    // Les autres nœuds cités (l'action en amont : « le client écrit »…) s'allument sous la notification, chacun sur son mot.
    for (const a of refs) if (a !== n) poserNoeud(c, carte, clesCarte, etat, els, a, "declencheur");
    relancerMoment(c, carte, clesCarte, etat, els, "declencheur");
    return els;
  }
  if (e.scene === "email") {
    for (const n of refs) {
      if (etat.montres.has(n.id)) continue;
      if (n.sousElements?.length) {
        etat.montres.add(n.id);
        let apres = 0;
        n.sousElements.forEach((s, i, tous) => {
          const k = rangQuiNomme(c, s, apres) ?? rangEtale(c, i, tous.length, apres);
          apres = k + 1;
          els.push(nouvelEl(c, "champ", "frappe", heureMot(c, k), { ref: n.id, texte: s, couverts: [k] }));
        });
      } else {
        // Nœud sans sous-éléments : un champ de l'e-mail porte son libellé et se remplit sur son mot ; les champs que
        // l'écran écrit en liste (« Objet · Contexte · Demande · Urgence ») deviennent de vrais champs, chacun sur le
        // mot qui le dit (sinon étalés sur l'écran).
        poserNoeud(c, carte, clesCarte, etat, els, n, "champ");
        const ecrits = els.some((x) => x.role === "champ" && x.ref !== n.id) ? [] : champsEcrits(c.e.textesEcran, n.libelle);
        let apres = 0;
        ecrits.forEach((s, i) => {
          const k = rangQuiNomme(c, s, apres) ?? rangEtale(c, i, ecrits.length, apres);
          apres = k + 1;
          els.push(nouvelEl(c, "champ", "frappe", heureMot(c, k), { ref: n.id, texte: s, couverts: [k] }));
        });
      }
    }
    relancerMoment(c, carte, clesCarte, etat, els, "champ");
    return els;
  }
  if (e.scene === "dossiers") {
    const n = refs.find((x) => x.sousElements?.length);
    if (n) etat.montres.add(n.id);
    else {
      // Aucun nœud cité n'a de sous-éléments (« Envoyé équipe concernée ») : chaque nœud cité se pose comme un dossier
      // portant son libellé, sur le mot qui le nomme ; sans cela il resterait « jamais montré » et l'alerte suivante le
      // poserait en déclencheur, après coup (`relancerMoment`).
      let suite = 0;
      refs.forEach((x, i, tous) => {
        if (etat.montres.has(x.id) || x.photoPersonnes) return;
        const k = rangQuiNomme(c, x.libelle, suite) ?? rangEtale(c, i, tous.length, suite);
        suite = k + 1;
        etat.montres.add(x.id);
        els.push(nouvelEl(c, "dossier", "objet", heureMot(c, k), { ref: x.id, texte: x.libelle, chiffres: clesDuNoeud(x, carte, clesCarte), couverts: [k] }));
      });
    }
    let apres = 0;
    (n?.sousElements ?? []).forEach((s, i, tous) => {
      const k = rangQuiNomme(c, s, apres) ?? rangEtale(c, i, tous.length, apres);
      apres = k + 1;
      els.push(nouvelEl(c, "dossier", "objet", heureMot(c, k), { ref: n!.id, texte: s, couverts: [k] }));
    });
    return els;
  }
  if (e.scene === "sources") {
    let apres = 0;
    for (const n of refs) {
      const k = rangQuiNomme(c, n.libelle, apres) ?? Math.min(c.ecrits.length - 1, apres);
      apres = k + 1;
      etat.montres.add(n.id);
      els.push(nouvelEl(c, "source", "objet", heureMot(c, k), { ref: n.id, texte: n.libelle, couverts: [k] }));
    }
    return els;
  }
  return els;
}

/* ------------------------------------------------------------------ */
/* 3. Insertions                                                         */
/* ------------------------------------------------------------------ */

/**
 * Chiffres-clés RÉELLEMENT posés par la vue d'ensemble (25/10/2026, D3, compositions-iv/12) : quand la rangée ne tient pas avec 16 px entre
 * rangées, `planEnsemble` retire les chiffres-clés ; l'écran ne doit déclarer comme montrés que ceux qu'il pose (ils restent montrés quand ils sont dits).
 */
function chiffresPoses(carte: CarteImage, chiffresCles: string[], allumes: string[]): string[] {
  if (!chiffresCles.length) return chiffresCles;
  const poses = new Set(planEnsemble(schemaDeLaCarte(carte), { allumes, chiffresCles }).chiffres.map((x) => x.texte));
  return chiffresCles.filter((t) => poses.has(t));
}

function inserer(places: EcranPlace[], carte: CarteImage, fiche: FicheImage, clesCarte: Map<string, string>): void {
  const branches = carte.groupes.filter((g) => g.sorte === "branche");
  const dansBranche = new Set(branches.flatMap((g) => g.noeuds));
  const parts = carte.liens.filter((l) => typeof l.part === "number" && l.part > 0).sort((a, b) => (b.part ?? 0) - (a.part ?? 0) || a.id.localeCompare(b.id)).map((l) => `${l.part} %`);
  const aEnsemble = (i: number) => places[i].c.e.scene === "ensemble";

  // Écrans « Ensemble » de la fiche : la vue d'ensemble occupe leur début (≤ 1,5 s), chiffres dits en chiffres-clés.
  places.forEach((p, i) => {
    if (!aEnsemble(i)) return;
    const cles = p.c.chiffres.map((x) => x.cle);
    const allumesEcran = p.c.e.refs.filter((r) => carte.noeuds.some((n) => n.id === r));
    const chiffresCles = chiffresPoses(carte, [...new Set(carte.chiffres.filter((ch) => cles.includes(clesCarte.get(ch.id)!)).map((ch) => ch.brut))].slice(0, 3), allumesEcran);
    const duree = Math.min(R.ensemble, Math.max(R.ensembleMin, p.c.fin - p.c.debut - 0.6));
    p.insertion = { debut: p.c.debut, fin: arrondi(p.c.debut + duree), sorte: "ensemble", chiffresCles, allumes: allumesEcran };
    decaler(p, p.insertion.fin, chiffresCles);
  });
  // Ouverture de chaque chapitre.
  for (const ch of fiche.chapitres) {
    const i = places.findIndex((p) => p.c.e.id === ch.ecrans[0]);
    if (i < 0 || aEnsemble(i)) continue;
    const allumes = ch.ecrans.flatMap((id) => places.find((p) => p.c.e.id === id)?.c.e.refs ?? []).filter((r) => carte.noeuds.some((n) => n.id === r));
    poserInsertion(places, i, "ensemble", [], [...new Set(allumes)].sort());
  }
  // Après les branches (au moins deux) : la vue d'ensemble, si la fiche ne la pose pas déjà.
  if (branches.length >= 2) {
    let dernier = -1;
    places.forEach((p, i) => {
      if (p.c.e.refs.some((r) => dansBranche.has(r))) dernier = i;
    });
    const deja = places.some((p, i) => i > dernier && aEnsemble(i));
    if (dernier >= 0 && dernier + 1 < places.length && !deja) poserInsertion(places, dernier + 1, "ensemble", chiffresPoses(carte, parts.slice(0, 3), []), []);
  }
  // Bénéfices : récapitulatif après la dernière carte, si la fiche n'en a pas.
  if (carte.types[0] === "benefices" && !places.some((p) => p.sorte === "recap")) {
    let dernier = -1;
    places.forEach((p, i) => {
      if (SCENES_BENEFICES.has(p.c.e.scene)) dernier = i;
    });
    if (dernier >= 0 && dernier + 1 < places.length) poserInsertion(places, dernier + 1, "recap", [], []);
  }
}

/** Pose une insertion au début de l'écran `i`, prise en partie sur la fin de l'écran précédent quand il y a de la place. */
function poserInsertion(places: EcranPlace[], i: number, sorte: "ensemble" | "recap", chiffresCles: string[], allumes: string[]): void {
  const p = places[i];
  const prec = places[i - 1];
  const dernierPrec = prec ? Math.max(prec.c.debut, ...prec.els.filter((x) => x.visible).map((x) => x.t)) : p.c.debut;
  const duree = sorte === "recap" ? R.recap : R.ensemble;
  let debut = arrondi(Math.max(dernierPrec + 0.4, p.c.debut - 0.6));
  // La plus longue durée (1,2 s, sinon 1 s) qui ne retarde pas trop un chiffre dit de l'écran.
  let fin = debut + duree;
  for (const d of [duree, R.ensembleMin]) {
    fin = debut + d;
    if (!p.els.some((x) => x.chiffres.length && x.t < fin && fin - x.t > R.chiffreApres - 0.1)) break;
  }
  // Jamais sur l'écran suivant : ce qu'il montre resterait caché sous l'insertion.
  const suivant = places[i + 1];
  if (suivant) fin = Math.max(debut + 0.4, Math.min(fin, suivant.c.debut));
  // L'écran garde au moins R.ecartMin après l'insertion : ses éléments, retardés à sa fin, restent dans SON plan.
  const finEcran = suivant ? suivant.c.debut : p.c.fin;
  if (finEcran - fin < R.ecartMin) {
    const finVise = finEcran - R.ecartMin;
    const debutVise = Math.min(debut, Math.max(dernierPrec + 0.4, finVise - R.ensembleMin));
    if (finVise - debutVise >= 0.4) {
      debut = arrondi(debutVise);
      fin = finVise;
    }
  }
  p.insertion = { debut, fin: arrondi(fin), sorte, chiffresCles, allumes };
  if (prec) prec.c.fin = Math.min(prec.c.fin, debut);
  p.c.debut = Math.min(p.c.debut, debut);
  decaler(p, p.insertion.fin, chiffresCles);
}

/** Retarde à `fin` les éléments posés pendant une insertion (rien d'autre ne se montre sous la vue d'ensemble). */
function decaler(p: EcranPlace, fin: number, chiffresCles: string[]): void {
  void chiffresCles;
  for (const x of p.els) if (x.t < fin) x.t = arrondi(fin);
  trier(p.els);
}

/* ------------------------------------------------------------------ */
/* 4. Comblement du rythme                                               */
/* ------------------------------------------------------------------ */

/**
 * Comble un écran : un écran v4 commence par un texte (les premiers mots dits s'il n'en a pas) ; puis chaque trou de
 * plus de 2,4 s reçoit les mots dits au milieu du trou qui ne sont encore écrits nulle part — une ligne (écran v4,
 * segment de fin) ou un en-tête de relance (toile, objets, moments). Jamais un texte inventé : ce sont les mots DITS.
 */
function combler(p: EcranPlace, toutesCles: Set<string>): void {
  const c = p.c;
  if (SANS_ENTETE.has(c.e.scene) || p.sorte === "recap") return;
  const debutUtile = p.insertion ? p.insertion.fin : c.debut;
  // Le rythme se mesure tant que la voix parle : après le dernier mot de l'écran, rien n'est à combler.
  const finUtile = Math.min(c.fin, (c.mots.at(-1)?.finSec ?? c.fin) + 0.3);
  const couverts = () => new Set(p.els.flatMap((x) => x.couverts ?? []));
  /** Morceaux dits pas encore écrits, coupés aux propositions (2 mots au moins). */
  const libres = () => {
    const pris = couverts();
    const res: { de: number; a: number }[] = [];
    for (const pr of c.propositions) {
      let de: number | null = null;
      for (let k = pr.de; k <= pr.a + 1; k++) {
        const libre = k <= pr.a && !pris.has(k);
        if (libre && de === null) de = k;
        if (!libre && de !== null) {
          if (k - de >= 2) res.push({ de, a: k - 1 });
          de = null;
        }
      }
    }
    return res;
  };
  const v4 = p.sorte === "emotion" || p.sorte === "fin";
  /** Pose le morceau ; faux s'il ne peut pas l'être sur l'écran v4 (même raccourci aux mots entiers). */
  const ajouter = (m: { de: number; a: number }): boolean => {
    const role: RoleEl = v4 ? "ligne" : "entete";
    const t = Math.max(debutUtile, heureMot(c, m.de));
    let texte = morceauDit(c.ecrits, m);
    let couverts = range(m.de, Math.min(m.a, m.de + 7));
    if (v4) {
      const court = ligneQuiTient(p, texte, t);
      if (!court) return false;
      texte = court;
      couverts = couverts.slice(0, court.split(/\s+/).length);
    }
    const cles = clesDuTexte(texte);
    // Un en-tête de relance garde l'étiquette de l'en-tête courant.
    const etiquette = [...p.els].reverse().find((x) => x.role === "entete" && x.t <= t)?.texte?.split("|")[0] ?? "";
    p.els.push(nouvelEl(c, role, cles.some((k) => toutesCles.has(k)) ? "chiffre" : "objet", t, { texte: role === "entete" ? `${etiquette}|${texte}` : texte, chiffres: cles, couverts, coupe: role === "entete", remplissage: true }));
    trier(p.els);
    return true;
  };
  // Un écran v4 ne s'ouvre jamais vide.
  if (v4 && !p.els.some((x) => x.visible && x.t <= debutUtile + 0.8 && (x.role === "ligne" || x.role === "question" || x.role === "appel"))) {
    for (const m of libres().filter((x) => heureMot(c, x.de) <= debutUtile + 0.8)) if (ajouter(m)) break;
  }
  for (let tour = 0; tour < 6; tour++) {
    const ts = [debutUtile, ...p.els.filter((x) => x.visible).map((x) => x.t), finUtile].filter((t) => t >= debutUtile - 1e-9 && t <= finUtile + 1e-9);
    const pts = [...new Set(ts.map(arrondi))].sort((a, b) => a - b);
    let trou: { a: number; b: number } | null = null;
    for (let k = 1; k < pts.length; k++) if (pts[k] - pts[k - 1] > R.ecartMax - 0.05 && (!trou || pts[k] - pts[k - 1] > trou.b - trou.a)) trou = { a: pts[k - 1], b: pts[k] };
    if (!trou) break;
    const milieu = (trou.a + trou.b) / 2;
    const dans = (m: { de: number }) => heureMot(c, m.de) > trou!.a + 0.5 && heureMot(c, m.de) < trou!.b - 0.5;
    const ecart = (m: { de: number }) => Math.abs(heureMot(c, m.de) - milieu);
    let candidats = libres().filter(dans).sort((x, y) => ecart(x) - ecart(y) || x.de - y.de);
    if (!candidats.length) {
      // Un morceau libre qui commence avant le trou : sa suite, à partir d'un mot de liaison si possible.
      const suites = libres().flatMap((m) => range(m.de + 2, m.a - 1).map((k) => ({ de: k, a: m.a }))).filter(dans);
      const liaisons = suites.filter((m) => LIAISONS.test(c.ecrits[m.de]) && ecart(m) <= 0.6);
      candidats = (liaisons.length ? liaisons : suites).sort((x, y) => ecart(x) - ecart(y) || x.de - y.de);
    }
    if (candidats.some((m) => ajouter(m))) continue;
    // Sinon : une ligne longue déjà posée se révèle en deux temps (sa seconde moitié sur le mot qui la dit).
    if (!couperLigne(p, trou, milieu)) break;
  }
}

/** Mots qui ouvrent naturellement une suite de phrase. */
const LIAISONS = /^(et|mais|puis|pour|avec|qui|que|à|a|en|de|des|du|sur|dans|par|sans|vos|votre|les|la|le)$/iu;
const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);

/**
 * Révèle en deux temps une ligne (ou un en-tête, une question) dont la voix dit la suite au milieu d'un trou : son début
 * reste à sa place, la ligne entière apparaît sur le mot qui dit la suite (même groupe : la seconde étape l'emporte).
 */
function couperLigne(p: EcranPlace, trou: { a: number; b: number }, milieu: number): boolean {
  const c = p.c;
  for (const x of [...p.els].reverse()) {
    if (!["ligne", "entete", "question", "appel"].includes(x.role) || !x.texte || x.t > trou.a + 1e-6) continue;
    if (x.groupe && p.els.some((y) => y.groupe === x.groupe && y.t > x.t)) continue;
    const [etiquette, titre] = x.role === "entete" ? x.texte.split("|") : ["", x.texte];
    const mots = (titre ?? "").split(/\s+/).filter(Boolean);
    if (mots.length < 3) continue;
    // Rang dit de chaque mot affiché (dans l'ordre), et coupe la plus proche du milieu du trou.
    let meilleur: { j: number; t: number } | null = null;
    let apres = 0;
    for (let j = 0; j < mots.length; j++) {
      const k = rangQuiNomme(c, mots[j], apres);
      if (k === null) continue;
      apres = k;
      const t = heureMot(c, k);
      // Écrans de FIN seulement (le corps des vidéos garde sa règle d'avant) : jamais de coupe juste après un mot de liaison
      // (« … ce qu'on | peut automatiser »), le début resterait seul à l'écran, coupé.
      const debutPropre = j > 0 && (p.sorte !== "fin" || !FINS_INTERDITES.test(sansBalises(mots[j - 1]).replace(/[.,!?:;…]+$/u, "")));
      if (debutPropre && t > trou.a + 0.5 && t < trou.b - 0.5 && (!meilleur || Math.abs(t - milieu) < Math.abs(meilleur.t - milieu))) meilleur = { j, t };
    }
    if (!meilleur) continue;
    const debutTexte = equilibrer(mots.slice(0, meilleur.j).join(" "), titre);
    const groupe = x.groupe ?? `${x.id}-revele`;
    const entier = x.texte;
    x.groupe = groupe;
    x.texte = x.role === "entete" ? `${etiquette}|${debutTexte}` : debutTexte;
    x.chiffres = clesDuTexte(debutTexte);
    p.els.push(nouvelEl(c, x.role, "objet", meilleur.t, { texte: entier, chiffres: clesDuTexte(titre ?? ""), groupe, remplissage: true, ...(x.ref ? { ref: x.ref } : {}), ...(x.couverts ? { couverts: x.couverts } : {}) }));
    trier(p.els);
    return true;
  }
  return false;
}

/** Un morceau d'une ligne coupée : balise orange refermée si la coupe passe au milieu. */
function equilibrer(morceau: string, entier: string | undefined): string {
  const n = (morceau.match(/\*/g) ?? []).length;
  if (n % 2 === 0) return morceau;
  return morceau.startsWith("*") || !morceau.includes("*") || (entier ?? "").indexOf("*") >= 0 && morceau.lastIndexOf("*") > morceau.indexOf("*") ? `${morceau}*` : `*${morceau}`;
}

/** Texte d'un morceau dit : de son premier mot à la fin de sa phrase, 8 mots au plus, sans la ponctuation finale. */
function morceauDit(ecrits: readonly string[], m: { de: number; a: number }): string {
  let a = m.de;
  while (a < ecrits.length - 1 && a < m.de + 7 && !/[.!?:;…]["»”)]*$/u.test(ecrits[a])) a++;
  const t = ecrits
    .slice(m.de, Math.max(a, Math.min(m.a, m.de + 7)) + 1)
    .join(" ")
    .replace(/[.,!?:;…]+$/u, "")
    .trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* ------------------------------------------------------------------ */
/* 4 bis. Écrans v4 : jamais plus que ce qu'ils savent montrer            */
/* ------------------------------------------------------------------ */

const ESSAI_ECRAN = { id: "essai", debutMs: 0, finMs: 3000, evenements: [] } as const;
const ROLES_LIGNE: ReadonlySet<RoleEl> = new Set<RoleEl>(["ligne", "question", "appel"]);

/** Contenu d'un écran v4 d'émotion (accroche, chiffre, titre) qui montre ces lignes : seule règle, lue par `blocsEcran`. */
function contenuEmotion(scene: string, base: Omit<EcranCale, "type">, lignes: string[]): EcranCale {
  const orange = lignes.find((t) => t.includes("*"));
  const lu = scene === "chiffre" && orange ? chiffresDuTexte(sansBalises(orange))[0] : undefined;
  if (lu && lu.valeur !== null && orange) {
    const ligne = sansBalises(orange).trim();
    const apresChiffre = (x: string) => x.replace(/^\s*[\d\s,.:h]+/u, "").trim();
    // Heure (« 23h14 ») : la ligne se lit comme avant. Sinon l'unité s'arrête au tiret de séparation (« *80%* — Réponse connue » donne
    // « % ») et ce qui suit le tiret devient la première pastille (« Réponse connue »), sans tiret : l'unité n'est plus toute la fin de ligne.
    const [unitePartie, ...suite] = lu.unite === "heure" ? [apresChiffre(ligne)] : apresChiffre(ligne).split(/\s+[—–-]\s+/u);
    const unite = unitePartie.trim();
    const reste = suite.join(" — ").trim();
    return { ...base, type: "chiffre", nombre: lu.valeur, unite, pastilles: [...(reste ? [reste] : []), ...lignes.filter((x) => x !== orange).map(sansBalises)], compteur: lu.unite !== "heure" } as EcranCale;
  }
  if (scene === "accroche" || scene === "chiffre") return { ...base, type: "accroche", lignes } as EcranCale;
  return { ...base, type: "titre", lignes } as EcranCale;
}

/** Contenu d'un écran v4 du segment de fin (question de commentaire, ou phrase de la banque) : seule règle. */
function contenuFin(question: boolean, base: Omit<EcranCale, "type">, visibles: readonly Pick<El, "role" | "texte">[]): EcranCale {
  const principal = visibles.find((x) => x.role === "question" || x.role === "appel");
  const autres = visibles.filter((x) => x !== principal).map((x) => x.texte!);
  return (question ? { ...base, type: "question", lignes: autres, question: principal?.texte ?? "" } : { ...base, type: "titre", lignes: [principal?.texte ?? "", ...autres].filter(Boolean) }) as EcranCale;
}

/** L'écran v4 de cette place, s'il montrait ces lignes (dernière étape de chaque ligne révélée), tient-il ? */
function tientSurEcran(p: EcranPlace, lignes: readonly El[]): boolean {
  const base = { ...ESSAI_ECRAN, fond: p.c.e.fond } as unknown as Omit<EcranCale, "type">;
  const vues = lignes.filter((x) => !x.groupe || !lignes.some((y) => y !== x && y.groupe === x.groupe && y.t > x.t));
  if (p.sorte === "fin") return ecranV4Tient(contenuFin(p.els.some((x) => x.role === "question"), base, vues));
  return ecranV4Tient(contenuEmotion(p.c.e.scene, base, vues.map((x) => x.texte!)));
}

/** Lignes du même écran que l'instant `t` : de la dernière coupe jusqu'à la suivante. */
function lignesDuMemeEcran(els: readonly El[], t: number): El[] {
  const avant = Math.max(-Infinity, ...els.filter((y) => y.coupe && y.t <= t + 1e-6).map((y) => y.t));
  const apres = Math.min(Infinity, ...els.filter((y) => y.coupe && y.t > t + 1e-6).map((y) => y.t));
  return els.filter((x) => ROLES_LIGNE.has(x.role) && x.t >= avant - 1e-6 && x.t < apres - 1e-6);
}

/**
 * Une ligne de comblement, telle qu'elle peut être posée à `t` : le morceau dit, raccourci aux mots ENTIERS s'il ne
 * tient pas (jamais sur un mot de liaison, deux mots au moins). Sur un écran d'émotion, une ligne de trop ouvre un
 * nouvel écran (`repartirEcran`) : elle doit alors tenir seule avec ce qui la suit. Dans le segment de fin (la
 * question doit rester sur son écran), elle doit tenir avec les lignes de l'écran. `null` : rien ne tient.
 */
function ligneQuiTient(p: EcranPlace, texte: string, t: number): string | null {
  const mots = texte.split(/\s+/).filter(Boolean);
  const voisines = lignesDuMemeEcran(p.els, t);
  const suivantes = voisines.filter((x) => x.t > t + 1e-6);
  const nu = (m: string) => sansBalises(m).replace(/[.,!?:;…]+$/u, "");
  /** Fin propre : jamais sur un mot qui annonce une suite (liaison, article, pronom), balises orange refermées. */
  const propre = (n: number) => !FINS_INTERDITES.test(nu(mots[n - 1])) && (mots.slice(0, n).join(" ").match(/\*/g) ?? []).length % 2 === 0;
  /** Coupe naturelle : le morceau entier, une virgule, ou juste avant le début d'une proposition. */
  const naturelle = (n: number) => n === mots.length || /[,;:]$/u.test(mots[n - 1]) || DEBUTS_PROPOSITION.test(nu(mots[n] ?? ""));
  const tailles = range(2, mots.length).reverse();
  for (const n of [...tailles.filter((n) => propre(n) && naturelle(n)), ...tailles.filter((n) => propre(n) && !naturelle(n))]) {
    const essai = mots.slice(0, n).join(" ").replace(/[.,!?:;…]+$/u, "");
    const ligne = { id: "essai", role: "ligne", genre: "objet", t, ecran: p.c.e.id, texte: essai, chiffres: [], visible: true } as El;
    if (p.sorte === "fin" ? tientSurEcran(p, [...voisines, ligne]) : tientSurEcran(p, [ligne, ...suivantes]) || tientSurEcran(p, [...voisines, ligne])) return essai;
  }
  return null;
}

/**
 * Mots sur lesquels une ligne ne s'arrête jamais (elle paraîtrait coupée) : liaisons, articles (contractés compris),
 * pronoms sujets, élisions. Exporté : les tests lisent CETTE liste. Sans suite possible, on ouvre un nouvel écran.
 */
export const FINS_INTERDITES = /^(et|mais|ou|donc|or|ni|car|puis|pour|avec|qui|que|qu['’]|qu['’]il|qu['’]elle|qu['’]ils|qu['’]elles|qu['’]on|quand|si|comme|où|dont|à|a|au|aux|en|de|des|du|d['’]|sur|dans|par|sans|vers|chez|entre|un|une|le|la|les|l['’]|ce|cet|cette|ces|son|sa|ses|leur|leurs|mon|ma|mes|ton|ta|tes|notre|nos|votre|vos|se|s['’]|s['’]en|n['’]en|ne|n['’]|y|très|plus|moins|tout|tous|je|j['’]|tu|il|elle|on|nous|vous|ils|elles|c['’]|c['’]est|c['’]était)$/iu;
/** Mots qui ouvrent une proposition : couper juste avant eux garde un sens complet. */
const DEBUTS_PROPOSITION = /^(et|mais|ou|donc|car|puis|quand|si|comme|où|dont|qui|que|pour|avec|sans|dans|sur|par|à|en)$/iu;

/**
 * Écran d'émotion trop chargé pour l'écran v4 (le composant n'en montre que 2 ou 3 selon le type, à leur taille) : la
 * ligne qui déborde ouvre un nouvel écran (une coupe), dans l'ordre où la voix les dit. Déterministe ; aucun texte
 * retiré, tronqué ni coupé.
 */
function repartirEcran(p: EcranPlace): void {
  if (p.sorte !== "emotion") return;
  let courant: El[] = [];
  for (const x of p.els) {
    if (!ROLES_LIGNE.has(x.role)) continue;
    if (x.coupe) courant = [];
    const essai = [...courant, x];
    if (courant.length && !tientSurEcran(p, essai)) {
      x.coupe = true;
      courant = [x];
    } else courant = essai;
  }
}

/* ------------------------------------------------------------------ */
/* 5. Segment de fin                                                     */
/* ------------------------------------------------------------------ */

/**
 * Segment de fin d'un réseau (LinkedIn compris ; sauf dans le plan d'une vidéo d'avant le 26/10/2026) : la question de commentaire (texte d'écran de la fiche quand la
 * question est celle de l'image), puis chaque phrase de la banque, chacune sur son écran v4 sombre.
 */
function segmentFin(fin: NonNullable<EntreeMiseEnSceneIV["fin"]>, fiche: FicheImage, calage: CalageIV, debutFin: number, dureeSec: number, els: El[], plans: PlanIV[]): void {
  const parties: { sorte: "question" | "appel"; dit: string; ecrans: string[] }[] = [];
  if (fin.question) {
    const propre = fin.question.origine === "image" ? fiche.questionCommentaire.texteEcran : fin.question.ecran;
    parties.push({ sorte: "question", dit: fin.question.dit, ecrans: fin.question.origine === "image" ? [propre, fin.question.ecran] : [propre] });
  }
  fin.appels.forEach((a) => parties.push({ sorte: "appel", dit: a.dit, ecrans: [a.ecran] }));
  let k = 0;
  const bornes = parties.map((p) => {
    const n = motsDits(p.dit).length;
    const mots = calage.fin.slice(k, k + n);
    k += n;
    return { p, mots };
  });
  bornes.forEach(({ p, mots }, i) => {
    const debut = i === 0 ? debutFin : Math.max(debutFin, arrondi((mots[0]?.debutSec ?? debutFin) - R.avance));
    const suivant = bornes[i + 1];
    const finPlan = suivant ? arrondi((suivant.mots[0]?.debutSec ?? dureeSec) - R.avance) : dureeSec;
    const id = `f${String(i + 1).padStart(2, "0")}`;
    const ecran: EcranFiche = { id, partie: "phrase-choc", scene: "titre", refs: [], texteDit: p.dit, textesEcran: [p.ecrans[0]], surMot: [], fond: "sombre" };
    const c = contexte(ecran, mots, debut, finPlan);
    const toutes = new Set<string>();
    const place: EcranPlace = { c, sorte: "fin", els: [] };
    // Le texte principal (question ou phrase de la banque) apparaît là où la voix le dit ; l'étiquette de la banque dès le début.
    for (const x of partiesDe(c, p.ecrans[0], toutes)) place.els.push(nouvelEl(c, p.sorte, "objet", place.els.length || p.sorte === "question" ? x.t : debut, { texte: x.texte, couverts: x.couverts, groupe: `${id}-principal` }));
    if (p.ecrans[1]) place.els.push(nouvelEl(c, "ligne", "objet", debut, { texte: p.ecrans[1] }));
    combler(place, toutes);
    els.push(...place.els);
    plans.push({
      id,
      debut,
      fin: finPlan,
      ecran: id,
      partie: "fin",
      scene: p.sorte,
      sorte: "fin",
      fond: "sombre",
      textes: lignesVisibles(place.els, debut, finPlan).map((x) => x.texte!),
      coupe: "ecran",
      marque: MARQUE,
    });
  });
}

/* ------------------------------------------------------------------ */
/* 6. Plans                                                              */
/* ------------------------------------------------------------------ */

function construirePlans(places: EcranPlace[], carte: CarteImage, dureeSec: number, debutFin: number, finPlans: PlanIV[]): PlanIV[] {
  const plans: PlanIV[] = [];
  let n = 0;
  const id = () => `p${String(++n).padStart(2, "0")}`;
  places.forEach((p, i) => {
    const e = p.c.e;
    const finEcran = i + 1 < places.length ? places[i + 1].c.debut : debutFin;
    const fondEcran: Fond = e.scene === "bandeau-chiffres" || e.scene === "phrase-choc" ? "sombre" : e.fond;
    let debut = p.c.debut;
    if (p.insertion) {
      plans.push({
        id: id(),
        debut: p.insertion.debut,
        fin: p.insertion.fin,
        ...(p.insertion.debut >= p.c.debut && e.scene === "ensemble" ? { ecran: e.id } : {}),
        partie: e.partie,
        scene: p.insertion.sorte === "recap" ? "recap" : "ensemble",
        sorte: p.insertion.sorte === "recap" ? "recap" : "ensemble",
        fond: "ivoire",
        textes: p.insertion.chiffresCles,
        coupe: "insertion",
        marque: MARQUE,
      });
      debut = p.insertion.fin;
    }
    // Sous-plans : chaque élément « coupe » ouvre un plan ; puis les plans trop longs se coupent sur une ligne.
    const coupes = [...new Set(p.els.filter((x) => x.coupe && x.t > debut + 0.3 && x.t < finEcran - 0.3).map((x) => x.t))].sort((a, b) => a - b);
    const bascules = (p.bascules ?? []).filter((t) => t >= debut + 0.3 - 1e-6 && t <= finEcran - 0.3 + 1e-6);
    const relances = (p.relances ?? []).filter((r) => r.debut > debut && r.fin < finEcran);
    let bornes = [...new Set([debut, ...coupes.filter((t) => !relances.some((r) => t > r.debut && t < r.fin)), ...bascules, ...relances.flatMap((r) => [r.debut, r.fin]), finEcran])].sort((a, b) => a - b);
    bornes = recouper(bornes, p, plans.at(-1));
    for (let k = 0; k + 1 < bornes.length; k++) {
      const a = bornes[k];
      const b = bornes[k + 1];
      if (b - a < 1e-6) continue;
      if (relances.some((r) => Math.abs(r.debut - a) < 1e-6)) {
        plans.push({ id: id(), debut: arrondi(a), fin: arrondi(b), partie: e.partie, scene: "ensemble", sorte: "ensemble", fond: "ivoire", textes: [], coupe: "relance", marque: MARQUE });
        continue;
      }
      plans.push({
        id: id(),
        debut: arrondi(a),
        fin: arrondi(b),
        ecran: e.id,
        partie: e.partie,
        scene: e.scene,
        sorte: p.sorte === "recap" ? "recap" : p.sorte,
        fond: bascules.filter((t) => t <= a + 1e-6).length % 2 ? autreFond(fondEcran) : fondEcran,
        textes: textesDuPlan(p, a, b, carte),
        coupe: k === 0 && !p.insertion ? "ecran" : "sous-plan",
        marque: MARQUE,
      });
    }
  });
  plans.push(...finPlans.map((x) => ({ ...x, id: id() })));
  // La fin sans segment (LinkedIn) : le dernier plan court jusqu'à la fin de la vidéo (phrase-choc + marque).
  const dernier = plans[plans.length - 1];
  if (dernier) dernier.fin = arrondi(dureeSec);
  return plans;
}

const autreFond = (f: Fond): Fond => (f === "sombre" ? "ivoire" : "sombre");

/**
 * Relance du rythme (Q14) par un VRAI changement. Pour le premier trou de plus de 2,4 s entre deux changements qui
 * COMPTENT (même règle que le contrôle : `instantsVisibles`) :
 *  - dans un écran v4 (corps ou segment de fin), le fond bascule (sombre ↔ ivoire) à l'appui le plus proche du milieu
 *    du trou (un texte posé là, sinon le milieu ; au plus 2,2 s après le début d'un long trou) ;
 *  - sur une toile, une vue d'ensemble (scène « Ensemble » de L7, 1,2 s) s'ouvre au milieu du trou, les blocs déjà
 *    posés allumés ; ce qui devait apparaître dessous attend sa fin.
 * Rend vrai si une relance a été posée. Dans des objets ou un moment (L8, L9a), le rythme vient des micro-animations
 * du composant, posées avec leurs éléments (coches et objets « pour vous » de la nuée, mots tapés de la recherche,
 * détail du résultat de l'additionneur…) ; rien n'est inventé ici, le contrôle refuse un trou qui reste.
 */
function relancerRythme(places: EcranPlace[], finPlans: PlanIV[], finEls: El[], plans: readonly PlanIV[], evenements: readonly EvenementTempsIV[], finVoix: number): boolean {
  const pts = [0, ...instantsVisibles(evenements, finVoix).filter((t) => t > 0), finVoix];
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1];
    const b = pts[k];
    if (b - a <= R.ecartMax + 1e-6) continue;
    const cible = b - a > 2 * R.ecartMax - 0.2 ? a + R.moyenneMax : (a + b) / 2;
    const plan = plans.find((p) => cible >= p.debut - 1e-6 && cible < p.fin - 1e-6);
    // Toile : l'écran de toile qui recouvre le trou et peut loger la vue d'ensemble au plus près de la cible (les
    // sous-plans ouverts par un en-tête de relance s'effacent sous elle).
    const fenetres = places
      .filter((p) => p.sorte === "toile" && p.c.debut < b && p.c.fin > a)
      .map((p) => ({ p, lo: Math.max(a + 0.3, (p.insertion?.fin ?? p.c.debut) + (!p.insertion && places[places.indexOf(p) - 1]?.sorte === "toile" ? 0.1 : 0.3), ...(p.relances ?? []).filter((r) => r.fin <= a + 1e-6).map((r) => r.fin)), hi: Math.min(b - 0.3, p.c.fin - (places[places.indexOf(p) + 1]?.sorte === "toile" && !places[places.indexOf(p) + 1]?.insertion ? 0.1 : 0.3)) }))
      .map((f) => ({ ...f, duree: arrondi(Math.min(R.ensemble, f.hi - f.lo)) }))
      .filter((f) => f.duree >= R.ensembleMin - 1e-6)
      .map((f) => {
        // Au plus près de la cible, de préférence sans recouvrir un texte déjà posé (il garde son heure).
        const ts = f.p.els.filter((x) => x.visible).map((x) => x.t);
        const borne = (d: number) => arrondi(Math.min(f.hi - f.duree, Math.max(f.lo, d)));
        const libre = (d: number) => !ts.some((t) => t >= d - 0.05 && t < d + f.duree + 0.05);
        const essais = [cible - f.duree / 2, ...ts.flatMap((t) => [t + 0.05, t - f.duree - 0.05])].map(borne);
        const libres = essais.filter(libre);
        const debut = (libres.length ? libres : essais).sort((x, y) => Math.abs(x + f.duree / 2 - cible) - Math.abs(y + f.duree / 2 - cible) || x - y)[0];
        return { ...f, debut, libre: libre(debut) };
      })
      .sort((x, y) => Number(y.libre) - Number(x.libre) || Math.abs(x.debut + x.duree / 2 - cible) - Math.abs(y.debut + y.duree / 2 - cible));
    const toile = fenetres[0];
    if (toile && (plan?.sorte === "toile" || !plan || (plan.sorte !== "emotion" && plan.sorte !== "fin"))) {
      const place = toile.p;
      const debut = toile.debut;
      const fin = arrondi(debut + toile.duree);
      const allumes = [...new Set(places.flatMap((p) => p.els).filter((x) => x.role === "noeud" && x.ref && x.t < debut).map((x) => x.ref!))].sort();
      place.relances = [...(place.relances ?? []), { debut, fin, allumes }].sort((x, y) => x.debut - y.debut);
      // Rien d'autre ne se montre sous la vue d'ensemble.
      for (const x of place.els) if (x.t >= debut - 1e-6 && x.t < fin) x.t = fin;
      trier(place.els);
      return true;
    }
    if (!plan || !plan.ecran || (plan.sorte !== "emotion" && plan.sorte !== "fin")) continue;
    const lo = Math.max(a + 0.6, plan.debut + 0.3);
    const hi = Math.min(b - 0.6, plan.fin - 0.3);
    if (hi <= lo) continue;
    const els = plan.sorte === "fin" ? finEls.filter((x) => x.ecran === plan.ecran) : (places.find((p) => p.c.e.id === plan.ecran)?.els ?? []);
    const appuis = els.filter((x) => x.visible && x.t >= lo && x.t <= hi && Math.abs(x.t - cible) <= 0.6).sort((u, v) => Math.abs(u.t - cible) - Math.abs(v.t - cible) || u.t - v.t);
    const t = arrondi(appuis[0]?.t ?? Math.min(hi, Math.max(lo, cible)));
    if (plan.sorte === "emotion") {
      const place = places.find((p) => p.c.e.id === plan.ecran)!;
      if (place.bascules?.includes(t)) continue;
      place.bascules = [...(place.bascules ?? []), t].sort((x, y) => x - y);
      return true;
    }
    const i = finPlans.findIndex((p) => p.ecran === plan.ecran && t > p.debut + 1e-6 && t < p.fin - 1e-6);
    if (i < 0) continue;
    const avant = finPlans[i];
    const apres: PlanIV = { ...avant, debut: t, fond: autreFond(avant.fond), coupe: "sous-plan", textes: lignesVisibles(finEls.filter((x) => x.ecran === avant.ecran), t, avant.fin).map((x) => x.texte!) };
    finPlans.splice(i, 1, { ...avant, fin: t, textes: lignesVisibles(finEls.filter((x) => x.ecran === avant.ecran), avant.debut, t).map((x) => x.texte!) }, apres);
    return true;
  }
  return false;
}

/**
 * Coupe un plan trop long (> 5 s, ou > 4 s après un plan de plus de 4 s) sur une ligne posée dans son milieu ; un écran
 * « email » ou « alerte » à voix longue (au-delà de ~6,6 s) se coupe ainsi en plusieurs moments, sur un de ses champs, déclencheurs ou tampons.
 */
function recouper(bornes: number[], p: EcranPlace, precedent: PlanIV | undefined): number[] {
  const res = [...bornes];
  for (let k = 0; k + 1 < res.length; k++) {
    const a = res[k];
    const b = res[k + 1];
    const longPrecedent = k === 0 ? (precedent ? precedent.fin - precedent.debut > R.planLong : false) : res[k] - res[k - 1] > R.planLong;
    if (!(b - a > R.planMax || (b - a > R.planLong && longPrecedent))) continue;
    const dans = (marge: number) => p.els.filter((x) => x.visible && x.t > a + marge && x.t < b - marge && ["ligne", "entete", "micro", "ligne-carte", "objet", "champ", "declencheur", "alerte", "message", "tampon", "noeud"].includes(x.role));
    const candidats = dans(1.2).length ? dans(1.2) : dans(0.6);
    if (!candidats.length) continue;
    const milieu = (a + b) / 2;
    const x = candidats.sort((u, v) => Math.abs(u.t - milieu) - Math.abs(v.t - milieu) || u.t - v.t)[0];
    x.coupe = true;
    res.splice(k + 1, 0, x.t);
    k--;
  }
  return res;
}

/** Textes visibles d'un plan : lignes (écran v4) ou en-tête courant (toile, objets, moments). */
function textesDuPlan(p: EcranPlace, a: number, b: number, carte: CarteImage): string[] {
  if (p.sorte === "emotion") return lignesVisibles(p.els, a, b).map((x) => x.texte!);
  if (p.c.e.scene === "phrase-choc" || p.c.e.scene === "bandeau-chiffres" || SCENES_BENEFICES.has(p.c.e.scene)) return [...p.c.e.textesEcran];
  if (p.sorte === "recap") return [beneficesDe(carte).map((x) => x.titre).join(" · ")];
  const ent = [...p.els].reverse().find((x) => x.role === "entete" && x.t < b - 1e-6);
  return (ent?.texte ?? "").split("|").filter(Boolean);
}

/**
 * Lignes d'un écran v4 visibles pendant [a, b) : posées avant la fin du plan, et pas avant la dernière coupe (un
 * sous-écran repart d'un écran neuf) ; pour une ligne révélée en plusieurs temps, la dernière étape seulement.
 */
function lignesVisibles(els: readonly El[], a: number, b: number): El[] {
  const coupe = Math.max(-Infinity, ...els.filter((y) => y.coupe && y.t <= a + 1e-6).map((y) => y.t));
  const lignes = els.filter((x) => (x.role === "ligne" || x.role === "question" || x.role === "appel") && x.t < b - 1e-6 && x.t >= coupe - 1e-6);
  return lignes.filter((x) => !x.groupe || !lignes.some((y) => y.groupe === x.groupe && y.t > x.t));
}

/* ------------------------------------------------------------------ */
/* 7. Blocs de rendu                                                     */
/* ------------------------------------------------------------------ */

/** `caches` reçoit les éléments qu'aucun bloc ne montre (étape d'une ligne révélée remplacée dans le même plan). */
function construireBlocs(places: EcranPlace[], plans: PlanIV[], carte: CarteImage, dureeSec: number, debutFin: number, finPlans: PlanIV[], finEls: El[], caches: Set<string>, format: FormatIV): BlocRenduIV[] {
  const blocs: BlocRenduIV[] = [];
  const schema = schemaDeLaCarte(carte);
  const dejaPoses = new Set<string>();
  let i = 0;
  const finEcran = (k: number) => (k + 1 < places.length ? places[k + 1].c.debut : debutFin);
  const nomBloc = () => `b${String(blocs.length + 1).padStart(2, "0")}`;
  while (i < places.length) {
    const p = places[i];
    // Une insertion « récapitulatif » hors de toute séquence : son propre moment.
    if (p.insertion?.sorte === "recap") {
      blocs.push({ id: nomBloc(), debut: p.insertion.debut, fin: p.insertion.fin, sorte: "moments", moments: [{ sorte: "recap", debut: 0, fin: arrondi(p.insertion.fin - p.insertion.debut), fond: "ivoire", entete: { etiquette: "Vue d'ensemble", titre: `Les *${carte.noeuds.filter((n) => n.role === "benefice").length}* d'un coup.` }, benefices: beneficesDe(carte) }] });
    }
    // Une vue d'ensemble insérée entre deux écrans hors toile : son propre moment.
    if (p.insertion?.sorte === "ensemble" && p.sorte !== "toile" && !(i > 0 && places[i - 1].sorte === "toile")) {
      blocs.push({ id: nomBloc(), debut: p.insertion.debut, fin: p.insertion.fin, sorte: "moments", moments: [{ sorte: "ensemble", debut: 0, fin: arrondi(p.insertion.fin - p.insertion.debut), fond: "ivoire", schema, options: { ...(p.insertion.allumes.length ? { allumes: p.insertion.allumes } : {}), ...(p.insertion.chiffresCles.length ? { chiffresCles: p.insertion.chiffresCles } : {}) } }] });
    }
    const groupe = (q: EcranPlace) => (q.sorte === "toile" ? "toile" : q.sorte === "objets" ? "objets" : q.sorte === "emotion" ? `emotion-${q.c.e.id}` : "moments");
    let j = i;
    while (j + 1 < places.length && groupe(places[j + 1]) === groupe(p) && places[j + 1].c.e.fond === p.c.e.fond && places[j + 1].insertion?.sorte !== "recap" && (groupe(p) !== "moments" || memeMoment(places[j + 1], places[j]))) j++;
    // Une insertion « Ensemble » qui suit une séquence de toile lui appartient (la toile s'efface dessous).
    const debut = p.insertion && (p.insertion.sorte === "recap" || groupe(p) !== "toile") ? p.insertion.fin : Math.min(p.c.debut, p.insertion?.debut ?? Infinity);
    const fin = finEcran(j);
    const lot = places.slice(i, j + 1);
    const g = groupe(p);
    if (g === "toile") {
      const suivant = places[j + 1];
      const ensembleApres = suivant?.insertion?.sorte === "ensemble" && suivant.sorte !== "toile" ? suivant.insertion : null;
      blocs.push(blocToile(nomBloc(), lot, schema, carte, debut, ensembleApres ? ensembleApres.fin : fin, ensembleApres, dejaPoses, format));
    } else if (g === "objets") blocs.push(blocObjets(nomBloc(), lot, carte, debut, fin));
    else if (g === "moments") blocs.push(blocMoments(nomBloc(), lot, carte, debut, fin, schema));
    else for (const b of blocsEcran(p, debut, fin, plans, caches)) blocs.push({ ...b, id: nomBloc() });
    for (const q of lot) for (const x of q.els) if (x.ref && (x.role === "noeud" || x.role === "source" || x.role === "alerte" || x.role === "declencheur" || x.role === "champ" || x.role === "porte")) dejaPoses.add(x.ref);
    i = j + 1;
  }
  // Segment de fin : un écran v4 par partie (question, puis chaque phrase de la banque).
  const vusFin = new Map<string, number>();
  for (const fp of finPlans) {
    const els = finEls.filter((x) => x.ecran === fp.ecran);
    const visibles = lignesVisibles(els, fp.debut, fp.fin);
    const rang = (vusFin.get(fp.ecran!) ?? 0) + 1;
    vusFin.set(fp.ecran!, rang);
    const base = { id: rang === 1 ? fp.ecran! : `${fp.ecran}-${rang}`, fond: fp.fond, debutMs: ms(fp.debut), finMs: ms(fp.fin), evenements: evenementsCales(els, fp.debut) };
    const contenu = contenuFin(fp.scene === "question", base, visibles);
    blocs.push({ id: nomBloc(), debut: fp.debut, fin: fp.fin, sorte: "ecran", ecran: contenu });
  }
  const dernier = blocs[blocs.length - 1];
  if (dernier && dernier.fin < dureeSec) dernier.fin = arrondi(dureeSec);
  return blocs;
}

const ms = (s: number) => Math.round(s * 1000);
const evenementsCales = (els: readonly El[], debut: number) => els.filter((x) => x.visible).map((x, k) => ({ cible: x.role === "ligne" ? `ligne-${k}` : x.role, ms: ms(Math.max(debut, x.t)) }));

/** Deux écrans de suite forment le même moment de L9a (même composant). */
function memeMoment(a: EcranPlace, b: EcranPlace): boolean {
  const s = (x: string) => (SCENES_BENEFICES.has(x) ? "benefices" : x);
  // Une alerte ne montre qu'une notification, une recherche qu'une requête (l'écran suivant peut en dire le résultat) :
  // une deuxième alerte, une deuxième requête ouvrent un nouveau moment.
  if (a.c.e.scene === "alerte") return false;
  // Un e-mail « Envoyé » est clos : l'écran suivant en ouvre un autre.
  if (a.els.some((x) => x.role === "tampon")) return false;
  if (a.c.e.scene === "recherche" && a.els.some((x) => x.role === "frappe")) return false;
  return s(a.c.e.scene) === s(b.c.e.scene) && a.sorte === b.sorte;
}

function beneficesDe(carte: CarteImage, ids?: readonly string[]): BeneficePlanIV[] {
  return carte.noeuds
    .filter((n) => n.role === "benefice" && (!ids || ids.includes(n.id)))
    .sort((a, b) => (ids ? ids.indexOf(a.id) - ids.indexOf(b.id) : a.ordre - b.ordre) || a.id.localeCompare(b.id))
    .map((n) => {
      const icone = n.icone ? iconeDe(n.icone) : null;
      return { id: n.id, titre: n.libelle, ...(n.detail ? { ligne: n.detail } : {}), ...(icone ? { icone } : {}) };
    });
}

/** Écran v4 (accroche, chiffre, titre) : chacun de ses sous-plans devient un écran calé, à la suite. */
function blocsEcran(p: EcranPlace, debut: number, fin: number, plans: PlanIV[], caches: Set<string>): Omit<Extract<BlocRenduIV, { sorte: "ecran" }>, "id">[] {
  const e = p.c.e;
  const sous = plans.filter((x) => x.ecran === e.id && x.sorte === "emotion");
  const tranches = sous.length ? sous.map((x, k) => ({ a: k === 0 ? Math.max(debut, Math.min(x.debut, debut)) : x.debut, b: k + 1 < sous.length ? sous[k + 1].debut : fin })) : [{ a: debut, b: fin }];
  return tranches.map((tr, k) => {
    const visibles = lignesVisibles(p.els, tr.a, tr.b);
    // Une étape d'une ligne révélée en plusieurs temps, remplacée avant la fin du même plan, n'est jamais montrée.
    for (const x of p.els) if (x.groupe && ROLES_LIGNE.has(x.role) && x.t >= tr.a - 1e-6 && x.t < tr.b - 1e-6 && !visibles.includes(x)) caches.add(x.id);
    const lignes = visibles.map((x) => x.texte!);
    const base = { id: k === 0 ? e.id : `${e.id}-${k + 1}`, fond: sous[k]?.fond ?? e.fond, debutMs: ms(tr.a), finMs: ms(tr.b), evenements: evenementsCales(visibles, tr.a) };
    const contenu = contenuEmotion(e.scene, base, lignes);
    return { debut: arrondi(tr.a), fin: arrondi(tr.b), sorte: "ecran" as const, ecran: contenu };
  });
}

/** Séquence de toile : schéma, heures des nœuds (la caméra de L2 en découle), séparations, coches, en-têtes, ensembles. */
function blocToile(
  id: string,
  lot: EcranPlace[],
  schema: SchemaEntree,
  carte: CarteImage,
  debut: number,
  fin: number,
  ensembleApres: EcranPlace["insertion"] | null,
  dejaPoses: Set<string>,
  format: FormatIV,
): BlocRenduIV {
  const rel = (t: number) => arrondi(Math.max(0, t - debut));
  const els = lot.flatMap((p) => p.els);
  const mots: MotParle[] = els.filter((x) => (x.role === "noeud" || x.role === "mention") && x.ref && schema.noeuds.some((n) => n.id === x.ref)).map((x) => ({ noeud: x.ref!, t: arrondi(rel(x.t) + R.avance) }));
  const separations = els.filter((x) => x.role === "separation").map((x) => ({ noeud: x.ref!, t: rel(x.t) }));
  const coches = els.filter((x) => x.role === "coche").map((x) => ({ noeud: x.ref!, t: rel(x.t) }));
  const accents = els.filter((x) => x.role === "accent" && x.ref).map((x) => ({ noeud: x.ref!, t: rel(x.t), texte: x.texte ?? "" }));
  const entetes = entetesDe(lot, debut, fin, carte);
  const ensembles: EnsembleSceneIV[] = [];
  for (const p of lot) if (p.insertion?.sorte === "ensemble") ensembles.push({ debut: rel(p.insertion.debut), fin: rel(p.insertion.fin), ...(p.insertion.allumes.length ? { allumes: p.insertion.allumes } : {}), ...(p.insertion.chiffresCles.length ? { chiffresCles: p.insertion.chiffresCles } : {}) });
  for (const p of lot) for (const r of p.relances ?? []) ensembles.push({ debut: rel(r.debut), fin: rel(r.fin), ...(r.allumes.length ? { allumes: r.allumes } : {}) });
  if (ensembleApres) ensembles.push({ debut: rel(ensembleApres.debut), fin: rel(ensembleApres.fin), ...(ensembleApres.chiffresCles.length ? { chiffresCles: ensembleApres.chiffresCles } : {}) });
  ensembles.sort((x, y) => x.debut - y.debut);
  const dureeSec = arrondi(fin - debut);
  const fond = lot[0].c.e.fond;
  const dejaVus = [...dejaPoses].filter((n) => schema.noeuds.some((x) => x.id === n) && !mots.some((m) => m.noeud === n)).sort();
  const proprietes: ProprietesToileIV = {
    largeur: ECRAN_IV.largeur,
    hauteur: CADRES_IV[format].hauteur,
    fps: R.fps,
    dureeSec,
    fond,
    marque: MARQUE,
    schema,
    mots,
    ...(separations.length ? { separations } : {}),
    ...(coches.length ? { coches } : {}),
    ...(entetes.length ? { entetes } : {}),
    ...(ensembles.length ? { ensembles } : {}),
    ...(dejaVus.length ? { dejaVus } : {}),
    ...(accents.length ? { accents } : {}),
  };
  let cadree = disposerEtCadrer(schema, mots, dureeSec, (toile) => cadrageToile(proprietes, toile));
  // La caméra (L2) ne dépasse jamais sa vitesse : si elle arrive en retard sur un bloc, le bloc attend qu'elle soit là
  // pour surgir (au plus 0,6 s après son mot), sinon il apparaîtrait en plein panoramique, ses voisins coupés au bord.
  // Retard plus long (17/10, prod : toile plus large que l'écran) : la caméra coupe franc (`coupeFranche`).
  for (let tour = 0; tour < 6; tour++) {
    let decale = false;
    for (const a of cadree.trajectoire.alertes) {
      const m = /arrive sur (\S+) ([\d.]+) s trop tard/.exec(a);
      if (!m) continue;
      const k = mots.findIndex((x) => x.noeud === m[1]);
      const el = els.find((x) => x.role === "noeud" && x.ref === m[1]);
      const retard = Number(m[2]) + 0.05;
      if (k < 0 || !el || (el.decalage ?? 0) + retard > 0.6) continue;
      el.decalage = arrondi((el.decalage ?? 0) + retard);
      el.t = arrondi(el.t + retard);
      mots[k] = { ...mots[k], t: arrondi(mots[k].t + retard) };
      decale = true;
    }
    if (!decale) {
      if (proprietes.coupeFranche || !cadree.trajectoire.alertes.some((a) => /trop tard/.test(a))) break;
      proprietes.coupeFranche = true;
    }
    mots.sort((a, b) => a.t - b.t || a.noeud.localeCompare(b.noeud));
    cadree = disposerEtCadrer(schema, mots, dureeSec, (toile) => cadrageToile(proprietes, toile));
  }
  return { id, debut, fin, sorte: "toile", proprietes, trajectoire: cadree.trajectoire, toile: cadree.toile, cadrage: cadree.cadrage };
}

/**
 * Cadrage de la caméra de la toile, comme `cadrageDeToile` de `studio-rendu/compositions/image-video/plan.ts` (L7) :
 * zoom préféré 1, décors des nœuds (icône à gauche, coche en haut à droite), nœud parlé sous l'en-tête, pastilles de
 * part (« 80 % ») au coude des flèches d'un embranchement. Valeurs et calculs recopiés (`src/` n'importe pas
 * `studio-rendu/`) et comparés par un test : la caméra contrôlée ici est celle que rend L7.
 */
export const CADRAGE_TOILE_IV = Object.freeze({
  zoomPrefere: 1,
  basEntete: BAS_ENTETE_IV,
  hautCadre: 0.275,
  rayonPastille: 46,
  apparition: AVANCE_NOEUD_IV,
  basBande: ZONE_UTILE_IV.bas,
  /** Coude des flèches d'un embranchement, écart des pastilles de part, dessin d'une flèche (s). */
  coudeMax: 110,
  ecartPart: 60,
  dessinFleche: 0.5,
  pastille: { padX: 34, padHaut: 6, padBas: 2, signe: 0.6 },
});

export function cadrageToile(p: Pick<ProprietesSceneIV, "schema" | "coches" | "entetes" | "separations" | "coupeFranche"> & { hauteur?: number }, toile?: DispositionToile): CadrageCamera {
  const K = CADRAGE_TOILE_IV;
  const icones = new Set(p.schema.noeuds.filter((n) => n.icone).map((n) => n.id));
  const coches = new Set((p.coches ?? []).map((c) => c.noeud));
  const debordIcone = 2 * K.rayonPastille - 30;
  const debordCoche = K.rayonPastille - 14;
  const marge = (MARGE_CADRE * ECRAN_IV.largeur) / ECRAN_IV.hauteur;
  const avecEntete = (p.entetes ?? []).length > 0;
  const base = {
    zoomPrefere: K.zoomPrefere,
    debord: (id: string) => ({ gauche: icones.has(id) ? debordIcone : 0, droite: coches.has(id) ? debordCoche : 0, haut: coches.has(id) ? debordCoche : 0, bas: 0 }),
    apparition: K.apparition,
    etiquettes: toile ? pastillesDePart(toile, p) : [],
    ...(p.coupeFranche ? { coupeFranche: true } : {}),
  };
  const m = miseEnPageDeHauteurIV(p.hauteur ?? ECRAN_IV.hauteur);
  if (m.format === "4:5") {
    // Comme `cadrageScene` (plan.ts, L7) : bandes de la mise en page du 4:5 ramenées en fractions de 1920 (k = 1350 / 1920).
    const k = m.hauteur / ECRAN_IV.hauteur;
    const haut = avecEntete ? (m.entete.bas + 0.03) * k : 0;
    return { ...base, bande: { haut: avecEntete ? haut + marge : m.zoneContenu.haut * k, bas: m.zoneUtile.bas * k }, cadre: { haut, bas: m.zoneUtile.bas * k } };
  }
  return {
    ...base,
    ...(avecEntete ? { bande: { haut: K.hautCadre + marge, bas: K.basBande }, cadre: { haut: K.hautCadre, bas: 1 } } : {}),
  };
}

/** Pastilles de part d'un embranchement (textes de la toile soumis au cadrage), calculées comme L7. */
function pastillesDePart(toile: DispositionToile, p: Pick<ProprietesSceneIV, "schema" | "separations">): EtiquetteToile[] {
  const K = CADRAGE_TOILE_IV;
  const branches = new Set(toile.branches.map((b) => b.id));
  const parId = new Map(toile.boites.map((b) => [b.id, b]));
  const colonne = new Map(toile.boites.map((b) => [b.id, b.colonne !== null && branches.has(b.colonne) ? b.colonne : null]));
  const part = new Map(p.schema.liens.filter((l) => typeof l.part === "number" && l.part > 0).map((l) => [l.id, l.part!]));
  const separations = [...(p.separations ?? [])].sort((a, b) => a.t - b.t || a.noeud.localeCompare(b.noeud));
  const taille = TAILLE_LIBELLE_IV * ECRAN_IV.hauteur;
  const res: EtiquetteToile[] = [];
  for (const sep of separations) {
    const d = parId.get(sep.noeud);
    if (!d) continue;
    const bas = d.y + d.hauteur;
    const versBranche = toile.fleches.filter((f) => f.de === d.id && colonne.get(f.vers) && colonne.get(f.vers) !== colonne.get(d.id));
    if (!versBranche.length) continue;
    const coude = bas + Math.min(K.coudeMax, Math.min(...versBranche.map((f) => parId.get(f.vers)!.y - bas)) / 2);
    for (const f of versBranche) {
      // Comme L7 : sans part (cartes à `part: null`), pas de pastille.
      if (!part.get(f.id)) continue;
      const b = parId.get(f.vers)!;
      const [x, y] = milieuFleche(d, b, coude);
      const texte = `${part.get(f.id)!} %`;
      const largeur = texte.length * K.pastille.signe * taille + 2 * K.pastille.padX;
      const hauteur = taille * 1.15 + K.pastille.padHaut + K.pastille.padBas;
      res.push({ id: `part-${f.id}`, noeud: sep.noeud, des: sep.t + K.dessinFleche * 0.6, x: x - largeur / 2, y: y - hauteur / 2, largeur, hauteur });
    }
  }
  return res;
}

/** Milieu d'une flèche (où L7 pose la pastille de part) : au coude d'un embranchement, sinon au milieu de la courbe. */
function milieuFleche(a: BoiteNoeud, b: BoiteNoeud, coude: number): [number, number] {
  const x1 = a.x + a.largeur / 2;
  const x2 = b.x + b.largeur / 2;
  if (b.y > coude && coude > a.y + a.hauteur) {
    const limite = a.largeur / 2 + CADRAGE_TOILE_IV.ecartPart;
    return [Math.abs(x2 - x1) <= limite ? x2 : x1 + Math.sign(x2 - x1) * limite, coude];
  }
  // Courbe de Bézier au milieu : (p0 + 3 p1 + 3 p2 + p3) / 8.
  if (b.y >= a.y + a.hauteur) {
    const y1 = a.y + a.hauteur;
    const k = Math.max(30, (b.y - y1) / 2);
    return [(x1 + 3 * x1 + 3 * x2 + x2) / 8, (y1 + 3 * (y1 + k) + 3 * (b.y - k) + b.y) / 8];
  }
  const xa = a.x + a.largeur;
  const xb = b.x + b.largeur;
  const dx = Math.max(xa, xb) + 160;
  const ya = a.y + a.hauteur / 2;
  const yb = b.y + b.hauteur / 2;
  return [(xa + 3 * dx + 3 * dx + xb) / 8, (ya + 3 * ya + 3 * yb + yb) / 8];
}

/** Objets de L8 posés dans leur bloc (instants relatifs au bloc). */
function blocObjets(id: string, lot: EcranPlace[], carte: CarteImage, debut: number, fin: number): BlocRenduIV {
  const rel = (t: number) => arrondi(Math.max(0, t - debut));
  const objets: ObjetPlanIV[] = [];
  const entetes = entetesDe(lot, debut, fin, carte);
  // Écrans consécutifs d'une même scène = un objet.
  let k = 0;
  while (k < lot.length) {
    let m = k;
    while (m + 1 < lot.length && lot[m + 1].c.e.scene === lot[k].c.e.scene) m++;
    const sous = lot.slice(k, m + 1);
    const a = sous[0].c.debut;
    const b = m + 1 < lot.length ? lot[m + 1].c.debut : fin;
    const els = sous.flatMap((p) => p.els);
    const scene = sous[0].c.e.scene;
    if (scene === "entonnoir") {
      const source = sourceEnNombre(carte);
      const moteur = carte.noeuds.find((n) => n.role === "moteur");
      const sorties = sortiesEnNombre(carte);
      const quantite = source?.quantite ?? 2;
      const chutes = els.filter((x) => x.role === "chute").map((x) => rel(x.t));
      const sortie = (n?: NoeudCarte): SortiePlanIV => ({ libelle: carte.groupes.find((g) => g.noeuds.includes(n?.id ?? ""))?.titre ?? n?.libelle ?? "", compte: n?.quantite ?? 0, couleur: n?.couleur === "orange" ? "orange" : n?.couleur ?? "noir" });
      objets.push({ debut: rel(a), fin: rel(b), sorte: "entonnoir", proprietes: { quantite, icone: (source?.icone && iconeDe(source.icone)) || "document", moteur: (moteur?.libelle ?? "IA").split(/\s+/)[0], sorties: [sortie(sorties[0]), sortie(sorties[1])], chutes } });
    } else if (scene === "nuee") {
      const source = sourceEnNombre(carte);
      const coches = els.filter((x) => x.role === "coche-nuee").map((x) => x.t);
      // La nuée apparaît sur le mot qui la dit (la source, ou sa quantité : « 20 »), s'il tombe avant la première coche, et au plus
      // tard 2 s après le début de l'écran (issue 119) : sinon seul l'en-tête est visible tant que le mot n'est pas dit.
      const quantite = source?.quantite ?? 2;
      const dite = els.find((x) => (x.ref === source?.id || (x.role === "accent" && x.chiffres.some((k) => k.split("|")[0] === String(quantite)))) && x.t < (coches[0] ?? b));
      const distinctions = els.filter((x) => x.role === "distinction").map((x) => rel(x.t));
      objets.push({
        debut: rel(a),
        fin: rel(b),
        sorte: "nuee",
        proprietes: {
          quantite,
          cochees: coches.length,
          icone: (source?.icone && iconeDe(source.icone)) || "document",
          apparition: rel(dite ? Math.min(dite.t, a + APPARITION_NUEE_MAX_SEC) : a),
          debutCoches: rel(coches[0] ?? a),
          finCoches: rel(coches[coches.length - 1] ?? a),
          ...(distinctions.length ? { distinctions } : {}),
        },
      });
    } else if (scene === "ecran-partage") {
      const avant = carte.groupes.find((g) => g.sorte === "avant");
      const apres = carte.groupes.find((g) => g.sorte === "apres");
      const bascule = els.find((x) => x.role === "bascule")?.t ?? (a + b) / 2;
      const ligneDe = (x: El) => {
        const n = x.ref ? carte.noeuds.find((y) => y.id === x.ref) : undefined;
        const texte = n ? n.libelle.replace(x.texte ?? "", "").replace(/[:—–\s]+$/u, "").replace(/^[:—–\s]+/u, "").trim() : undefined;
        return { ...(texte ? { texte } : {}), valeur: carte.chiffres.find((ch) => ch.dansNoeud === x.ref)?.brut ?? x.texte, ...(n && iconeDe(n.icone ?? "") === "coche" ? { coche: true } : {}), t: rel(x.t) };
      };
      const chiffres = els.filter((x) => x.role === "chiffre");
      objets.push({
        debut: rel(a),
        fin: rel(b),
        sorte: "ecran-partage",
        proprietes: {
          bascule: rel(bascule),
          avant: { titre: avant?.titre ?? "Avant", lignes: chiffres.filter((x) => avant?.noeuds.includes(x.ref ?? "")).map(ligneDe) },
          apres: { titre: apres?.titre ?? "Après", lignes: chiffres.filter((x) => !avant?.noeuds.includes(x.ref ?? "")).map(ligneDe) },
        },
      });
    } else {
      const termes = els.filter((x) => x.role === "terme").map((x) => ({ libelle: x.texte ?? "", valeur: carte.chiffres.find((ch) => ch.dansNoeud === x.ref)?.valeur ?? 0, t: rel(x.t) }));
      const total = els.find((x) => x.role === "total");
      if (total) total.genre = "chiffre";
      const chTotal = carte.chiffres.find((ch) => ch.dansNoeud === total?.ref);
      const unite = carte.chiffres.find((ch) => ch.dansNoeud === els.find((x) => x.role === "terme")?.ref)?.unite ?? "";
      const detail = els.find((x) => x.role === "detail");
      const valeur = els.find((x) => x.role === "valeur-detail");
      objets.push({
        debut: rel(a),
        fin: rel(b),
        sorte: "additionneur",
        proprietes: {
          termes,
          unite,
          total: { valeur: chTotal?.valeur ?? termes.reduce((s, x) => s + x.valeur, 0), t: rel(total?.t ?? b - 1) },
          ...(detail ? { detail: { libelle: detail.texte ?? "", ...(valeur ? { valeur: valeur.texte ?? "", tValeur: rel(valeur.t) } : {}), t: rel(detail.t) } } : {}),
        },
      });
    }
    k = m + 1;
  }
  return { id, debut, fin, sorte: "objets", fond: lot[0].c.e.fond, entetes, objets };
}

/** En-têtes d'un lot d'écrans (toile ou objets), instants relatifs au bloc. */
function entetesDe(lot: EcranPlace[], debut: number, fin: number, carte: CarteImage): EnteteSceneIV[] {
  const rel = (t: number) => arrondi(Math.max(0, t - debut));
  const bruts = lot.flatMap((p) => p.els.filter((x) => x.role === "entete")).map((x) => {
    const [etiquette, titre] = (x.texte ?? "").split("|");
    // Texte « étiquette|titre » : l'étiquette est déjà décidée (éventuellement vide, par `etiquetteDeRepli` avec la scène de SON écran) ; le repli ne sert qu'au texte sans « | ».
    return { t: rel(x.t), etiquette: (x.texte ?? "").includes("|") ? etiquette : etiquette || etiquetteDeRepli(carte, lot[0]?.c.e.scene), titre: titre || etiquette };
  });
  return bruts.map((x, k) => ({ debut: x.t, fin: k + 1 < bruts.length ? bruts[k + 1].t : rel(fin), etiquette: x.etiquette, titre: x.titre }));
}

/** Moments de L9a (instants relatifs au bloc). */
function blocMoments(id: string, lot: EcranPlace[], carte: CarteImage, debut: number, fin: number, schema: SchemaEntree): BlocRenduIV {
  const rel = (t: number) => arrondi(Math.max(0, t - debut));
  const p0 = lot[0];
  const e = p0.c.e;
  const els = lot.flatMap((p) => p.els);
  const fond: Fond = e.scene === "bandeau-chiffres" || e.scene === "phrase-choc" ? "sombre" : e.fond;
  const ent = els.filter((x) => x.role === "entete");
  const entetes = ent.map((x) => {
    const [etiquette, titre] = (x.texte ?? "").split("|");
    return { t: x.t, entete: { etiquette: (x.texte ?? "").includes("|") ? etiquette : etiquette || etiquetteDeRepli(carte, e.scene), titre: titre || etiquette } };
  });
  let corps: MomentIV;
  // Un écran « carte-bénéfice » qui cite plusieurs bénéfices est un récapitulatif (`sorteDe`) : jamais un moment vide.
  if (p0.sorte === "recap") corps = { sorte: "recap", benefices: beneficesDe(carte) };
  else if (SCENES_BENEFICES.has(e.scene)) {
    // Un micro-objet se pose SUR sa carte : celle d'un écran précédent (autre fond, autre moment) revient avec lui.
    const cartes = [...els.filter((x) => x.role === "carte"), ...els.filter((x) => x.role === "micro" && !els.some((y) => y.role === "carte" && y.ref === x.ref))];
    const ids = cartes.map((x) => x.ref!);
    const micros = microObjetsDe(els.filter((x) => x.role === "micro"), carte).map((m) => ({ ...m, t: rel(m.t) }));
    corps = {
      sorte: "benefices",
      // Le micro-objet de chaque carte est posé SUR la carte (`micro`) : c'est lui que le composant lit (place sous la
      // carte, texte ajusté pour la lui laisser) ; sans lui, une carte longue débordait dans les sous-titres (Q21).
      benefices: beneficesDe(carte, ids).map((b) => {
        const m = micros.find((x) => x.carte === b.id);
        return m ? { ...b, micro: m.nom } : b;
      }),
      heures: cartes.map((x) => rel(x.t)),
      microObjets: micros,
      heuresLignes: ids.map((cid) => rel(els.find((x) => x.role === "ligne-carte" && x.ref === cid)?.t ?? cartes.find((x) => x.ref === cid)!.t)),
    };
  } else if (e.scene === "bandeau-chiffres") {
    corps = {
      sorte: "bandeau",
      etiquette: "Résultat",
      chiffres: els.filter((x) => x.role === "bandeau").map((x) => {
        const legende = carte.bandeau.find((b) => b.includes(x.texte ?? "\u0000"))?.replace(x.texte ?? "", "").replace(/^[\s=·:]+|[\s=·:]+$/g, "").trim();
        return { texte: x.texte ?? "", ...(legende ? { legende } : {}), t: rel(x.t) };
      }),
    };
  } else if (e.scene === "phrase-choc") {
    corps = phraseChocDe(lot, rel);
  } else if (e.scene === "recherche") {
    const frappe = els.find((x) => x.role === "frappe");
    const trouve = els.find((x) => x.role === "trouve");
    const mots = frappe ? [frappe, ...els.filter((x) => x.role === "frappe-mot")].map((x) => rel(x.t)) : [];
    corps = {
      sorte: "recherche",
      requete: frappe?.texte ?? "",
      frappe: rel(frappe?.t ?? p0.c.debut),
      ...(mots.length > 1 ? { mots } : {}),
      ...(trouve ? { trouve: { texte: trouve.texte ?? "", t: rel(trouve.t) } } : {}),
    };
  } else if (e.scene === "alerte") {
    const a = els.find((x) => x.role === "alerte");
    const n = carte.noeuds.find((x) => x.id === a?.ref);
    const { source, message } = sourceEtMessageAlerte(n);
    const declencheurs = els.filter((x) => x.role === "declencheur").map((x) => ({ texte: x.texte ?? "", t: rel(x.t) }));
    const ecrit = els.find((x) => x.role === "message");
    corps = { sorte: "alerte", source, message, t0: rel(a?.t ?? p0.c.debut), ...(ecrit ? { frappe: rel(ecrit.t) } : {}), ...(declencheurs.length ? { declencheurs } : {}), ...tamponDe(els, rel) };
  } else if (e.scene === "email") {
    // Le champ posé pour un bloc sans sous-éléments (son libellé) s'écrit en entier, sans barres ; les champs écrits en
    // liste à l'écran se remplissent de barres.
    const libre = (x: El) => { const n = carte.noeuds.find((y) => y.id === x.ref); return !!n && !n.sousElements?.length && x.texte === n.libelle; };
    corps = { sorte: "email", champs: els.filter((x) => x.role === "champ").map((x) => ({ nom: x.texte ?? "", t: rel(x.t), ...(libre(x) ? { libre: true as const } : {}) })), ...tamponDe(els, rel) };
  } else if (e.scene === "dossiers") {
    corps = { sorte: "dossiers", dossiers: els.filter((x) => x.role === "dossier").map((x) => ({ nom: x.texte ?? "", t: rel(x.t) })) };
  } else if (e.scene === "sources") {
    const cible = carte.noeuds.find((n) => n.role === "etape" && n.groupe === carte.noeuds.find((x) => x.id === els.find((y) => y.role === "source")?.ref)?.groupe) ?? carte.noeuds.find((n) => n.role === "moteur");
    corps = {
      sorte: "sources",
      sources: els.filter((x) => x.role === "source").map((x) => {
        const n = carte.noeuds.find((y) => y.id === x.ref);
        return { icone: (n?.icone && iconeDe(n.icone)) || "document", ...(x.texte ? { nom: x.texte } : {}), t: rel(x.t) };
      }),
      cible: { icone: (cible?.icone && iconeDe(cible.icone)) || "document" },
    };
  } else {
    corps = { sorte: "ensemble", schema, options: {} };
  }
  // Un moment par en-tête (le second relance le plan) ; sans en-tête, un seul.
  const tranches = entetes.length ? entetes.map((x, k) => ({ a: k === 0 ? debut : x.t, b: k + 1 < entetes.length ? entetes[k + 1].t : fin, entete: x.entete })) : [{ a: debut, b: fin, entete: undefined }];
  const moments: MomentPlanIV[] = tranches.map((tr) => ({ ...corps, debut: rel(tr.a), fin: rel(tr.b), fond, ...(tr.entete ? { entete: tr.entete } : {}) }) as MomentPlanIV);
  return { id, debut, fin, sorte: "moments", moments };
}

/** Micro-objets des cartes : proposition déterministe de la banque fermée (L9b), deux cartes jamais le même. */
function microObjetsDe(els: El[], carte: CarteImage): { carte: string; nom: NomMicroObjet; t: number }[] {
  const pris: NomMicroObjet[] = [];
  const res: { carte: string; nom: NomMicroObjet; t: number }[] = [];
  for (const x of els) {
    const n = carte.noeuds.find((y) => y.id === x.ref);
    if (!n) continue;
    const nom = proposerMicroObjet(`${n.libelle} ${n.detail ?? ""}`, pris);
    if (!nom) continue;
    pris.push(nom);
    res.push({ carte: n.id, nom, t: x.t });
  }
  return res;
}

/** Étapes du tampon dessiné d'un moment (« Envoyé ✓ », « Lu ✓ ») : un seul tampon par moment ; seul, ou en nombre pair, il finit sur « Envoyé » / « Lu » ; en nombre impair, sur « Prêt » / « Reçu ». */
function tamponDe(els: readonly El[], rel: (t: number) => number): { tampon?: { texte: string; t: number }[] } {
  const x = els.filter((y) => y.role === "tampon" && y.ecran === els.find((z) => z.role === "tampon")?.ecran);
  return x.length ? { tampon: x.map((y) => ({ texte: y.texte ?? "", t: rel(y.t) })) } : {};
}

/** Phrase-choc : les textes d'écran bout à bout, un seul mot orange (le dernier), chaque mot affiché à l'heure du mot dit qui lui correspond. */
function phraseChocDe(lot: EcranPlace[], rel: (t: number) => number): MomentIV {
  const morceaux = lot.map((p) => p.c.e.textesEcran.join(" "));
  const dernierOrange = morceaux.map((m) => m.includes("*")).lastIndexOf(true);
  const phrase = morceaux.map((m, k) => (k === dernierOrange ? m : sansBalises(m))).join(" ");
  const heures: number[] = [];
  lot.forEach((p, k) => {
    const affiches = morceaux[k].split(/\s+/).filter(Boolean);
    const n = p.c.mots.length;
    const premier = heures.length;
    affiches.forEach((_, j) => {
      const r = Math.min(n - 1, Math.floor((j * n) / Math.max(1, affiches.length)));
      heures.push(rel(p.c.mots[Math.max(0, r)]?.debutSec ?? p.c.debut));
    });
    // Un chiffre affiché claque sur le mot qui le dit (son accent) : ses mots (« 80 », « % ») s'écrivent à cette heure,
    // ceux d'avant au plus tard, ceux d'après au plus tôt.
    for (const a of p.els.filter((x) => x.role === "accent")) {
      const valeur = a.chiffres[0]?.split("|")[0];
      const j = affiches.findIndex((m) => sansBalises(m).replace(/[^\d,.]/g, "").replace(",", ".") === valeur);
      if (j < 0) continue;
      const h = rel(a.t);
      for (let q = 0; q < affiches.length; q++) {
        const i = premier + q;
        if (q < j) heures[i] = Math.min(heures[i], h);
        else if (q === j || (q === j + 1 && /^[%€$*]+$/.test(affiches[q]))) heures[i] = h;
        else heures[i] = Math.max(heures[i], h);
      }
    }
  });
  return { sorte: "phrase-choc", phrase, heures };
}

/* ------------------------------------------------------------------ */
/* 8. Événements                                                         */
/* ------------------------------------------------------------------ */

function construireEvenements(places: EcranPlace[], finEls: El[], plans: PlanIV[], blocs: BlocRenduIV[], finVoix: number, caches: ReadonlySet<string> = new Set()): EvenementTempsIV[] {
  const evs: EvenementTempsIV[] = [];
  const planA = (t: number) => plans.find((p) => t >= p.debut - 1e-6 && t < p.fin - 1e-6) ?? plans[plans.length - 1];
  const ajouter = (x: Omit<EvenementTempsIV, "plan">) => evs.push({ ...x, plan: planA(x.instantSec)?.id ?? "" });
  for (const x of [...places.flatMap((p) => p.els), ...finEls]) {
    ajouter({ id: x.id, genre: x.role === "mention" ? "camera" : x.genre, instantSec: arrondi(x.t), visible: x.visible && !caches.has(x.id), ecran: x.ecran, ...(x.ref ? { ref: x.ref } : {}), ...(x.texte ? { texte: x.texte } : {}), chiffres: x.chiffres, ...(x.remplissage ? { remplissage: true as const } : {}) });
  }
  // Changements de plan : de scène (nouveau composant) ou de fond.
  plans.forEach((p, k) => {
    const avant = plans[k - 1];
    if (!avant) {
      ajouter({ id: `scene-${p.id}`, genre: "scene", instantSec: p.debut, visible: true, chiffres: [] });
      return;
    }
    if (avant.fond !== p.fond) ajouter({ id: `fond-${p.id}`, genre: "fond", instantSec: p.debut, visible: true, chiffres: [] });
    // Un nouvel écran v4 (écran de la fiche, sous-écran, écran de fin) remplace le précédent : changement de scène.
    else if (avant.sorte !== p.sorte || avant.scene !== p.scene || p.coupe === "insertion" || ((p.sorte === "emotion" || p.sorte === "fin") && p.ecran !== avant.ecran)) ajouter({ id: `scene-${p.id}`, genre: "scene", instantSec: p.debut, visible: true, chiffres: p.sorte === "ensemble" ? p.textes.flatMap((t) => clesDuTexte(t)) : [] });
  });
  // Additionneur : le total compte (rafale de tics).
  for (const b of blocs) {
    if (b.sorte !== "objets") continue;
    for (const o of b.objets) {
      if (o.sorte === "additionneur") ajouter({ id: `${b.id}-total`, genre: "compteur", instantSec: arrondi(b.debut + o.proprietes.total.t), pas: 3, finSec: arrondi(b.debut + o.proprietes.total.t + 0.6), visible: true, chiffres: [] });
    }
  }
  // Caméra : chaque mouvement ; « marqué » au-delà d'un demi-écran (souffle). Jamais compté pour le rythme.
  for (const b of blocs) {
    if (b.sorte !== "toile") continue;
    const im = b.trajectoire.images;
    for (let k = 1; k < im.length; k++) {
      const a = im[k - 1];
      const c = im[k];
      if (a.cx === c.cx && a.cy === c.cy && a.zoom === c.zoom) continue;
      const z = Math.max(a.zoom, c.zoom);
      const d = Math.hypot(((c.cx - a.cx) * z) / ECRAN_IV.largeur, ((c.cy - a.cy) * z) / ECRAN_IV.hauteur);
      ajouter({ id: `${b.id}-camera-${k}`, genre: "camera", instantSec: arrondi(b.debut + a.t), marque: d > 0.5, visible: false, chiffres: [] });
    }
  }
  // La marque se pose après le dernier mot (phrase-choc ou dernière phrase de la fin).
  ajouter({ id: "marque-fin", genre: "objet", instantSec: arrondi(finVoix + 0.4), visible: true, texte: MARQUE, chiffres: [] });
  return evs.sort((a, b) => a.instantSec - b.instantSec || a.id.localeCompare(b.id));
}

/* ------------------------------------------------------------------ */
/* 9. Repère                                                             */
/* ------------------------------------------------------------------ */

function construireRepere(places: EcranPlace[], fiche: FicheImage, carte: CarteImage): RepereIV | null {
  if (fiche.chapitres.length) {
    const changements = fiche.chapitres
      .map((ch, k) => {
        const p = places.find((x) => x.c.e.id === ch.ecrans[0]);
        return p ? { t: arrondi(p.insertion?.debut ?? p.c.debut), numero: k + 1 } : null;
      })
      .filter((x): x is { t: number; numero: number } => !!x);
    return { changements, total: fiche.chapitres.length };
  }
  const cartes = places.flatMap((p) => p.els.filter((x) => x.role === "carte"));
  if (carte.types[0] === "benefices" && cartes.length) return { changements: cartes.map((x, k) => ({ t: x.t, numero: k + 1 })), total: carte.noeuds.filter((n) => n.role === "benefice").length };
  if (carte.types[0] === "chaine") {
    const etapes = carte.noeuds.filter((n) => n.role === "etape").map((n) => n.id);
    const poses = places.flatMap((p) => p.els.filter((x) => x.role === "noeud" && etapes.includes(x.ref ?? "")));
    if (poses.length) return { changements: poses.map((x, k) => ({ t: x.t, numero: k + 1 })), total: etapes.length, prefixe: "Étape" };
  }
  return null;
}

export { cleChiffre, clesDeLaCarte, clesDuTexte, REGLES_SCENE_IV };
