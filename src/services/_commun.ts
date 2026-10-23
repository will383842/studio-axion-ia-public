/** Outils internes des services. Jamais importé par un écran. */
import "server-only";
import { depots } from "@/donnees/memoire";
import type { Evenement, RessourceFournisseur } from "@/domaine/types";
import { estSimule, resoudreFournisseur, type CarteFournisseurs, type TypeFournisseur } from "@/fournisseurs";
import { nouvelId } from "@/lib/ids";

export { depots };

/**
 * Fournisseur à utiliser pour un type (AV2.2-7) : réglage en base « fournisseur.<type> » d'abord
 * (Réglages > Connexions), puis variable d'environnement, puis la simulation.
 * TOUS les services passent par ici : jamais resoudreFournisseur(type) sans la valeur en base.
 */
export async function fournisseur<K extends TypeFournisseur>(type: K): Promise<CarteFournisseurs[K]> {
  return resoudreFournisseur(type, await lireParametre<string | null>(`fournisseur.${type}`, null));
}

/** Le fournisseur choisi pour ce type est-il une simulation ? (pastille « Essai »). */
export async function fournisseurSimule(type: TypeFournisseur): Promise<boolean> {
  return estSimule(type, await lireParametre<string | null>(`fournisseur.${type}`, null));
}

export function maintenant(): string {
  return new Date().toISOString();
}

export function horodatage() {
  const m = maintenant();
  return { creeLe: m, modifieLe: m };
}

/** Journal d'activité (Réglages > Journal). */
export async function journaliser(type: string, message: string, entite?: { type: string; id: string }): Promise<void> {
  const ev: Evenement = {
    id: nouvelId("ev"),
    type,
    message,
    entite: entite?.type,
    entiteId: entite?.id,
    date: maintenant(),
    ...horodatage(),
  };
  await depots().evenements.enregistrer(ev);
}

export async function lireParametre<T>(id: string, defaut: T): Promise<T> {
  const p = await depots().parametres.obtenir(id);
  return (p?.valeur as T) ?? defaut;
}

export async function ecrireParametre(id: string, valeur: unknown): Promise<void> {
  const existant = await depots().parametres.obtenir(id);
  const m = maintenant();
  await depots().parametres.enregistrer({ id, valeur, creeLe: existant?.creeLe ?? m, modifieLe: m });
}

/**
 * La vidéo a-t-elle été SUPPRIMÉE DÉFINITIVEMENT (absente, et sa trace `video_supprimee` existe) ? Un appel revenu
 * après la suppression n'écrit alors plus rien. Une vidéo simplement absente (jamais créée) ne compte pas.
 */
export async function videoSupprimee(videoId: string): Promise<boolean> {
  if (await depots().videos.obtenir(videoId)) return false;
  return !!(await depots().evenements.trouver((e) => e.type === "video_supprimee" && e.entiteId === videoId));
}

/** Filtre « Afficher les exemples » (AV2.4-7) : masque sans supprimer. */
export async function filtreExemples<T extends { estDemo?: boolean }>(): Promise<(e: T) => boolean> {
  const afficher = await lireParametre("afficherExemples", true);
  return (e: T) => afficher || !e.estDemo;
}

/** Erreur métier avec message lisible pour Will (vouvoiement, sans jargon). */
export class ErreurStudio extends Error {
  constructor(
    public readonly code: string,
    message: string,
    /** Paquet 4 (D2) : prix à confirmer (centimes d'euro), renvoyé à l'écran avec `CONFIRMATION_REQUISE`. */
    public readonly montant?: number,
  ) {
    super(message);
    this.name = "ErreurStudio";
  }
}

/** Résultat standard des actions serveur (sérialisable). */
export type Resultat<T = undefined> = { ok: true; donnees: T } | { ok: false; message: string; code?: string; montant?: number };

export async function essayer<T>(f: () => Promise<T>): Promise<Resultat<T>> {
  try {
    return { ok: true, donnees: await f() };
  } catch (e) {
    if (e instanceof ErreurStudio) return { ok: false, message: e.message, code: e.code, ...(e.montant !== undefined ? { montant: e.montant } : {}) };
    // Laisser passer redirect()/notFound() de Next.
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error(e);
    return { ok: false, message: "Un souci est survenu. Réessayez dans un instant." };
  }
}

const cleVerrou = Symbol.for("studio-axion-ia.verrou");
type AvecVerrou = typeof globalThis & { [cleVerrou]?: Promise<unknown> };

/** Exécute `f` seul (file d'attente globale) : évite d'appliquer deux fois un même résultat. */
export async function sousVerrou<T>(f: () => Promise<T>): Promise<T> {
  const g = globalThis as AvecVerrou;
  const precedent = g[cleVerrou] ?? Promise.resolve();
  const suivant = precedent.then(f, f);
  g[cleVerrou] = suivant.catch(() => undefined);
  return suivant;
}

/**
 * Petite fabrique de verrou LOCAL (file d'attente propre à l'appelant, un seul processus studio). Lot R2 : utilisée par
 * le kit de publication ; les verrous existants gardent leur propre file.
 */
export function creerVerrou(): <T>(f: () => Promise<T>) => Promise<T> {
  let file: Promise<unknown> = Promise.resolve();
  return <T>(f: () => Promise<T>): Promise<T> => {
    const suite = file.then(f, f);
    file = suite.catch(() => undefined);
    return suite;
  };
}

/** Ressource ACTIVE d'un visage ou d'une voix chez le fournisseur : la plus récente non remplacée. */
export async function ressourceActive(entiteId: string): Promise<RessourceFournisseur | null> {
  const actives = await depots().ressourcesFournisseurs.lister((r) => r.entiteId === entiteId && !r.remplaceeLe);
  actives.sort((a, b) => b.creeLe.localeCompare(a.creeLe));
  return actives[0] ?? null;
}

/** Enregistre une nouvelle ressource fournisseur : l'ancienne est marquée remplacée (jamais supprimée). */
export async function enregistrerRessource(r: RessourceFournisseur): Promise<void> {
  const d = depots();
  for (const ancienne of await d.ressourcesFournisseurs.lister((x) => x.entiteId === r.entiteId && !x.remplaceeLe)) {
    await d.ressourcesFournisseurs.modifier(ancienne.id, { remplaceeLe: maintenant() });
  }
  await d.ressourcesFournisseurs.enregistrer(r);
}
