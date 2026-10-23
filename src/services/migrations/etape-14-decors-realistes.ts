/**
 * MIGRATION — étape 14, lot B1 (décors réalistes, `docs/BRANCHEMENTS-EXECUTION.md` §3.2).
 *
 * Complète le catalogue déjà en base SANS jamais réécrire un choix de Will :
 *  - chaque fond neutre du catalogue reçoit sa vignette SUR le double (`vignetteDoubleFichierId`) s'il n'en a pas ;
 *  - chaque décor réaliste (R1…R8) reçoit sa description et sa méthode s'il ne les a pas, rien d'autre ;
 *  - un décor rangé, validé, mis en avant ou retiré par Will garde son état (seuls des champs ABSENTS sont posés).
 * Idempotente (un second passage ne change rien et renvoie null), aucune suppression. Les fichiers des vignettes sont
 * ajoutés par l'étape 9 (`fichiersDecorsCatalogue`) ; on les ajoute aussi ici s'ils manquent.
 * Résumé rangé dans `rapport.lots["decors-realistes"]`.
 */
import type { Depots } from "@/domaine/depots";
import type { ElementBibliotheque, ValeurDecor } from "@/domaine/types";
import { decorsCatalogue, fichiersDecorsCatalogue } from "@/donnees/decors-catalogue";

export async function etape14DecorsRealistes(d: Depots, maintenant: string): Promise<Record<string, unknown> | null> {
  const fichiersAjoutes: string[] = [];
  for (const f of fichiersDecorsCatalogue(maintenant)) {
    if (await d.fichiers.obtenir(f.id)) continue;
    await d.fichiers.enregistrer(f);
    fichiersAjoutes.push(f.id);
  }
  const vignettesPosees: string[] = [];
  const descriptionsPosees: string[] = [];
  for (const ref of decorsCatalogue(maintenant)) {
    const e = await d.elements.obtenir(ref.id);
    if (!e || e.valeur.type !== "decor" || ref.valeur.type !== "decor") continue;
    const v: ValeurDecor = e.valeur;
    const r: ValeurDecor = ref.valeur;
    const patch: Partial<ValeurDecor> = {};
    if (!v.vignetteDoubleFichierId && r.vignetteDoubleFichierId && (v.methode ?? "neutre-incruste") === "neutre-incruste") {
      patch.vignetteDoubleFichierId = r.vignetteDoubleFichierId;
      vignettesPosees.push(e.id);
    }
    if (r.methode === "look-heygen") {
      if (!v.description && r.description) patch.description = r.description;
      if (!v.methode) patch.methode = "look-heygen";
      if (patch.description || patch.methode) descriptionsPosees.push(e.id);
    }
    if (Object.keys(patch).length) await d.elements.modifier(e.id, { valeur: { ...v, ...patch } } as Partial<ElementBibliotheque>);
  }
  if (!fichiersAjoutes.length && !vignettesPosees.length && !descriptionsPosees.length) return null;
  return { fichiersAjoutes, vignettesPosees, descriptionsPosees };
}
