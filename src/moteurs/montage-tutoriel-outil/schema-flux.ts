// T-EXT-50 · Schéma animé du flux (5 à 8 s) : étapes en blocs reliés qui s'allument au fil de la voix.
// PUR, imports RELATIFS seulement (lu tel quel par `studio-rendu`). Ne lève jamais : un défaut devient une alerte.
// Couleurs du schéma : « noir » (étape humaine) et « neutre » seulement ; jamais « orange » ni « vert ».
import { controlerCadrage, trajectoireCamera, type CadrageCamera, type DefautCadrage } from "../../briques/schema-motion/camera";
import { disposerToile } from "../../briques/schema-motion/disposition";
import { AVANCE_NOEUD_IV, ECRAN_IV, type LienEntree, type MotParle, type NoeudEntree, type SchemaEntree } from "../../briques/schema-motion/types";
import type { FluxAutomatisation } from "./gabarit-flux";
import type { BlocFlux, PlanSchemaFlux } from "./proprietes";

export type { BlocFlux, PlanSchemaFlux };

/** Un mot de la voix, avec son heure en ms depuis le début de la vidéo. */
export interface MotVoixFlux {
  texte: string;
  debutMs: number;
}

/** Durée d'entrée d'un bloc et de tracé d'une flèche (s). */
export const ENTREE_BLOC_SEC = 0.3;
export const TRACE_FLECHE_SEC = 0.3;

const COULEURS_PERMISES = ["noir", "neutre"] as const;

function courtDe(libelle: string): string {
  return libelle.trim().split(/\s+/).slice(0, 3).join(" ");
}

/** Un nœud par étape, liens dans l'ordre (pointillé vers une étape humaine). */
export function schemaDepuisFlux(flux: FluxAutomatisation): SchemaEntree {
  const noeuds: NoeudEntree[] = flux.etapes.map((e, i) => ({
    id: e.id,
    libelle: e.libelleSchema,
    role: e.acteur,
    couleur: e.acteur === "humain" ? "noir" : "neutre",
    ordre: i,
    court: courtDe(e.libelleSchema),
  }));
  const liens: LienEntree[] = flux.etapes.slice(1).map((e, i) => ({
    id: `lien-${i + 1}`,
    de: flux.etapes[i]!.id,
    vers: e.id,
    couleur: "noir",
    style: e.acteur === "humain" ? "pointille" : "plein",
  }));
  return { noeuds, liens, groupes: [] };
}

const norme = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Plan du schéma : disposition, heure de chaque étape (son mot dans la voix, entre `debutMs` et `finMs`), caméra et
 * contrôle de cadrage. Une étape dont le mot n'est pas dit dans la fenêtre reçoit une heure répartie et une alerte.
 */
export function planSchemaFlux(flux: FluxAutomatisation, motsVoix: readonly MotVoixFlux[], debutMs: number, finMs: number, format?: { largeur: number; hauteur: number }): PlanSchemaFlux {
  const alertes: string[] = [];
  const dureeSec = Math.max(0.1, (finMs - debutMs) / 1000);
  const vide: PlanSchemaFlux = { dureeSec, entreeSec: ENTREE_BLOC_SEC, traceDureeSec: TRACE_FLECHE_SEC, toile: { largeur: 0, hauteur: 0, boites: [], fleches: [], branches: [] }, trajectoire: { images: [], alertes: [] }, blocs: [], alertes };
  try {
    const schema = schemaDepuisFlux(flux);
    if (schema.noeuds.some((n) => !(COULEURS_PERMISES as readonly string[]).includes(n.couleur))) alertes.push("Couleur de schéma hors charte.");
    const fenetre = motsVoix.filter((m) => m.debutMs >= debutMs && m.debutMs <= finMs).sort((a, b) => a.debutMs - b.debutMs);
    const n = flux.etapes.length;
    const heures: number[] = [];
    let curseur = 0;
    flux.etapes.forEach((e, i) => {
      const cible = norme(e.surMot);
      let k = -1;
      for (let j = curseur; j < fenetre.length; j++) {
        if (norme(fenetre[j]!.texte) === cible) {
          k = j;
          break;
        }
      }
      let t: number;
      if (k >= 0) {
        t = (fenetre[k]!.debutMs - debutMs) / 1000;
        curseur = k + 1;
      } else {
        alertes.push(`Le mot « ${e.surMot} » de l'étape « ${e.id} » n'est pas dit pendant le schéma : heure répartie.`);
        t = ((i + 1) / (n + 1)) * dureeSec;
      }
      heures.push(Math.max(i === 0 ? 0 : heures[i - 1]!, t));
    });
    const mots: MotParle[] = flux.etapes.map((e, i) => ({ noeud: e.id, t: heures[i]! }));
    const toile = disposerToile(schema);
    const cadre = format ? cadreDe(format) : undefined;
    const cadrage: CadrageCamera | undefined = cadre ? { cadre } : undefined;
    const trajectoire = trajectoireCamera(toile, mots, dureeSec, cadrage);
    alertes.push(...trajectoire.alertes);
    for (const d of controlerCadrage(toile, trajectoire, mots, cadrage) as DefautCadrage[]) alertes.push(`Bloc « ${d.id} » coupé par le bord à ${d.t.toFixed(2)} s.`);
    const blocs: BlocFlux[] = flux.etapes.map((e, i) => {
      const motSec = heures[i]!;
      const bloc: BlocFlux = { id: e.id, libelle: e.libelleSchema, humain: e.acteur === "humain", motSec, allumageSec: Math.max(0, motSec - AVANCE_NOEUD_IV) };
      if (i > 0) bloc.traceSec = Math.max(0, motSec - AVANCE_NOEUD_IV - TRACE_FLECHE_SEC);
      return bloc;
    });
    return { dureeSec, entreeSec: ENTREE_BLOC_SEC, traceDureeSec: TRACE_FLECHE_SEC, toile, trajectoire, blocs, alertes };
  } catch {
    alertes.push("Le schéma n'a pas pu être posé.");
    return vide;
  }
}

/** Partie de l'écran de référence (1080 × 1920) qui reste visible dans la composition, en fractions de la hauteur. */
export function cadreDe(format: { largeur: number; hauteur: number }): { haut: number; bas: number } {
  const echelle = echelleSchema(format);
  const visible = Math.min(ECRAN_IV.hauteur, format.hauteur / echelle);
  const marge = (ECRAN_IV.hauteur - visible) / 2 / ECRAN_IV.hauteur;
  return { haut: marge, bas: 1 - marge };
}

/** Échelle de l'écran de référence dans la composition : portrait et carré à la largeur, paysage à la hauteur de 1080. */
export function echelleSchema(format: { largeur: number; hauteur: number }): number {
  return format.hauteur >= format.largeur ? format.largeur / ECRAN_IV.largeur : format.hauteur / ECRAN_IV.largeur;
}
