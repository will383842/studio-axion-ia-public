import React from "react";
/**
 * N-17 · REPLI DE RENDU DU LOT 6 (NEUF, SANS EFFET DE BORD, ÉTEINT) : table type → rendu du lot 6, lue par `rendreElementV4`
 * seulement quand le type n'est PAS l'une des 26 plaquettes. Aucun `registerRoot` ; n'importe jamais `PlancheLot6` ni `entree-lot6`.
 * Le geste de vie est celui du registre (`GesteVisible`, passé en argument). Importe seulement `REPLIS_V4` du registre, pour s'y inscrire (le registre n'importe jamais le lot 6 : aucun cycle).
 * Éteint : aucun type du lot 6 n'est au catalogue du réalisateur (`CATALOGUE_V4`), donc aucun plan réel ne le demande.
 */
import { AbsoluteFill, Sequence } from "remotion";
import type { ElementV4Plan } from "../../../../../src/domaine/facecam-animee/plan";
import { mediaV4 } from "../communs/medias-v4";
import { TelephoneVideo } from "./TelephoneVideo";
import { REPLIS_V4 } from "../registre-v4";

/** Images par seconde : égal à `FPS_V4` du registre (test d'égalité). */
export const FPS_LOT6 = 30;
/** Type du téléphone qui joue un extrait dans un plan v4 (nom réservé ; le catalogue l'ajoutera à l'allumage, C4-U4.9a). */
export const ID_TELEPHONE_VIDEO = "telephone-video";
/** Geste de vie du téléphone : celui des fenêtres (12 px, 1,2°, 3 %, centre 50 % 50 %). */
export const SLOT_TELEPHONE_VIDEO = "fenetre";
/** Largeur du téléphone (px, image 1080 × 1920) : réglée sur planche le 21/11 (choix B) : bas 1151 px avec l'ombre, au-dessus des sous-titres. */
export const LARGEUR_TELEPHONE_VIDEO = 420;
/** Haut du téléphone (px depuis le haut de l'image) : choix B, il finit au-dessus de la zone des sous-titres. */
export const HAUT_TELEPHONE_VIDEO = 300;

type Geste = React.ComponentType<{ slot: string; duree: number; children: React.ReactNode }>;
type RenduLot6 = (e: ElementV4Plan, duree: number) => React.ReactNode;

/** Adresse de la 1re vidéo de l'élément (`broll/<nom>`), ou `undefined` : le téléphone reste alors un cadre vide, SANS erreur. */
export function srcTelephone(e: ElementV4Plan): string | undefined {
  const cle = e.medias?.[0];
  return typeof cle === "string" && cle.trim() ? mediaV4(`broll/${cle.replace(/^broll\//, "")}`) : undefined;
}

export const RENDUS_LOT6: Readonly<Record<string, RenduLot6>> = Object.freeze({
  [ID_TELEPHONE_VIDEO]: (e: ElementV4Plan) => (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: HAUT_TELEPHONE_VIDEO }}>
      <TelephoneVideo src={srcTelephone(e)} debutImage={Math.round((e.depuisSec ?? 0) * FPS_LOT6)} largeur={LARGEUR_TELEPHONE_VIDEO} son={false} />
    </AbsoluteFill>
  ),
});

/** Vrai seulement pour une clé PROPRE de la table (jamais `toString` & co). */
export const estTypeLot6 = (id: string): boolean => Object.prototype.hasOwnProperty.call(RENDUS_LOT6, id);

/** Pose une plaquette du lot 6 sur la ligne de temps, exactement comme `rendreElementV4` pose les 26 (mêmes `from`, durée, clé). */
export function poserLot6(e: ElementV4Plan, Geste: Geste): React.ReactNode {
  const rendu = estTypeLot6(e.id) ? RENDUS_LOT6[e.id] : undefined;
  if (!rendu) return null;
  const D = Math.max(1, Math.round((e.fin - e.debut) * FPS_LOT6));
  return (
    <Sequence key={`${e.id}-${e.debut}`} from={Math.round(e.debut * FPS_LOT6)} durationInFrames={D}>
      <Geste slot={SLOT_TELEPHONE_VIDEO} duree={D}>{rendu(e, D)}</Geste>
    </Sequence>
  );
}

/** Inscription du repli dans le registre (seul effet à l'import : une entrée de table ; jamais `registerRoot`). */
REPLIS_V4.set(ID_TELEPHONE_VIDEO, poserLot6);
