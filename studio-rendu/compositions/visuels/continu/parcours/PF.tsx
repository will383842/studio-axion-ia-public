/**
 * Parcours PF « La courbe » (4 pages, maquette id « f ») : une courbe qui démarre doucement puis accélère, quatre jalons avec icônes en
 * relief. Aucun chiffre : schéma illustratif. L'aire sous la courbe est un dégradé doux, sans trait vertical sur une couture (elle commence
 * et finit à l'intérieur des pages 1 et 4). Les cartes de jalon sont décalées pour que leur texte reste à plus de 80 px des coutures.
 */
import { CHARTE_CONTINU as C } from "../../../../../src/briques/visuels/charte-carrousel";
import { Etincelle, Pose, Tuile } from "../commun/Primitives";
import type { ProprietesParcours } from "../types";
import { Aparte, bf, CalqueDecor, CarteAbs, champ, DefsParcours, TexteP, TitreP, typo, useIdsSvg } from "./commun-parcours";

const COURBE = "M240 1060 C 700 1060 900 1000 1300 990 C 1800 990 2000 850 2400 850 C 2800 850 3000 620 3380 620 C 3650 620 3800 420 4100 420";

function Jalon({ x, y, largeur = 420, variante = "", children }: { x: number; y: number; largeur?: number; variante?: "" | "o"; children: string }) {
  return (
    <CarteAbs x={x} y={y} largeur={largeur} hauteur={170} variante={variante}>
      <b style={{ ...bf(42, 1.05), display: "block" }}>{typo(children)}</b>
    </CarteAbs>
  );
}

export function PF({ pages }: ProprietesParcours) {
  const [p1, p2, p3, p4] = pages;
  const { p } = useIdsSvg();
  return (
    <>
      <CalqueDecor largeur={4320}>
        <DefsParcours p={p} />
        <path d={`${COURBE} L4100 1130 L240 1130 Z`} fill={`url(#${p}gA)`} />
        <line x1={80} x2={4240} y1={1130} y2={1130} stroke={C.encre} strokeOpacity={0.2} strokeWidth={3} />
        <path data-a-cheval="" d={COURBE} fill="none" stroke={C.orange} strokeWidth={22} strokeLinecap="round" />
      </CalqueDecor>
      <Pose x={1250} y={940}>
        <Tuile icone="calendar" taille={100} variante="w" />
      </Pose>
      <Pose x={2350} y={800}>
        <Tuile icone="users" taille={100} variante="k" />
      </Pose>
      <Pose x={3330} y={570}>
        <Tuile icone="chart" taille={100} variante="w" />
      </Pose>
      <Pose x={4050} y={370}>
        <Tuile icone="flag" taille={100} variante="o" />
      </Pose>
      <TitreP x={80} y={200} taille={112} largeur={920} titre={champ(p1, "titre")} accent={champ(p1, "accent")} suite={champ(p1, "suite")} />
      <TexteP x={80} y={820} largeur={540} taille={34}>
        {champ(p1, "texte")}
      </TexteP>
      <Jalon x={1124} y={740}>
        {champ(p2, "jalon")}
      </Jalon>
      <Jalon x={2210} y={590}>
        {champ(p3, "jalon")}
      </Jalon>
      <Jalon x={3290} y={330}>
        {champ(p4, "jalon")}
      </Jalon>
      <Jalon x={3820} y={150} largeur={360} variante="o">
        {champ(p4, "final")}
      </Jalon>
      <Aparte x={200} y={1160} taille={50}>
        {typo(champ(p1, "depart"))}
      </Aparte>
      <Aparte x={3520} y={1160} taille={50}>
        {typo(champ(p4, "plusTard"))}
      </Aparte>
      <Pose x={1900} y={420}>
        <Etincelle taille={52} />
      </Pose>
      <Pose x={2900} y={260}>
        <Etincelle taille={38} couleur={C.encre} />
      </Pose>
    </>
  );
}
