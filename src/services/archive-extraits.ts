/**
 * Archive des vidéos livrées (C3-UT-3.6b) : service d'inscription de la fiche « source-extraits » de chaque vidéo.
 * Deux interrupteurs, tous éteints par défaut (seul `true` exact allume) : `bibliothequeVideo.archive.inscription` et
 * `bibliothequeVideo.archive.sources`. Au plus 20 vidéos par passe, une passe toutes les 10 minutes. Rien n'est supprimé.
 * Aucun appel payant : ni fournisseur, ni rendu, ni réseau. Rien ne l'appelle encore (le branchement est fait par 3.7).
 */
import "server-only";
import { createHash } from "node:crypto";
import { PLAGES_MAX_PAR_FICHE, TAILLE_MAX_FICHE_CARACTERES, type FicheSourceExtraits, type PlageExtrait } from "@/domaine/archive-extraits";
import type { ElementBibliotheque, Licence, SousTitres, Video } from "@/domaine/types";
import { familleDeVideo } from "@/briques/archive-extraits/famille";
import { fenetresDuFormat } from "@/briques/archive-extraits/fenetres";
import { licencePlusRestrictive } from "@/briques/archive-extraits/licence";
import { decouperPlages, motsDepuisSegments, plafonner } from "@/briques/archive-extraits/plages";
import {
  POLITIQUE_SOURCES_PAR_DEFAUT,
  qualifierPlages,
  reporterGestes,
  sourcePreferee,
  videoEligible,
  type PolitiqueSources,
} from "@/briques/archive-extraits/inscription";
import { depots, ecrireParametre, journaliser, lireParametre, sousVerrou } from "./_commun";

export const REGLAGE_INSCRIPTION = "bibliothequeVideo.archive.inscription";
export const REGLAGE_SOURCES = "bibliothequeVideo.archive.sources";
export const DONNEE_DERNIER_PASSAGE = "bibliothequeVideo.archive.dernierPassage";
export const DONNEE_COCHEES = "bibliothequeVideo.archive.cochees";

export const VIDEOS_MAX_PAR_PASSE = 20;
export const INTERVALLE_PASSES_MS = 10 * 60 * 1000;

const SEPARATEUR_NOM = " · ";

/** Ports injectables : l'horloge et, au besoin, la politique et les vidéos cochées (sinon lues dans les réglages). */
export interface PortsArchive {
  maintenant?: () => string;
  politique?: PolitiqueSources;
  cochees?: string[];
}

const horloge = (p?: PortsArchive) => (p?.maintenant ?? (() => new Date().toISOString()))();

export const idElementArchive = (videoId: string): string => `archive-extraits-${videoId}`;

async function politiqueDesSources(): Promise<PolitiqueSources> {
  const v = await lireParametre<unknown>(REGLAGE_SOURCES, null);
  return v === "publiees" || v === "pretes" || v === "cochees" ? v : POLITIQUE_SOURCES_PAR_DEFAUT;
}

async function videosCochees(): Promise<string[]> {
  const v = await lireParametre<unknown>(DONNEE_COCHEES, []);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

const estRangee = (v: Pick<Video, "statut" | "corbeilleLe">) => v.statut === "archivee" || !!v.corbeilleLe;

function empreinteDeNom(nom: string): string | undefined {
  const i = nom.lastIndexOf(SEPARATEUR_NOM);
  return i >= 0 ? nom.slice(i + SEPARATEUR_NOM.length) : undefined;
}

function ficheDeElement(e: ElementBibliotheque | null | undefined): FicheSourceExtraits | null {
  return e && e.valeur.type === "source-extraits" ? e.valeur.fiche : null;
}

const taille = (f: FicheSourceExtraits) => JSON.stringify(f).length;

/** Retire des plages (les moins utiles d'abord, par `plafonner`) jusqu'à passer sous la taille maximale. */
function entrerDansLaTaille(fiche: FicheSourceExtraits): FicheSourceExtraits {
  let f = fiche;
  while (taille(f) > TAILLE_MAX_FICHE_CARACTERES && f.plages.length > 0) {
    f = { ...f, plages: plafonner(f.plages, f.plages.length - 1) };
  }
  return f;
}

async function elementDeLaVideo(videoId: string): Promise<ElementBibliotheque | null> {
  return depots().elements.obtenir(idElementArchive(videoId));
}

export type ResultatInscription = { ecrite: boolean; raison?: string };

/** Inscrit (ou met à jour) la fiche d'une vidéo. N'écrit rien si la vidéo est refusée ou si rien n'a changé. */
export async function inscrireVideo(videoId: string, ports?: PortsArchive): Promise<ResultatInscription> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  if (!video) return { ecrite: false, raison: "vidéo absente" };
  const version = video.versionChoisieId ? await d.versions.obtenir(video.versionChoisieId) : null;
  if (!version) return { ecrite: false, raison: "pas de version choisie" };

  const [sorties, pistes, sousTitres] = await Promise.all([
    d.sorties.lister((s) => s.versionId === version.id),
    d.pistes.lister((p) => p.versionId === version.id),
    d.sousTitres.lister((s) => s.versionId === version.id),
  ]);
  const choisie = sourcePreferee(pistes, sorties);
  const sortie = choisie ? sorties.find((s) => s.id === choisie.sortieId) : undefined;
  const fichierSortie = sortie ? await d.fichiers.obtenir(sortie.fichierId) : null;
  const segments = sousTitres.flatMap((s: SousTitres) => s.segments);

  const politique = ports?.politique ?? (await politiqueDesSources());
  const cochee = politique === "cochees" ? (ports?.cochees ?? (await videosCochees())).includes(video.id) : undefined;
  const { commandeEnEssai } = await import("@/moteurs");
  const { estFichierDemo } = await import("./travaux");
  const verdict = videoEligible(video, {
    politique,
    cochee,
    versionEnEssai: commandeEnEssai(version.commande),
    sortieDemo: estFichierDemo(fichierSortie?.cleStockage),
    aSousTitres: segments.some((s) => s.mots.length > 0),
  });
  if (!verdict.eligible) return { ecrite: false, raison: verdict.raison };
  if (!choisie || !sortie) return { ecrite: false, raison: "pas de source" };

  const plans = await d.plans.lister((p) => p.versionId === version.id);
  // Format v4 : le plan n'est pas lisible ici sans toucher un fichier interdit → fenêtres inconnues (plages « à vérifier »).
  const donnees = video.formatId === "avocat" || video.formatId === "facecam" ? plans : null;
  const fenetres = fenetresDuFormat(video.formatId, donnees);

  const existant = await elementDeLaVideo(video.id);
  const ancienneFiche = ficheDeElement(existant);
  const empreinte = createHash("sha256")
    .update(JSON.stringify({ v: version.id, s: sortie.id, f: sortie.fichierId, src: choisie.fichierId, seg: segments, fen: fenetres }))
    .digest("hex")
    .slice(0, 32);
  if (existant && ancienneFiche && empreinteDeNom(existant.nom) === empreinte) {
    return { ecrite: false, raison: "inchangée" };
  }

  const mots = motsDepuisSegments(segments);
  const brutes = decouperPlages(mots, { dureeSourceSec: sortie.dureeSec, appelAuMot: sortie.appelAuMot, interdits: fenetres.interdits });
  const qualifiees = qualifierPlages(brutes, fenetres, choisie.texteIncruste);
  const plages: PlageExtrait[] = plafonner(reporterGestes(ancienneFiche?.plages ?? [], qualifiees), PLAGES_MAX_PAR_FICHE);

  const toutes = await d.videos.lister();
  const idsLicences = new Set<string>();
  for (const p of plans) if (p.illustration?.elementId) idsLicences.add(p.illustration.elementId);
  const st = video.styles;
  for (const id of [st.lutId, st.sousTitresId, st.habillageId, st.styleMontageId, st.profilSonId, st.musiqueId, st.decorId, ...(st.accessoireIds ?? [])]) {
    if (id) idsLicences.add(id);
  }
  const elements = await d.elements.lister((e) => idsLicences.has(e.id));
  const licence: Licence = licencePlusRestrictive(elements.map((e) => e.licence));

  const fiche = entrerDansLaTaille({
    videoId: video.id,
    versionId: version.id,
    sortieId: sortie.id,
    ratio: choisie.ratio,
    licence,
    famille: familleDeVideo(video, toutes),
    plages,
    rangee: estRangee(video),
    sourcePreferee: true,
  });

  const maintenant = horloge(ports);
  const motsCles = [...new Set(fiche.plages.flatMap((p) => p.motsCles))];
  const element = {
    ...(existant ?? {}),
    id: idElementArchive(video.id),
    type: "source-extraits",
    nom: `Extraits de « ${video.titre} »${SEPARATEUR_NOM}${empreinte}`,
    motsCles,
    valeur: { type: "source-extraits", fiche },
    licence,
    formatsParDefaut: existant?.formatsParDefaut ?? [],
    marqueId: video.marqueId,
    creeLe: existant?.creeLe ?? maintenant,
    modifieLe: maintenant,
  } as ElementBibliotheque;
  if (fiche.rangee) element.archiveLe = existant?.archiveLe ?? maintenant;
  else delete element.archiveLe;
  await sousVerrou(() => d.elements.enregistrer(element));
  await journaliser("archive-extraits", `Extraits archivés : « ${video.titre} » (${fiche.plages.filter((p) => p.etat === "utilisable").length} utilisables)`, { type: "video", id: video.id });
  return { ecrite: true };
}

/** Range la fiche d'une vidéo archivée ou à la corbeille ; la remet si la vidéo est restaurée. Rien n'est supprimé. */
export async function rangerSiNecessaire(video: Pick<Video, "id" | "statut" | "corbeilleLe">, ports?: PortsArchive): Promise<boolean> {
  const d = depots();
  const element = await elementDeLaVideo(video.id);
  const fiche = ficheDeElement(element);
  if (!element || !fiche) return false;
  const rangee = estRangee(video);
  if (rangee === fiche.rangee && rangee === !!element.archiveLe) return false;
  const maintenant = horloge(ports);
  await sousVerrou(async () => {
    const suivant: ElementBibliotheque = {
      ...element,
      valeur: { type: "source-extraits", fiche: { ...fiche, rangee } },
      modifieLe: maintenant,
    };
    if (rangee) suivant.archiveLe = element.archiveLe ?? maintenant;
    else delete suivant.archiveLe;
    await d.elements.enregistrer(suivant);
  });
  await journaliser("archive-extraits", rangee ? "Extraits rangés (vidéo archivée)" : "Extraits remis (vidéo restaurée)", { type: "video", id: video.id });
  return true;
}

/**
 * Passe d'inscription. Réglage éteint : une seule lecture de paramètre, rien d'autre. Sinon, au plus 20 vidéos
 * (les plus récemment modifiées d'abord, seulement celles qui ont du travail), une passe toutes les 10 minutes.
 * Aucune exception ne remonte.
 */
export async function inscrireLesVideosPubliees(ports?: PortsArchive): Promise<{ traitees: number; ecrites: number }> {
  const rien = { traitees: 0, ecrites: 0 };
  try {
    if ((await lireParametre<unknown>(REGLAGE_INSCRIPTION, false)) !== true) return rien;
    const maintenant = horloge(ports);
    const dernier = await lireParametre<unknown>(DONNEE_DERNIER_PASSAGE, null);
    if (typeof dernier === "string") {
      const ecart = Date.parse(maintenant) - Date.parse(dernier);
      if (Number.isFinite(ecart) && ecart < INTERVALLE_PASSES_MS) return rien;
    }
    await ecrireParametre(DONNEE_DERNIER_PASSAGE, maintenant);

    const d = depots();
    const politique = ports?.politique ?? (await politiqueDesSources());
    const cochees = politique === "cochees" ? (ports?.cochees ?? (await videosCochees())) : [];
    const [videos, elements] = await Promise.all([d.videos.lister(), d.elements.lister((e) => e.type === "source-extraits")]);
    const parId = new Map(elements.map((e) => [e.id, e]));
    const aTraiter = videos
      .filter((v) => {
        const el = parId.get(idElementArchive(v.id));
        if (el) return estRangee(v) !== !!el.archiveLe || estRangee(v) !== !!ficheDeElement(el)?.rangee || v.modifieLe > el.modifieLe;
        if (v.estDemo || v.statut !== "prete" || v.corbeilleLe) return false;
        if (politique === "publiees") return v.etapeEditoriale === "publiee";
        if (politique === "cochees") return cochees.includes(v.id);
        return true;
      })
      .sort((a, b) => (a.modifieLe < b.modifieLe ? 1 : a.modifieLe > b.modifieLe ? -1 : 0))
      .slice(0, VIDEOS_MAX_PAR_PASSE);

    let ecrites = 0;
    for (const v of aTraiter) {
      try {
        if (await rangerSiNecessaire(v, ports)) ecrites++;
        if ((await inscrireVideo(v.id, { ...ports, politique, cochees })).ecrite) ecrites++;
      } catch (e) {
        await journaliser("archive-extraits", `Extraits : vidéo ignorée (${e instanceof Error ? e.name : "erreur"})`, { type: "video", id: v.id }).catch(() => undefined);
      }
    }
    return { traitees: aTraiter.length, ecrites };
  } catch (e) {
    await journaliser("archive-extraits", `Extraits : passe interrompue (${e instanceof Error ? e.name : "erreur"})`).catch(() => undefined);
    return rien;
  }
}

/** Fiche de la vidéo, ou null. */
export async function ficheDeLaVideo(videoId: string): Promise<FicheSourceExtraits | null> {
  return ficheDeElement(await elementDeLaVideo(videoId));
}

/** Fiches non rangées, avec leurs seules plages utilisables (lues par C1-U13). */
export async function fichesUtilisables(): Promise<FicheSourceExtraits[]> {
  const elements = await depots().elements.lister((e) => e.type === "source-extraits" && !e.archiveLe);
  return elements
    .map((e) => ficheDeElement(e))
    .filter((f): f is FicheSourceExtraits => !!f && !f.rangee)
    .map((f) => ({ ...f, plages: f.plages.filter((p) => p.etat === "utilisable") }));
}
