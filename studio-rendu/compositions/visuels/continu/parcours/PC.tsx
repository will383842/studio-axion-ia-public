/**
 * Parcours PC « Le grand mot » (3 pages, maquette id « c ») : un mot par page, une règle graduée continue qui les relie, une sphère à
 * cheval sur la première couture, des icônes en relief entre les mots. Aucun mot n'est coupé par une couture (le « seul » et le « cas. »
 * démarrent à 80 px des coutures) : aucun mot-affiche à déclarer.
 */
import { CHARTE_CONTINU as C } from "../../../../../src/briques/visuels/charte-carrousel";
import { Etincelle, police, Pose, POLICE_SERIF, POLICE_TITRE, Sphere, Tuile } from "../commun/Primitives";
import type { ProprietesParcours } from "../types";
import { Aparte, CalqueDecor, champ, Cheval, TexteP, typo } from "./commun-parcours";
import { graduationsPC } from "./traits";

export function PC({ pages }: ProprietesParcours) {
  const [p1, p2, p3] = pages;
  return (
    <>
      <CalqueDecor largeur={3240}>
        <line x1={80} x2={3160} y1={1010} y2={1010} stroke={C.encre} strokeOpacity={0.35} strokeWidth={3} />
        {graduationsPC(3).map((g) => (
          <line key={g.x} data-trait-fin="" x1={g.x} x2={g.x} y1={1010} y2={g.long ? 1050 : 1032} stroke={C.encre} strokeOpacity={0.35} strokeWidth={3} strokeLinecap="round" />
        ))}
        <circle cx={80} cy={1010} r={16} fill={C.orange} />
        <circle cx={3160} cy={1010} r={16} fill={C.orange} />
      </CalqueDecor>
      <Cheval x={900} y={150}>
        <Sphere rayon={170} />
      </Cheval>
      <Pose x={340} y={250} rotation={-10}>
        <Tuile icone="target" taille={150} variante="k" />
      </Pose>
      <Pose x={1500} y={190} rotation={8}>
        <Tuile icone="bulb" taille={160} variante="o" />
      </Pose>
      <Pose x={2520} y={200} rotation={-6}>
        <Tuile icone="check" taille={170} variante="w" />
      </Pose>
      <Pose x={2200} y={260}>
        <Etincelle taille={60} />
      </Pose>
      <Pose x={1400} y={880}>
        <Etincelle taille={40} couleur={C.encre} />
      </Pose>
      <div style={{ position: "absolute", left: 80, top: 470, ...police(800, 420, 0.9, POLICE_TITRE), letterSpacing: "-0.07em", whiteSpace: "nowrap" }}>{champ(p1, "mot")}</div>
      <div style={{ position: "absolute", left: 1250, top: 430, ...police(400, 460, 0.9, POLICE_SERIF, true), color: C.orange, letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>{champ(p2, "mot")}</div>
      <div style={{ position: "absolute", left: 2240, top: 470, ...police(800, 390, 0.9, POLICE_TITRE), letterSpacing: "-0.07em", whiteSpace: "nowrap" }}>{champ(p3, "mot")}</div>
      <Aparte x={80} y={1090} taille={60} interligne={1.1}>
        {typo(champ(p1, "aparte"))}
      </Aparte>
      <TexteP x={1160} y={1090} largeur={820} taille={34}>
        {champ(p2, "texte")}
      </TexteP>
      <TexteP x={2240} y={1090} largeur={860} taille={34}>
        {champ(p3, "texte")}
      </TexteP>
    </>
  );
}
