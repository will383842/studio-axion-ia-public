"use server";
/**
 * Réglages › Migration : lecture seule. Aucune écriture chez Zernio ni chez Buffer (services d'écriture non branchés).
 * Les données viennent du rapport IMP-1 / des brouillons IMP-2 quand un lecteur est injecté ; sinon : état vide.
 */
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import type { DonneesMigration } from "@/components/migration/logique";

export interface EtatMigration {
  donnees: DonneesMigration | null;
  /** Clé Zernio absente : l'écran fonctionne en simulation. */
  simulation: boolean;
}

type Lecteur = () => Promise<DonneesMigration | null>;
let lecteur: Lecteur = async () => null;

/** Pour les tests et le futur branchement IMP-1 / IMP-2 : lecteur de données injectable. */
export function injecterLecteurMigration(l: Lecteur | null): void {
  lecteur = l ?? (async () => null);
}

export async function lireMigrationAction(): Promise<Resultat<EtatMigration>> {
  await exigerSession();
  return essayer(async () => {
    const donnees = await lecteur();
    return { donnees: donnees && donnees.posts.length ? donnees : null, simulation: !process.env.ZERNIO_API_KEY };
  });
}
