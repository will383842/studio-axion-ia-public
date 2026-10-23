/**
 * PERSONNAGES, VISAGES, VOIX (B.8 #13, #14 ; B.4-6 accord obligatoire et bloquant).
 * Lot M0b (A1, 02/10) : « Relier ma voix HeyGen » — lister les voix déjà créées chez HeyGen, les écouter par le relais
 * du studio, en relier une au personnage (`relierVoixExistante`) ; l'écoute d'essai passe par le relais.
 */
import "server-only";
import type { Accord, AngleVisage, Id, Montant, NaturePersonnage, Personnage, PostureVisage, ReglagesVoix, Visage, Voix } from "@/domaine/types";
import { normaliserTenue } from "@/domaine/distribution";
import { trouverFormat } from "@/formats";
import { etatConnexion, resoudreFournisseur, type VoixExistante } from "@/fournisseurs";
import { urlEcoute } from "@/fournisseurs/heygen/ecoute";
import { LOOKS_HEYGEN_PAR_LE_STUDIO } from "@/fournisseurs/heygen/rendus";
import { nouvelId } from "@/lib/ids";
import { depots, enregistrerRessource, fournisseur, ressourceActive, ErreurStudio, filtreExemples, horodatage, journaliser } from "./_commun";
import { prononciationsActives } from "@/domaine/prononciations";
import { estMoiReel } from "@/domaine/moi";
import { trouverMoi } from "./moi";
import { exigerSession } from "./auth";
import { lirePhrase } from "./prononciations";
import { urlFichier } from "./fichiers";
import type { VuePersonnage } from "./vues";

export function accordComplet(p: Pick<Personnage, "nature" | "accord">): boolean {
  if (p.nature !== "reel") return true;
  return !!(p.accord?.case && p.accord.documentFichierId && p.accord.date);
}

async function versVue(p: Personnage): Promise<VuePersonnage> {
  const d = depots();
  const visages = await d.visages.lister((v) => v.personnageId === p.id);
  const voix = await d.voix.lister((v) => v.personnageId === p.id);
  const accordValide = accordComplet(p);
  const alertes: string[] = [];
  if (!accordValide) alertes.push("Accord manquant");
  if (!visages.some((v) => v.statut === "pret")) alertes.push("Aucun visage prêt");
  if (!voix.some((v) => v.statut === "pret")) alertes.push("Voix manquante");
  return {
    personnage: p,
    photo: await urlFichier(p.photoFichierId),
    visages: await Promise.all(visages.map(async (v) => ({ ...v, vignette: await urlFichier(v.vignetteFichierId) }))),
    voix,
    accordValide,
    utilisable: accordValide && visages.some((v) => v.statut === "pret") && voix.some((v) => v.statut === "pret"),
    alertes,
  };
}

export async function listerPersonnages(): Promise<VuePersonnage[]> {
  const exemples = await filtreExemples<Personnage>();
  const liste = await depots().personnages.lister(exemples);
  liste.sort((a, b) => Number(b.principal) - Number(a.principal) || a.creeLe.localeCompare(b.creeLe));
  return Promise.all(liste.map(versVue));
}

export async function obtenirPersonnage(id: Id): Promise<VuePersonnage | null> {
  const p = await depots().personnages.obtenir(id);
  return p ? versVue(p) : null;
}

export async function creerPersonnage(donnees: { nom: string; nature: NaturePersonnage; role?: string }): Promise<Id> {
  await exigerSession();
  // TEST-UI-REEL U1 : le personnage d'EXEMPLE (« p-will ») n'empêche jamais Will de se créer.
  if (donnees.nature === "moi" && (await depots().personnages.trouver(estMoiReel))) {
    throw new ErreurStudio("DEJA_MOI", "Vous existez déjà dans vos personnages.");
  }
  const p: Personnage = {
    id: nouvelId("p"),
    nom: donnees.nom.trim(),
    nature: donnees.nature,
    role: donnees.role,
    // Le vrai « Moi » est le personnage principal (avant celui d'exemple).
    principal: donnees.nature === "moi",
    accord: donnees.nature === "reel" ? { case: false } : undefined,
    ...horodatage(),
  };
  await depots().personnages.enregistrer(p);
  await journaliser("personnage", `Personnage ajouté : ${p.nom}${p.nature === "reel" ? " (accord en attente)" : ""}`, { type: "personnage", id: p.id });
  return p.id;
}

export async function modifierPersonnage(id: Id, patch: Partial<Pick<Personnage, "nom" | "role" | "photoFichierId" | "couleurAccent">>): Promise<void> {
  await exigerSession();
  await depots().personnages.modifier(id, patch);
}

/** Enregistre la preuve d'accord (case + document déposé + date). */
export async function enregistrerAccord(id: Id, accord: Accord): Promise<void> {
  await exigerSession();
  if (!accord.case || !accord.documentFichierId || !accord.date) {
    throw new ErreurStudio("ACCORD_INCOMPLET", "Cochez la case, déposez le document et indiquez la date.");
  }
  await depots().personnages.modifier(id, { accord });
  await journaliser("accord", "Accord enregistré", { type: "personnage", id });
}

async function exigerAccord(personnageId: Id): Promise<Personnage> {
  const p = await depots().personnages.obtenir(personnageId);
  if (!p) throw new ErreurStudio("INTROUVABLE", "Ce personnage n'existe plus.");
  if (!accordComplet(p)) throw new ErreurStudio("ACCORD_MANQUANT", `Enregistrez d'abord l'accord de ${p.nom}.`);
  return p;
}

/** Ajoute un visage (bloqué sans accord pour une personne réelle). */
export async function ajouterVisage(personnageId: Id, donnees: { nom: string; angle: AngleVisage; tenue: string; fondTournage: string; fichierIds: Id[]; posture?: PostureVisage }): Promise<Id> {
  await exigerSession();
  await exigerAccord(personnageId);
  // Tenue NORMALISÉE (deux visages de même tenue la partagent) ; un double déposé est filmé, assis par défaut (B.0 §3-4).
  const v: Visage = {
    id: nouvelId("vis"),
    personnageId,
    statut: "brouillon",
    fournisseur: (await fournisseur("visage")).id,
    ...donnees,
    tenueId: normaliserTenue(donnees.tenue) || undefined,
    posture: donnees.posture ?? "assis",
    origine: "filme",
    ...horodatage(),
  };
  await depots().visages.enregistrer(v);
  return v.id;
}

/** Lance la préparation du double chez le fournisseur (simulé : prêt presque tout de suite). */
export async function preparerVisage(visageId: Id): Promise<void> {
  await exigerSession();
  const d = depots();
  const v = await d.visages.obtenir(visageId);
  if (!v) throw new ErreurStudio("INTROUVABLE", "Ce visage n'existe plus.");
  const p = await exigerAccord(v.personnageId);
  const f = await fournisseur("visage");
  // `matting` : sans lui, pas de fond transparent chez HeyGen (B.0 §9).
  const { idExterne } = await f.creerDouble({ visageId, nature: p.nature, accord: p.accord, fichierIds: v.fichierIds, matting: true });
  const qualite = await f.noterQualite(v.fichierIds);
  await enregistrerRessource({ id: nouvelId("rf"), entite: "visage", entiteId: visageId, fournisseur: f.id, idExterne, statut: "pret", ...horodatage() });
  await d.visages.modifier(visageId, { statut: "pret", qualite, versionFournisseur: "sim-1" });
  await d.notifications.enregistrer({ id: nouvelId("not"), type: "visage-pret", titre: `Le double « ${v.nom} » est prêt`, lien: `/personnages/${v.personnageId}`, lue: false, ...horodatage() });
}

/**
 * « Tester » un visage : la phrase est d'abord lue par la voix du personnage, puis le double est rendu
 * sur ce son (le visage parle TOUJOURS sur un son déjà fabriqué, B.0 §9). Renvoie l'adresse de l'essai.
 */
export async function testerVisage(visageId: Id, texte: string): Promise<string> {
  await exigerSession();
  const d = depots();
  const visage = await d.visages.obtenir(visageId);
  const personnage = visage ? await d.personnages.obtenir(visage.personnageId) : null;
  const voixPerso = visage ? await d.voix.lister((v) => v.personnageId === visage.personnageId && v.statut === "pret") : [];
  const voix = voixPerso.find((v) => v.id === personnage?.voixParDefautId) ?? voixPerso[0];
  let audioCle = "";
  if (voix) {
    const prononciations = prononciationsActives(await d.prononciations.lister(), { voixId: voix.id, personnageId: voix.personnageId });
    // E2E-2 argent n° 14 : même chaîne que le reste — contrôle du budget et du crédit, puis dépense enregistrée au nom
    // du fournisseur de la voix (HeyGen…). 400 caractères au plus.
    audioCle = (await lirePhrase(texte, { voixId: voix.id, prononciations, etape: "Essai d'un visage" })).fichierCle ?? "";
  }
  const r = await ressourceActive(visageId);
  return (await (await fournisseur("visage")).tester(r?.idExterne ?? "", audioCle)).fichierCle;
}

/** Enregistre ou complète la voix d'un personnage (bloqué sans accord). */
export async function enregistrerVoix(personnageId: Id, donnees: { fichierIds: Id[]; minutes: number; langue?: Voix["langue"] }): Promise<Id> {
  await exigerSession();
  const p = await exigerAccord(personnageId);
  const d = depots();
  const existante = await d.voix.trouver((v) => v.personnageId === personnageId);
  const f = await fournisseur("voix");
  const minutes = (existante?.minutesEnregistrees ?? 0) + donnees.minutes;
  const voixId = existante?.id ?? nouvelId("voix");
  const { idExterne, statut } = await f.copierVoix({ voixId, nature: p.nature, accord: p.accord, fichierIds: donnees.fichierIds, minutes });
  const voix: Voix = {
    id: voixId,
    personnageId,
    nom: existante?.nom ?? (p.nature === "moi" ? "Ma voix" : `Voix de ${p.nom}`),
    langue: donnees.langue ?? existante?.langue ?? "fr-FR",
    minutesEnregistrees: minutes,
    statut,
    reglages: existante?.reglages ?? { vitesse: 1, stabilite: 60, emotion: 50 },
    fichierIds: [...(existante?.fichierIds ?? []), ...donnees.fichierIds],
    fournisseur: f.id,
    creeLe: existante?.creeLe ?? new Date().toISOString(),
    modifieLe: new Date().toISOString(),
  };
  await d.voix.enregistrer(voix);
  await enregistrerRessource({ id: nouvelId("rf"), entite: "voix", entiteId: voixId, fournisseur: f.id, idExterne, statut, ...horodatage() });
  return voixId;
}

export async function modifierReglagesVoix(voixId: Id, reglages: ReglagesVoix): Promise<void> {
  await exigerSession();
  await depots().voix.modifier(voixId, { reglages });
}

/** « Écouter un essai » : adresse d'écoute d'un court fichier audio (par le relais du studio pour une voix réelle). */
export async function ecouterEssaiVoix(voixId: Id, texte: string): Promise<{ url: string; dureeSec: number; cout: Montant; simulee: boolean }> {
  await exigerSession();
  const d = depots();
  const voix = await d.voix.obtenir(voixId);
  if (!voix) throw new ErreurStudio("INTROUVABLE", "Cette voix n'existe plus.");
  const prononciations = prononciationsActives(await d.prononciations.lister(), { voixId: voix.id, personnageId: voix.personnageId });
  // Le fournisseur de CETTE voix (HeyGen, ElevenLabs en secours, simulation), jamais le réglage global (B.0 §9).
  const r = await lirePhrase(texte, { voixId, prononciations, etape: "Écoute de la voix" });
  return { url: r.url, dureeSec: r.dureeSec, cout: r.cout, simulee: r.simulee };
}

/* --- Lot M0b : relier une voix déjà créée chez HeyGen ------------------- */

/** Une voix HeyGen telle que l'écran la montre : l'aperçu passe par le relais du studio. */
export interface VoixHeygenAffichee extends Omit<VoixExistante, "apercuUrl"> {
  apercu: string;
  /** Déjà reliée à ce personnage (identifiant de la voix du studio). */
  relieeA?: Id;
}

/** Voix privées du compte HeyGen (simulées tant que la clé n'est pas posée). */
export async function listerVoixHeygen(personnageId?: Id): Promise<{ voix: VoixHeygenAffichee[]; simulee: boolean }> {
  await exigerSession();
  const f = resoudreFournisseur("voix", "heygen");
  const liste = await f.listerVoixExistantes();
  const reliees = await depots().ressourcesFournisseurs.lister((r) => r.entite === "voix" && r.fournisseur === "heygen" && !r.remplaceeLe);
  const voixDuPersonnage = personnageId ? new Set((await depots().voix.lister((v) => v.personnageId === personnageId)).map((v) => v.id)) : null;
  return {
    simulee: f.mode === "simulation" || etatConnexion("voix", "heygen") !== "relie",
    voix: liste.map(({ apercuUrl, ...v }) => ({
      ...v,
      apercu: urlEcoute(apercuUrl),
      relieeA: reliees.find((r) => r.idExterne === v.idExterne && (!voixDuPersonnage || voixDuPersonnage.has(r.entiteId)))?.entiteId,
    })),
  };
}

/**
 * Relie une voix HeyGen existante au personnage (B.0 §17) : une `Voix` prête (`minutesEnregistrees: 0`, fournisseur
 * `heygen`) et sa `RessourceFournisseur { idExterne: voice_id, versionModele: 'instant' }`. Accord exigé pour une
 * personne réelle. La voix reliée devient la voix par défaut du personnage ; les autres voix restent (jamais effacées).
 * Relier deux fois la même voix ne crée rien de plus.
 */
export async function relierVoixExistante(personnageId: Id, idExterne: string): Promise<Id> {
  await exigerSession();
  const p = await exigerAccord(personnageId);
  const d = depots();
  const f = resoudreFournisseur("voix", "heygen");
  const existante = (await f.listerVoixExistantes()).find((v) => v.idExterne === idExterne);
  if (!existante) throw new ErreurStudio("INTROUVABLE", "Cette voix n'existe plus chez HeyGen.");
  if (!existante.utilisable) throw new ErreurStudio("VOIX_INUTILISABLE", "Cette voix ne sait pas produire un son seul : choisissez votre copie instantanée.");
  const voixDuPersonnage = await d.voix.lister((v) => v.personnageId === personnageId);
  for (const v of voixDuPersonnage) {
    const r = await ressourceActive(v.id);
    if (r?.fournisseur === "heygen" && r.idExterne === idExterne) {
      await d.personnages.modifier(personnageId, { voixParDefautId: v.id });
      return v.id;
    }
  }
  const langue: Voix["langue"] = existante.langue === "en-US" || existante.langue === "es-ES" ? existante.langue : "fr-FR";
  const voix: Voix = {
    id: nouvelId("voix"),
    personnageId,
    nom: p.nature === "moi" ? "Ma voix HeyGen" : `Voix HeyGen de ${p.nom}`,
    langue,
    minutesEnregistrees: 0,
    statut: "pret",
    reglages: { vitesse: 1, stabilite: 60, emotion: 50 },
    fichierIds: [],
    // Toujours « heygen » : la voix EST une voix HeyGen. Sans clé, le registre la lit en simulation (repli), avec la clé
    // elle devient réelle sans rien changer.
    fournisseur: "heygen",
    versionFournisseur: existante.typeClone,
    typeClone: existante.typeClone,
    ...horodatage(),
  };
  await d.voix.enregistrer(voix);
  await enregistrerRessource({ id: nouvelId("rf"), entite: "voix", entiteId: voix.id, fournisseur: "heygen", idExterne, versionModele: existante.typeClone, statut: "pret", accordId: p.accord?.documentFichierId, ...horodatage() });
  await d.personnages.modifier(personnageId, { voixParDefautId: voix.id });
  await journaliser("voix", `Voix HeyGen reliée : « ${existante.nom} »${f.mode === "simulation" ? " (essai)" : ""}`, { type: "personnage", id: personnageId });
  return voix.id;
}

/** Choisit la voix par défaut d'un personnage (les autres restent, rien n'est effacé). */
export async function choisirVoixParDefaut(personnageId: Id, voixId: Id): Promise<void> {
  await exigerSession();
  const v = await depots().voix.obtenir(voixId);
  if (!v || v.personnageId !== personnageId) throw new ErreurStudio("INTROUVABLE", "Cette voix n'appartient pas à ce personnage.");
  await depots().personnages.modifier(personnageId, { voixParDefautId: voixId });
}

/**
 * Voix par défaut d'un FORMAT pour ce personnage (lot « voix par format », 02/10, D2) : ex. « Vidéo type avocat →
 * Voix avocat rapide ». Utilisée d'office à la création d'une vidéo du format (`voixPourFormat`), modifiable ensuite
 * vidéo par vidéo. `voixId` null : le format reprend la voix par défaut du personnage (rien n'est effacé d'autre).
 */
export async function choisirVoixPourFormat(personnageId: Id, formatId: string, voixId: Id | null): Promise<void> {
  await exigerSession();
  const d = depots();
  const p = await d.personnages.obtenir(personnageId);
  if (!p) throw new ErreurStudio("INTROUVABLE", "Ce personnage n'existe plus.");
  const format = trouverFormat(formatId);
  if (!format) throw new ErreurStudio("INTROUVABLE", "Ce format n'existe pas.");
  const suite: Record<string, Id> = { ...(p.voixParFormat ?? {}) };
  if (voixId) {
    const v = await d.voix.obtenir(voixId);
    if (!v || v.personnageId !== personnageId) throw new ErreurStudio("INTROUVABLE", "Cette voix n'appartient pas à ce personnage.");
    if (v.statut !== "pret") throw new ErreurStudio("VOIX_PAS_PRETE", "Cette voix n'est pas encore prête.");
    suite[formatId] = voixId;
    await d.personnages.modifier(personnageId, { voixParFormat: suite });
    await journaliser("voix", `${format.nom} : « ${v.nom} » par défaut`, { type: "personnage", id: personnageId });
  } else {
    delete suite[formatId];
    await d.personnages.modifier(personnageId, { voixParFormat: suite });
    await journaliser("voix", `${format.nom} : voix habituelle du personnage`, { type: "personnage", id: personnageId });
  }
}

/** Correcteur 4 : visage (avatar) d'un personnage, prêt, ou une erreur claire. */
async function visagePretDe(personnageId: Id, visageId: Id): Promise<Visage> {
  const v = await depots().visages.obtenir(visageId);
  if (!v || v.personnageId !== personnageId) throw new ErreurStudio("INTROUVABLE", "Ce visage n'appartient pas à ce personnage.");
  if (v.statut !== "pret") throw new ErreurStudio("VISAGE_PAS_PRET", "Ce visage n'est pas encore prêt.");
  return v;
}

/** Correcteur 4 : choisit le visage par défaut d'un personnage (« Visage par défaut » sur la fiche d'un visage). */
export async function choisirVisageParDefaut(personnageId: Id, visageId: Id): Promise<void> {
  await exigerSession();
  const v = await visagePretDe(personnageId, visageId);
  await depots().personnages.modifier(personnageId, { visageParDefautId: visageId });
  await journaliser("personnage", `Visage par défaut : « ${v.nom} »`, { type: "personnage", id: personnageId });
}

/**
 * Correcteur 4 — AVATAR PAR FORMAT (copie de `choisirVoixPourFormat`) : ex. « Vidéo type avocat → avatar en costume ».
 * Utilisé d'office à la création d'une vidéo du format (`visagePourFormat`), modifiable ensuite vidéo par vidéo.
 * `visageId` null : le format reprend le visage par défaut du personnage (rien n'est effacé d'autre).
 */
export async function choisirVisagePourFormat(personnageId: Id, formatId: string, visageId: Id | null): Promise<void> {
  await exigerSession();
  const d = depots();
  const p = await d.personnages.obtenir(personnageId);
  if (!p) throw new ErreurStudio("INTROUVABLE", "Ce personnage n'existe plus.");
  const format = trouverFormat(formatId);
  if (!format) throw new ErreurStudio("INTROUVABLE", "Ce format n'existe pas.");
  const suite: Record<string, Id> = { ...(p.visageParFormat ?? {}) };
  if (visageId) {
    const v = await visagePretDe(personnageId, visageId);
    suite[formatId] = visageId;
    await d.personnages.modifier(personnageId, { visageParFormat: suite });
    await journaliser("personnage", `${format.nom} : visage « ${v.nom} » par défaut`, { type: "personnage", id: personnageId });
  } else {
    delete suite[formatId];
    await d.personnages.modifier(personnageId, { visageParFormat: suite });
    await journaliser("personnage", `${format.nom} : visage habituel du personnage`, { type: "personnage", id: personnageId });
  }
}

/** Texte à lire pour l'enregistrement de la voix dans le navigateur. */
export const TEXTE_A_LIRE =
  "Bonjour, je m'appelle Williams. Aujourd'hui, je vous explique simplement comment l'intelligence artificielle peut vous faire gagner du temps. " +
  "Pas de jargon, pas de promesse en l'air : des exemples concrets, tirés de vraies entreprises. " +
  "Axion-IA, c'est d'abord une méthode. On commence petit, on mesure, puis on avance.";

/* ------------------------------------------------------------------ */
/* Lot B1 : Looks des décors réalistes = visages GÉNÉRÉS                */
/* ------------------------------------------------------------------ */

/**
 * Double de BASE des Looks d'un décor (« toujours à partir du même look de base », conseil HeyGen) : par angle, le
 * visage FILMÉ et prêt du personnage principal (« moi »), avec sa ressource active chez le fournisseur de visage donné.
 * Vide : pas encore de double chez ce fournisseur (aucun Look possible).
 * Un double HeyGen n'est JAMAIS une base (`LOOKS_HEYGEN_PAR_LE_STUDIO`, constante séparée du réglage du rendu, lot
 * R7e) : ses looks (payants) se font dans l'application HeyGen (relecture exactitude `3042b94`, n° 2).
 */
export async function doublesDeBasePourLooks(fournisseurId: string, looksAutorises = LOOKS_HEYGEN_PAR_LE_STUDIO): Promise<{ personnageId: Id; angle: AngleVisage; visage: Visage; idExterne: string }[]> {
  const d = depots();
  // TEST-UI-REEL U1 : le vrai « Moi » d'abord, jamais celui d'exemple quand les exemples sont masqués.
  const principal = await trouverMoi();
  if (!principal) return [];
  const visages = await d.visages.lister((v) => v.personnageId === principal.id && (v.origine ?? "filme") === "filme" && v.statut === "pret");
  const sortie: { personnageId: Id; angle: AngleVisage; visage: Visage; idExterne: string }[] = [];
  for (const v of visages) {
    if (sortie.some((s) => s.angle === v.angle)) continue;
    const r = await ressourceActive(v.id);
    if (r && r.fournisseur === fournisseurId && r.statut === "pret" && (r.fournisseur !== "heygen" || looksAutorises)) sortie.push({ personnageId: principal.id, angle: v.angle, visage: v, idExterne: r.idExterne });
  }
  return sortie;
}

/**
 * Range un Look fabriqué pour un décor comme un VISAGE GÉNÉRÉ du personnage (`origine: genere`, `a_verifier` jusqu'à
 * la validation de Will sur capture), avec sa ressource chez le fournisseur. Même angle, même tenue que le visage de base.
 */
export async function enregistrerLookGenere(o: { base: Visage; decorNom: string; fournisseurId: string; idExterne: string; statut: Visage["statut"] }): Promise<Id> {
  const v: Visage = {
    id: nouvelId("vis"),
    personnageId: o.base.personnageId,
    nom: `${o.base.angle === "face" ? "Face" : o.base.angle === "trois-quarts" ? "Trois quarts" : "Profil"}, ${o.decorNom}`,
    angle: o.base.angle,
    tenue: o.base.tenue,
    tenueId: o.base.tenueId,
    fondTournage: o.decorNom,
    posture: o.base.posture,
    origine: "genere",
    statut: o.statut === "echec" ? "echec" : o.statut === "en_preparation" ? "en_preparation" : "a_verifier",
    fichierIds: [],
    fournisseur: o.fournisseurId,
    ...horodatage(),
  };
  await depots().visages.enregistrer(v);
  await enregistrerRessource({ id: nouvelId("rf"), entite: "visage", entiteId: v.id, fournisseur: o.fournisseurId, idExterne: o.idExterne, versionModele: "look", statut: v.statut, ...horodatage() });
  return v.id;
}
