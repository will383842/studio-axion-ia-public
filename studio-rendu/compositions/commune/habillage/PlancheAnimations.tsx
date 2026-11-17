/**
 * Planche des animations d'icônes (C6-H7c, AM-21) : chacun des gestes de `IconeAnimee` (2 s, 50 images à 25 i/s, geste
 * rejoué une fois à la moitié), appliqué à une icône de chaque famille, montré deux fois : moitié haute sur noir, moitié
 * basse sur ivoire. Lancée à la main ; aucun générateur ne demande cette composition. Rien d'importé en plus (AM-22).
 */
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { CHARTE_AXION, FAMILLE_CSS_AXION, adoucir, avecOpacite, couleursSur, type FondAxion } from "../../../../src/briques/jetons-motion";
import { ICONES_BIBLIOTHEQUE, type NomIconeBibliotheque } from "../../../../src/briques/motion/bibliotheque-icones";
import { IconeAnimee, type AnimationIcone } from "../../../../src/briques/motion/bibliotheque-icones/IconeAnimee";
import { chargerManrope } from "../../plan-scenes/PlanDeScenes";

export const IMAGES_PAR_TABLEAU = 50;
const REPRISE = IMAGES_PAR_TABLEAU / 2;
export const ANIMATIONS_ICONES: readonly AnimationIcone[] = ["trace", "rebond", "rotation", "halo", "cascade", "masque", "jauge", "pulsation", "duotone-remplissage"];
export const IMAGES_PLANCHE_ANIMATIONS = ANIMATIONS_ICONES.length * IMAGES_PAR_TABLEAU;

export type ProprietesPlancheAnimations = { largeur: number; hauteur: number; fps: number };

/** Première icône de chaque famille. */
const ECHANTILLON: readonly string[] = (() => {
  const vus = new Set<string>();
  const noms: string[] = [];
  for (const [nom, icone] of Object.entries(ICONES_BIBLIOTHEQUE)) {
    if (vus.has(icone.jeu)) continue;
    vus.add(icone.jeu);
    noms.push(nom);
  }
  return noms;
})();

function Moitie({ fond, animation, local, largeur, hauteur, fps }: { fond: FondAxion; animation: AnimationIcone; local: number; largeur: number; hauteur: number; fps: number }) {
  const c = couleursSur(fond);
  return (
    <div style={{ position: "relative", width: largeur, height: hauteur, overflow: "hidden", backgroundColor: c.fond, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 240px)", gridAutoRows: "240px", alignItems: "center", justifyItems: "center", marginTop: 120 }}>
        {ECHANTILLON.map((nom) => (
          <IconeAnimee key={nom} nom={nom as NomIconeBibliotheque} image={local % REPRISE} fps={fps} animation={animation} ton="accent" fond={fond} taille={140} />
        ))}
      </div>
    </div>
  );
}

export function PlancheAnimations({ largeur, hauteur, fps }: ProprietesPlancheAnimations) {
  chargerManrope();
  const image = useCurrentFrame();
  const indice = Math.min(ANIMATIONS_ICONES.length - 1, Math.floor(image / IMAGES_PAR_TABLEAU));
  const local = image - indice * IMAGES_PAR_TABLEAU;
  const moitie = Math.floor(hauteur / 2);
  const lisible = adoucir(Math.min(1, local / 6));
  const animation = ANIMATIONS_ICONES[indice];
  return (
    <AbsoluteFill style={{ backgroundColor: CHARTE_AXION.noir }}>
      <Moitie fond="noir" animation={animation} local={local} largeur={largeur} hauteur={moitie} fps={fps} />
      <Moitie fond="ivoire" animation={animation} local={local} largeur={largeur} hauteur={hauteur - moitie} fps={fps} />
      <div
        style={{
          position: "absolute", left: 0, right: 0, top: 80, textAlign: "center", fontFamily: FAMILLE_CSS_AXION, color: CHARTE_AXION.ivoire,
          opacity: lisible, textShadow: `0 2px 12px ${avecOpacite(CHARTE_AXION.noir, 0.8)}`,
        }}
      >
        <div style={{ fontSize: 44, fontWeight: 700 }}>{animation}</div>
        <div style={{ fontSize: 28, fontWeight: 500 }}>noir en haut · ivoire en bas</div>
      </div>
    </AbsoluteFill>
  );
}
