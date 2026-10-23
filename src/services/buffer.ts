/**
 * BUFFER RÉEL (lot R1, brouillon d'abord) : comptes, correspondance réseau → compte, mode, synchronisation des états.
 *
 * - Les comptes Buffer sont LUS sur un geste de Will (« Tester »), à un envoi s'ils n'ont jamais été lus ou s'il en
 *   manque un, et par la boucle de fond au plus une fois par heure ; ils sont gardés en base (`buffer.canaux`).
 *   Un ÉCRAN ne lit que cette copie : afficher une page n'appelle jamais Buffer.
 * - Comptes d'un réseau (lot R1b) : Will coche le ou les comptes À CHAQUE ENVOI (deux LinkedIn : le profil, la page ou
 *   les deux) ; son dernier choix est mémorisé par réseau (`buffer.correspondance`) et proposé la fois suivante, et sert
 *   à « Programmer les N ». Sans choix ni mémoire : le seul compte du réseau ; plusieurs → jamais deviné.
 *   YouTube et YouTube Shorts partent sur le même compte.
 * - Mode (`buffer.mode`) : « brouillon » par défaut (Will relit et programme dans Buffer) ; « programmer » sur son choix.
 * - Synchronisation (boucle de fond, toutes les 15 min, HORS verrou pour le réseau) : brouillon → programmée → publiée
 *   (+ lien de la publication) ou échec (+ notification) ; un envoi « à vérifier » est relu, jamais renvoyé à l'aveugle.
 * - Rien n'est jamais effacé chez Buffer ; ici, une publication change d'état, elle n'est jamais supprimée.
 */
import "server-only";
import { createHash } from "node:crypto";
import { comptesPourReseau, DELAI_ABSENCE_MS, idsMemorises, MARGE_HORLOGE_MS, messageDeconnectes, nomService, retrouverEnvoi, serviceBuffer, type ComptesPourReseau, type CorrespondanceBuffer } from "@/domaine/buffer";
import type { ComptesEnvoi } from "@/domaine/comptes-envoi";
import type { Id, IdReseau, ModeEnvoiPublication, Publication } from "@/domaine/types";
import type { CanalPublication, FournisseurPublication } from "@/fournisseurs/types";
import { ErreurBuffer } from "@/fournisseurs/publication/buffer";
import { VARIABLE_CLE_BUFFER } from "@/fournisseurs/mesures/buffer";
import { cleDans } from "@/fournisseurs/mesures/commun";
import { listerReseaux, obtenirReseau } from "@/reseaux";
import { depots, ecrireParametre, ErreurStudio, fournisseur, journaliser, lireParametre, maintenant, sousVerrou } from "./_commun";
import { exigerSession } from "./auth";
import { synchroniserEtats } from "./generateur";
import { creerNotification } from "./notifications";

export const PARAM_CANAUX = "buffer.canaux";
export const PARAM_CORRESPONDANCE = "buffer.correspondance";
export const PARAM_MODE = "buffer.mode";
/** Synchronisation des états : toutes les 15 minutes au plus. */
export const INTERVALLE_SYNCHRO_BUFFER_MS = 15 * 60_000;
/** Lectures d'état au plus par tour de synchronisation. */
const LECTURES_PAR_TOUR = 50;
/** Un envoi « en cours » plus vieux que ceci a été interrompu (redémarrage) : il devient « à vérifier ». */
const ENVOI_INTERROMPU_MS = 2 * 60_000;
/** Les comptes gardés en base sont relus par la boucle au plus une fois par heure. */
export const INTERVALLE_COMPTES_BUFFER_MS = 60 * 60_000;

export interface CanauxEnregistres {
  lusLe: string;
  canaux: CanalPublication[];
}

/* ------------------------------------------------------------------ */
/* Lectures en base (aucun réseau)                                     */
/* ------------------------------------------------------------------ */

export async function lireModeBuffer(): Promise<ModeEnvoiPublication> {
  return (await lireParametre<string>(PARAM_MODE, "brouillon")) === "programmer" ? "programmer" : "brouillon";
}

export async function canauxEnregistres(): Promise<CanauxEnregistres | null> {
  return lireParametre<CanauxEnregistres | null>(PARAM_CANAUX, null);
}

async function correspondance(): Promise<CorrespondanceBuffer> {
  return lireParametre<CorrespondanceBuffer>(PARAM_CORRESPONDANCE, {});
}

/** Le fournisseur de publication choisi, s'il est réel (Buffer) ; null en simulation. */
async function publicationReelle(): Promise<FournisseurPublication | null> {
  const f = await fournisseur("publication");
  return f.mode === "simulation" ? null : f;
}

/**
 * Empreinte d'un envoi (vidéo, réseau, date et, depuis R1b, compte) : le même envoi n'est jamais fait deux fois ; deux
 * comptes du même réseau font deux envois légitimes. Sans compte : l'empreinte d'avant R1b (publications existantes).
 */
export function cleEnvoiBuffer(videoId: Id, reseau: IdReseau, dateIso: string, canalId?: string): string {
  return createHash("sha256")
    .update(`${videoId}|${reseau}|${dateIso}${canalId ? `|${canalId}` : ""}`)
    .digest("hex")
    .slice(0, 32);
}

/* ------------------------------------------------------------------ */
/* Comptes (réseau sur geste de Will ou boucle)                         */
/* ------------------------------------------------------------------ */

/** Relit les comptes chez Buffer et les garde en base. RÉSEAU : jamais depuis un écran. */
export async function actualiserCanauxBuffer(): Promise<CanauxEnregistres> {
  const f = await publicationReelle();
  if (!f?.listerCanaux) throw new ErreurStudio("BUFFER_NON_RELIE", "Buffer n'est pas relié : la publication reste en essai.");
  let canaux: CanalPublication[];
  try {
    canaux = await f.listerCanaux();
  } catch (e) {
    await noterErreurBuffer("lecture des comptes", e);
    throw versErreurStudio(e);
  }
  const lus: CanauxEnregistres = { lusLe: maintenant(), canaux };
  await ecrireParametre(PARAM_CANAUX, lus);
  return lus;
}

/**
 * Les comptes où part ce réseau (geste « Envoyer » de Will, ou « Programmer les N ») : les comptes cochés (`choisis`),
 * sinon le dernier choix mémorisé, sinon le seul compte. Les comptes sont lus s'ils ne l'ont jamais été ; s'il manque
 * un compte, ils sont relus UNE fois (Will vient peut-être de le relier dans Buffer) avant de le dire.
 */
export async function comptesBufferPour(reseau: IdReseau, choisis?: string[]): Promise<ComptesPourReseau> {
  const enBase = await canauxEnregistres();
  const lus = enBase ?? (await actualiserCanauxBuffer());
  const memoire = await correspondance();
  const c = comptesPourReseau(reseau, lus.canaux, memoire, choisis);
  if (c.ok || !enBase || c.raison === "plusieurs") return c;
  return comptesPourReseau(reseau, (await actualiserCanauxBuffer()).canaux, memoire, choisis);
}

/**
 * Lot R1b : le choix de Will à l'envoi devient le choix proposé la fois suivante (et pour « Programmer les N »).
 * L'appelant ne passe que des comptes VALIDÉS (réseau envoyé, comptes connus de ce réseau).
 */
export async function memoriserComptesBuffer(choix: Partial<Record<IdReseau, string[]>>): Promise<void> {
  const entrees = Object.entries(choix).filter(([, ids]) => ids?.length) as [IdReseau, string[]][];
  if (!entrees.length) return;
  const actuelle = await correspondance();
  if (entrees.every(([r, ids]) => idsMemorises(actuelle[r]).join("|") === [...new Set(ids)].join("|"))) return;
  await ecrireParametre(PARAM_CORRESPONDANCE, { ...actuelle, ...Object.fromEntries(entrees.map(([r, ids]) => [r, [...new Set(ids)]])) });
}


/** « Tester » (Réglages) : Buffer répond-il, et quels comptes y sont reliés ? */
export async function testerBuffer(): Promise<{ message: string; comptes: number }> {
  await exigerSession();
  const lus = await actualiserCanauxBuffer();
  const parService = new Map<string, number>();
  for (const c of lus.canaux) parService.set(c.service, (parService.get(c.service) ?? 0) + 1);
  const liste = [...parService].map(([s, n]) => `${nomService(s)}${n > 1 ? ` ×${n}` : ""}`).join(", ");
  await journaliser("reglages", `Buffer testé : ${lus.canaux.length} compte(s) relié(s)`);
  return { comptes: lus.canaux.length, message: lus.canaux.length ? `Buffer répond : ${liste}.` : "Buffer répond, mais aucun compte n'y est relié." };
}

/**
 * Réglages : le ou les comptes PROPOSÉS PAR DÉFAUT pour un réseau (cochés à l'ouverture de la feuille d'envoi, utilisés
 * par « Programmer les N »). Vide ou null : aucun compte proposé, Will choisit à chaque envoi.
 */
export async function choisirCanalBuffer(reseau: IdReseau, canalId: string | string[] | null): Promise<void> {
  await exigerSession();
  if (!listerReseaux().some((r) => r.id === reseau)) throw new ErreurStudio("RESEAU_INCONNU", "Réseau inconnu.");
  const actuelle = await correspondance();
  const ids = idsMemorises(canalId ?? undefined);
  if (!ids.length) {
    const reste = { ...actuelle };
    delete reste[reseau];
    await ecrireParametre(PARAM_CORRESPONDANCE, reste);
    await journaliser("reglages", `Buffer : ${obtenirReseau(reseau).nom}, compte choisi à chaque envoi`);
    return;
  }
  const lus = (await canauxEnregistres())?.canaux ?? [];
  const canaux = ids.map((id) => lus.find((c) => c.id === id));
  if (canaux.some((c) => !c || c.service !== serviceBuffer(reseau))) throw new ErreurStudio("COMPTE_INCONNU", "Ce compte n'est pas relié à ce réseau dans Buffer : actualisez les comptes.");
  await ecrireParametre(PARAM_CORRESPONDANCE, { ...actuelle, [reseau]: ids });
  await journaliser("reglages", `Buffer : ${obtenirReseau(reseau).nom}, proposé par défaut : ${canaux.map((c) => `« ${c!.nom} »`).join(" et ")}`);
}

export async function definirModeBuffer(mode: ModeEnvoiPublication): Promise<void> {
  await exigerSession();
  if (mode !== "brouillon" && mode !== "programmer") throw new ErreurStudio("MODE_INCONNU", "Choix inconnu.");
  await ecrireParametre(PARAM_MODE, mode);
  await journaliser("reglages", mode === "brouillon" ? "Buffer : envoi en brouillon (vous programmez dans Buffer)" : "Buffer : programmation directe à la date choisie");
}

/* ------------------------------------------------------------------ */
/* Vues (aucun réseau)                                                  */
/* ------------------------------------------------------------------ */

export interface VueCompteReseau {
  reseau: IdReseau;
  nom: string;
  /** Le seul compte du réseau (ou le seul proposé par défaut) ; absent si aucun ou s'il y en a plusieurs. */
  compte?: { id: string; nom: string; source: "choisi" | "auto" };
  /** Lot R1b : comptes proposés par défaut à l'envoi (dernier choix de Will), quand le réseau en a plusieurs. */
  proposes?: string[];
  probleme?: string;
  /** Un compte de ce réseau est déconnecté (nommé) ; les autres restent à cocher. */
  avertissement?: string;
  /** Comptes connectés de ce réseau (plusieurs : Will coche à chaque envoi). */
  candidats: { id: string; nom: string; genre?: string }[];
}

export interface VueBuffer {
  /** Buffer est le fournisseur choisi et la clé est posée (« Relié »). */
  relie: boolean;
  /** La clé `BUFFER_API_KEY` existe sur le serveur (jamais sa valeur). */
  clePresente: boolean;
  mode: ModeEnvoiPublication;
  /** Dernière lecture des comptes. */
  lusLe?: string;
  comptes: { id: string; nom: string; service: string; deconnecte: boolean }[];
  reseaux: VueCompteReseau[];
}

/** Réglages, bloc Buffer : uniquement ce qui est en base. N'appelle JAMAIS Buffer. */
export async function vueBuffer(): Promise<VueBuffer> {
  const lus = await canauxEnregistres();
  const memoire = await correspondance();
  const canaux = lus?.canaux ?? [];
  return {
    relie: !!(await publicationReelle()),
    clePresente: !!cleDans(process.env, VARIABLE_CLE_BUFFER),
    mode: await lireModeBuffer(),
    lusLe: lus?.lusLe,
    comptes: canaux.map((c) => ({ id: c.id, nom: c.nom, service: c.service, deconnecte: c.deconnecte })),
    reseaux: listerReseaux().map((r): VueCompteReseau => {
      const duService = canaux.filter((x) => x.service === serviceBuffer(r.id));
      const candidats = duService.filter((x) => !x.deconnecte).map((x) => ({ id: x.id, nom: x.nom, genre: x.genre }));
      const deconnectes = duService.filter((x) => x.deconnecte);
      const avertissement = deconnectes.length && candidats.length ? messageDeconnectes(r.id, deconnectes) : undefined;
      const c = comptesPourReseau(r.id, canaux, memoire);
      // Plusieurs comptes : choisis à chaque envoi, ce n'est pas un problème.
      if (candidats.length > 1 && (c.ok || c.raison === "plusieurs")) return { reseau: r.id, nom: r.nom, candidats, proposes: c.ok ? c.canaux.map((x) => x.id) : [], avertissement };
      // Un compte déconnecté (mémorisé, ou parmi plusieurs sans mémoire) ne bloque pas les comptes restés connectés :
      // Will les coche ; proposés d'office, ceux qu'il avait choisis, ou le seul resté connecté.
      if (!c.ok && candidats.length && (c.raison === "deconnecte" || c.raison === "plusieurs")) {
        const memoires = idsMemorises(memoire[r.id]).filter((id) => candidats.some((x) => x.id === id));
        return { reseau: r.id, nom: r.nom, candidats, proposes: memoires.length ? memoires : candidats.length === 1 ? [candidats[0].id] : [], avertissement };
      }
      return {
        reseau: r.id,
        nom: r.nom,
        compte: c.ok ? { id: c.canaux[0].id, nom: c.canaux[0].nom, source: c.source === "auto" ? "auto" : "choisi" } : undefined,
        probleme: c.ok ? undefined : lus ? c.message : "Comptes pas encore lus : touchez « Tester ».",
        avertissement: c.ok ? avertissement : undefined,
        candidats,
      };
    }),
  };
}

export interface VueEnvoiBuffer {
  mode: ModeEnvoiPublication;
  /** Par réseau : le compte où il partira, les comptes à cocher (plusieurs), ou ce qui manque. */
  comptes: ComptesEnvoi;
}

/** Feuille « Envoyer vers Buffer » : mode et comptes. null en simulation. N'appelle JAMAIS Buffer. */
export async function vueEnvoiBuffer(): Promise<VueEnvoiBuffer | null> {
  if (!(await publicationReelle())) return null;
  const vue = await vueBuffer();
  const comptes: ComptesEnvoi = {};
  for (const r of vue.reseaux) {
    if (!r.compte && !r.probleme && r.candidats.length) comptes[r.reseau] = { choix: r.candidats, memorises: r.proposes ?? [], ...(r.avertissement ? { avertissement: r.avertissement } : {}) };
    // Comptes jamais lus : ils le seront au premier envoi, rien n'est bloqué d'avance.
    else comptes[r.reseau] = r.compte ? { nom: r.compte.nom } : vue.lusLe ? { probleme: r.probleme } : {};
  }
  return { mode: vue.mode, comptes };
}

/* ------------------------------------------------------------------ */
/* Erreurs                                                              */
/* ------------------------------------------------------------------ */

/**
 * Erreur de Buffer notée. Le journal du studio (un ÉCRAN : Réglages › Journal) reçoit la phrase française simple ; le
 * détail technique (code, nom du réglage, texte brut de Buffer, déjà nettoyé par le client : ni clé, ni adresse
 * signée) part UNIQUEMENT dans les journaux du serveur.
 */
export async function noterErreurBuffer(contexte: string, e: unknown, entite?: { type: string; id: string }): Promise<void> {
  const phrase = versErreurStudio(e).message;
  const detail = e instanceof ErreurBuffer ? (e.detail ?? e.code) : e instanceof ErreurStudio ? e.code : e instanceof Error ? e.name : "erreur inattendue";
  console.warn(`[studio] Buffer, ${contexte} : ${detail}`);
  await journaliser("publication", `Buffer, ${contexte} : ${phrase}`, entite);
}

/** Erreur de Buffer → message pour Will : la phrase française fixe (`PHRASES_BUFFER`), jamais le détail. */
export function versErreurStudio(e: unknown): ErreurStudio {
  if (e instanceof ErreurStudio) return e;
  if (e instanceof ErreurBuffer) return new ErreurStudio(e.code === "refuse" ? "BUFFER_CLE" : "BUFFER", e.message);
  return new ErreurStudio("BUFFER", "Buffer n'a pas pu répondre : réessayez dans un instant.");
}

/* ------------------------------------------------------------------ */
/* Envoi à vérifier : relire Buffer, jamais renvoyer à l'aveugle        */
/* ------------------------------------------------------------------ */

/**
 * Relit Buffer pour un envoi « à vérifier » (réseau, HORS verrou), puis écrit le résultat sous le verrou si la
 * publication n'a pas changé entre-temps. Trouvé → relié (« envoyé ») ; absent après 30 min → « absent » (Will peut
 * renvoyer) ; sinon inchangé.
 */
export async function reconcilierEnvoi(publicationId: Id, instant: number = Date.now()): Promise<Publication | null> {
  const d = depots();
  const p = await d.publications.obtenir(publicationId);
  if (!p || p.via !== "buffer" || (p.etatEnvoi !== "a-verifier" && p.etatEnvoi !== "en-cours") || !p.canalId || !p.envoiCommenceLe) return p;
  const f = await publicationReelle();
  const organisationId = (await canauxEnregistres())?.canaux.find((c) => c.id === p.canalId)?.organisationId;
  if (!f?.publicationsRecentes || !organisationId) return p;
  let trouvee: Awaited<ReturnType<typeof retrouverEnvoi>> = null;
  // Même marge que `retrouverEnvoi` : l'horloge de Buffer peut retarder sur celle du studio.
  const depuis = new Date(new Date(p.envoiCommenceLe).getTime() - MARGE_HORLOGE_MS).toISOString();
  try {
    trouvee = retrouverEnvoi(await f.publicationsRecentes({ organisationId, canalId: p.canalId, depuis }), { canalId: p.canalId, texte: p.texte, depuis: p.envoiCommenceLe });
  } catch {
    return p; // Buffer muet : on relira plus tard, sans rien renvoyer.
  }
  const absente = !trouvee && instant - new Date(p.envoiCommenceLe).getTime() >= DELAI_ABSENCE_MS;
  if (!trouvee && !absente) return p;
  return sousVerrou(async () => {
    const actuelle = await d.publications.obtenir(publicationId);
    if (!actuelle || actuelle.modifieLe !== p.modifieLe) return actuelle;
    if (trouvee) {
      await journaliser("publication", `Envoi vers Buffer retrouvé (${obtenirReseau(p.reseau).nom})`, { type: "video", id: p.videoId });
      return d.publications.modifier(p.id, { etatEnvoi: "envoye", idExterne: trouvee.idExterne, statut: trouvee.statut, etatLuLe: new Date(instant).toISOString(), ...(trouvee.lien ? { urlPubliee: trouvee.lien } : {}) });
    }
    const modif = await d.publications.modifier(p.id, { etatEnvoi: "absent", statut: "echec", erreur: "Buffer n'a rien reçu : vérifiez dans Buffer avant de renvoyer.", etatLuLe: new Date(instant).toISOString() });
    await creerNotification({ type: "echec", titre: "Envoi vers Buffer non arrivé", message: `${obtenirReseau(p.reseau).nom} : Buffer n'a rien reçu. Vérifiez dans Buffer avant de renvoyer.`, lien: `/videos/${p.videoId}`, estDemo: p.estDemo });
    return modif;
  });
}

/* ------------------------------------------------------------------ */
/* Synchronisation des états (boucle de fond)                           */
/* ------------------------------------------------------------------ */

const cleSynchro = Symbol.for("studio-axion-ia.synchro-buffer");
type AvecSynchro = typeof globalThis & { [cleSynchro]?: number };

/**
 * Toutes les 15 minutes au plus (boucle de fond) : relit chez Buffer l'état des publications envoyées et pas encore
 * publiées, et les envois à vérifier. Le réseau se fait HORS verrou ; chaque écriture, sous le verrou, seulement si la
 * publication n'a pas changé entre-temps.
 */
export async function synchroniserEtatsBuffer(options: { force?: boolean; instant?: number } = {}): Promise<{ lues: number; changees: number }> {
  const instant = options.instant ?? Date.now();
  const g = globalThis as AvecSynchro;
  if (!options.force && g[cleSynchro] && instant - g[cleSynchro]! < INTERVALLE_SYNCHRO_BUFFER_MS) return { lues: 0, changees: 0 };
  g[cleSynchro] = instant;
  const f = await publicationReelle();
  if (!f?.lireEtat) return { lues: 0, changees: 0 };
  const d = depots();
  const r = { lues: 0, changees: 0 };

  // 0. Comptes : relus au plus une fois par heure (un compte relié ou retiré dans Buffer).
  const lus = await canauxEnregistres();
  if (!lus || instant - new Date(lus.lusLe).getTime() >= INTERVALLE_COMPTES_BUFFER_MS) await actualiserCanauxBuffer().catch(() => undefined);

  // 1. Envois interrompus ou à vérifier : relire, jamais renvoyer.
  const aVerifier = await d.publications.lister((p) => p.via === "buffer" && (p.etatEnvoi === "a-verifier" || (p.etatEnvoi === "en-cours" && !!p.envoiCommenceLe && instant - new Date(p.envoiCommenceLe).getTime() > ENVOI_INTERROMPU_MS)));
  for (const p of aVerifier) {
    r.lues++;
    const apres = await reconcilierEnvoi(p.id, instant);
    if (apres && apres.etatEnvoi !== p.etatEnvoi) r.changees++;
  }

  // 2. Publications chez Buffer pas encore publiées : leur état.
  const suivies = (await d.publications.lister((p) => p.via === "buffer" && !!p.idExterne && (p.statut === "brouillon" || p.statut === "programmee") && (p.etatEnvoi === undefined || p.etatEnvoi === "envoye")))
    // Au plus 50 lectures par tour, les moins récemment lues d'abord (un brouillon laissé dans Buffer ne bloque rien).
    .sort((a, b) => (a.etatLuLe ?? "").localeCompare(b.etatLuLe ?? ""))
    .slice(0, LECTURES_PAR_TOUR);
  for (const p of suivies) {
    let etat: Awaited<ReturnType<NonNullable<FournisseurPublication["lireEtat"]>>>;
    try {
      etat = await f.lireEtat(p.idExterne!);
    } catch (e) {
      // Supprimée dans Buffer par Will (introuvable) : on le dit, on n'efface rien ici.
      if (e instanceof ErreurBuffer && e.code === "introuvable") {
        await ecrireSiInchange(p, { statut: "echec", erreur: "Introuvable dans Buffer (retirée de Buffer ?).", etatLuLe: new Date(instant).toISOString() });
        r.changees++;
      }
      continue;
    }
    r.lues++;
    const changement: Partial<Publication> = { etatLuLe: new Date(instant).toISOString() };
    if (etat.statut !== p.statut) changement.statut = etat.statut;
    if (etat.lien && etat.lien !== p.urlPubliee) changement.urlPubliee = etat.lien;
    if (etat.statut === "publiee" && etat.envoyeeLe) changement.date = etat.envoyeeLe;
    else if (etat.date && etat.statut === "programmee") changement.date = etat.date;
    const raisonEchec = `Buffer n'a pas pu publier sur ${obtenirReseau(p.reseau).nom} : voyez la raison dans Buffer.`;
    if (etat.statut === "echec") changement.erreur = raisonEchec;
    const ecrite = await ecrireSiInchange(p, changement);
    if (!ecrite || etat.statut === p.statut) continue;
    r.changees++;
    if (etat.statut === "publiee") {
      await d.videos.modifier(p.videoId, { etapeEditoriale: "publiee" });
      if (p.varianteId) await synchroniserEtats(p.varianteId);
      await journaliser("publication", `Publiée par Buffer sur ${obtenirReseau(p.reseau).nom}`, { type: "video", id: p.videoId });
    } else if (etat.statut === "programmee") {
      await passerProgrammee(p.videoId);
      if (p.varianteId) await synchroniserEtats(p.varianteId);
    } else if (etat.statut === "echec") {
      console.warn(`[studio] Buffer, échec sur ${p.reseau} : ${etat.erreur ?? "sans raison donnée"}`);
      await journaliser("publication", raisonEchec, { type: "video", id: p.videoId });
      await creerNotification({ type: "echec", titre: "Buffer n'a pas pu publier", message: raisonEchec, lien: `/videos/${p.videoId}`, estDemo: p.estDemo });
    }
  }
  return r;
}

/** La vidéo passe « programmée », jamais en arrière depuis « publiée » (envoi direct ET synchronisation Buffer). */
export async function passerProgrammee(videoId: Id): Promise<void> {
  if ((await depots().videos.obtenir(videoId))?.etapeEditoriale === "publiee") return;
  await depots().videos.modifier(videoId, { etapeEditoriale: "programmee" });
}

async function ecrireSiInchange(p: Publication, modif: Partial<Publication>): Promise<boolean> {
  return sousVerrou(async () => {
    const actuelle = await depots().publications.obtenir(p.id);
    if (!actuelle || actuelle.modifieLe !== p.modifieLe) return false;
    await depots().publications.modifier(p.id, modif);
    return true;
  });
}
