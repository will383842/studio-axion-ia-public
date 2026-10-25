/**
 * Parcours PB « Avant / avec nous » (3 pages, maquette id « b ») : deux voies de durées inégales avec une icône à chaque étape ; la voie
 * « avant » ne finit jamais, la voie « avec nous » s'arrête tôt. « Scénario type », « Avant » et « Avec nous » sont posés par le code.
 * Les tirets sont coupés avant chaque couture (`traits.ts`) : aucun trait fin ne tombe sur une couture.
 */
import { CHARTE_CONTINU as C } from "../../../../../src/briques/visuels/charte-carrousel";
import { TEXTES_FIXES_L9 } from "../../../../../src/briques/visuels/textes-fixes";
import { Etincelle, Etiquette, Libelle, police, Pose, POLICE_SERIF, Tuile, type VarianteTuile } from "../commun/Primitives";
import type { NomIconeContinu } from "../commun/icones-continu";
import type { ProprietesParcours } from "../types";
import { Aparte, bf, CalqueDecor, champ, DefsParcours, TexteP, TitreP, typo, useIdsSvg } from "./commun-parcours";
import { segmentsTiretsPB } from "./traits";

/** `nd()` : tuile centrée sur (x, y) et son libellé centré dessous. */
function Noeud({ x, y, icone, variante, libelle, demi = 150 }: { x: number; y: number; icone: NomIconeContinu; variante: VarianteTuile; libelle: string; demi?: number }) {
  return (
    <>
      <Pose x={x - 52} y={y - 52}>
        <Tuile icone={icone} taille={104} variante={variante} />
      </Pose>
      <div style={{ position: "absolute", left: x - demi, top: y + 70, width: demi * 2, textAlign: "center", ...bf(34, 1.1), letterSpacing: "-0.025em" }}>{typo(libelle)}</div>
    </>
  );
}

export function PB({ pages }: ProprietesParcours) {
  const [p1, p2, p3] = pages;
  const { p } = useIdsSvg();
  return (
    <>
      <CalqueDecor largeur={3240}>
        <DefsParcours p={p} />
        <rect x={80} y={700} width={2960} height={26} rx={13} fill={C.encre} />
        <rect data-a-cheval="" x={80} y={1010} width={1440} height={26} rx={13} fill={`url(#${p}gO)`} />
        {segmentsTiretsPB().map((s) => (
          <path key={s.x1} data-trait-fin="" d={`M${s.x1} 1023 H${s.x2}`} stroke={C.encre} strokeOpacity={0.35} strokeWidth={6} strokeDasharray="3 18" strokeDashoffset={s.decalage} strokeLinecap="round" fill="none" />
        ))}
        <path d="M1580 1150 H3020 M1580 1150 l22 -16 M1580 1150 l22 16 M3020 1150 l-22 -16 M3020 1150 l-22 16" fill="none" stroke={C.encre} strokeOpacity={0.55} strokeWidth={5} strokeLinecap="round" />
      </CalqueDecor>
      <Pose x={80} y={170}>
        <Etiquette>{TEXTES_FIXES_L9.t26Etiquette}</Etiquette>
      </Pose>
      <TitreP x={80} y={240} taille={110} largeur={920} titre={champ(p1, "titre")} accent={champ(p1, "accent")} />
      <TexteP x={80} y={500} largeur={780}>
        {champ(p1, "texte")}
      </TexteP>
      <Pose x={80} y={610}>
        <Libelle style={{ opacity: 0.6 }}>{TEXTES_FIXES_L9.t26Avant}</Libelle>
      </Pose>
      <Pose x={80} y={920}>
        <Libelle>{TEXTES_FIXES_L9.t26AvecNous}</Libelle>
      </Pose>
      <Noeud x={340} y={713} icone="mail" variante="w" libelle={champ(p1, "avant")} />
      <Noeud x={1280} y={713} icone="hourglass" variante="k" libelle={champ(p2, "avant")} />
      <Noeud x={2400} y={713} icone="x" variante="p" libelle={champ(p3, "avant1")} demi={210} />
      <Noeud x={3000} y={713} icone="chat" variante="w" libelle={champ(p3, "avant2")} />
      <Noeud x={340} y={1023} icone="mail" variante="w" libelle={champ(p1, "avec")} />
      <Noeud x={1500} y={1023} icone="check" variante="o" libelle={champ(p2, "avec")} />
      <Aparte x={1180} y={220} largeur={820} taille={84}>
        {typo(champ(p2, "aparte"))}
      </Aparte>
      <Pose x={1820} y={420}>
        <Etincelle taille={52} />
      </Pose>
      <TitreP x={2240} y={200} taille={104} largeur={860} titre={champ(p3, "titre")} accent={champ(p3, "accent")} suite={champ(p3, "suite")} />
      <TexteP x={2240} y={500} largeur={800}>
        {champ(p3, "texte")}
      </TexteP>
      <div style={{ position: "absolute", left: 2300, top: 1068, ...police(400, 56, 1.1, POLICE_SERIF, true), whiteSpace: "nowrap" }}>{typo(champ(p3, "note"))}</div>
    </>
  );
}
