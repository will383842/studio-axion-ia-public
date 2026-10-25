/**
 * Parcours PA « Le chemin » (4 pages, maquette `PANOS` id « a ») : une route orange relie trois étapes (tuiles en relief) et traverse les
 * trois coutures ; la pastille « On vous guide » déborde sur la page 2 (son texte reste sur la page 1). La page 4 est sombre.
 */
import { alpha, CHARTE_CONTINU as C } from "../../../../../src/briques/visuels/charte-carrousel";
import { Etincelle, Icone, police, Pose, POLICE_SERIF, POLICE_TITRE, Tuile } from "../commun/Primitives";
import type { ProprietesParcours } from "../types";
import { Cheval, champ, CarteAbs, CalqueDecor, Numero, TexteP, TitreP, typo } from "./commun-parcours";

const ROUTE = "M-40 1130 C 420 1130 760 560 1340 560 C 1800 560 1960 880 2420 880 C 2900 880 2980 470 3420 470 C 3860 470 3980 760 4420 760";

export function PA({ pages }: ProprietesParcours) {
  const [p1, p2, p3, p4] = pages;
  return (
    <>
      <CalqueDecor largeur={4320}>
        <path d={ROUTE} fill="none" stroke={C.encre} strokeOpacity={0.07} strokeWidth={64} strokeLinecap="round" />
        <path data-a-cheval="" d={ROUTE} fill="none" stroke={C.orange} strokeWidth={20} strokeLinecap="round" />
        <path d={ROUTE} fill="none" stroke={C.creme} strokeOpacity={0.6} strokeWidth={3} strokeDasharray="2 26" strokeLinecap="round" />
      </CalqueDecor>
      <TitreP x={80} y={200} taille={150} largeur={920} titre={champ(p1, "titre")} accent={champ(p1, "accent")} suite={champ(p1, "suite")} />
      <TexteP x={80} y={540} largeur={520}>
        {champ(p1, "texte")}
      </TexteP>
      <Cheval
        x={560}
        y={880}
        style={{ width: 700, height: 110, borderRadius: 55, background: `linear-gradient(150deg, ${C.brun}, ${C.encre})`, color: C.creme, display: "flex", alignItems: "center", paddingLeft: 46, ...police(800, 42, 1.1, POLICE_TITRE), letterSpacing: "-0.02em", boxShadow: `0 30px 40px -20px ${alpha(C.nuit, 0.6)}` }}
      >
        {champ(p1, "pastille")}
        <span style={{ position: "absolute", right: 14, top: 14, width: 82, height: 82, borderRadius: "50%", background: `linear-gradient(150deg, ${C.orangeLumiere}, ${C.orange})`, display: "grid", placeItems: "center", color: C.encre }}>
          <Icone nom="arrow" taille={44} epaisseur={2.2} />
        </span>
      </Cheval>
      <Pose x={60} y={960} rotation={-7}>
        <Tuile icone="bell" taille={130} variante="o" />
      </Pose>
      <Pose x={420} y={900}>
        <Etincelle taille={44} />
      </Pose>
      <Pose x={830} y={610}>
        <Etincelle taille={30} couleur={C.encre} />
      </Pose>
      <Pose x={1286} y={506}>
        <Tuile icone="target" taille={108} variante="o" />
      </Pose>
      <Pose x={2366} y={826}>
        <Tuile icone="layers" taille={108} variante="k" />
      </Pose>
      <Pose x={3366} y={416}>
        <Tuile icone="gear" taille={108} variante="o" />
      </Pose>
      <CarteAbs x={1130} y={150} largeur={880} hauteur={250}>
        <Numero n={1} titre={champ(p2, "etape")} sous={champ(p2, "detail")} couleur={C.orange} />
      </CarteAbs>
      <CarteAbs x={2208} y={985} largeur={880} hauteur={230}>
        <Numero n={2} titre={champ(p3, "etape")} sous={champ(p3, "detail")} couleur={C.orange} />
      </CarteAbs>
      <CarteAbs x={3320} y={150} largeur={880} hauteur={240} variante="glass">
        <Numero n={3} titre={champ(p4, "etape")} sous={champ(p4, "detail")} couleur={C.orangeClair} />
      </CarteAbs>
      <div style={{ position: "absolute", left: 3320, top: 790, width: 900, ...police(400, 138, 0.92, POLICE_SERIF, true), color: C.creme, letterSpacing: "-0.02em" }}>
        {typo(champ(p4, "titre"))}
        <br />
        <span style={{ color: C.orange }}>{champ(p4, "accent")}</span>
      </div>
      <TexteP x={3320} y={1075} largeur={900} taille={34} sombre>
        {champ(p4, "appel")}
      </TexteP>
      <Pose x={4090} y={700}>
        <Etincelle taille={56} />
      </Pose>
    </>
  );
}
