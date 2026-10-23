/**
 * PLANCHE DE CONTRÔLE du lot A (v3) : un extrait de 3 s (90 images à 30 i/s, i0 = 0,3 s) par élément, posé sur la PRISE
 * COMMUNE (`prise.png` du dossier public passé au bundler, 1080×1920, sans recadrage ni décalage), plus l'enchaînement de
 * 15 s de tout le lot. Aucun rôle en production : `entree-planche.tsx` n'est pas branché dans `Racine.tsx`.
 * Les clips B-roll viennent du pool partagé (`planche-v3/broll/`), copiés dans le dossier public du bundle.
 */
import React from "react";
import { AbsoluteFill, Composition, Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import { chargerPoliceMontserrat, chargerPoliceTitre } from "../../../commune/polices";
import { FenetreDouble } from "./FenetreDouble";
import { FenetrePivot } from "./FenetrePivot";
import { FenetrePleinCadre } from "./FenetrePleinCadre";
import { FenetreTelephone } from "./FenetreTelephone";
import { FPS } from "./commun-v3";
import { groupesPhrase, SousTitresLotA } from "./sous-titres-lotA";

export type IdElementLotA = "fenetre-pivot" | "fenetre-telephone" | "fenetre-double" | "fenetre-plein-cadre";
export const ELEMENTS_LOT_A: IdElementLotA[] = ["fenetre-pivot", "fenetre-telephone", "fenetre-double", "fenetre-plein-cadre"];

const V = (nom: string) => staticFile(`broll-${nom}.mp4`);
/** Centre vertical (fraction de H) des sous-titres selon l'élément : sous la fenêtre, ou EN HAUT quand le bas est occupé (§ C.1). */
export const Y_SOUS_TITRES: Record<IdElementLotA, number> = { "fenetre-pivot": 0.8, "fenetre-telephone": 0.835, "fenetre-double": 0.075, "fenetre-plein-cadre": 0.76 };

/** Durées des éléments (secondes) : fin − debut, dans les bornes de la fiche (1,2-3 s ; 1,5-3 s ; 2-3 s ; 1,5-2,5 s). */
const D = 0.3;
export const FICHES_EXTRAIT = {
  "fenetre-pivot": { debut: D, fin: D + 2.4 },
  "fenetre-telephone": { debut: D, fin: D + 2.6 },
  "fenetre-double": { debut: D, fin: D + 2.6 },
  "fenetre-plein-cadre": { debut: D, fin: D + 2.2 },
} as const;

type Cadre = { t: number; largeurImage: number; hauteurImage: number; avecSons: boolean };

/** Rend un élément (avec ses vraies données d'exemple) à l'instant `t` de sa composition. */
export function ElementLotA({ element, t, debutRel = 0, avecSons, sens, miroir, dureeCourte }: { element: IdElementLotA; t: number; debutRel?: number; avecSons: boolean; sens?: 1 | -1; miroir?: boolean; dureeCourte?: number }) {
  chargerPoliceMontserrat();
  chargerPoliceTitre();
  const c: Cadre = { t, largeurImage: 1080, hauteurImage: 1920, avecSons };
  const f = FICHES_EXTRAIT[element];
  const debut = f.debut + debutRel;
  const fin = dureeCourte ? f.debut + dureeCourte + debutRel : f.fin + debutRel;
  switch (element) {
    case "fenetre-pivot":
      return miroir ? (
        <FenetrePivot {...c} debut={debut} fin={fin} src={V("ecriture-papier-1080")} depuisSec={0.3} etiquette="Sur papier" sens={sens ?? -1} />
      ) : (
        <FenetrePivot {...c} debut={debut} fin={fin} src={V("clavier-frappe-1080")} depuisSec={0.3} etiquette="Vos devis" sens={sens ?? 1} />
      );
    case "fenetre-telephone":
      return <FenetreTelephone {...c} debut={debut} fin={fin} src={V("chantier-menuisier-1080")} depuisSec={0.3} etiquette="Chantier" />;
    case "fenetre-double":
      return <FenetreDouble {...c} debut={debut} fin={fin} srcA={V("devis-signature-1080")} srcB={V("signature-main-1080")} depuisSecA={0.3} depuisSecB={0.3} etiquetteA="Le devis" etiquetteB="Signé" sens={sens ?? -1} />;
    case "fenetre-plein-cadre":
      return <FenetrePleinCadre {...c} debut={debut} fin={fin} src={V("atelier-soudure-1080")} depuisSec={0.3} etiquette="L'atelier" sens={sens ?? 1} />;
  }
}

const Fond = () => <Img src={staticFile("prise.png")} style={{ width: 1080, height: 1920 }} />;

export function PlancheLotA({ element, image }: { element: IdElementLotA; image: number }) {
  return (
    <AbsoluteFill style={{ background: "#111" }}>
      <Fond />
      <ElementLotA element={element} t={image / FPS} avecSons={false} />
      <SousTitresLotA t={image / FPS} y={Y_SOUS_TITRES[element] * 1920} groupes={groupesPhrase(0.2)} largeurImage={1080} hauteurImage={1920} />
    </AbsoluteFill>
  );
}

export function ExtraitLotA({ element, sansSons }: { element: IdElementLotA; sansSons?: boolean }) {
  const image = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#111" }}>
      <Fond />
      <ElementLotA element={element} t={image / FPS} avecSons={!sansSons} />
      <SousTitresLotA t={image / FPS} y={Y_SOUS_TITRES[element] * 1920} groupes={groupesPhrase(0.2)} largeurImage={1080} hauteurImage={1920} />
    </AbsoluteFill>
  );
}

/** Un élément dans une Sequence : son temps local repart de 0 au début de la Sequence. */
function Dans({ element, sens, miroir, dureeCourte }: { element: IdElementLotA; sens?: 1 | -1; miroir?: boolean; dureeCourte?: number }) {
  const f = useCurrentFrame();
  return <ElementLotA element={element} t={f / FPS} avecSons sens={sens} miroir={miroir} dureeCourte={dureeCourte} />;
}

/**
 * Enchaînement de 15 s de tout le lot (extrait d'une vidéo, de 5 s à 20 s : rien sur le visage avant 5,0 s, aucun E7 avant
 * 10 s). Cadence : un événement toutes les 1 à 2,5 s ; 1 s de Will seul après le plein cadre (E7) ; 5 B-roll différents.
 * Entrées : N1 droite, N2 bas, N1+N4 (gauche), N1 droite (plein cadre), N1 gauche (miroir).
 */
export const PLAN_ENCHAINEMENT = [
  { cle: "pivot", element: "fenetre-pivot" as IdElementLotA, de: 0.3, sens: 1 as const, duree: 2.7 },
  { cle: "telephone", element: "fenetre-telephone" as IdElementLotA, de: 3.1, duree: 2.9 },
  { cle: "double", element: "fenetre-double" as IdElementLotA, de: 6.0, sens: -1 as const, duree: 2.9 },
  { cle: "plein", element: "fenetre-plein-cadre" as IdElementLotA, de: 9.6, sens: 1 as const, duree: 2.5 },
  { cle: "pivot-miroir", element: "fenetre-pivot" as IdElementLotA, de: 13.0, sens: -1 as const, duree: 1.9, miroir: true, dureeCourte: 1.6 },
];

/** Les sous-titres changent de hauteur selon l'élément visible (sous la fenêtre, ou en haut quand le bas est occupé). */
function SousTitresEnchainement() {
  const t = useCurrentFrame() / FPS;
  const actif = PLAN_ENCHAINEMENT.find((e) => t >= e.de + 0.3 && t < e.de + e.duree);
  const y = (actif ? Y_SOUS_TITRES[actif.element] : 0.8) * 1920;
  const groupes = [0.3, 3.8, 7.3, 10.8].flatMap((t0) => groupesPhrase(t0, 1.08));
  return <SousTitresLotA t={t} y={y} groupes={groupes} largeurImage={1080} hauteurImage={1920} />;
}

export function EnchainementLotA() {
  chargerPoliceMontserrat();
  chargerPoliceTitre();
  return (
    <AbsoluteFill style={{ background: "#111" }}>
      <Fond />
      {PLAN_ENCHAINEMENT.map((e) => (
        <Sequence key={e.cle} from={Math.round(e.de * FPS)} durationInFrames={Math.round(e.duree * FPS)}>
          <Dans element={e.element} sens={e.sens} miroir={"miroir" in e ? e.miroir : undefined} dureeCourte={"dureeCourte" in e ? e.dureeCourte : undefined} />
        </Sequence>
      ))}
      <SousTitresEnchainement />
    </AbsoluteFill>
  );
}

export function RacinePlancheLotA() {
  return (
    <>
      <Composition id="PlancheLotA" component={PlancheLotA} durationInFrames={1} fps={FPS} width={1080} height={1920} defaultProps={{ element: "fenetre-pivot" as IdElementLotA, image: 24 }} />
      <Composition id="ExtraitLotA" component={ExtraitLotA} durationInFrames={90} fps={FPS} width={1080} height={1920} defaultProps={{ element: "fenetre-pivot" as IdElementLotA, sansSons: false }} />
      <Composition id="EnchainementLotA" component={EnchainementLotA} durationInFrames={450} fps={FPS} width={1080} height={1920} />
    </>
  );
}
