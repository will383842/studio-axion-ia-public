/**
 * MOTION DE SCHÉMA · disposition ET cadrage ensemble (règle « aucun texte coupé par le bord »). PUR et déterministe.
 *
 * La caméra cherche d'abord un cadrage propre sur la disposition normale (décalage, puis zoom jusqu'à 0,8) ; si, à un
 * mot, aucun cadrage ne garde tous les blocs lisibles entiers ou hors cadre, la disposition répartit autrement
 * (`VARIANTES_DISPOSITION` : boîtes serrées et rangées coupées, puis branche majoritaire centrée sous le tronc). La première variante sans défaut
 * est gardée ; sinon la dernière, avec ses alertes (ou sa version à caméra à coupe franche si elle a moins de défauts).
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

/** Retard de caméra (« arrive sur X 0.4 s trop tard ») que `mettreEnSceneIV` rattrape en décalant le bloc (au plus 0,6 s, marge de 0,05 s comprise). */
const RETARD_ABSORBABLE_SEC = 0.6;
const retardAbsorbable = (alerte: string) => {
  const m = /arrive sur \S+ ([\d.]+) s trop tard/.exec(alerte);
  return !!m && Number(m[1]) + 0.05 <= RETARD_ABSORBABLE_SEC;
};

const propre = (r: ToileCadree) => r.defauts.length === 0 && !r.trajectoire.alertes.some((a) => a.includes("aucun cadrage"));

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
    if (propre(dernier)) return dernier;
  }
  // Filet : toutes les variantes échouent. La dernière est retentée caméra à coupe franche (pas de panoramique en retard
  // ni en travers d'un bloc) ; on garde celle qui a le moins de défauts (à égalité, l'originale : rien ne change).
  // Un retard que le moteur sait absorber (il décale alors le bloc d'au plus 0,6 s) passe avant : la coupe franche ne sert qu'au reste.
  if (dernier && !dernier.cadrage.coupeFranche && !dernier.trajectoire.alertes.some(retardAbsorbable)) {
    const cadrage = { ...cadragePour(dernier.toile), coupeFranche: true };
    const trajectoire = trajectoireCamera(dernier.toile, mots, dureeSec, cadrage);
    const franche: ToileCadree = { ...dernier, cadrage, trajectoire, defauts: controlerCadrage(dernier.toile, trajectoire, mots, cadrage) };
    if (franche.defauts.length < dernier.defauts.length) return franche;
  }
  return dernier!;
}
