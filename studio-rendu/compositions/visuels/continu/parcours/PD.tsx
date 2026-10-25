/**
 * Parcours PD « L'objet à cheval » (3 pages, maquette id « d ») : une loupe sur la première couture, un curseur sur la seconde ; les
 * objets passent d'une page à l'autre, le texte reste entre les deux. Variante des « 3 questions » ou « 3 raisons ».
 * Loupe et curseur sont des SVG serrés autour de leur dessin (le texte ne les recouvre pas) ; la loupe est remontée de 60 px et le curseur
 * de 40 px par rapport à la maquette pour dégager le texte des cartes.
 */
import { alpha, CHARTE_CONTINU as C } from "../../../../../src/briques/visuels/charte-carrousel";
import { Etincelle, police, Pose, POLICE_TITRE, Tuile } from "../commun/Primitives";
import type { ProprietesParcours } from "../types";
import { Aparte, bf, CarteAbs, champ, DefsParcours, Rangee, TexteP, TitreP, typo, useIdsSvg } from "./commun-parcours";

export function PD({ pages }: ProprietesParcours) {
  const [p1, p2, p3] = pages;
  const { p } = useIdsSvg();
  return (
    <>
      {/* Loupe : centre (1080, 700). Boîte du SVG = x 875 à 1412, y 495 à 1032. */}
      <svg data-a-cheval="" width={537} height={537} viewBox="-205 -205 537 537" style={{ position: "absolute", left: 875, top: 495 }} aria-hidden>
        <DefsParcours p={p} />
        <g filter={`url(#${p}fsh)`}>
          <path d="M120 120 L300 300" stroke={C.encre} strokeWidth={64} strokeLinecap="round" />
          <path d="M200 200 L300 300" stroke={C.orange} strokeWidth={64} strokeLinecap="round" />
          <circle r={190} fill={alpha(C.blancCarte, 0.6)} stroke={C.encre} strokeWidth={30} />
          <circle r={175} fill={`url(#${p}gGl)`} opacity={0.55} />
          <path d="M-100 -30 q30 -90 120 -70" fill="none" stroke={C.blancCarte} strokeWidth={18} strokeLinecap="round" opacity={0.9} />
        </g>
      </svg>
      {/* Curseur : centre (2160, 780), pivoté de -12°. Boîte du SVG = x 1980 à 2330, y 610 à 1005. */}
      <svg data-a-cheval="" width={350} height={395} viewBox="-180 -170 350 395" style={{ position: "absolute", left: 1980, top: 610 }} aria-hidden>
        <g transform="rotate(-12)" filter={`url(#${p}fsh)`}>
          <path d="M-130 -190 L-130 160 L-40 80 L30 220 L100 190 L30 56 L150 56 Z" fill={`url(#${p}pO)`} stroke={C.encre} strokeWidth={14} strokeLinejoin="round" />
        </g>
      </svg>
      <TitreP x={80} y={200} taille={112} largeur={880} titre={champ(p1, "titre")} accent={champ(p1, "accent")} suite={champ(p1, "suite")} />
      <TexteP x={80} y={1000} largeur={600} taille={34}>
        {champ(p1, "texte")}
      </TexteP>
      <CarteAbs x={1130} y={150} largeur={880} hauteur={260}>
        <Rangee icone="clock" titre={champ(p2, "question1")} sous={champ(p2, "reponse1")} variante="o" taille={120} corps={44} />
      </CarteAbs>
      <CarteAbs x={1160} y={990} largeur={840} hauteur={220} variante="k">
        <Rangee icone="users" titre={champ(p2, "question2")} sous={champ(p2, "reponse2")} variante="o" taille={112} corps={44} />
      </CarteAbs>
      <CarteAbs x={2330} y={150} largeur={780} hauteur={330} variante="o">
        <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", justifyContent: "center" }}>
          <Tuile icone="chart" taille={104} variante="k" />
          <b style={{ ...bf(44, 1.02), display: "block", ...police(800, 44, 1.02, POLICE_TITRE) }}>{typo(champ(p3, "question"))}</b>
        </div>
      </CarteAbs>
      <Aparte x={2300} y={1000} largeur={780} taille={70} interligne={1.05}>
        {typo(champ(p3, "aparte"))}
      </Aparte>
      <Pose x={1980} y={560}>
        <Etincelle taille={50} />
      </Pose>
    </>
  );
}
