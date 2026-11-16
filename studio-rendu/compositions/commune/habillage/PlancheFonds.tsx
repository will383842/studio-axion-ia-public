/**
 * Planche des fonds vivants (C6-H7b, AM-06) : chaque entrée de `IDS_FONDS_VIVANTS`, 2 s (50 images à 25 i/s), montrée deux fois :
 * moitié haute sur noir, moitié basse sur ivoire, avec une ligne de sous-titres témoin posée dessus (bande basse, là où
 * tombent les vrais sous-titres). Lancée à la main ; aucun générateur ne demande cette composition.
 */
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { CHARTE_AXION, FAMILLE_CSS_AXION, adoucir, avecOpacite, couleursSur, type FondAxion } from "../../../../src/briques/jetons-motion";
import { FondVivant, IDS_FONDS_VIVANTS, graineParDefaut } from "../../../../src/briques/motion/habillage-commun/fonds";
import { chargerManrope } from "../../plan-scenes/PlanDeScenes";

export const IMAGES_PAR_TABLEAU = 50;
export const IMAGES_PLANCHE_FONDS = IDS_FONDS_VIVANTS.length * IMAGES_PAR_TABLEAU;

export type ProprietesPlancheFonds = { largeur: number; hauteur: number; fps: number };

function Moitie({ fond, image, indice, largeur, hauteur, fps }: { fond: FondAxion; image: number; indice: number; largeur: number; hauteur: number; fps: number }) {
  const c = couleursSur(fond);
  return (
    <div style={{ position: "relative", width: largeur, height: hauteur, overflow: "hidden", backgroundColor: c.fond }}>
      <FondVivant id={IDS_FONDS_VIVANTS[indice]} image={image} fps={fps} largeur={largeur} hauteur={hauteur} fond={fond} graine={graineParDefaut(indice)} />
      <div
        style={{
          position: "absolute", left: 60, right: 60, bottom: 90, textAlign: "center", fontFamily: FAMILLE_CSS_AXION,
          fontSize: 44, fontWeight: 700, color: c.texte, lineHeight: 1.25,
        }}
      >
        Sous-titres témoin posés sur le fond
      </div>
    </div>
  );
}

export function PlancheFonds({ largeur, hauteur, fps }: ProprietesPlancheFonds) {
  chargerManrope();
  const image = useCurrentFrame();
  const indice = Math.min(IDS_FONDS_VIVANTS.length - 1, Math.floor(image / IMAGES_PAR_TABLEAU));
  const local = image - indice * IMAGES_PAR_TABLEAU;
  const moitie = Math.floor(hauteur / 2);
  const lisible = adoucir(Math.min(1, local / 6));
  return (
    <AbsoluteFill style={{ backgroundColor: CHARTE_AXION.noir }}>
      <Moitie fond="noir" image={local} indice={indice} largeur={largeur} hauteur={moitie} fps={fps} />
      <Moitie fond="ivoire" image={local} indice={indice} largeur={largeur} hauteur={hauteur - moitie} fps={fps} />
      <div
        style={{
          position: "absolute", left: 0, right: 0, top: 80, textAlign: "center", fontFamily: FAMILLE_CSS_AXION, color: CHARTE_AXION.ivoire,
          opacity: lisible, textShadow: `0 2px 12px ${avecOpacite(CHARTE_AXION.noir, 0.8)}`,
        }}
      >
        <div style={{ fontSize: 44, fontWeight: 700 }}>{IDS_FONDS_VIVANTS[indice]}</div>
        <div style={{ fontSize: 28, fontWeight: 500 }}>noir en haut · ivoire en bas</div>
      </div>
    </AbsoluteFill>
  );
}
