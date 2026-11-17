/**
 * PLANCHE D'ATTENTE (C11-T8b-p) : les 9 effets de texte déjà relus, à trois instants, sur un fond. Pur (aucun hook, aucune
 * horloge, aucun hasard). Imports relatifs seulement. Rien n'est inscrit, rien n'est allumé : aucun générateur n'importe ce fichier.
 * La planche complète (mème, légende native) reste à C11-T8b-b.
 */
import type { JSX } from "react";
import { couleursSur, FAMILLE_CSS_AXION, type FondAxion } from "../../src/briques/jetons-motion";
import { EFFETS_TEXTE, type EffetTexte } from "../../src/briques/motion/texte-effets/effets";
import { TexteEffets } from "../../studio-rendu/compositions/commune/texte-effets/TexteEffets";

export const FPS_EFFETS = 30;
/** Image 0, milieu de l'effet (effets de 0,3 à 1 s), image tardive (2 s). */
export const INSTANTS_PLANCHE: readonly number[] = [0, 9, 60];
export const LIGNES_PLANCHE: readonly EffetTexte[] = EFFETS_TEXTE;
export const LARGEUR_PLANCHE = 1080;
export const HAUTEUR_PLANCHE = 1920;

export function PlancheEffetsTexte({ fond }: { fond: FondAxion }): JSX.Element {
  const pal = couleursSur(fond);
  const hauteurLigne = (HAUTEUR_PLANCHE - 120) / LIGNES_PLANCHE.length;
  return (
    <div
      data-planche={`effets-texte-${fond}`}
      style={{ position: "relative", width: LARGEUR_PLANCHE, height: HAUTEUR_PLANCHE, background: pal.fond, overflow: "hidden", fontFamily: FAMILLE_CSS_AXION }}
    >
      {LIGNES_PLANCHE.map((effet) => (
        <div key={effet} style={{ boxSizing: "border-box", height: hauteurLigne, padding: "6px 24px", borderBottom: `1px solid ${pal.filet}` }}>
          <div style={{ fontSize: 22, color: pal.texteDoux }}>{effet}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: hauteurLigne - 40 }}>
            {INSTANTS_PLANCHE.map((image, k) => (
              <div key={k} data-case={`${effet}#${k}`} style={{ width: LARGEUR_PLANCHE / 3 - 24, textAlign: "center" }}>
                <TexteEffets texte="Bonjour" effet={effet} image={image} ips={FPS_EFFETS} motNouveau={effet === "retrogradation" ? "Salut" : undefined} taillePx={56} couleur={pal.texte} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ position: "absolute", left: 24, bottom: 24, fontSize: 24, color: pal.texteDoux }}>
        {"9 effets relus ; mème et légende native : C11-T8b-b"}
      </div>
    </div>
  );
}
