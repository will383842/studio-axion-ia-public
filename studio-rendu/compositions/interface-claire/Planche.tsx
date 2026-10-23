/**
 * PLANCHE DE STYLE « interface claire » (lot 1) : la prise de Will + bande qui pousse l'image + carte frise +
 * étiquettes + tuile logo + fenêtre d'illustration + zooms coupés + sous-titres mot à mot + bruitages.
 */
import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { chargerPoliceMontserrat, chargerPoliceTitre } from "../commune/polices";
import { Carte, Frise } from "./Carte";
import { COULEURS, GEOMETRIE, TEMPS } from "./charte";
import { BarreProgression, Etiquette, EtiquetteGlisse, TuileLogo } from "./elements";
import { Fenetre } from "./Fenetre";
import { Fin, pousseeFin } from "./Fin";
import { dans, rebond, sortie } from "./mouvement";
import { BRUITAGES, GROUPES, PLANCHE, SCENE } from "./donnees-planche";
import { SousTitres } from "./SousTitres";

export function PlancheInterfaceClaire() {
  chargerPoliceMontserrat();
  chargerPoliceTitre();
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const t = frame / fps;

  // Bande + poussée de l'image pendant la carte (entrée avec rebond, sortie puis retour de l'image).
  const { debut: cd, fin: cf } = SCENE.carte;
  const pousse = rebond(t, cd, TEMPS.entreeCarte, 1.2) * (1 - sortie(t, cf, TEMPS.retourImage));
  const zoom = SCENE.zooms.find(([a, b]) => dans(t, a, b))?.[2] ?? 1;

  const yST = dans(t, cd, cf + 0.05) ? GEOMETRIE.sousTitresCarte + 0.045 : SCENE.fenetres.some((f) => dans(t, f.debut, f.fin)) ? GEOMETRIE.sousTitresFenetre : GEOMETRIE.sousTitresHors;
  // Écran de fin : toute l'image monte, poussée par le panneau ivoire.
  const monteFin = pousseeFin(t, SCENE.fin.debut);
  const hCarte = GEOMETRIE.enteteH * H + 4 * H * 0.056 + H * 0.045;

  return (
    <AbsoluteFill style={{ background: COULEURS.encre }}>
     <AbsoluteFill style={{ transform: `translateY(${-monteFin * H}px)` }}>
      {/* Prise de Will : poussée vers le bas pendant les cartes, zooms coupés ailleurs. */}
      <AbsoluteFill style={{ transform: `translateY(${pousse * GEOMETRIE.pousseeH * H}px) scale(${zoom})`, transformOrigin: "50% 32%" }}>
        <Sequence durationInFrames={Math.round(PLANCHE.finPrise * fps)} layout="none">
          <OffthreadVideo src={staticFile("prise.mp4")} startFrom={Math.round(PLANCHE.debutSource * fps)} style={{ width: W, height: H, objectFit: "cover" }} />
        </Sequence>
      </AbsoluteFill>
      {/* Bande ivoire qui descend avec la poussée. */}
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: GEOMETRIE.bandeH * H, background: COULEURS.ivoire, transform: `translateY(${-(1 - pousse) * GEOMETRIE.bandeH * H}px)` }} />

      <TuileLogo t={t} debut={SCENE.tuile.debut} fin={SCENE.tuile.fin} x={W * 0.06} y={H * 0.05} largeurImage={W} icone="etincelles" legende="AXION-IA" />
      <EtiquetteGlisse t={t} debut={SCENE.role.debut} fin={SCENE.role.fin} y={H * 0.07} largeurImage={W} texte="Ce qu'on fait" icone="etincelles" />

      <Carte t={t} debut={cd} fin={cf} largeurImage={W} hauteurImage={H} titre="Axion-IA · nos métiers" numero={`${Math.max(1, SCENE.etapes.filter((e) => t >= e.a).length)}/4`} iconeTitre="etincelles" hauteur={hCarte}
        enfants={<Frise t={t} etapes={SCENE.etapes} largeurImage={W} hauteurLigne={H * 0.056} badge={SCENE.badge} puces={SCENE.puces} cocheA={SCENE.cocheA} />} />

      <Etiquette t={t} debut={SCENE.tailles.debut} fin={SCENE.tailles.fin} x={W / 2} y={H * 0.105} largeurImage={W} texte="Toutes les tailles" taille={W * 0.05} icones={SCENE.tailles.icones} />
      {SCENE.fenetres.map((f) => (
        <Fenetre key={f.debut} t={t} debut={f.debut} fin={f.fin} src={staticFile(`images/${f.image}.jpg`)} largeurImage={W} hauteurImage={H} etiquette={"etiquette" in f ? f.etiquette : undefined} noirEtBlancA={"noirEtBlancA" in f ? f.noirEtBlancA : undefined} />
      ))}
      <Etiquette t={t} debut={SCENE.reflexe.debut} fin={SCENE.reflexe.fin} x={W / 2} y={H * 0.1} largeurImage={W} texte="Le même réflexe" fond="orange" taille={W * 0.055} rotation={-4} />
      <Etiquette t={t} debut={SCENE.colmater.debut} fin={SCENE.colmater.fin} x={W * 0.3} y={H * 0.06} largeurImage={W} texte="Colmater" taille={W * 0.06} rotation={3} barreA={SCENE.colmater.barreA} />

      <SousTitres t={t} groupes={GROUPES} y={yST * H} largeurImage={W} />
      <BarreProgression t={t} duree={PLANCHE.duree} largeur={W} />
     </AbsoluteFill>
      <Fin t={t} debut={SCENE.fin.debut} largeurImage={W} hauteurImage={H} marque={SCENE.fin.marque} adresse={SCENE.fin.adresse} motCle={SCENE.fin.motCle} tuiles={SCENE.fin.tuiles} />

      {BRUITAGES.map(([a, son, v], i) => (
        <Sequence key={i} from={Math.round(a * fps)} durationInFrames={Math.round(0.8 * fps)} layout="none">
          <Audio src={staticFile(`sons/${son}.wav`)} volume={v} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
