/**
 * Pioche commune (T-EXT-32) : UN seul point de pioche, deux stockages (archive X4 « extrait: » et scènes gardées
 * du tutoriel « scene: »). Éteint par défaut (réglage `pioche.commune`, seul `true` exact allume) ; aucun appelant en
 * production ; aucun appel payant, aucun rendu. Le droit de l'archive est appliqué par `plagesDisponibles` (rien n'est
 * recopié) ; le droit des scènes est écrit UNE fois ici, aux mêmes règles. Le classement est délégué à `choisirExtrait`.
 * Ne lève jamais : une erreur rend `null` et journalise une ligne (ids et comptes seulement, jamais de paroles).
 *
 * Scènes gardées (T-EXT-15, fusionnée) : lecture par `lireScenesGardees` (port `ports.scenes` par défaut, éteint tant que
 * `tutoriel.scenesGardees` n'est pas `true`), réutilisables = `scenesReutilisables`.
 */
import "server-only";
import { plagesDisponibles } from "@/briques/archive-extraits/choix";
import { choisirExtrait, type CandidatNote } from "@/briques/bibliotheque-video/pioche-extraits";
import type { IdCapacite } from "@/briques/bibliotheque-video/types";
import type { SujetExtrait, UsageExtrait } from "@/briques/note-extraits/types";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { etatLicence } from "@/domaine/derivations";
import type { ElementBibliotheque, IdReseau, Ratio } from "@/domaine/types";
import { scenesReutilisables, type IndexScenes } from "@/moteurs/montage-tutoriel-outil/index-scenes";
import { lireScenesGardees } from "./scenes-tutoriel";
import { depots as depotsParDefaut, journaliser, lireParametre } from "./_commun";

export const PARAM_PIOCHE_COMMUNE = "pioche.commune";

export type SourcePioche = "archive" | "scene";

export interface CandidatPioche {
  /** `extrait:…` (archive) ou `scene:…` (scène gardée). */
  cle: string;
  source: SourcePioche;
  capacite: IdCapacite;
  debutSec: number;
  finSec: number;
  ratio: Ratio;
  famille: string[];
  visage: "williams" | "aucun";
  texteIncruste: boolean;
  sujet: SujetExtrait | null;
  note?: number;
  usages: UsageExtrait[];
  reference:
    | { source: "archive"; elementId: string; plageId: string }
    | { source: "scene"; videoId: string; sceneCle: string; morceau: PlanValide };
}

export interface BesoinPioche {
  capacite: IdCapacite;
  usage: UsageExtrait;
  sujet: SujetExtrait | null;
  sources: SourcePioche[];
  videoDemandeuse: string;
  reseaux: IdReseau[];
  /** Clés des deux préfixes mêlées. */
  dejaUtilisees: string[];
  graine: string;
  maintenant: Date;
  ratio?: Ratio;
  /** Scènes seulement. */
  role?: string;
  dureeMinSec?: number;
  dureeMaxSec?: number;
  /** Défaut faux. */
  accepteTexteIncruste?: boolean;
}

export interface PortsPioche {
  depots?: typeof depotsParDefaut;
  /** Lecture de l'index des scènes gardées (défaut : `lireScenesGardees`). */
  scenes?: () => Promise<IndexScenes>;
}

const PREFIXE_ARCHIVE = "extrait:";
const PREFIXE_SCENE = "scene:";
/** Une scène gardée est au maître 4:5 ; elle se recalcule pour 9:16 ou 1:1 (V1). 16:9 : exclu en V1 (T-EXT-43). */
const RATIOS_SCENE_V1: readonly Ratio[] = ["9:16", "1:1", "4:5"];

/** Archive : `besoin.ratio`, `dureeMaxSec` et `role` sont ignorés (conforme à la fiche) ; seule `dureeMinSec` s'applique. */
export function candidatsArchive(elements: readonly ElementBibliotheque[], besoin: BesoinPioche): CandidatPioche[] {
  const plages = plagesDisponibles(elements, {
    videoId: besoin.videoDemandeuse,
    capacite: besoin.capacite,
    reseaux: besoin.reseaux,
    dejaUtilisees: besoin.dejaUtilisees.filter((c) => c.startsWith(PREFIXE_ARCHIVE)),
    maintenant: besoin.maintenant,
    dureeMinSec: besoin.dureeMinSec,
  });
  return plages.map((d) => ({
    cle: d.cle,
    source: "archive" as const,
    capacite: besoin.capacite,
    debutSec: d.plage.debutSec,
    finSec: d.plage.finSec,
    ratio: d.ratio,
    famille: d.famille,
    visage: d.plage.avecVisage ? ("williams" as const) : ("aucun" as const),
    texteIncruste: d.plage.texteIncruste,
    sujet: (d.plage.sujet ?? null) as SujetExtrait | null,
    note: d.plage.note,
    usages: (d.plage.usages ?? []) as UsageExtrait[],
    reference: { source: "archive" as const, elementId: d.elementId, plageId: d.plage.id },
  }));
}

/** Droit d'une scène : les mêmes règles que `plagesDisponibles` (licence copiée, famille, une source par vidéo). */
export function candidatsScenes(index: IndexScenes, besoin: BesoinPioche): CandidatPioche[] {
  if (besoin.accepteTexteIncruste !== true) return []; // texte incrusté toujours vrai (même esprit que P-4)
  const ratio = besoin.ratio ?? "4:5";
  if (!RATIOS_SCENE_V1.includes(ratio)) return [];
  const sortie: CandidatPioche[] = [];
  for (const e of scenesReutilisables(index)) {
    const l = e.licence;
    if (etatLicence(l, besoin.maintenant) !== "ok" || !l.usageCommercial) continue;
    if (l.reseaux.length > 0 && !besoin.reseaux.every((r) => l.reseaux.includes(r))) continue;
    if (besoin.videoDemandeuse === e.videoId || e.famille.includes(besoin.videoDemandeuse)) continue;
    if (besoin.dejaUtilisees.some((c) => c.startsWith(`${PREFIXE_SCENE}${e.videoId}:`))) continue; // une source par vidéo
    if (besoin.dejaUtilisees.includes(e.cle)) continue;
    if (besoin.role !== undefined && e.role !== besoin.role) continue;
    const duree = e.dureeMs / 1000;
    if (besoin.dureeMinSec !== undefined && duree < besoin.dureeMinSec) continue;
    if (besoin.dureeMaxSec !== undefined && duree > besoin.dureeMaxSec) continue;
    sortie.push({
      cle: e.cle, source: "scene", capacite: besoin.capacite, debutSec: 0, finSec: duree, ratio,
      famille: e.famille, visage: "aucun", texteIncruste: true, sujet: e.sujet, usages: ["ecran"],
      reference: { source: "scene", videoId: e.videoId, sceneCle: e.cle, morceau: e.morceau },
    });
  }
  return sortie;
}

/**
 * Exclut par `cle` (les deux préfixes : `choisirExtrait` ne connaît que `extrait:`), puis délègue TOUT le classement
 * à `choisirExtrait`. Aucune autre règle. `choisirExtrait` place les candidats notés avant les non notés quel que soit le score : un extrait noté passe donc avant une scène qui a le bon sujet (à faire valider par le pilote).
 */
export function piocher(candidats: readonly CandidatPioche[], besoin: BesoinPioche): CandidatPioche | null {
  const exclues = new Set(besoin.dejaUtilisees);
  const parObjet = new Map<CandidatNote, CandidatPioche>();
  for (const c of candidats) {
    if (exclues.has(c.cle)) continue;
    const r = c.reference;
    const elementId = r.source === "archive" ? r.elementId : r.videoId;
    const plageId = r.source === "archive" ? r.plageId : r.sceneCle.slice(`${PREFIXE_SCENE}${r.videoId}:`.length);
    const objet: CandidatNote = {
      id: c.cle, capacite: c.capacite, cle: c.cle, elementId, plageId,
      debutSec: c.debutSec, finSec: c.finSec, ratio: c.ratio, visage: c.visage,
      texteIncruste: c.texteIncruste, famille: c.famille, note: c.note, sujet: c.sujet, usages: c.usages,
    };
    parObjet.set(objet, c);
  }
  const choisi = choisirExtrait([...parObjet.keys()], { usage: besoin.usage, sujet: besoin.sujet, graine: besoin.graine }, []);
  return choisi ? (parObjet.get(choisi) ?? null) : null;
}

export async function piocherCommun(besoin: BesoinPioche, ports?: PortsPioche): Promise<CandidatPioche | null> {
  try {
    if ((await lireParametre<unknown>(PARAM_PIOCHE_COMMUNE, false)) !== true) return null;
    const candidats: CandidatPioche[] = [];
    if (besoin.sources.includes("archive")) {
      const lesDepots = (ports?.depots ?? depotsParDefaut)();
      const elements: ElementBibliotheque[] = await lesDepots.elements.lister((e) => e.type === "source-extraits" && !e.archiveLe);
      candidats.push(...candidatsArchive(elements, besoin));
    }
    if (besoin.sources.includes("scene")) {
      candidats.push(...candidatsScenes(await (ports?.scenes ?? lireScenesGardees)(), besoin));
    }
    return piocher(candidats, besoin);
  } catch (e) {
    await journaliser("pioche-commune", `Pioche commune : lecture impossible (${e instanceof Error ? e.name : "erreur"})`).catch(() => undefined);
    return null;
  }
}
