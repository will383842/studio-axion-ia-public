/**
 * T-EXT-15 : INDEX DES SCÈNES GARDÉES. Une scène gardée = un morceau du plan validé (T-EXT-14) + la référence de sa
 * vidéo source ; aucun fichier vidéo, aucun clip, aucun chemin. Clés préfixées `scene:` (distinctes de `extrait:`, l'archive X4).
 * Licence d'une scène = celle de la vidéo source, COPIÉE et datée au rangement : une licence changée plus tard ne remonte pas en silence.
 * Pur : ni disque, ni horloge (`le` vient de l'appelant), ni réglage, aucun appel ; aucune entrée n'est modifiée. Rien ne l'importe en production.
 */
import { z } from "zod";
import { schemaPlanStrict, type PlanValide } from "@/briques/plan-scenes/schema";
import type { SujetExtrait } from "@/briques/note-extraits/types";
import type { Licence } from "@/domaine/types";
import type { MorceauPlan } from "./decoupage-scenes";
import { ROLES_ETAPE_SCENARIO } from "./scenario-maquette";

export const VERSION_INDEX_SCENES = "index-scenes.v1";

export type GabaritScene = "G-Journée" | "G-Décision" | "G-Réponse" | "G-Flux";
export type EtatScene = "brouillon" | "validee" | "retiree";

export interface EntreeScene {
  cle: string;
  videoId: string;
  versionVideoId: string;
  /** Référence de la vidéo source (une sortie), jamais un fichier. */
  sortieId?: string;
  sceneId: string;
  version: number;
  role: MorceauPlan["role"];
  maquette: string;
  gabarit?: GabaritScene;
  sujet: SujetExtrait | null;
  /** Plan autonome d'une scène, ratio maître 4:5. */
  morceau: PlanValide;
  empreinteMorceau: string;
  dureeMs: number;
  /** Paroles de Williams : jamais dans un journal ni un message d'erreur. */
  texteDit: string;
  licence: Licence;
  licenceCopieeLe: string;
  /** Vidéos que cette scène n'illustre jamais : au moins sa vidéo source. */
  famille: string[];
  etat: EtatScene;
  rangeeLe: string;
  valideeLe?: string;
  retireeLe?: string;
}

export interface IndexScenes {
  version: typeof VERSION_INDEX_SCENES;
  entrees: EntreeScene[];
}

export const INDEX_VIDE: IndexScenes = Object.freeze({ version: VERSION_INDEX_SCENES, entrees: Object.freeze([]) as unknown as EntreeScene[] });

export function cleScene(videoId: string, sceneId: string, version: number): string {
  return `scene:${videoId}:${sceneId}:v${version}`;
}

export const estCleScene = (c: unknown): c is string => typeof c === "string" && c.startsWith("scene:");

const copie = <T>(v: T): T => structuredClone(v);

/* ------------------------------ lecture stricte ------------------------------ */

const REFUS_FICHIER = "Une scène gardée ne référence aucun fichier vidéo.";
const CLES_FICHIER = new Set(["fichier", "fichiers", "clestockage", "url", "chemin", "adresse"]);
const PREFIXES_FICHIER = ["http:", "https:", "file:", "data:"];
const SUFFIXES_FICHIER = [".mp4", ".webm", ".mov"];

/** Vrai si une clé ou une chaîne, à n'importe quelle profondeur, désigne un fichier vidéo. */
function referenceUnFichier(v: unknown, vus: Set<unknown> = new Set()): boolean {
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return PREFIXES_FICHIER.some((p) => s.startsWith(p)) || SUFFIXES_FICHIER.some((x) => s.endsWith(x));
  }
  if (!v || typeof v !== "object" || vus.has(v)) return false;
  vus.add(v);
  if (Array.isArray(v)) return v.some((x) => referenceUnFichier(x, vus));
  return Object.entries(v).some(([k, x]) => CLES_FICHIER.has(k.toLowerCase()) || referenceUnFichier(x, vus));
}

const TYPES_LICENCE = ["propriete", "libre", "abonnement", "achat", "generee-ia", "a-verifier"] as const;
const RESEAUX = ["linkedin", "instagram", "facebook", "tiktok", "youtube", "youtube-shorts"] as const;
const ROLES: readonly string[] = [...ROLES_ETAPE_SCENARIO, "sans-role"];

const schemaLicence = z.strictObject({
  type: z.enum(TYPES_LICENCE),
  usageCommercial: z.boolean(),
  reseaux: z.array(z.enum(RESEAUX)),
  creditObligatoire: z.string().optional(),
  expireLe: z.string().optional(),
  preuveFichierId: z.string().optional(),
  source: z.string().optional(),
});

const texte = z.string().min(1);
const schemaEntree = z.strictObject({
  cle: texte,
  videoId: texte,
  versionVideoId: texte,
  sortieId: texte.optional(),
  sceneId: texte,
  version: z.number().int().min(1),
  role: z.string().refine((r) => ROLES.includes(r), "Rôle inconnu."),
  maquette: texte,
  gabarit: z.enum(["G-Journée", "G-Décision", "G-Réponse", "G-Flux"]).optional(),
  sujet: z.string().nullable(),
  morceau: schemaPlanStrict,
  empreinteMorceau: texte,
  dureeMs: z.number().min(1),
  texteDit: z.string(),
  licence: schemaLicence,
  licenceCopieeLe: texte,
  famille: z.array(texte),
  etat: z.enum(["brouillon", "validee", "retiree"]),
  rangeeLe: texte,
  valideeLe: texte.optional(),
  retireeLe: texte.optional(),
});

const schemaIndex = z.strictObject({ version: z.string(), entrees: z.array(z.unknown()) });

export type ResultatLecture = { ok: true; index: IndexScenes } | { ok: false; erreurs: string[] };

/** Lecture stricte, ne lève jamais. Les erreurs ne citent aucune parole (`texteDit`). */
export function lireIndexScenes(brut: unknown): ResultatLecture {
  try {
    const racine = schemaIndex.safeParse(brut);
    if (!racine.success) return { ok: false, erreurs: ["Index illisible : forme inconnue ou champ inconnu."] };
    if (racine.data.version !== VERSION_INDEX_SCENES) return { ok: false, erreurs: ["Version d'index inconnue."] };
    if (referenceUnFichier(brut)) return { ok: false, erreurs: [REFUS_FICHIER] };
    const erreurs: string[] = [];
    const entrees: EntreeScene[] = [];
    const vues = new Set<string>();
    racine.data.entrees.forEach((brute, i) => {
      const lu = schemaEntree.safeParse(brute);
      if (!lu.success) {
        // Chemin du champ seulement : jamais le message, qui pourrait citer une valeur.
        erreurs.push(`Entrée ${i + 1} : champ invalide ou inconnu (${lu.error.issues.map((x) => x.path.join(".") || "entrée").slice(0, 3).join(", ")}).`);
        return;
      }
      const e = lu.data as unknown as EntreeScene;
      if (e.cle !== cleScene(e.videoId, e.sceneId, e.version)) erreurs.push(`Entrée ${i + 1} : la clé ne suit pas le format scene:<vidéo>:<scène>:v<n>.`);
      if (vues.has(e.cle)) erreurs.push(`Entrée ${i + 1} : clé en double.`);
      vues.add(e.cle);
      if (!e.famille.includes(e.videoId)) erreurs.push(`Entrée ${i + 1} : la famille doit contenir la vidéo source.`);
      if (e.morceau.format.largeur * 5 !== e.morceau.format.hauteur * 4) erreurs.push(`Entrée ${i + 1} : seul le format maître 4:5 est gardé.`);
      entrees.push(e);
    });
    if (erreurs.length) return { ok: false, erreurs };
    return { ok: true, index: { version: VERSION_INDEX_SCENES, entrees: copie(entrees) } };
  } catch {
    return { ok: false, erreurs: ["Index illisible."] };
  }
}

/* --------------------------------- rangement --------------------------------- */

export interface MetaRangement {
  videoId: string;
  versionVideoId: string;
  sortieId?: string;
  maquette: string;
  gabarit?: GabaritScene;
  sujet: SujetExtrait | null;
  licence: Licence;
  famille: string[];
  le: string;
}

/**
 * Range des morceaux en `brouillon`. Licence copiée (copie profonde) et datée `le`. Même vidéo + même scène :
 * empreinte identique = rien n'est ajouté ; empreinte différente = nouvelle version, l'ancienne jamais modifiée.
 */
export function rangerScenes(index: IndexScenes, morceaux: readonly MorceauPlan[], meta: MetaRangement): IndexScenes {
  const entrees: EntreeScene[] = [...index.entrees];
  const famille = [...new Set([meta.videoId, ...meta.famille])];
  for (const m of morceaux) {
    const memes = entrees.filter((e) => e.videoId === meta.videoId && e.sceneId === m.sceneId);
    if (memes.some((e) => e.empreinteMorceau === m.empreinteMorceau)) continue;
    const version = memes.reduce((n, e) => Math.max(n, e.version), 0) + 1;
    entrees.push({
      cle: cleScene(meta.videoId, m.sceneId, version),
      videoId: meta.videoId,
      versionVideoId: meta.versionVideoId,
      ...(meta.sortieId !== undefined ? { sortieId: meta.sortieId } : {}),
      sceneId: m.sceneId,
      version,
      role: m.role,
      maquette: meta.maquette,
      ...(meta.gabarit !== undefined ? { gabarit: meta.gabarit } : {}),
      sujet: meta.sujet,
      morceau: copie(m.plan),
      empreinteMorceau: m.empreinteMorceau,
      dureeMs: m.dureeMs,
      texteDit: m.texteDit,
      licence: copie(meta.licence),
      licenceCopieeLe: meta.le,
      famille: [...famille],
      etat: "brouillon",
      rangeeLe: meta.le,
    });
  }
  return { version: VERSION_INDEX_SCENES, entrees };
}

/* ------------------------------ changements d'état ------------------------------ */

export type ResultatEtat = { ok: true; index: IndexScenes } | { ok: false; erreur: string };

function changerEtat(index: IndexScenes, cle: string, depuis: readonly EtatScene[], vers: EtatScene, champ: "valideeLe" | "retireeLe", le: string): ResultatEtat {
  const i = index.entrees.findIndex((e) => e.cle === cle);
  if (i < 0) return { ok: false, erreur: "Cette scène n'existe pas." };
  const e = index.entrees[i]!;
  if (!depuis.includes(e.etat)) return { ok: false, erreur: `Cette scène est déjà « ${e.etat} » : ce passage n'est pas permis.` };
  const entrees = index.entrees.map((x, j) => (j === i ? { ...copie(x), etat: vers, [champ]: le } : x));
  return { ok: true, index: { version: VERSION_INDEX_SCENES, entrees } };
}

/** `brouillon` → `validee` seulement (le geste de Williams est fait par l'appelant). */
export const validerScene = (index: IndexScenes, cle: string, le: string): ResultatEtat => changerEtat(index, cle, ["brouillon"], "validee", "valideeLe", le);

/** `brouillon | validee` → `retiree` ; jamais supprimée : l'historique reste. */
export const retirerScene = (index: IndexScenes, cle: string, le: string): ResultatEtat => changerEtat(index, cle, ["brouillon", "validee"], "retiree", "retireeLe", le);

/** Seules les scènes validées servent. */
export const scenesReutilisables = (index: IndexScenes): EntreeScene[] => index.entrees.filter((e) => e.etat === "validee");
