/**
 * IMAGE → VIDÉO · Relecture des images finales par Claude face à l'image source (lot L13, plan 50 § 7 Q26, critique I8).
 *
 * 1. INSTANTS CLÉS d'une version, lus sur sa ligne de temps (PUR) : un par bloc de la carte (juste après son
 *    apparition), un par charnière (vue d'ensemble, récapitulatif, ouverture du segment de fin), un par chiffre-choc
 *    (écran « chiffre », bandeau, phrase-choc), et la fin ; 24 au plus.
 * 2. EXTRACTION par l'opération EXISTANTE du serveur de rendu : `controle` avec `etape: "images"`, la même demande que
 *    `montage-facecam/chaine.ts` (~778 : `soumettre("controle", { source, depots, parametres: { etape: "images",
 *    instants, largeur: 540, cles } })`). Aucune opération nouvelle. Une extraction ratée, ou une image manquante, est
 *    un REFUS (jamais « livrée sans relecture » comme en face caméra).
 * 3. RELECTURE par Claude (vision, outil injecté) : l'image source + les images extraites, questions FERMÉES par image
 *    (tout est-il montré ? quelque chose de faux ? d'illisible ? hors charte ?). Toute réponse « manque », « faux » ou
 *    « illisible » = refus ; « hors charte » et les suggestions sont indicatives. Une image sans réponse = refus.
 *
 * ARGENT : le pire coût de chaque appel Claude est RÉSERVÉ avant l'appel (`pireCasRole`) ; refus de réservation =
 * aucun appel, contrôle « non fait » (donc bloquant). Une réponse illisible est relancée une fois (réservée elle aussi).
 * Chaque tentative (relance comprise) a son PROPRE identifiant d'appel, donné par l'outil injecté `idAppel` : une
 * reprise après une relecture interrompue ne réutilise jamais la réservation d'un appel déjà parti.
 * Aucun nom de fichier ni aucune clé de stockage ne part vers Claude.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import type { ImageClaude } from "@/fournisseurs/claude/client";
import { MODELE_ECRITURE } from "@/fournisseurs/claude/tarifs";
import { pireCasRole, type DefinitionRole, type EntreeRole } from "@/generateur/roles/types";
import type { CarteImage } from "@/domaine/image-video/carte";
import type { ReponseAppelLecture } from "./lecture";
import type { BudgetControlesIV, ConstatControle } from "./ecoute";
import { sourceEtMessageAlerte, type LigneDeTempsIV } from "./mise-en-scene";

/** 24 images clés au plus par version (plan § 7, Q26). */
export const IMAGES_CLES_MAX = 24;
/** Largeur des images extraites (comme la relecture de la face caméra). */
export const LARGEUR_IMAGES_CONTROLE = 540;
/** Deux instants plus proches que cela n'en font qu'un. */
const ECART_MIN_SEC = 0.25;
/** Un mot de la phrase-choc entre en ~0,34 s à partir de son heure (plan-objets.ts, planPhraseChoc) : marge de 0,35 s. */
export const ENTREE_MOT_SEC = 0.35;
export const ETAPE_RELECTURE = "relecture-finale-iv";
export const APPELS_RELECTURE_MAX = 2;

export type SorteInstantIV = "fin" | "phrase-choc" | "chiffre" | "bloc" | "charniere";

export interface InstantCleIV {
  /** « i01 », « i02 »… dans l'ordre du temps. */
  nom: string;
  instantSec: number;
  sorte: SorteInstantIV;
  /** Ce que l'image doit montrer (lu par Claude juste avant l'image). */
  legende: string;
  /** Id de la carte concerné (bloc). */
  ref?: string;
}

const PRIORITE: Record<SorteInstantIV, number> = { fin: 0, "phrase-choc": 1, chiffre: 2, bloc: 3, charniere: 4 };
const arrondi = (x: number) => Math.round(x * 1000) / 1000;
/** Segment de fin : image prise au plus tôt 1,0 s après son début et 0,5 s après le dernier élément de son écran (la question est alors entièrement entrée). */
const OUVERTURE_FIN_SEC = 1.0;
const APRES_DERNIER_FIN_SEC = 0.5;
/** Bloc : marge avant la fin de son écran, pour ne pas tomber dans le fondu de sortie de l'en-tête (0,15 s). */
const MARGE_FIN_PLAN_BLOC = 0.2;

/**
 * Instants clés d'une version (PUR, déterministe). Priorité quand il y en a plus de 24 : la fin, la phrase-choc, les
 * chiffres-chocs, les blocs (dans l'ordre d'apparition), puis les charnières.
 */
export function instantsClesIV(l: Pick<LigneDeTempsIV, "plans" | "evenements" | "dureeSec" | "segmentFin"> & Partial<Pick<LigneDeTempsIV, "blocs">>, carte: Pick<CarteImage, "noeuds">): InstantCleIV[] {
  const brut: Omit<InstantCleIV, "nom">[] = [];
  const dansPlan = (t: number) => {
    const p = l.plans.find((x) => t >= x.debut - 1e-9 && t < x.fin - 1e-9);
    return p ? Math.min(t, p.fin - 0.05) : t;
  };
  const milieu = (p: { debut: number; fin: number }) => p.debut + Math.min(0.6, (p.fin - p.debut) / 2);
  // Dernier élément visible d'un écran : événements montrés, mots de la phrase-choc et chiffres du bandeau (qui
  // n'apparaissent qu'à l'heure où la voix les dit). Absent si l'écran n'a rien de daté.
  const dernierElement = (p: { debut: number; fin: number }): number | null => {
    let dernier: number | null = null;
    const noter = (t: number) => {
      if (t >= p.debut - 1e-6 && t < p.fin - 1e-6) dernier = dernier === null ? t : Math.max(dernier, t);
    };
    for (const e of l.evenements) if (e.visible && e.genre !== "scene" && e.genre !== "fond" && e.genre !== "camera") noter(e.instantSec);
    for (const b of l.blocs ?? []) {
      if (b.sorte !== "moments") continue;
      for (const m of b.moments) {
        // Une phrase-choc ou un bandeau peut couvrir plusieurs écrans : `noter` borne chaque heure à l'écran demandé.
        if (m.sorte === "phrase-choc") for (const h of m.heures) noter(b.debut + h);
        else if (m.sorte === "bandeau") for (const c of m.chiffres) noter(b.debut + c.t);
      }
    }
    return dernier;
  };
  /**
   * Image d'un écran de texte : après son dernier élément + `apres`, sans dépasser la fin de l'écran − 0,05 s. Un mot met
   * ~0,34 s à entrer : si le dernier mot de l'écran est dit trop près de sa fin ET que l'écran suivant continue la même
   * scène, aucune image ici (celle de l'écran suivant montre toute la phrase déjà dite). `null` = pas d'image.
   */
  const apresDernier = (p: { debut: number; fin: number; scene?: string }, apres: number): number | null => {
    const d = dernierElement(p);
    if (d === null) return milieu(p);
    const suivant = l.plans.find((x) => Math.abs(x.debut - p.fin) < 1e-6);
    if (d + ENTREE_MOT_SEC > p.fin - 0.05 && suivant && suivant.scene === p.scene) return null;
    return Math.max(p.debut, Math.min(d + apres, p.fin - 0.05));
  };
  // Blocs : juste après l'apparition du bloc.
  const vus = new Set<string>();
  const evts = [...l.evenements].filter((e) => e.visible && e.ref && e.genre !== "camera").sort((a, b) => a.instantSec - b.instantSec || (a.ref ?? "").localeCompare(b.ref ?? ""));
  for (const n of carte.noeuds) {
    if (n.photoPersonnes) continue;
    const e = evts.find((x) => x.ref === n.id);
    if (!e || vus.has(n.id)) continue;
    vus.add(n.id);
    // Après la fin de l'animation d'apparition du bloc : dernier élément posé sur ce bloc DANS L'ÉCRAN (plan) de sa première
    // apparition + 0,6 s, borné à ce plan (fin − 0,05 s) : l'image ne tombe jamais sur un autre écran.
    const pE = l.plans.find((x) => e.instantSec >= x.debut - 1e-9 && e.instantSec < x.fin - 1e-9);
    const dernierDuBloc = Math.max(e.instantSec, ...evts.filter((x) => x.ref === n.id && x.plan === e.plan).map((x) => x.instantSec));
    // Bloc apparu dans les 50 dernières ms de son écran : pas d'image (elle tomberait avant son apparition).
    if (pE && pE.fin - 0.05 < e.instantSec) continue;
    // Jamais dans le fondu de sortie de l'en-tête (fin − 0,2 s) ni après le départ de la caméra vers un autre bloc (− 0,05 s),
    // mais jamais avant le dernier élément + 0,3 s (plancher, borné à la fin de l'écran − 0,05 s).
    const depart = l.evenements.find((x) => x.genre === "camera" && x.instantSec > dernierDuBloc + 1e-6)?.instantSec ?? Infinity;
    const vise = pE ? Math.min(dernierDuBloc + 0.6, depart - 0.05, pE.fin - MARGE_FIN_PLAN_BLOC) : dernierDuBloc + 0.6;
    const plancher = pE ? Math.min(dernierDuBloc + 0.3, pE.fin - 0.05) : 0;
    // Légende « notification » seulement si le nœud est dessiné comme la notification : écran de scène « alerte » et nœud désigné
    // par `noeudAlerte` (mise-en-scene.ts), qui reçoit l'événement de genre « alerte ». Sinon, légende générique de bloc.
    const legende = pE?.scene === "alerte" && e.genre === "alerte"
      ? (() => { const a = sourceEtMessageAlerte(n); return a.messageDit ? `La notification « ${a.source} : ${a.messageDit} » est à l'écran, entière et lisible.` : `La notification « ${a.source} » est à l'écran, entière et lisible.`; })()
      : `Le bloc « ${n.libelle} » est à l'écran, entier et lisible.`;
    brut.push({ instantSec: pE ? Math.max(pE.debut, e.instantSec, plancher, vise) : dansPlan(dernierDuBloc + 0.6), sorte: "bloc", legende, ref: n.id });
  }
  for (const p of l.plans) {
    const apres = p.scene === "phrase-choc" || p.scene === "chiffre" || p.scene === "bandeau-chiffres" ? apresDernier(p, 0.5) : null;
    if (p.scene === "phrase-choc") {
      if (apres !== null) brut.push({ instantSec: apres, sorte: "phrase-choc", legende: "La phrase-choc de l'image, en entier." });
    } else if (p.scene === "chiffre" || p.scene === "bandeau-chiffres") {
      if (apres !== null) brut.push({ instantSec: apres, sorte: "chiffre", legende: `Chiffre-choc : ${p.textes.map((t) => t.replace(/\*/g, "")).join(" · ") || "le chiffre de l'écran"}.` });
    } else if (p.sorte === "ensemble" || p.sorte === "recap") brut.push({ instantSec: milieu(p), sorte: "charniere", legende: p.sorte === "ensemble" ? "Vue d'ensemble du schéma (sans texte à lire)." : "Récapitulatif." });
  }
  const pF = l.plans.find((x) => l.segmentFin.debut >= x.debut - 1e-6 && l.segmentFin.debut < x.fin - 1e-6);
  const dernierF = pF ? dernierElement(pF) : null;
  const ouvertureFin = Math.max(l.segmentFin.debut, Math.min(Math.max(l.segmentFin.debut + OUVERTURE_FIN_SEC, dernierF === null ? 0 : dernierF + APRES_DERNIER_FIN_SEC), (pF?.fin ?? Infinity) - 0.05));
  if (!l.segmentFin.muet && l.segmentFin.debut < l.dureeSec) brut.push({ instantSec: ouvertureFin, sorte: "charniere", legende: "Ouverture du segment de fin (question de commentaire)." });
  // Fin FIN-C (boucle, variété) : la dernière image reprend la première, c'est voulu ; la légende le dit exactement.
  const finEnBoucle = (l.blocs ?? []).some((b) => b.sorte === "variete" && b.axe === "fin" && b.code === "FIN-C");
  brut.push({ instantSec: Math.max(0, l.dureeSec - 0.3), sorte: "fin", legende: l.segmentFin.muet ? (finEnBoucle ? "Dernière image : la vidéo s'arrête sur la phrase-choc en entier, posée sur l'image d'ouverture reprise (boucle voulue), et la marque." : "Dernière image : la vidéo s'arrête sur la phrase-choc et la marque, rien d'autre.") : "Dernière image de la vidéo : la fin du réseau." });

  const bornes = brut.map((b) => ({ ...b, instantSec: arrondi(Math.min(Math.max(0, b.instantSec), Math.max(0, l.dureeSec - 0.04))) }));
  const choisis: Omit<InstantCleIV, "nom">[] = [];
  const ordre = bornes.map((b, i) => ({ b, i })).sort((x, y) => PRIORITE[x.b.sorte] - PRIORITE[y.b.sorte] || x.i - y.i);
  for (const { b } of ordre) {
    if (choisis.length >= IMAGES_CLES_MAX) break;
    if (choisis.some((c) => Math.abs(c.instantSec - b.instantSec) < ECART_MIN_SEC)) continue;
    choisis.push(b);
  }
  return choisis.sort((a, b) => a.instantSec - b.instantSec).map((b, k) => ({ nom: `i${String(k + 1).padStart(2, "0")}`, ...b }));
}

/* ------------------------------------------------------------------ */
/* Extraction : opération existante `controle` / `etape: "images"`      */
/* ------------------------------------------------------------------ */

/**
 * Demande à l'opération EXISTANTE `controle` du serveur de rendu, à l'identique de la face caméra
 * (`montage-facecam/chaine.ts`) : le service la soumet par `soumettre("controle", { source, depots, parametres })`.
 */
export interface DemandeImagesControleIV {
  operation: "controle";
  /** Clé du fichier FINAL de la version (le service en fait une adresse de lecture). */
  source: string;
  parametres: { etape: "images"; instants: { nom: string; instantSec: number }[]; largeur: number; cles: Record<string, string> };
}

export function demandeImagesControleIV(videoId: string, version: string, fichierCle: string, instants: readonly InstantCleIV[]): DemandeImagesControleIV {
  return {
    operation: "controle",
    source: fichierCle,
    parametres: {
      etape: "images",
      instants: instants.map((i) => ({ nom: i.nom, instantSec: i.instantSec })),
      largeur: LARGEUR_IMAGES_CONTROLE,
      cles: Object.fromEntries(instants.map((i) => [i.nom, `image-video/${videoId}/controle/${version}/${i.nom}.jpg`])),
    },
  };
}

export interface OutilsRelectureIV {
  /** Soumet la demande à l'opération existante et rend les images rangées ; lève (ou rend moins d'images) si raté. */
  extraireImages: (demande: DemandeImagesControleIV) => Promise<{ images: { nom: string; cle: string }[] }>;
  /** Octets d'une image rangée (extraite, ou l'image source). */
  lireImage: (cle: string) => Promise<{ octets: Uint8Array; type: ImageClaude["type"] } | null>;
  /** UN appel du rôle, par le chemin de dépense du studio (double en simulation). */
  appeler: (role: DefinitionRole, entree: EntreeRole) => Promise<ReponseAppelLecture>;
  budget: BudgetControlesIV;
  /**
   * Identifiant UNIQUE d'une tentative d'appel, à partir d'un préfixe lisible (le service branche `nouvelId` de
   * `src/lib/ids`) : jamais deux fois le même, d'une tentative, d'une relance ou d'une exécution à l'autre, pour que
   * chaque appel Claude ait sa propre réservation.
   */
  idAppel: (prefixe: string) => string;
}

/* ------------------------------------------------------------------ */
/* Rôle Claude                                                           */
/* ------------------------------------------------------------------ */

export const schemaRelectureFinale = z.object({
  /** Une réponse par image extraite, dans l'ordre. */
  images: z.array(
    z.object({
      nom: z.string(),
      /** Ce que la légende annonce est-il à l'écran ? */
      toutMontre: z.boolean(),
      /** Vide si rien ne manque ; sinon ce qui manque par rapport à l'image source (« 20 % »). */
      manque: z.string(),
      /** Vide si rien n'est faux ; sinon ce qui contredit l'image source (chiffre, libellé, sens d'une flèche). */
      faux: z.string(),
      /** Vide si tout se lit ; sinon le texte coupé, trop petit ou masqué. */
      illisible: z.string(),
      /** Vide si l'image respecte la charte ; sinon l'écart (indicatif). */
      horsCharte: z.string(),
      /** Suggestion facultative (indicative). */
      suggestion: z.string(),
    }),
  ),
  /** Élément de l'image source absent de TOUTES les images (vide si aucun). */
  absentDeLaVideo: z.string(),
});
export type RelectureFinale = z.infer<typeof schemaRelectureFinale>;

export const CONSIGNE_RELECTURE_FINALE = `Tu relis les images clés d'une vidéo motion design d'Axion-IA qui raconte une infographie. La PREMIÈRE image jointe est l'infographie source ; les suivantes sont des images extraites de la vidéo finale, chacune précédée de son nom et de ce qu'elle doit montrer.

Pour CHAQUE image extraite, réponds aux questions fermées, en comparant à l'infographie source :
- toutMontre : ce que la légende annonce est-il à l'écran ?
- manque : ce qui manque à l'écran (un chiffre, une unité, un bloc, une flèche), ou une chaîne vide ;
- faux : ce qui contredit l'image source (chiffre, unité, libellé, sens d'une flèche, part), ou une chaîne vide ;
- illisible : un texte coupé par le bord, masqué, ou trop petit pour être lu sur un téléphone, ou une chaîne vide ;
- horsCharte : un écart à la charte (couleurs, polices, fonds sombre ou ivoire), ou une chaîne vide ;
- suggestion : une amélioration facultative, ou une chaîne vide.
Puis absentDeLaVideo : un élément de l'image source qu'aucune image extraite ne montre, ou une chaîne vide.

Tu ne juges pas la nuance d'orange (la charte vidéo prime). Une vue d'ensemble n'a pas de texte à lire : c'est voulu. Une dernière image LinkedIn qui ne montre que la phrase-choc et la marque est voulue. Les textes et les chiffres apparaissent au fil de la voix : un mot en train d'entrer à l'instant de l'image n'est pas un défaut ; un mot absent alors que la phrase est entièrement dite en est un. La notification affiche le nom de l'application sans le mot « Alerte » et sans émoji (cloche comprise) : c'est voulu. Sois factuel et bref ; n'invente aucun défaut.`;

/** Simulation : rien à signaler sur chaque image annoncée dans la partie variable. */
function simulerRelecture(entree: EntreeRole): RelectureFinale {
  const noms = [...entree.variable.matchAll(/<image nom="(i\d{2})"/g)].map((m) => m[1]!);
  return { images: noms.map((nom) => ({ nom, toutMontre: true, manque: "", faux: "", illisible: "", horsCharte: "", suggestion: "" })), absentDeLaVideo: "" };
}

export const roleRelectureFinale = {
  id: "relecture-finale-iv",
  version: 1,
  consigne: CONSIGNE_RELECTURE_FINALE,
  schema: schemaRelectureFinale,
  modele: MODELE_ECRITURE,
  effort: "medium",
  maxTokens: 6000,
  simuler: simulerRelecture,
} satisfies DefinitionRole<typeof schemaRelectureFinale>;

/** Partie variable : ce que chaque image doit montrer, et le contenu de la carte (données, jamais une clé). */
export function variableRelecture(carte: Pick<CarteImage, "titre" | "noeuds" | "chiffres" | "phraseChoc">, instants: readonly InstantCleIV[], reseaux: readonly string[]): string {
  const blocs = carte.noeuds.filter((n) => !n.photoPersonnes).map((n) => `- ${n.libelle}${n.detail ? ` (${n.detail})` : ""}`);
  const chiffres = carte.chiffres.filter((c) => c.aDire).map((c) => c.brut);
  return [
    `<carte titre="${carte.titre.replace(/"/g, "'")}">`,
    "Blocs :",
    ...blocs,
    `Chiffres : ${chiffres.join(" · ") || "aucun"}`,
    `Phrase-choc : ${carte.phraseChoc}`,
    "</carte>",
    `<version reseaux="${reseaux.join(", ")}">`,
    ...instants.map((i) => `<image nom="${i.nom}" instant="${i.instantSec.toFixed(2)}">${i.legende}</image>`),
    "</version>",
    "Réponds pour chaque image, dans cet ordre.",
  ].join("\n");
}

function lireRelecture(r: Extract<ReponseAppelLecture, { ok: true }>): RelectureFinale | null {
  if (r.stopReason === "max_tokens") return null;
  let brut: unknown = r.donnees;
  if (brut === undefined && typeof r.texte === "string") {
    try {
      brut = JSON.parse(r.texte);
    } catch {
      return null;
    }
  }
  const v = schemaRelectureFinale.safeParse(brut);
  return v.success ? v.data : null;
}

const enBase64 = (o: Uint8Array) => Buffer.from(o.buffer, o.byteOffset, o.byteLength).toString("base64");

/* ------------------------------------------------------------------ */
/* Relecture d'une version                                               */
/* ------------------------------------------------------------------ */

/**
 * Clé d'une relecture : le fichier final relu (clé ET empreinte de ses octets) et les instants extraits. Une relecture
 * n'est reprise que pour la même clé ; sans empreinte du fichier, elle n'est jamais reprise (le fichier a pu être
 * refait sous la même clé). Elle entre aussi dans le préfixe de l'identifiant d'appel réservé (lisibilité du registre).
 */
export function cleRelectureIV(fichierCle: string, empreinteFichier: string | undefined, instants: readonly Pick<InstantCleIV, "nom" | "instantSec" | "legende">[]): string | null {
  if (!empreinteFichier) return null;
  return `relecture-${createHash("sha256").update(JSON.stringify([fichierCle, empreinteFichier, instants.map((i) => [i.nom, i.instantSec, i.legende])])).digest("hex").slice(0, 32)}`;
}

export interface EntreeRelectureIV {
  videoId: string;
  version: string;
  reseaux: readonly string[];
  carte: CarteImage;
  /** Fichier FINAL de la version, et l'empreinte de ses octets (sans elle, aucune reprise). */
  fichierCle: string;
  empreinteFichier?: string;
  instants: readonly InstantCleIV[];
  /** Relectures déjà obtenues, par `cleRelectureIV` : reprise seulement pour le même fichier et les mêmes instants. */
  deja?: Readonly<Record<string, RelectureFinale>>;
  depenseAutorisee: boolean;
}

export interface ResultatRelectureIV {
  q26: ConstatControle;
  /** Indications non bloquantes (hors charte, suggestions). */
  indications: string[];
  relecture?: RelectureFinale;
  /** Clé sous laquelle ranger la relecture (absente : fichier sans empreinte, jamais repris). */
  cle?: string;
  appels: number;
}

/** Verdict PUR d'une relecture : manque, faux, illisible (ou image sans réponse) = refus ; le reste est indicatif. */
export function jugerRelecture(r: RelectureFinale, instants: readonly Pick<InstantCleIV, "nom" | "instantSec">[]): { bloquants: string[]; indications: string[] } {
  const bloquants: string[] = [];
  const indications: string[] = [];
  const t = (nom: string) => instants.find((i) => i.nom === nom)?.instantSec;
  const ou = (nom: string) => (t(nom) !== undefined ? `à ${t(nom)!.toFixed(1).replace(".", ",")} s` : nom);
  for (const i of instants) {
    const x = r.images.find((y) => y.nom === i.nom);
    if (!x) {
      bloquants.push(`l'image ${ou(i.nom)} n'a pas été relue.`);
      continue;
    }
    if (x.manque.trim()) bloquants.push(`${ou(i.nom)}, il manque : ${x.manque.trim()}.`);
    if (x.faux.trim()) bloquants.push(`${ou(i.nom)}, faux : ${x.faux.trim()}.`);
    if (x.illisible.trim()) bloquants.push(`${ou(i.nom)}, illisible : ${x.illisible.trim()}.`);
    if (!x.toutMontre && !x.manque.trim()) bloquants.push(`${ou(i.nom)}, ce qui est annoncé n'est pas montré.`);
    if (x.horsCharte.trim()) indications.push(`${ou(i.nom)}, hors charte : ${x.horsCharte.trim()}.`);
    if (x.suggestion.trim()) indications.push(`${ou(i.nom)} : ${x.suggestion.trim()}.`);
  }
  if (r.absentDeLaVideo.trim()) bloquants.push(`absent de toute la vidéo : ${r.absentDeLaVideo.trim()}.`);
  return { bloquants, indications };
}

const nonFait = (message: string, appels = 0): ResultatRelectureIV => ({ q26: { ok: false, nonFait: true, details: [message] }, indications: [], appels });

/**
 * Q26 d'une version : extraction (opération existante), puis relecture réservée. Ne lève jamais : une panne est un
 * refus motivé.
 */
export async function relireVersionIV(e: EntreeRelectureIV, o: OutilsRelectureIV): Promise<ResultatRelectureIV> {
  if (!e.instants.length) return { q26: { ok: false, details: ["aucun instant clé à relire."] }, indications: [], appels: 0 };
  const cle = cleRelectureIV(e.fichierCle, e.empreinteFichier, e.instants) ?? undefined;
  const deja = cle ? e.deja?.[cle] : undefined;
  if (deja) {
    const j = jugerRelecture(deja, e.instants);
    return { q26: { ok: j.bloquants.length === 0, details: j.bloquants }, indications: j.indications, relecture: deja, cle, appels: 0 };
  }
  if (!e.depenseAutorisee) return nonFait("relecture non lancée : la vidéo est déjà refusée par un autre contrôle, aucune dépense n'est engagée.");

  // 1. Extraction par l'opération existante ; ratée ou incomplète = refus.
  let images: { nom: string; cle: string }[];
  try {
    images = (await o.extraireImages(demandeImagesControleIV(e.videoId, e.version, e.fichierCle, e.instants))).images ?? [];
  } catch (err) {
    return { q26: { ok: false, details: [`les images de contrôle n'ont pas pu être extraites du fichier final (${(err as Error).message}) : la vidéo n'est jamais livrée sans relecture.`] }, indications: [], appels: 0 };
  }
  const jointes: ImageClaude[] = [];
  const source = await o.lireImage(e.carte.image.cle).catch(() => null);
  if (!source) return { q26: { ok: false, details: ["l'image source est introuvable : la relecture ne peut pas la comparer."] }, indications: [], appels: 0 };
  jointes.push({ type: source.type, base64: enBase64(source.octets), legende: "Image source (l'infographie)." });
  for (const i of e.instants) {
    const r = images.find((x) => x?.nom === i.nom && typeof x.cle === "string");
    const lue = r ? await o.lireImage(r.cle).catch(() => null) : null;
    if (!lue) return { q26: { ok: false, details: [`l'image de contrôle à ${i.instantSec.toFixed(1).replace(".", ",")} s n'a pas été extraite : la vidéo n'est jamais livrée sans relecture.`] }, indications: [], appels: 0 };
    jointes.push({ type: lue.type, base64: enBase64(lue.octets), legende: `${i.nom} · ${i.legende}` });
  }

  // 2. Relecture : réservation du pire coût AVANT chaque appel ; une relance si la réponse est illisible.
  const role = roleRelectureFinale as unknown as DefinitionRole;
  const entree: EntreeRole = { contexte: {}, variable: variableRelecture(e.carte, e.instants, e.reseaux), images: jointes };
  let appels = 0;
  for (let essai = 1; essai <= APPELS_RELECTURE_MAX; essai++) {
    const appelId = o.idAppel(`iv-relecture-${e.videoId}-${e.version}-${cle ?? `sans-empreinte-${createHash("sha256").update(JSON.stringify([e.fichierCle, e.instants])).digest("hex").slice(0, 16)}`}-${essai}`);
    const reservation = await o.budget
      .reserver({ appelId, videoId: e.videoId, etape: ETAPE_RELECTURE, fournisseur: "claude", modele: role.modele, coutEstimeUsd: pireCasRole(role, entree) })
      .catch((err: Error) => ({ ok: false as const, message: err.message }));
    if (!reservation.ok) return nonFait(`relecture non lancée : la dépense n'a pas pu être réservée (${reservation.message}).`, appels);
    appels++;
    const r = await o.appeler(role, entree).catch((err: Error) => ({ ok: false as const, arret: "panne", message: err.message }));
    if (!r.ok) return { ...nonFait(`la relecture a été interrompue (${r.message}).`, appels) };
    const lue = lireRelecture(r);
    if (!lue) continue;
    const j = jugerRelecture(lue, e.instants);
    return { q26: { ok: j.bloquants.length === 0, details: j.bloquants }, indications: j.indications, relecture: lue, ...(cle ? { cle } : {}), appels };
  }
  return { q26: { ok: false, details: ["la relecture n'a pas donné de réponse lisible, même après une relance."] }, indications: [], appels };
}
