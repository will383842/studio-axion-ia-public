/**
 * Planche des lumières (C6-H7b, AM-06) : `FuiteLumiere`, `RefletBalayage`, `lueurTexte` et `halo`, chacun 2 s (50 images
 * à 25 i/s), montrés deux fois : moitié haute sur noir, moitié basse sur ivoire. Lancée à la main ; aucun générateur ne
 * demande cette composition.
 */
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { CHARTE_AXION, FAMILLE_CSS_AXION, adoucir, avecOpacite, couleursSur, type FondAxion } from "../../../../src/briques/jetons-motion";
import { FuiteLumiere, RefletBalayage, halo, lueurTexte } from "../../../../src/briques/motion/habillage-commun/lumiere";
import { chargerManrope } from "../../plan-scenes/PlanDeScenes";

export const IMAGES_PAR_TABLEAU = 50;
export const TABLEAUX_LUMIERES = ["FuiteLumiere", "RefletBalayage", "lueurTexte", "halo"] as const;
export const IMAGES_PLANCHE_LUMIERES = TABLEAUX_LUMIERES.length * IMAGES_PAR_TABLEAU;

export type ProprietesPlancheLumieres = { largeur: number; hauteur: number; fps: number };

const BOITE = { largeur: 640, hauteur: 360 };

function Moitie({ fond, local, indice, largeur, hauteur, fps }: { fond: FondAxion; local: number; indice: number; largeur: number; hauteur: number; fps: number }) {
  const c = couleursSur(fond);
  const effet = TABLEAUX_LUMIERES[indice];
  const force = adoucir(Math.min(1, local / 25));
  let contenu;
  if (effet === "FuiteLumiere") {
    contenu = <FuiteLumiere image={local} largeur={largeur} hauteur={hauteur} fps={fps} dureeImages={IMAGES_PAR_TABLEAU} fond={fond} cote="gauche" />;
  } else if (effet === "RefletBalayage") {
    contenu = (
      <div style={{ position: "relative", ...BOITE, borderRadius: 24, backgroundColor: c.filet, overflow: "hidden" }}>
        <RefletBalayage image={local} dureeImages={IMAGES_PAR_TABLEAU} boite={BOITE} fond={fond} />
      </div>
    );
  } else if (effet === "lueurTexte") {
    contenu = (
      <div style={{ fontFamily: FAMILLE_CSS_AXION, fontSize: 72, fontWeight: 700, color: c.accent, textShadow: lueurTexte(c.accent, force) }}>Texte lumineux</div>
    );
  } else {
    contenu = <div style={{ ...BOITE, borderRadius: 24, backgroundColor: c.fond, border: `2px solid ${c.filet}`, ...halo(BOITE, c.accent, force) }} />;
  }
  return (
    <div style={{ position: "relative", width: largeur, height: hauteur, overflow: "hidden", backgroundColor: c.fond, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {contenu}
    </div>
  );
}

export function PlancheLumieres({ largeur, hauteur, fps }: ProprietesPlancheLumieres) {
  chargerManrope();
  const image = useCurrentFrame();
  const indice = Math.min(TABLEAUX_LUMIERES.length - 1, Math.floor(image / IMAGES_PAR_TABLEAU));
  const local = image - indice * IMAGES_PAR_TABLEAU;
  const moitie = Math.floor(hauteur / 2);
  const lisible = adoucir(Math.min(1, local / 6));
  return (
    <AbsoluteFill style={{ backgroundColor: CHARTE_AXION.noir }}>
      <Moitie fond="noir" local={local} indice={indice} largeur={largeur} hauteur={moitie} fps={fps} />
      <Moitie fond="ivoire" local={local} indice={indice} largeur={largeur} hauteur={hauteur - moitie} fps={fps} />
      <div
        style={{
          position: "absolute", left: 0, right: 0, top: 80, textAlign: "center", fontFamily: FAMILLE_CSS_AXION, color: CHARTE_AXION.ivoire,
          opacity: lisible, textShadow: `0 2px 12px ${avecOpacite(CHARTE_AXION.noir, 0.8)}`,
        }}
      >
        <div style={{ fontSize: 44, fontWeight: 700 }}>{TABLEAUX_LUMIERES[indice]}</div>
        <div style={{ fontSize: 28, fontWeight: 500 }}>noir en haut · ivoire en bas</div>
      </div>
    </AbsoluteFill>
  );
}
