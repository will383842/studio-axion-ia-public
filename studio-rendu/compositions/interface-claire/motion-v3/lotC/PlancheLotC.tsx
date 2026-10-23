import React from "react";
/**
 * PLANCHE DE CONTRÔLE du lot C « Cartes en verre » : un extrait par élément (i0 = image 9) et l'enchaînement de 15 s, posés
 * sur la PRISE COMMUNE (`prise.png` du dossier public passé au bundler, 1080×1920, SANS recadrage ni décalage — sauf la
 * DESCENTE de la prise sous la carte du haut, permise par Will, qui n'a lieu que pour le n° 10), avec les VRAIS sous-titres
 * (`SousTitres.tsx`) sur la phrase d'exemple commune et les bruitages (`sons/` du dossier public, aucune musique).
 * Aucun rôle en production : `entree-planche.tsx` n'est pas branché dans `Racine.tsx`.
 */
import { AbsoluteFill, Audio, Composition, Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import { chargerPoliceMontserrat, chargerPoliceTitre } from "../../../commune/polices";
import { CarteRetournee, SONS_CARTE_RETOURNEE } from "./CarteRetournee";
import { CartePreuve, SONS_CARTE_PREUVE } from "./CartePreuve";
import { CarteVerre, descentePrise, SONS_CARTE_VERRE } from "./CarteVerre";
import { FPS, NUANCES } from "./commun-lotC";
import type { SonElement } from "./commun-lotC";
import { NotificationsVerre, SONS_NOTIFICATIONS } from "./NotificationsVerre";
import { SousTitres } from "../../SousTitres";
import type { GroupeSousTitre } from "../../SousTitres";
import { SONS_WIDGET, WidgetChiffre } from "./WidgetChiffre";

export type IdElementLotC = "carte-verre" | "carte-preuve" | "notifications-verre" | "widget-chiffre" | "carte-retournee";
export const ELEMENTS_LOTC: IdElementLotC[] = ["carte-verre", "carte-preuve", "notifications-verre", "widget-chiffre", "carte-retournee"];

/** Image où Will prononce le mot déclencheur dans un extrait (0,3 s). */
export const I0 = 9;
export const IMAGES_EXTRAIT: Record<IdElementLotC, number> = { "carte-verre": 84, "carte-preuve": 92, "notifications-verre": 88, "widget-chiffre": 76, "carte-retournee": 88 };

/** Enchaînement de 15 s : (élément, image de début, durée visible). Respecte V1 (jamais deux fois de suite le même emplacement ni la même entrée). */
export const ENCHAINEMENT: { element: IdElementLotC; debut: number; duree: number }[] = [
  { element: "widget-chiffre", debut: 8, duree: 74 },
  { element: "carte-retournee", debut: 84, duree: 82 },
  { element: "notifications-verre", debut: 172, duree: 80 },
  { element: "carte-preuve", debut: 258, duree: 86 },
  { element: "carte-verre", debut: 350, duree: 76 },
];
export const IMAGES_ENCHAINEMENT = 450;

const SORTIE_CARTE_VERRE = 62;
const BASCULE = 36;
const SORTIE_RETOURNEE = 68;
const DEUX = { W: 1080, H: 1920 } as const;

/** Hauteur du centre des sous-titres (fraction de H) : sous le menton, ou sous l'objet qui couvre le visage / sous la prise descendue. */
const Y_ST: Record<IdElementLotC, number> = { "carte-verre": 0.865, "carte-preuve": 0.775, "notifications-verre": 0.625, "widget-chiffre": 0.625, "carte-retournee": 0.625 };

const MOTS = ["Vos", "devis", "partent", "tout", "seuls", "pendant", "que", "vous", "êtes", "sur", "le", "chantier"];
const FORTS = new Set(["seuls", "chantier"]);
const GROUPES_MOTS = [3, 2, 3, 4];

/** Sous-titres mot à mot de la phrase commune « Vos devis partent tout seuls pendant que vous êtes sur le chantier. » (instants en secondes). */
export function groupesPhrase(depart: number, pas: number): GroupeSousTitre[] {
  const groupes: GroupeSousTitre[] = [];
  let k = 0;
  for (const n of GROUPES_MOTS) {
    const mots = MOTS.slice(k, k + n).map((w, j) => ({ w, a: depart + (k + j) * pas, fort: FORTS.has(w) }));
    k += n;
    groupes.push({ mots, fin: depart + k * pas + (k === MOTS.length ? pas * 0.9 : 0) });
  }
  return groupes;
}

const SONS: Record<IdElementLotC, readonly SonElement[]> = {
  "carte-verre": SONS_CARTE_VERRE,
  "carte-preuve": SONS_CARTE_PREUVE(34, 72),
  "notifications-verre": SONS_NOTIFICATIONS,
  "widget-chiffre": SONS_WIDGET(14, 56),
  "carte-retournee": SONS_CARTE_RETOURNEE(BASCULE, SORTIE_RETOURNEE),
};

function Element({ element, i }: { element: IdElementLotC; i: number }) {
  switch (element) {
    case "carte-verre":
      return <CarteVerre i={i} {...DEUX} sortieA={SORTIE_CARTE_VERRE} />;
    case "carte-preuve":
      return <CartePreuve i={i} {...DEUX} />;
    case "notifications-verre":
      return <NotificationsVerre i={i} {...DEUX} />;
    case "widget-chiffre":
      return <WidgetChiffre i={i} {...DEUX} />;
    case "carte-retournee":
      return <CarteRetournee i={i} {...DEUX} basculeA={BASCULE} sortieA={SORTIE_RETOURNEE} />;
  }
}

/** Bruitages d'un élément (le fichier de `sons/` est servi par le dossier public). */
function Sons({ element, debut }: { element: IdElementLotC; debut: number }) {
  return (
    <>
      {SONS[element].map(([k, son, volume], n) => (
        <Sequence key={`${element}-${n}`} from={Math.max(0, debut + k)} durationInFrames={FPS}>
          <Audio src={staticFile(`sons/${son}.wav`)} volume={volume} />
        </Sequence>
      ))}
    </>
  );
}

/** Bande ivoire visible au-dessus de la prise quand elle descend sous la carte du haut (comme la référence). */
const Bande = () => <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 12%, ${NUANCES.ivoire} 0%, ${NUANCES.ivoireCreux} 70%, ${NUANCES.sableClair} 100%)` }} />;

function Prise({ decalage }: { decalage: number }) {
  return <Img src={staticFile("prise.png")} style={{ position: "absolute", left: 0, top: decalage * DEUX.H, width: 1080, height: 1920 }} />;
}

export function ExtraitLotC({ element, sansPrise }: { element: IdElementLotC; sansPrise?: boolean }) {
  chargerPoliceMontserrat();
  chargerPoliceTitre();
  const image = useCurrentFrame();
  const i = image - I0;
  const decalage = element === "carte-verre" ? descentePrise(i, SORTIE_CARTE_VERRE) : 0;
  return (
    <AbsoluteFill style={{ background: "#111" }}>
      {sansPrise ? null : element === "carte-verre" ? <Bande /> : null}
      {sansPrise ? null : <Prise decalage={decalage} />}
      <Element element={element} i={i} />
      <SousTitres t={image / FPS} groupes={groupesPhrase(0.1, 0.23)} y={Y_ST[element] * DEUX.H} largeurImage={DEUX.W} hauteurImage={DEUX.H} />
      <Sons element={element} debut={I0} />
    </AbsoluteFill>
  );
}

const DEPARTS_PHRASE = [0.15, 3.85, 7.6, 11.3];

export function EnchainementLotC() {
  chargerPoliceMontserrat();
  chargerPoliceTitre();
  const image = useCurrentFrame();
  const verre = ENCHAINEMENT[4];
  const iCarte = image - verre.debut;
  const decalage = iCarte >= 0 ? descentePrise(iCarte, SORTIE_CARTE_VERRE) : 0;
  const actif = ENCHAINEMENT.find((e) => image >= e.debut && image < e.debut + e.duree);
  const y = actif ? Y_ST[actif.element] : 0.625;
  return (
    <AbsoluteFill style={{ background: "#111" }}>
      <Bande />
      <Prise decalage={decalage} />
      {ENCHAINEMENT.map((e) => (
        <Element key={e.element} element={e.element} i={image - e.debut} />
      ))}
      {DEPARTS_PHRASE.map((d, n) => (
        <SousTitres key={n} t={image / FPS} groupes={groupesPhrase(d, 0.26)} y={y * DEUX.H} largeurImage={DEUX.W} hauteurImage={DEUX.H} />
      ))}
      {ENCHAINEMENT.map((e) => (
        <Sons key={e.element} element={e.element} debut={e.debut} />
      ))}
    </AbsoluteFill>
  );
}

export function RacinePlancheLotC() {
  return (
    <>
      {ELEMENTS_LOTC.map((e) => (
        <Composition key={e} id={`Extrait-${e}`} component={ExtraitLotC} durationInFrames={IMAGES_EXTRAIT[e]} fps={FPS} width={1080} height={1920} defaultProps={{ element: e, sansPrise: false }} />
      ))}
      <Composition id="EnchainementLotC" component={EnchainementLotC} durationInFrames={IMAGES_ENCHAINEMENT} fps={FPS} width={1080} height={1920} />
    </>
  );
}
