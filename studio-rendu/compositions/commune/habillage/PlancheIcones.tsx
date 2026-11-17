/**
 * Planche des icônes (C6-H7c, AM-21) : une famille de `ICONES_BIBLIOTHEQUE` par tableau (2 s, 50 images à 25 i/s), chaque
 * icône montrée deux fois : moitié haute sur noir, moitié basse sur ivoire. Lancée à la main ; aucun générateur ne demande
 * cette composition.
 */
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { CHARTE_AXION, FAMILLE_CSS_AXION, adoucir, avecOpacite, couleursSur, type FondAxion } from "../../../../src/briques/jetons-motion";
import { ICONES_BIBLIOTHEQUE, type NomIconeBibliotheque } from "../../../../src/briques/motion/bibliotheque-icones";
import { IconeAnimee } from "../../../../src/briques/motion/bibliotheque-icones/IconeAnimee";
import { chargerManrope } from "../../plan-scenes/PlanDeScenes";

export const IMAGES_PAR_TABLEAU = 50;
/** Les familles (jeux) présentes dans la bibliothèque, dans l'ordre d'apparition. */
export const FAMILLES_ICONES: readonly string[] = Array.from(new Set(Object.values(ICONES_BIBLIOTHEQUE).map((i) => i.jeu)));
export const IMAGES_PLANCHE_ICONES = FAMILLES_ICONES.length * IMAGES_PAR_TABLEAU;

export type ProprietesPlancheIcones = { largeur: number; hauteur: number; fps: number };

const COLONNES = 9;
const CASE = 110;

function Moitie({ fond, famille, largeur, hauteur, fps }: { fond: FondAxion; famille: string; largeur: number; hauteur: number; fps: number }) {
  const c = couleursSur(fond);
  const noms = Object.keys(ICONES_BIBLIOTHEQUE).filter((n) => ICONES_BIBLIOTHEQUE[n].jeu === famille);
  return (
    <div style={{ position: "relative", width: largeur, height: hauteur, overflow: "hidden", backgroundColor: c.fond, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLONNES}, ${CASE}px)`, gridAutoRows: `${CASE}px`, alignItems: "center", justifyItems: "center", marginTop: 120 }}>
        {noms.map((nom) => (
          <IconeAnimee key={nom} nom={nom as NomIconeBibliotheque} image={IMAGES_PAR_TABLEAU} fps={fps} animation="duotone-remplissage" ton="neutre" fond={fond} taille={64} />
        ))}
      </div>
    </div>
  );
}

export function PlancheIcones({ largeur, hauteur, fps }: ProprietesPlancheIcones) {
  chargerManrope();
  const image = useCurrentFrame();
  const indice = Math.min(FAMILLES_ICONES.length - 1, Math.floor(image / IMAGES_PAR_TABLEAU));
  const local = image - indice * IMAGES_PAR_TABLEAU;
  const moitie = Math.floor(hauteur / 2);
  const lisible = adoucir(Math.min(1, local / 6));
  const famille = FAMILLES_ICONES[indice];
  return (
    <AbsoluteFill style={{ backgroundColor: CHARTE_AXION.noir }}>
      <Moitie fond="noir" famille={famille} largeur={largeur} hauteur={moitie} fps={fps} />
      <Moitie fond="ivoire" famille={famille} largeur={largeur} hauteur={hauteur - moitie} fps={fps} />
      <div
        style={{
          position: "absolute", left: 0, right: 0, top: 80, textAlign: "center", fontFamily: FAMILLE_CSS_AXION, color: CHARTE_AXION.ivoire,
          opacity: lisible, textShadow: `0 2px 12px ${avecOpacite(CHARTE_AXION.noir, 0.8)}`,
        }}
      >
        <div style={{ fontSize: 44, fontWeight: 700 }}>{famille}</div>
        <div style={{ fontSize: 28, fontWeight: 500 }}>noir en haut · ivoire en bas</div>
      </div>
    </AbsoluteFill>
  );
}
