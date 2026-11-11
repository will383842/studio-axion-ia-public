import type { CSSProperties, ReactNode } from "react";
import type { ParametresPiece } from "../catalogue";
import { adoucir, entre, progression } from "../../jetons-motion";
import { RACINE, round, type ProprietesBrique } from "./communs";
import { FenetreApp } from "./FenetreApp";

type P = ParametresPiece<"zoom-camera">;

/** Transformation de la caméra à cette image : rapprochement lent vers la cible, sans dépassement. */
export function transformZoom(p: P, image: number, dureeImages: number): CSSProperties {
  const debut = Math.round(dureeImages * p.moment);
  const t = progression(image, debut, Math.max(1, Math.round(dureeImages * 0.4)), adoucir);
  return { transform: `scale(${round(entre(1, p.facteur, t))})`, transformOrigin: `${p.cible.x}% ${p.cible.y}%` };
}

/** Zoom caméra. Seul (niveau 1) : sur une fenêtre d'app ; en calque (niveau 2) : agrandit les `enfants`. */
export function ZoomCamera(props: ProprietesBrique<P> & { enfants?: ReactNode }) {
  const { image, dureeImages, fond, accent, fps, parametres: p, enfants } = props;
  return (
    <div style={{ ...RACINE, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, ...transformZoom(p, image, dureeImages) }}>
        {enfants ?? <FenetreApp image={image} fps={fps} dureeImages={dureeImages} fond={fond} accent={accent} parametres={{ titre: p.titreFenetre, onglets: [], ongletActif: 0, contenu: "liste" }} />}
      </div>
    </div>
  );
}
