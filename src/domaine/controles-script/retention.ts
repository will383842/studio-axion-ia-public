/**
 * RÉTENTION (étalonnage sur la v4 de Will). PUR. Des informations seulement, au poids modeste dans la note.
 *
 *  - C89 : la 1re phrase dite tient en 12 mots ;
 *  - C90 : pas de pré-roll en tête (« Dans cette vidéo », « Aujourd'hui », « Je vais vous… ») ; le salut et la
 *          présentation (« Bonjour », « Salut », « Je m'appelle ») restent à C3 bis ;
 *  - C91 : un chiffre, une contradiction ou « pour qui » dans les 9 premiers mots ;
 *  - C92 : la promesse de l'accroche est tenue (reprise, livrée) avant la dernière phrase ;
 *  - C93 : longueur cohérente avec la durée MESURÉE (≈ 80-100 mots pour 30 s, 160-190 pour 60 s, ± 15 %).
 * Un seul appel à l'action : déjà C3 (plusieurs appels dans la fin, impératif hors du bloc d'appel).
 */
import { nombresAffirmes } from "@/domaine/nombres-fr";
import { segmentsParles, type Analyse, type Collecte } from "./analyse";
import { ROLE_CIBLE } from "./probleme";
import type { EntreeControle } from "./types";
import { mots, normaliser, phrasesDe } from "./texte";

const MOTIF_PREROLL = /^((bonjour|salut|hello)[\s,!.]*)?(dans (cette|la|notre) video|aujourd'hui|je vais vous|on va (voir|parler)|petite video)(?=$|[^a-z])/;
const MOTIF_CONTRADICTION = /(?:^|[^a-z])(mais|pourtant|sauf|jamais|faux|arretez|arrete|stop|personne ne|aucun|aucune|plus besoin|n'est pas|ne sert)(?=$|[^a-z])/;

export function c89a91(e: EntreeControle, a: Analyse, col: Collecte): void {
  const parles = segmentsParles(a);
  if (!parles.length) return;
  const premiere = phrasesDe(parles[0].dit)[0] ?? "";
  if (mots(premiere).length > 12) col.ajouter("C89", `1re phrase de ${mots(premiere).length} mots (12 au plus).`, { segmentIndex: parles[0].index });
  if (MOTIF_PREROLL.test(normaliser(premiere))) col.ajouter("C90", `Pré-roll en tête (« ${premiere} ») : entrer dans le sujet dès le premier mot.`, { segmentIndex: parles[0].index });
  const debut = mots(parles.map((s) => s.dit).join(" ")).slice(0, 9).join(" ");
  const n = normaliser(debut);
  if (!nombresAffirmes(debut).length && !MOTIF_CONTRADICTION.test(n) && !ROLE_CIBLE.test(n)) col.ajouter("C91", "Ni chiffre, ni contradiction, ni « pour qui » dans les 9 premiers mots.", { segmentIndex: parles[0].index });
}

/** C92 : un segment du corps reprend la preuve, la matière ou le nombre de l'accroche, ou livre un résultat. */
export function c92(e: EntreeControle, a: Analyse, col: Collecte): void {
  if (!a.accroche.length) return;
  const derniere = segmentsParles(a).at(-1);
  const ids = new Set(a.accroche.flatMap((s) => [...(s.segment.preuveIds ?? []), ...(s.segment.matiereIds ?? [])]));
  const valeurs = nombresAffirmes(a.accroche.map((s) => s.dit).join(" ")).map((x) => x.valeur);
  const tenue = a.corps.some(
    (s) =>
      s.index !== derniere?.index &&
      (s.marqueurs.includes("livraison") ||
        s.marqueurs.includes("resultat") ||
        [...(s.segment.preuveIds ?? []), ...(s.segment.matiereIds ?? [])].some((id) => ids.has(id)) ||
        nombresAffirmes(s.dit).some((x) => valeurs.includes(x.valeur))),
  );
  if (!tenue) col.ajouter("C92", "La promesse de l'accroche n'est ni reprise ni livrée avant la dernière phrase.");
}

/** Mots attendus pour une durée : 80-100 mots à 30 s, 160-190 à 60 s (interpolé), ± 15 %. */
export function bandeMots(dureeSec: number): [number, number] {
  const t = Math.min(1, Math.max(0, (dureeSec - 30) / 30));
  const max = (100 / 30) * (1 - t) + (190 / 60) * t;
  return [Math.round((80 / 30) * dureeSec * 0.85), Math.round(max * dureeSec * 1.15)];
}

/** C93 : seulement sur une durée mesurée (une durée estimée découle déjà du nombre de mots). */
export function c93(e: EntreeControle, a: Analyse, col: Collecte): void {
  if (!e.debitMesure && !e.horodatageReel) return;
  const n = segmentsParles(a).reduce((s, x) => s + mots(x.dit).length, 0);
  const [min, max] = bandeMots(a.dureeSec);
  if (n < min || n > max) col.ajouter("C93", `${n} mots pour ${a.dureeSec.toFixed(1)} s (${min} à ${max} attendus).`);
}
