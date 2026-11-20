/**
 * Paramètres d'une courbe à plusieurs séries tirés d'un tableau de bord (G4-11). PUR : aucun disque,
 * aucun réseau, aucune horloge, aucun hasard. Ne lève jamais. Seuls des textes et chiffres de la donnée.
 * Rien ne l'appelle encore (la courbe n'est pas inscrite : G4-11b).
 */
import type { SerieTableau, TableauDeBord } from "./types";

/**
 * Bornes de la courbe (miroir de celles de la pièce, qu'un test compare). Pas d'import de la pièce : un test
 * existant interdit à tout fichier de src/ de citer ce dossier tant que la courbe n'est pas inscrite.
 */
const SERIES_MIN = 2;
const SERIES_MAX = 4;
const POINTS_MIN = 3;
const POINTS_MAX = 12;

export interface SerieCourbe {
  nom: string;
  valeurs: number[];
}
export interface ParametresCourbeSeries {
  titre: string;
  abscisses: string[];
  series: SerieCourbe[];
  enAvant?: number;
}

export interface CourbeDesSeries {
  parametres: ParametresCourbeSeries | null;
  notes: string[];
}

const cle = (s: SerieTableau) => `${String(s.unite).trim()}\u0000${s.points.map((p) => p.x).join("\u0001")}`;

export function courbeDesSeries(d: TableauDeBord): CourbeDesSeries {
  const notes: string[] = [];
  const refus = (m: string): CourbeDesSeries => ({ parametres: null, notes: [...notes, m] });
  try {
    const series = Array.isArray(d.series) ? d.series : [];
    const groupes = new Map<string, SerieTableau[]>();
    for (const s of series) {
      const k = cle(s);
      groupes.set(k, [...(groupes.get(k) ?? []), s]);
    }
    let groupe = [...groupes.values()].find((g) => g.length >= SERIES_MIN);
    if (!groupe) return refus(`Courbe : il faut au moins ${SERIES_MIN} séries de même unité et de mêmes abscisses.`);
    if (groupe.length > SERIES_MAX) {
      notes.push(`${groupe.length} séries : les ${SERIES_MAX} premières montrées`);
      groupe = groupe.slice(0, SERIES_MAX);
    }
    if (groupe[0]!.points.length < POINTS_MIN) return refus(`Courbe : il faut au moins ${POINTS_MIN} points.`);
    if (groupe.some((s) => s.points.some((p) => p.valeur < 0))) return refus("Courbe : valeur négative, courbe omise.");
    const cand: ParametresCourbeSeries = {
      titre: d.titre,
      abscisses: groupe[0]!.points.map((p) => p.x),
      series: groupe.map((s) => ({ nom: s.libelle, valeurs: s.points.map((p) => p.valeur) })),
    };
    let enAvant = 0;
    cand.series.forEach((s, i) => {
      if (s.valeurs[s.valeurs.length - 1]! > cand.series[enAvant]!.valeurs[cand.series[enAvant]!.valeurs.length - 1]!) enAvant = i;
    });
    cand.enAvant = enAvant;
    const erreurs: string[] = [];
    if (cand.titre.trim() === "") erreurs.push("titre vide");
    if (cand.abscisses.length < POINTS_MIN || cand.abscisses.length > POINTS_MAX) erreurs.push(`il faut de ${POINTS_MIN} à ${POINTS_MAX} points`);
    if (cand.series.some((s) => s.nom.trim() === "")) erreurs.push("nom de série vide");
    if (cand.series.some((s) => s.valeurs.length !== cand.abscisses.length || !s.valeurs.every((v) => Number.isFinite(v)))) erreurs.push("valeurs non conformes");
    return erreurs.length === 0 ? { parametres: cand, notes } : { parametres: null, notes: [...notes, ...erreurs] };
  } catch {
    return { parametres: null, notes: ["Courbe : donnée illisible."] };
  }
}
