/**
 * Parcours PG « L'escalier » (4 pages, maquette id « g ») : un escalier encre dont chaque marche traverse une couture ; des cartes avec
 * icônes en relief posées sur les marches portent les étapes ; un drapeau orange en haut marque le résultat.
 */
import { CHARTE_CONTINU as C } from "../../../../../src/briques/visuels/charte-carrousel";
import { Etincelle, Pose } from "../commun/Primitives";
import type { ProprietesParcours } from "../types";
import { CalqueDecor, CarteAbs, champ, DefsParcours, Rangee, TitreP, useIdsSvg } from "./commun-parcours";

const ESCALIER = "M-10 1010 H1260 V860 H2340 V710 H3420 V560 H4330";

export function PG({ pages }: ProprietesParcours) {
  const [p1, p2, p3, p4] = pages;
  const { p } = useIdsSvg();
  return (
    <>
      <CalqueDecor largeur={4320}>
        <DefsParcours p={p} />
        <path d={`${ESCALIER} V1350 H-10 Z`} fill={`url(#${p}gSt)`} />
        <path data-a-cheval="" d={ESCALIER} fill="none" stroke={C.orange} strokeWidth={12} strokeLinejoin="round" />
        <path d="M4120 560 V250" stroke={C.encre} strokeWidth={12} strokeLinecap="round" />
        <path d="M4120 250 H4260 L4220 296 L4260 342 H4120 Z" fill={C.orange} />
      </CalqueDecor>
      <TitreP x={80} y={200} taille={130} largeur={880} titre={champ(p1, "titre")} accent={champ(p1, "accent")} />
      <CarteAbs x={120} y={720} largeur={760} hauteur={250}>
        <Rangee icone="users" titre={champ(p1, "etape")} sous={champ(p1, "detail")} variante="o" taille={112} corps={46} />
      </CarteAbs>
      <CarteAbs x={1320} y={570} largeur={760} hauteur={250}>
        <Rangee icone="target" titre={champ(p2, "etape")} sous={champ(p2, "detail")} variante="k" taille={112} corps={46} />
      </CarteAbs>
      <CarteAbs x={2400} y={420} largeur={720} hauteur={250}>
        <Rangee icone="gear" titre={champ(p3, "etape")} sous={champ(p3, "detail")} variante="o" taille={112} corps={46} />
      </CarteAbs>
      <CarteAbs x={3480} y={270} largeur={580} hauteur={250} variante="o">
        <Rangee icone="check" titre={champ(p4, "etape")} sous={champ(p4, "detail")} variante="k" taille={112} corps={46} />
      </CarteAbs>
      <Pose x={3600} y={150}>
        <Etincelle taille={44} />
      </Pose>
      <Pose x={900} y={450}>
        <Etincelle taille={52} />
      </Pose>
      <Pose x={2000} y={300}>
        <Etincelle taille={34} couleur={C.encre} />
      </Pose>
    </>
  );
}
