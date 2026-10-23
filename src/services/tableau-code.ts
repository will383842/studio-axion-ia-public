/**
 * CODE DE VERSION DU TABLEAU ANIMÉ (14/10/2026) : « 0042-TB-IG », un par réseau servi par les fichiers de la vidéo, posé
 * À LA FABRICATION par `codeVariante`, la pièce commune des autres formats (le tableau n'en avait aucun : sa mesure « par
 * vidéo » n'avait pas de clé). Numéro : le rang de la vidéo (`fixerRangDeLaVideo`, compteur unique du studio, fixé au
 * lancement et stable ensuite) ; format : son code du registre (`TB`). La fabrication le range dans la traçabilité
 * (événement « code »), que l'historique de la vidéo affiche ; il sert d'`utm_campaign` au lien suivi (contrat
 * d'échange § 5). PUR : aucun accès base ni réseau.
 */
import { codeVariante } from "@/domaine/derivations-generateur";
import type { IdReseau } from "@/domaine/types";
import type { IdSortie } from "@/moteurs/montage-tableau/formats-sortie";
import { RESEAUX_DES_SORTIES } from "./tableau-fin";

/** Ordre d'affichage des codes. */
const ORDRE: readonly IdReseau[] = ["instagram", "facebook", "tiktok", "youtube-shorts", "linkedin", "youtube"];

/** Code de version de chaque réseau servi par les sorties produites (vide : aucune sortie connue). */
export function codesVersionTableau(numero: number, sorties: readonly IdSortie[], codeFormat: string): Partial<Record<IdReseau, string>> {
  const servis = new Set(sorties.flatMap((s) => RESEAUX_DES_SORTIES[s] ?? []));
  return Object.fromEntries(ORDRE.filter((r) => servis.has(r)).map((reseau) => [reseau, codeVariante({ numero, codeFormat, reseau })]));
}
