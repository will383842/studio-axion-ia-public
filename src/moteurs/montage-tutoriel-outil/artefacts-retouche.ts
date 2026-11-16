// Tutoriel d'outil, G5-05 : artefacts de retouche (étapes, chapitres, captures, zones, pastilles) gardés dans le projet.
// Types et lecture TOLÉRANTE seulement : fonctions pures, aucun service, aucun réglage, aucun appel. Personne ne les branche ici.
// Absent = comme aujourd'hui : un projet sans ces champs reste inchangé.
import { ZOOM_MAX, ZOOM_MIN } from "../../briques/plan-scenes/tutoriel/capture";
import type { ChapitreTutoriel, EtapeTutoriel, SortieEtapesTutoriel } from "./etapes-tutoriel";

/** Cadre en % de la capture (0-100). */
export interface ZonePct {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export interface ZoneCaptureGardee {
  sceneId: string;
  cadre?: ZonePct;
  zoom?: number;
  curseur?: { x: number; y: number }[];
}

export interface CaptureGardee {
  cle: string;
  largeur: number;
  hauteur: number;
  empreinte: string;
  zones: ZoneCaptureGardee[];
}

export interface PastilleEtape {
  etapeId: string;
  texte: string;
}

export interface ArtefactsTutoriel {
  etapes?: EtapeTutoriel[];
  chapitres?: ChapitreTutoriel[];
  captures?: CaptureGardee[];
  pastilles?: PastilleEtape[];
}

const CLES = ["etapes", "chapitres", "captures", "pastilles"] as const;

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const nombre = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const texte = (v: unknown): string | null => (typeof v === "string" ? v : null);
const borne = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const pct = (v: number) => borne(v, 0, 100);

function copie<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Garde seulement les clés non vides. */
function sansCleVide(a: ArtefactsTutoriel): ArtefactsTutoriel {
  const r: ArtefactsTutoriel = {};
  if (a.etapes?.length) r.etapes = a.etapes;
  if (a.chapitres?.length) r.chapitres = a.chapitres;
  if (a.captures?.length) r.captures = a.captures;
  if (a.pastilles?.length) r.pastilles = a.pastilles;
  return r;
}

/** Artefacts à garder dans le projet : copie profonde, aucune clé vide. */
export function artefactsTutoriel(sortie: SortieEtapesTutoriel, captures?: CaptureGardee[]): ArtefactsTutoriel {
  return sansCleVide(copie({ etapes: sortie?.etapes, chapitres: sortie?.chapitres, captures }));
}

function lireEtape(v: unknown): EtapeTutoriel | null {
  if (!estObjet(v)) return null;
  const numero = nombre(v.numero), total = nombre(v.total), premierMot = nombre(v.premierMot), dernierMot = nombre(v.dernierMot);
  const debutSec = nombre(v.debutSec), finSec = nombre(v.finSec), libelle = texte(v.libelle);
  if (numero === null || total === null || premierMot === null || dernierMot === null || debutSec === null || finSec === null || libelle === null) return null;
  return { numero, total, libelle, premierMot, dernierMot, debutSec, finSec };
}

function lireChapitre(v: unknown): ChapitreTutoriel | null {
  if (!estObjet(v)) return null;
  const titre = texte(v.titre), debutSec = nombre(v.debutSec);
  return titre === null || debutSec === null ? null : { titre, debutSec };
}

function lirePastille(v: unknown): PastilleEtape | null {
  if (!estObjet(v)) return null;
  const etapeId = texte(v.etapeId), t = texte(v.texte);
  return etapeId === null || t === null ? null : { etapeId, texte: t };
}

function lireCadre(v: unknown): ZonePct | undefined {
  if (!estObjet(v)) return undefined;
  const x = nombre(v.x), y = nombre(v.y), largeur = nombre(v.largeur), hauteur = nombre(v.hauteur);
  if (x === null || y === null || largeur === null || hauteur === null) return undefined;
  return { x: pct(x), y: pct(y), largeur: pct(largeur), hauteur: pct(hauteur) };
}

function lireZone(v: unknown): ZoneCaptureGardee | null {
  if (!estObjet(v)) return null;
  const sceneId = texte(v.sceneId);
  if (sceneId === null) return null;
  const zone: ZoneCaptureGardee = { sceneId };
  const cadre = lireCadre(v.cadre);
  if (cadre) zone.cadre = cadre;
  const zoom = nombre(v.zoom);
  if (zoom !== null) zone.zoom = borne(zoom, ZOOM_MIN, ZOOM_MAX);
  if (Array.isArray(v.curseur)) {
    const points: { x: number; y: number }[] = [];
    for (const p of v.curseur) {
      if (!estObjet(p)) continue;
      const x = nombre(p.x), y = nombre(p.y);
      if (x !== null && y !== null) points.push({ x: pct(x), y: pct(y) });
    }
    if (points.length) zone.curseur = points;
  }
  return zone;
}

function lireCapture(v: unknown): CaptureGardee | null {
  if (!estObjet(v)) return null;
  const cle = texte(v.cle), largeur = nombre(v.largeur), hauteur = nombre(v.hauteur), empreinte = texte(v.empreinte);
  if (cle === null || largeur === null || hauteur === null || empreinte === null) return null;
  const zones = Array.isArray(v.zones) ? v.zones.map(lireZone).filter((z): z is ZoneCaptureGardee => z !== null) : [];
  return { cle, largeur, hauteur, empreinte, zones };
}

function liste<T>(v: unknown, lire: (x: unknown) => T | null): T[] {
  return Array.isArray(v) ? v.map(lire).filter((x): x is T => x !== null) : [];
}

/** Lecture tolérante du projet de tutoriel : champ absent → absent ; élément mal formé → ignoré ; jamais d'exception. */
export function lireArtefactsTutoriel(projetTutoriel: unknown): ArtefactsTutoriel {
  try {
    if (!estObjet(projetTutoriel)) return {};
    return sansCleVide({
      etapes: liste(projetTutoriel.etapes, lireEtape),
      chapitres: liste(projetTutoriel.chapitres, lireChapitre),
      captures: liste(projetTutoriel.captures, lireCapture),
      pastilles: liste(projetTutoriel.pastilles, lirePastille),
    });
  } catch {
    return {};
  }
}

/** Nouvel objet = projet + les seules clés présentes. Artefacts vides → objet égal à l'entrée. */
export function avecArtefacts<T extends Record<string, unknown>>(projetTutoriel: T, artefacts: ArtefactsTutoriel): T & ArtefactsTutoriel {
  const propres = sansCleVide(copie(artefacts ?? {}));
  const r: Record<string, unknown> = { ...projetTutoriel };
  for (const k of CLES) if (propres[k]) r[k] = propres[k];
  return r as T & ArtefactsTutoriel;
}
