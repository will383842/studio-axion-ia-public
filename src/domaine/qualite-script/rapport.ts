/**
 * SOCLE QUALITÉ · le rapport : résultats → note par thème, fonctions minimales, voyant, pastilles « info ». PUR.
 *
 * La note commune ne remplace ni la note /100 d'Écrire, ni la grille /10 du tableau, ni les règles R et Q : elle
 * s'affiche à côté. En MODE OBSERVATION, toutes les pastilles sont de niveau « info » : elles ne bloquent jamais.
 */
import type { PastilleControle } from "@/domaine/relecture-script";
import { SEUIL_THEME_AMBRE, SEUIL_THEME_ROUGE } from "./seuils";
import { LIBELLES_THEMES, THEMES, type NiveauVise, type ResultatRegle, type Theme } from "./types";

const POIDS: Readonly<Record<NiveauVise, number>> = { bloquant: 3, alerte: 2, info: 1 };

/** Note sur 10 de chaque thème (règles mesurées seulement, pondérées par leur niveau visé) ; `null` : rien de mesuré. */
export function notesParTheme(resultats: readonly ResultatRegle[]): Record<Theme, number | null> {
  return Object.fromEntries(
    THEMES.map((t) => {
      const mesures = resultats.filter((r) => r.theme === t && r.statut !== "non-mesure");
      const total = mesures.reduce((s, r) => s + POIDS[r.niveauVise], 0);
      const bons = mesures.filter((r) => r.statut !== "ecart").reduce((s, r) => s + POIDS[r.niveauVise], 0);
      return [t, total ? Math.round((10 * bons) / total) : null];
    }),
  ) as Record<Theme, number | null>;
}

/** Les fonctions minimales d'un script (règles de Will) : pas un ordre imposé, une présence vérifiée. */
export const FONCTIONS_MINIMALES = [
  { id: "accroche", libelle: "Une accroche courte, finie avant 3 s", codes: ["AC-01", "AC-02"] },
  { id: "tension", libelle: "Une tension : douleur du dirigeant ou curiosité", codes: ["AC-06"] },
  { id: "valeur", libelle: "Une valeur concrète (gain avec unité, cas, chiffre)", codes: ["VA-01"] },
  { id: "preuve", libelle: "Une preuve ou un exemple", codes: ["VA-02"] },
  { id: "promesse", libelle: "La promesse de l'accroche tenue", codes: ["VA-03"] },
  { id: "gain-tot", libelle: "La valeur livrée avant 40 %", codes: ["RT-04"] },
  { id: "relance", libelle: "Une relance entre 50 et 70 %", codes: ["RT-05"] },
  { id: "demande", libelle: "Une seule demande, en fin, liée à l'idée", codes: ["PR-02"] },
] as const;

export type FonctionMinimale = (typeof FONCTIONS_MINIMALES)[number]["id"];

/** Chaque fonction minimale : présente (true) si aucune de ses règles n'est en écart. */
export function fonctionsMinimales(resultats: readonly ResultatRegle[]): Record<FonctionMinimale, boolean> {
  return Object.fromEntries(FONCTIONS_MINIMALES.map((f) => [f.id, !resultats.some((r) => (f.codes as readonly string[]).includes(r.code) && r.statut === "ecart")])) as Record<FonctionMinimale, boolean>;
}

export type Voyant = "vert" | "ambre" | "rouge";

/**
 * Rouge : une règle qui serait bloquante est en écart, ou un thème sous `SEUIL_THEME_ROUGE` (4/10). Ambre : un thème
 * sous `SEUIL_THEME_AMBRE` (7/10). Vert sinon.
 */
export function voyantDe(resultats: readonly ResultatRegle[]): Voyant {
  if (resultats.some((r) => r.statut === "ecart" && r.niveauVise === "bloquant")) return "rouge";
  const notes = Object.values(notesParTheme(resultats)).filter((n): n is number => n !== null);
  if (notes.some((n) => n < SEUIL_THEME_ROUGE)) return "rouge";
  return notes.some((n) => n < SEUIL_THEME_AMBRE) ? "ambre" : "vert";
}

/**
 * Note d'un script sur 100 : la moyenne des thèmes mesurés ET le thème le plus faible, à parts égales. La moyenne seule
 * cachait les trous (un script sans positionnement à 4/10 gardait 80/100 parce que six thèmes sur sept allaient bien) ;
 * le thème le plus faible tire la note vers le bas. `null` : rien de mesuré.
 */
export function noteSur100(notes: Record<Theme, number | null>): number | null {
  const mesurees = Object.values(notes).filter((n): n is number => n !== null);
  if (!mesurees.length) return null;
  const moyenne = mesurees.reduce((s, n) => s + n, 0) / mesurees.length;
  return Math.round((10 * (moyenne + Math.min(...mesurees))) / 2);
}

/** Résumé lisible des notes (« Accroche 10/10 · Rétention 8/10… »). */
export function resumeNotes(notes: Record<Theme, number | null>): string {
  return THEMES.filter((t) => notes[t] !== null)
    .map((t) => `${LIBELLES_THEMES[t]} ${notes[t]}/10`)
    .join(" · ");
}

/**
 * Les pastilles pour « Relire le script » : TOUTES de niveau « info » (mode observation), préfixées du code de la
 * règle. Un écart et un absolu à trancher s'affichent ; ce qui va bien reste silencieux, sauf le résumé des notes.
 */
export function pastillesQualite(resultats: readonly ResultatRegle[]): PastilleControle[] {
  const notes = notesParTheme(resultats);
  const lignes = resultats
    .filter((r) => r.statut === "ecart" || r.statut === "a-trancher")
    .map((r): PastilleControle => ({
      niveau: "info",
      code: `socle-${r.code}`,
      texte: r.statut === "a-trancher" && r.versionPrudente ? `${r.message} Version prudente : « ${r.versionPrudente} ».` : r.message,
      ...(r.ligneId ? { ligneId: r.ligneId } : {}),
    }));
  return [{ niveau: "info", code: "socle-notes", texte: `Socle qualité (observation) : ${resumeNotes(notes)}.` }, ...lignes];
}
