/**
 * TRAÇABILITÉ DU TABLEAU ANIMÉ (service) : l'historique d'une vidéo, en ajout seul.
 *
 * - `ajouterEvenement` : écrit un événement s'il n'existe pas ; un identifiant déjà pris n'est JAMAIS réécrit
 *   (ni modifié, ni retiré : ce service n'a ni « modifier » ni « supprimer »).
 * - `reconstruireHistorique` : relit le journal de fabrication déjà en base et ajoute ce qui manque ; rejouable à
 *   volonté, sans doublon et sans effet de bord (rien n'est payé, aucun appel réseau).
 * - `lireHistorique`, `coutTotal`, `exporterCsv`, `exporterJson` ; `historiqueTableau` (la vue de la page de la vidéo)
 *   et `noterPublication` (saisie à la main) vérifient la session et le format.
 */
import "server-only";
import { ecranTableauVisible } from "@/components/formats/tableau-anime/aiguillage";
import {
  coutTotalCentimes,
  enCsv,
  enJson,
  idEvenementTrace,
  libelleEvenement,
  reconstruireTrace,
  trierChronologie,
  type EvenementTrace,
  type NouvelEvenementTrace,
  type TypeTrace,
} from "@/domaine/tracabilite-tableau";
import type { Id, IdReseau } from "@/domaine/types";
import { trouverFormat } from "@/formats";
import { nouvelId } from "@/lib/ids";
import { listerReseaux } from "@/reseaux";
import { depots, ErreurStudio, maintenant } from "./_commun";
import { exigerSession } from "./auth";
import { coutsDeLaVideo } from "./cout-video";

/* ------------------------------------------------------------------ */
/* Ajout et lecture                                                      */
/* ------------------------------------------------------------------ */

/**
 * Ajoute un événement. Renvoie `ajoute: false` (et l'événement déjà là, intact) si sa clé existe déjà : un fait
 * enregistré ne se réécrit pas.
 */
export async function ajouterEvenement(nouveau: NouvelEvenementTrace): Promise<{ ajoute: boolean; evenement: EvenementTrace }> {
  const d = depots().tracesTableau;
  const id = idEvenementTrace(nouveau.videoId, nouveau.cle);
  const existant = await d.obtenir(id);
  if (existant) return { ajoute: false, evenement: existant };
  const m = maintenant();
  const evenement: EvenementTrace = { ...nouveau, id, creeLe: m, modifieLe: m };
  await d.enregistrer(evenement);
  return { ajoute: true, evenement };
}

/** L'historique d'une vidéo, du plus ancien au plus récent. */
export async function lireHistorique(videoId: Id): Promise<EvenementTrace[]> {
  return trierChronologie(await depots().tracesTableau.lister((e) => e.videoId === videoId));
}

/** Coût total cumulé de la vidéo, en centimes d'euro. */
export async function coutTotal(videoId: Id): Promise<number> {
  return coutTotalCentimes(await lireHistorique(videoId));
}

/** Tableur (CSV) : une ligne par événement. */
export async function exporterCsv(videoId: Id): Promise<string> {
  return enCsv(await lireHistorique(videoId));
}

/** JSON complet. */
export async function exporterJson(videoId: Id): Promise<string> {
  return enJson(videoId, await lireHistorique(videoId));
}

/* ------------------------------------------------------------------ */
/* Reconstruction depuis le journal de fabrication                      */
/* ------------------------------------------------------------------ */

export interface BilanReconstruction {
  /** Événements écrits par cet appel. */
  ajoutes: number;
  /** Événements déjà en base, laissés tels quels. */
  dejaLa: number;
}

/** Ajoute à l'historique ce que le journal de fabrication, les retouches et les publications racontent déjà. */
export async function reconstruireHistorique(videoId: Id): Promise<BilanReconstruction> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  if (!video) return { ajoutes: 0, dejaLa: 0 };
  const [script, versions, travaux, retouches, sorties, publications] = await Promise.all([
    video.scriptId ? d.scripts.obtenir(video.scriptId) : Promise.resolve(null),
    d.versions.lister((v) => v.videoId === videoId),
    d.travaux.lister((t) => t.cibleId === videoId),
    d.retouches.lister((r) => r.videoId === videoId),
    d.sorties.lister((s) => s.videoId === videoId),
    d.publications.lister((p) => p.videoId === videoId),
  ]);
  const noms = new Map(listerReseaux().map((r) => [r.id as string, r.nom]));
  const candidats = reconstruireTrace({ video, script, versions, travaux, retouches, sorties, publications, nomReseau: (id) => noms.get(id) ?? id });
  let ajoutes = 0;
  for (const c of candidats) if ((await ajouterEvenement(c)).ajoute) ajoutes++;
  return { ajoutes, dejaLa: candidats.length - ajoutes };
}

/* ------------------------------------------------------------------ */
/* Ce que la page de la vidéo lit                                       */
/* ------------------------------------------------------------------ */

export interface LigneHistorique {
  id: Id;
  date: string;
  type: TypeTrace;
  phrase: string;
  lien?: string;
}

export interface VueHistorique {
  lignes: LigneHistorique[];
  /** Ce qui a été payé pour la vidéo (centimes d'euro) : la même somme que « Coût payé » de la page. */
  coutTotalCentimes: number;
  reseaux: { id: string; nom: string }[];
}

async function videoDuTableau(videoId: Id) {
  const video = await depots().videos.obtenir(videoId);
  return video && ecranTableauVisible(trouverFormat(video.formatId)) ? video : null;
}

/** Historique d'une vidéo du tableau animé (reconstruit au besoin) ; `null` pour tout autre format, ou format masqué. */
export async function historiqueTableau(videoId: Id): Promise<VueHistorique | null> {
  await exigerSession();
  if (!(await videoDuTableau(videoId))) return null;
  await reconstruireHistorique(videoId);
  const evenements = await lireHistorique(videoId);
  return {
    lignes: evenements.map((e) => ({ id: e.id, date: e.date, type: e.type, phrase: libelleEvenement(e), ...(typeof e.donnees.lien === "string" ? { lien: e.donnees.lien } : {}) })),
    // UNE seule somme, la vraie : ce qui a été payé pour la vidéo (écriture, découpage, voix), la même que « Coût payé »
    // en haut de la page (avant : la somme des traces, sans l'écriture ni le découpage, 0,00 € à côté de 1,06 €).
    coutTotalCentimes: (await coutsDeLaVideo(videoId)).paye.centimes,
    reseaux: listerReseaux().map((r) => ({ id: r.id, nom: r.nom })),
  };
}

/** Fichier à télécharger : nom, type et contenu. */
export async function telechargerHistorique(videoId: Id, format: "csv" | "json"): Promise<{ nom: string; type: string; contenu: string }> {
  await exigerSession();
  if (!(await videoDuTableau(videoId))) throw new ErreurStudio("TRACE_INTROUVABLE", "L'historique de cette vidéo n'est pas disponible.");
  await reconstruireHistorique(videoId);
  return format === "csv"
    ? { nom: `historique-${videoId}.csv`, type: "text/csv;charset=utf-8", contenu: await exporterCsv(videoId) }
    : { nom: `historique-${videoId}.json`, type: "application/json", contenu: await exporterJson(videoId) };
}

/* ------------------------------------------------------------------ */
/* Publication saisie à la main                                         */
/* ------------------------------------------------------------------ */

/** « Publiée sur… » : réseau, date (AAAA-MM-JJ) et lien. Ajoute un événement ; ne touche à rien d'autre. */
export async function noterPublication(videoId: Id, saisie: { reseau: string; date: string; lien?: string }): Promise<EvenementTrace> {
  await exigerSession();
  if (!(await videoDuTableau(videoId))) throw new ErreurStudio("TRACE_INTROUVABLE", "Cette vidéo n'est pas une vidéo du tableau animé.");
  const reseau = listerReseaux().find((r) => r.id === saisie.reseau);
  if (!reseau) throw new ErreurStudio("TRACE_RESEAU", "Choisissez un réseau dans la liste.");
  const jour = /^(\d{4})-(\d{2})-(\d{2})$/.exec(saisie.date.trim());
  const valide = jour && new Date(`${jour[0]}T00:00:00.000Z`).toISOString().startsWith(jour[0]);
  if (!valide) throw new ErreurStudio("TRACE_DATE", "Indiquez la date de publication.");
  const lien = saisie.lien?.trim() ?? "";
  if (lien && !/^https?:\/\/\S+$/i.test(lien)) throw new ErreurStudio("TRACE_LIEN", "Le lien doit commencer par https://.");
  const r = await ajouterEvenement({
    videoId,
    type: "publication",
    cle: `publication:saisie:${nouvelId("pub")}`,
    date: `${jour![0]}T12:00:00.000Z`,
    ordre: 1_000_000,
    origine: "saisie",
    donnees: { reseau: reseau.id as IdReseau, reseauNom: reseau.nom, ...(lien ? { lien } : {}), via: "manuel" },
  });
  return r.evenement;
}
