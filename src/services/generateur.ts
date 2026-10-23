/**
 * SERVICE DU GÉNÉRATEUR DE SCRIPTS (plan v5 B.2, B.3.6 ; lot G1a : données, états, versions, simulation).
 *
 * - Un sujet (ScriptMaitre) naît BROUILLON, sans numéro. Le numéro est attribué sous `sousVerrou` au PREMIER APPEL
 *   PAYANT, jamais réutilisé (B.2.4). En G1a l'écriture est SIMULÉE (aucune clé, aucune dépense) : le point où partirait
 *   le premier appel payant est le même, c'est là que le numéro est pris.
 * - Sans matière vraie : arrêt gratuit `ANCRAGE_MANQUANT`, le sujet reste « sans numéro · il manque une matière ».
 * - Une version par réseau (VarianteReseau) ne stocke que son état d'écriture ; tout le reste se calcule
 *   (`etatReseau`). `synchroniserSujet` recopie l'état dans `Video.etapeEditoriale` et `Script.statutEditorial`, à chaque
 *   transition et après chaque fabrication.
 * - Rien n'est effacé : une retouche crée une nouvelle version (code stable), l'archivage pose `archiveLe`.
 */
import "server-only";
import type {
  Adresse,
  BlocScript,
  GenerationScript,
  Id,
  Matiere,
  ModeDiction,
  ReponseBloquante,
  ReseauDeclinaison,
  Script,
  ScriptMaitre,
  VarianteReseau,
} from "@/domaine/types";
import {
  assemblerBlocs,
  codeVariante,
  empreinte,
  empreinteCorps,
  etapeEditorialeDe,
  etatReseau,
  etatSujet,
  grilleSujet,
  matiereDisponible,
  proposerPilier,
  proposerTypeMatiere,
  repartirBlocs,
  statutEditorialDerive,
  texteDesBlocs,
  versionsCourantes,
  type EtatSujet,
  type LigneGrille,
} from "@/domaine/derivations-generateur";
import { accordRequis, decouperTexteWill, estTexteColle, matierePourSujet } from "@/domaine/matieres";
import { formatGenerateur, type FormatGenerateur } from "@/formats";
import { simulerCorps, simulerVersion, type EntreeSimulation } from "@/generateur/simulation";
import { nouvelId } from "@/lib/ids";
import { ecritureReseau } from "@/reseaux/ecriture";
import { exigerSession } from "./auth";
import { chaineDeLEcriture, plafondChaineUsd, PLAFOND_PAR_DEFAUT_USD } from "./generation-claude";
import { apprentissageActif } from "./apprentissage";
import { episodeAuDepart, rattacherSujet } from "./series";
import { depots, ErreurStudio, filtreExemples, horodatage, journaliser, maintenant, sousVerrou } from "./_commun";
import { controlerSujetCentral, type OptionsControleSujet } from "./sujet-central-controle";

/** Numéros de démonstration : à partir de 9000, jamais mêlés aux vrais (B.2.4). */
export const NUMERO_DEMO_MIN = 9000;

/**
 * Plafond d'une génération (B.0 n° 50) : 0,70 $ par format ou corps supplémentaire ; celui d'un sujet est lu du réglage
 * de la chaîne (`plafondChaineUsd`). Re-relecture A09 : son défaut a une seule source, `PLAFOND_PAR_DEFAUT_USD`.
 */
export const PLAFOND_SUJET_USD = PLAFOND_PAR_DEFAUT_USD;
export const PLAFOND_SUPPLEMENT_USD = 0.7;
/**
 * E2E-2 parcours n° 8 : un corps supplémentaire qui CHANGE d'adresse (« + Tu » sur un sujet au « vous ») réécrit aussi
 * ses accroches (≈ 0,22 $ médian au banc G4 : accroches + juge) : 0,70 $ + 0,25 $.
 */
export const PLAFOND_SUPPLEMENT_ADRESSE_USD = 0.95;

/* ------------------------------------------------------------------ */
/* Numéro (B.2.4)                                                      */
/* ------------------------------------------------------------------ */

/**
 * Attribue le numéro d'un sujet : max(numero) + 1 sur TOUS les sujets numérotés, archivés compris, hors démonstration
 * (≥ 9000), sous `sousVerrou` avec l'écriture. Idempotent : un sujet déjà numéroté garde son numéro. Une version d'un
 * sujet (parentId) hérite du numéro. Contrôle d'unicité (numero, version) à l'écriture.
 */
export async function attribuerNumero(scriptMaitreId: Id, options: { episode?: boolean } = {}): Promise<number> {
  return sousVerrou(() => attribuerNumeroSousVerrou(scriptMaitreId, options));
}

/** Le corps d'`attribuerNumero`, pour un appelant qui tient DÉJÀ le verrou (le verrou n'est pas réentrant). */
export async function attribuerNumeroSousVerrou(scriptMaitreId: Id, options: { episode?: boolean } = {}): Promise<number> {
  {
    const d = depots();
    const m = await d.scriptsMaitres.obtenir(scriptMaitreId);
    if (!m) throw new ErreurStudio("INTROUVABLE", "Ce sujet n'existe plus.");
    if (m.numero !== undefined) return m.numero;
    let numero: number;
    const parent = m.parentId ? await d.scriptsMaitres.obtenir(m.parentId) : null;
    if (parent?.numero !== undefined) {
      numero = parent.numero;
    } else {
      const tous = await d.scriptsMaitres.lister((x) => x.numero !== undefined);
      const demo = !!m.estDemo;
      const pris = tous.map((x) => x.numero!).filter((n) => (demo ? n >= NUMERO_DEMO_MIN : n < NUMERO_DEMO_MIN));
      numero = pris.length ? Math.max(...pris) + 1 : demo ? NUMERO_DEMO_MIN : 1;
    }
    const doublon = await d.scriptsMaitres.trouver((x) => x.id !== m.id && x.numero === numero && x.version === m.version);
    if (doublon) throw new ErreurStudio("NUMERO_PRIS", `Le n° ${numero} (version ${m.version}) est déjà pris.`);
    // L'épisode de la série se prend ICI, avec le numéro : seulement quand l'écriture part vraiment.
    // Relecture finale : pas pour une écriture d'essai ni une écriture qui attend du crédit (`episode: false`) ; elle le
    // prend alors à sa première étape vraiment payée (`prendreEpisode`).
    const episodeSerie = options.episode !== false && m.brief.serieId && !m.episodeSerie ? await episodeAuDepart(m.brief.serieId) : undefined;
    await d.scriptsMaitres.modifier(m.id, { numero, ...(episodeSerie ? { episodeSerie } : {}) });
    return numero;
  }
}

/**
 * Relecture finale : l'épisode de la série d'un sujet DÉJÀ numéroté, pris à la première étape vraiment payée de son
 * écriture (jamais par un essai ni une attente de crédit). Sans effet s'il en a déjà un ou n'est dans aucune série.
 */
export async function prendreEpisode(scriptMaitreId: Id): Promise<number | undefined> {
  return sousVerrou(async () => {
    const d = depots();
    const m = await d.scriptsMaitres.obtenir(scriptMaitreId);
    if (!m || m.numero === undefined || !m.brief.serieId) return undefined;
    if (m.episodeSerie) return m.episodeSerie;
    const episodeSerie = await episodeAuDepart(m.brief.serieId);
    if (episodeSerie) await d.scriptsMaitres.modifier(m.id, { episodeSerie });
    return episodeSerie;
  });
}

/* ------------------------------------------------------------------ */
/* Sujet : création (brouillon)                                        */
/* ------------------------------------------------------------------ */

export interface BriefSujet {
  idee: string;
  /** Facultative ; devient une matière, toujours utilisée. */
  phraseWill?: string;
  objectif?: ScriptMaitre["brief"]["objectif"];
  reseaux: ReseauDeclinaison[];
  formatId: string;
  adresse?: Adresse;
  mode?: ModeDiction;
  motCle?: string;
  pilier?: string;
  cible?: string;
  matiereIdsImposees?: Id[];
  ideeId?: Id;
  sujetSensible?: ScriptMaitre["brief"]["sujetSensible"];
  estDemo?: boolean;
  /** Équipe 7 : série choisie dans l'atelier ; l'épisode est attribué à la création. */
  serieId?: Id;
  /** Idées de l'usine : codes gardés sur le sujet. */
  origineUsine?: ScriptMaitre["origineUsine"];
  /** « Refaire cette structure sur un autre sujet » : structure et famille d'accroche d'une vidéo qui a marché. */
  structureImposee?: string;
  familleAccroche?: string;
  /** « Refaire quand même » (lot L5) : choix et jeton reçus du refus `sujet-deja-traite` ; l'action les assainit. */
  confirmationSujet?: { choix: "refaire" | "nouvel-angle"; jeton: string };
}

/**
 * Crée un sujet BROUILLON, sans numéro (un seul champ obligatoire : l'idée). Aucun appel.
 * Lot L5 : un NOUVEAU sujet déjà traité est refusé ici (`ErreurSujetDejaTraite`), avant toute création et toute dépense,
 * sauf confirmation valable (« Refaire quand même »). `options` : reprise, nouvelle version d'un sujet, contrôle déjà fait.
 */
export async function creerSujet(brief: BriefSujet, options: OptionsControleSujet = {}): Promise<ScriptMaitre> {
  await exigerSession();
  if (!brief.idee.trim()) throw new ErreurStudio("IDEE_VIDE", "Écrivez ou dictez l'idée du sujet.");
  if (!brief.reseaux.length) throw new ErreurStudio("SANS_RESEAU", "Choisissez au moins un réseau.");
  formatGenerateur(brief.formatId);
  await controlerSujetCentral(brief, options);
  const d = depots();
  const imposees = [...(brief.matiereIdsImposees ?? [])];
  // Vérif A1 : le texte de Will (« Une phrase à vous », ou un texte complet collé dans l'idée) devient de la matière vraie.
  // Un texte collé est découpé MOT POUR MOT en morceaux typés (`decouperTexteWill`), jamais réécrit.
  const texteWill = brief.phraseWill?.trim() || (estTexteColle(brief.idee) ? brief.idee.trim() : "");
  const idsWill: Id[] = [];
  for (const texte of decouperTexteWill(texteWill)) {
    const type = proposerTypeMatiere(texte);
    const matiere: Matiere = {
      id: nouvelId("mat"),
      type,
      texte,
      // Un cas client ou la parole d'un dirigeant n'est jamais cité sans accord : la fiche du sujet le demande.
      accord: accordRequis(type) ? { requis: true, obtenu: false } : undefined,
      source: { origine: "dictee", date: maintenant() },
      motsCles: [],
      pilier: brief.pilier,
      saisiePar: "will",
      statut: "validee",
      estDemo: brief.estDemo,
      ...horodatage(),
    };
    await d.matieres.enregistrer(matiere);
    idsWill.push(matiere.id);
  }
  imposees.unshift(...idsWill);
  // « Refaire cette structure » n'existe que réglage `generateur.apprentissage` allumé : sinon la demande est ignorée.
  const refaire = await apprentissageActif();
  const m: ScriptMaitre = {
    id: nouvelId("suj"),
    version: 1,
    origineUsine: brief.origineUsine,
    brief: {
      idee: brief.idee.trim(),
      phraseWill: brief.phraseWill?.trim() || undefined,
      objectif: brief.objectif ?? "notoriete",
      niveauConscience: "connait-le-probleme",
      reseaux: [...brief.reseaux],
      formatId: brief.formatId,
      formatsDemandes: [brief.formatId],
      adresseParDefaut: brief.adresse ?? "vous",
      modeParDefaut: brief.mode,
      cible: brief.cible,
      pilier: brief.pilier,
      motCle: brief.motCle ? { forme: brief.motCle, source: "hypothese" } : undefined,
      ideeId: brief.ideeId,
      matiereIdsImposees: imposees.length ? imposees : undefined,
      modeChoix: "rapide",
      mentionIA: false,
      sujetSensible: brief.sujetSensible,
      ...(refaire && brief.structureImposee ? { structureImposee: brief.structureImposee } : {}),
      ...(refaire && brief.familleAccroche ? { familleAccroche: brief.familleAccroche } : {}),
    },
    ancrages: [],
    etat: "brouillon",
    marqueId: "marque-axion",
    contexteAxionVersion: 0,
    estDemo: brief.estDemo,
    ...horodatage(),
  };
  await d.scriptsMaitres.enregistrer(m);
  await journaliser("sujet", `Sujet créé : « ${m.brief.idee} »`, { type: "sujet", id: m.id });
  if (brief.serieId) {
    // INTÉGRATION FINALE (décision du 04/10) : le sujet est rangé dans la série, mais son numéro d'ÉPISODE n'est pris
    // qu'au départ réel de l'écriture (`attribuerNumero`) : une idée arrêtée à 0 € ne fait sauter aucun épisode.
    await rattacherSujet(m.id, brief.serieId);
    return (await d.scriptsMaitres.obtenir(m.id)) ?? m;
  }
  return m;
}

/* ------------------------------------------------------------------ */
/* Écriture simulée : textes et versions par réseau                    */
/* ------------------------------------------------------------------ */

export type ResultatEcriture =
  | { ok: true; numero: number; scriptIds: Id[]; varianteIds: Id[]; generationId: Id }
  | { ok: false; manque: ReponseBloquante; message: string };

/** Matière d'ancrage : celles imposées par Will d'abord, sinon la plus récente disponible (du même thème si possible). */
async function choisirAncrage(m: ScriptMaitre): Promise<Matiere | null> {
  const d = depots();
  const t = maintenant();
  const deja = m.ancrages[0] ? await d.matieres.obtenir(m.ancrages[0].matiereId) : null;
  if (deja && matiereDisponible(deja, t)) return deja;
  for (const id of m.brief.matiereIdsImposees ?? []) {
    const x = await d.matieres.obtenir(id);
    if (x && matiereDisponible(x, t)) return x;
  }
  // E2E-1 n° 9 : la limite d'un AUTRE sujet (proposée par la machine) n'est jamais reprise ici.
  const dispo = (await d.matieres.lister((x) => matiereDisponible(x, t) && !!x.estDemo === !!m.estDemo && matierePourSujet(x, m.id))).sort((a, b) => b.creeLe.localeCompare(a.creeLe));
  if (!dispo.length) return null;
  const pilier = m.brief.pilier ?? proposerPilier(m.brief.idee, dispo.filter((x) => x.pilier).map((x) => ({ id: x.pilier!, motsCles: x.motsCles })));
  return dispo.find((x) => pilier && x.pilier === pilier) ?? dispo[0];
}

function motCleDe(m: ScriptMaitre): string {
  if (m.brief.motCle?.forme) return m.brief.motCle.forme;
  const mots = m.brief.idee.replace(/[«»"“”.!?,;:]/g, " ").split(/\s+/).filter((x) => x.length > 3);
  return mots.slice(0, 2).join(" ") || m.brief.idee.slice(0, 24);
}

/**
 * Écrit (en SIMULATION) un format pour un sujet : un texte par corps et une version par réseau, codés.
 * Un format par lancement ; « + Autre format », « + Je lis », « + Tu » relancent sur le même fond (options).
 */
export async function ecrireSujetSimule(
  scriptMaitreId: Id,
  options: { formatId?: string; mode?: ModeDiction; adresse?: Adresse; reseaux?: ReseauDeclinaison[] } = {},
): Promise<ResultatEcriture> {
  await exigerSession();
  const d = depots();
  const m = await d.scriptsMaitres.obtenir(scriptMaitreId);
  if (!m) throw new ErreurStudio("INTROUVABLE", "Ce sujet n'existe plus.");
  if (m.archiveLe) throw new ErreurStudio("ARCHIVE", "Ce sujet est rangé : restaurez-le d'abord.");
  const format: FormatGenerateur = formatGenerateur(options.formatId ?? m.brief.formatId);
  const recette = format.recette;
  const mode = options.mode ?? m.brief.modeParDefaut ?? recette.modeParDefaut;
  if (!recette.modesDiction.includes(mode)) throw new ErreurStudio("QUI_PARLE", "Ce type de vidéo ne se tourne pas de cette façon.");
  const adresse = options.adresse ?? m.brief.adresseParDefaut;
  const demandes = options.reseaux ?? m.brief.reseaux;
  if (!demandes.length) throw new ErreurStudio("SANS_RESEAU", "Choisissez au moins un réseau.");
  const reseaux = format.declinaison === "aucune" ? demandes.slice(0, 1) : demandes;

  // Étape 0, GRATUITE : sans matière vraie, arrêt sans numéro ni dépense (B.0 n° 20, C31).
  const ancrage = await choisirAncrage(m);
  if (!ancrage) {
    const manque: ScriptMaitre["manque"] = { type: "ANCRAGE_MANQUANT", etape: 0, ceQuIlFaudrait: "Une matière vraie : une scène vécue, un cas client, une question reçue…", typeMatiereSuggere: "anecdote-will" };
    await d.scriptsMaitres.modifier(m.id, { manque, etat: m.numero === undefined ? "brouillon" : m.etat });
    return { ok: false, manque: "ANCRAGE_MANQUANT", message: "Il manque une matière." };
  }

  const scriptsAvant = await d.scripts.lister((s) => s.scriptMaitreId === m.id && !s.archiveLe);
  const formatNouveau = !scriptsAvant.some((s) => s.formatId === format.id);
  const generation: GenerationScript = {
    id: nouvelId("gen"),
    scriptMaitreId: m.id,
    hachageContexte: empreinte(JSON.stringify([m.brief, format.id, mode, adresse, ancrage.id])),
    plafondUsd: scriptsAvant.length ? PLAFOND_SUPPLEMENT_USD : await plafondChaineUsd(await chaineDeLEcriture(m.brief.modeChoix)),
    portee: !scriptsAvant.length ? "sujet" : formatNouveau ? "format-supplementaire" : "corps-supplementaire",
    etapes: [],
    statut: "en-cours",
    simulee: true,
    estDemo: m.estDemo,
    ...horodatage(),
  };
  await d.generations.enregistrer(generation);
  await d.scriptsMaitres.modifier(m.id, { etat: "en-ecriture", manque: undefined, generationId: generation.id });

  // Point du PREMIER APPEL PAYANT (en simulation : rien n'est payé, mais c'est ici que le numéro est pris ; pas l'épisode).
  const numero = await attribuerNumero(m.id, { episode: false });
  const lance = maintenant();

  const ancrages: ScriptMaitre["ancrages"] = [{ matiereId: ancrage.id, type: ancrage.type, role: "principal", faible: false }];
  const motCle = motCleDe(m);
  const entree: EntreeSimulation = {
    idee: m.brief.idee,
    motCle,
    adresse,
    mode,
    objectif: m.brief.objectif,
    recette,
    ancrage: { matiereId: ancrage.id, texte: ancrage.texte, type: ancrage.type },
    prefixe: "",
  };
  const variantesSujet = await d.variantes.lister((v) => v.scriptMaitreId === m.id);
  let rang = versionsCourantes(variantesSujet, { avecArchivees: true }).length;

  // Textes : un seul corps (ouverture-fin, aucune), ou un corps par réseau (corps-distinct).
  const corpsParReseau: { reseaux: ReseauDeclinaison[]; script: Script }[] = [];
  const groupes = format.declinaison === "corps-distinct" ? reseaux.map((r) => [r]) : [reseaux];
  for (const groupe of groupes) {
    const scriptId = nouvelId("script");
    const blocs = simulerCorps({ ...entree, prefixe: scriptId }, recette.segmentsFacultatifsMax > 0 ? groupe.filter((r) => ecritureReseau(r).segmentFacultatif.valeur) : []);
    const script: Script = {
      id: scriptId,
      formatId: format.id,
      versionFormat: format.version,
      sujet: m.brief.idee,
      cible: m.brief.cible,
      adresse,
      version: 1,
      blocs,
      favori: false,
      reference: false,
      statutEditorial: "brouillon",
      ideeId: m.brief.ideeId,
      marqueId: m.marqueId,
      scriptMaitreId: m.id,
      mode,
      versionRecette: recette.version,
      estDemo: m.estDemo,
      ...horodatage(),
    };
    corpsParReseau.push({ reseaux: groupe, script });
  }

  // Versions par réseau : code stable, unicité (code, version) contrôlée sous verrou avec l'écriture.
  const nouvelles: VarianteReseau[] = [];
  for (const { reseaux: groupe, script } of corpsParReseau) {
    for (const reseau of groupe) {
      const code = codeVariante({ numero, codeFormat: format.codeClassement, reseau, mode, adresse });
      const sim = simulerVersion({ ...entree, prefixe: script.id }, reseau, rang++);
      const v: VarianteReseau = {
        id: nouvelId("var"),
        code,
        scriptMaitreId: m.id,
        scriptId: script.id,
        formatId: format.id,
        reseau,
        version: 1,
        versionRecette: recette.version,
        ouverture: sim.ouverture,
        fin: sim.fin,
        accrocheId: sim.accrocheId,
        motCle,
        appel: sim.appel,
        boucle: sim.boucle,
        segmentFacultatifRetenu: script.blocs.some((b) => b.segments.some((s) => s.facultatif === reseau)),
        dureeEstimeeSec: 0,
        ratios: [format.ratioMaitre, ...format.ratios.filter((r) => r !== format.ratioMaitre)],
        encadre: sim.encadre,
        publication: sim.publication,
        empreinteCorps: empreinteCorps(script.blocs),
        empreinteTexte: "",
        note: { globale: 0, criteres: {}, commentaire: "Écriture d'essai : aucune note." },
        controles: { passe: true, violations: [], versionControles: 0, le: lance },
        etat: "a-relire",
        estDemo: m.estDemo,
        ...horodatage(),
      };
      const texte = texteDesBlocs(assemblerBlocs(script, v));
      v.empreinteTexte = empreinte(texte);
      v.dureeEstimeeSec = Math.max(1, Math.round(texte.split(/\s+/).filter(Boolean).length / recette.debitParMode[mode]));
      nouvelles.push(v);
    }
  }
  await sousVerrou(async () => {
    const existantes = await d.variantes.lister((x) => nouvelles.some((n) => n.code === x.code));
    const actives = existantes.filter((x) => !x.archiveLe);
    if (actives.length) throw new ErreurStudio("DEJA_ECRIT", `Cette version existe déjà (${actives[0].code}) : retouchez-la depuis le sujet.`);
    for (const n of nouvelles) {
      n.version = Math.max(0, ...existantes.filter((x) => x.code === n.code).map((x) => x.version)) + 1;
      await verifierUnicite(n.code, n.version);
    }
    for (const { script } of corpsParReseau) await d.scripts.enregistrer(script);
    for (const n of nouvelles) await d.variantes.enregistrer(n);
  });

  await d.generations.modifier(generation.id, {
    etapes: [{ role: "simulation", versionConsigne: 0, modeleDemande: "simulation", effort: "aucun", lanceLe: lance, termineLe: maintenant(), estimationPireCasUsd: 0, resultat: "ok" }],
    statut: "terminee",
  });
  await d.scriptsMaitres.modifier(m.id, {
    etat: undefined,
    ancrages,
    motCle,
    motCleSource: m.brief.motCle?.source ?? "hypothese",
    brief: { ...m.brief, formatsDemandes: [...new Set([...m.brief.formatsDemandes, format.id])] },
  });
  if (m.brief.ideeId) {
    const idee = await d.idees.obtenir(m.brief.ideeId);
    if (idee && idee.etat === "nouvelle") await d.idees.modifier(idee.id, { etat: "en-script", scriptMaitreId: m.id });
  }
  await synchroniserSujet(m.id);
  await journaliser("sujet", `n° ${numero} : ${nouvelles.length} version(s) écrite(s) (essai, rien n'est payé)`, { type: "sujet", id: m.id });
  return { ok: true, numero, scriptIds: corpsParReseau.map((c) => c.script.id), varianteIds: nouvelles.map((n) => n.id), generationId: generation.id };
}

async function verifierUnicite(code: string, version: number, saufId?: Id): Promise<void> {
  const doublon = await depots().variantes.trouver((x) => x.code === code && x.version === version && x.id !== saufId);
  if (doublon) throw new ErreurStudio("VERSION_PRISE", `La version ${version} de ${code} existe déjà.`);
}

/* ------------------------------------------------------------------ */
/* Versions : retouches, validation, retour arrière                    */
/* ------------------------------------------------------------------ */

/** Version courante d'un code (la plus haute, archivée ou non). */
async function courante(code: string): Promise<VarianteReseau> {
  const toutes = await depots().variantes.lister((x) => x.code === code);
  if (!toutes.length) throw new ErreurStudio("INTROUVABLE", "Cette version n'existe plus.");
  return toutes.reduce((a, b) => (b.version > a.version ? b : a));
}

/** Écrit une nouvelle version d'un code (sous verrou : unicité (code, version)). L'ancienne est GARDÉE. */
async function nouvelleVersion(base: VarianteReseau, patch: Partial<VarianteReseau>): Promise<VarianteReseau> {
  return sousVerrou(async () => {
    const d = depots();
    const derniere = await courante(base.code);
    const suite: VarianteReseau = {
      ...derniere,
      ...patch,
      id: nouvelId("var"),
      version: derniere.version + 1,
      parentId: derniere.id,
      videoId: undefined,
      avisWill: undefined,
      caracteristiques: undefined,
      ...horodatage(),
    };
    await verifierUnicite(suite.code, suite.version);
    await d.variantes.enregistrer(suite);
    return suite;
  });
}

async function texteDeVersion(v: VarianteReseau): Promise<string> {
  const script = await depots().scripts.obtenir(v.scriptId);
  return texteDesBlocs(assemblerBlocs({ blocs: script?.blocs ?? [] }, v));
}

/**
 * Retouche d'UNE version (ouverture, fin, textes de publication, encadré) : nouvelle version « à relire », même code.
 * Le corps commun et les autres réseaux ne changent pas.
 */
export async function retoucherVariante(
  varianteId: Id,
  patch: { ouverture?: BlocScript[]; fin?: BlocScript[]; publication?: Partial<VarianteReseau["publication"]>; encadre?: VarianteReseau["encadre"] },
): Promise<VarianteReseau> {
  await exigerSession();
  const d = depots();
  const v = await d.variantes.obtenir(varianteId);
  if (!v) throw new ErreurStudio("INTROUVABLE", "Cette version n'existe plus.");
  if (v.archiveLe) throw new ErreurStudio("ARCHIVE", "Cette version est rangée.");
  const base = await courante(v.code);
  const suite = await nouvelleVersion(base, {
    ouverture: patch.ouverture ?? base.ouverture,
    fin: patch.fin ?? base.fin,
    publication: { ...base.publication, ...patch.publication },
    encadre: patch.encadre ?? base.encadre,
    etat: "a-relire",
  });
  // Relecture du script : les VRAIS contrôles sont refaits (barème « will » sur les phrases de Will), le téléprompteur suit.
  const recalcul = { empreinteTexte: empreinte(await texteDeVersion(suite)), ...(await apresChangementDeTexte(suite)) };
  await d.variantes.modifier(suite.id, recalcul);
  await synchroniserSujet(suite.scriptMaitreId);
  return { ...suite, ...recalcul };
}

/** Après un changement de texte : contrôles refaits au barème de chaque phrase, téléprompteur remis en forme. */
async function apresChangementDeTexte(v: VarianteReseau): Promise<Partial<VarianteReseau>> {
  const { controlerVersionStockee } = await import("./controles-version");
  const r = await controlerVersionStockee(v);
  const patch: Partial<VarianteReseau> = r ? { controles: r } : {};
  if (v.prompteur !== undefined) {
    const script = await depots().scripts.obtenir(v.scriptId);
    const { miseEnFormePrompteur } = await import("@/generateur/chaine");
    if (script) patch.prompteur = miseEnFormePrompteur(assemblerBlocs(script, v));
  }
  return patch;
}

/** Revalider ne perd pas le second oui donné au voyant rouge (`avisWill.malgreVoyant`, champ additif non déclaré dans types.ts : `malgreVoyant` et `origine` sont à déclarer dans un lot suivant autorisé à y toucher, d'où les casts). */
function gardeLaTrace(avis: VarianteReseau["avisWill"]): { malgreVoyant?: unknown } {
  const m = (avis as { malgreVoyant?: unknown } | undefined)?.malgreVoyant;
  return m ? { malgreVoyant: m } : {};
}

/**
 * Valide une version (avis de Will). L'usage des matières n'est consommé qu'ici (n° 44). Valider est GRATUIT : le
 * voyant rouge n'y demande rien. Le second oui est demandé au LANCEMENT de la voix payante (`fabriquerApresRelecture`).
 */
export async function validerVariante(varianteId: Id): Promise<VarianteReseau> {
  await exigerSession();
  const d = depots();
  const v = await d.variantes.obtenir(varianteId);
  if (!v) throw new ErreurStudio("INTROUVABLE", "Cette version n'existe plus.");
  if (v.archiveLe) throw new ErreurStudio("ARCHIVE", "Cette version est rangée.");
  if (v.etat === "a-completer") throw new ErreurStudio("A_COMPLETER", "Cette version attend encore un élément : complétez-la d'abord.");
  const maj = await d.variantes.modifier(v.id, { etat: "validee", avisWill: { resultat: "valide", le: maintenant(), ...gardeLaTrace(v.avisWill) } });
  await synchroniserSujet(v.scriptMaitreId);
  return maj;
}

/** « Revalider les N » après un milieu modifié (B.2.6) : valide ensemble les versions « à revoir » montrées à Will. */
export async function revaliderVariantes(varianteIds: Id[]): Promise<number> {
  await exigerSession();
  const d = depots();
  let n = 0;
  const sujets = new Set<Id>();
  for (const id of varianteIds) {
    const v = await d.variantes.obtenir(id);
    if (!v || v.archiveLe || v.etat !== "a-reverifier") continue;
    await d.variantes.modifier(id, { etat: "validee", avisWill: { resultat: "valide", le: maintenant(), ...gardeLaTrace(v.avisWill) } });
    sujets.add(v.scriptMaitreId);
    n++;
  }
  for (const s of sujets) await synchroniserSujet(s);
  return n;
}

/** Refus motivé d'une version (pastilles en un toucher) : elle repasse « à relire », le motif est gardé. */
export async function rejeterVariante(varianteId: Id, motifs: NonNullable<NonNullable<VarianteReseau["avisWill"]>["motifs"]>, note?: string): Promise<VarianteReseau> {
  await exigerSession();
  const d = depots();
  const v = await d.variantes.obtenir(varianteId);
  if (!v) throw new ErreurStudio("INTROUVABLE", "Cette version n'existe plus.");
  const maj = await d.variantes.modifier(v.id, { etat: "a-relire", avisWill: { resultat: "rejete", motifs, note, le: maintenant() } });
  await synchroniserSujet(v.scriptMaitreId);
  return maj;
}

/** « Revenir à la version d'avant » : une NOUVELLE version identique à la précédente (l'historique reste lisible). */
export async function revenirVersionPrecedente(varianteId: Id): Promise<VarianteReseau> {
  await exigerSession();
  const d = depots();
  const v = await d.variantes.obtenir(varianteId);
  if (!v) throw new ErreurStudio("INTROUVABLE", "Cette version n'existe plus.");
  const base = await courante(v.code);
  const avant = base.parentId ? await d.variantes.obtenir(base.parentId) : null;
  if (!avant) throw new ErreurStudio("PAS_D_AVANT", "Il n'y a pas de version d'avant.");
  const { id: _id, version: _v, parentId: _p, creeLe: _c, modifieLe: _m, ...contenu } = avant;
  void _id;
  void _v;
  void _p;
  void _c;
  void _m;
  const suite = await nouvelleVersion(base, { ...contenu, etat: "a-relire", archiveLe: undefined, archiveParCascade: undefined });
  await synchroniserSujet(suite.scriptMaitreId);
  return suite;
}

/* ------------------------------------------------------------------ */
/* Corps commun : retouche et report (B.2.6)                           */
/* ------------------------------------------------------------------ */

/**
 * Après une nouvelle version d'un corps (`scriptId`, dont `parentId` = l'ancien) : chaque version courante qui pointait
 * vers l'ancien corps et dont l'empreinte diffère reçoit une nouvelle version vers le nouveau corps, « Milieu modifié,
 * à revoir » ; l'ancienne est gardée. Les contrôles sont VRAIMENT relancés (barème de chaque phrase).
 */
export async function reporterCorps(scriptId: Id): Promise<Id[]> {
  const d = depots();
  const script = await d.scripts.obtenir(scriptId);
  if (!script?.scriptMaitreId || !script.parentId) return [];
  const anciens = new Set<Id>();
  for (let p: Script | null = await d.scripts.obtenir(script.parentId); p; p = p.parentId ? await d.scripts.obtenir(p.parentId) : null) anciens.add(p.id);
  const nouvelle = empreinteCorps(script.blocs);
  const aReporter = versionsCourantes(await d.variantes.lister((v) => v.scriptMaitreId === script.scriptMaitreId)).filter((v) => anciens.has(v.scriptId) && v.empreinteCorps !== nouvelle);
  const ids: Id[] = [];
  for (const v of aReporter) {
    const suite = await nouvelleVersion(v, { scriptId: script.id, empreinteCorps: nouvelle, etat: "a-reverifier" });
    await d.variantes.modifier(suite.id, { empreinteTexte: empreinte(texteDesBlocs(assemblerBlocs(script, suite))), ...(await apresChangementDeTexte(suite)) });
    ids.push(suite.id);
  }
  await synchroniserSujet(script.scriptMaitreId);
  return ids;
}

/** Retouche du CORPS commun : nouvelle version du texte, puis report sur les N versions (« Modifier (change les N versions) »). */
export async function retoucherCorps(scriptId: Id, blocs: BlocScript[]): Promise<{ scriptId: Id; reportees: Id[] }> {
  await exigerSession();
  const d = depots();
  const s = await d.scripts.obtenir(scriptId);
  if (!s?.scriptMaitreId) throw new ErreurStudio("INTROUVABLE", "Ce texte n'est rattaché à aucun sujet.");
  const nouveau: Script = { ...s, id: nouvelId("script"), version: s.version + 1, parentId: s.id, blocs, statutEditorial: "brouillon", creePourVideoId: undefined, ...horodatage() };
  await d.scripts.enregistrer(nouveau);
  return { scriptId: nouveau.id, reportees: await reporterCorps(nouveau.id) };
}

/**
 * Texte édité depuis l'assistant pour une vidéo rattachée à une version (`enregistrerScriptDuBrouillon`, G1a) :
 * l'ouverture et la fin vont dans une nouvelle version de la variante, le corps dans le `Script` (reporté sur les N).
 * Les segments facultatifs des AUTRES réseaux sont gardés tels quels dans le corps.
 */
export async function enregistrerTexteVariante(videoId: Id, blocs: BlocScript[]): Promise<Script> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  if (!video?.varianteId) throw new ErreurStudio("INTROUVABLE", "Cette vidéo n'est rattachée à aucune version.");
  const v0 = await d.variantes.obtenir(video.varianteId);
  if (!v0) throw new ErreurStudio("INTROUVABLE", "Cette version n'existe plus.");
  let v = await courante(v0.code);
  let script = await d.scripts.obtenir(v.scriptId);
  if (!script) throw new ErreurStudio("INTROUVABLE", "Ce texte n'existe plus.");
  const { ouverture, corps, fin } = repartirBlocs(blocs, formatGenerateur(v.formatId).recette.partiesDeclinaison);

  const corpsActuel = assemblerBlocs(script, { ...v, ouverture: [], fin: [] });
  if (empreinteCorps(corps) !== empreinteCorps(corpsActuel)) {
    const autres = script.blocs.map((b) => ({ ...b, segments: b.segments.filter((s) => s.facultatif && s.facultatif !== v.reseau) }));
    const fusion = corps.map((b) => ({ ...b, segments: [...b.segments, ...(autres.find((a) => a.blocRecette === b.blocRecette)?.segments ?? [])] }));
    const r = await retoucherCorps(script.id, fusion);
    script = (await d.scripts.obtenir(r.scriptId))!;
    v = await courante(v.code);
  }
  if (empreinte(JSON.stringify([ouverture, fin])) !== empreinte(JSON.stringify([v.ouverture, v.fin]))) {
    v = await retoucherVariante(v.id, { ouverture, fin });
  }
  await d.videos.modifier(videoId, { scriptId: script.id, varianteId: v.id });
  await synchroniserSujet(v.scriptMaitreId);
  return script;
}

/* ------------------------------------------------------------------ */
/* Source de vérité des états (B.2.5)                                  */
/* ------------------------------------------------------------------ */

/**
 * Recopie l'état calculé dans les champs existants : `Video.etapeEditoriale` (vidéos rattachées) et
 * `Script.statutEditorial` (textes rattachés : « valide » ssi toutes leurs versions courantes sont validées).
 * N'écrit que ce qui diffère. À appeler après chaque transition ET après chaque fabrication.
 */
export async function synchroniserSujet(scriptMaitreId: Id): Promise<void> {
  const d = depots();
  const variantes = await d.variantes.lister((v) => v.scriptMaitreId === scriptMaitreId);
  const ids = new Set(variantes.map((v) => v.id));
  const videos = await d.videos.lister((x) => !!x.varianteId && ids.has(x.varianteId));
  const publications = await d.publications.lister((p) => (!!p.varianteId && ids.has(p.varianteId)) || videos.some((x) => x.id === p.videoId));
  for (const video of videos) {
    const v = variantes.find((x) => x.id === video.varianteId)!;
    const etape = etapeEditorialeDe(etatReseau(v, video, publications));
    if (etape && video.etapeEditoriale !== etape) await d.videos.modifier(video.id, { etapeEditoriale: etape });
  }
  for (const s of await d.scripts.lister((x) => x.scriptMaitreId === scriptMaitreId)) {
    const statut = statutEditorialDerive(s.id, variantes);
    if (s.statutEditorial !== statut) await d.scripts.modifier(s.id, { statutEditorial: statut });
  }
}

/** Synchronise le sujet d'une version. */
export async function synchroniserEtats(varianteId: Id): Promise<void> {
  const v = await depots().variantes.obtenir(varianteId);
  if (v) await synchroniserSujet(v.scriptMaitreId);
}

/**
 * Après une fabrication (qui écrit aujourd'hui `statutEditorial: "valide"` et `etapeEditoriale: "a_relire"`,
 * `fabrication.ts` et `travaux.ts`, jamais modifiés par le générateur) : remet la copie d'accord avec la version.
 */
export async function synchroniserApresFabrication(videoId: Id): Promise<void> {
  const video = await depots().videos.obtenir(videoId);
  if (video?.varianteId) await synchroniserEtats(video.varianteId);
}

/** Rattache une vidéo à une version (réseau, code) : la vidéo prend le réseau de la version. */
export async function rattacherVideoAVariante(videoId: Id, varianteId: Id): Promise<void> {
  const d = depots();
  const v = await d.variantes.obtenir(varianteId);
  if (!v) throw new ErreurStudio("INTROUVABLE", "Cette version n'existe plus.");
  await d.videos.modifier(videoId, { varianteId: v.id, reseau: v.reseau, scriptId: v.scriptId });
  await d.variantes.modifier(v.id, { videoId });
  await synchroniserSujet(v.scriptMaitreId);
}

/* ------------------------------------------------------------------ */
/* Archivage en cascade et restauration (B.2.7)                        */
/* ------------------------------------------------------------------ */

/** Archive un sujet ET ses versions (`archiveParCascade`) ; ses réservations de série sont libérées. Rien n'est effacé. */
export async function archiverSujet(scriptMaitreId: Id): Promise<number> {
  await exigerSession();
  const d = depots();
  const m = await d.scriptsMaitres.obtenir(scriptMaitreId);
  if (!m || m.archiveLe) return 0;
  const le = maintenant();
  await d.scriptsMaitres.modifier(m.id, { archiveLe: le });
  let n = 0;
  for (const v of await d.variantes.lister((x) => x.scriptMaitreId === m.id && !x.archiveLe)) {
    await d.variantes.modifier(v.id, { archiveLe: le, archiveParCascade: m.id });
    n++;
  }
  await synchroniserSujet(m.id);
  await journaliser("sujet", `Sujet rangé${m.numero !== undefined ? ` : n° ${m.numero}` : ""} (${n} version(s))`, { type: "sujet", id: m.id });
  return n;
}

/** Restaure un sujet : ne défait QUE le mouvement d'archivage du sujet (une version rangée à part reste rangée). */
export async function restaurerSujet(scriptMaitreId: Id): Promise<number> {
  await exigerSession();
  const d = depots();
  const m = await d.scriptsMaitres.obtenir(scriptMaitreId);
  if (!m?.archiveLe) return 0;
  await d.scriptsMaitres.modifier(m.id, { archiveLe: undefined });
  let n = 0;
  for (const v of await d.variantes.lister((x) => x.archiveParCascade === m.id)) {
    await d.variantes.modifier(v.id, { archiveLe: undefined, archiveParCascade: undefined });
    n++;
  }
  await synchroniserSujet(m.id);
  return n;
}

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

export interface VueSujet {
  maitre: ScriptMaitre;
  etat: EtatSujet;
  grille: LigneGrille[];
}

/** Sujets (exemples masqués selon le réglage), brouillons sans numéro en tête, puis du plus récent au plus ancien. */
export async function listerSujets(options: { inclureArchives?: boolean } = {}): Promise<VueSujet[]> {
  await exigerSession();
  const d = depots();
  const exemples = await filtreExemples<ScriptMaitre>();
  const maitres = await d.scriptsMaitres.lister((m) => exemples(m) && (options.inclureArchives || !m.archiveLe));
  const ids = new Set(maitres.map((m) => m.id));
  const [scripts, variantes] = await Promise.all([d.scripts.lister((s) => !!s.scriptMaitreId && ids.has(s.scriptMaitreId)), d.variantes.lister((v) => ids.has(v.scriptMaitreId))]);
  const vids = new Set(variantes.map((v) => v.id));
  const videos = await d.videos.lister((x) => !!x.varianteId && vids.has(x.varianteId));
  const publications = await d.publications.lister((p) => (!!p.varianteId && vids.has(p.varianteId)) || videos.some((x) => x.id === p.videoId));
  return maitres
    .map((m) => ({ maitre: m, etat: etatSujet(m, variantes, videos, publications), grille: grilleSujet(m, scripts, variantes, videos, publications) }))
    .sort((a, b) => Number(a.maitre.numero !== undefined) - Number(b.maitre.numero !== undefined) || b.maitre.creeLe.localeCompare(a.maitre.creeLe));
}

/* ================================================================== */
/* LOT G1b (écrans et classement) : AJOUTS EN FIN DE FICHIER SEULEMENT */
/* ================================================================== */

type Video = import("@/domaine/types").Video;

export interface VueVersion {
  variante: VarianteReseau;
  /** Texte assemblé (ouverture + corps + fin), affiché seulement. */
  texte: string;
  accroche: string;
  videoId?: Id;
}

export interface VueSujetDetail extends VueSujet {
  scripts: Script[];
  /** Versions courantes (non archivées), dans l'ordre de la grille. */
  versions: VueVersion[];
}

/** Fiche sujet (B.6.7) : le sujet, sa grille et ses versions courantes avec leur texte assemblé. */
export async function obtenirSujet(id: Id): Promise<VueSujetDetail | null> {
  await exigerSession();
  const d = depots();
  const maitre = await d.scriptsMaitres.obtenir(id);
  if (!maitre) return null;
  const [scripts, variantes] = await Promise.all([d.scripts.lister((s) => s.scriptMaitreId === id), d.variantes.lister((v) => v.scriptMaitreId === id)]);
  const vids = new Set(variantes.map((v) => v.id));
  const videos = await d.videos.lister((x) => !!x.varianteId && vids.has(x.varianteId));
  const publications = await d.publications.lister((p) => (!!p.varianteId && vids.has(p.varianteId)) || videos.some((x) => x.id === p.videoId));
  const grille = grilleSujet(maitre, scripts, variantes, videos, publications);
  const ordreCodes = grille.flatMap((l) => Object.values(l.cases).map((c) => c.code)).filter(Boolean) as string[];
  const versions = versionsCourantes(variantes)
    .sort((a, b) => ordreCodes.indexOf(a.code) - ordreCodes.indexOf(b.code))
    .map((v) => {
      const script = scripts.find((s) => s.id === v.scriptId);
      return {
        variante: v,
        texte: texteDesBlocs(assemblerBlocs({ blocs: script?.blocs ?? [] }, v)),
        accroche: v.ouverture[0]?.segments[0]?.texte ?? "",
        videoId: videos.find((x) => x.varianteId === v.id)?.id,
      };
    });
  return { maitre, etat: etatSujet(maitre, variantes, videos, publications), grille, scripts: scripts.filter((s) => !s.archiveLe), versions };
}

/** Écran Sujet (B.6.5) : crée le sujet puis lance l'écriture (simulée tant que Claude n'est pas branché). */
export async function creerEtEcrireSujet(brief: BriefSujet): Promise<{ scriptMaitreId: Id; resultat: ResultatEcriture }> {
  const m = await creerSujet(brief);
  return { scriptMaitreId: m.id, resultat: await ecrireSujetSimule(m.id) };
}

/**
 * Carte « Il manque une matière » : la matière dictée par Will (verbatim, validée d'office : c'est lui) est jointe au
 * sujet, puis l'écriture reprend. Gratuit jusqu'à l'écriture.
 */
export async function completerSujetParMatiere(scriptMaitreId: Id, texte: string): Promise<ResultatEcriture> {
  await exigerSession();
  const t = texte.trim();
  if (!t) throw new ErreurStudio("VIDE", "Dictez ou écrivez la matière.");
  const d = depots();
  const m = await d.scriptsMaitres.obtenir(scriptMaitreId);
  if (!m) throw new ErreurStudio("INTROUVABLE", "Ce sujet n'existe plus.");
  const matiere: Matiere = {
    id: nouvelId("mat"),
    type: m.manque?.typeMatiereSuggere ?? proposerTypeMatiere(t),
    texte: t,
    source: { origine: "dictee", date: maintenant() },
    motsCles: [],
    pilier: m.brief.pilier,
    saisiePar: "will",
    statut: "validee",
    estDemo: m.estDemo,
    ...horodatage(),
  };
  await d.matieres.enregistrer(matiere);
  await d.scriptsMaitres.modifier(m.id, { brief: { ...m.brief, matiereIdsImposees: [matiere.id, ...(m.brief.matiereIdsImposees ?? [])] } });
  return ecrireSujetSimule(m.id);
}

/** « C'est juste » ou la limite corrigée au micro (B.6.7) : la limite du sujet est validée par Will. */
export async function validerLimite(scriptMaitreId: Id, texteCorrige?: string): Promise<void> {
  await exigerSession();
  const d = depots();
  const m = await d.scriptsMaitres.obtenir(scriptMaitreId);
  if (!m?.exception) return;
  const texte = texteCorrige?.trim() || m.exception.texte;
  await d.scriptsMaitres.modifier(m.id, { exception: { ...m.exception, texte, valideeParWill: true } });
}

/** « Valider les N » : valide les versions « à relire » données (les autres sont laissées telles quelles). */
export async function validerVersions(varianteIds: Id[]): Promise<number> {
  await exigerSession();
  let n = 0;
  for (const id of varianteIds) {
    const v = await depots().variantes.obtenir(id);
    if (!v || v.archiveLe || v.etat !== "a-relire") continue;
    await validerVariante(id);
    n++;
  }
  return n;
}

/**
 * « À ranger » (B.6.19) : rattache une ancienne vidéo (sans réseau) à une version. Refusé si la version a déjà sa vidéo
 * (une version, au plus une vidéo).
 */
export async function rangerVideo(videoId: Id, varianteId: Id): Promise<void> {
  await exigerSession();
  const d = depots();
  const [video, v] = await Promise.all([d.videos.obtenir(videoId), d.variantes.obtenir(varianteId)]);
  if (!video) throw new ErreurStudio("INTROUVABLE", "Cette vidéo n'existe plus.");
  if (!v || v.archiveLe) throw new ErreurStudio("INTROUVABLE", "Cette version n'existe plus.");
  if (v.videoId && v.videoId !== videoId) throw new ErreurStudio("DEJA_RANGEE", `La version ${v.code} a déjà sa vidéo.`);
  await rattacherVideoAVariante(videoId, varianteId);
}

/** Vidéos « À ranger » : ni réseau ni version, non archivées (exemples selon le réglage). */
export async function listerVideosARanger(): Promise<Video[]> {
  const ex = await filtreExemples<Video>();
  return (await depots().videos.lister((v) => ex(v) && !v.varianteId && !v.reseau && v.statut !== "archivee" && v.statut !== "annulee")).sort((a, b) => b.creeLe.localeCompare(a.creeLe));
}

/** Versions sans vidéo, pour la feuille « Ranger » (code, sujet). */
export async function listerVersionsSansVideo(): Promise<{ id: Id; code: string; reseau: ReseauDeclinaison; sujet: string; numero?: number }[]> {
  await exigerSession();
  const d = depots();
  const ex = await filtreExemples<ScriptMaitre>();
  const maitres = await d.scriptsMaitres.lister((m) => ex(m) && !m.archiveLe && m.numero !== undefined);
  const ids = new Set(maitres.map((m) => m.id));
  const vs = versionsCourantes(await d.variantes.lister((v) => ids.has(v.scriptMaitreId))).filter((v) => !v.videoId);
  return vs
    .map((v) => {
      const m = maitres.find((x) => x.id === v.scriptMaitreId)!;
      return { id: v.id, code: v.code, reseau: v.reseau, sujet: m.angle?.titre ?? m.brief.idee, numero: m.numero };
    })
    .sort((a, b) => b.code.localeCompare(a.code));
}

/** Tuiles d'Accueil du générateur (B.6.13). */
export async function compteursGenerateur(): Promise<{ aRelire: number; manqueMatiere: number; pretAFabriquer: number; aProgrammer: number; aRanger: number }> {
  const vues = await listerSujets();
  const cases = (v: VueSujet) => v.grille.flatMap((l) => Object.values(l.cases).map((c) => c.etat));
  return {
    aRelire: vues.filter((v) => cases(v).some((e) => e === "a-relire" || e === "a-completer" || e === "a-reverifier")).length,
    manqueMatiere: vues.filter((v) => v.maitre.manque && ["ANCRAGE_MANQUANT", "MATIERE_INSUFFISANTE", "MATIERE_A_PRECISER"].includes(v.maitre.manque.type)).length,
    pretAFabriquer: vues.filter((v) => cases(v).includes("validee")).length,
    // E2E-2 parcours n° 18 : la tuile compte les sujets que la fiche propose vraiment de programmer (pas ceux déjà faits).
    aProgrammer: await compterAProgrammer(vues.filter((v) => cases(v).includes("en-video") && !v.maitre.archiveLe).map((v) => v.maitre.id)),
    aRanger: (await listerVideosARanger()).length,
  };
}

async function compterAProgrammer(ids: Id[]): Promise<number> {
  if (!ids.length) return 0;
  const { planProgrammerSujet } = await import("./mesures");
  let n = 0;
  for (const id of ids) if ((await planProgrammerSujet(id).catch(() => null))?.creneaux.length) n++;
  return n;
}

/** Version d'où vient une vidéo : son code, son réseau et ses champs de publication (kit, B.5.3, B.6.11). */
export async function versionDeVideo(
  videoId: Id,
): Promise<{ id: Id; code: string; reseau: ReseauDeclinaison; version: number; scriptMaitreId: Id; numero?: number; titre: string; publication: VarianteReseau["publication"] } | null> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  if (!video?.varianteId) return null;
  const v = await d.variantes.obtenir(video.varianteId);
  if (!v) return null;
  const m = await d.scriptsMaitres.obtenir(v.scriptMaitreId);
  return { id: v.id, code: v.code, reseau: v.reseau, version: v.version, scriptMaitreId: v.scriptMaitreId, numero: m?.numero, titre: m?.angle?.titre ?? m?.brief.idee ?? video.titre, publication: v.publication };
}

/** Valeurs des filtres « Thème » et « Série » (feuille « Plus de filtres ») : thèmes validés par Will, séries existantes. */
export async function valeursFiltresGenerateur(): Promise<{ piliers: { id: string; nom: string }[]; series: { id: string; nom: string }[] }> {
  await exigerSession();
  const d = depots();
  const contextes = (await d.contexteAxion.lister()).sort((a, b) => b.version - a.version);
  const series = await d.series.lister();
  return { piliers: (contextes[0]?.piliers ?? []).map((p) => ({ id: p.id, nom: p.nom })), series: series.map((s) => ({ id: s.id, nom: s.nom })) };
}
