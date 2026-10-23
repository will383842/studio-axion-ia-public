/**
 * MIGRATION — étape 16, D1 (`docs/LOT-INTENSITE-CREDITS-EXECUTION.md`) : banque de bruitages modernes.
 *
 * Ajoute les vingt sons de la banque (`donnees/bruitages.ts`) et leurs fichiers s'ils manquent, TOUS « à vérifier »
 * (aucun n'est posé dans une vidéo avant l'écoute de Will), licence enregistrée sur chaque élément. Ne réécrit JAMAIS
 * un son existant (un son validé, rangé ou renommé par Will garde son état). L'intensité par défaut des formats vit
 * dans leur profil (`formats/*`) : rien à migrer en base. Idempotente (un second passage renvoie null), aucune
 * suppression. Résumé rangé dans `rapport.lots["bruitages"]`.
 */
import type { Depots } from "@/domaine/depots";
import { elementsBruitages, fichiersBruitages } from "@/donnees/bruitages";

export async function etape16Bruitages(d: Depots, maintenant: string): Promise<Record<string, unknown> | null> {
  const fichiersAjoutes: string[] = [];
  for (const f of fichiersBruitages(maintenant)) {
    if (await d.fichiers.obtenir(f.id)) continue;
    await d.fichiers.enregistrer(f);
    fichiersAjoutes.push(f.id);
  }
  const sonsAjoutes: string[] = [];
  for (const e of elementsBruitages(maintenant)) {
    if (await d.elements.obtenir(e.id)) continue;
    await d.elements.enregistrer(e);
    sonsAjoutes.push(e.id);
  }
  if (!fichiersAjoutes.length && !sonsAjoutes.length) return null;
  return { fichiersAjoutes, sonsAjoutes, aVerifier: sonsAjoutes.length };
}
