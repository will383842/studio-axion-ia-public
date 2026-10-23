/**
 * Contrôles lus sur les MESURES du fichier exporté (composition `complet`, étapes 7 et 7 bis). PUR : les mesures
 * sont injectées, rien n'est mesuré ici. Une mesure absente rend le contrôle « non fait », jamais réussi.
 */
import { SEUILS_CONTROLE_IMAGE, nombre } from "./seuils";
import type { IdControle, MesuresExport, ResultatControle, SeuilsControleImage } from "./types";

function resultat(id: IdControle, libelle: string, bloquant: boolean, ok: boolean, raisonOk: string, raisonKo: string): ResultatControle {
  return { id, libelle, bloquant, etat: ok ? "reussi" : "echoue", raison: ok ? raisonOk : raisonKo };
}

function nonFait(id: IdControle, libelle: string, bloquant: boolean, raison: string): ResultatControle {
  return { id, libelle, bloquant, etat: "non-fait", raison };
}

function lire(m: MesuresExport, cle: string): number | null {
  const v = m[cle];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function controleVolume(m: MesuresExport, s: SeuilsControleImage = SEUILS_CONTROLE_IMAGE): ResultatControle {
  const libelle = "Volume du son";
  const v = lire(m, "lufs");
  if (v === null) return nonFait("volume", libelle, true, "Volume non mesuré sur le fichier exporté.");
  const cible = `${nombre(s.volumeCible)} à ${nombre(s.volumeTolerance)} près`;
  return resultat("volume", libelle, true, Math.abs(v - s.volumeCible) <= s.volumeTolerance, `Volume à ${nombre(v)}, dans la cible (${cible}).`, `Volume à ${nombre(v)}, hors de la cible (${cible}).`);
}

export function controleCrete(m: MesuresExport, s: SeuilsControleImage = SEUILS_CONTROLE_IMAGE): ResultatControle {
  const libelle = "Crête du son";
  const v = lire(m, "creteVraieDbtp");
  if (v === null) return nonFait("crete", libelle, true, "Crête du son non mesurée sur le fichier exporté.");
  return resultat("crete", libelle, true, v <= s.creteMax, `Crête à ${nombre(v)}, sous le plafond de ${nombre(s.creteMax)}.`, `Crête à ${nombre(v)}, au-dessus du plafond de ${nombre(s.creteMax)} : risque de son saturé.`);
}

/** Image noire : l'en-tête mesuré (`imageNoireTete`) et, s'il existe, le compte hors fin (`imagesNoiresHorsFin`). */
export function controleImageNoire(m: MesuresExport): ResultatControle {
  const libelle = "Image noire";
  const tete = lire(m, "imageNoireTete");
  const horsFin = lire(m, "imagesNoiresHorsFin");
  if (tete === null && horsFin === null) return nonFait("image-noire", libelle, true, "Images noires non mesurées sur le fichier exporté.");
  if (tete) return resultat("image-noire", libelle, true, false, "", "La vidéo commence sur une image noire.");
  if (horsFin) return resultat("image-noire", libelle, true, false, "", `${horsFin} passage${horsFin > 1 ? "s" : ""} noir${horsFin > 1 ? "s" : ""} avant la fin.`);
  return resultat("image-noire", libelle, true, true, horsFin === null ? "Aucune image noire au début de la vidéo." : "Aucune image noire avant la fin.", "");
}

/** Image figée hors fin : lue sur `imagesFigeesHorsFin` ; la composition ne la mesure pas encore → « non fait ». */
export function controleImageFigee(m: MesuresExport): ResultatControle {
  const libelle = "Image figée";
  const n = lire(m, "imagesFigeesHorsFin");
  if (n === null) return nonFait("image-figee", libelle, true, "Images figées non mesurées sur le fichier exporté.");
  return resultat("image-figee", libelle, true, n === 0, "Aucune image figée avant la fin.", `${n} passage${n > 1 ? "s" : ""} figé${n > 1 ? "s" : ""} avant la fin.`);
}

export function controleDuree(m: MesuresExport, s: SeuilsControleImage = SEUILS_CONTROLE_IMAGE): ResultatControle {
  const libelle = "Durée";
  const d = lire(m, "dureeSec");
  if (d === null || d <= 0) return nonFait("duree", libelle, true, "Durée non lue sur le fichier exporté.");
  return resultat("duree", libelle, true, d <= s.dureeMaxSec, `Durée de ${nombre(d)} s, dans la limite de ${s.dureeMaxSec} s.`, `Durée de ${nombre(d)} s, au-delà de la limite de ${s.dureeMaxSec} s.`);
}

/** Note de qualité de l'image (étape 7 bis) : indicative, comparée au seuil que la composition a utilisé. */
export function controleNoteQualite(m: MesuresExport): ResultatControle {
  const libelle = "Note de qualité de l'image";
  const note = lire(m, "vmaf");
  const seuil = lire(m, "vmafSeuil");
  if (note === null || seuil === null) return nonFait("note-qualite", libelle, false, "Note de qualité de l'image absente.");
  return resultat("note-qualite", libelle, false, note >= seuil, `Note de ${nombre(note)} sur 100, au-dessus du seuil de ${nombre(seuil, 0)}.`, `Note de ${nombre(note)} sur 100, sous le seuil de ${nombre(seuil, 0)} : image moins fine que voulu.`);
}

/** Tous les contrôles lus sur les mesures, dans l'ordre du rapport. */
export function controlerMesures(m: MesuresExport, s: SeuilsControleImage = SEUILS_CONTROLE_IMAGE): ResultatControle[] {
  return [controleVolume(m, s), controleCrete(m, s), controleImageNoire(m), controleImageFigee(m), controleDuree(m, s), controleNoteQualite(m)];
}
