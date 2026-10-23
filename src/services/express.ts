/**
 * ÉCRAN « VOTRE VIDÉO » (lot M3 ; plan PARTIE A §2-3, B.0 §2 et §16, B.9) : données et gestes du service.
 * - « Mes scripts » du format, triés par note puis par date ;
 * - texte collé → blocs de la recette (`FournisseurScript.decouper`, jamais réécrit) ;
 * - saisie libre « bureau, costume bleu, debout » → pastilles (`resoudreDistribution`), sans jamais rien lancer ;
 * - aperçu du plateau : images détourées des doubles, images des décors, fichiers des LUT ;
 * - plans de la maquette (composée dans le navigateur) ;
 * - enregistrement du brouillon qui respecte un script choisi dans « Mes scripts » (il n'est pas réécrit pour rien).
 */
import "server-only";
import type { BlocScript, Id, Plan, SegmentSousTitres } from "@/domaine/types";
import { tenueDe, postureDe } from "@/domaine/distribution";
import { trierMesScripts } from "@/assistant/express/logique";
import type { PastilleDistribution } from "@/fournisseurs";
import { obtenirFormat } from "@/formats";
import { depots, ecrireParametre, ErreurStudio, fournisseur, lireParametre } from "./_commun";
import { exigerSession } from "./auth";
import { urlsFichiers } from "./fichiers";
import { listerScripts } from "./scripts";
import { enregistrerScriptDuBrouillon, modifierBrouillon, sousTitresCourants, type DonneesBrouillon } from "./videos";

/** Un script de « Mes scripts », prêt à afficher. */
export interface ScriptExpress {
  id: Id;
  sujet: string;
  apercu: string;
  dureeEstimeeSec: number;
  note?: number;
  reference: boolean;
  modifieLe: string;
  blocs: BlocScript[];
  adresse?: "tu" | "vous";
}

/** Adresses des images du plateau (gratuit, aucun appel payant). */
export interface DonneesPlateau {
  /** Image détourée (PNG transparent) de chaque visage qui en a une. */
  detoures: Record<Id, string>;
  /** Image pleine de chaque décor (mode image). */
  decors: Record<Id, string>;
  /** Échantillon de chaque voix (écoute gratuite). */
  echantillonsVoix: Record<Id, string>;
}

export interface DonneesExpress {
  scripts: ScriptExpress[];
  plateau: DonneesPlateau;
}

/** « Mes scripts » : ceux du format (références comprises), triés par note puis par date (B.0 §16). */
export async function mesScripts(formatId: string, limite = 30): Promise<ScriptExpress[]> {
  const scripts = await listerScripts({ formatId });
  return trierMesScripts(scripts, formatId)
    .filter((s) => s.blocs.some((b) => b.segments.some((x) => x.texte.trim())))
    .slice(0, limite)
    .map((s) => ({ id: s.id, sujet: s.sujet, apercu: s.apercu, dureeEstimeeSec: s.dureeEstimeeSec, note: s.notes?.globale, reference: s.reference, modifieLe: s.modifieLe, blocs: s.blocs, adresse: s.adresse }));
}

/** Images du plateau : détourés, décors, échantillons de voix. */
export async function donneesPlateau(): Promise<DonneesPlateau> {
  const d = depots();
  const [visages, decors, voix] = await Promise.all([d.visages.lister((v) => !!v.detoureFichierId), d.elements.lister((e) => e.type === "decor" && !e.archiveLe), d.voix.lister((v) => !!v.echantillonFichierId)]);
  const imageDecor = (e: (typeof decors)[number]) => (e.valeur.type === "decor" ? (e.valeur.imageFichierId ?? e.fichierId) : e.fichierId);
  const urls = await urlsFichiers([...visages.map((v) => v.detoureFichierId), ...decors.map(imageDecor), ...voix.map((v) => v.echantillonFichierId)]);
  const choisir = <T,>(liste: T[], id: (x: T) => string, fichier: (x: T) => string | undefined) =>
    Object.fromEntries(liste.flatMap((x) => (fichier(x) && urls[fichier(x)!] ? [[id(x), urls[fichier(x)!]]] : [])));
  return {
    detoures: choisir(visages, (v) => v.id, (v) => v.detoureFichierId),
    decors: choisir(decors, (e) => e.id, imageDecor),
    echantillonsVoix: choisir(voix, (v) => v.id, (v) => v.echantillonFichierId),
  };
}

export async function donneesExpress(formatId: string): Promise<DonneesExpress> {
  const [scripts, plateau] = await Promise.all([mesScripts(formatId), donneesPlateau()]);
  return { scripts, plateau };
}

/**
 * « bureau, costume bleu, debout » → pastilles à vérifier (A.3). Le catalogue vient de la Bibliothèque (décors)
 * et des doubles du personnage (tenues, postures filmées). Ne lance jamais rien.
 */
export async function pastillesDepuisPhrase(personnageId: Id | undefined, phrase: string): Promise<PastilleDistribution[]> {
  await exigerSession();
  const texte = phrase.trim();
  if (!texte) return [];
  const d = depots();
  const [decors, visages] = await Promise.all([
    d.elements.lister((e) => e.type === "decor" && !e.archiveLe),
    personnageId ? d.visages.lister((v) => v.personnageId === personnageId && (v.statut === "pret" || v.statut === "a_verifier")) : Promise.resolve([]),
  ]);
  const tenues = new Map<string, string>();
  for (const v of visages) if (tenueDe(v)) tenues.set(tenueDe(v), v.tenue);
  const catalogue = {
    decors: decors.map((e) => ({ id: e.id, nom: e.nom, motsCles: e.motsCles })),
    tenues: [...tenues].map(([id, nom]) => ({ id, nom })),
    postures: (["assis", "debout"] as const).map((p) => ({ posture: p, filmee: visages.some((v) => postureDe(v) === p) })),
  };
  return (await fournisseur("script")).resoudreDistribution(texte, catalogue);
}

export interface PlanMaquetteVue extends Pick<Plan, "ordre" | "debutSec" | "finSec" | "texte" | "sourceImage" | "angle" | "cadrage"> {
  vignette: string | null;
}

/** Plans exacts et sous-titres d'une maquette, pour la composer dans le navigateur (B.1, B.9). */
export async function plansMaquette(versionId: Id): Promise<{ plans: PlanMaquetteVue[]; sousTitres: SegmentSousTitres[] }> {
  await exigerSession();
  const d = depots();
  const version = await d.versions.obtenir(versionId);
  if (!version) throw new ErreurStudio("INTROUVABLE", "Cette maquette n'existe plus.");
  const plans = (await d.plans.lister((p) => p.versionId === versionId)).sort((a, b) => a.ordre - b.ordre);
  const elements = await d.elements.lister((e) => plans.some((p) => p.illustration?.elementId === e.id));
  const urls = await urlsFichiers([...plans.map((p) => p.vignetteFichierId), ...elements.map((e) => e.vignetteFichierId)]);
  const st = await sousTitresCourants(versionId);
  return {
    plans: plans.map((p) => {
      const el = elements.find((e) => e.id === p.illustration?.elementId);
      const vignette = (p.sourceImage === "illustration" && el?.vignetteFichierId ? urls[el.vignetteFichierId] : undefined) ?? (p.vignetteFichierId ? urls[p.vignetteFichierId] : undefined) ?? null;
      return { ordre: p.ordre, debutSec: p.debutSec, finSec: p.finSec, texte: p.texte, sourceImage: p.sourceImage, angle: p.angle, cadrage: p.cadrage, vignette };
    }),
    sousTitres: st?.segments ?? [],
  };
}

/**
 * Enregistre le brouillon. Un script choisi dans « Mes scripts » devient celui de la vidéo SANS être réécrit ;
 * il ne l'est que si son texte change ensuite (une référence n'est jamais modifiée : une copie est créée).
 */
export async function enregistrerBrouillonExpress(videoId: Id, donnees: DonneesBrouillon, blocs?: BlocScript[]): Promise<{ scriptId?: string }> {
  await exigerSession();
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  if (!video) throw new ErreurStudio("INTROUVABLE", "Cette vidéo n'existe plus.");
  let scriptId = video.scriptId;
  if (donnees.scriptId && donnees.scriptId !== video.scriptId) {
    const choisi = await d.scripts.obtenir(donnees.scriptId);
    if (choisi && choisi.formatId === video.formatId) {
      await d.videos.modifier(videoId, { scriptId: choisi.id });
      scriptId = choisi.id;
    }
  }
  let scriptEcrit: string | undefined;
  if (blocs?.length) {
    const actuel = scriptId ? await d.scripts.obtenir(scriptId) : null;
    if (!actuel || JSON.stringify(actuel.blocs) !== JSON.stringify(blocs)) scriptEcrit = (await enregistrerScriptDuBrouillon(videoId, blocs)).id;
  }
  const { scriptId: _ignore, ...reste } = donnees;
  void _ignore;
  const final = scriptEcrit ?? scriptId;
  await modifierBrouillon(videoId, final ? { ...reste, scriptId: final } : reste);
  return { scriptId: final };
}

/* --- Décor habituel, mémorisé par format (le modèle, lui, porte le sien) --- */

const cleDecorHabituel = (formatId: string) => `habitudes.decor.${formatId}`;

/** Dernier décor fabriqué pour ce format (absent : le défaut, N1 Halo orange pour l'avocat). */
export async function decorHabituel(formatId: string): Promise<string | undefined> {
  const id = await lireParametre<string | null>(cleDecorHabituel(formatId), null);
  if (!id) return undefined;
  const e = await depots().elements.obtenir(id);
  return e && e.type === "decor" && !e.archiveLe ? id : undefined;
}

/** Au lancement d'une fabrication : le décor de la vidéo devient l'habitude du format. */
export async function memoriserDecor(videoId: Id): Promise<void> {
  const v = await depots().videos.obtenir(videoId);
  if (v?.styles.decorId) await ecrireParametre(cleDecorHabituel(v.formatId), v.styles.decorId);
}

/** Le format a-t-il l'écran « Votre vidéo » ? */
export function formatExpress(formatId: string): boolean {
  return obtenirFormat(formatId).etapes.includes("express");
}
