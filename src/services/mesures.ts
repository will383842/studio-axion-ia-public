/**
 * MESURE MINIMALE ET « PROGRAMMER LES N » (plan v5 B.5.5, B.8 §2, lot G7a).
 *
 * - Mesures à saisir : publications d'une version du générateur, réellement parties, à J+3 et J+7 (`echeanceMesure`).
 *   Chaque saisie AJOUTE un relevé daté avec ses définitions ; `stats` reçoit la copie du dernier. Rien n'est effacé.
 * - Programmer les N : les versions d'un sujet qui ont leur vidéo, un format à la fois, chacune sur SON réseau, dans
 *   l'ordre J à J+4. Chaque envoi passe par `envoyerVersBuffer` (même interrupteur simulé / réel, aucun autre).
 * - Aucune prédiction : on ne range que ce qui a été mesuré.
 */
import "server-only";
import { ordreValide } from "@/domaine/classement-generateur";
import {
  controlerSaisie,
  DEFINITIONS_MESURES,
  echeanceMesure,
  lienDeVersion,
  PAGE_SUIVIE_PAR_DEFAUT,
  planProgrammation,
  versionsAProgrammer,
  type CreneauVersion,
  type JourMesure,
  type SaisieMesures,
  type VersionProgrammable,
} from "@/domaine/mesures";
import type { Id, ModeEnvoiPublication, Publication, ReseauDeclinaison } from "@/domaine/types";
import { obtenirReseau } from "@/reseaux";
import { depots, ErreurStudio, filtreExemples, fournisseurSimule, journaliser, lireParametre, maintenant } from "./_commun";
import { exigerSession } from "./auth";
import { obtenirSujet, synchroniserEtats } from "./generateur";
import { envoyerVersBuffer, obtenirKit } from "./publications";
import { occupeBuffer } from "@/domaine/buffer";
import { lireModeBuffer } from "./buffer";
import { formateurDate } from "@/lib/intl";

/* ------------------------------------------------------------------ */
/* Lien suivi                                                          */
/* ------------------------------------------------------------------ */

/** Page du site vers laquelle pointent les liens suivis (`publication.pageSuivie`, réglage de Will). */
export async function pageSuivie(): Promise<string> {
  return lireParametre<string>("publication.pageSuivie", PAGE_SUIVIE_PAR_DEFAUT);
}

/** Lien suivi d'une version : celui écrit dans la version s'il existe, sinon calculé. */
export async function lienSuiviVersion(v: { code: string; reseau: ReseauDeclinaison; publication?: { lienSuivi?: string } }): Promise<string | undefined> {
  return v.publication?.lienSuivi ?? lienDeVersion(await pageSuivie(), v);
}

/* ------------------------------------------------------------------ */
/* Mesures à saisir                                                    */
/* ------------------------------------------------------------------ */

export interface MesureASaisir {
  publicationId: Id;
  videoId: Id;
  varianteId: Id;
  code: string;
  reseau: ReseauDeclinaison;
  reseauNom: string;
  titre: string;
  jour: JourMesure;
  datePublication: string;
}

export interface MesureSaisie {
  publicationId: Id;
  code: string;
  reseau: ReseauDeclinaison;
  titre: string;
  jour: number;
  le: string;
  tauxAbandon3s?: number;
  dureeMoyenneVueSec?: number;
  partagesParPortee?: number;
}

async function publicationsMesurables(aSaisir = false): Promise<Publication[]> {
  const ex = await filtreExemples<Publication>();
  const archivees = new Set((await depots().videos.lister((v) => v.statut === "archivee")).map((v) => v.id));
  const publications = await depots().publications.lister((p) => ex(p) && !!p.varianteId && p.via !== "simulation" && !archivees.has(p.videoId));
  if (!aSaisir) return publications;
  // Publication gardée après la suppression de sa vidéo : ses mesures restent consultables, mais plus rien à saisir.
  const existantes = new Set((await depots().videos.lister()).map((v) => v.id));
  return publications.filter((p) => existantes.has(p.videoId));
}

/** Publications dont un relevé est attendu (J+7 d'abord, puis les plus anciennes). */
export async function listerMesuresASaisir(instant: Date = new Date()): Promise<MesureASaisir[]> {
  await exigerSession();
  const d = depots();
  const r: MesureASaisir[] = [];
  for (const p of await publicationsMesurables(true)) {
    const jour = echeanceMesure(p, instant);
    if (!jour) continue;
    const v = await d.variantes.obtenir(p.varianteId!);
    const m = v ? await d.scriptsMaitres.obtenir(v.scriptMaitreId) : null;
    const video = await d.videos.obtenir(p.videoId);
    r.push({
      publicationId: p.id,
      videoId: p.videoId,
      varianteId: p.varianteId!,
      code: v?.code ?? "",
      reseau: p.reseau as ReseauDeclinaison,
      reseauNom: obtenirReseau(p.reseau).nom,
      titre: m?.angle?.titre ?? m?.brief.idee ?? video?.titre ?? "",
      jour,
      datePublication: p.date,
    });
  }
  return r.sort((a, b) => b.jour - a.jour || a.datePublication.localeCompare(b.datePublication));
}

/** Tuile d'Accueil « Mesures à saisir (n) ». */
export async function compterMesuresASaisir(instant: Date = new Date()): Promise<number> {
  return (await publicationsMesurables(true)).filter((p) => echeanceMesure(p, instant) !== null).length;
}

/** Derniers relevés saisis (les plus récents d'abord) : les chiffres tels quels, jamais une estimation. */
export async function listerMesuresSaisies(limite = 6): Promise<MesureSaisie[]> {
  await exigerSession();
  const d = depots();
  const lignes: MesureSaisie[] = [];
  for (const p of await publicationsMesurables()) {
    const v = await d.variantes.obtenir(p.varianteId!);
    const m = v ? await d.scriptsMaitres.obtenir(v.scriptMaitreId) : null;
    for (const rel of p.releves ?? []) {
      if (rel.source !== "saisie") continue;
      lignes.push({
        publicationId: p.id,
        code: v?.code ?? "",
        reseau: p.reseau as ReseauDeclinaison,
        titre: m?.angle?.titre ?? m?.brief.idee ?? "",
        jour: rel.jour,
        le: rel.le,
        tauxAbandon3s: rel.valeurs.tauxAbandon3s,
        dureeMoyenneVueSec: rel.valeurs.dureeMoyenneVueSec,
        partagesParPortee: rel.valeurs.partagesParPortee,
      });
    }
  }
  return lignes.sort((a, b) => b.le.localeCompare(a.le)).slice(0, limite);
}

/**
 * Enregistre les 3 mesures du relevé attendu (J+3 ou J+7) : AJOUT d'un relevé daté avec ses définitions ; `stats`
 * reçoit la copie (vues, mentions et commentaires gardés). Une publication programmée qu'on mesure est publiée.
 */
export async function enregistrerMesures(publicationId: Id, saisie: SaisieMesures, instant: Date = new Date()): Promise<Publication> {
  await exigerSession();
  const d = depots();
  const p = await d.publications.obtenir(publicationId);
  if (!p) throw new ErreurStudio("INTROUVABLE", "Cette publication n'existe plus.");
  const jour = echeanceMesure(p, instant);
  if (!jour) throw new ErreurStudio("RIEN_A_SAISIR", "Aucune mesure attendue pour cette publication.");
  const c = controlerSaisie(saisie);
  if (!c.ok) throw new ErreurStudio("SAISIE", c.message);
  const avant = p.stats ?? { vues: 0, likes: 0, commentaires: 0, partages: 0 };
  const valeurs = { ...avant, ...c.valeurs };
  const releve = { le: instant.toISOString(), jour, source: "saisie" as const, valeurs, definitions: { ...DEFINITIONS_MESURES } };
  const suite = await d.publications.modifier(p.id, {
    releves: [...(p.releves ?? []), releve],
    stats: valeurs,
    ...(p.statut === "programmee" ? { statut: "publiee" as const } : {}),
  });
  if (p.statut === "programmee") await d.videos.modifier(p.videoId, { etapeEditoriale: "publiee" });
  if (p.varianteId) await synchroniserEtats(p.varianteId);
  await journaliser("mesure", `Mesures J+${jour} saisies`, { type: "video", id: p.videoId });
  return suite;
}

/* ------------------------------------------------------------------ */
/* « Programmer les N » (B.5.5)                                        */
/* ------------------------------------------------------------------ */

export interface PlanProgrammation {
  formatId?: string;
  creneaux: CreneauVersion[];
  /** Versions prêtes d'autres formats (programmées au toucher suivant, un format à la fois). */
  autresFormats: number;
  envoiSimule: boolean;
  /** Lot R1 : envoi réel en brouillon dans Buffer (défaut) ou programmé directement (choix de Will). */
  modeBuffer: ModeEnvoiPublication;
}

/** Jour J proposé : demain (à Paris). */
export function jourJParDefaut(instant: Date = new Date()): string {
  const auj = formateurDate("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
  const d = new Date(`${auj}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Ce que « Programmer les N » enverrait : versions retenues et créneaux J à J+4. */
export async function planProgrammerSujet(scriptMaitreId: Id, options: { formatId?: string; jourJ?: string } = {}): Promise<PlanProgrammation> {
  await exigerSession();
  const vue = await obtenirSujet(scriptMaitreId);
  if (!vue) throw new ErreurStudio("INTROUVABLE", "Ce sujet n'existe plus.");
  const programmables: VersionProgrammable[] = [];
  vue.grille.forEach((ligne, rangLigne) => {
    for (const [reseau, c] of Object.entries(ligne.cases) as [ReseauDeclinaison, { etat: VersionProgrammable["etatCase"]; varianteId?: Id; code?: string }][]) {
      if (!c.varianteId || !c.code) continue;
      const v = vue.versions.find((x) => x.variante.id === c.varianteId);
      programmables.push({ id: c.varianteId, code: c.code, reseau, formatId: ligne.formatId, etatCase: c.etat, videoId: v?.videoId, rangLigne });
    }
  });
  // Déjà envoyées (même un essai) et pas encore passées : jamais deux fois.
  const ids = new Set(programmables.map((v) => v.id));
  const instant = maintenant();
  // Lot R1 : un brouillon déjà dans Buffer (ou un envoi en cours, à vérifier) compte aussi, quelle que soit sa date.
  const envoyees = await depots().publications.lister((p) => !!p.varianteId && ids.has(p.varianteId) && (p.statut === "programmee" || p.statut === "publiee" || (p.statut === "brouillon" && p.date >= instant) || occupeBuffer(p)));
  const dejaEnvoyees = new Set(envoyees.map((p) => p.varianteId!));
  const retenues = versionsAProgrammer(programmables, { formatId: options.formatId, dejaEnvoyees });
  const formatRetenu = retenues[0]?.formatId;
  const autres = programmables.filter((v) => v.etatCase === "en-video" && !!v.videoId && !dejaEnvoyees.has(v.id) && v.formatId !== formatRetenu);
  const [ordre, heures] = await Promise.all([lireParametre<string[]>("publication.ordreParDefaut", []), lireParametre<Partial<Record<ReseauDeclinaison, string>>>("publication.heureParReseau", {})]);
  return {
    formatId: formatRetenu,
    creneaux: planProgrammation(options.jourJ ?? jourJParDefaut(), retenues, ordreValide(ordre), heures),
    autresFormats: autres.length,
    envoiSimule: await fournisseurSimule("publication"),
    modeBuffer: await lireModeBuffer(),
  };
}

export interface ResultatProgrammation {
  simulation: boolean;
  /** Lot R1 : les envois réels sont partis en brouillon dans Buffer (Will les programme dans Buffer). */
  modeBuffer?: ModeEnvoiPublication;
  /** Lot R1b : `compte`, le compte Buffer visé quand le réseau en a plusieurs (deux comptes = deux lignes). */
  programmees: { code: string; reseau: ReseauDeclinaison; date: string; publicationId: Id; compte?: string }[];
  /** Versions non envoyées, avec la raison (ex. « Avant de publier » non coché). */
  ignorees: { code: string; reseau: ReseauDeclinaison; message: string }[];
}

/** « Programmer les N » : un envoi par version, sur SON réseau, à la date du créneau (un toucher pour confirmer). */
export async function programmerSujet(scriptMaitreId: Id, options: { formatId?: string; jourJ?: string } = {}): Promise<ResultatProgrammation> {
  await exigerSession();
  const plan = await planProgrammerSujet(scriptMaitreId, options);
  const r: ResultatProgrammation = { simulation: plan.envoiSimule, modeBuffer: plan.envoiSimule ? undefined : plan.modeBuffer, programmees: [], ignorees: [] };
  for (const c of plan.creneaux) {
    try {
      // Même garde que la feuille Buffer : un fichier trop long ou sans le bon format d'image ne part pas.
      const bloquant = (await obtenirKit(c.videoId))?.reseaux.find((x) => x.reseau === c.reseau)?.avertissements.find((a) => a.code === "trop-longue" || a.code === "ratio-absent");
      if (bloquant) throw new ErreurStudio("RESEAU", bloquant.message);
      // Lot R1b : sans comptes cochés, le compte mémorisé du réseau (dernier choix de Will) ; aucun pour un réseau à
      // plusieurs comptes → ce réseau est mis de côté (« choisissez le compte LinkedIn une première fois »).
      const envoi = await envoyerVersBuffer(c.videoId, [c.reseau], c.date);
      // Lot R1 : seul un envoi que Buffer a confirmé compte comme programmé ; « à vérifier » est dit, à part.
      const confirmees = envoi.simulation ? envoi.publications : envoi.publications.filter((p) => p.etatEnvoi === "envoye");
      r.simulation = r.simulation || envoi.simulation;
      for (const pub of confirmees) r.programmees.push({ code: c.code, reseau: c.reseau, date: c.date, publicationId: pub.id, ...(pub.canalNom ? { compte: pub.canalNom } : {}) });
      for (const pb of envoi.problemes ?? []) r.ignorees.push({ code: c.code, reseau: c.reseau, message: pb.message });
      if (!confirmees.length && !envoi.problemes?.length) throw new ErreurStudio(envoi.publications.length ? "A_VERIFIER" : "RESEAU", envoi.publications.length ? "L'envoi est à vérifier dans Buffer." : "Ce réseau n'est pas disponible pour cette vidéo.");
    } catch (e) {
      r.ignorees.push({ code: c.code, reseau: c.reseau, message: e instanceof ErreurStudio ? e.message : "Impossible pour l'instant." });
    }
  }
  return r;
}
