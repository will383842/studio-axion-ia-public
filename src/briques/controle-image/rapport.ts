/**
 * Rapport unique du contrôle de l'image finale. PUR. Une brique ratée (erreur, donnée absente) devient un contrôle
 * « non fait » : elle n'empêche pas la livraison, le rapport le dit (« 1 élément non fait »).
 */
import { controlerMesures } from "./mesures";
import { controlerMiseEnPage } from "./mise-en-page";
import { SEUILS_CONTROLE_IMAGE } from "./seuils";
import type { IdControle, MesuresExport, MiseEnPage, RapportControleImage, ResultatControle, SeuilsControleImage, ZoneSure } from "./types";

/** Lance une brique de contrôle ; une erreur la rend « non faite » au lieu d'interrompre le rapport. */
export function executerBrique(id: IdControle, libelle: string, bloquant: boolean, brique: () => ResultatControle[]): ResultatControle[] {
  try {
    return brique();
  } catch (e) {
    const detail = e instanceof Error && e.message ? ` (${e.message})` : "";
    return [{ id, libelle, bloquant, etat: "non-fait", raison: `Contrôle non fait : erreur pendant la vérification${detail}.` }];
  }
}

/** Verdict : bloqué dès qu'un contrôle bloquant échoue ; les contrôles non faits sont comptés, jamais bloquants. */
export function etablirRapport(controles: ResultatControle[]): RapportControleImage {
  const echecs = controles.filter((c) => c.bloquant && c.etat === "echoue").length;
  const nonFaits = controles.filter((c) => c.etat === "non-fait").length;
  const suffixe = nonFaits ? ` — ${nonFaits} élément${nonFaits > 1 ? "s" : ""} non fait${nonFaits > 1 ? "s" : ""}` : "";
  const verdict = echecs ? "bloque" : "livrable";
  const resume = echecs ? `Bloqué : ${echecs} contrôle${echecs > 1 ? "s" : ""} échoué${echecs > 1 ? "s" : ""}${suffixe}` : `Livrable${suffixe}`;
  return { controles, verdict, nonFaits, resume };
}

export interface EntreeControleImage {
  /** Mesures rendues par la composition `complet` ; absentes : les contrôles du fichier sont « non faits ». */
  mesures?: MesuresExport;
  /** Mise en page de la vidéo ; absente : les contrôles calculés sont « non faits ». */
  miseEnPage?: MiseEnPage;
  /** Zone sûre (voir `zoneSureDe`) ; null : contrôles de zone « non faits ». */
  zone: ZoneSure | null;
  seuils?: SeuilsControleImage;
}

/** Contrôle complet de l'image finale : mesures du fichier exporté puis calculs sur la mise en page. */
export function controlerImageFinale(e: EntreeControleImage): RapportControleImage {
  const s = e.seuils ?? SEUILS_CONTROLE_IMAGE;
  const mesures = e.mesures
    ? executerBrique("volume", "Mesures du fichier exporté", true, () => controlerMesures(e.mesures!, s))
    : [{ id: "volume" as const, libelle: "Mesures du fichier exporté", bloquant: true, etat: "non-fait" as const, raison: "Mesures du fichier exporté absentes." }];
  const page = e.miseEnPage
    ? executerBrique("zone-sure", "Mise en page", true, () => controlerMiseEnPage(e.miseEnPage!, e.zone, s))
    : [{ id: "zone-sure" as const, libelle: "Mise en page", bloquant: true, etat: "non-fait" as const, raison: "Mise en page absente : zones, taille, contraste et première image non vérifiés." }];
  return etablirRapport([...mesures, ...page]);
}
