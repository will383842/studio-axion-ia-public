/** ATELIER DE SCRIPTS (B.8 #11, #12 ; AV2.1 « Écrire »). */
import "server-only";
import type { Adresse, BlocScript, Id, NoteScript, Script, VarianteReseau } from "@/domaine/types";
import { avisMalgreVoyant, patchTraceVoyant, CLE_VARIANTE_ORIGINE, demandeConfirmationVoyant } from "@/domaine/voyant-rouge";
import { empreinteDesBlocs } from "@/domaine/relecture-assistant";
import { adresseDepuisFacon } from "@/domaine/adresse";
import { compterMots, texteScript } from "@/domaine/derivations";
import { debitLecture, dureeParDefaut, obtenirFormat, scriptAJour } from "@/formats";
import type { ConsigneAmelioration, ScriptGenere } from "@/fournisseurs";
import { nouvelId } from "@/lib/ids";
import { contient } from "@/lib/textes";
import { depots, fournisseur, ecrireParametre, ErreurStudio, filtreExemples, horodatage, lireParametre, maintenant } from "./_commun";
import { exigerSession } from "./auth";
import { assemblerBlocs } from "@/domaine/derivations-generateur";
import { claudeBranche } from "./generation-claude";
import { reporterCorps } from "./generateur";
import { MESSAGE_TEXTE_TROP_LONG, TEXTE_MAX_CARACTERES } from "@/assistant/express/texte-colle";

/**
 * Correcteur 3 (B1, B10 de l'audit B) : les ANCIENNES méthodes du fournisseur (`generer`, `noter`, `ameliorerBloc`)
 * restent simulées même quand Claude est relié (`fournisseurs/claude/inscription.ts`). Elles ne servent donc plus qu'en
 * ESSAI : Claude relié, elles refusent, et le texte s'écrit par le vrai générateur (« Écrire »).
 */
export const MESSAGE_ECRITURE_REELLE = "Avec Claude relié, le texte s'écrit et se retouche dans « Écrire ».";

async function exigerEssai(): Promise<void> {
  if (await claudeBranche()) throw new ErreurStudio("ECRITURE_REELLE", MESSAGE_ECRITURE_REELLE);
}

export interface FiltresScripts {
  formatId?: string;
  reference?: boolean;
  favori?: boolean;
  q?: string;
}

export async function listerScripts(filtres: FiltresScripts = {}): Promise<(Script & { dureeEstimeeSec: number; apercu: string })[]> {
  const exemples = await filtreExemples<Script>();
  const liste = await depots().scripts.lister(
    (s) =>
      exemples(s) &&
      (!filtres.formatId || s.formatId === filtres.formatId) &&
      (filtres.reference === undefined || s.reference === filtres.reference) &&
      (!filtres.favori || s.favori) &&
      (!filtres.q || contient(s.sujet, filtres.q) || contient(texteScript(s.blocs), filtres.q)),
  );
  liste.sort((a, b) => b.modifieLe.localeCompare(a.modifieLe));
  // Scripts d'une ancienne recette : migrés à la LECTURE (pas de réécriture de masse, B.9 bis).
  return liste.map(scriptAJour).map((s) => {
    const texte = texteScript(s.blocs);
    // TEST-UI-REEL U5 : même calcul que l'écran « Votre vidéo » (débit de lecture, pas celui d'écriture de la recette).
    return { ...s, dureeEstimeeSec: Math.round(compterMots(texte) / debitLecture(obtenirFormat(s.formatId))), apercu: texte.slice(0, 140) };
  });
}

export async function obtenirScript(id: Id): Promise<Script | null> {
  const s = await depots().scripts.obtenir(id);
  return s ? scriptAJour(s) : null;
}

/** Versions d'un script (parent + enfants), pour la comparaison. */
export async function versionsScript(id: Id): Promise<Script[]> {
  const s = await depots().scripts.obtenir(id);
  if (!s) return [];
  const racine = s.parentId ?? s.id;
  return (await depots().scripts.lister((x) => x.id === racine || x.parentId === racine)).sort((a, b) => a.version - b.version).map(scriptAJour);
}

/**
 * Génère N versions (3 par défaut) SANS les enregistrer. Le tu / vous est transmis au générateur (B.0 §15) ;
 * la durée n'est qu'une CIBLE (pour un format « depuis-script », le texte fixe ensuite la durée).
 */
export async function genererScripts(demande: { formatId: string; sujet: string; cible?: string; ton?: string; dureeSec?: number; nombre?: number; adresse?: Adresse }): Promise<ScriptGenere[]> {
  await exigerSession();
  await exigerEssai();
  const format = obtenirFormat(demande.formatId);
  if (!demande.sujet.trim()) throw new ErreurStudio("SUJET_VIDE", "Indiquez un sujet.");
  return (await fournisseur("script")).generer({
    formatId: format.id,
    recette: format.recetteScript,
    sujet: demande.sujet.trim(),
    cible: demande.cible,
    ton: demande.ton,
    dureeSec: demande.dureeSec ?? dureeParDefaut(format),
    nombre: demande.nombre ?? 3,
    adresse: demande.adresse ?? (await adresseDeLaFacon()),
  });
}

/** Adresse par défaut de « Ma façon de parler ». */
async function adresseDeLaFacon(): Promise<Adresse> {
  return adresseDepuisFacon((await lireFaconDeParler()).tutoiement);
}

export async function enregistrerScript(donnees: { formatId: string; sujet: string; blocs: BlocScript[]; notes?: NoteScript; dureeCibleSec?: number; cible?: string; ton?: string; ideeId?: Id; parentId?: Id; adresse?: Adresse }): Promise<Id> {
  await exigerSession();
  const format = obtenirFormat(donnees.formatId);
  const parent = donnees.parentId ? await depots().scripts.obtenir(donnees.parentId) : null;
  const s: Script = {
    id: nouvelId("script"),
    formatId: format.id,
    versionFormat: format.version,
    sujet: donnees.sujet,
    cible: donnees.cible,
    ton: donnees.ton,
    adresse: donnees.adresse ?? (await adresseDeLaFacon()),
    dureeCibleSec: donnees.dureeCibleSec ?? dureeParDefaut(format),
    version: parent ? parent.version + 1 : 1,
    parentId: parent?.id,
    blocs: donnees.blocs,
    notes: donnees.notes,
    favori: false,
    reference: false,
    statutEditorial: "brouillon",
    ideeId: donnees.ideeId,
    marqueId: "marque-axion",
    // Générateur (G1a) : une nouvelle version d'un texte rattaché reste rattachée à son sujet, avec le même « qui parle ».
    ...(parent?.scriptMaitreId ? { scriptMaitreId: parent.scriptMaitreId, mode: parent.mode, versionRecette: parent.versionRecette } : {}),
    ...horodatage(),
  };
  await depots().scripts.enregistrer(s);
  // Nouvelle version d'un corps rattaché : ses versions par réseau passent « milieu modifié, à revoir » (B.2.6).
  if (s.scriptMaitreId) await reporterCorps(s.id);
  if (donnees.ideeId) await depots().idees.modifier(donnees.ideeId, { etat: "en-script", scriptId: s.id });
  return s.id;
}

export async function modifierScript(id: Id, patch: Partial<Pick<Script, "sujet" | "blocs" | "dureeCibleSec" | "cible" | "ton">>): Promise<Script> {
  await exigerSession();
  const s = await depots().scripts.obtenir(id);
  if (!s) throw new ErreurStudio("INTROUVABLE", "Ce script n'existe plus.");
  // Claude relié : pas de note inventée par l'essai (B10) ; l'ancienne ne correspond plus au texte.
  const notes = patch.blocs ? ((await claudeBranche()) ? undefined : await noterScript(patch.blocs, s.formatId, patch.dureeCibleSec ?? s.dureeCibleSec ?? 45, s.adresse)) : s.notes;
  // Des blocs enregistrés le sont dans la recette courante : `versionFormat` suit (B.9 bis).
  return depots().scripts.modifier(id, { ...patch, notes, ...(patch.blocs ? { versionFormat: obtenirFormat(s.formatId).version } : {}) });
}

export async function noterScript(blocs: BlocScript[], formatId: string, dureeCibleSec: number, adresse?: Adresse): Promise<NoteScript> {
  return (await fournisseur("script")).noter(blocs, obtenirFormat(formatId).recetteScript, dureeCibleSec, adresse ?? (await adresseDeLaFacon()));
}

/** Note affichée à l'écran (assistant, fiche script) : en essai seulement (B10). */
export async function noterScriptEssai(formatId: string, blocs: BlocScript[], dureeCibleSec: number, adresse?: Adresse): Promise<NoteScript> {
  await exigerSession();
  await exigerEssai();
  return noterScript(blocs, formatId, dureeCibleSec, adresse);
}

/** « Améliorer ce bloc », « Plus percutant », « Plus court » : en essai seulement (B10). */
export async function ameliorerBloc(formatId: string, bloc: BlocScript, consigne: ConsigneAmelioration, adresse?: Adresse): Promise<BlocScript> {
  await exigerSession();
  await exigerEssai();
  return (await fournisseur("script")).ameliorerBloc(bloc, consigne, obtenirFormat(formatId).recetteScript, adresse ?? (await adresseDeLaFacon()));
}

/** Un texte collé → blocs de la recette du format, sans le réécrire (B.0 §16). */
export async function decouperTexteColle(formatId: string, texte: string): Promise<BlocScript[]> {
  await exigerSession();
  // Relecture paquet 4 (sécurité D1) : même borne que l'import ; un texte démesuré est refusé, jamais coupé en silence.
  if (typeof texte !== "string") throw new ErreurStudio("TEXTE_ILLISIBLE", "Ce texte n'a pas pu être lu.");
  if (texte.length > TEXTE_MAX_CARACTERES) throw new ErreurStudio("TEXTE_TROP_LONG", MESSAGE_TEXTE_TROP_LONG);
  return (await fournisseur("script")).decouper(texte, obtenirFormat(formatId).recetteScript);
}

/**
 * B1 : le texte d'une version écrite par le générateur, pour la vidéo (« Utiliser dans ma vidéo ») : la version
 * COURANTE de ce réseau, ouverture + corps + fin, mot pour mot.
 */
export async function texteDeVersionPourVideo(varianteId: Id): Promise<{ formatId: string; sujet: string; blocs: BlocScript[]; adresse?: Adresse }> {
  await exigerSession();
  const d = depots();
  const v0 = await d.variantes.obtenir(varianteId);
  if (!v0) throw new ErreurStudio("INTROUVABLE", "Cette version n'existe plus.");
  const v = (await d.variantes.lister((x) => x.code === v0.code && !x.archiveLe)).reduce((a, b) => (b.version > a.version ? b : a), v0);
  const script = await d.scripts.obtenir(v.scriptId);
  if (!script) throw new ErreurStudio("INTROUVABLE", "Ce texte n'existe plus.");
  const m = await d.scriptsMaitres.obtenir(v.scriptMaitreId);
  return { formatId: v.formatId, sujet: m?.angle?.titre ?? m?.brief.idee ?? script.sujet, blocs: assemblerBlocs(script, v), adresse: script.adresse };
}

/**
 * Voyant rouge, chemin « Utiliser dans ma vidéo » (assistant) : le texte d'une version du générateur devient celui de la
 * vidéo, puis la voix payante part. Refus doux `VOYANT_ROUGE` (rien créé ni payé) tant que Will n'a pas confirmé.
 * Jamais pour un script collé (aucune version d'origine) ni une version de Will (`origine: "will"`).
 */
export async function exigerSecondOuiVoyantDeVersion(varianteId: Id | undefined, malgreVoyant: boolean, avantQuestion?: () => Promise<void>, o: { texteRetouche?: boolean } = {}): Promise<void> {
  if (!varianteId || malgreVoyant) return;
  const v = await versionLaPlusRecente(varianteId);
  const demande = v && demandeConfirmationVoyant([v], o);
  if (!demande) return;
  // Les refus du lancement (texte non relu, accord, distribution...) passent avant : Will ne dit pas oui pour un refus.
  await avantQuestion?.();
  throw new ErreurStudio("VOYANT_ROUGE", demande.message);
}

/**
 * Même refus que `lancerFabrication` : le texte de la vidéo n'est plus celui que Will a relu (SCRIPT_NON_RELU).
 * À garder IDENTIQUE à fabrication.ts:816 (même lecture du script, même empreinte, même phrase) : sinon la question du voyant
 * serait posée pour un lancement que `lancerFabrication` refuserait ensuite, ou l'inverse.
 */
export async function exigerScriptReluDeLaVideo(videoId: Id, scriptRelu: string | undefined): Promise<void> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  const brut = video?.scriptId ? await d.scripts.obtenir(video.scriptId) : null;
  const script = brut ? scriptAJour(brut) : null;
  if (!scriptRelu || !script || empreinteDesBlocs(script.blocs) !== scriptRelu) throw new ErreurStudio("SCRIPT_NON_RELU", "Le script a changé depuis votre relecture : relisez-le avant de lancer la vidéo.");
}

/**
 * Will a-t-il retouché le texte de la vidéo depuis la version du générateur qui l'a fournie ? Compare le texte actuel de la
 * vidéo à celui que « Utiliser dans ma vidéo » en avait tiré (`assemblerBlocs`). Dans le doute (script introuvable) : non retouché.
 */
export async function texteRetoucheDeLaVideo(videoId: Id, v: VarianteReseau): Promise<boolean> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  const brutVideo = video?.scriptId ? await d.scripts.obtenir(video.scriptId) : null;
  const scriptVersion = await d.scripts.obtenir(v.scriptId);
  if (!brutVideo || !scriptVersion) return false;
  return empreinteDesBlocs(scriptAJour(brutVideo).blocs) !== empreinteDesBlocs(assemblerBlocs(scriptAJour(scriptVersion), v));
}

/** La version d'origine du texte d'une vidéo, lue dans la vidéo elle-même (jamais sur la foi de l'écran). */
export async function varianteOrigineDeLaVideo(videoId: Id): Promise<Id | undefined> {
  const id = (await depots().videos.obtenir(videoId))?.entrees?.[CLE_VARIANTE_ORIGINE];
  return typeof id === "string" && id ? id : undefined;
}

/** Un travail est déjà en cours ou en file pour cette vidéo (`lancerFabrication` le rend tel quel, sans rien dépenser). */
export async function travailDejaParti(videoId: Id): Promise<boolean> {
  return !!(await depots().travaux.trouver((t) => t.cibleId === videoId && (t.statut === "en_cours" || t.statut === "en_file")));
}

/** La version la plus récente (non archivée) du même code que `varianteId`. */
export async function versionLaPlusRecente(varianteId: Id) {
  const d = depots();
  const v0 = await d.variantes.obtenir(varianteId);
  if (!v0) return null;
  return (await d.variantes.lister((x) => x.code === v0.code && !x.archiveLe)).reduce((a, b) => (b.version > a.version ? b : a), v0);
}

/**
 * Voyant rouge, chemin « Utiliser dans ma vidéo » : le oui de Will est GARDÉ sur la version (`avisWill.malgreVoyant`),
 * comme sur le chemin « relire puis lancer ». À appeler APRÈS le départ de la fabrication : un refus plus haut ne
 * laisse aucune trace. Sans effet si la version n'est pas rouge.
 */
export async function garderOuiVoyantDeVersion(varianteId: Id, o: { texteRetouche?: boolean } = {}): Promise<void> {
  const v = await versionLaPlusRecente(varianteId);
  if (!v || !demandeConfirmationVoyant([v], o)) return;
  const le = maintenant();
  await depots().variantes.modifier(v.id, patchTraceVoyant(v, avisMalgreVoyant(v, le, o)) as Partial<typeof v>);
}

export async function validerScript(id: Id): Promise<void> {
  await exigerSession();
  const s = await depots().scripts.obtenir(id);
  // Un texte rattaché à un sujet se valide version par version : son statut est calculé (B.2.5).
  if (s?.scriptMaitreId) throw new ErreurStudio("RATTACHE", "Ce texte se valide version par version, depuis son sujet.");
  await depots().scripts.modifier(id, { statutEditorial: "valide" });
}

export async function basculerFavori(id: Id): Promise<void> {
  await exigerSession();
  const s = await depots().scripts.obtenir(id);
  if (s) await depots().scripts.modifier(id, { favori: !s.favori });
}

export async function basculerReference(id: Id): Promise<void> {
  await exigerSession();
  const s = await depots().scripts.obtenir(id);
  if (s) await depots().scripts.modifier(id, { reference: !s.reference });
}

/* --- « Ma façon de parler » (préparation du futur générateur) ----- */
export interface FaconDeParler {
  expressions: string[];
  motsInterdits: string[];
  tutoiement: boolean;
  notes: string;
}

const FACON_PAR_DEFAUT: FaconDeParler = {
  expressions: ["Concrètement", "Retenez une chose", "On commence petit"],
  motsInterdits: ["révolutionnaire", "game changer", "disruptif"],
  tutoiement: false,
  notes: "",
};

export async function lireFaconDeParler(): Promise<FaconDeParler> {
  return lireParametre("style.faconDeParler", FACON_PAR_DEFAUT);
}

export async function enregistrerFaconDeParler(f: FaconDeParler): Promise<void> {
  await exigerSession();
  await ecrireParametre("style.faconDeParler", f);
}
