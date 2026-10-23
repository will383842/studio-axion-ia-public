/**
 * MÉMOIRE D'ÉCRITURE COMMUNE, CÔTÉ STUDIO (lot C1.4). BRANCHÉE derrière les réglages `ecriture.memoireCentrale`, `ecriture.memoireTableau` et `ecriture.memoireCasConcret`, éteints par défaut.
 * Lit les scripts déjà écrits de tous les formats (UNE fenêtre de `FENETRE_VERSIONS_MEMOIRE` versions, les plus récentes,
 * partagée entre générateurs) et garde les tirages de formes (`ecriture.tiragesCommuns`, 200 lignes) pour que
 * `tirerSansRecent` évite les récents sur tous les formats à la fois. Ne dépense rien, n'appelle aucun fournisseur ;
 * une lecture illisible vaut « rien » (jamais d'exception vers l'écriture). Modèle : `cas-concret-variete.ts` (service).
 * Sources : scripts du cas concret (`scriptsDejaEcritsDates`), traces du tableau livrées, variantes non archivées hors avocat (version
 * courante de chaque code : ouverture + fin). TODO C4 : image → vidéo (module à lire côté image-video, hors de ce lot).
 */
import "server-only";
import { anonymiserPourMemoire, blocMemoire, FENETRE_VERSIONS_MEMOIRE, memoireAntiCopie, type OptionsVariete, type Sequence } from "@/domaine/ecriture-commune/memoire";
import { FORMATS_HORS_CONTRAT } from "@/domaine/ecriture-commune/contrat-format";
import { formesDuRole, tirerForme, type Forme, type RoleForme } from "@/domaine/ecriture-commune/banque-formes";
import { listerFormats } from "@/formats";
import { nomsDuSocle } from "@/generateur/contexte";
import { texteDitDe } from "@/domaine/scripts-tableau-controles";
import type { Id, ReseauDeclinaison } from "@/domaine/types";
import { depots, ecrireParametre, lireParametre } from "./_commun";

export const CLE_TIRAGES_COMMUNS = "ecriture.tiragesCommuns";
/** Lignes gardées au plus dans les tirages communs. */
export const TIRAGES_COMMUNS_MAX = 200;

export const CLE_SCRIPTS_CENTRAUX = "ecriture.scriptsCentraux";

/** Un script de l'écriture centrale, accepté (lot C3) : son texte dit en entier, et les codes des appels de fin imposés. */
export interface ScriptCentral {
  texte: string;
  date: string;
  formatId: string;
  appels?: string[];
}

const estScriptCentral = (x: unknown): x is ScriptCentral => !!x && typeof x === "object" && typeof (x as ScriptCentral).texte === "string" && !!(x as ScriptCentral).texte.trim();

/** Les scripts centraux enregistrés (60 au plus, du plus ancien au plus récent) ; illisible : vide. */
export async function scriptsCentraux(): Promise<ScriptCentral[]> {
  try {
    const v = await lireParametre<unknown>(CLE_SCRIPTS_CENTRAUX, []);
    return (Array.isArray(v) ? v.filter(estScriptCentral) : []).filter((x) => !FORMATS_HORS_CONTRAT.includes(x.formatId)).slice(-FENETRE_VERSIONS_MEMOIRE);
  } catch {
    return [];
  }
}

/** Range un script central accepté (fenêtre de 60). Lève si la base refuse : l'appelant décide (le service C3 se tait). */
export async function noterScriptCentral(x: Omit<ScriptCentral, "date"> & { date?: string }): Promise<void> {
  const liste = await scriptsCentraux();
  liste.push({ texte: x.texte, date: x.date ?? new Date().toISOString(), formatId: x.formatId, ...(x.appels?.length ? { appels: x.appels } : {}) });
  await ecrireParametre(CLE_SCRIPTS_CENTRAUX, liste.slice(-FENETRE_VERSIONS_MEMOIRE));
}

export interface EntreeMemoire {
  texte: string;
  /** ISO ; vide quand la source ne date pas ses scripts (rangés avant les datés). */
  date: string;
  formatId: string;
}

const texteDeBlocs = (blocs: unknown): string => {
  if (!Array.isArray(blocs)) return "";
  return blocs
    .flatMap((b) => (b && typeof b === "object" && Array.isArray((b as { segments?: unknown }).segments) ? ((b as { segments: { texte?: unknown }[] }).segments) : []))
    .map((s) => (typeof s?.texte === "string" ? s.texte.trim() : ""))
    .filter(Boolean)
    .join(" ");
};

/**
 * Les scripts déjà écrits de tous les formats, du plus ancien au plus récent, sans doublon, au plus
 * `FENETRE_VERSIONS_MEMOIRE` (les plus récents). `sauf` : la vidéo qui s'écrit (sa propre reprise n'est pas une copie).
 */
export async function entreesMemoire(options: { sauf?: Id } = {}): Promise<EntreeMemoire[]> {
  const entrees: EntreeMemoire[] = [];
  try {
    const casConcret = await (await import("./cas-concret-scripts")).scriptsDejaEcritsDates(options.sauf);
    for (const { texte, date } of casConcret) entrees.push({ texte, date, formatId: "cas-concret" });
  } catch (erreur) {
    // source illisible : on continue avec les autres, mais on le dit (une mémoire sans cas concret ne doit pas passer inaperçue)
    console.error("[studio] mémoire d'écriture : scripts du cas concret illisibles", erreur);
  }
  try {
    const traces = await depots().tracesScriptsTableau.lister((t) => t.issue === "livre" && t.origine !== "will" && (!options.sauf || t.videoId !== options.sauf));
    for (const t of traces) {
      try {
        const derniere = t.versions[t.versions.length - 1];
        // Sans le passage `appel` : question IA, phrase entreprise et demande sont imposées, elles ne sont pas de la mémoire.
        const texte = derniere ? texteDitDe({ ...derniere.ecriture.script, appel: [] }).trim() : "";
        if (texte) entrees.push({ texte, date: String(t.date ?? t.creeLe ?? ""), formatId: "tableau-anime" });
      } catch {
        // une trace illisible n'arrête pas les autres
      }
    }
  } catch (erreur) {
    console.error("[studio] mémoire d'écriture : traces du tableau illisibles", erreur);
  }
  try {
    // L'avocat est hors contrat (décision de Will) : ses textes n'entrent pas dans la mémoire commune ; un format inconnu non plus.
    const connus = new Set(listerFormats({ inclureMasques: true }).map((f) => f.id));
    const variantes = await depots().variantes.lister((v) => !v.archiveLe && !!v.formatId && connus.has(v.formatId) && !FORMATS_HORS_CONTRAT.includes(v.formatId));
    const courantes = new Map<string, (typeof variantes)[number]>();
    for (const v of variantes) {
      const c = courantes.get(v.code);
      if (!c || v.version > c.version) courantes.set(v.code, v);
    }
    for (const v of courantes.values()) {
      const texte = [texteDeBlocs(v.ouverture), texteDeBlocs(v.fin)].filter(Boolean).join(" ");
      if (texte) entrees.push({ texte, date: String(v.creeLe ?? ""), formatId: v.formatId });
    }
  } catch (erreur) {
    console.error("[studio] mémoire d'écriture : variantes illisibles", erreur);
  }
  for (const x of await scriptsCentraux()) entrees.push({ texte: x.texte, date: x.date, formatId: x.formatId });
  const vus = new Set<string>();
  const uniques = entrees
    .map((e, rang) => ({ e, rang }))
    .sort((a, b) => a.e.date.localeCompare(b.e.date) || a.rang - b.rang)
    .map((x) => x.e)
    .filter((e) => (vus.has(e.texte) ? false : (vus.add(e.texte), true)));
  return uniques.slice(-FENETRE_VERSIONS_MEMOIRE);
}

export interface MemoireEcriture {
  scripts: string[];
  sequences: Sequence[];
  /** Le bloc à mettre dans la partie VARIABLE de la consigne (jamais dans le cache). Vide sans mémoire. */
  bloc: string;
}

/** Les noms sensibles des matières et des preuves (comme le socle), plus ceux donnés ; illisible : ceux donnés seuls. */
async function nomsSensibles(donnes: readonly string[] = []): Promise<string[]> {
  try {
    const d = depots();
    return nomsDuSocle({ matieres: await d.matieres.lister(), preuves: await d.preuves.lister(), nomsSensibles: [...donnes] });
  } catch (erreur) {
    console.error("[studio] mémoire d'écriture : noms sensibles illisibles, seuls ceux donnés sont masqués", erreur);
    return [...donnes];
  }
}

/** La mémoire anti-copie prête à l'emploi : scripts lus et anonymisés, séquences déjà dites, bloc de consigne. */
export async function memoireEcriture(options: { sauf?: Id; nomsSensibles?: readonly string[] } & OptionsVariete = {}): Promise<MemoireEcriture> {
  const noms = await nomsSensibles(options.nomsSensibles);
  const scripts = (await entreesMemoire({ sauf: options.sauf })).map((e) => anonymiserPourMemoire(e.texte, noms));
  const sequences = memoireAntiCopie(scripts, { tolere: options.tolere?.map((t) => anonymiserPourMemoire(t, noms)) });
  return { scripts, sequences, bloc: blocMemoire(sequences) };
}

/* ------------------------------------------------------------------ */
/* Tirages communs                                                      */
/* ------------------------------------------------------------------ */

export interface TirageCommun {
  role: RoleForme;
  formeId: string;
  formatId: string;
  date: string;
}

const estTirage = (x: unknown): x is TirageCommun => !!x && typeof x === "object" && typeof (x as TirageCommun).role === "string" && typeof (x as TirageCommun).formeId === "string";

/** Les 200 derniers tirages, du plus ancien au plus récent ; illisible : vide. */
export async function tiragesCommuns(): Promise<TirageCommun[]> {
  try {
    const v = await lireParametre<unknown>(CLE_TIRAGES_COMMUNS, []);
    return (Array.isArray(v) ? v.filter(estTirage) : []).slice(-TIRAGES_COMMUNS_MAX);
  } catch {
    return [];
  }
}

/** Note un tirage ; 200 lignes au plus. */
export async function noterTirageCommun(t: Omit<TirageCommun, "date"> & { date?: string }): Promise<void> {
  const liste = await tiragesCommuns();
  liste.push({ role: t.role, formeId: t.formeId, formatId: t.formatId, date: t.date ?? new Date().toISOString() });
  await ecrireParametre(CLE_TIRAGES_COMMUNS, liste.slice(-TIRAGES_COMMUNS_MAX));
}

/** Les formes récemment tirées pour ce rôle, tous formats confondus, du plus ancien au plus récent. */
export async function recentsPour(role: RoleForme): Promise<string[]> {
  return (await tiragesCommuns()).filter((t) => t.role === role).map((t) => t.formeId);
}

/**
 * Tire une forme sans récents (tous formats confondus) et note le tirage. Les récents sont limités aux n−1 dernières formes
 * du rôle (n = formes du rôle pour ce réseau) : il en reste toujours au moins une à tirer.
 */
export async function tirerFormeCommune(entree: { role: RoleForme; reseau: ReseauDeclinaison; formatId: string; graine: string }): Promise<Forme> {
  const toutes = formesDuRole(entree.role, entree.reseau).map((f) => f.id);
  const recents = (await recentsPour(entree.role)).filter((id) => toutes.includes(id)).slice(-Math.max(1, toutes.length - 1));
  const forme = tirerForme(entree.role, entree.reseau, recents, entree.graine);
  await noterTirageCommun({ role: entree.role, formeId: forme.id, formatId: entree.formatId });
  return forme;
}
