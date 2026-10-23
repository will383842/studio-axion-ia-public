/**
 * MESURE COMPLÈTE (plan v5 B.5.5, B.8 §2, §3 et §8, lot G7b).
 *
 * - Import des statistiques Buffer par `Publication.idExterne` (LECTURE SEULE) ; visites et rendez-vous par lien suivi
 *   (statistiques du site, LECTURE SEULE). Chaque import AJOUTE un relevé daté avec ses définitions ; `stats` reçoit la
 *   copie fusionnée. Rien n'est effacé ; un relevé identique au précédent n'est pas répété.
 * - « Ce qui marche » : rangs par réseau (20 dernières vidéos), regroupements par réseau, format, structure et type
 *   d'ouverture, et avis « les 5 plus proches » pour les versions prêtes à partir.
 * - AUCUNE PRÉDICTION : seules des vidéos déjà mesurées et leurs rangs sont montrés.
 */
import "server-only";
import { BIBLIOTHEQUE_ACCROCHES_AVOCAT, STRUCTURES_AVOCAT } from "@/donnees/generateur/recette-avocat-v4";
import {
  cinqPlusProches,
  DEFINITIONS_LIENS,
  estMesuree,
  regrouper,
  rangsParReseau,
  resultatsDepuisStats,
  tousLesRangs,
  visitesParCode,
  type AvisPlusProches,
  type Axe,
  type Groupe,
  type RangVideo,
  type TraitsVideo,
  type VideoMesuree,
} from "@/domaine/mesures-rangs";
import type { Id, Publication, ReseauDeclinaison, ScriptMaitre, StatsPublication, VarianteReseau } from "@/domaine/types";
import { trouverFormat } from "@/formats";
import { JOUR_MS } from "@/lib/dates";
import { creerLecteurBuffer, type LecteurStatsBuffer } from "@/fournisseurs/mesures/buffer";
import { ErreurMesure } from "@/fournisseurs/mesures/commun";
import { creerLecteurPlausible, type LecteurVisites } from "@/fournisseurs/mesures/plausible";
import { depots, filtreExemples, journaliser } from "./_commun";
import { exigerSession } from "./auth";
import { versionsExemplesAvantPublication, videosExemplesMesurees } from "./mesures-exemples";

/** Définitions écrites avec un relevé importé de Buffer (B.8 §2). */
export const DEFINITIONS_BUFFER: Readonly<Record<string, string>> = {
  vues: "Vues relevées par Buffer (statistique du réseau, rafraîchie environ une fois par jour).",
  portee: "Personnes atteintes, relevées par Buffer.",
  likes: "Réactions relevées par Buffer.",
  commentaires: "Commentaires relevés par Buffer.",
  partages: "Partages relevés par Buffer.",
  partagesParPortee: "Partages ÷ personnes atteintes × 100 (%), calculé.",
};

/* ------------------------------------------------------------------ */
/* Vidéos mesurées                                                     */
/* ------------------------------------------------------------------ */

/** Traits d'une version : la fiche figée à la validation d'abord, sinon le sujet. */
export function traitsVersion(v: VarianteReseau, m: ScriptMaitre | null | undefined): TraitsVideo {
  const f = v.caracteristiques;
  if (f) {
    return {
      reseau: v.reseau,
      formatId: v.formatId,
      structure: f.structure,
      ouverture: f.familleAccroche,
      objectifSujet: f.objectifSujet,
      typeAncrage: f.typeAncrage,
      pointDeVue: f.pointDeVue,
      emotion: f.emotion,
      pilier: f.pilier,
      contrePied: f.contrePied,
      dureeSec: v.dureeReelleSec ?? f.dureePrevueSec,
    };
  }
  return {
    reseau: v.reseau,
    formatId: v.formatId,
    structure: m?.choix?.structure ?? m?.angle?.structure,
    ouverture: m?.accrochesFinalistes?.find((a) => a.id === v.accrocheId)?.famille,
    objectifSujet: m?.brief.objectif,
    typeAncrage: m?.ancrages[0]?.type,
    pointDeVue: m?.pointDeVue ?? m?.choix?.pointDeVue,
    emotion: m?.emotion ?? m?.choix?.emotion,
    pilier: m?.brief.pilier,
    contrePied: m?.angle?.contrePied,
    dureeSec: v.dureeReelleSec ?? v.dureeEstimeeSec,
  };
}

/** Publications d'une version du générateur, réellement parties (jamais un essai), vidéo non archivée. */
async function publicationsDeVersions(): Promise<Publication[]> {
  const ex = await filtreExemples<Publication>();
  const archivees = new Set((await depots().videos.lister((v) => v.statut === "archivee")).map((v) => v.id));
  return depots().publications.lister((p) => ex(p) && !!p.varianteId && p.via !== "simulation" && !archivees.has(p.videoId));
}

/** Exemples de démonstration : seulement sur un poste de développement ET demandés (`STUDIO_APERCU_MESURES=1`). */
export function exemplesActifs(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== "production" && env.STUDIO_APERCU_MESURES === "1";
}

/** Toutes les vidéos mesurées (une par publication), avec leurs traits et leurs derniers chiffres. */
export async function collecterVideosMesurees(): Promise<VideoMesuree[]> {
  const d = depots();
  const r: VideoMesuree[] = [];
  for (const p of await publicationsDeVersions()) {
    const v = await d.variantes.obtenir(p.varianteId!);
    if (!v) continue;
    const m = await d.scriptsMaitres.obtenir(v.scriptMaitreId);
    const video: VideoMesuree = {
      ...traitsVersion(v, m),
      reseau: p.reseau as ReseauDeclinaison,
      publicationId: p.id,
      varianteId: v.id,
      code: v.code,
      titre: m?.angle?.titre ?? m?.brief.idee ?? "",
      date: p.date,
      resultats: resultatsDepuisStats(p.stats),
    };
    if (estMesuree(video)) r.push(video);
  }
  return exemplesActifs() ? [...r, ...videosExemplesMesurees()] : r;
}

/* ------------------------------------------------------------------ */
/* Import : Buffer et liens suivis                                     */
/* ------------------------------------------------------------------ */

export interface BilanImport {
  buffer: { essai: boolean; lues: number; ajoutees: number; erreurs: number; message?: string };
  visites: { essai: boolean; lues: number; ajoutees: number; message?: string };
}

const memes = (a: Partial<StatsPublication> | undefined, b: Partial<StatsPublication>) => Object.entries(b).every(([k, v]) => (a as Record<string, unknown> | undefined)?.[k] === v);

function dernierReleve(p: Publication, source: "buffer" | "api") {
  return [...(p.releves ?? [])].reverse().find((r) => r.source === source);
}

/** Ajoute un relevé (jamais un remplacement) et fusionne la copie `stats`. */
async function ajouterReleve(p: Publication, source: "buffer" | "api", valeurs: Partial<StatsPublication>, definitions: Record<string, string>, instant: Date): Promise<boolean> {
  const precedent = dernierReleve(p, source);
  if (precedent && memes(precedent.valeurs, valeurs)) return false;
  const stats: StatsPublication = { ...(p.stats ?? { vues: 0, likes: 0, commentaires: 0, partages: 0 }), ...valeurs };
  const jour = Math.max(0, Math.floor((instant.getTime() - new Date(p.date).getTime()) / JOUR_MS));
  await depots().publications.modifier(p.id, { releves: [...(p.releves ?? []), { le: instant.toISOString(), jour, source, valeurs: stats, definitions }], stats });
  return true;
}

const messageDe = (e: unknown) => (e instanceof ErreurMesure ? e.message : "Lecture impossible pour l'instant.");

/**
 * Met à jour les chiffres : statistiques Buffer de chaque publication envoyée par Buffer (par `idExterne`), puis visites
 * et rendez-vous par code de version. Lecture seule chez Buffer et sur le site.
 */
export async function importerMesures(options: { buffer?: LecteurStatsBuffer; visites?: LecteurVisites; instant?: Date } = {}): Promise<BilanImport> {
  await exigerSession();
  const instant = options.instant ?? new Date();
  const lecteurBuffer = options.buffer ?? creerLecteurBuffer();
  const lecteurVisites = options.visites ?? creerLecteurPlausible();
  const bilan: BilanImport = {
    buffer: { essai: lecteurBuffer.mode === "simulation", lues: 0, ajoutees: 0, erreurs: 0 },
    visites: { essai: lecteurVisites.mode === "simulation", lues: 0, ajoutees: 0 },
  };
  const d = depots();
  const publications = await publicationsDeVersions();

  for (const p of publications) {
    if (p.via !== "buffer" || !p.idExterne) continue;
    try {
      const s = await lecteurBuffer.lire(p.idExterne);
      if (!s) continue;
      bilan.buffer.lues++;
      if (!Object.keys(s.valeurs).length) continue;
      const frais = (await d.publications.obtenir(p.id)) ?? p;
      if (await ajouterReleve(frais, "buffer", s.valeurs, { ...DEFINITIONS_BUFFER }, instant)) bilan.buffer.ajoutees++;
    } catch (e) {
      bilan.buffer.erreurs++;
      bilan.buffer.message = messageDe(e);
    }
  }

  try {
    const lignes = await lecteurVisites.lire({ periode: "90d" });
    if (lignes) {
      const parCode = visitesParCode(lignes);
      bilan.visites.lues = parCode.size;
      // Un code = une version ; si elle a plusieurs publications, la plus récente reçoit les chiffres.
      const parVariante = new Map<string, Publication>();
      for (const p of publications) {
        const x = parVariante.get(p.varianteId!);
        if (!x || x.date < p.date) parVariante.set(p.varianteId!, p);
      }
      for (const p of parVariante.values()) {
        const v = await d.variantes.obtenir(p.varianteId!);
        const chiffres = v && parCode.get(v.code);
        if (!chiffres) continue;
        const frais = (await d.publications.obtenir(p.id)) ?? p;
        if (await ajouterReleve(frais, "api", chiffres, { ...DEFINITIONS_LIENS }, instant)) bilan.visites.ajoutees++;
      }
    }
  } catch (e) {
    bilan.visites.message = messageDe(e);
  }

  if (bilan.buffer.ajoutees || bilan.visites.ajoutees) await journaliser("mesure", `Chiffres mis à jour : ${bilan.buffer.ajoutees} par Buffer, ${bilan.visites.ajoutees} par lien suivi`);
  return bilan;
}

/* ------------------------------------------------------------------ */
/* « Ce qui marche »                                                   */
/* ------------------------------------------------------------------ */

const NOMS_STRUCTURES = new Map(STRUCTURES_AVOCAT.map((s) => [s.id, s.nom]));
const NOMS_OUVERTURES = new Map(BIBLIOTHEQUE_ACCROCHES_AVOCAT.map((a) => [a.id as string, a.nom]));

/** Libellé lisible d'une valeur d'axe (format, structure, ouverture) ; un réseau garde son identifiant (logo à l'écran). */
export function libelleAxe(axe: Axe, valeur: string): string {
  if (axe === "format") return trouverFormat(valeur)?.nom ?? valeur;
  if (axe === "structure") return NOMS_STRUCTURES.get(valeur)?.replace(/\s*\(.*\)$/, "") ?? valeur;
  if (axe === "ouverture") return NOMS_OUVERTURES.get(valeur)?.replace(/\s*\(.*\)$/, "") ?? valeur;
  return valeur;
}

export interface GroupeAffiche extends Groupe {
  libelle: string;
}

export interface VersionAvantPublication {
  varianteId: Id;
  code: string;
  titre: string;
  reseau: ReseauDeclinaison;
  avis: AvisPlusProches;
}

export interface CeQuiMarche {
  /** Vidéos mesurées prises en compte. */
  nombre: number;
  rangs: Partial<Record<ReseauDeclinaison, RangVideo[]>>;
  groupes: Record<Axe, GroupeAffiche[]>;
  avantPublication: VersionAvantPublication[];
  exemples: boolean;
}

/** Versions prêtes (vidéo rangée) qui ne sont pas encore parties : l'avis « 5 plus proches » les accompagne. */
async function versionsPretes(limite: number): Promise<{ v: VarianteReseau; m: ScriptMaitre | null }[]> {
  const d = depots();
  const envoyees = new Set((await d.publications.lister((p) => !!p.varianteId && p.statut !== "echec")).map((p) => p.varianteId!));
  const pretes = (await d.variantes.lister((v) => !!v.videoId && v.etat === "validee" && !envoyees.has(v.id))).sort((a, b) => b.modifieLe.localeCompare(a.modifieLe)).slice(0, limite);
  return Promise.all(pretes.map(async (v) => ({ v, m: await d.scriptsMaitres.obtenir(v.scriptMaitreId) })));
}

export async function ceQuiMarche(options: { limiteAvant?: number } = {}): Promise<CeQuiMarche> {
  await exigerSession();
  const videos = await collecterVideosMesurees();
  const rangs = rangsParReseau(videos);
  const plats = tousLesRangs(videos);
  const axes: Axe[] = ["reseau", "format", "structure", "ouverture"];
  const groupes = Object.fromEntries(axes.map((a) => [a, regrouper(plats, a).map((g) => ({ ...g, libelle: libelleAxe(a, g.valeur) }))])) as Record<Axe, GroupeAffiche[]>;
  const avantPublication = (await versionsPretes(options.limiteAvant ?? 5)).map(({ v, m }) => ({
    varianteId: v.id,
    code: v.code,
    titre: m?.angle?.titre ?? m?.brief.idee ?? "",
    reseau: v.reseau,
    avis: cinqPlusProches({ ...traitsVersion(v, m), varianteId: v.id, code: v.code }, plats),
  }));
  if (exemplesActifs()) {
    for (const e of versionsExemplesAvantPublication()) avantPublication.push({ varianteId: e.varianteId, code: e.code, titre: e.titre, reseau: e.traits.reseau, avis: cinqPlusProches({ ...e.traits, varianteId: e.varianteId, code: e.code }, plats) });
  }
  return { nombre: plats.length, rangs, groupes, avantPublication, exemples: exemplesActifs() };
}

/** Avis avant publication d'une version (B.8 §8) : les 5 vidéos mesurées les plus proches et leurs rangs. */
export async function avisPlusProches(varianteId: Id): Promise<AvisPlusProches | null> {
  await exigerSession();
  const v = await depots().variantes.obtenir(varianteId);
  if (!v) return null;
  const m = await depots().scriptsMaitres.obtenir(v.scriptMaitreId);
  return cinqPlusProches({ ...traitsVersion(v, m), varianteId: v.id, code: v.code }, tousLesRangs(await collecterVideosMesurees()));
}

/** Les lectures sont-elles réelles (clé présente sur le serveur) ? Pour la pastille « Essai ». Aucune clé n'en sort. */
export function modesLecture(): { buffer: "reel" | "simulation"; visites: "reel" | "simulation" } {
  return { buffer: creerLecteurBuffer().mode, visites: creerLecteurPlausible().mode };
}
