/**
 * Lecteur des données de l'écran Migration (module serveur ORDINAIRE, sans « use server » : rien ici n'est une action
 * serveur publique). Injectable pour les essais et le futur branchement IMP-1 / IMP-2 ; stocké sur globalThis comme
 * les autres lecteurs injectables (cf. site-videos). Aucune écriture, aucun réseau.
 */
import type { DonneesMigration } from "@/components/migration/logique";

export type LecteurMigration = () => Promise<DonneesMigration | null>;

const cleLecteur = Symbol.for("studio.lecteurMigration");
type AvecLecteur = typeof globalThis & { [cleLecteur]?: LecteurMigration | null };

/** Essais seulement. `null` : retour au lecteur par défaut (aucune donnée). */
export function injecterLecteurMigration(lecteur: LecteurMigration | null): void {
  (globalThis as AvecLecteur)[cleLecteur] = lecteur;
}

export async function lireDonneesMigration(): Promise<DonneesMigration | null> {
  const l = (globalThis as AvecLecteur)[cleLecteur];
  return l ? l() : null;
}
