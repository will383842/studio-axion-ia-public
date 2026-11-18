/**
 * CALQUE DES SOUS-TITRES (lot M2) : traduit la scène du moteur unique (`src/briques/sous-titres/scene.ts`) en
 * éléments, image par image. Fond transparent : il se pose sur la piste `master-sans-texte` au lot M4 (calques 7-8),
 * et sert au recalque gratuit après une correction.
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { bandeauAuTemps, cssBandeauNom } from "../../../src/briques/sous-titres/bandeau-nom";
import { pastilleEnManrope } from "../../../src/briques/sous-titres/pastille";
import { cssBandeFond, cssElement, cssEtiquetteOutil, escalierAuTemps, etiquetteAuTemps, opaciteBandeFond, paveAuTemps, sceneAuTemps, type DonneesCalque } from "../../../src/briques/sous-titres/scene";
import { geometrieEscalier } from "../../../src/briques/sous-titres/escalier";
import { geometrieMarque } from "../../../src/briques/sous-titres/marques-mot";
import { geometriePave } from "../../../src/briques/sous-titres/pave";
import { chargerPoliceTitre, FAMILLE_TITRE } from "../commune/polices";
import { LigneEscalier } from "./LigneEscalier";
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
  // C2-U14 : la Pastille passe en Manrope Bold quand elle est allumée ; éteinte, rien ne change.
  const pastilleManrope = !!donnees.pastille && pastilleEnManrope(donnees.pastille);
  if (donnees.pastille && pastilleManrope) chargerPolices(["Manrope Bold"]);
  if (donnees.encre || (donnees.pastille && !pastilleManrope)) chargerPoliceTitre();
  // C2-U10 : bandeau « nom et fonction » (ajout pur) ; champ absent : rien de plus.
  if (donnees.bandeauNom) chargerPolices(["Manrope ExtraBold", "Manrope SemiBold"]);
  // C2-U9 : étiquette d'outil autonome (ajout pur) ; champ absent : rien de plus.
  if (donnees.etiquettesOutils?.length) chargerPolices(["Manrope ExtraBold"]);
  const image = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = instantSec ?? image / fps + decalageSec;
  const el = sceneAuTemps(donnees, t);
  // Tableau animé (ajout pur) : bande sombre de fond derrière les sous-titres ; 17/11 : seulement quand un sous-titre est écrit (fondu, pont des petits blancs) ; absente, rien ne change.
  const ob = donnees.bandeFond ? opaciteBandeFond(donnees, t) : 0;
  const bande = donnees.bandeFond && ob > 0 ? <div style={{ ...cssBandeFond(donnees.bandeFond), opacity: ob }} /> : null;
  const etatBandeau = donnees.bandeauNom ? bandeauAuTemps(donnees.bandeauNom, t) : null;
  const cssBandeau = donnees.bandeauNom && etatBandeau?.visible ? cssBandeauNom(donnees.bandeauNom, etatBandeau, { nom: FAMILLES["Manrope ExtraBold"], fonction: FAMILLES["Manrope SemiBold"] }) : null;
  const bandeauNom = cssBandeau && donnees.bandeauNom ? (
    <div style={cssBandeau.conteneur}>
      <div style={cssBandeau.nom}>{donnees.bandeauNom.nom}</div>
      <div style={cssBandeau.fonction}>{donnees.bandeauNom.fonction}</div>
      <div style={cssBandeau.filet} />
    </div>
  ) : null;
  const etiquette = donnees.etiquettesOutils ? etiquetteAuTemps(donnees, t) : null;
  const cssEtiquette = etiquette ? cssEtiquetteOutil(etiquette, donnees, `"${FAMILLES["Manrope ExtraBold"]}"`) : null;
  const etiquetteOutil = cssEtiquette ? (
    <div style={cssEtiquette.conteneur}>
      <div style={cssEtiquette.texte}>{etiquette?.texte}</div>
    </div>
  ) : null;
  if (!el) return <AbsoluteFill>{bande}{bandeauNom}{etiquetteOutil}</AbsoluteFill>;
  // BR-ESCALIER : champ présent, lignes et place suffisantes : l'escalier remplace le bloc ci-dessous ; sinon rendu d'avant.
  const esc = donnees.escalier ? escalierAuTemps(donnees, t) : null;
  const geo = donnees.escalier && esc ? geometrieEscalier(esc.lignes, donnees.largeur, donnees.hauteur, donnees.escalier.zone, donnees.escalier.taillePx) : null;
  if (geo && esc) return <AbsoluteFill>{bande}{bandeauNom}{etiquetteOutil}<LigneEscalier geometrie={geo} couleur={donnees.couleurs.texte} fond={donnees.couleurs.contour} ligneActive={esc.ligneActive} /></AbsoluteFill>;
  // BR-PAVE-MARQUES : `paveAnime` exact : la plaque du mot fort est dessinée ici, animée sur l'INSTANT reçu (jamais l'image : ce calque est rendu par instants), et sa marque ; la plaque fixe n'est plus dessinée pour ce mot.
  const pave = donnees.paveAnime === true ? paveAuTemps(donnees, t) : null;
  const gp = pave ? geometriePave(pave.boite, pave.taillePx, t - pave.debutS) : null;
  const gm = pave && gp && pave.marque ? geometrieMarque(pave.marque, gp, pave.taillePx, pave.graine) : null;
  const contour = gm?.contourSeul === true;
  const css = cssElement(el, donnees, `"${donnees.encre || (donnees.pastille && !pastilleManrope) ? FAMILLE_TITRE : FAMILLES[el.police]}"`);
  return (
    <AbsoluteFill>
      {bande}
      {bandeauNom}
      {etiquetteOutil}
      {gp && pave && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: pave.opaciteGroupe, transform: `translateY(${pave.decalageYPx}px)` }}>
          {gm?.chemin ? (
            <svg data-marque-mot={pave.marque} width="100%" height="100%" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: gp.opacite }}>
              <path d={gm.chemin} fill={donnees.couleurs.accent} style={{ transform: `rotate(${gp.inclinaisonDeg}deg) scale(${gp.echelle})`, transformOrigin: `${gp.x + gp.largeur / 2}px ${gp.y + gp.hauteur / 2}px` }} />
            </svg>
          ) : (
            <div
              data-pave-anime=""
              data-marque-mot={gm ? pave.marque : undefined}
              style={{
                position: "absolute", left: gp.x, top: gp.y + (gm?.decalageYPx ?? 0), width: gp.largeur, height: gp.hauteur, borderRadius: gp.rayon,
                background: contour ? "transparent" : donnees.couleurs.accent, opacity: gp.opacite,
                ...(contour ? { border: `${Math.max(2, pave.taillePx * 0.05)}px solid ${donnees.couleurs.accent}`, boxSizing: "border-box" as const } : {}),
                transform: `rotate(${gp.inclinaisonDeg}deg) scale(${gp.echelle})`,
              }}
            />
          )}
        </div>
      )}
      <div style={css.conteneur}>
        <div style={css.ligne}>
          {el.mots.map((m, i) => (
            <span key={i} style={pave && i === pave.indice ? { ...css.mot(i), background: "transparent", ...(!gp || contour ? { color: donnees.couleurs.texte } : {}) } : css.mot(i)}>
              {m.texte}
              {m.souligne > 0 && <span style={css.trait(i)} />}
            </span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}
