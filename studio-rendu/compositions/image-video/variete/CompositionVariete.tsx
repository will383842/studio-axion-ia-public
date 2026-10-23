import React from "react";
/**
 * Composition `ImageVideoVariete` : l'écran propre d'un axe de variété (bloc `sorte: "variete"` de la ligne de temps).
 * Aiguillage `bloc.axe` → `<axe>/ecran.tsx`, dans le contexte et l'habillage de variété. Aucun JSX ni calcul au niveau
 * module.
 */
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { QueueFinIV } from "../../../../src/briques/schema-motion/queue-fin";
import type { BlocVarieteDonnees, VarieteBlocIV } from "../../../../src/briques/schema-motion/variete";
import { chargerPoliceAnton, chargerPoliceTitre } from "../../commune/polices";
import type { ChangementRepere } from "../plan-objets";
import { decalageReferenceIV } from "../mise-en-page";
import { QueueFin } from "../QueueFin";
import { RepereChapitre } from "../RepereChapitre";
import { EcranCamera } from "./camera/ecran";
import { EcranChiffres } from "./chiffres/ecran";
import { ContexteVariete } from "./ContexteVariete";
import { EcranFin } from "./fin/ecran";
import { HabillageVariete } from "./HabillageVariete";
import { EcranOuverture } from "./ouverture/ecran";
import { EcranTexte } from "./texte/ecran";

export const COMPOSITION_VARIETE_IV = "ImageVideoVariete";

/** Propriétés de la composition (celles que pose `parametresDuBloc` pour un bloc `variete`). */
export type ProprietesEcranVariete = {
  largeur: number;
  hauteur: number;
  fps: number;
  dureeSec: number;
  marque: "axion-ia.com";
  bloc: BlocVarieteDonnees;
  variete?: VarieteBlocIV;
  /** Repère « k/N » de la place du bloc (image en chapitres), comme sur un bloc `moments`. */
  repere?: { changements: ChangementRepere[]; total: number; prefixe?: string } | null;
  /** Queue animée quand le bloc finit la vidéo (trait de fin, `QueueFin`). */
  queue?: QueueFinIV | null;
};

/** Fond de l'écran d'un axe (pour les couleurs du repère) : lu dans ses données, nuit par défaut. */
function fondDuBloc(bloc: BlocVarieteDonnees): "ivoire" | "sombre" {
  const d = (bloc.donnees ?? {}) as { fond?: unknown; nuit?: unknown };
  return d.fond === "ivoire" || (d.fond === undefined && d.nuit === false) ? "ivoire" : "sombre";
}

function Repere({ p }: { p: ProprietesEcranVariete }) {
  const t = useCurrentFrame() / p.fps;
  if (!p.repere) return null;
  return (
    <AbsoluteFill style={{ transform: `${decalageReferenceIV(p.hauteur)} scale(${p.largeur / 1080})`, transformOrigin: "0 0", width: 1080, height: 1920 }}>
      <RepereChapitre changements={p.repere.changements} total={p.repere.total} prefixe={p.repere.prefixe} t={t} fond={fondDuBloc(p.bloc)} />
    </AbsoluteFill>
  );
}

function Queue({ p }: { p: ProprietesEcranVariete }) {
  const t = useCurrentFrame() / p.fps;
  return <QueueFin queue={p.queue} t={t} largeur={p.largeur} hauteur={p.hauteur} />;
}

/** Taille, cadence et durée lues dans les propriétés. */
export const metaVarieteIV = ({ props }: { props: ProprietesEcranVariete }) => ({
  width: props.largeur,
  height: props.hauteur,
  fps: props.fps,
  durationInFrames: Math.max(1, Math.round(props.dureeSec * props.fps)),
});

/** Propriétés par défaut (aperçu dans le studio) : un écran d'ouverture vide, 9:16, 3 s. */
export function proprietesVarieteDefaut(): ProprietesEcranVariete {
  return { largeur: 1080, hauteur: 1920, fps: 30, dureeSec: 3, marque: "axion-ia.com", bloc: { axe: "ouverture", code: "OUV-A", donnees: null } };
}

function EcranDeLAxe(p: ProprietesEcranVariete) {
  switch (p.bloc.axe) {
    case "ouverture":
      return <EcranOuverture {...p} />;
    case "texte":
      return <EcranTexte {...p} />;
    case "chiffres":
      return <EcranChiffres {...p} />;
    case "camera":
      return <EcranCamera {...p} />;
    case "fin":
      return <EcranFin {...p} />;
  }
}

export function SceneVarieteIV(p: ProprietesEcranVariete) {
  chargerPoliceAnton();
  chargerPoliceTitre();
  return (
    <ContexteVariete variete={p.variete}>
      <HabillageVariete>
        <AbsoluteFill>
          <EcranDeLAxe {...p} />
          <Repere p={p} />
          <Queue p={p} />
        </AbsoluteFill>
      </HabillageVariete>
    </ContexteVariete>
  );
}
