/**
 * ZERNIO (lot Z2-S) : client du serveur, test des comptes, synchronisation des états (toutes les 15 min, hors verrou).
 *
 * - La clé `ZERNIO_API_KEY` reste sur le serveur ; le client est celui de la liste fermée (`zernio-client.ts`).
 * - Synchronisation : brouillon / programmée / publiée / échec / partielle / annulée → états du Studio, avec le lien
 *   `platformPostUrl`. Un post introuvable depuis 30 minutes devient « À vérifier » : jamais renvoyé à l'aveugle.
 * - Rien n'est jamais effacé chez Zernio ; une publication change d'état, elle n'est jamais supprimée.
 */
import "server-only";
import { DELAI_ABSENCE_MS } from "@/domaine/buffer";
import type { Publication, StatutPublication } from "@/domaine/types";
import { cleDans } from "@/fournisseurs/mesures/commun";
import { creerClientZernio, type ClientZernio, type CompteZernio, type PlateformePostZernio, type PostZernio } from "@/fournisseurs/publication/zernio-client";
import { estErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import { obtenirReseau } from "@/reseaux";
import { depots, ecrireParametre, ErreurStudio, journaliser, lireParametre, maintenant, sousVerrou } from "./_commun";
import { exigerSession } from "./auth";
import { passerProgrammee } from "./buffer";
import { synchroniserEtats } from "./generateur";
import { creerNotification } from "./notifications";

export const VARIABLE_CLE_ZERNIO = "ZERNIO_API_KEY";
export const PARAM_COMPTES_ZERNIO = "zernio.comptes";
/** Interrupteur local « Tout arrêter » : à faux, toute écriture vers Zernio est refusée. Absent = envois permis. */
export const PARAM_ARRET_ZERNIO = "zernio.envoi_autorise";
export const INTERVALLE_SYNCHRO_ZERNIO_MS = 15 * 60_000;
const LECTURES_PAR_TOUR = 50;

/** Relu à CHAQUE requête (jamais mis en cache) : l'arrêt agit tout de suite. */
export async function envoiZernioAutorise(): Promise<boolean> {
  return (await lireParametre<boolean>(PARAM_ARRET_ZERNIO, true)) !== false;
}

let clientInjecte: ClientZernio | null = null;
let clientCache: { cle: string; client: ClientZernio } | null = null;

/** Tests : remplace le client (null = retour au client réel). */
export function injecterClientZernio(client: ClientZernio | null): void {
  clientInjecte = client;
  clientCache = null;
}

/** La clé existe-t-elle sur le serveur ? (jamais sa valeur). */
export function cleZernioPresente(): boolean {
  return !!clientInjecte || !!cleDans(process.env, VARIABLE_CLE_ZERNIO);
}

/** Client Zernio du serveur. Sans clé : refus clair, aucun repli vers un autre outil. */
export function clientZernio(): ClientZernio {
  if (clientInjecte) return clientInjecte;
  const cle = cleDans(process.env, VARIABLE_CLE_ZERNIO);
  if (!cle) throw new ErreurStudio("ZERNIO_NON_RELIE", "Zernio n'est pas relié (clé absente) : l'envoi est refusé, aucun autre outil n'est utilisé à sa place.");
  if (clientCache?.cle !== cle) clientCache = { cle, client: creerClientZernio({ cle, envoiAutorise: envoiZernioAutorise }) };
  return clientCache.client;
}

/** Erreur Zernio → phrase française simple pour Will (le détail technique ne sort jamais). */
export function versErreurStudioZernio(e: unknown): ErreurStudio {
  if (e instanceof ErreurStudio) return e;
  if (estErreurZernio(e)) return new ErreurStudio(e.code === "acces" ? "ZERNIO_CLE" : "ZERNIO", e.message);
  return new ErreurStudio("ZERNIO", "Zernio n'a pas pu répondre : réessayez dans un instant.");
}

/* ------------------------------------------------------------------ */
/* Comptes                                                              */
/* ------------------------------------------------------------------ */

export interface ComptesZernioEnregistres {
  lusLe: string;
  comptes: { id: string; reseau: string; nom: string }[];
}

export async function comptesZernioEnregistres(): Promise<ComptesZernioEnregistres | null> {
  return lireParametre<ComptesZernioEnregistres | null>(PARAM_COMPTES_ZERNIO, null);
}

/** « Tester » (Réglages) : Zernio répond-il, et quels comptes y sont reliés ? RÉSEAU : jamais depuis un écran. */
export async function testerZernio(): Promise<{ message: string; comptes: number; etats: Record<string, boolean> }> {
  await exigerSession();
  let liste: CompteZernio[];
  try {
    liste = await clientZernio().listerComptes();
  } catch (e) {
    const erreur = versErreurStudioZernio(e);
    await journaliser("publication", `Zernio, lecture des comptes : ${erreur.message}`);
    throw erreur;
  }
  const comptes = liste.map((c) => ({ id: c._id, reseau: c.platform, nom: c.displayName ?? c.username ?? c.platform }));
  await ecrireParametre(PARAM_COMPTES_ZERNIO, { lusLe: maintenant(), comptes } satisfies ComptesZernioEnregistres);
  await journaliser("reglages", `Zernio testé : ${comptes.length} compte(s) relié(s)`);
  const reseaux = [...new Set(comptes.map((c) => c.reseau))].join(", ");
  return { comptes: comptes.length, etats: Object.fromEntries(liste.map((c) => [c._id, c.isActive !== false])), message: comptes.length ? `Zernio répond : ${reseaux}.` : "Zernio répond, mais aucun compte n'y est relié." };
}

/* ------------------------------------------------------------------ */
/* Correspondance des états                                             */
/* ------------------------------------------------------------------ */

export interface EtatLuZernio {
  statut: StatutPublication;
  lien?: string;
  erreur?: string;
  /** Statut Zernio « partial » sans verdict pour ce compte, ou « cancelled ». */
  note?: "partielle" | "annulee";
}

const idCompte = (pf: PlateformePostZernio): string => (typeof pf.accountId === "string" ? pf.accountId : pf.accountId._id);

/** Statut d'un post (ou d'une plateforme) Zernio → statut du Studio. */
export function statutDepuisZernio(status: string | null | undefined): StatutPublication {
  switch (status) {
    case "published":
      return "publiee";
    case "scheduled":
    case "publishing":
      return "programmee";
    case "failed":
    case "partial":
    case "cancelled":
      return "echec";
    default: // draft, pending_approval, pending, inconnu : rien n'est parti
      return "brouillon";
  }
}

/** La cible du Studio (« compte », « compte:fb:page », « compte:li:n° ») commence par l'identifiant du compte Zernio. */
const compteDeCible = (canalId: string): string => canalId.split(":")[0];

/** État lu chez Zernio pour une publication : la plateforme du compte visé prime sur le statut global du post. */
export function etatDepuisPost(post: PostZernio, p: Pick<Publication, "canalId">): EtatLuZernio {
  const compte = p.canalId ? compteDeCible(p.canalId) : undefined;
  const pf = compte ? post.platforms.find((x) => idCompte(x) === compte) : post.platforms.length === 1 ? post.platforms[0] : undefined;
  const global = String(post.status);
  const lien = pf?.platformPostUrl || undefined;
  if (global === "cancelled") return { statut: "echec", note: "annulee", erreur: "Annulée chez Zernio." };
  if (pf?.status && ["published", "failed"].includes(pf.status)) {
    return { statut: statutDepuisZernio(pf.status), lien, ...(pf.status === "failed" ? { erreur: pf.errorMessage ?? "Zernio n'a pas pu publier." } : {}) };
  }
  if (global === "partial") return { statut: "echec", note: "partielle", erreur: "Publication partielle chez Zernio : voyez le détail dans Zernio." };
  return { statut: statutDepuisZernio(global), lien };
}

/* ------------------------------------------------------------------ */
/* Synchronisation (boucle de fond)                                     */
/* ------------------------------------------------------------------ */

const cleSynchro = Symbol.for("studio-axion-ia.synchro-zernio");
type AvecSynchro = typeof globalThis & { [cleSynchro]?: number };

async function ecrireSiInchange(p: Publication, modif: Partial<Publication>): Promise<boolean> {
  return sousVerrou(async () => {
    const actuelle = await depots().publications.obtenir(p.id);
    if (!actuelle || actuelle.modifieLe !== p.modifieLe) return false;
    await depots().publications.modifier(p.id, modif);
    return true;
  });
}

/**
 * Toutes les 15 minutes au plus : relit chez Zernio l'état des publications envoyées et pas encore publiées. Le réseau
 * se fait HORS verrou ; chaque écriture, sous le verrou, seulement si la publication n'a pas changé entre-temps.
 * Un post introuvable (404) depuis 30 minutes ou plus passe « À vérifier » ; avant, il est laissé tel quel.
 */
export async function synchroniserEtatsZernio(options: { force?: boolean; instant?: number } = {}): Promise<{ lues: number; changees: number }> {
  const instant = options.instant ?? Date.now();
  const g = globalThis as AvecSynchro;
  if (!options.force && g[cleSynchro] && instant - g[cleSynchro]! < INTERVALLE_SYNCHRO_ZERNIO_MS) return { lues: 0, changees: 0 };
  g[cleSynchro] = instant;
  if (!cleZernioPresente()) return { lues: 0, changees: 0 };
  const client = clientZernio();
  const d = depots();
  const r = { lues: 0, changees: 0 };
  const suivies = (await d.publications.lister((p) => p.via === "zernio" && !!p.idExterne && (p.statut === "brouillon" || p.statut === "programmee") && (p.etatEnvoi === undefined || p.etatEnvoi === "envoye")))
    .sort((a, b) => (a.etatLuLe ?? "").localeCompare(b.etatLuLe ?? ""))
    .slice(0, LECTURES_PAR_TOUR);
  const lu = new Date(instant).toISOString();
  for (const p of suivies) {
    let post: PostZernio;
    try {
      post = await client.lirePost(p.idExterne!);
    } catch (e) {
      if (estErreurZernio(e) && e.code === "introuvable") {
        const depuis = Date.parse(p.envoiCommenceLe ?? p.creeLe);
        if (instant - depuis >= DELAI_ABSENCE_MS && (await ecrireSiInchange(p, { etatEnvoi: "a-verifier", erreur: "Introuvable chez Zernio : vérifiez dans Zernio avant de renvoyer.", etatLuLe: lu }))) {
          r.changees++;
          await journaliser("publication", `Zernio : envoi à vérifier (${obtenirReseau(p.reseau).nom})`, { type: "video", id: p.videoId });
          await creerNotification({ type: "echec", titre: "Envoi vers Zernio à vérifier", message: `${obtenirReseau(p.reseau).nom} : Zernio ne retrouve pas la publication. Vérifiez dans Zernio avant de renvoyer.`, lien: `/videos/${p.videoId}`, estDemo: p.estDemo });
        }
      }
      continue; // muet, 5xx, débit : on relira plus tard, jamais de renvoi
    }
    r.lues++;
    const etat = etatDepuisPost(post, p);
    const changement: Partial<Publication> = { etatLuLe: lu };
    if (etat.statut !== p.statut) changement.statut = etat.statut;
    if (etat.lien && etat.lien !== p.urlPubliee) changement.urlPubliee = etat.lien;
    if (etat.statut === "echec") changement.erreur = etat.erreur;
    if (etat.statut === "publiee" && p.erreur) changement.erreur = undefined;
    if (post.scheduledFor && etat.statut === "programmee") changement.date = post.scheduledFor;
    if (!(await ecrireSiInchange(p, changement)) || etat.statut === p.statut) continue;
    r.changees++;
    const nom = obtenirReseau(p.reseau).nom;
    if (etat.statut === "publiee") {
      await d.videos.modifier(p.videoId, { etapeEditoriale: "publiee" });
      if (p.varianteId) await synchroniserEtats(p.varianteId);
      await journaliser("publication", `Publiée par Zernio sur ${nom}`, { type: "video", id: p.videoId });
    } else if (etat.statut === "programmee") {
      await passerProgrammee(p.videoId);
      if (p.varianteId) await synchroniserEtats(p.varianteId);
    } else if (etat.statut === "echec") {
      const phrase = etat.note === "annulee" ? `Zernio a annulé la publication sur ${nom}.` : `Zernio n'a pas pu publier sur ${nom} : voyez la raison dans Zernio.`;
      console.warn(`[studio] Zernio, échec sur ${p.reseau} : ${etat.note ?? "échec"}`);
      await journaliser("publication", phrase, { type: "video", id: p.videoId });
      await creerNotification({ type: "echec", titre: "Zernio n'a pas pu publier", message: phrase, lien: `/videos/${p.videoId}`, estDemo: p.estDemo });
    }
  }
  return r;
}
