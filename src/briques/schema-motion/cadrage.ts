/**
 * MOTION DE SCHÉMA · disposition ET cadrage ensemble (règle « aucun texte coupé par le bord »). PUR et déterministe.
 *
 * La caméra cherche d'abord un cadrage propre sur la disposition normale (décalage, puis zoom jusqu'à 0,8) ; si, à un
 * mot, aucun cadrage ne garde tous les blocs lisibles entiers ou hors cadre, la disposition répartit autrement
 * (`VARIANTES_DISPOSITION` : boîtes serrées et rangées coupées, puis branche majoritaire centrée sous le tronc). La première variante sans défaut
 * est gardée ; sinon la dernière, avec ses alertes.
 */
import { controlerCadrage, trajectoireCamera, type CadrageCamera, type DefautCadrage } from "./camera";
import { disposerToile, VARIANTES_DISPOSITION, type VarianteDisposition } from "./disposition";
import type { DispositionToile, MotParle, SchemaEntree, TrajectoireCamera } from "./types";

export type ToileCadree = {
  toile: DispositionToile;
  trajectoire: TrajectoireCamera;
  cadrage: CadrageCamera;
  variante: VarianteDisposition;
  /** Défauts de cadrage restants (vide = aucun bloc lisible coupé à aucun instant clé). */
  defauts: DefautCadrage[];
};

/**
 * Dispose le schéma et calcule la trajectoire de la caméra, en changeant de disposition tant qu'un bloc lisible serait
 * coupé. `cadragePour` rend le cadrage d'une toile (les étiquettes, comme les pastilles de part, dépendent de la toile).
 */
export function disposerEtCadrer(
  schema: SchemaEntree,
  mots: readonly MotParle[],
  dureeSec: number,
  cadragePour: (toile: DispositionToile) => CadrageCamera = () => ({}),
): ToileCadree {
  let dernier: ToileCadree | null = null;
  for (const variante of VARIANTES_DISPOSITION) {
    const toile = disposerToile(schema, variante);
    // Sans embranchement, « branche centrée » ne change rien à « serrée ».
    if (variante === "branche-centree" && toile.branches.length < 2) break;
    const cadrage = cadragePour(toile);
    const trajectoire = trajectoireCamera(toile, mots, dureeSec, cadrage);
    const defauts = controlerCadrage(toile, trajectoire, mots, cadrage);
    dernier = { toile, trajectoire, cadrage, variante, defauts };
    if (defauts.length === 0 && !trajectoire.alertes.some((a) => a.includes("aucun cadrage"))) return dernier;
  }
  return dernier!;
}
