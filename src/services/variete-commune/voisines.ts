/**
 * Lecteur des voisines (E2, fiche X2-08) : les N dernières vidéos publiées (ou programmées) sur un même réseau, tous
 * générateurs confondus, rendues sous forme d'empreintes (X2-06, X2-07). LECTURE SEULE : aucun `creer`, `modifier`,
 * `supprimer` ni `ecrireParametre`. Ne lève jamais (comme `protege` de `bibliotheque-video-memoires.ts`) : une lecture
 * en échec donne `[]`, une vidéo illisible est ignorée seule. Aucun appelant en production (X2-10 viendra, allumé par
 * `varieteCommune`). Aucun argent lu, aucun réseau, aucune dépense.
 * Filtres RECOPIÉS (aucun import de `publications.ts`, de `image-video*.ts` ni de `travaux.ts`) :
 *   - publications : `src/domaine/variete.ts:55` ; lecture par `depots().publications.lister()` (cf. `boucle-generation.ts`) ;
 *   - travaux image→vidéo : `bibliotheque-video-memoires.ts` (`imageVideoVariete`) ;
 *   - mise du cas concret : `cas-concret-variete.ts` (`miseHeriteeDe`).
 * Vidéo non rattachable à son générateur (donnée absente ou illisible) : ignorée, sans bruit autre que `console.warn`.
 */
import "server-only";
import type { EmpreinteVideo } from "@/briques/variete-commune/types";
import { VERSION_EMPREINTE } from "@/briques/variete-commune/version";
import type { Choix } from "@/briques/bibliotheque-video/types";
import type { Travail, VersionVideo } from "@/domaine/types";
import { lireMise } from "@/moteurs/montage-cas-concret/variete";
import { lireEtatV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { historiqueDuPlan } from "@/moteurs/montage-facecam-animee/realisateur/regles";
import { lireHistoriqueStyles } from "@/moteurs/montage-tableau/tirage-style";
import type { EtatFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { depots, lireParametre } from "./../_commun";
import { empreinteCasConcret, empreinteImageVideo, empreinteTableau } from "./empreintes-a";
import { axesDesChoix, empreinteCartes, empreinteV4 } from "./empreintes-b";

export interface DemandeVoisines {
  reseau: string;
  videoIdEnCours?: string;
  /** Nombre de vidéos comparées (défaut 10, décision E2-1). */
  fenetre?: number;
  /** Compter aussi les vidéos prêtes, pas encore publiées sur ce réseau (décision E2-2). Faux par défaut. */
  pretesNonPubliees?: boolean;
}

// Constantes recopiées (leurs fichiers d'origine sont lourds ou à plusieurs mains).
const CLE_STYLES_TABLEAU = "tableau.historiqueStyles";
const MOTEUR_FACECAM_ANIMEE = "montage-facecam-animee";

interface Candidate { videoId: string; le: string }
type Objet = Record<string, unknown>;
const objet = (v: unknown): Objet | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Objet) : undefined);
const recent = (a: Candidate, b: Candidate) => (a.le < b.le ? 1 : a.le > b.le ? -1 : a.videoId < b.videoId ? -1 : 1);

async function protege<T>(nom: string, vide: T, lire: () => Promise<T>): Promise<T> {
  try {
    return await lire();
  } catch (e) {
    console.warn(`[studio] voisines « ${nom} » illisible :`, e instanceof Error ? e.message : e);
    return vide;
  }
}

/** Vidéos candidates : une ligne par vidéo (la plus récente), hors vidéo en cours, de la plus récente à la plus ancienne. */
async function candidates(d: Required<Pick<DemandeVoisines, "reseau" | "fenetre" | "pretesNonPubliees">> & Pick<DemandeVoisines, "videoIdEnCours">): Promise<Candidate[]> {
  const publications = await depots().publications.lister((p) => p.via !== "simulation" && p.reseau === d.reseau && (p.statut === "programmee" || p.statut === "publiee"));
  const parVideo = new Map<string, Candidate>();
  for (const p of publications) {
    if (!p.videoId || p.videoId === d.videoIdEnCours) continue;
    const l = parVideo.get(p.videoId);
    if (!l || p.date > l.le) parVideo.set(p.videoId, { videoId: p.videoId, le: p.date });
  }
  if (d.pretesNonPubliees) {
    const videos = await protege("vidéos prêtes", [], () => depots().videos.lister((v) => v.reseau === d.reseau && v.id !== d.videoIdEnCours && !parVideo.has(v.id)));
    if (videos.length) {
      const prets = await protege("versions prêtes", [] as VersionVideo[], () => depots().versions.lister((v) => v.statut === "prete" && videos.some((x) => x.id === v.videoId)));
      for (const v of prets) {
        const l = parVideo.get(v.videoId);
        if (!l || v.creeLe > l.le) parVideo.set(v.videoId, { videoId: v.videoId, le: v.creeLe });
      }
    }
  }
  return [...parVideo.values()].sort(recent).slice(0, Math.max(0, d.fenetre));
}

/** Version prête la plus récente de chaque vidéo demandée. */
async function dernieresVersions(ids: ReadonlySet<string>): Promise<Map<string, VersionVideo>> {
  const versions = await depots().versions.lister((v) => v.statut === "prete" && ids.has(v.videoId));
  const r = new Map<string, VersionVideo>();
  for (const v of versions) {
    const l = r.get(v.videoId);
    if (!l || v.creeLe > l.creeLe) r.set(v.videoId, v);
  }
  return r;
}

const plusRecent = (a: Travail, b: Travail) => (b.termineLe ?? b.creeLe ?? "").localeCompare(a.termineLe ?? a.creeLe ?? "");

/** Choix figés (commande et projet de montage) : lecture tolérante, copie des clés lues par `choixFigesDesVersions`. */
function choixFiges(v: VersionVideo): Choix[] {
  const lus: unknown[] = [];
  for (const c of [objet(objet(objet(v.commande)?.entrees)?.bibliothequeVideo), objet(objet(v.projetMontage)?.bibliothequeVideo)]) if (Array.isArray(c?.choix)) lus.push(...c.choix);
  return lus.filter((c): c is Choix => typeof objet(c)?.capacite === "string" && typeof objet(c)?.cle === "string");
}

export async function voisinesDuReseau(demande: DemandeVoisines): Promise<EmpreinteVideo[]> {
  try {
    const d = { reseau: demande.reseau, videoIdEnCours: demande.videoIdEnCours, fenetre: demande.fenetre ?? 10, pretesNonPubliees: demande.pretesNonPubliees ?? false };
    const choisies = await protege("publications", [] as Candidate[], () => candidates(d));
    if (!choisies.length) return [];
    const ids = new Set(choisies.map((c) => c.videoId));
    const versions = await protege("versions", new Map<string, VersionVideo>(), () => dernieresVersions(ids));
    // Lectures communes, chacune protégée : en échec, les vidéos de cette famille sont ignorées.
    const travaux = await protege("travaux", [] as Travail[], async () => (await depots().travaux.lister((t) => ids.has(t.cibleId) || ids.has(String(objet(objet(t.parametres)?.imageVideo)?.demande && objet(objet(objet(t.parametres)?.imageVideo)?.demande)?.videoId)))) as Travail[]);
    const styles = await protege("styles tableau", [] as ReturnType<typeof lireHistoriqueStyles>, async () => lireHistoriqueStyles(await lireParametre<unknown>(CLE_STYLES_TABLEAU, [])));

    const resultat: EmpreinteVideo[] = [];
    for (const { videoId, le } of choisies) {
      try {
        const e = empreinteDe(videoId, le, versions.get(videoId), travaux, styles);
        if (e) resultat.push(e);
      } catch (err) {
        console.warn(`[studio] voisine « ${videoId} » ignorée :`, err instanceof Error ? err.message : err);
      }
    }
    return resultat;
  } catch (e) {
    console.warn("[studio] voisines illisibles :", e instanceof Error ? e.message : e);
    return [];
  }
}

/** Empreinte du générateur de CETTE vidéo ; `null` si la donnée manque (vidéo ignorée). */
function empreinteDe(videoId: string, le: string, version: VersionVideo | undefined, travaux: readonly Travail[], styles: ReturnType<typeof lireHistoriqueStyles>): EmpreinteVideo | null {
  if (!version) return null;
  const moteur = version.commande?.moteurId ?? version.commande?.formatId ?? "";
  const formatId = version.commande?.formatId ?? moteur;
  const projet = objet(version.projetMontage);

  if (moteur.includes("cas-concret")) {
    const mise = lireMise(objet(objet(projet?.casConcret)?.fiche)?.mise);
    return mise ? empreinteCasConcret(videoId, le, mise) : null;
  }
  if (moteur.includes("image-video")) {
    const etats = travaux.filter((t) => objet(objet(t.parametres)?.imageVideo)?.variete).sort(plusRecent).map((t) => (t.parametres as { imageVideo: EtatFabricationIV }).imageVideo);
    const etat = etats.find((e) => e.etape !== "refusee" && e.variete && String(e.demande?.videoId) === videoId);
    return etat?.variete ? empreinteImageVideo(videoId, le, etat.variete.effective ?? etat.variete.recette) : null;
  }
  if (moteur.includes("tableau")) {
    const style = [...styles].reverse().find((s) => s.videoId === videoId)?.style;
    return style ? empreinteTableau(videoId, le, style) : null;
  }
  if (moteur === MOTEUR_FACECAM_ANIMEE) {
    const t = travaux.filter((x) => x.fournisseurUtilise === MOTEUR_FACECAM_ANIMEE && x.cibleId === videoId).sort(plusRecent).find((x) => lireEtatV4(x.parametres?.facecamAnimeeV4)?.realisation?.plan);
    const plan = t ? lireEtatV4(t.parametres?.facecamAnimeeV4)?.realisation?.plan : undefined;
    return plan ? empreinteV4(videoId, le, historiqueDuPlan(plan)) : null;
  }
  // Avocat et face caméra : cartes de la brique `motion` (premier ratio, hors échecs, comme `cartesAvocat`).
  const brutes = objet(projet?.motionCommune)?.cartes;
  const cartes = (Array.isArray(brutes) ? brutes : []).filter((c): c is { modele: string; debutSec: number } => objet(c)?.statut !== "echec" && typeof objet(c)?.modele === "string" && typeof objet(c)?.debutSec === "number");
  if (cartes.length) return empreinteCartes(videoId, le, formatId, cartes);
  // Autres générateurs : choix figés de la bibliothèque, s'il y en a.
  const axes = axesDesChoix(choixFiges(version));
  return Object.keys(axes).length ? { version: VERSION_EMPREINTE, videoId, formatId, le, axes } : null;
}
