/** C01 Orbite : titre à accent, une ligne de texte, une sphère entourée de quatre tuiles en orbite (maquette `heroOrbit(820)`). */
import { alpha, CHARTE_CONTINU as C } from "../../../../../../src/briques/visuels/charte-carrousel";
import type { NomIconeContinu } from "../../commun/icones-continu";
import { Etincelle, Pose, Sphere, Texte, Tuile, type VarianteTuile } from "../../commun/Primitives";
import type { ProprietesPlaquette } from "../../types";
import { Cadre, TitreCouverture, ZoneTexte } from "./commun";

const TUILES: [NomIconeContinu, number, VarianteTuile][] = [
  ["mail", -150, "w"],
  ["calendar", -30, "o"],
  ["chart", 58, "k"],
  ["chat", 150, "p"],
];

function Orbite({ taille }: { taille: number }) {
  const c = taille / 2;
  const R = taille * 0.43;
  const r = taille * 0.25;
  const ts = Math.round(taille * 0.19);
  return (
    <div style={{ position: "relative", width: taille, height: taille }}>
      <svg data-decor="" width={taille} height={taille} style={{ position: "absolute", left: 0, top: 0 }} aria-hidden>
        <circle cx={c} cy={c} r={R} fill="none" stroke={alpha(C.encre, 0.2)} strokeWidth={3} strokeDasharray="4 16" strokeLinecap="round" />
        <circle cx={c} cy={c} r={R * 0.72} fill="none" stroke={alpha(C.orange, 0.4)} strokeWidth={3} />
      </svg>
      <Pose x={c - r} y={c - r}>
        <Sphere rayon={r} />
      </Pose>
      {TUILES.map(([icone, angle, variante]) => {
        const a = (angle * Math.PI) / 180;
        return (
          <Pose key={icone} x={c + R * Math.cos(a) - ts / 2} y={c + R * Math.sin(a) - ts / 2}>
            <Tuile icone={icone} taille={ts} variante={variante} />
          </Pose>
        );
      })}
    </div>
  );
}

export function C01({ page, hauteur }: ProprietesPlaquette) {
  return (
    <Cadre hauteur={hauteur}>
      <Pose x={340} y={620}>
        <Orbite taille={820} />
      </Pose>
      <Pose x={900} y={300}>
        <Etincelle taille={70} />
      </Pose>
      <Pose x={840} y={190}>
        <Etincelle taille={34} couleur={C.encre} />
      </Pose>
      <ZoneTexte>
        <TitreCouverture taille={150} titre={String(page.titre)} accent={String(page.accent)} suite={page.suite ? String(page.suite) : undefined} style={{ marginTop: 20, maxWidth: 740 }} />
        <Texte style={{ marginTop: 36, maxWidth: 470 }}>{String(page.texte)}</Texte>
      </ZoneTexte>
    </Cadre>
  );
}
