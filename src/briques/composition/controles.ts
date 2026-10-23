/**
 * CONTRÔLES SUR LE FICHIER EXPORTÉ — brique commune « composition » (née au lot M4 ; plan B.7, B.8). PUR : lit les mesures renvoyées par l'opération
 * `composition` de `studio-rendu` (ffprobe, `ebur128` avec crête vraie, pauses, `blackdetect`, note VMAF). Jamais bloquant :
 * une alerte « attention » baisse la note et s'affiche dans la vérification.
 */
import type { AlerteQualite, RapportIntensite } from "@/domaine/types";
import type { ParametresExport, ParametresSon } from "./scene";

export type MesuresComposition = Record<string, number>;

/** Plage admise du niveau dans les pauses (références : jamais de silence sous −35 dB, plancher vers −40/−45). */
export const PAUSES_DB: [number, number] = [-48, -35];

/** Seuil de la note VMAF quand les mesures ne le donnent pas (même valeur que `VMAF.seuil` de studio-rendu). */
export const SEUIL_VMAF = 93;

export function controlesExport(m: MesuresComposition | undefined, son: Pick<ParametresSon, "lufs" | "toleranceLufs" | "creteVraieMaxDbtp">, exportP?: Pick<ParametresExport, "debitKbps" | "debitMaxKbps" | "fps">): AlerteQualite[] {
  if (!m) return [];
  const a: AlerteQualite[] = [];
  const ok = (x: number | undefined) => typeof x === "number" && Number.isFinite(x);
  // Niveau : −14 LUFS ±1, crête vraie ≤ −1,5 dBTP (mesurés sur le fichier exporté).
  if (ok(m.lufs) && Math.abs(m.lufs - son.lufs) > son.toleranceLufs + 1e-6) a.push({ code: "niveau-sonore", gravite: "attention", message: `Niveau ${m.lufs.toFixed(1)} LUFS (cible ${son.lufs} ± ${son.toleranceLufs}).` });
  if (ok(m.creteVraieDbtp) && m.creteVraieDbtp > son.creteVraieMaxDbtp + 1e-6) a.push({ code: "niveau-sonore", gravite: "attention", message: `Crête ${m.creteVraieDbtp.toFixed(1)} dBTP (au plus ${son.creteVraieMaxDbtp}).` });
  if (ok(m.pauseMinDb) && ok(m.pauseMaxDb) && (m.pauseMinDb < PAUSES_DB[0] - 1e-6 || m.pauseMaxDb > PAUSES_DB[1] + 1e-6)) {
    a.push({ code: "niveau-sonore", gravite: "info", message: `Niveau dans les pauses de ${m.pauseMinDb.toFixed(0)} à ${m.pauseMaxDb.toFixed(0)} dB (attendu ${PAUSES_DB[0]} à ${PAUSES_DB[1]}).` });
  }
  // Fichier : étiquettes BT.709, plage tv, yuv420p, lecture immédiate, débit.
  if (m.bt709 === 0 || m.plageTv === 0 || m.yuv420p === 0) a.push({ code: "export", gravite: "attention", message: "Les étiquettes de couleur du fichier ne sont pas celles attendues (BT.709, yuv420p)." });
  if (m.faststart === 0) a.push({ code: "export", gravite: "attention", message: "Le fichier ne se lit pas tout de suite en ligne." });
  if (exportP && ok(m.debitKbps) && m.debitKbps > exportP.debitMaxKbps * 1.15 + 320) a.push({ code: "export", gravite: "info", message: `Débit de ${(m.debitKbps / 1000).toFixed(1)} Mb/s, au-dessus du plafond.` });
  if (exportP && ok(m.fps) && m.fps > 0 && Math.abs(m.fps - exportP.fps) > 0.01) a.push({ code: "export", gravite: "attention", message: `Cadence de ${m.fps} i/s au lieu de ${exportP.fps}.` });
  // Note de qualité VMAF (09/10) contre ce que l'encodeur a reçu ; seuil renvoyé par studio-rendu (93 par défaut,
  // réglable), 0 = jamais d'alerte. Studio-rendu a déjà relancé UNE fois l'export plus fin sous le seuil.
  const seuilVmaf = ok(m.vmafSeuil) ? m.vmafSeuil : SEUIL_VMAF;
  if (ok(m.vmaf) && seuilVmaf > 0 && m.vmaf < seuilVmaf - 1e-6) {
    a.push({ code: "export", gravite: "attention", message: `Note de qualité de l'image ${m.vmaf.toFixed(1).replace(".", ",")} sur 100 (VMAF, au moins ${seuilVmaf})${m.vmafRelance === 1 ? ", même après un second export plus fin" : ""}.` });
  }
  // Aucune image noire en tête.
  if (m.imageNoireTete === 1) a.push({ code: "image-noire", gravite: "attention", message: "La vidéo commence par une image noire." });
  return a;
}

/** Note de qualité : chaque alerte « attention » coûte 3 points, chaque « info » 1, plancher 60. */
export function noteDepuisAlertes(base: number, alertes: AlerteQualite[]): number {
  const retrait = alertes.reduce((s, x) => s + (x.gravite === "attention" ? 3 : x.gravite === "bloquant" ? 10 : 1), 0);
  return Math.max(60, Math.round(base - retrait));
}

/**
 * Lot « intensité » (02/10, D1) : alerte `intensite` du contrôle qualité quand une fenêtre de 3 s dépasse le plafond
 * (seuls deux choix verrouillés empilés peuvent le faire : le chef d'orchestre ne place rien au-delà). Jamais bloquant.
 */
export function alertesIntensite(rapport: RapportIntensite | undefined): AlerteQualite[] {
  if (!rapport?.depassements.length) return [];
  const d = rapport.depassements[0];
  const n = rapport.depassements.length;
  return [{ code: "intensite", gravite: "attention", message: `Trop d'effets à la fois${n > 1 ? ` à ${n} moments` : ""} (de ${d.debutSec.toFixed(1).replace(".", ",")} à ${d.finSec.toFixed(1).replace(".", ",")} s) : retirez un effet verrouillé.` }];
}
