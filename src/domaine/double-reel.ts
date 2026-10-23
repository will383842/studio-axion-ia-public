/**
 * Part du double RÉEL dans une estimation (lot R7) : lignes « Double… » d'un fournisseur réel. PUR, partagé par le
 * moteur avocat et les services (qui ne lisent jamais le moteur avocat directement).
 */
import type { AngleVisage, DoubleDejaRendu, LigneCout, Montant, Travail } from "./types";
import { additionner, formaterMontant } from "@/lib/montants";

/** Une estimation qui en contient exige TOUJOURS la confirmation de Will, quel que soit son seuil (testé). */
export function partDoubleReel(lignes: Pick<LigneCout, "etape" | "fournisseur" | "total">[]): Montant | null {
  const part = lignes.filter((l) => l.etape.startsWith("Double") && l.fournisseur !== "simulation");
  return part.length ? additionner(...part.map((l) => l.total)) : null;
}

/**
 * Lot R7e : phrase de confirmation, simple, montrée avant chaque vidéo où l'avatar parle (prix annoncé). `combien` > 1 :
 * feuille qui lance plusieurs vidéos d'un coup (« Fabriquer les N »).
 */
export function phraseAvatarParle(part: Montant, combien = 1): string {
  return `Votre avatar parle dans ${combien > 1 ? "ces vidéos" : "cette vidéo"} : environ ${formaterMontant(part)}, à confirmer.`;
}

/** Ce que `doubleDejaRenduDepuis` lit de l'état du double gardé dans un travail (moteur avocat, `EtatDoubleMoteur`). */
interface EtatDoubleLu {
  fournisseur: string;
  fond?: DoubleDejaRendu["fond"];
  lookIds: Partial<Record<AngleVisage, string>>;
  pieces: { angle: AngleVisage; index: number; tranche: boolean; debutSec: number; finSec: number; phase: string; videoCle?: string; dureeSec?: number }[];
}

/**
 * Correcteur réel 2 : rendus du double déjà PAYÉS par une fabrication terminée (la plus récente d'abord), faits sur CE
 * audio maître (même empreinte, même fichier). PUR, testé. Undefined : rien à reprendre.
 */
export function doubleDejaRenduDepuis(travaux: Pick<Travail, "statut" | "modifieLe" | "parametres">[], audio: { empreinte: string; fichierCle: string } | undefined): DoubleDejaRendu | undefined {
  if (!audio) return undefined;
  for (const t of [...travaux].filter((x) => x.statut === "termine").sort((a, b) => b.modifieLe.localeCompare(a.modifieLe))) {
    const voix = t.parametres?.voix as { phase?: string; audio?: { empreinte?: string; fichierCle?: string } } | undefined;
    const double = t.parametres?.double as EtatDoubleLu | undefined;
    if (voix?.phase !== "faite" || voix.audio?.empreinte !== audio.empreinte || voix.audio.fichierCle !== audio.fichierCle || !double?.pieces?.length || double.fournisseur === "simulation") continue;
    const faites = double.pieces.filter((p) => p.phase === "faite" && !!p.videoCle);
    if (!faites.length) continue;
    return {
      empreinteAudio: audio.empreinte,
      audioCle: audio.fichierCle,
      fournisseur: double.fournisseur,
      fond: double.fond ?? "sans-fond",
      lookIds: { ...double.lookIds },
      pieces: faites.map((p) => ({ angle: p.angle, index: p.index, tranche: p.tranche, debutSec: p.debutSec, finSec: p.finSec, videoCle: p.videoCle!, ...(p.dureeSec ? { dureeSec: p.dureeSec } : {}) })),
    };
  }
  return undefined;
}
