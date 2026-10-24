/**
 * Parcours d'ESSAI `PX` (3 pages, jamais en production), modèle « Le chemin » de la maquette : une route orange traverse les deux coutures
 * internes, une tuile en relief marque chaque étape, une carte numérotée porte le titre et le texte de chaque page. Calque de 3 × 1080 × 1350.
 * Les bords extérieurs du parcours restent libres sous y = 780 (raccords posés sur la couture d'entrée et de sortie).
 */
import { alpha, CHARTE_CONTINU as C } from "../../../../../src/briques/visuels/charte-carrousel";
import { Carte, Etincelle, police, Pose, POLICE_TITRE, Texte, Tuile } from "../commun/Primitives";
import type { NomIconeContinu } from "../commun/icones-continu";
import { LARGEUR_PAGE } from "../constantes-continu";
import type { ProprietesParcours } from "../types";

const ROUTE = "M-40 1000 C 300 1000 520 640 1080 640 C 1640 640 1780 780 2160 780 C 2540 780 2700 620 3280 620";
const ETAPES: { icone: NomIconeContinu; x: number; y: number; carte: number }[] = [
  { icone: "target", x: 560, y: 690, carte: 230 },
  { icone: "layers", x: 1640, y: 650, carte: 870 },
  { icone: "gear", x: 2700, y: 640, carte: 230 },
];

export function PX({ pages }: ProprietesParcours) {
  const largeur = pages.length * LARGEUR_PAGE;
  return (
    <>
      <svg data-decor="" width={largeur} height={1350} viewBox={`0 0 ${largeur} 1350`} style={{ position: "absolute", left: 0, top: 0 }} aria-hidden>
        <path d={ROUTE} fill="none" stroke={C.encre} strokeOpacity={0.07} strokeWidth={64} strokeLinecap="round" />
        <path d={ROUTE} fill="none" stroke={C.orange} strokeWidth={20} strokeLinecap="round" />
      </svg>
      {ETAPES.map((e, j) => (
        <Pose key={e.icone} x={e.x - 54} y={e.y - 54}>
          <Tuile icone={e.icone} taille={108} variante={j === 1 ? "k" : "o"} />
        </Pose>
      ))}
      {pages.map((p, j) => (
        <Carte key={String(p.type)} variante={j === 1 ? "pl" : ""} style={{ position: "absolute", left: j * LARGEUR_PAGE + 80, top: ETAPES[j].carte, width: 920, padding: "34px 40px", display: "flex", gap: 34, alignItems: "center" }}>
          <span style={{ ...police(800, 110, 1, POLICE_TITRE), color: C.orange, width: 70, flex: "none" }}>{j + 1}</span>
          <div>
            <b style={{ ...police(800, 54, 1, POLICE_TITRE), letterSpacing: "-0.035em", display: "block", color: C.encre }}>{String(p.titre)}</b>
            <Texte taille={31} style={{ marginTop: 12, color: alpha(C.encre, 0.78) }}>{String(p.texte)}</Texte>
          </div>
        </Carte>
      ))}
      <Pose x={1250} y={1080}>
        <Etincelle taille={44} />
      </Pose>
      <Pose x={2330} y={420}>
        <Etincelle taille={34} couleur={C.encre} />
      </Pose>
    </>
  );
}
