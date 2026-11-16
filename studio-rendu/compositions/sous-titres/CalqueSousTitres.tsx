/**
 * CALQUE DES SOUS-TITRES (lot M2) : traduit la scène du moteur unique (`src/briques/sous-titres/scene.ts`) en
 * éléments, image par image. Fond transparent : il se pose sur la piste `master-sans-texte` au lot M4 (calques 7-8),
 * et sert au recalque gratuit après une correction.
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { bandeauAuTemps, cssBandeauNom } from "../../../src/briques/sous-titres/bandeau-nom";
import { cssBandeFond, cssElement, sceneAuTemps, type DonneesCalque } from "../../../src/briques/sous-titres/scene";
import { chargerPoliceTitre, FAMILLE_TITRE } from "../commune/polices";
import { chargerPolices, FAMILLES } from "./polices";

export type ProprietesCalque = {
  donnees: DonneesCalque;
  /** Décalage du calque dans la vidéo (s). */
  decalageSec?: number;
  /** Instant fixe (captures) : remplace le temps de l'image. */
  instantSec?: number;
};

export function CalqueSousTitres({ donnees, decalageSec = 0, instantSec }: ProprietesCalque) {
  chargerPolices();
  // Styles « Encre » (tableau animé) et « Pastille Axion » : police de la charte (Inter Bold). Absents : inchangé.
  if (donnees.encre || donnees.pastille) chargerPoliceTitre();
  // C2-U10 : bandeau « nom et fonction » (ajout pur) ; champ absent : rien de plus.
  if (donnees.bandeauNom) chargerPolices(["Manrope ExtraBold", "Manrope SemiBold"]);
  const image = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = instantSec ?? image / fps + decalageSec;
  const el = sceneAuTemps(donnees, t);
  // Tableau animé (ajout pur) : bande sombre de fond, constante, derrière les sous-titres ; absente, rien ne change.
  const bande = donnees.bandeFond ? <div style={cssBandeFond(donnees.bandeFond)} /> : null;
  const etatBandeau = donnees.bandeauNom ? bandeauAuTemps(donnees.bandeauNom, t) : null;
  const cssBandeau = donnees.bandeauNom && etatBandeau?.visible ? cssBandeauNom(donnees.bandeauNom, etatBandeau, { nom: FAMILLES["Manrope ExtraBold"], fonction: FAMILLES["Manrope SemiBold"] }) : null;
  const bandeauNom = cssBandeau && donnees.bandeauNom ? (
    <div style={cssBandeau.conteneur}>
      <div style={cssBandeau.nom}>{donnees.bandeauNom.nom}</div>
      <div style={cssBandeau.fonction}>{donnees.bandeauNom.fonction}</div>
      <div style={cssBandeau.filet} />
    </div>
  ) : null;
  if (!el) return <AbsoluteFill>{bande}{bandeauNom}</AbsoluteFill>;
  const css = cssElement(el, donnees, `"${donnees.encre || donnees.pastille ? FAMILLE_TITRE : FAMILLES[el.police]}"`);
  return (
    <AbsoluteFill>
      {bande}
      {bandeauNom}
      <div style={css.conteneur}>
        <div style={css.ligne}>
          {el.mots.map((m, i) => (
            <span key={i} style={css.mot(i)}>
              {m.texte}
              {m.souligne > 0 && <span style={css.trait(i)} />}
            </span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}
