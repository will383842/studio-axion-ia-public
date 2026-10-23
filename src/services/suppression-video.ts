/**
 * SUPPRESSION DÉFINITIVE d'une vidéo (décision écrite de Will du 17/10 : « Vraie suppression, dépenses gardées »).
 *
 * Seule exception à « on ne purge rien » : rien n'est jamais effacé automatiquement ; seule la suppression MANUELLE
 * d'une vidéo par Will, confirmée, efface. Le plan est calculé d'abord, puis appliqué en UN lot (une transaction avec
 * Postgres) ; les objets du stockage (R2) partent EN DERNIER, une erreur y est journalisée sans bloquer.
 *
 * Effacé : la vidéo et ce qui n'existe que pour elle (versions, plans, pistes, retouches, miniatures, sous-titres,
 * sorties, kit, publications NON publiées (brouillon, échec), liens privés, travaux, traces du tableau, notifications qui y
 * mènent, réglages propres, les
 * scripts marqués comme créés pour elle (`creePourVideoId`), ses fichiers exclusifs). Détaché : idée, prises de tournage, version par réseau (le texte reste).
 * GARDÉ : dépenses et réservations (comptabilité), le journal de la vidéo (décision D2), les publications DÉJÀ PUBLIÉES avec
 * leurs mesures (décision D3), et tout fichier ou script référencé ailleurs.
 */
import "server-only";
import type { Depot, Depots, LotEcritures } from "@/domaine/depots";
import type { Fichier, Id, Parametre, Video } from "@/domaine/types";
import { additionner, formaterMontant } from "@/lib/montants";
import { appliquerLot, bailTenu, oublierBailExpire } from "@/donnees/memoire";
import { depots, fournisseur, horodatage, maintenant } from "./_commun";
import { nouvelId } from "@/lib/ids";
import { CLE_CODES_SUPPRIMES } from "./partages";
import { tacheDe, tachesEnCours } from "./tableau-taches";
import { cleFicheScenes } from "@/briques/fiche-scenes/cle";
import { DELAI_ABSENCE_MS } from "@/domaine/buffer";
import { cleDeCetteVideo, cleProtegee, dossierPropreValide, prefixesDeVideo } from "@/domaine/dossiers-video";


export type Traitement = "efface" | "detache" | "efface-si-exclusif" | "garde-comptabilite" | "garde-journal" | "garde-publiees" | "sans-lien";

/**
 * Une décision écrite pour CHAQUE collection (le typage force à en prendre une quand une collection est ajoutée) :
 * - efface : ce qui n'existe que pour la vidéo ; detache : l'objet reste, sa référence à la vidéo est retirée ;
 * - efface-si-exclusif : seulement si rien d'autre ne l'utilise ; garde-comptabilite : jamais touché ;
 * - garde-journal : tout le journal de la vidéo reste, plus la trace « Vidéo supprimée » (D2) ; garde-publiees : les publications
 *   déjà publiées et leurs mesures restent (D3), les autres (brouillon, échec) partent ; sans-lien : aucun lien avec une vidéo
 *   (ou lien gardé exprès, voir GARDES_APRES_SUPPRESSION : `modeles` garde `creeDepuisVideoId`, le modèle vit sans la vidéo).
 * `parametres` est « efface » : les réglages propres à la vidéo partent, ceux qui la citent sont réécrits (voir plus bas).
 */
export const TRAITEMENT_SUPPRESSION: Record<keyof Depots, Traitement> = {
  marques: "sans-lien",
  fichiers: "efface-si-exclusif",
  personnages: "sans-lien",
  visages: "sans-lien",
  voix: "sans-lien",
  prononciations: "sans-lien",
  elements: "detache",
  scripts: "efface-si-exclusif",
  videos: "efface",
  versions: "efface",
  plans: "efface",
  pistes: "efface",
  retouches: "efface",
  miniatures: "efface",
  sousTitres: "efface",
  sorties: "efface",
  kits: "efface",
  publications: "garde-publiees",
  partages: "efface",
  modeles: "sans-lien",
  idees: "detache",
  ideesJugees: "sans-lien",
  series: "sans-lien",
  rushs: "sans-lien",
  travaux: "efface",
  depenses: "garde-comptabilite",
  ressourcesFournisseurs: "sans-lien",
  evenementsFournisseurs: "sans-lien",
  notifications: "efface",
  sessions: "sans-lien",
  tentatives: "sans-lien",
  parametres: "efface",
  evenements: "garde-journal",
  veilleOutils: "sans-lien",
  veilleNouveautes: "sans-lien",
  pagesSite: "sans-lien",
  recharges: "sans-lien",
  reservations: "garde-comptabilite",
  relevesSoldes: "sans-lien",
  scriptsMaitres: "sans-lien",
  variantes: "detache",
  preuves: "sans-lien",
  matieres: "sans-lien",
  exemplesStyle: "sans-lien",
  fichesStyle: "sans-lien",
  tournesInterdites: "sans-lien",
  generations: "sans-lien",
  bilansApprentissage: "sans-lien",
  contexteAxion: "sans-lien",
  reglesDatees: "sans-lien",
  sessionsTournage: "detache",
  tracesTableau: "efface",
  tracesScriptsTableau: "efface",
  correctionsWill: "sans-lien",
  visuels: "sans-lien",
};

/** Phrase de l'entrée d'un lot d'images dont la vidéo a été supprimée (la même que `PHRASES_LOT_IV.supprimee`). */
const PHRASE_LOT_SUPPRIMEE = "Supprimée.";

type Entite = { id: Id } & Record<string, unknown>;

/**
 * Ce qui cite encore l'identifiant d'une vidéo supprimée, EXPRÈS : comptabilité (dépenses, réservations, engagements du
 * budget, transferts de crédit d'un lot), la trace « Vidéo supprimée », le modèle fait depuis la vidéo, et l'entrée
 * « Supprimée. » d'un lot d'images (l'ordre des images du lot reste lisible).
 */
export const GARDES_APRES_SUPPRESSION: readonly { quoi: string; collection: keyof Depots; correspond: (e: Entite) => boolean }[] = [
  { quoi: "dépenses", collection: "depenses", correspond: () => true },
  { quoi: "réservations de crédit", collection: "reservations", correspond: () => true },
  { quoi: "engagements du budget", collection: "parametres", correspond: (e) => e.id.startsWith("budget.engage.") },
  { quoi: "transferts de crédit d'un lot", collection: "parametres", correspond: (e) => /^credits\.lot\..+\.transfere\./.test(e.id) },
  { quoi: "journal de la vidéo et trace « Vidéo supprimée »", collection: "evenements", correspond: () => true },
  { quoi: "publications déjà publiées et leurs mesures", collection: "publications", correspond: (e) => e.statut === "publiee" },
  { quoi: "modèle fait depuis la vidéo", collection: "modeles", correspond: (e) => typeof e.creeDepuisVideoId === "string" },
  {
    quoi: "entrée « Supprimée. » d'un lot d'images",
    collection: "parametres",
    correspond: (e) => e.id.startsWith("imageVideo.lot.") && ((e.valeur as { videos?: { miseDeCote?: { motif?: string } }[] } | null)?.videos ?? []).some((v) => v.miseDeCote?.motif === PHRASE_LOT_SUPPRIMEE),
  },
];

/** Collections jamais touchées par la suppression (comptabilité). */
const GARDEES = new Set<keyof Depots>((Object.keys(TRAITEMENT_SUPPRESSION) as (keyof Depots)[]).filter((c) => TRAITEMENT_SUPPRESSION[c] === "garde-comptabilite"));

/** Réglages propres à UNE vidéo : la clé se termine par son id (`imageVideo.decisions.<id>`, `facecam.fil.<id>`…). */
const PREFIXES_PROPRES = [
  "imageVideo.decisions.",
  "facecam.fil.",
  "facecam.effetsRealistes.",
  "modifications.",
  "illustrations.rang.",
  "illustrations.economique.",
  "credits.lancementPret.",
  "corbeille.refusNotifie.",
];

/** Durée maximale d'un refus pour un envoi Buffer incertain : délai d'absence (30 min) et deux relectures de Buffer. */
const ATTENTE_ENVOI_INCERTAIN_MS = 2 * DELAI_ABSENCE_MS;

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Raisons de refuser (fabrication en cours, tâche de fond sans travail, publication programmée ou en route) ; vide : la
 * vidéo peut partir. Tâches de fond : appel en cours de l'écriture ou du découpage du tableau animé, finitions
 * (miniatures, kit) en train de se faire, lanceur image → vidéo vivant (son bail est tenu, même quand il attend une
 * validation sans travail en cours), appel du moteur encore en vol après « Arrêter » (travail annulé,
 * `avancementsEnVol` de ce processus). `ignorerFabrication` : « Annuler » vérifie les AUTRES refus avant d'arrêter la fabrication. Chaque refus se lève seul en temps borné, ou par « Arrêter » / « Annuler ».
 */
export async function refusSuppression(video: Video, contexte: { aussiSupprimees?: ReadonlySet<Id>; ignorerSite?: boolean; ignorerFabrication?: boolean } = {}): Promise<{ code: "EN_FABRICATION" | "PUBLICATION_PROGRAMMEE" | "SUR_LE_SITE" | "VERSIONS_EN_ATTENTE"; message: string } | null> {
  const d = depots();
  // Versions du « Fabriquer les N » qui attendent CETTE vidéo (leur mère) : sans elle, elles ne partiraient jamais. Refusé
  // tant que la version n'est pas supprimée avec elle (ou fabriquée d'abord).
  const enAttente = await d.videos.lister((x) => x.id !== video.id && x.statut === "brouillon" && !contexte.aussiSupprimees?.has(x.id) && declinaisonAttend(x, video.id));
  if (enAttente.length) {
    const quoi = enAttente.length > 1 ? `${enAttente.length} versions attendent` : "une version attend";
    return { code: "VERSIONS_EN_ATTENTE", message: `« ${video.titre} » : ${quoi} cette vidéo pour partir. Supprimez-les avec elle, ou fabriquez-les d'abord.` };
  }
  const versions = new Set((await d.versions.lister((x) => x.videoId === video.id)).map((x) => x.id));
  const deLaVideo = (t: { cibleId?: Id; versionId?: Id }) => t.cibleId === video.id || (!!t.versionId && versions.has(t.versionId));
  const enCours = await d.travaux.compter((t) => deLaVideo(t) && (t.statut === "en_file" || t.statut === "en_cours"));
  if (!contexte.ignorerFabrication && (enCours || video.statut === "en_file" || video.statut === "en_fabrication")) return { code: "EN_FABRICATION", message: `« ${video.titre} » est en fabrication : arrêtez-la d'abord.` };
  // Finitions : seul le passage EN COURS refuse. La note enregistrée (`finitionAFaire`) part avec la vidéo : une
  // finition ratée à chaque fois ne bloque jamais la suppression, et `executerSuites` ignore une vidéo supprimée.
  const { finitionsEnCours } = await import("./travaux");
  const finitions = finitionsEnCours().has(video.id);
  const { avancementsEnVol } = await import("./boucle");
  const enVol = [...avancementsEnVol().keys()];
  const appelEnVol = enVol.length > 0 && (await d.travaux.compter((t) => deLaVideo(t) && enVol.includes(t.id))) > 0;
  // Tableau animé : seul un appel VRAIMENT en cours refuse (traité par la boucle, ou « en cours » sur un brouillon, que
  // la boucle reprend ou marque interrompu). Une tâche en attente, ou celle d'un brouillon abandonné que la boucle ne
  // traite pas, part avec la vidéo (elle vit dans `video.entrees`).
  const tache = tacheDe(video);
  const tacheEnCours = !!tache && (tachesEnCours().has(tache.id) || (video.statut === "brouillon" && tache.statut === "en-cours"));
  if (!contexte.ignorerFabrication && (tacheEnCours || finitions || appelEnVol || (await bailTenu(`lanceur-image-video:${video.id}`)))) return { code: "EN_FABRICATION", message: `« ${video.titre} » est en cours de préparation : attendez la fin.` };
  const instant = maintenant();
  const programmees = await d.publications.compter((p) => p.videoId === video.id && p.statut === "programmee" && p.date >= instant);
  // Envoi vers Buffer en cours ou à vérifier : refusé le temps que le studio relise Buffer (une heure au plus). Au-delà,
  // il ne peut plus trancher (compte retiré de Buffer, Buffer déconnecté) : la vidéo n'est plus bloquée pour toujours.
  const depuisMs = (p: { envoiCommenceLe?: string; modifieLe: string }) => Date.parse(instant) - Date.parse(p.envoiCommenceLe ?? p.modifieLe);
  const envoisIncertains = await d.publications.compter(
    (p) => p.videoId === video.id && (p.etatEnvoi === "en-cours" || p.etatEnvoi === "a-verifier") && depuisMs(p) < ATTENTE_ENVOI_INCERTAIN_MS,
  );
  if (envoisIncertains && !programmees) return { code: "PUBLICATION_PROGRAMMEE", message: `« ${video.titre} » a un envoi vers Buffer à vérifier : réessayez dans une heure au plus.` };
  if (programmees) {
    const quoi = programmees > 1 ? `${programmees} publications programmées : annulez-les` : "une publication programmée : annulez-la";
    return { code: "PUBLICATION_PROGRAMMEE", message: `« ${video.titre} » a ${quoi} d'abord.` };
  }
  // Vidéos sur le site (lot S4) : la page est retirée AVANT le verrou (appel réseau) ; une publication lancée depuis, ou un
  // retrait pas terminé, refuse ici, sous le verrou, plutôt que de laisser une page orpheline sur le site.
  const surLeSite = (await d.kits.trouver((k) => k.videoId === video.id))?.site?.etat;
  if (!contexte.ignorerSite && (surLeSite === "en-ligne" || surLeSite === "envoi-en-cours" || surLeSite === "retrait-en-cours")) return { code: "SUR_LE_SITE", message: `« ${video.titre} » vient d'être publiée sur le site : réessayez.` };
  return null;
}

type Doc = { id: Id } & Record<string, unknown>;

type EntreeLot = { videoId?: string; refaiteEn?: string; fichierId?: string; statut?: string; miseDeCote?: unknown };

const lotCite = (valeur: Record<string, unknown> | null, id: Id) =>
  Array.isArray(valeur?.videos) && (valeur.videos as EntreeLot[]).some((e) => e?.videoId === id || e?.refaiteEn === id);

/**
 * Lot d'images (`imageVideo.lot.<lot>`) sans la vidéo : son entrée reste (le rang et le nom des autres images ne
 * bougent pas), mise de côté « Supprimée. », sans fichier ni lien ; une entrée « refaite » par cette vidéo perd ce lien.
 */
function lotSansVideo(valeur: Record<string, unknown>, id: Id): Record<string, unknown> {
  const videos = (valeur.videos as EntreeLot[]).map((e) => {
    if (e?.videoId === id) {
      // Ancienne vidéo d'une entrée « refaite » : la nouvelle vit encore, son lien est gardé.
      const miseDeCote = { porte: "arret", motif: PHRASE_LOT_SUPPRIMEE, phrases: [] };
      return e.statut === "refaite" && e.refaiteEn ? { ...e, fichierId: "", miseDeCote } : { ...e, refaiteEn: undefined, fichierId: "", statut: "mise-de-cote", miseDeCote };
    }
    if (e?.refaiteEn === id) {
      // La nouvelle vidéo est supprimée : l'entrée redevient « mise de côté » pour qu'on puisse la refaire.
      return { ...e, refaiteEn: undefined, statut: "mise-de-cote", miseDeCote: { porte: "arret", motif: "La nouvelle vidéo a été supprimée.", phrases: [] } };
    }
    return e;
  });
  return { ...valeur, videos };
}

/** `Video.entrees.declinaison` (fabrication-reseaux) lue sans l'importer : la version attend-elle sa mère `mereId` ? */
function declinaisonAttend(v: Pick<Video, "entrees">, mereId: Id): boolean {
  const x = v.entrees?.declinaison as { mereVideoId?: Id; attendMere?: boolean } | undefined;
  return !!x && typeof x === "object" && x.mereVideoId === mereId && x.attendMere === true;
}

/** Plan de suppression : ce qui part, ce qui est réécrit (références retirées), et les fichiers à effacer du stockage. */
export interface PlanSuppression {
  lot: LotEcritures;
  fichiers: Fichier[];
  /** Objets du stockage SANS document `fichiers` : les fiches de scènes du tableau animé (elles contiennent le texte dit). */
  objets: string[];
  /** Dossiers du stockage propres à la vidéo (`studio/<env>/<type>/<id>/`), listés puis effacés après le lot. */
  dossiers: string[];
  totalDepense: string;
}

export async function planifierSuppression(video: Video): Promise<PlanSuppression> {
  const d = depots();
  const id = video.id;
  const lot: LotEcritures = { supprimer: [], enregistrer: [] };
  const efface = new Set<string>();
  const reecrit = new Map<string, Doc>();
  const effacer = (collection: keyof Depots, ids: Id[]) => {
    for (const x of ids) {
      if (efface.has(`${collection}/${x}`)) continue;
      efface.add(`${collection}/${x}`);
      lot.supprimer.push({ collection, id: x });
    }
  };
  const reecrire = (collection: keyof Depots, entite: Doc) => {
    reecrit.set(`${collection}/${entite.id}`, entite);
    lot.enregistrer.push({ collection, entite });
  };
  const ids = <T extends { id: Id }>(l: T[]) => l.map((x) => x.id);

  // 1. La vidéo et ce qui n'existe que pour elle.
  effacer("videos", [id]);
  const versions = await d.versions.lister((x) => x.videoId === id);
  const versionIds = new Set(versions.map((x) => x.id));
  const deVideo = <T extends { videoId?: Id; versionId?: Id }>(x: T) => x.videoId === id || (!!x.versionId && versionIds.has(x.versionId));
  effacer("versions", ids(versions));
  const plans = await d.plans.lister(deVideo);
  // Les pistes n'ont pas de videoId : par version, y compris celles du brouillon (`<id>-brouillon…`).
  const pistes = await d.pistes.lister((x) => versionIds.has(x.versionId) || x.versionId.startsWith(`${id}-`));
  const retouches = await d.retouches.lister(deVideo);
  const miniatures = await d.miniatures.lister((x) => x.videoId === id);
  const sousTitres = await d.sousTitres.lister(deVideo);
  const sorties = await d.sorties.lister(deVideo);
  const kits = await d.kits.lister((x) => x.videoId === id);
  // Décision D3 : une publication déjà publiée (et ses mesures) reste ; les brouillons et échecs partent (les programmées sont refusées avant).
  const publications = await d.publications.lister((x) => x.videoId === id && x.statut !== "publiee");
  const partages = await d.partages.lister((x) => x.videoId === id);
  const travaux = await d.travaux.lister((t) => t.cibleId === id || t.id === `iv-lanceur-${id}` || (!!t.versionId && versionIds.has(t.versionId)));
  const traces = await d.tracesTableau.lister((x) => x.videoId === id);
  const tracesScripts = await d.tracesScriptsTableau.lister((x) => x.videoId === id);
  // Notifications qui mènent à la vidéo (lien mort, titre de la vidéo dans le message).
  // Le lien entier : `/videos/<id>`, `/image-video/<id>`, `/cas-concret/document/<id>`… (jamais `<id>0`, un autre identifiant).
  const lienVideo = new RegExp(`/${echapper(id)}([/?#]|$)`);
  const notifications = await d.notifications.lister((x) => !!x.lien && lienVideo.test(x.lien));
  effacer("plans", ids(plans));
  effacer("pistes", ids(pistes));
  effacer("retouches", ids(retouches));
  effacer("miniatures", ids(miniatures));
  effacer("sousTitres", ids(sousTitres));
  effacer("sorties", ids(sorties));
  effacer("kits", ids(kits));
  effacer("publications", ids(publications));
  effacer("partages", ids(partages));
  effacer("travaux", ids(travaux));
  effacer("tracesTableau", ids(traces));
  effacer("tracesScriptsTableau", ids(tracesScripts));
  effacer("notifications", ids(notifications));

  // 2. Réglages propres à la vidéo, et ceux qui la désignent dans leur valeur.
  const travailIds = new Set(travaux.map((t) => t.id));
  const finDeCle = new RegExp(`\\.${echapper(id)}$`);
  const appel = new RegExp(`(^|[.-])${echapper(id)}-`);
  // Note de finition d'un travail disparu : partie avec la vidéo si toutes ses suites la concernent.
  const seulementCetteVideo = (suites: unknown) => Array.isArray(suites) && suites.length > 0 && suites.every((x) => (x as { videoId?: Id } | null)?.videoId === id);
  for (const p of await d.parametres.lister()) {
    const v = p.valeur as Record<string, unknown> | null;
    const propre =
      (PREFIXES_PROPRES.some((x) => p.id.startsWith(x)) && finDeCle.test(p.id)) ||
      (p.id.startsWith("casConcret.appel.") && appel.test(p.id.slice("casConcret.appel.".length))) ||
      (p.id.startsWith("fabrication.finitionAFaire.") && (travailIds.has(p.id.slice("fabrication.finitionAFaire.".length)) || seulementCetteVideo(v?.suites))) ||
      ((p.id.startsWith("generateur.fabrication.") || p.id.startsWith("generateur.secondeOuverture.")) && v?.videoId === id) ||
      (p.id.startsWith("generateur.brouillon-de-version.") && p.valeur === id) ||
      // Demande de retouche en cours (cas concret) : `casConcret.discussion.<vidéo>` (préfixe en texte, sans importer le service).
      p.id === `casConcret.discussion.${id}` ||
      // « Fabriquer les N » dont la vidéo est la mère : l'opération n'a plus de sens.
      (p.id.startsWith("generateur.fabricationN.") && v?.mereVideoId === id);
    if (propre) effacer("parametres", [p.id]);
    else if (p.id.startsWith("generateur.fabricationN.") && Array.isArray(v?.videoIds) && (v.videoIds as unknown[]).includes(id)) {
      reecrire("parametres", { ...p, valeur: { ...v, videoIds: (v.videoIds as Id[]).filter((x) => x !== id) }, modifieLe: maintenant() } as unknown as Doc);
    } else if (p.id.startsWith("imageVideo.lot.") && lotCite(v, id)) {
      reecrire("parametres", { ...p, valeur: lotSansVideo(v!, id), modifieLe: maintenant() } as unknown as Doc);
    }
    else if (p.id === "optionsPayantes.demandes" && Array.isArray(p.valeur) && p.valeur.some((x) => x?.videoId === id)) {
      reecrire("parametres", { ...p, valeur: p.valeur.filter((x) => x?.videoId !== id), modifieLe: maintenant() } satisfies Parametre as unknown as Doc);
    } else if (p.id === "facecam.look" && (v?.aMesurer as { videoId?: Id } | undefined)?.videoId === id) {
      reecrire("parametres", { ...p, valeur: { ...v, aMesurer: undefined }, modifieLe: maintenant() } as unknown as Doc);
    }
  }
  if (partages.length) {
    const avant = (await d.parametres.obtenir(CLE_CODES_SUPPRIMES))?.valeur;
    const codes = [...new Set([...(Array.isArray(avant) ? (avant as string[]) : []), ...partages.map((p) => p.code)])];
    reecrire("parametres", { id: CLE_CODES_SUPPRIMES, valeur: codes, ...horodatage() } as unknown as Doc);
  }

  // 3. Références retirées, l'objet reste : idée, prises de tournage, version par réseau (son texte est gardé).
  for (const i of await d.idees.lister((x) => x.videoId === id)) {
    reecrire("idees", { ...i, videoId: undefined, modifieLe: maintenant() } as unknown as Doc);
  }
  for (const s of await d.sessionsTournage.lister((x) => x.prises.some((p) => p.videoId === id))) {
    reecrire("sessionsTournage", { ...s, prises: s.prises.map(({ videoId, ...p }) => (videoId === id ? p : { ...p, videoId })), modifieLe: maintenant() } as unknown as Doc);
  }
  for (const v of await d.variantes.lister((x) => x.videoId === id || x.controlesReels?.videoId === id)) {
    const { videoId, controlesReels, ...reste } = v;
    reecrire("variantes", { ...reste, ...(videoId && videoId !== id ? { videoId } : {}), ...(controlesReels && controlesReels.videoId !== id ? { controlesReels } : {}), modifieLe: maintenant() } as unknown as Doc);
  }

  // Bibliothèque : l'élément reste, il oublie seulement la dernière vidéo qui l'a utilisé.
  for (const e of await d.elements.lister((x) => x.derniereVideoId === id)) {
    reecrire("elements", { ...e, derniereVideoId: undefined, modifieLe: maintenant() } as unknown as Doc);
  }
  // Vidéos filles (version par réseau, 2e ouverture) : elles gardent leur vie sans leur mère, `sourceVideoId` et le lien
  // de leur déclinaison sont retirés. (Une fille qui ATTEND sa mère est refusée avant, sauf si elle est supprimée avec elle.)
  const filles = await d.videos.lister((x) => x.id !== id && (x.sourceVideoId === id || (x.entrees?.declinaison as { mereVideoId?: Id } | undefined)?.mereVideoId === id));
  const fillesIds = new Set(filles.map((x) => x.id));
  for (const f of filles) {
    const { sourceVideoId: _s, ...reste } = f;
    void _s;
    const decl = f.entrees?.declinaison as Record<string, unknown> | undefined;
    const entrees = decl && decl.mereVideoId === id ? { ...f.entrees, declinaison: { ...decl, mereVideoId: undefined, attendMere: false } } : f.entrees;
    reecrire("videos", { ...reste, entrees, modifieLe: maintenant() } as unknown as Doc);
  }
  for (const ver of await d.versions.lister((x) => fillesIds.has(x.videoId) && (x.commande as { videoMereId?: Id } | undefined)?.videoMereId === id)) {
    const { videoMereId: _m, ...commande } = ver.commande as unknown as Record<string, unknown>;
    void _m;
    reecrire("versions", { ...ver, commande, modifieLe: maintenant() } as unknown as Doc);
  }

  // Scripts candidats : celui de la vidéo et ceux créés pour elle (une vidéo rattachée pointe vers le corps commun, sa
  // copie assemblée n'est désignée que par sa marque). Tout ce qui RESTE en base (après le lot) sert à vérifier qu'un
  // script ou un fichier n'est utilisé nulle part ailleurs ; les candidats ne comptent pas comme leur propre référence.
  const propre = await d.scripts.lister((x) => x.creePourVideoId === id);
  const scriptVideo = video.scriptId ? await d.scripts.obtenir(video.scriptId) : null;
  const candidats = [...propre, ...(scriptVideo && !propre.some((x) => x.id === scriptVideo.id) ? [scriptVideo] : [])];
  const candidatIds = new Set(candidats.map((x) => `scripts/${x.id}`));
  const restants: string[] = [];
  for (const c of Object.keys(d) as (keyof Depots)[]) {
    if (c === "fichiers") continue;
    for (const e of await (d[c] as unknown as Depot<Doc>).lister()) {
      const cle = `${c}/${e.id}`;
      if (efface.has(cle) || candidatIds.has(cle)) continue;
      restants.push(JSON.stringify(reecrit.get(cle) ?? e));
    }
  }
  const tout = restants.join("\n");
  const utiliseAilleurs = (x: string) => tout.includes(x);

  // 4. Un script n'est effacé que si sa PROVENANCE prouve qu'il est propre à cette vidéo (marque `creePourVideoId` posée
  // à sa création), qu'il n'est ni favori ni de référence, et utilisé nulle part ailleurs. Sans marque (« Mes scripts »,
  // ancien script, corps commun) : gardé. Un script gardé qui cite un candidat le garde aussi.
  const effacables = candidats.filter((x) => x.creePourVideoId === id && !x.reference && !x.favori && !utiliseAilleurs(x.id));
  const gardes = candidats.filter((x) => !effacables.includes(x));
  const texteGarde = JSON.stringify(gardes);
  effacer("scripts", effacables.filter((x) => !texteGarde.includes(x.id)).map((x) => x.id));
  const scriptGarde = JSON.stringify(candidats.filter((x) => !efface.has(`scripts/${x.id}`)));

  // 5. Fichiers : seulement ceux de CETTE vidéo (désignés par ses documents effacés, ou rangés sous son dossier), jamais
  // un fichier de démonstration, de la bibliothèque, d'un personnage, d'une voix ou d'un décor (tous référencés ailleurs).
  const designes = new Set<string>();
  const lus = [video, ...plans, ...pistes, ...miniatures, ...sorties, ...travaux, ...kits];
  const texteEfface = JSON.stringify(lus);
  const dossier = new RegExp(`/${echapper(id)}/`);
  const fichiers: Fichier[] = [];
  for (const f of await d.fichiers.lister()) {
    if (f.origine === "demo" || !f.cleStockage || f.cleStockage.startsWith("/")) continue;
    if (!texteEfface.includes(f.id) && !dossier.test(f.cleStockage)) {
      // Retenu par sa seule clé citée : même liste blanche que les objets sans document (dossier propre de CETTE vidéo,
      // jamais une clé protégée), sinon le document partirait de la base et l'objet resterait (ou l'inverse).
      if (!texteEfface.includes(f.cleStockage) || !cleDeCetteVideo(f.cleStockage, id)) continue;
    }
    if (cleProtegee(f.cleStockage)) continue;
    if (utiliseAilleurs(f.id) || utiliseAilleurs(f.cleStockage) || scriptGarde.includes(f.id)) continue;
    designes.add(f.id);
    fichiers.push(f);
  }
  effacer("fichiers", [...designes]);

  // Fiches de scènes du tableau animé (`studio/<env>/fiches-scenes/<vidéo>/b<n>.json`, une par version du brouillon,
  // plus celle retenue au lancement) : rangées sous le dossier de la vidéo, jamais citées ailleurs.
  const entrees = (video.entrees ?? {}) as { tableauCreation?: { versions?: unknown }; tableau?: { ficheScenesCle?: unknown } };
  const nVersions = Array.isArray(entrees.tableauCreation?.versions) ? entrees.tableauCreation.versions.length : 0;
  const env = process.env.NODE_ENV === "production" ? "prod" : "dev";
  const objets = new Set<string>();
  for (let n = 1; n <= nVersions; n++) {
    try {
      objets.add(cleFicheScenes(env, id, `b${n}`));
    } catch {
      // Identifiant hors convention : aucune fiche n'a pu être rangée sous cette clé.
    }
  }
  const retenue = entrees.tableau?.ficheScenesCle;
  if (typeof retenue === "string" && retenue.includes(`/fiches-scenes/${id}/`)) objets.add(retenue);
  // Objets du stockage cités par les documents effacés mais sans document « fichiers » (clé écrite dans un texte, sous un dossier propre à la vidéo) : sauf si
  // un fichier enregistré les porte (démonstration, bibliothèque… gardés ou déjà désignés plus haut), ou si un autre document les cite.
  const clesDesFichiers = new Set((await d.fichiers.lister()).map((f) => f.cleStockage));
  for (const m of texteEfface.matchAll(/studio\/(?:prod|dev)\/[A-Za-z0-9_./-]+/g)) {
    const cle = m[0].replace(/[./-]+$/, "");
    // Liste blanche : seulement un objet rangé sous un dossier propre de CETTE vidéo (jamais celui d'une autre vidéo citée dans
    // une commande, jamais une illustration ou un élément de bibliothèque partagé).
    if (!cleDeCetteVideo(cle, id) || clesDesFichiers.has(cle)) continue;
    objets.add(cle);
  }
  for (const o of objets) if (utiliseAilleurs(o)) objets.delete(o);
  // Dossiers propres à la vidéo (listés au moment d'effacer, hors verrou). Garde stricte : un identifiant hors convention
  // fait échouer la suppression ENTIÈRE, avant tout effacement.
  const dossiers = prefixesDeVideo(env, id);

  const depenses = await d.depenses.lister((x) => x.videoId === id || (!!x.travailId && travailIds.has(x.travailId)));
  const totalDepense = formaterMontant(additionner(...depenses.map((x) => x.total)));

  // 6. Une trace, sans contenu : id, titre, format, date, total dépensé (le journal de la vidéo est gardé, décision D2).
  reecrire("evenements", {
    id: nouvelId("ev"),
    type: "video_supprimee",
    message: `Vidéo supprimée : « ${video.titre} » (${video.formatId}), ${totalDepense} dépensés`,
    entite: "video",
    entiteId: id,
    date: maintenant(),
    ...horodatage(),
  });

  for (const s of lot.supprimer) if (GARDEES.has(s.collection)) throw new Error(`Suppression interdite : ${s.collection}`);
  return { lot, fichiers, objets: [...objets], dossiers, totalDepense };
}

/** Efface une vidéo existante (refus vérifiés par l'appelant) : le lot d'abord, puis les objets du stockage. */
export async function executerSuppression(video: Video): Promise<void> {
  await effacerDuStockage(await appliquerSuppression(video));
}

/** Le plan calculé puis appliqué (à appeler sous le verrou du studio) ; rend les clés à effacer du stockage. */
export async function appliquerSuppression(video: Video): Promise<string[]> {
  const plan = await planifierSuppression(video);
  await appliquerLot(plan.lot);
  try {
    await oublierBailExpire(`lanceur-image-video:${video.id}`);
  } catch (e) {
    console.error("[suppression] bail non oublié", video.id, e);
  }
  // Les dossiers de la vidéo suivent, repérés par leur barre finale : `effacerDuStockage` les liste puis efface leurs objets.
  return [...plan.fichiers.map((f) => f.cleStockage), ...plan.objets, ...plan.dossiers];
}

/**
 * Les objets du stockage (R2), EN DERNIER et hors verrou : une erreur est journalisée sans bloquer. Une entrée qui finit
 * par « / » est un dossier de vidéo : il est listé (garde stricte, jamais un préfixe vide ou trop large) puis vidé.
 */
export async function effacerDuStockage(cles: string[]): Promise<void> {
  if (!cles.length) return;
  const stockage = await fournisseur("stockage");
  const aEffacer = new Set<string>();
  const dossiersListes = new Set<string>();
  const simples = new Set<string>();
  for (const cle of cles) {
    if (!cle.endsWith("/")) {
      if (cleProtegee(cle)) console.error("[suppression] clé protégée (illustration, bibliothèque…), gardée", cle);
      else simples.add(cle);
      continue;
    }
    if (!dossierPropreValide(cle)) {
      console.error("[suppression] dossier refusé par la garde, rien n'y est effacé", cle);
      continue;
    }
    try {
      for (const k of (await stockage.listerPrefixe?.(cle)) ?? []) if (k.startsWith(cle)) dossiersListes.add(k);
    } catch (e) {
      console.error("[suppression] dossier du stockage non listé", cle, e);
    }
  }
  // Un objet (clé simple OU trouvé dans un dossier) est gardé s'il appartient à un fichier enregistré qui reste (modèle,
  // bibliothèque…) ou si un document qui reste le cite, revérifié juste avant d'effacer : une vidéo fabriquée entre-temps
  // avec le même média ne le perd pas.
  if (dossiersListes.size || simples.size) {
    const d = depots();
    const gardes = new Set((await d.fichiers.lister()).map((f) => f.cleStockage));
    let texte = "";
    for (const c of Object.keys(d) as (keyof Depots)[]) if (c !== "fichiers") texte += (await (d[c] as unknown as Depot<Doc>).lister()).map((e) => JSON.stringify(e)).join("\n");
    for (const k of [...simples, ...dossiersListes]) if (!gardes.has(k) && !texte.includes(k) && !cleProtegee(k)) aEffacer.add(k);
  }
  for (const cle of aEffacer) {
    try {
      await stockage.supprimer?.(cle);
    } catch (e) {
      // Le document est déjà effacé : l'objet orphelin est dit au journal du serveur, la suppression n'est pas bloquée.
      console.error("[suppression] objet du stockage non effacé", cle, e);
    }
  }
}
