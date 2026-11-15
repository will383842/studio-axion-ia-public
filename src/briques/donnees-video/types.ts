/** Types inférés du schéma `tableau-de-bord.v1` et lecture qui ne lève jamais (G4-01). */
import type { z } from "zod";
import { schemaTableauDeBord, VERSION_TABLEAU_DE_BORD } from "./schema";

export { schemaTableauDeBord, VERSION_TABLEAU_DE_BORD };
export type TableauDeBord = z.infer<typeof schemaTableauDeBord>;
export type IndicateurTableau = TableauDeBord["indicateurs"][number];
export type SerieTableau = TableauDeBord["series"][number];
export type PointSerie = SerieTableau["points"][number];
export type ComparaisonTableau = TableauDeBord["comparaisons"][number];
export type AlerteTableau = TableauDeBord["alertes"][number];
export type CalculTableau = TableauDeBord["calculs"][number];

export type LectureTableauDeBord = { ok: true; donnee: TableauDeBord } | { ok: false; erreurs: string[] };

/** Relit une entrée inconnue. Ne lève jamais ; les erreurs sont en français, précédées de leur chemin. */
export function lireTableauDeBord(entree: unknown): LectureTableauDeBord {
  try {
    const r = schemaTableauDeBord.safeParse(entree);
    if (r.success) return { ok: true, donnee: r.data };
    return {
      ok: false,
      erreurs: r.error.issues.map((i) => {
        const chemin = i.path.map(String).join(".");
        const msg = i.code === "unrecognized_keys" ? `Champ inconnu refusé : ${i.keys.map((k) => `« ${k} »`).join(", ")}.` : i.message;
        return chemin ? `${chemin} : ${msg}` : msg;
      }),
    };
  } catch {
    return { ok: false, erreurs: ["Entrée illisible."] };
  }
}
