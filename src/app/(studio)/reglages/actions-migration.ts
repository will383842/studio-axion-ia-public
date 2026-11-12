"use server";
/**
 * Réglages › Migration : lecture seule. Aucune écriture chez Zernio ni chez Buffer (services d'écriture non branchés).
 * Les données viennent du rapport IMP-1 / des brouillons IMP-2 quand un lecteur est injecté ; sinon : état vide.
 */
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { lireDonneesMigration } from "@/services/lecteur-migration";
import type { DonneesMigration } from "@/components/migration/logique";

export interface EtatMigration {
  donnees: DonneesMigration | null;
  /** Clé Zernio absente : l'écran fonctionne en simulation. */
  simulation: boolean;
}

// Le lecteur injectable vit dans @/services/lecteur-migration : un « use server » n'exporte que des actions gardées.

export async function lireMigrationAction(): Promise<Resultat<EtatMigration>> {
  await exigerSession();
  return essayer(async () => {
    const donnees = await lireDonneesMigration();
    return { donnees: donnees && donnees.posts.length ? donnees : null, simulation: !process.env.ZERNIO_API_KEY };
  });
}
