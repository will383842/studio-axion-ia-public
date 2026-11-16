/**
 * CARTE EN VERRE DÉPOLI PURE (X1-04). Rien ne l'importe : éteinte par défaut, hors `IDS_FONDS_VIVANTS` et hors
 * `choix.ts`. Drapeau `attendMesure: true` : aucun allumage avant la mesure du surcoût de rendu (même règle que AM-05).
 *
 * Un flou d'arrière-plan (jamais plus de 16 px) et un voile uni de la charte : ivoire sur fond ivoire, noir sur fond
 * noir. Aucun dégradé, aucune autre couleur. Jamais pour la v4. PUR : aucun hasard, aucune horloge, imports relatifs.
 */
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { CHARTE_AXION, avecOpacite, type FondAxion } from "../../jetons-motion";

/** Flou maximal autorisé, en pixels. */
export const FLOU_MAX_PX = 16;

export interface DescriptionVerre {
  /** Flou d'arrière-plan en pixels (0 < n ≤ 16). */
  flouPx: number;
  /** Couleur du voile (charte) : ivoire sur ivoire, noir sur noir. */
  voileHex: string;
  /** Opacité du voile, de 0 à 1. */
  opacite: number;
  /** Éteint tant que le surcoût de rendu n'est pas mesuré. */
  attendMesure: true;
}

export const DESCRIPTION_VERRE: Record<FondAxion, DescriptionVerre> = {
  ivoire: { flouPx: 12, voileHex: CHARTE_AXION.ivoire, opacite: 0.82, attendMesure: true },
  noir: { flouPx: 12, voileHex: CHARTE_AXION.noir, opacite: 0.82, attendMesure: true },
};

const borne = (n: number): number => Math.min(FLOU_MAX_PX, Math.max(0, Math.round(n)));

/** Style du verre pour un fond donné ; le flou demandé est ramené à 16 px au plus. */
export function styleVerre(fond: FondAxion, flouPx?: number): CSSProperties {
  const d = DESCRIPTION_VERRE[fond];
  const flou = `blur(${borne(flouPx ?? d.flouPx)}px)`;
  return {
    backdropFilter: flou,
    WebkitBackdropFilter: flou,
    backgroundColor: avecOpacite(d.voileHex, d.opacite),
  };
}

export interface ProprietesCarteVerre {
  fond: FondAxion;
  flouPx?: number;
  style?: CSSProperties;
  children?: ReactNode;
}

export function CarteVerre({ fond, flouPx, style, children }: ProprietesCarteVerre): ReactElement {
  return (
    <div data-verre={fond} style={{ ...styleVerre(fond, flouPx), ...style }}>
      {children}
    </div>
  );
}
