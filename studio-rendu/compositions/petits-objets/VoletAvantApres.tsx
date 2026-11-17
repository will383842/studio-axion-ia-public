/**
 * « VoletAvantApres » (C10-08) : habillage Remotion du volet. Pose les deux vraies captures (adresses déjà signées par le Studio : le rendu ne signe
 * ni ne télécharge rien), découpées selon `geometrieVolet` (`clipPath: inset`, jamais de masque), puis le dessin pur de la pièce par-dessus.
 * Rien n'importe ce fichier. Imports relatifs seulement.
 */
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from "remotion";
import type { FondAxion } from "../../../src/briques/jetons-motion";
import type { TonObjet } from "../../../src/briques/motion/petits-objets/contrat";
import { geometrieVolet, OBJET_VOLET_AVANT_APRES, type ParametresVoletAvantApres } from "../../../src/briques/motion/petits-objets/volet-avant-apres";
import { phaseObjet } from "../../../src/briques/motion/petits-objets/progres";

export function VoletAvantApres({ parametres, fond, ton, graine, dureeImages }: { parametres: ParametresVoletAvantApres; fond: FondAxion; ton?: TonObjet; graine: number; dureeImages: number }) {
  const image = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sens = parametres.sens ?? "gauche-droite";
  const { coupure } = geometrieVolet(image, dureeImages, sens);
  const pct = coupure * 100;
  // « avant » occupe le côté du bord de départ ; « après » l'autre côté.
  const clipAvant = sens === "gauche-droite" ? `inset(0 ${100 - pct}% 0 0)` : `inset(0 0 0 ${pct}%)`;
  const clipApres = sens === "gauche-droite" ? `inset(0 0 0 ${pct}%)` : `inset(0 ${100 - pct}% 0 0)`;
  const style = (clip: string) => ({ position: "absolute" as const, inset: 0, width: "100%", height: "100%", objectFit: "cover" as const, clipPath: clip });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ opacity: phaseObjet(image, dureeImages).opacite, borderRadius: "2.8%", overflow: "hidden" }}>
        <Img src={parametres.avant} style={style(clipAvant)} />
        <Img src={parametres.apres} style={style(clipApres)} />
      </AbsoluteFill>
      {OBJET_VOLET_AVANT_APRES.Rendu({ image, fps, dureeImages, fond, ton, graine, parametres })}
    </AbsoluteFill>
  );
}
