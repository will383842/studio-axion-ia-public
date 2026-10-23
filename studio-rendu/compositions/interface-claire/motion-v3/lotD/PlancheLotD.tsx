/**
 * APERÇU DU LOT D (outil de validation, pas un élément) : prise commune + UN élément du lot (extrait de 2-3 s), ou l'enchaînement de 15 s.
 * Ne touche ni `Racine.tsx` ni `Compositions.tsx` : l'aperçu a sa propre entrée (`entree-lotD.ts`) et sa propre racine.
 * `public/` doit contenir : prise-commune.png, masque-will.png (détourage de Will, canal alpha) et sons/*.wav.
 */
import React from "react";
import { AbsoluteFill, Composition, Img, staticFile, useCurrentFrame } from "remotion";
import { chargerPoliceMontserrat } from "../../../commune/polices";
import { FPS, PRISE_COMMUNE_LOT, Sons, usePolicesD } from "./communD";
import { groupesPhrase, plaqueDevis, SousTitresD, T_MOT } from "./phraseD";
import type { InstancePhrase } from "./phraseD";
import { CitationVerre, SONS_CITATION_VERRE } from "./CitationVerre";
import { MotDerriere, SONS_MOT_DERRIERE } from "./MotDerriere";
import { MotSaute, SONS_MOT_SAUTE } from "./MotSaute";
import { MotVerticalBord, SONS_MOT_VERTICAL_BORD } from "./MotVerticalBord";
import { RafaleTroisMots, SONS_RAFALE } from "./RafaleTroisMots";

export const LARGEUR = 1080;
export const HAUTEUR = 1920;
export const DEBUT = 0.4;
export const ELEMENTS_LOT_D = ["mot-vertical-bord", "mot-saute", "mot-derriere", "rafale-trois-mots", "citation-verre"] as const;
export type IdLotD = (typeof ELEMENTS_LOT_D)[number];
export const DUREES: Record<IdLotD, number> = { "mot-vertical-bord": 2.6, "mot-saute": 2.0, "mot-derriere": 2.2, "rafale-trois-mots": 1.8, "citation-verre": 2.2 };
/** Enchaînement de 15 s : (élément, instant de i0, côté). Gauche/droite alternés, E7 après 10 s, Will seul à la fin. */
export const PLAN_ENCHAINEMENT: readonly { id: IdLotD; debut: number; cote?: "gauche" | "droite" }[] = [
  { id: "citation-verre", debut: 0.6 },
  { id: "mot-vertical-bord", debut: 3.3, cote: "droite" },
  { id: "mot-saute", debut: 6.4 },
  { id: "mot-derriere", debut: 8.9 },
  { id: "rafale-trois-mots", debut: 11.6 },
];
const SONS: Record<IdLotD, readonly { k: number; fichier: string; volume?: number; rate?: number }[]> = {
  "mot-vertical-bord": SONS_MOT_VERTICAL_BORD,
  "mot-saute": SONS_MOT_SAUTE,
  "mot-derriere": SONS_MOT_DERRIERE,
  "rafale-trois-mots": SONS_RAFALE,
  "citation-verre": SONS_CITATION_VERRE,
};

/** Mot déclencheur de chaque élément dans la phrase commune (relatif à « devis » = 0). */
const DECLENCHEUR: Record<IdLotD, number> = { "mot-vertical-bord": T_MOT.devis, "mot-saute": T_MOT.devis, "mot-derriere": T_MOT.seuls, "rafale-trois-mots": T_MOT.devis, "citation-verre": T_MOT.partent };
const instance = (id: IdLotD, debut: number): InstancePhrase => ({ origine: debut - DECLENCHEUR[id], saute: id === "mot-saute" });

function Element({ id, t, debut, fin, cote }: { id: IdLotD; t: number; debut: number; fin: number; cote?: "gauche" | "droite" }) {
  const commun = { t, debut, fin, largeurImage: LARGEUR, hauteurImage: HAUTEUR };
  const prise = <Img src={staticFile("prise-commune.png")} style={{ position: "absolute", left: 0, top: 0, width: LARGEUR, height: HAUTEUR, objectFit: "cover" }} />;
  switch (id) {
    case "mot-vertical-bord":
      return <MotVerticalBord {...commun} mot="devis" cote={cote ?? "droite"} />;
    case "mot-saute":
      return <MotSaute {...commun} mot="devis" prise={PRISE_COMMUNE_LOT} depart={{ x: plaqueDevis(LARGEUR, HAUTEUR).x, y: plaqueDevis(LARGEUR, HAUTEUR).y }} largeurDepart={plaqueDevis(LARGEUR, HAUTEUR).largeur} />;
    case "mot-derriere":
      return <MotDerriere {...commun} mot="seuls" priseNode={prise} masque={staticFile("masque-will.png")} />;
    case "rafale-trois-mots":
      return <RafaleTroisMots {...commun} mots={["devis", "partent", "seuls"]} tMots={[debut + T_MOT.partent, debut + T_MOT.seuls]} prise={PRISE_COMMUNE_LOT} />;
    case "citation-verre":
      return <CitationVerre {...commun} lignes={["partent", "tout seuls"]} prise={PRISE_COMMUNE_LOT} />;
  }
}

export function ExtraitLotD({ element }: { element: IdLotD }) {
  chargerPoliceMontserrat();
  usePolicesD();
  const t = useCurrentFrame() / FPS;
  const groupes = groupesPhrase([instance(element, DEBUT)]);
  const el = <Element id={element} t={t} debut={DEBUT} fin={DEBUT + DUREES[element]} />;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Img src={staticFile("prise-commune.png")} style={{ width: LARGEUR, height: HAUTEUR, objectFit: "cover" }} />
      <SousTitresD t={t} groupes={groupes} W={LARGEUR} H={HAUTEUR} />
      {el}
      <Sons debut={DEBUT} sons={SONS[element]} />
    </AbsoluteFill>
  );
}

export function EnchainementLotD() {
  chargerPoliceMontserrat();
  usePolicesD();
  const t = useCurrentFrame() / FPS;
  const groupes = groupesPhrase(PLAN_ENCHAINEMENT.map((e) => instance(e.id, e.debut)));
  const rendre = (rafale: boolean) =>
    PLAN_ENCHAINEMENT.filter((e) => (e.id === "rafale-trois-mots") === rafale).map((e) => <Element key={e.id} id={e.id} t={t} debut={e.debut} fin={e.debut + DUREES[e.id]} cote={e.cote} />);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Img src={staticFile("prise-commune.png")} style={{ width: LARGEUR, height: HAUTEUR, objectFit: "cover" }} />
      <SousTitresD t={t} groupes={groupes} W={LARGEUR} H={HAUTEUR} />
      {rendre(false)}
      {rendre(true)}
      {PLAN_ENCHAINEMENT.map((e) => (
        <Sons key={e.id} debut={e.debut} sons={SONS[e.id]} />
      ))}
    </AbsoluteFill>
  );
}

export function RacineLotD() {
  return (
    <>
      {ELEMENTS_LOT_D.map((id) => (
        <Composition key={id} id={`lotD-${id}`} component={ExtraitLotD as unknown as React.FC<Record<string, unknown>>} durationInFrames={Math.round((DEBUT + DUREES[id]) * FPS) + 1} fps={FPS} width={LARGEUR} height={HAUTEUR} defaultProps={{ element: id }} />
      ))}
      <Composition id="lotD-enchainement" component={EnchainementLotD as unknown as React.FC<Record<string, unknown>>} durationInFrames={450} fps={FPS} width={LARGEUR} height={HAUTEUR} />
    </>
  );
}
