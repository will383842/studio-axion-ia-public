/** C02 Question sur fond sombre : titre, texte, grand point d'interrogation orange (décor) et trois tuiles de verre. */
import { CHARTE_CONTINU as C } from "../../../../../../src/briques/visuels/charte-carrousel";
import { Etincelle, Pose, Texte, Tuile } from "../../commun/Primitives";
import type { ProprietesPlaquette } from "../../types";
import { Cadre, TitreCouverture, ZoneTexte } from "./commun";

/**
 * Contour du « ? » d'Instrument Serif italique (OFL), en unités d'em (1000), ligne de base à y = 0. Le grand point d'interrogation est un
 * DÉCOR (le titre porte la question) : dessiné en tracé, il n'est pas un texte à mesurer (marge, couture, coin réservé).
 */
const POINT_INTERROGATION =
  "M128-186L128-186Q124-186 120.5-190Q117-194 119-204L119-204L152-370Q157-397 165.5-414Q174-431 195-446L195-446L225-468Q278-506 306.5-550.5Q335-595 335-656L335-656Q335-685 320-701Q305-717 282-717L282-717Q243-717 214-688.5Q185-660 146-590L146-590Q139-577 130-578L130-578Q119-580 124-597L124-597L154-716Q158-729 170-736L170-736Q184-744 203.5-747.5Q223-751 246-751L246-751Q282-751 314-738.5Q346-726 366.5-699.5Q387-673 387-630L387-630Q387-559 350.5-504.5Q314-450 250-405L250-405L201-370Q191-363 186-352.5Q181-342 176-325L176-325L143-200Q139-186 128-186ZM95 9L95 9Q74 9 61-4.5Q48-18 48-38L48-38Q48-64 66-80Q84-96 104-96L104-96Q124-96 137.5-82.5Q151-69 151-49L151-49Q151-23 133-7Q115 9 95 9Z";

/** Maquette : « ? » en 1250 px, interligne 0,8, `right: -70px`, `top: 150px` ; soit un tracé à l'échelle 1,25, origine x = 765, ligne de base y = 1075. */
function GrandPoint() {
  return (
    <svg data-decor="" aria-hidden width={500} height={1350} viewBox="0 0 500 1350" style={{ position: "absolute", left: 765, top: 0, overflow: "visible", opacity: 0.95 }}>
      <path d={POINT_INTERROGATION} transform="translate(0 1075) scale(1.25)" fill={C.orange} />
    </svg>
  );
}

export function C02({ page, hauteur }: ProprietesPlaquette) {
  return (
    <Cadre hauteur={hauteur}>
      <GrandPoint />
      <Pose x={120} y={880} rotation={-8}>
        <Tuile icone="clock" taille={210} variante="g" />
      </Pose>
      <Pose x={430} y={1000} rotation={6}>
        <Tuile icone="users" taille={170} variante="g" />
      </Pose>
      <Pose x={690} y={830} rotation={-4}>
        <Tuile icone="chart" taille={190} variante="o" />
      </Pose>
      <Pose x={350} y={770}>
        <Etincelle taille={60} />
      </Pose>
      <Pose x={900} y={1060}>
        <Etincelle taille={44} couleur={C.creme} />
      </Pose>
      <ZoneTexte>
        <TitreCouverture sombre taille={140} titre={String(page.titre)} style={{ marginTop: 30, maxWidth: 640 }} />
        <Texte sombre style={{ marginTop: 44, maxWidth: 560 }}>{String(page.texte)}</Texte>
      </ZoneTexte>
    </Cadre>
  );
}
