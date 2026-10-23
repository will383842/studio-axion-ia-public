/** MES MODÈLES (B.8 #12b). Créer un modèle depuis une vidéo : voir videos.enregistrerCommeModele. */
import "server-only";
import type { Id } from "@/domaine/types";
import { depots, filtreExemples } from "./_commun";
import { exigerSession } from "./auth";
import { versVueModele } from "./presentation";
import { creerBrouillon } from "./videos";
import type { VueModele } from "./vues";

export async function listerModeles(options: { formatId?: string } = {}): Promise<VueModele[]> {
  const exemples = await filtreExemples<{ estDemo?: boolean }>();
  const liste = await depots().modeles.lister((m) => !m.archiveLe && exemples(m) && (!options.formatId || m.formatId === options.formatId));
  liste.sort((a, b) => b.utilisations - a.utilisations);
  return Promise.all(liste.map(versVueModele));
}

export async function obtenirModele(id: Id): Promise<VueModele | null> {
  const m = await depots().modeles.obtenir(id);
  return m ? versVueModele(m) : null;
}

export async function renommerModele(id: Id, nom: string): Promise<void> {
  await exigerSession();
  await depots().modeles.modifier(id, { nom });
}

/** Range le modèle : il disparaît de la liste mais n'est jamais effacé (rien n'est purgé). */
export async function archiverModele(id: Id): Promise<void> {
  await exigerSession();
  await depots().modeles.modifier(id, { archiveLe: new Date().toISOString() });
}

/** Modèles archivés (toujours gardés) : listés en bas de « Mes modèles » avec « Restaurer ». */
export async function listerModelesArchives(): Promise<VueModele[]> {
  const exemples = await filtreExemples<{ estDemo?: boolean }>();
  const liste = await depots().modeles.lister((m) => !!m.archiveLe && exemples(m));
  liste.sort((a, b) => (b.archiveLe ?? "").localeCompare(a.archiveLe ?? ""));
  return Promise.all(liste.map(versVueModele));
}

export async function restaurerModele(id: Id): Promise<void> {
  await exigerSession();
  await depots().modeles.modifier(id, { archiveLe: undefined });
}

/** « Utiliser » : ouvre l'assistant prérempli (renvoie l'id du brouillon). */
export async function utiliserModele(id: Id): Promise<Id> {
  await exigerSession();
  const m = await depots().modeles.obtenir(id);
  if (!m) throw new Error("Modèle introuvable");
  return creerBrouillon(m.formatId, { modeleId: id });
}
