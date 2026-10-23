/**
 * VIDÉOS : listes, fiche, brouillons de l'assistant, statut éditorial, retouches,
 * miniatures, sous-titres, illustrations par plan.
 */
import "server-only";
import type { Adresse, BriqueFacultative, BlocScript, EtapeEditoriale, Id, IdReseau, Plan, PostureVisage, Ratio, Script, SousTitres, StatutVideo, StylesChoisis, Travail, Video, Distribution, MentionIA } from "@/domaine/types";
import { creditsDepuisElements, etatLicence, MENTION_IA_PAR_DEFAUT, texteScript } from "@/domaine/derivations";
import { adresseDepuisFacon } from "@/domaine/adresse";
import { visagePourFormat } from "@/domaine/distribution";
import { couvertureDepuisTitre } from "@/domaine/miniatures";
import { compteDansFormat } from "@/domaine/mes-videos";
import { voixPourFormat } from "@/domaine/voix-format";
import { debitLecture, dureeParDefaut, dureeVideo, listerFormats, obtenirFormat, reglagesParDefaut, scriptAJour, trouverFormat } from "@/formats";
import { nouvelId } from "@/lib/ids";
import { contient } from "@/lib/textes";
import { depots, ErreurStudio, filtreExemples, horodatage, journaliser, lireParametre, sousVerrou } from "./_commun";
import { exigerSession } from "./auth";
import { urlFichier, urlsFichiers } from "./fichiers";
import { enregistrerTexteVariante } from "./generateur";
import { versCarte } from "./presentation";
import { listerTravaux } from "./travaux";
import type { VueDistribution, VueVideoCarte, VueVideoDetail } from "./vues";
import type { AccordPrix } from "@/domaine/accord";
import { trouverMoi } from "./moi";
import { capacitesRatios, reseauxParDefaut } from "./formats-voulus";
import { formatsVoulus } from "@/reseaux/sorties";
import { prefixesDeVideo } from "@/domaine/dossiers-video";

export interface FiltresVideos {
  formatId?: string;
  statut?: StatutVideo | StatutVideo[];
  etapeEditoriale?: EtapeEditoriale;
  ratio?: Ratio;
  serieId?: string;
  q?: string;
  /** « recentes » (défaut), « anciennes », « titre ». */
  tri?: "recentes" | "anciennes" | "titre";
  /** Inclure les archivées (défaut : non, sauf si statut = archivee). */
  inclureArchivees?: boolean;
  /** Vidéos de la corbeille : jamais listées sauf si `true` (alors seulement elles). */
  corbeille?: boolean;
  limite?: number;
}

export async function listerVideos(filtres: FiltresVideos = {}): Promise<VueVideoCarte[]> {
  await listerTravaux(); // fait avancer les fabrications avant d'afficher les statuts
  const exemples = await filtreExemples<Video>();
  const statuts = filtres.statut ? (Array.isArray(filtres.statut) ? filtres.statut : [filtres.statut]) : null;
  const videos = await depots().videos.lister(
    (v) =>
      exemples(v) &&
      (filtres.corbeille ? !!v.corbeilleLe : !v.corbeilleLe) &&
      (!filtres.formatId || v.formatId === filtres.formatId) &&
      (statuts ? statuts.includes(v.statut) : filtres.inclureArchivees || v.statut !== "archivee") &&
      (!filtres.etapeEditoriale || v.etapeEditoriale === filtres.etapeEditoriale) &&
      (!filtres.ratio || v.ratios.includes(filtres.ratio)) &&
      (!filtres.serieId || v.serieId === filtres.serieId) &&
      (!filtres.q || contient(v.titre, filtres.q) || contient(v.sujet, filtres.q)),
  );
  const tri = filtres.tri ?? "recentes";
  videos.sort((a, b) => (tri === "titre" ? a.titre.localeCompare(b.titre, "fr") : tri === "anciennes" ? a.modifieLe.localeCompare(b.modifieLe) : b.modifieLe.localeCompare(a.modifieLe)));
  const limitees = filtres.limite ? videos.slice(0, filtres.limite) : videos;
  return Promise.all(limitees.map(versCarte));
}

/** Nombre de vidéos par format (onglets de Mes vidéos, barre latérale) : même règle que les onglets (`compteDansFormat`), brouillons compris. */
export async function compterVideosParFormat(options: { seulementPretes?: boolean } = {}): Promise<Record<string, number>> {
  const exemples = await filtreExemples<Video>();
  const videos = await depots().videos.lister((v) => exemples(v) && compteDansFormat(v) && (!options.seulementPretes || v.statut === "prete"));
  const compte: Record<string, number> = Object.fromEntries(listerFormats().map((f) => [f.id, 0]));
  for (const v of videos) compte[v.formatId] = (compte[v.formatId] ?? 0) + 1;
  return compte;
}

export async function listerSeries() {
  return depots().series.lister();
}

async function resoudreDistribution(distribution: Distribution[]): Promise<VueDistribution[]> {
  const d = depots();
  return Promise.all(
    distribution.map(async (x) => {
      const p = x.personnageId ? await d.personnages.obtenir(x.personnageId) : null;
      const vis = x.visageId ? await d.visages.obtenir(x.visageId) : null;
      const voix = x.voixId ? await d.voix.obtenir(x.voixId) : null;
      return {
        role: x.role,
        source: x.source,
        personnage: p ? { id: p.id, nom: p.nom, photo: await urlFichier(p.photoFichierId), nature: p.nature } : undefined,
        visage: vis ? { id: vis.id, nom: vis.nom, angle: vis.angle } : undefined,
        voix: voix ? { id: voix.id, nom: voix.nom } : undefined,
      };
    }),
  );
}

/**
 * Le travail que la page d'une vidéo montre : celui qui tourne ou qui s'est arrêté, la fabrication de la vidéo avant un
 * format ajouté (« Nouveau format ») qui tourne en même temps. Un essai arrêté n'est montré que s'il est le DERNIER de
 * sa sorte (fabrication, ou format ajouté) : une vidéo fabriquée par un essai suivant ne garde pas l'ancien panneau
 * « La fabrication s'est arrêtée » avec ses motifs périmés. `travaux` : du plus récent au plus ancien.
 */
export function travailAffiche<T extends Pick<Travail, "cibleId" | "statut" | "type">>(travaux: readonly T[], videoId: Id): T | null {
  const deLaVideo = travaux.filter((t) => t.cibleId === videoId);
  const dernierDeSaSorte = (t: T) => deLaVideo.find((x) => (x.type === "reexport") === (t.type === "reexport")) === t;
  const ouverts = deLaVideo.filter((t) => t.statut !== "termine" && (t.statut !== "echec" || dernierDeSaSorte(t)));
  return ouverts.find((t) => t.type !== "reexport") ?? ouverts[0] ?? null;
}

/** Fiche complète d'une vidéo (B.8 #8). */
export async function obtenirVideo(id: Id): Promise<VueVideoDetail | null> {
  const travaux = await listerTravaux({ inclureTermines: true });
  const d = depots();
  const video = await d.videos.obtenir(id);
  if (!video) return null;
  // Les maquettes ne sont pas des versions de la vidéo (ni choisies, ni comparées).
  const versions = (await d.versions.lister((v) => v.videoId === id && v.statut !== "maquette")).sort((a, b) => a.numero - b.numero);
  const versionCourante = versions.find((v) => v.id === video.versionChoisieId) ?? versions[versions.length - 1] ?? null;
  const versionPlans = versionCourante?.id ?? `${id}-brouillon`;
  const plans = (await d.plans.lister((p) => p.versionId === versionPlans)).sort((a, b) => a.ordre - b.ordre);
  const elements = await d.elements.lister((e) => plans.some((p) => p.illustration?.elementId === e.id) || Object.values(video.styles).includes(e.id));
  const urlsPlans = await urlsFichiers([...plans.map((p) => p.vignetteFichierId), ...elements.map((e) => e.vignetteFichierId)]);
  const sorties = versionCourante ? await d.sorties.lister((s) => s.versionId === versionCourante.id) : [];
  const urlsSorties = await urlsFichiers(sorties.flatMap((s) => [s.fichierId, s.vignetteFichierId]));
  const miniatures = await d.miniatures.lister((m) => m.videoId === id);
  const urlsMini = await urlsFichiers(miniatures.map((m) => m.fichierId));
  // La fabrication de la vidéo elle-même passe avant un format ajouté (« Nouveau format ») qui tourne en même temps.
  const travail = travailAffiche(travaux, id);
  const depenses = await d.depenses.lister((x) => x.videoId === id);
  return {
    video,
    carte: await versCarte(video),
    versions,
    versionCourante,
    plans: plans.map((p) => {
      const el = elements.find((e) => e.id === p.illustration?.elementId);
      return {
        ...p,
        vignette: p.vignetteFichierId ? (urlsPlans[p.vignetteFichierId] ?? null) : null,
        illustrationVignette: el?.vignetteFichierId ? (urlsPlans[el.vignetteFichierId] ?? null) : null,
        illustrationNom: el?.nom,
      };
    }),
    sorties: sorties.map((s) => ({ ...s, url: urlsSorties[s.fichierId] ?? "", vignette: urlsSorties[s.vignetteFichierId] ?? "" })),
    sousTitres: versionCourante ? await sousTitresCourants(versionCourante.id) : null,
    miniatures: miniatures.map((m) => ({ ...m, url: urlsMini[m.fichierId] ?? "" })),
    kit: await d.kits.trouver((k) => k.videoId === id),
    publications: (await d.publications.lister((p) => p.videoId === id)).sort((a, b) => a.date.localeCompare(b.date)),
    partages: await d.partages.lister((p) => p.videoId === id),
    retouches: await d.retouches.lister((r) => r.videoId === id),
    script: video.scriptId ? await obtenirScriptAJour(video.scriptId) : null,
    distribution: await resoudreDistribution(video.distribution),
    travail,
    coutLignes: depenses.flatMap((x) => x.lignes),
    noteQualite: video.noteQualite,
    licencesABloquer: elements.filter((e) => etatLicence(e.licence) !== "ok").map((e) => ({ id: e.id, nom: e.nom, etat: etatLicence(e.licence) })),
  };
}

/**
 * Sous-titres COURANTS d'une version : celui de plus haute `version` (chaque correction ou chaque fabrication
 * crée une nouvelle version ; les anciennes sont gardées, B.0 §20).
 */
export async function sousTitresCourants(versionId: Id): Promise<SousTitres | null> {
  const liste = await depots().sousTitres.lister((s) => s.versionId === versionId);
  return liste.sort((a, b) => b.version - a.version || b.creeLe.localeCompare(a.creeLe))[0] ?? null;
}

/** Script lu dans la recette COURANTE de son format (migré à la lecture, aucun texte perdu, B.9 bis). */
export async function obtenirScriptAJour(id: Id): Promise<Script | null> {
  const s = await depots().scripts.obtenir(id);
  return s ? scriptAJour(s) : null;
}

/* ------------------------------------------------------------------ */
/* Brouillons de l'assistant                                           */
/* ------------------------------------------------------------------ */

export interface DonneesBrouillon {
  titre?: string;
  sujet?: string;
  dureeCibleSec?: number;
  ratios?: Ratio[];
  distribution?: Distribution[];
  entrees?: Record<string, unknown>;
  reglages?: Record<string, unknown>;
  styles?: StylesChoisis;
  /** Briques coupées pour cette vidéo (AV2.7). */
  briquesCoupees?: BriqueFacultative[];
  /** Briques « coupées par défaut » allumées pour cette vidéo (mention IA). */
  briquesAllumees?: BriqueFacultative[];
  mentionIA?: MentionIA;
  adresse?: Adresse;
  posture?: PostureVisage;
  etapeAssistant?: string;
  scriptId?: string;
}

/** Distribution par défaut : Will (son double et sa voix par défaut, sinon les premiers prêts), si le format a des personnages. */
async function distributionParDefaut(formatId: string): Promise<Distribution[]> {
  const format = obtenirFormat(formatId);
  if (format.personnages.max === 0) return [];
  const d = depots();
  const moi = await trouverMoi();
  const visage = moi ? visagePourFormat(await d.visages.lister((v) => v.personnageId === moi.id), moi, formatId) : null;
  // Voix du format d'abord (« Vidéo type avocat → Voix avocat rapide »), sinon la voix habituelle (lot du 02/10).
  const voix = moi ? voixPourFormat(await d.voix.lister((v) => v.personnageId === moi.id), moi, formatId) : null;
  const roles = format.personnages.roles ?? ["Face caméra"];
  return roles.slice(0, Math.max(1, format.personnages.min)).map((role, i) => ({
    role,
    personnageId: i === 0 ? moi?.id : undefined,
    source: "double" as const,
    visageId: i === 0 ? visage?.id : undefined,
    voixId: i === 0 ? voix?.id : undefined,
  }));
}

/**
 * Crée un brouillon (« Nouvelle vidéo »), éventuellement depuis un modèle, un script ou une idée. `reseaux` (T5) : les
 * réseaux dont le format préféré est voulu ; absent : les réseaux par défaut. `ratios` (T5) : formats déjà décidés par
 * l'appelant (la vidéo d'une version du générateur : ceux de son prix, `ratiosDeLaVersion`), posés tels quels.
 */
export async function creerBrouillon(formatId: string, depuis: { modeleId?: string; scriptId?: string; ideeId?: string; reseaux?: IdReseau[]; ratios?: Ratio[] } = {}): Promise<Id> {
  await exigerSession();
  const d = depots();
  const format = obtenirFormat(formatId);
  if (format.statut !== "actif") throw new ErreurStudio("FORMAT_BIENTOT", "Ce format arrive bientôt.");
  const modele = depuis.modeleId ? await d.modeles.obtenir(depuis.modeleId) : null;
  const script = depuis.scriptId ? await d.scripts.obtenir(depuis.scriptId) : null;
  const idee = depuis.ideeId ? await d.idees.obtenir(depuis.ideeId) : null;
  const mention = await lireParametre<MentionIA>("mentionIA.parDefaut", MENTION_IA_PAR_DEFAUT);
  const adresse = await adresseParDefaut();
  const sujet = script?.sujet ?? idee?.texte ?? "";
  const distribution = modele?.distribution ?? (await distributionParDefaut(formatId));
  // Formats par réseau T5 : formats du modèle filtrés par ce que l'écran propose (`format.ratios`) ET ce que le moteur
  // sait faire (face caméra : comme avant, ses pastilles décident), sinon le format maître ; plus le préféré des réseaux
  // par défaut, aux mêmes bornes (l'avocat, hors T5, n'en reçoit aucun ; jamais un format que l'écran ne montre pas, ni ne
  // laisse décocher). Posé à la CRÉATION seulement, coché par défaut et décochable : le lancement n'ajoute rien.
  const capacites = await capacitesRatios(format.id);
  const ajoutables = format.ratios.filter((r) => capacites.includes(r));
  const possibles = capacites.length ? ajoutables : format.ratios;
  const duModele = modele?.ratios.filter((r) => possibles.includes(r)) ?? [];
  const video: Video = {
    id: nouvelId("v"),
    titre: sujet || "Nouvelle vidéo",
    sujet,
    formatId,
    versionFormat: format.version,
    profilRenduVersion: format.profilRendu?.version ?? 1,
    marqueId: "marque-axion",
    statut: "brouillon",
    // Format « depuis-script » : la durée vient du texte dès qu'il existe (B.0 §18).
    // TEST-UI-REEL U2 : au débit de la voix qui lira (voix HeyGen : débit réel mesuré).
    dureeCibleSec: script ? dureeVideo(format, texteScript(script.blocs), script.dureeCibleSec ?? dureeParDefaut(format), debitLecture(format, distribution[0]?.voixId ? await d.voix.obtenir(distribution[0].voixId) : null)) : (modele?.dureeSec ?? dureeParDefaut(format)),
    ratios: depuis.ratios ?? formatsVoulus(duModele.length ? duModele : [format.ratioMaitre], depuis.reseaux ?? (await reseauxParDefaut()), ajoutables, format.ratioMaitre),
    scriptId: script?.id,
    distribution,
    entrees: {},
    reglages: modele?.reglages ?? reglagesParDefaut(format),
    styles: modele?.stylesChoisis ?? {},
    briquesCoupees: modele?.briquesCoupees ?? [],
    // La mention IA (coupée par défaut) s'allume pour toutes les vidéos d'un seul interrupteur : Réglages > Mention IA.
    briquesAllumees: modele?.briquesAllumees ?? (mention.incrustee ? ["mention-ia"] : []),
    mentionIA: mention,
    adresse: script?.adresse ?? adresse,
    modeleId: modele?.id,
    ideeId: idee?.id,
    langue: "fr-FR",
    etapeAssistant: script ? "distribution" : "sujet",
    ...horodatage(),
  };
  await d.videos.enregistrer(video);
  if (modele) await d.modeles.modifier(modele.id, { utilisations: modele.utilisations + 1 });
  if (idee) await d.idees.modifier(idee.id, { etat: "en-video", videoId: video.id });
  return video.id;
}

export async function modifierBrouillon(id: Id, patch: DonneesBrouillon): Promise<Video> {
  await exigerSession();
  const d = depots();
  const v = await d.videos.obtenir(id);
  if (!v) throw new ErreurStudio("INTROUVABLE", "Cette vidéo n'existe plus.");
  const suite: Partial<Video> = { ...patch };
  if (patch.sujet && (!v.titre || v.titre === "Nouvelle vidéo" || v.titre === v.sujet)) suite.titre = patch.sujet;
  // Le script écrit AVANT que le sujet n'arrive s'appelait « Nouvelle vidéo » partout (E2E-1 n° 14) : il prend le sujet.
  const scriptId = patch.scriptId ?? v.scriptId;
  if (patch.sujet?.trim() && scriptId) {
    const s = await d.scripts.obtenir(scriptId);
    if (s && !s.reference && (!s.sujet.trim() || s.sujet === "Nouvelle vidéo")) await d.scripts.modifier(s.id, { sujet: patch.sujet.trim() });
  }
  // Toute bascule de la mention IA est un choix de Will, CONSIGNÉ au journal de la vidéo (date, valeur ; v3.2).
  if (patch.briquesAllumees) {
    const avant = (v.briquesAllumees ?? []).includes("mention-ia") && !(v.briquesCoupees ?? []).includes("mention-ia");
    const apres = patch.briquesAllumees.includes("mention-ia") && !(patch.briquesCoupees ?? v.briquesCoupees ?? []).includes("mention-ia");
    if (avant !== apres) await journaliser("mention-ia", apres ? "Mention IA allumée pour cette vidéo" : "Mention IA coupée pour cette vidéo", { type: "video", id });
  }
  return d.videos.modifier(id, suite);
}

/** Adresse par défaut : « Ma façon de parler » (tutoiement → tu, sinon vous). Pas de nouveau réglage. */
export async function adresseParDefaut(): Promise<Adresse> {
  const facon = await lireParametre<{ tutoiement?: boolean } | null>("style.faconDeParler", null);
  return adresseDepuisFacon(facon?.tutoiement);
}

/** « Reprendre » une vidéo arrêtée : elle repasse en brouillon (rien n'est effacé). */
export async function reprendreVideo(id: Id): Promise<void> {
  await exigerSession();
  const d = depots();
  const v = await d.videos.obtenir(id);
  if (!v || v.statut !== "annulee") return;
  await d.videos.modifier(id, { statut: "brouillon", etapeAssistant: v.etapeAssistant === "fabrication" ? "apercu" : v.etapeAssistant });
  await journaliser("video", `Vidéo reprise en brouillon : « ${v.titre} »`, { type: "video", id });
}

/** Enregistre le texte écrit à l'étape Script (crée ou met à jour le script lié). */
export async function enregistrerScriptDuBrouillon(videoId: Id, blocs: BlocScript[]): Promise<Script> {
  await exigerSession();
  const d = depots();
  const v = await d.videos.obtenir(videoId);
  if (!v) throw new ErreurStudio("INTROUVABLE", "Cette vidéo n'existe plus.");
  // Générateur (G1a) : vidéo d'une version par réseau → ouverture et fin dans la version, corps dans le texte commun.
  if (v.varianteId) return enregistrerTexteVariante(videoId, blocs);
  const format = obtenirFormat(v.formatId);
  const existant = v.scriptId ? await d.scripts.obtenir(v.scriptId) : null;
  if (existant && !existant.reference) {
    // La version migrée est enregistrée avec son `versionFormat` (sinon le script resterait « v1 » à vie, B.9 bis).
    const maj = await d.scripts.modifier(existant.id, { blocs, version: existant.version + 1, versionFormat: format.version, adresse: v.adresse ?? existant.adresse });
    // Le texte change : les plans de l'Aperçu seront recalculés. Les anciens sont ARCHIVÉS (jamais supprimés)
    // et leurs images choisies et verrouillées seront reportées sur les nouveaux plans (voir plansApercu).
    const cle = `${videoId}-brouillon`;
    const archive = `${cle}-archive-${Date.now()}`;
    for (const p of await d.plans.lister((x) => x.versionId === cle)) {
      await d.plans.enregistrer({ ...p, id: `${archive}-plan-${p.ordre}`, versionId: archive });
      // L'ancienne ligne quitte l'Aperçu ; la copie archivée garde tout son contenu.
      await d.plans.modifier(p.id, { versionId: `${archive}-remplace` });
    }
    return maj;
  }
  const script: Script = {
    id: nouvelId("script"),
    formatId: v.formatId,
    versionFormat: format.version,
    sujet: v.sujet || v.titre,
    dureeCibleSec: v.dureeCibleSec,
    adresse: v.adresse,
    version: 1,
    parentId: existant?.id,
    blocs,
    favori: false,
    reference: false,
    statutEditorial: "brouillon",
    marqueId: v.marqueId,
    creePourVideoId: videoId,
    ...horodatage(),
  };
  await d.scripts.enregistrer(script);
  await d.videos.modifier(videoId, { scriptId: script.id });
  return script;
}

/** Abandonne un brouillon : il est archivé, pas effacé (rien n'est purgé ; seule « Supprimer définitivement » efface, 17/10). */
export async function abandonnerBrouillon(id: Id): Promise<void> {
  await exigerSession();
  const v = await depots().videos.obtenir(id);
  if (v?.statut === "brouillon") await depots().videos.modifier(id, { statut: "archivee", statutAvantArchive: "brouillon" });
}

/* ------------------------------------------------------------------ */
/* Actions sur les vidéos                                              */
/* ------------------------------------------------------------------ */

/** Une vidéo en cours de fabrication ne s'archive pas : la fin du travail la ferait réapparaître « Prête ». */
export const enFabrication = (statut: StatutVideo) => statut === "en_file" || statut === "en_fabrication";

export async function archiverVideos(ids: Id[]): Promise<void> {
  await exigerSession();
  const d = depots();
  const videos = (await Promise.all(ids.map((id) => d.videos.obtenir(id)))).filter((v): v is Video => !!v);
  const bloquees = videos.filter((v) => enFabrication(v.statut));
  if (bloquees.length) {
    throw new ErreurStudio(
      "EN_FABRICATION",
      bloquees.length > 1 ? `${bloquees.length} vidéos sont en fabrication : archivez-les une fois prêtes.` : `« ${bloquees[0].titre} » est en fabrication : archivez-la une fois prête.`,
    );
  }
  for (const v of videos) if (v.statut !== "archivee") await d.videos.modifier(v.id, { statut: "archivee", statutAvantArchive: v.statut });
  await journaliser("video", videos.length > 1 ? `${videos.length} vidéos archivées` : "1 vidéo archivée");
}

/**
 * « Supprimer définitivement » (décision écrite de Will du 17/10 : vraie suppression, dépenses gardées). Refuse une
 * vidéo en fabrication ou programmée. Une vidéo déjà absente : rien à faire, sans erreur (false).
 */
export async function supprimerVideoDefinitivement(videoId: Id): Promise<boolean> {
  return (await supprimerVideosDefinitivement([videoId])).supprimees === 1;
}

/**
 * Plusieurs vidéos : TOUTES sont vérifiées avant d'en effacer une (un refus n'efface rien). Refus, plan et lot sous le
 * verrou du studio (aucune écriture concurrente écrasée, deux suppressions simultanées n'en font qu'une) ; le stockage
 * est vidé ensuite, hors verrou.
 */
export async function supprimerVideosDefinitivement(ids: Id[]): Promise<{ supprimees: number }> {
  await exigerSession();
  return supprimerVideosSansSession(ids);
}

/**
 * Cœur de la suppression, SANS session : réservé à la corbeille (`services/corbeille.ts`). `garde` (relecture #479) est
 * appliquée à CHAQUE lecture de la vidéo, sous le verrou comprise : une vidéo qui ne la passe plus (restaurée entre-temps)
 * est laissée intacte, sans erreur.
 */
export async function supprimerVideosSansSession(ids: Id[], options: { garde?: (v: Video) => boolean } = {}): Promise<{ supprimees: number }> {
  const { appliquerSuppression, effacerDuStockage, refusSuppression } = await import("./suppression-video");
  const d = depots();
  const uniques = [...new Set(ids)];
  const choisies = new Set(uniques);
  // `garde` est rejouée à CHAQUE lecture, donc aussi sous le verrou : une vidéo restaurée entre-temps n'est pas effacée.
  const charger = async () => (await Promise.all(uniques.map((id) => d.videos.obtenir(id)))).filter((v): v is Video => !!v && (options.garde?.(v) ?? true));
  const verifier = async (videos: Video[], ignorerSite = false) => {
    for (const v of videos) {
      // Identifiant hors convention : refus ICI, avant le retrait du site (sinon la page partirait alors que la vidéo reste).
      prefixesDeVideo(process.env.NODE_ENV === "production" ? "prod" : "dev", v.id);
      const refus = await refusSuppression(v, { aussiSupprimees: choisies, ignorerSite });
      if (refus) throw new ErreurStudio(refus.code, refus.message);
    }
  };
  // 1. Les refus d'abord : une vidéo refusée ne retire AUCUNE page du site et n'efface rien.
  // (une page en ligne n'est pas un refus ici : elle est retirée juste après, et revérifiée sous le verrou)
  const retenues = await charger();
  await verifier(retenues, true);
  // 2. Vidéos sur le site (lot S4) : une page en ligne est retirée du site AVANT le verrou (appel réseau) et avant tout
  // effacement ; si le site ne répond pas, rien n'est effacé (aucune page orpheline).
  const { retirerAvantSuppression } = await import("./site-videos");
  await retirerAvantSuppression(retenues.map((v) => v.id));
  // 3. Sous le verrou : refus revérifiés (l'état a pu changer), puis plan et lot de chaque vidéo. Les fichiers de chaque vidéo
  // déjà supprimée sont notés au fur et à mesure : si une suivante échoue, ils partent quand même (`finally`).
  const aEffacer: string[] = [];
  try {
    return await sousVerrou(async () => {
      const videos = await charger();
      await verifier(videos);
      let supprimees = 0;
      for (const v of videos) {
        aEffacer.push(...(await appliquerSuppression(v)));
        supprimees++;
      }
      return { supprimees };
    });
  } finally {
    // La base est déjà effacée : une panne du stockage ne doit ni faire échouer l'appel ni masquer l'erreur d'origine.
    try {
      await effacerDuStockage(aEffacer);
    } catch (e) {
      console.error("[suppression] objets du stockage non effacés, à nettoyer à la main", aEffacer.length, e);
      try {
        const { creerNotification } = await import("./notifications");
        await creerNotification({ type: "echec", titre: "Des fichiers n'ont pas pu être effacés", message: "La vidéo est supprimée, mais le stockage n'a pas répondu : certains de ses fichiers restent à effacer." });
      } catch (n) {
        console.error("[suppression] notification non créée", n);
      }
    }
  }
}

/** Restaure le statut d'avant l'archivage (« Prête » seulement en dernier recours, si une version existe). */
export async function desarchiverVideo(id: Id): Promise<boolean> {
  await exigerSession();
  const d = depots();
  // Sous le verrou (comme la purge de la corbeille) : lecture, contrôle et écriture ensemble.
  const fait = await sousVerrou(async () => {
    const v = await d.videos.obtenir(id);
    if (!v || v.statut !== "archivee") return false;
    const statut: StatutVideo = v.statutAvantArchive && v.statutAvantArchive !== "archivee" ? v.statutAvantArchive : v.versionChoisieId ? "prete" : "brouillon";
    await d.videos.modifier(id, { statut, statutAvantArchive: undefined, corbeilleLe: undefined });
    return true;
  });
  if (!fait) return false;
  // Sortie de la corbeille par le bandeau : sans cette trace, un refus futur serait notifié de nouveau.
  await d.parametres.supprimer(`corbeille.refusNotifie.${id}`);
  return true;
}

export async function changerEtapeEditoriale(id: Id, etape: EtapeEditoriale): Promise<void> {
  await exigerSession();
  const video = await depots().videos.obtenir(id);
  // Générateur (G1b) : pour une vidéo rattachée à une version, l'état de la VERSION fait foi (B.2.5) ; « validée »
  // valide la version, puis la copie est resynchronisée. Les autres étapes suivent les publications, jamais un toucher.
  if (video?.varianteId) {
    const { validerVariante, synchroniserEtats } = await import("./generateur");
    const v = await depots().variantes.obtenir(video.varianteId);
    if (etape === "validee" && v && v.etat === "a-relire") await validerVariante(v.id);
    await synchroniserEtats(video.varianteId);
    return;
  }
  await depots().videos.modifier(id, { etapeEditoriale: etape });
}

export async function renommerVideo(id: Id, titre: string): Promise<void> {
  await exigerSession();
  await depots().videos.modifier(id, { titre: titre.trim() || "Sans titre" });
}

export async function choisirVersion(videoId: Id, versionId: Id): Promise<void> {
  await exigerSession();
  const d = depots();
  for (const v of await d.versions.lister((x) => x.videoId === videoId)) await d.versions.modifier(v.id, { choisie: v.id === versionId });
  await d.videos.modifier(videoId, { versionChoisieId: versionId });
}

export async function choisirMiniature(videoId: Id, miniatureId: Id, titreDemande?: string): Promise<void> {
  await exigerSession();
  const d = depots();
  // Lot R4 : un nouveau titre sur une miniature où il est ÉCRIT refait l'image (l'ancienne reste dans les fichiers).
  const cible = await d.miniatures.obtenir(miniatureId);
  // 60 caractères au plus, comme le champ de l'écran ; ÉCRIT sur l'image : 5 mots au plus (même règle que partout,
  // coupé proprement, jamais refusé). C'est CE texte qui est posé sur l'image et enregistré : jamais deux titres.
  const saisi = titreDemande?.trim().slice(0, 60);
  const titre = saisi && cible?.incrustee ? couvertureDepuisTitre(saisi) : saisi;
  let fichierId: Id | null = null;
  if (cible?.videoId === videoId && cible.incrustee && titre?.trim() && titre.trim() !== cible.titre.trim()) {
    const { retitrerMiniature } = await import("./miniatures");
    fichierId = await retitrerMiniature(cible, titre.trim());
  }
  for (const m of await d.miniatures.lister((x) => x.videoId === videoId)) {
    await d.miniatures.modifier(m.id, { choisie: m.id === miniatureId, ...(m.id === miniatureId && titre ? { titre } : {}), ...(m.id === miniatureId && fichierId ? { fichierId } : {}) });
  }
  await d.videos.modifier(videoId, { miniatureChoisieId: miniatureId });
}

/** Corrige un mot des sous-titres (toucher un mot pour le corriger, AV2.3-3). */
export async function corrigerMotSousTitres(videoId: Id, segmentId: string, indexMot: number, mot: string): Promise<void> {
  await exigerSession();
  const d = depots();
  const v = await d.videos.obtenir(videoId);
  const st = v?.versionChoisieId ? await sousTitresCourants(v.versionChoisieId) : null;
  if (!st) throw new ErreurStudio("INTROUVABLE", "Pas de sous-titres pour cette vidéo.");
  const segment = st.segments.find((s) => s.id === segmentId);
  if (!segment || indexMot < 0 || indexMot >= segment.mots.length) throw new ErreurStudio("INTROUVABLE", "Ce mot n'existe plus.");
  const propre = mot.trim();
  if (!propre) throw new ErreurStudio("VIDE", "Le mot ne peut pas être vide.");
  if (segment.mots[indexMot].mot === propre) return;
  // Lot M2 (B.0 §20) : une NOUVELLE version des sous-titres, l'ancienne est gardée intacte (rien n'est effacé) ;
  // tous les lecteurs prennent la plus haute (`sousTitresCourants`). Aucun rendu ici : le recalque est au lot M4.
  const segments = st.segments.map((s) => (s.id === segmentId ? { ...s, mots: s.mots.map((m, i) => (i === indexMot ? { ...m, mot: propre } : m)) } : s));
  await d.sousTitres.enregistrer({ ...st, id: nouvelId("st"), segments, version: st.version + 1, ...horodatage() });
}

/** Choisit l'illustration d'un plan : le choix est VERROUILLÉ (le moteur ne l'écrase jamais). */
export async function choisirIllustrationPlan(planId: Id, elementId: Id | null): Promise<Plan> {
  await exigerSession();
  const d = depots();
  const plan = await d.plans.obtenir(planId);
  if (!plan) throw new ErreurStudio("INTROUVABLE", "Ce plan n'existe plus.");
  const el = elementId ? await d.elements.obtenir(elementId) : null;
  return d.plans.modifier(planId, {
    sourceImage: el ? "illustration" : "double",
    illustration: { source: el ? "bibliotheque" : "aucune", elementId: el?.id, requete: plan.illustration?.requete, verrouille: true, candidats: plan.illustration?.candidats ?? [] },
    vignetteFichierId: el?.vignetteFichierId ?? plan.vignetteFichierId,
  });
}

/** Demande « refais ce plan » (B.8 #8) : crée une nouvelle version via le moteur. */
export async function demanderRetouche(videoId: Id, planIds: Id[], consigne: string, options: { confirme?: AccordPrix } = {}): Promise<{ retoucheId: Id; travailId: Id }> {
  await exigerSession();
  const { lancerRetouche } = await import("./fabrication");
  return lancerRetouche(videoId, planIds, consigne, options);
}

/** Enregistrer comme modèle (B.8 #8, #12b). */
export async function enregistrerCommeModele(videoId: Id, nom: string): Promise<Id> {
  await exigerSession();
  const d = depots();
  const v = await d.videos.obtenir(videoId);
  if (!v) throw new ErreurStudio("INTROUVABLE", "Cette vidéo n'existe plus.");
  const sortie = v.versionChoisieId ? await d.sorties.trouver((s) => s.versionId === v.versionChoisieId) : null;
  const id = nouvelId("mod");
  await d.modeles.enregistrer({
    id,
    nom: nom.trim() || v.titre,
    formatId: v.formatId,
    versionFormat: v.versionFormat,
    dureeSec: v.dureeCibleSec,
    ratios: v.ratios,
    distribution: v.distribution,
    stylesChoisis: v.styles,
    briquesCoupees: v.briquesCoupees,
    briquesAllumees: v.briquesAllumees,
    reglages: v.reglages,
    creeDepuisVideoId: v.id,
    vignetteFichierId: sortie?.vignetteFichierId,
    utilisations: 0,
    marqueId: v.marqueId,
    ...horodatage(),
  });
  await journaliser("modele", `Modèle créé : « ${nom} »`, { type: "modele", id });
  return id;
}

/** Crédits des éléments utilisés par une vidéo (licences). */
export async function creditsVideo(videoId: Id): Promise<string[]> {
  const d = depots();
  const v = await d.videos.obtenir(videoId);
  if (!v) return [];
  const plans = await d.plans.lister((p) => p.videoId === videoId && p.versionId === v.versionChoisieId);
  const ids = new Set([...plans.map((p) => p.illustration?.elementId), ...Object.values(v.styles)].filter(Boolean) as string[]);
  return creditsDepuisElements(await d.elements.lister((e) => ids.has(e.id)));
}

/** Brouillon le plus récent (« Reprendre le brouillon »). */
export async function dernierBrouillon(): Promise<VueVideoCarte | null> {
  const [b] = await listerVideos({ statut: "brouillon", limite: 1 });
  return b ?? null;
}

export function formatDeVideo(formatId: string) {
  return trouverFormat(formatId);
}

