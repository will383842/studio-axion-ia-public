/**
 * BRIQUE COUPES — consignes dites au monteur (plan facecam v4 n° 15). PUR.
 *
 * Seule une phrase qui COMMENCE par « Monteur » est une consigne (pas d'impératif implicite). Les consignes sont
 * repérées AVANT les coupes, y compris dans les passages jetés (début, fin, reprises) : chacune devient une coupe de
 * type `consigne`, et aucune ne reste audible dans la version finale.
 *
 * Une consigne commence au mot « Monteur » placé en début de phrase (premier mot, mot précédent qui finit une phrase,
 * ou blanc d'au moins 0,5 s avant lui). Elle s'arrête au premier point final, ou au premier blanc d'au moins 0,8 s
 * (la fiche de tournage demande une seconde de pause après), et au plus tard après 40 mots ou 15 s.
 */
import type { ConsigneFacecam } from "@/domaine/facecam";
import type { MotHorodate } from "@/domaine/types";
import { finitPhrase, normaliser } from "./texte";

export interface ConsigneReperee {
  /** Index du premier et du dernier mot de la consigne (« Monteur » compris). */
  premierMot: number;
  dernierMot: number;
  debutSec: number;
  finSec: number;
  /** Ce que Will demande, sans le mot d'appel : « mets une carte liste ici ». */
  texte: string;
}

const BLANC_AVANT_SEC = 0.5;
const BLANC_APRES_SEC = 0.8;
const MOTS_MAX = 40;
const DUREE_MAX_SEC = 15;

/** « Monteur », « monteur, », « Monteur : ». */
function estMotDAppel(mot: string): boolean {
  const f = normaliser(mot);
  return f === "monteur" || f === "monteurs";
}

function debutDePhrase(mots: MotHorodate[], i: number): boolean {
  if (i === 0) return true;
  return finitPhrase(mots[i - 1].mot) || mots[i].debutSec - mots[i - 1].finSec >= BLANC_AVANT_SEC;
}

export function reperesConsignes(mots: MotHorodate[]): ConsigneReperee[] {
  const trouvees: ConsigneReperee[] = [];
  for (let i = 0; i < mots.length; i++) {
    if (!estMotDAppel(mots[i].mot) || !debutDePhrase(mots, i)) continue;
    let fin = i;
    // « Monteur. » tout seul n'arrête pas la consigne : la demande suit.
    for (let k = i + 1; k < mots.length; k++) {
      if (mots[k].debutSec - mots[k - 1].finSec >= BLANC_APRES_SEC && k > i + 1) break;
      fin = k;
      if (k - i + 1 >= MOTS_MAX || mots[k].finSec - mots[i].debutSec >= DUREE_MAX_SEC) break;
      if (finitPhrase(mots[k].mot)) break;
    }
    const texte = mots
      .slice(i + 1, fin + 1)
      .map((m) => m.mot)
      .join(" ")
      .replace(/^[\s,:;.\-–—]+/, "")
      .trim();
    trouvees.push({ premierMot: i, dernierMot: fin, debutSec: mots[i].debutSec, finSec: mots[fin].finSec, texte });
    i = fin;
  }
  return trouvees;
}

/** Les consignes repérées, au format des données de la vidéo (`entrees.facecam.consignes`), encore à interpréter. */
export function versConsignesFacecam(reperees: ConsigneReperee[], etat: ConsigneFacecam["etat"] = "comprise"): ConsigneFacecam[] {
  return reperees.map((c) => ({ id: `voix-${Math.round(c.debutSec * 100)}`, origine: "voix" as const, texte: c.texte, dansPriseSec: +c.debutSec.toFixed(2), etat }));
}
