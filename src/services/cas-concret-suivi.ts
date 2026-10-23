/**
 * SUIVI DU FORMAT « CAS CONCRET MD » (tâche P2-04, P2R point 9) : PAR PUBLICATION seulement, c'est-à-dire par vidéo du
 * format (hors essais) et par réseau : les vues de la publication, les visites du lien et le code de version.
 *
 * - JAMAIS PAR PERSONNE : aucun prospect, aucun rendez-vous, aucune demande de guide, aucun mot à commenter.
 * - LECTURE SEULE : visites lues comme `mesures-completes` (statistiques du site). L2-07 (ADR 0002) : une campagne PAR
 *   RÉSEAU, `utm_campaign` = le code de version du réseau (« 0042-CC-IG », `codeVersionCasConcret`), `utm_source` = le
 *   réseau ; la clé de lecture est « code de version du réseau | réseau ». Le code AFFICHÉ est celui de la version CHOISIE
 *   (une retouche a le sien) ; les visites de CHAQUE version numérotée de la vidéo sont additionnées (le lien d'une version
 *   déjà publiée ne change pas), mais UN LIEN = UNE VIDÉO : un ancien lien commun à plusieurs vidéos n'est pas compté. Sans numéro : « pas encore de
 *   mesure ». Vues : celles de toutes les publications publiées du réseau. Aucune écriture.
 * - Lecture simulée ou impossible : des zéros et « pas encore de mesure », jamais une erreur.
 * - Réglage `casConcret.releves` (éteint par défaut) : éteint, aucune lecture du site.
 */
import "server-only";
import type { LigneLien } from "@/domaine/mesures-rangs";
import type { Id, Video } from "@/domaine/types";
import type { ReseauCas } from "@/formats/cas-concret";
import { creerLecteurPlausible, type LecteurVisites } from "@/fournisseurs/mesures/plausible";
import { ENTREE_CAS_CONCRET } from "@/moteurs/montage-cas-concret";
import { codeVersionCasConcret } from "@/moteurs/montage-cas-concret/fins";
import { depots, ErreurStudio } from "./_commun";
import { exigerSession } from "./auth";
import { reglageAllume, REGLAGES_CAS_CONCRET } from "./cas-concret-reglages";

const FORMAT_ID = "cas-concret";
const DUREE_CACHE_SITE_MS = 3 * 60_000;
let cacheSite: { jusqua: number; lignes: LigneLien[] } | null = null;
const RESEAUX: readonly ReseauCas[] = ["facebook", "instagram", "tiktok", "linkedin"];
export const PAS_ENCORE_DE_MESURE = "pas encore de mesure";
export const PHRASE_RELEVES_FERMES = "Les relevés ne sont pas ouverts pour le moment.";

/** Une ligne : une vidéo, un réseau. */
export interface LigneSuivi {
  videoId: Id;
  titre: string;
  reseau: ReseauCas;
  /** Date de création de la vidéo (AAAA-MM-JJ). */
  date: string;
  /** Code de version du lien suivi de ce réseau (`utm_campaign`, « 0042-CC-IG ») ; vide : version sans numéro. */
  codeSuivi: string;
  /** Vues de la publication sur ce réseau, quand elle est publiée et relevée ; absent : pas encore de mesure. */
  vues?: number;
  visites: number;
  /** Vrai quand le site a donné un chiffre pour ce lien ; faux : « pas encore de mesure ». */
  mesure: boolean;
  /** Anciens liens (sans numéro de suivi) communs à plusieurs vidéos : leurs visites ne sont pas comptées. Absent : aucun. */
  liensPartages?: number;
}

export interface SuiviDesVideos {
  lignes: LigneSuivi[];
  /** Vrai quand la lecture du site est simulée ou impossible. */
  pasEncoreDeMesure: boolean;
}

export interface DependancesSuivi {
  visites?: LecteurVisites;
  /** Une seule vidéo (le bloc de sa fiche) ; absent : toutes les vidéos du format. */
  videoId?: Id;
}

const objet = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const entreesDe = (v: Pick<Video, "entrees">): Record<string, unknown> => objet(objet(v.entrees)?.[ENTREE_CAS_CONCRET]) ?? {};

/** Les vidéos du format, hors essais et hors archives, de la plus récente à la plus ancienne. */
async function videosDuFormat(): Promise<Video[]> {
  const toutes = await depots().videos.lister((v) => v.formatId === FORMAT_ID && v.statut !== "archivee" && entreesDe(v).essai !== true);
  return toutes.sort((a, b) => (a.creeLe < b.creeLe ? 1 : a.creeLe > b.creeLe ? -1 : 0));
}

/** Suivi par publication (vidéo et réseau). Session exigée. */
export async function suiviDesVideos(dependances: DependancesSuivi = {}): Promise<SuiviDesVideos> {
  await exigerSession();
  // Réglage éteint (défaut) : le site n'est pas lu.
  if (!(await reglageAllume(REGLAGES_CAS_CONCRET.releves))) throw new ErreurStudio("FONCTION_FERMEE", PHRASE_RELEVES_FERMES);
  const videos = (await videosDuFormat()).filter((v) => !dependances.videoId || v.id === dependances.videoId);
  const publications = await depots().publications.lister((p) => p.statut === "publiee" && videos.some((v) => v.id === p.videoId));

  const lecteur = dependances.visites ?? creerLecteurPlausible();
  let lignesSite: LigneLien[] | null = null;
  if (lecteur.mode === "reel") {
    const garde = dependances.visites ? null : cacheSite;
    if (garde && garde.jusqua > Date.now()) {
      lignesSite = garde.lignes;
    } else {
      try {
        const lues = await lecteur.lire({ periode: "90d" });
        lignesSite = lues;
        // Lecture du site réelle : gardée quelques minutes (chaque fiche de vidéo la demande) ; jamais pour un lecteur injecté.
        if (lues && !dependances.visites) cacheSite = { jusqua: Date.now() + DUREE_CACHE_SITE_MS, lignes: lues };
      } catch {
        lignesSite = null;
      }
    }
  }
  const parCle = new Map<string, { visites: number }>();
  for (const l of lignesSite ?? []) {
    const campagne = l.campagne.trim();
    if (!campagne || campagne === "(not set)") continue;
    const k = `${campagne}|${l.source ?? ""}`;
    const x = parCle.get(k) ?? { visites: 0 };
    parCle.set(k, { visites: x.visites + Math.max(0, l.visites | 0) });
  }

  const versions = videos.length ? await depots().versions.lister((x) => videos.some((v) => v.id === x.videoId)) : [];
  const valide = (n: number | undefined): n is number => n !== undefined && Number.isInteger(n) && n >= 1;
  /** Le numéro du lien d'une version : `numeroSuivi` (unique au studio), à défaut `numero` (anciennes versions). */
  const numeroDuLien = (x: { numero: number; numeroSuivi?: number }) => x.numeroSuivi ?? x.numero;

  // Propriétaires de chaque lien : toutes les versions du format (archivées et essais compris, maquettes numéro 0 exclues).
  const idsDuFormat = new Set((await depots().videos.lister((v) => v.formatId === FORMAT_ID)).map((v) => v.id));
  // Limites connues : (a) « Ancien lien » peut s'afficher pour une version récente créée sans numeroSuivi hors creerFabrication/recalque
  // (comptage juste, exclusion par prudence) ; (b) une vidéo supprimée pour de bon n'est plus propriétaire, ses anciennes visites
  // pourraient aller à la vidéo qui partageait son ancien lien ; (c) cette carte ignore le réseau : visites perdues si deux anciennes V1
  // de réseaux différents partagent un code.
  const proprietaires = new Map<number, Set<Id>>();
  for (const x of idsDuFormat.size ? await depots().versions.lister((x) => idsDuFormat.has(x.videoId)) : []) {
    const n = numeroDuLien(x);
    if (!valide(n)) continue;
    proprietaires.set(n, (proprietaires.get(n) ?? new Set<Id>()).add(x.videoId));
  }

  const lignes: LigneSuivi[] = [];
  for (const v of videos) {
    const e = entreesDe(v);
    const siennes = versions.filter((x) => x.videoId === v.id && valide(numeroDuLien(x)));
    // Le code affiché : celui de la version choisie ; à défaut, de la plus récente.
    const choisie = siennes.find((x) => x.id === v.versionChoisieId) ?? [...siennes].sort((a, b) => b.numero - a.numero)[0];
    const reseaux = Array.isArray(e.reseaux) ? RESEAUX.filter((r) => (e.reseaux as unknown[]).includes(r)) : [];
    for (const reseau of reseaux) {
      const code = choisie ? codeVersionCasConcret(numeroDuLien(choisie), reseau) : "";
      // Les liens de toutes les versions numérotées : une version déjà publiée garde son lien et ses visites.
      const codes = [...new Set(siennes.map(numeroDuLien))];
      const siens = codes.filter((n) => { const p = proprietaires.get(n); return !p || (p.size === 1 && p.has(v.id)); });
      const liensPartages = codes.length - siens.length;
      const trouves = siens.map((n) => parCle.get(`${codeVersionCasConcret(n, reseau)}|${reseau}`)).filter((c): c is { visites: number } => !!c);
      const vues = publications.filter((p) => p.videoId === v.id && p.reseau === reseau && typeof p.stats?.vues === "number").reduce((n, p) => n + Math.max(0, p.stats!.vues!), 0);
      const aDesVues = publications.some((p) => p.videoId === v.id && p.reseau === reseau && typeof p.stats?.vues === "number");
      lignes.push({
        videoId: v.id,
        titre: v.titre,
        reseau,
        date: v.creeLe.slice(0, 10),
        codeSuivi: code,
        ...(aDesVues ? { vues } : {}),
        visites: trouves.reduce((n, c) => n + c.visites, 0),
        mesure: trouves.length > 0,
        ...(liensPartages > 0 ? { liensPartages } : {}),
      });
    }
  }

  return { lignes, pasEncoreDeMesure: lecteur.mode !== "reel" || lignesSite === null };
}
