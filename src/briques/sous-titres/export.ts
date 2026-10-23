/**
 * EXPORTS .srt ET .vtt (B.5, B.7 bis) : texte VALIDÉ, UTF-8, aucun chevauchement de minutage. PUR.
 * Déposés sur YouTube (et sur LinkedIn / Facebook après essai) ; mêmes groupes que la vidéo.
 */
import type { SegmentSousTitres } from "@/domaine/types";
import { sansChevauchement } from "./groupement";

function horodatage(s: number, separateur: "," | "."): string {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}${separateur}${String(r).padStart(3, "0")}`;
}

/** Groupes exportables : triés, sans chevauchement, sans durée nulle. */
function exportables(segments: SegmentSousTitres[]): SegmentSousTitres[] {
  return sansChevauchement(segments).filter((s) => s.finSec - s.debutSec > 0.001 && s.mots.length);
}

const texte = (s: SegmentSousTitres) => s.mots.map((m) => m.mot).join(" ");

export function exporterSrt(segments: SegmentSousTitres[]): string {
  return exportables(segments)
    .map((s, i) => `${i + 1}\n${horodatage(s.debutSec, ",")} --> ${horodatage(s.finSec, ",")}\n${texte(s)}\n`)
    .join("\n");
}

export function exporterVtt(segments: SegmentSousTitres[]): string {
  return `WEBVTT\n\n${exportables(segments)
    .map((s) => `${horodatage(s.debutSec, ".")} --> ${horodatage(s.finSec, ".")}\n${texte(s)}\n`)
    .join("\n")}`;
}
