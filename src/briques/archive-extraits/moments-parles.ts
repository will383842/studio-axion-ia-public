/**
 * Moments parlés (X4-10c) : plages du chantier 3 → `Moment` d'origine « parole », et contexte de note d'une vidéo.
 * Fonctions pures, aucun appelant, tout éteint : aucune date, aucun hasard, aucune entrée modifiée.
 */
import type { FicheSourceExtraits } from "../../domaine/archive-extraits";
import type { Script, Video } from "../../domaine/types";
import type { MotFait } from "../faits-script/types";
import type { ContexteNote } from "../note-extraits/noter";
import { sujetDuMoment, type EntreeSujet } from "../note-extraits/sujets";
import type { Moment } from "../note-extraits/types";

/** Une plage → un moment parlé. Les plages exclues (droit d'abord) et celles déjà issues d'un tri sont retirées ; ordre conservé. */
export function momentsParles(fiche: Pick<FicheSourceExtraits, "plages" | "ratio">): Moment[] {
  return fiche.plages
    .filter((p) => p.etat !== "exclue" && (p.origine === undefined || p.origine === "parole"))
    .map((p) => ({
      id: p.id,
      origine: "parole" as const,
      debutSec: p.debutSec,
      finSec: p.finSec,
      montre: p.avecVisage ? ("visage" as const) : ("texte" as const),
      texte: p.texte,
      avecVisage: p.avecVisage,
      texteIncruste: p.texteIncruste,
      ratio: fiche.ratio,
    }));
}

/** Mots séparés par les espaces, temps répartis à parts égales entre début et fin (ms entiers, croissants). */
export function motsDuTexte(texte: string, debutSec: number, finSec: number): MotFait[] {
  const mots = texte.split(/\s+/).filter(Boolean);
  const n = mots.length;
  if (n === 0) return [];
  const debut = Math.round(debutSec * 1000);
  const fin = Math.max(debut, Math.round(finSec * 1000));
  const borne = (i: number) => debut + Math.round(((fin - debut) * i) / n);
  return mots.map((m, i) => ({ texte: m, debutMs: borne(i), finMs: borne(i + 1) }));
}

/** Forme prête à passer en 2ᵉ paramètre de `trierVideo`. Ne pose ni `etat` ni `sourcePropre`. */
export function contexteDeNote(entree: {
  video: Pick<Video, "titre" | "typeAutomatisation" | "couvertureVignette">;
  script?: Pick<Script, "typeAutomatisation">;
  cas?: EntreeSujet["cas"];
}): (m: Moment) => ContexteNote {
  return (m) => {
    const sujet = sujetDuMoment({
      video: entree.video,
      script: entree.script,
      cas: entree.cas,
      texte: `${entree.video.titre} ${m.texte ?? ""}`,
    });
    const contexte: ContexteNote = { sujet };
    const motCle = entree.video.couvertureVignette?.motCle;
    if (motCle) contexte.motCle = motCle;
    if (m.texte) contexte.mots = motsDuTexte(m.texte, m.debutSec, m.finSec);
    return contexte;
  };
}
