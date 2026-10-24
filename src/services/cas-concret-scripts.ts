/**
 * SCRIPTS VALIDÉS DU « CAS CONCRET MD » (tâche V4-3, points 5 et 6).
 *
 * - `scriptValideDuStudio(casId)` : le script que Will a validé depuis le studio (réglage `casConcret.scriptsValides`),
 *   sinon celui du catalogue ; `null` : aucun, Claude écrit (et la fabrication s'arrêtera sur « à valider »).
 * - `apercuScriptCasConcret(videoId)` : AVANT de payer la voix, le texte dit et l'ordre des écrans du script de la vidéo
 *   (écrit, puis relu), et s'il attend la validation de Will.
 * - `validerScriptCasConcret(videoId)` : « Valider ce script » : le script qui attend devient le script validé du cas
 *   (même mécanisme que le catalogue) ; la fabrication reprend avec « Réessayer », sans nouvel appel d'écriture.
 *
 * - Brique 3 (relire le script, demande de Will) : un script DÉJÀ validé se relit et se modifie avant le lancement
 *   (`modifierScriptValideCasConcret`). Toute modification, comme toute validation, crée une NOUVELLE version validée
 *   (numéro suivant, gardée à l'historique `casConcret.scriptsValidesHistorique`) : aucune version n'est jamais réécrite,
 *   et le script du catalogue (« recrutement-apporteurs ») reste tel quel dans le code. La fabrication lit la dernière.
 *   `refusScriptRelu` : au lancement, l'empreinte du texte relu doit être celle de la version qui va être fabriquée.
 *
 * Ne publie rien, ne dépense rien. Aucune exception jusqu'à l'écran pour l'aperçu (au moindre doute : `null`).
 */
import "server-only";
import { VERSION_CHARTE_DUO } from "@/briques/habillage/charte-duo";
import { empreinte, type PastilleControle } from "@/domaine/relecture-script";
import type { Id, Travail } from "@/domaine/types";
import type { CasConcret } from "@/formats/cas-concret/cas";
import { trouverCasConnu } from "./cas-concret-stock-acces";
import { ID_MOTEUR_CAS_CONCRET } from "@/moteurs/montage-cas-concret";
import { apercuDesEcrans, blocsScriptDesEcrans, CODE_SCRIPT_A_VALIDER, ficheDuScriptValide, lireScriptValide, problemesScriptValide, scriptDeFiche, scriptValideDuCatalogue, SCRIPTS_VALIDES_CATALOGUE, type EcranApercu, type ScriptValide } from "@/moteurs/montage-cas-concret/script-valide";
import { lignesDesEcrans } from "@/moteurs/montage-cas-concret/relecture";
import { texteDuCorps, type FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import { appliquerModifications, type ModificationEcran } from "@/moteurs/montage-cas-concret/modifier-script";
import { validerFicheEcrans } from "@/moteurs/montage-cas-concret/regles";
import { avertissementsCorrespondance } from "@/moteurs/montage-cas-concret/correspondance";

export type { EcranApercu } from "@/moteurs/montage-cas-concret/script-valide";
import { creerVerrou, depots, ecrireParametre, ErreurStudio, journaliser, lireParametre } from "./_commun";
import { exigerSession } from "./auth";

/** UN seul verrou pour toute écriture d'une nouvelle version de script validé (validation, modification, script fourni). */
export const verrouScripts = creerVerrou();

export const CLE_SCRIPTS_VALIDES = "casConcret.scriptsValides";
/** Toutes les versions validées de chaque cas, dans l'ordre (jamais réécrites, jamais effacées). */
export const CLE_HISTORIQUE_SCRIPTS = "casConcret.scriptsValidesHistorique";

/** Scripts validés depuis le studio, par cas (forme lue avec tolérance). */
type ScriptsGardes = Record<string, unknown>;

/** Le script validé d'un cas : celui validé depuis le studio, sinon celui du catalogue ; `null` : aucun. */
export async function scriptValideDuStudio(casId: string): Promise<ScriptValide | null> {
  const gardes = await lireParametre<ScriptsGardes>(CLE_SCRIPTS_VALIDES, {});
  return lireScriptValide(gardes?.[casId]) ?? scriptValideDuCatalogue(casId) ?? null;
}

/* ------------------------------------------------------------------ */
/* Aperçu (PUR)                                                          */
/* ------------------------------------------------------------------ */

export interface ApercuScriptCasConcret {
  /** `a-valider` : écrit par Claude, relu, il attend Will ; `valide` : script validé (catalogue ou studio) ; `ecrit` : autre. */
  etat: "a-valider" | "valide" | "ecrit";
  casId: string;
  texteDit: string;
  ecrans: EcranApercu[];
  /**
   * L0c (15/10) : là où l'image ne suit pas la parole (case de liste sur un autre mot, tâche dite sans case, étape qui ne
   * reprend rien de ce qui est dit), en phrases, écran par écran (`rang`). AVERTISSEMENT seulement : jamais bloquant.
   */
  avertissements: { rang: number; detail: string }[];
}

const objet = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** La fiche écrite (ou rejouée) gardée au journal du travail ; `null` si absente ou illisible. */
export function ficheDuTravail(travail: Pick<Travail, "parametres"> | null): FicheEcrans | null {
  const journal = objet(objet(travail?.parametres?.casConcret)?.journal);
  const fiche = objet(objet(objet(objet(journal?.etapes)?.ecriture)?.sortie)?.fiche);
  if (!fiche || typeof fiche.casId !== "string" || !Array.isArray(fiche.ecrans) || !fiche.ecrans.every((e) => typeof objet(e)?.texteDit === "string")) return null;
  return fiche as unknown as FicheEcrans;
}

/** Le travail attend-il la validation du script ? */
export const attendValidation = (travail: Pick<Travail, "statut" | "erreur" | "etapes"> | null): boolean =>
  !!travail && travail.statut === "echec" && (travail.erreur?.code ?? travail.etapes.find((e) => e.statut === "echec")?.erreur?.code) === CODE_SCRIPT_A_VALIDER;

/** L'aperçu d'un travail (PUR) : écrans dans l'ordre, texte dit, état. */
export function apercuDuTravail(travail: (Pick<Travail, "statut" | "erreur" | "etapes" | "parametres">) | null): ApercuScriptCasConcret | null {
  const fiche = ficheDuTravail(travail);
  if (!fiche) return null;
  const valide = !!objet(objet(objet(objet(objet(objet(travail?.parametres?.casConcret)?.journal)?.etapes)?.ecriture)?.sortie))?.scriptValide;
  return {
    etat: attendValidation(travail) ? "a-valider" : valide ? "valide" : "ecrit",
    casId: fiche.casId,
    texteDit: fiche.ecrans.map((e) => e.texteDit.trim()).join(" "),
    ecrans: apercuDesEcrans(fiche.ecrans),
    avertissements: avertissementsCorrespondance(fiche.ecrans).map((a) => ({ rang: fiche.ecrans.findIndex((e) => e.id === a.ecranId) + 1, detail: a.detail })),
  };
}

/* ------------------------------------------------------------------ */
/* Mémoire anti-copie (18/10)                                            */
/* ------------------------------------------------------------------ */

/** Versions de vidéos relues au plus pour la mémoire (les plus récentes) : borne le travail, pas le sens. */
export const VERSIONS_MEMOIRE_MAX = 60;

/**
 * Le texte dit de TOUS les scripts déjà écrits ou validés du format cas concret, du plus ancien au plus récent : scripts du
 * catalogue (code), versions validées depuis le studio (`casConcret.scriptsValides` et son historique), scripts des vidéos
 * non supprimées (un script refusé par Will y est encore : « Faire réécrire » ne le répète donc pas). `sauf` : la vidéo qui
 * s'écrit (sa propre reprise n'est pas une copie). Sans doublon. Mémoire de l'écriture : ne lève jamais.
 */
export async function scriptsDejaEcrits(sauf?: Id): Promise<string[]> {
  return (await scriptsDejaEcritsDates(sauf)).map((x) => x.texte);
}

/** Comme `scriptsDejaEcrits`, avec la date de chaque script (ISO ou AAAA-MM-JJ ; vide si la source n'en donne pas) : la mémoire commune en a besoin pour trier. */
export async function scriptsDejaEcritsDates(sauf?: Id): Promise<{ texte: string; date: string }[]> {
  const res: { texte: string; date: string }[] = [];
  const ajouter = (ecrans: readonly { texteDit: string }[] | undefined, date: string | undefined) => {
    const t = (ecrans ?? []).map((e) => e.texteDit.trim()).join(" ");
    if (t && !res.some((x) => x.texte === t)) res.push({ texte: t, date: date ?? "" });
  };
  try {
    for (const script of Object.values(SCRIPTS_VALIDES_CATALOGUE)) ajouter(script.ecrans, script.valideLe);
    const historiques = await lireParametre<Record<string, unknown>>(CLE_HISTORIQUE_SCRIPTS, {});
    for (const liste of Object.values(historiques ?? {})) for (const x of Array.isArray(liste) ? liste : []) { const v = lireScriptValide(x); ajouter(v?.ecrans, v?.valideLe); }
    const gardes = await lireParametre<ScriptsGardes>(CLE_SCRIPTS_VALIDES, {});
    for (const x of Object.values(gardes ?? {})) { const v = lireScriptValide(x); ajouter(v?.ecrans, v?.valideLe); }
    const d = depots();
    const versions = (await d.versions.lister((v) => v.videoId !== sauf && v.commande?.moteurId === ID_MOTEUR_CAS_CONCRET && !!v.travailId))
      .sort((a, b) => String(a.creeLe).localeCompare(String(b.creeLe)))
      .slice(-VERSIONS_MEMOIRE_MAX);
    for (const v of versions) ajouter(ficheDuTravail((await d.travaux.obtenir(v.travailId!)) ?? null)?.ecrans, String(v.creeLe ?? ""));
  } catch {
    // Mémoire incomplète : l'écriture se fait avec ce qui a pu être lu.
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Lecture et validation                                                 */
/* ------------------------------------------------------------------ */

async function travailDeLaVideo(videoId: Id): Promise<Travail | null> {
  const d = depots();
  const versions = await d.versions.lister((v) => v.videoId === videoId && v.commande?.moteurId === ID_MOTEUR_CAS_CONCRET);
  const derniere = versions.sort((a, b) => b.numero - a.numero)[0];
  return derniere?.travailId ? ((await d.travaux.obtenir(derniere.travailId)) ?? null) : null;
}

/** L'aperçu du script de la dernière version d'une vidéo « Cas concret MD » ; `null` sans script. Jamais d'exception. */
export async function apercuScriptCasConcret(videoId: Id): Promise<ApercuScriptCasConcret | null> {
  await exigerSession();
  try {
    return apercuDuTravail(await travailDeLaVideo(videoId));
  } catch {
    return null;
  }
}

/**
 * « Valider ce script » : le script qui attend (écrit par Claude, relu) devient le script validé de son cas, pour la
 * version courante du cas. Refus en phrase si aucun script n'attend. « Réessayer » fabrique ensuite la vidéo avec lui.
 */
export async function validerScriptCasConcret(videoId: Id, dependances: { maintenant?: number; modifications?: readonly ModificationEcran[] } = {}): Promise<{ casId: string; valideLe: string; modifie: boolean }> {
  await exigerSession();
  const travail = await travailDeLaVideo(videoId);
  const ecrite = ficheDuTravail(travail);
  if (!travail || !ecrite || !attendValidation(travail)) throw new ErreurStudio("SCRIPT_PAS_A_VALIDER", "Aucun script n'attend votre validation pour cette vidéo.");
  const cas = await trouverCasConnu(ecrite.casId);
  if (!cas) throw new ErreurStudio("CAS_INCONNU", "Ce cas n'existe plus.");
  // Demande de Will (14/10) : le script se modifie avant d'être validé. La fiche modifiée repasse TOUS les contrôles
  // (schéma, règles, faits du cas, interdits de Will) ; un refus est dit en phrases et rien n'est gardé.
  const modifications = utiles(dependances.modifications);
  let fiche: FicheEcrans = ecrite;
  if (modifications.length) {
    const c = await controlerModifications(ecrite, modifications, cas);
    if (!c.ok) throw new ErreurStudio("SCRIPT_MODIFIE_REFUSE", c.message);
    fiche = c.fiche;
  }
  const valideLe = new Date(dependances.maintenant ?? Date.now()).toISOString().slice(0, 10);
  await verrouScripts(() => garderNouvelleVersion(cas, scriptDeFiche(fiche, { versionCas: cas.version, valideLe, source: `Vidéo ${videoId} : script écrit, relu, puis validé par Will.`, videoId })));
  // L0a (15/10) : le script de la vidéo (onglet Script) devient le texte validé, écran par écran (plus la trame).
  const { enregistrerScriptDuBrouillon } = await import("./videos");
  await enregistrerScriptDuBrouillon(videoId, blocsScriptDesEcrans(fiche.ecrans, videoId));
  await journaliser("cas-concret", `Script ${modifications.length ? "modifié puis " : ""}validé : ${cas.titre}`, { type: "video", id: videoId });
  return { casId: cas.id, valideLe, modifie: modifications.length > 0 };
}

/* ------------------------------------------------------------------ */
/* Brique 3 : relire et modifier le script, versions validées            */
/* ------------------------------------------------------------------ */

/** Les seules modifications qui changent quelque chose. */
const utiles = (modifications: readonly ModificationEcran[] | undefined): ModificationEcran[] => modifications?.filter((m) => m.texteDit !== undefined || m.ecrits?.some((x) => x !== null)) ?? [];

type Controle = { ok: true; fiche: FicheEcrans } | { ok: false; message: string; problemes: { ligneId?: string; texte: string }[] };

/** Applique les modifications de Will puis repasse TOUS les contrôles (schéma, règles, faits du cas, interdits de Will). */
/** Les mots interdits de Will (jargon et promesses interdites de la marque la plus récente), tels que la fabrication les rejoue. */
export async function motsInterditsDeWill(): Promise<string[]> {
  const marque = (await depots().contexteAxion.lister()).sort((x, y) => y.version - x.version)[0];
  return [...(marque?.jargonInterdit ?? []), ...(marque?.promessesInterdites ?? [])].filter((x): x is string => typeof x === "string" && !!x.trim());
}

async function controlerModifications(fiche: FicheEcrans, modifications: readonly ModificationEcran[], cas: CasConcret): Promise<Controle> {
  const a = appliquerModifications(fiche, modifications);
  if (!a.ok) return { ok: false, message: a.raisons.join(" "), problemes: a.raisons.map((texte) => ({ texte })) };
  const motsInterdits = await motsInterditsDeWill();
  const v = validerFicheEcrans(a.fiche, { cas, texteScript: texteDuCorps(a.fiche), motsInterdits });
  if (!v.ok) return { ok: false, message: `Le script modifié ne passe pas les contrôles : ${v.problemes.map((p) => p.message).join(" ")}`, problemes: v.problemes.map((p) => ({ ...(p.sceneId ? { ligneId: p.sceneId } : {}), texte: p.message })) };
  return { ok: true, fiche: v.fiche };
}

/** Les pastilles de l'écran commun : chaque refus bloque (même règle que la validation). */
function pastillesDe(c: Controle): PastilleControle[] {
  return c.ok ? [] : c.problemes.map((p) => ({ niveau: "bloquant" as const, texte: p.texte, ...(p.ligneId ? { ligneId: p.ligneId } : {}) }));
}

/** Les lignes de relecture d'un script validé (celles que montre l'écran commun). PUR. */
export const lignesDuScriptValide = (script: Pick<ScriptValide, "ecrans">) => lignesDesEcrans(apercuDesEcrans(script.ecrans));

/** L'empreinte du texte d'un script validé, telle que l'écran la calcule sur les lignes relues. PUR. */
export const empreinteScriptValide = (script: Pick<ScriptValide, "ecrans">): string => empreinte(lignesDuScriptValide(script));

/** Le numéro d'une version validée (le catalogue et les validations d'avant l'historique : 1). */
const numeroDe = (s: ScriptValide | null | undefined): number => s?.numero ?? 1;

/**
 * Garde une NOUVELLE version validée : numéro suivant, ajoutée à l'historique (la précédente y est déjà, ou y entre
 * d'abord), puis désignée comme celle du cas. Rien n'est réécrit : ni une version gardée, ni le script du catalogue.
 */
export async function garderNouvelleVersion(cas: Pick<CasConcret, "id">, script: ScriptValide): Promise<ScriptValide> {
  const gardes = await lireParametre<ScriptsGardes>(CLE_SCRIPTS_VALIDES, {});
  const precedente = lireScriptValide(gardes?.[cas.id]) ?? scriptValideDuCatalogue(cas.id) ?? null;
  const historiques = await lireParametre<Record<string, unknown>>(CLE_HISTORIQUE_SCRIPTS, {});
  const liste = (Array.isArray(historiques?.[cas.id]) ? (historiques[cas.id] as unknown[]) : []).map(lireScriptValide).filter((x): x is ScriptValide => !!x);
  const anciennes = precedente && !liste.some((x) => numeroDe(x) === numeroDe(precedente)) ? [...liste, { ...structuredClone(precedente), numero: numeroDe(precedente) }] : liste;
  const numero = Math.max(precedente ? numeroDe(precedente) : 0, ...anciennes.map(numeroDe)) + 1;
  const nouvelle: ScriptValide = { ...script, numero, ...(precedente ? { remplace: numeroDe(precedente) } : {}) };
  await ecrireParametre(CLE_HISTORIQUE_SCRIPTS, { ...historiques, [cas.id]: [...anciennes, nouvelle] });
  await ecrireParametre(CLE_SCRIPTS_VALIDES, { ...gardes, [cas.id]: nouvelle });
  return nouvelle;
}

/**
 * LOT F · la dernière version validée qui vient de CETTE vidéo (« Valider ce script » de son script écrit) ; `null` :
 * aucune. Une version modifiée à la relecture n'a pas de vidéo d'origine : elle n'est jamais celle d'une vidéo.
 */
export async function scriptValideDeLaVideo(casId: string, videoId: string): Promise<ScriptValide | null> {
  return (await historiqueScriptsValides(casId)).filter((s) => s.videoId === videoId).at(-1) ?? null;
}

/** Les versions validées d'un cas, dans l'ordre (la dernière est celle qui sera fabriquée). */
export async function historiqueScriptsValides(casId: string): Promise<ScriptValide[]> {
  const historiques = await lireParametre<Record<string, unknown>>(CLE_HISTORIQUE_SCRIPTS, {});
  return (Array.isArray(historiques?.[casId]) ? (historiques[casId] as unknown[]) : []).map(lireScriptValide).filter((x): x is ScriptValide => !!x);
}

/** Le script validé utilisable pour la version courante du cas ; `null` : aucun (Claude écrira, Will validera). */
export async function scriptValideCourant(cas: CasConcret): Promise<ScriptValide | null> {
  const s = await scriptValideDuStudio(cas.id);
  return s && !problemesScriptValide(s, cas).length ? s : null;
}

/** La fiche d'un script validé, pour lui appliquer les modifications (l'en-tête n'est pas gardé). */
const ficheARelire = (script: ScriptValide, cas: CasConcret): FicheEcrans => ficheDuScriptValide(script, { videoId: "relecture", versionId: "relecture", habillage: VERSION_CHARTE_DUO, origine: "porte-a" }, cas);

/** Contrôle GRATUIT des modifications d'un script validé, pendant la relecture (aucune écriture, aucun appel payant). */
export async function controlerScriptValideCasConcret(casId: string, modifications: readonly ModificationEcran[]): Promise<PastilleControle[]> {
  await exigerSession();
  const cas = await trouverCasConnu(casId);
  if (!cas) return [{ niveau: "bloquant", texte: "Ce cas n'existe plus." }];
  const script = await scriptValideCourant(cas);
  if (!script) return [{ niveau: "bloquant", texte: "Ce cas n'a pas de script validé à relire." }];
  const m = utiles(modifications);
  return m.length ? pastillesDe(await controlerModifications(ficheARelire(script, cas), m, cas)) : [];
}

/** Contrôle GRATUIT des modifications du script qui attend la validation de Will (fiche vidéo). */
export async function controlerScriptAValiderCasConcret(videoId: Id, modifications: readonly ModificationEcran[]): Promise<PastilleControle[]> {
  await exigerSession();
  const travail = await travailDeLaVideo(videoId);
  const ecrite = ficheDuTravail(travail);
  const cas = ecrite ? await trouverCasConnu(ecrite.casId) : undefined;
  if (!ecrite || !cas || !attendValidation(travail)) return [{ niveau: "bloquant", texte: "Aucun script n'attend votre validation pour cette vidéo." }];
  const m = utiles(modifications);
  return m.length ? pastillesDe(await controlerModifications(ecrite, m, cas)) : [];
}

/**
 * Will modifie le script DÉJÀ validé d'un cas, avant le lancement : la version modifiée repasse tous les contrôles, puis
 * devient une NOUVELLE version validée (pour la version courante du cas), sans toucher à la précédente. Sans changement
 * réel (même texte que la dernière version), rien n'est créé. Rend l'empreinte du texte gardé (celle du lancement).
 */
export async function modifierScriptValideCasConcret(casId: string, modifications: readonly ModificationEcran[], dependances: { maintenant?: number } = {}): Promise<{ casId: string; numero: number; empreinte: string; modifie: boolean }> {
  await exigerSession();
  const cas = await trouverCasConnu(casId);
  if (!cas) throw new ErreurStudio("CAS_INCONNU", "Ce cas n'existe plus.");
  const actuel = await scriptValideCourant(cas);
  if (!actuel) throw new ErreurStudio("SCRIPT_PAS_VALIDE", "Ce cas n'a pas de script validé à modifier.");
  const m = utiles(modifications);
  const avant = empreinteScriptValide(actuel);
  if (!m.length) return { casId: cas.id, numero: numeroDe(actuel), empreinte: avant, modifie: false };
  const c = await controlerModifications(ficheARelire(actuel, cas), m, cas);
  if (!c.ok) throw new ErreurStudio("SCRIPT_MODIFIE_REFUSE", c.message);
  const valideLe = new Date(dependances.maintenant ?? Date.now()).toISOString().slice(0, 10);
  const candidat = scriptDeFiche(c.fiche, { versionCas: cas.version, valideLe, source: `Modifié par Will avant le lancement (remplace la version ${numeroDe(actuel)}).`, ...(actuel.fourni ? { fourni: true as const } : {}) });
  const apres = empreinteScriptValide(candidat);
  if (apres === avant) return { casId: cas.id, numero: numeroDe(actuel), empreinte: avant, modifie: false };
  const nouvelle = await verrouScripts(() => garderNouvelleVersion(cas, candidat));
  await journaliser("cas-concret", `Script modifié (version ${nouvelle.numero}) : ${cas.titre}`);
  return { casId: cas.id, numero: nouvelle.numero!, empreinte: apres, modifie: true };
}

/** Phrases du repère « script relu » au lancement. */
export const PHRASE_SCRIPT_NON_RELU = "Relisez le script avant de lancer la vidéo. Rien n'a été payé.";
export const PHRASE_SCRIPT_CHANGE = "Le script a changé depuis votre relecture : relisez-le, puis relancez. Rien n'a été payé.";

/**
 * Au lancement par Will : un cas qui a un script validé ne part qu'avec l'empreinte du texte relu, égale à celle de la
 * version qui va être fabriquée. `null` : rien ne s'y oppose (sans script validé, la fabrication s'arrêtera avant la voix
 * pour que Will le valide). Les relances reprennent la commande telle quelle (repère compris) : elles ne passent pas ici.
 */
export async function refusScriptRelu(cas: CasConcret, empreinteRecue: string | undefined | null): Promise<string | null> {
  const script = await scriptValideCourant(cas);
  if (!script) return null;
  if (!empreinteRecue) return PHRASE_SCRIPT_NON_RELU;
  return empreinteScriptValide(script) === empreinteRecue ? null : PHRASE_SCRIPT_CHANGE;
}
