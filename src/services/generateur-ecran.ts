/**
 * Lectures et gestes de l'écran Sujet / Résultat ajoutés par la vérification E2E n° 1 du générateur (03/10/2026) :
 *  - n° 8 : « Déjà traité en n° X le JJ/MM » avant d'écrire (gratuit) ;
 *  - n° 7 : toucher une phrase pour la corriger, gratuit (le corps commun change sur les N versions) ;
 *  - n° 22 : ce qui est programmé, version par version (« Programmée : TT dim. 4 oct. 9 h ») ;
 *  - n° 20 : retouches payantes restantes par version (plafond visible) ;
 *  - relire et modifier le script avant la vidéo (grande chaîne) : contrôle en direct gratuit, enregistrement en lot,
 *    lancement seulement avec le repère « script relu ».
 */
import "server-only";
import { ideesDejaTraitees } from "@/domaine/classement-generateur";
import { assemblerBlocs, versionsCourantes } from "@/domaine/derivations-generateur";
import type { AccordPrix } from "@/domaine/accord";
import { appliquerAuLot, blocsDeVersionDuLot, controlerSelonAuteurs, lignesDuLot, lotModifie, pastillesDuLot, type VersionDuLot } from "@/domaine/relecture-generateur";
import { avisMalgreVoyant, demandeConfirmationVoyant, patchTraceVoyant } from "@/domaine/voyant-rouge";
import type { ViolationControle } from "@/domaine/controles-script";
import { scriptRelu, type LigneScript, type PastilleControle } from "@/domaine/relecture-script";
import type { BlocScript, Id, IdReseau, Ratio, Script, ScriptMaitre, VarianteReseau } from "@/domaine/types";
import { obtenirReseau } from "@/reseaux";
import { exigerSession } from "./auth";
import { memoriserCorrectionsWill } from "./apprentissage";
import { cleRetouches, enregistrerRetouche, RETOUCHES_MAX_PAR_VERSION } from "./boucle-generation";
import { depots, ecrireParametre, ErreurStudio, lireParametre, maintenant } from "./_commun";

/**
 * Sujets numérotés dont l'idée ressemble à celle-ci (lot L5 : par le service commun des sujets traités, tous générateurs
 * confondus (ou le seul `formatId` donné), un sujet à plusieurs versions ne comptant qu'une fois). Réglage `sujets.garde` éteint : l'ancienne lecture.
 */
export async function sujetsDejaTraites(idee: string, formatId?: string): Promise<{ id: Id; numero: number; le: string; idee: string }[]> {
  await exigerSession();
  const { lireGardeSujets, registreSujets } = await import("./sujets-traites");
  if ((await lireGardeSujets()) !== "eteint") {
    const { chercherPrecedents } = await import("@/domaine/sujets-traites");
    const vus = new Set<string>();
    const sortie: { id: Id; numero: number; le: string; idee: string }[] = [];
    for (const t of chercherPrecedents(await registreSujets(), { generateur: "", texte: idee }, maintenant())) {
      const e = t.entree;
      if (!e.sujetId || e.numero === undefined || vus.has(e.sujetId)) continue;
      // Le générateur choisi seulement (l'autre ne bloque pas) ; sans `formatId`, tous, comme avant.
      if (formatId && e.generateur !== formatId) continue;
      vus.add(e.sujetId);
      sortie.push({ id: e.sujetId, numero: e.numero, le: e.le, idee: e.texte });
    }
    return sortie;
  }
  const maitres = await depots().scriptsMaitres.lister((m) => m.numero !== undefined && !m.archiveLe);
  return ideesDejaTraitees(
    idee,
    maitres.map((m) => ({ id: m.id, numero: m.numero, idee: m.brief.idee, le: m.creeLe })),
    maintenant(),
  ).map((p) => ({ id: p.id, numero: p.numero!, le: p.le, idee: p.idee }));
}

/** Retouches payantes restantes par code de version (plafond `RETOUCHES_MAX_PAR_VERSION`). */
export async function retouchesRestantes(codes: string[]): Promise<Record<string, number>> {
  await exigerSession();
  const sortie: Record<string, number> = {};
  for (const c of codes) sortie[c] = Math.max(0, RETOUCHES_MAX_PAR_VERSION - (await lireParametre<number>(cleRetouches(c), 0)));
  return sortie;
}

/** Correction GRATUITE d'une phrase (segment) d'une version : le texte est remplacé mot pour mot, le reste ne bouge pas. */
export async function corrigerPhrase(varianteId: Id, segmentId: Id, texte: string): Promise<{ corps: boolean }> {
  await exigerSession();
  const t = texte.trim();
  if (!t) throw new ErreurStudio("PHRASE_VIDE", "La phrase est vide.");
  const d = depots();
  const v = await d.variantes.obtenir(varianteId);
  if (!v) throw new ErreurStudio("INTROUVABLE", "Cette version n'existe plus.");
  const script = await d.scripts.obtenir(v.scriptId);
  if (!script) throw new ErreurStudio("INTROUVABLE", "Ce texte n'existe plus.");
  const corps = script.blocs.some((b) => b.segments.some((s) => s.id === segmentId));
  const blocs: BlocScript[] = assemblerBlocs(script, v).map((b) => ({ ...b, segments: b.segments.map((s) => (s.id === segmentId ? { ...s, texte: t, ecritPar: "will" as const } : s)) }));
  if (!blocs.some((b) => b.segments.some((s) => s.id === segmentId))) throw new ErreurStudio("INTROUVABLE", "Cette phrase n'existe plus.");
  await enregistrerRetouche(v.id, blocs);
  return { corps };
}

export interface ProgrammationVersion {
  varianteId: Id;
  code: string;
  reseau: IdReseau;
  statut: "programmee" | "publiee" | "essai";
  date: string;
}

/** Ce qui est programmé ou publié pour les versions courantes d'un sujet (essai compris, marqué). */
export async function programmationsDuSujet(scriptMaitreId: Id): Promise<ProgrammationVersion[]> {
  await exigerSession();
  const d = depots();
  const variantes = versionsCourantes(await d.variantes.lister((x) => x.scriptMaitreId === scriptMaitreId));
  const parCode = new Map((await d.variantes.lister((x) => x.scriptMaitreId === scriptMaitreId)).map((x) => [x.id, x.code]));
  const pubs = await d.publications.lister((p) => !!p.varianteId && parCode.has(p.varianteId) && (p.statut === "programmee" || p.statut === "publiee"));
  const sortie: ProgrammationVersion[] = [];
  for (const v of variantes) {
    const p = pubs.filter((x) => parCode.get(x.varianteId!) === v.code).sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0];
    if (!p) continue;
    sortie.push({ varianteId: v.id, code: v.code, reseau: p.reseau, statut: p.via === "simulation" ? "essai" : p.statut === "publiee" ? "publiee" : "programmee", date: p.date });
  }
  return sortie;
}

/* ------------------------------------------------------------------ */
/* Relire et modifier le script avant la vidéo (grande chaîne)          */
/* ------------------------------------------------------------------ */

/** Ce qui est relu : UNE version (« Fabriquer », « Relire et modifier ») ou, sans `varianteId`, « Fabriquer les N ». */
export interface CibleRelecture {
  sujetId: Id;
  varianteId?: Id;
}

const cleScriptRelu = (operationId: string) => `generateur.script-relu.${operationId}`;

/** Repère « script relu » d'une opération : l'empreinte relue ET la cible (un identifiant réutilisé ailleurs ne vaut rien). */
interface RepereScriptRelu {
  empreinte: string;
  lance: boolean;
  sujetId?: Id;
  varianteId?: Id;
}

const repereDeLaCible = (r: RepereScriptRelu | null, cible: CibleRelecture): RepereScriptRelu | null =>
  r && r.sujetId === cible.sujetId && (r.varianteId ?? null) === (cible.varianteId ?? null) ? r : null;

async function courante(code: string): Promise<VarianteReseau | undefined> {
  return versionsCourantes(await depots().variantes.lister((x) => x.code === code))[0];
}

/**
 * Versions relues (courantes) : la version touchée, ou celles que « Fabriquer les N » fabriquera. `fabriquer` : le but
 * est de fabriquer (pas « Relire et modifier ») : la version doit être VALIDÉE (une version « à relire » n'est jamais
 * validée puis fabriquée par l'écran de relecture).
 */
async function versionsDeLaCible(cible: CibleRelecture, options: { fabriquer?: boolean } = {}): Promise<{ m: ScriptMaitre; versions: VarianteReseau[] }> {
  const d = depots();
  const m = await d.scriptsMaitres.obtenir(cible.sujetId);
  if (!m || m.archiveLe) throw new ErreurStudio("INTROUVABLE", "Ce sujet n'existe plus.");
  if (cible.varianteId) {
    const v = await d.variantes.obtenir(cible.varianteId);
    const c = v && v.scriptMaitreId === m.id ? await courante(v.code) : undefined;
    if (!c) throw new ErreurStudio("INTROUVABLE", "Cette version n'existe plus.");
    if (options.fabriquer && c.etat !== "validee") throw new ErreurStudio("A_VALIDER", "Validez d'abord cette version.");
    return { m, versions: [c] };
  }
  const { versionsAvatar } = await import("./fabrication-reseaux");
  const versions = (await versionsAvatar(m)).filter((v) => !v.videoId);
  if (!versions.length) throw new ErreurStudio("RIEN_A_FABRIQUER", "Aucune version validée à fabriquer.");
  return { m, versions };
}

async function lotDe(m: ScriptMaitre, versions: VarianteReseau[]): Promise<{ lot: VersionDuLot[]; scripts: Map<Id, Script> }> {
  const d = depots();
  const toutes = versionsCourantes(await d.variantes.lister((x) => x.scriptMaitreId === m.id));
  const scripts = new Map<Id, Script>();
  for (const v of versions) {
    const s = await d.scripts.obtenir(v.scriptId);
    if (!s) throw new ErreurStudio("INTROUVABLE", "Ce texte n'existe plus.");
    scripts.set(s.id, s);
  }
  const lot = versions.map((v) => ({
    varianteId: v.id,
    code: v.code,
    reseau: v.reseau,
    nomReseau: obtenirReseau(v.reseau).nom,
    scriptId: v.scriptId,
    corpsScript: scripts.get(v.scriptId)!.blocs,
    versionsSurLeCorps: toutes.filter((x) => x.scriptId === v.scriptId).length,
    segmentFacultatifRetenu: v.segmentFacultatifRetenu,
    ouverture: v.ouverture,
    fin: v.fin,
    encadre: v.encadre?.texte,
  }));
  return { lot, scripts };
}

/** Le script à relire (lignes de l'écran commun), son débit et son empreinte. Lecture seule. `fabriquer` : voir `versionsDeLaCible`. */
export async function lotARelire(cible: CibleRelecture, options: { fabriquer?: boolean } = {}): Promise<{ lignes: LigneScript[]; debit: number; codes: string[]; dejaValidees: boolean; formatId: string }> {
  await exigerSession();
  const { m, versions } = await versionsDeLaCible(cible, options);
  const { lot, scripts } = await lotDe(m, versions);
  const mode = scripts.get(versions[0].scriptId)?.mode ?? "avatar";
  const { parametresGenerateur } = await import("@/donnees/generateur/parametres-generateur");
  const { formatGenerateur } = await import("@/formats");
  const debit = parametresGenerateur(versions[0].formatId).debitParMode?.[mode] ?? formatGenerateur(versions[0].formatId).recette.debitParMode[mode];
  return { lignes: lignesDuLot(lot), debit, codes: versions.map((v) => v.code), dejaValidees: versions.every((v) => v.etat === "validee"), formatId: versions[0].formatId };
}

/**
 * Pastilles du texte relu, au barème de chaque phrase. Un garde-fou DÉJÀ levé sur le texte d'avant (version validée
 * par Will avec ses garde-fous affichés, comme aujourd'hui) reste visible en « alerte » ; seul un bloquant NOUVEAU,
 * apparu avec les modifications, empêche de lancer.
 */
async function pastillesRelues(m: ScriptMaitre, versions: VarianteReseau[], lot: VersionDuLot[], scripts: Map<Id, Script>, apres: VersionDuLot[]): Promise<PastilleControle[]> {
  // Même contrôle sur la même phrase (ou sur le texte entier) : déjà levé, même si ses chiffres ont bougé (durées).
  const cle = (p: PastilleControle) => `${p.ligneId ?? ""}|${p.code ?? p.texte}`;
  const deja = new Set(pastillesDuLot(await controlesDuLot(m, versions, lot, scripts)).filter((p) => p.niveau === "bloquant").map(cle));
  return pastillesDuLot(await controlesDuLot(m, versions, apres, scripts)).map((p) => (p.niveau === "bloquant" && deja.has(cle(p)) ? { ...p, niveau: "alerte" as const } : p));
}

/** Les violations de chaque version du lot sur le texte donné (celles de `pastillesRelues`, réutilisées par le voyant). */
async function controlesDuLot(m: ScriptMaitre, versions: VarianteReseau[], l: VersionDuLot[], scripts: Map<Id, Script>) {
  const { entreeControleDeBlocs } = await import("./controles-version");
  const parVersion = [];
  for (const [i, x] of l.entries()) {
    const v = versions[i];
    const s = scripts.get(v.scriptId);
    const e = await entreeControleDeBlocs({ ...v, encadre: { texte: x.encadre ?? "" } }, m, blocsDeVersionDuLot(x), { mode: s?.mode, adresse: s?.adresse });
    parVersion.push({ version: x, violations: controlerSelonAuteurs(e).violations });
  }
  return parVersion;
}

/** Contrôle EN DIRECT du texte relu : GRATUIT (aucun appel payant), rien n'est enregistré. */
export async function controlerRelecture(cible: CibleRelecture, lignes: LigneScript[]): Promise<PastilleControle[]> {
  await exigerSession();
  const { m, versions } = await versionsDeLaCible(cible);
  const { lot, scripts } = await lotDe(m, versions);
  const r = appliquerAuLot(lot, lignes);
  if (!r.ok) return r.raisons.map((texte) => ({ niveau: "bloquant", texte }));
  return pastillesRelues(m, versions, lot, scripts, lotModifie(lot, r));
}

/**
 * Enregistrement EN LOT des modifications : un corps changé une seule fois (reporté sur les N), chaque version
 * touchée redevient « à relire » (nouvelle version, même code, l'ancienne gardée). Les versions hors du lot qui
 * partagent le milieu passent « Milieu modifié, à revoir » : une phrase le dit.
 */
export async function enregistrerRelecture(cible: CibleRelecture, lignes: LigneScript[]): Promise<{ modifiees: number; aRevoir: number; phrase?: string; codes: string[] }> {
  await exigerSession();
  const { m, versions } = await versionsDeLaCible(cible);
  const { lot } = await lotDe(m, versions);
  return enregistrerLot(lot, lignes, versions[0]?.formatId);
}

async function enregistrerLot(lot: VersionDuLot[], lignes: LigneScript[], formatId?: string): Promise<{ modifiees: number; aRevoir: number; phrase?: string; codes: string[] }> {
  const r = appliquerAuLot(lot, lignes);
  if (!r.ok) throw new ErreurStudio("SCRIPT_A_RELIRE", r.raisons[0]);
  if (!r.scripts.length && !r.versions.length) return { modifiees: 0, aRevoir: 0, codes: [] };
  const { retoucherCorps, retoucherVariante } = await import("./generateur");
  const codesLot = new Set(lot.map((v) => v.code));
  const reportees: Id[] = [];
  for (const s of r.scripts) reportees.push(...(await retoucherCorps(s.scriptId, s.blocs)).reportees);
  const touchees = lot.filter((v) => r.scripts.some((s) => s.scriptId === v.scriptId) || r.versions.some((x) => x.code === v.code));
  for (const v of touchees) {
    const x = r.versions.find((y) => y.code === v.code);
    const c = await courante(v.code);
    if (c) await retoucherVariante(c.id, { ...(x?.ouverture ? { ouverture: x.ouverture } : {}), ...(x?.fin ? { fin: x.fin } : {}), ...(x?.encadre !== undefined ? { encadre: { texte: x.encadre } } : {}) });
  }
  const autres = new Set<string>();
  for (const id of reportees) {
    const v = await depots().variantes.obtenir(id);
    if (v && !codesLot.has(v.code)) autres.add(v.code);
  }
  const n = autres.size;
  // Mémoire de la voix de Will : ce qu'il a changé (généré → validé). Éteint : n'écrit rien.
  if (formatId) await memoriserCorrectionsWill(lignesDuLot(lot), lignes, { formatId, code: touchees[0]?.code });
  return {
    modifiees: touchees.length,
    aRevoir: n,
    phrase: n ? `Le milieu commun a changé : ${n > 1 ? `les ${n} autres versions sont à revoir` : "l'autre version est à revoir"}.` : undefined,
    codes: touchees.map((v) => v.code),
  };
}

/*
 * Voyant rouge : `fabriquerSecondeOuverture` (fabrication-reseaux) relance une voix payante SANS ce contrôle, volontairement :
 * la vidéo Reels existe déjà, donc son script est déjà passé par « relire puis lancer » (`fabriquerApresRelecture`), où le
 * second oui a été demandé. Le redemander ici serait une question en double.
 */

/**
 * Lancement APRÈS la relecture : la fabrication ne part JAMAIS sans le repère « script relu » (empreinte du texte relu,
 * `relecture-script`), qui tombe dès que le texte change. Les modifications sont enregistrées (version « à relire »),
 * puis validées par le geste de Will (il vient de relire et de lancer) ; le texte fabriqué est CELUI relu.
 * Une relance de la même opération déjà partie (confirmation du prix, double toucher) reprend le repère déjà donné.
 */
export async function fabriquerApresRelecture(
  cible: CibleRelecture,
  o: { lignes: LigneScript[]; empreinte: string; operationId: string; accord?: AccordPrix; ratiosOption?: Ratio[]; malgreVoyant?: boolean },
): Promise<{ videoId?: Id; n?: number; enAttente?: string; phrase?: string }> {
  await exigerSession();
  const repere = repereDeLaCible(await lireParametre<RepereScriptRelu | null>(cleScriptRelu(o.operationId), null), cible);
  const laCible = { sujetId: cible.sujetId, ...(cible.varianteId ? { varianteId: cible.varianteId } : {}) };
  let phrase: string | undefined;
  // Versions au voyant rouge confirmé, telles que lues au départ (note + garde-fous du texte relu) : voir la trace plus bas.
  let versionsLuesAuDepart: (VarianteReseau & { controles: { violations: ViolationControle[] } })[] = [];
  let voyantRougeCodes: string[] = [];
  if (!repere?.lance) {
    if (!scriptRelu(o.lignes, o.empreinte)) throw new ErreurStudio("SCRIPT_A_RELIRE", "Relisez le script avant de lancer la vidéo.");
    const { m, versions } = await versionsDeLaCible(cible, { fabriquer: true });
    if (m.exception && m.exception.source === "proposition-machine" && !m.exception.valideeParWill) throw new ErreurStudio("LIMITE_A_VALIDER", "Validez d'abord la limite proposée (un toucher).");
    const { lot, scripts } = await lotDe(m, versions);
    const r = appliquerAuLot(lot, o.lignes);
    if (!r.ok) throw new ErreurStudio("SCRIPT_A_RELIRE", r.raisons[0]);
    const pastilles = await pastillesRelues(m, versions, lot, scripts, lotModifie(lot, r));
    if (pastilles.some((p) => p.niveau === "bloquant")) throw new ErreurStudio("SCRIPT_A_CORRIGER", "Une phrase est à corriger avant la vidéo. Rien n'a été payé.");
    // Voyant rouge : second oui AVANT la voix payante, pour tout le lot en une seule demande (rien n'a été créé ni payé).
    // Après les refus du texte relu, et sur le texte RELU : les garde-fous sont ceux de `pastillesRelues` (mêmes violations).
    const reluDuLot = await controlesDuLot(m, versions, lotModifie(lot, r), scripts);
    versionsLuesAuDepart = versions.map((v, i) => ({ ...v, controles: { ...v.controles, violations: [...reluDuLot[i].violations] } }));
    const voyantRouge = demandeConfirmationVoyant(versionsLuesAuDepart);
    if (voyantRouge && !o.malgreVoyant) throw new ErreurStudio("VOYANT_ROUGE", voyantRouge.message);
    voyantRougeCodes = voyantRouge?.codes ?? [];
    // Budget du mois, accord sur le prix et crédits AVANT d'enregistrer : sur le texte RELU (le prix suit sa longueur).
    // Un refus ne laisse rien derrière lui : aucune nouvelle version, rien de validé, aucun autre réseau « à revoir ».
    if (r.scripts.length || r.versions.length) {
      const relus = new Map(lotModifie(lot, r).map((x) => [x.varianteId, { ouverture: x.ouverture, fin: x.fin, corpsScript: x.corpsScript }]));
      const fr = await import("./fabrication-reseaux");
      if (cible.varianteId) await fr.verifierAvantDeCreer([versions[0].id], { confirme: o.accord ?? false, relus });
      else await fr.verifierAvantDeFabriquerLesN(cible.sujetId, { ratiosOption: o.ratiosOption, totalConfirme: typeof o.accord === "number" ? o.accord : undefined, relus });
    }
    const e = await enregistrerLot(lot, o.lignes, versions[0]?.formatId);
    phrase = e.phrase;
    // Les versions modifiées par Will sont validées par son geste (il vient de les relire et de lancer).
    const { validerVariante, revaliderVariantes } = await import("./generateur");
    for (const code of e.codes) {
      const c = await courante(code);
      if (c?.etat === "a-relire") await validerVariante(c.id);
      else if (c?.etat === "a-reverifier") await revaliderVariantes([c.id]);
    }
    // Le texte qui va partir est-il bien celui relu (rien n'a changé entre-temps) ?
    const relu = await versionsDeLaCible(cible);
    if (!scriptRelu(lignesDuLot((await lotDe(relu.m, relu.versions)).lot), o.empreinte)) throw new ErreurStudio("SCRIPT_A_RELIRE", "Le script a changé depuis votre relecture : relisez-le à nouveau.");
    await ecrireParametre(cleScriptRelu(o.operationId), { empreinte: o.empreinte, lance: false, ...laCible } satisfies RepereScriptRelu);
  }
  const sortie = await (async () => {
    if (cible.varianteId) {
      const v = await depots().variantes.obtenir(cible.varianteId);
      const c = v ? await courante(v.code) : undefined;
      if (!c) throw new ErreurStudio("INTROUVABLE", "Cette version n'existe plus.");
      const { fabriquerVariante } = await import("./boucle-generation");
      const f = await fabriquerVariante(c.id, { operationId: o.operationId, lancer: true, prixConfirme: o.accord });
      return { videoId: f.videoId, enAttente: f.enAttente };
    }
    const { fabriquerLesN } = await import("./fabrication-reseaux");
    const f = await fabriquerLesN(cible.sujetId, { operationId: o.operationId, lancer: true, ratiosOption: o.ratiosOption, totalConfirme: typeof o.accord === "number" ? o.accord : undefined });
    return { videoId: f.mereVideoId, n: f.videoIds.length, enAttente: f.enAttente };
  })();
  await ecrireParametre(cleScriptRelu(o.operationId), { empreinte: repere?.empreinte ?? o.empreinte, lance: true, ...laCible } satisfies RepereScriptRelu);
  // Le second oui est gardé sur la version qui part (`avisWill.malgreVoyant`), APRÈS le départ de la fabrication : un
  // refus plus haut (« le script a changé », budget...) ne laisse aucune trace. Les données sont celles de la version
  // LUE AU DÉPART (note et garde-fous qu'a vus Will au moment du oui), pas celles d'une version refaite depuis.
  for (const code of voyantRougeCodes) {
    const c = await courante(code);
    if (!c) continue;
    const luAuDepart = versionsLuesAuDepart.find((v) => v.code === code) ?? c;
    await depots().variantes.modifier(c.id, patchTraceVoyant(c, avisMalgreVoyant(luAuDepart, maintenant())) as Partial<VarianteReseau>);
  }
  return { ...sortie, ...(phrase ? { phrase } : {}) };
}
