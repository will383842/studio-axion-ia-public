/**
 * BULLE DE PREUVE (TB-05, plan § 10) : bulle NEUTRE, dessinée au crayon (cadre arrondi en écriture, petite queue), qui
 * montre, chacun à la place que la mise en page lui RÉSERVE : la phrase testée (légende, en haut), les lignes de
 * résultat — l'AVANT sobre, l'APRÈS SURLIGNÉ, chacun sous ou à côté de son étiquette, en deux colonnes séparées d'un
 * trait pour la structure « avant-apres » — et « Testé le JJ/MM » dessous. Jamais l'imitation de l'interface d'une
 * marque d'IA : ni logo, ni nom, ni couleurs, ni boutons d'une application.
 * Mise en page `mise-en-page-tableau/1` (sans place réservée) : phrase et date de `disposerBulle` (plan).
 */
import { COULEURS_VIDEO, EPAISSEURS_VIDEO, MARGES_VIDEO } from "../../../src/briques/habillage/charte-video";
import { LigneEcrite } from "./LigneEcrite";
import type { DispositionBulle } from "./plan";
import { TraitSurligne } from "./Traces";
import type { ElementPlace } from "./types";

export interface ProprietesBulle {
  element: ElementPlace;
  bulle: DispositionBulle;
  /** Avancement (0 à 1) d'une partie : « cadre », « phrase:i », « etiquette:i », « ligne:i », « surligne:i », « date ». */
  avance: (partie: string) => number;
  largeurImage: number;
  hauteurImage: number;
  /** Largeur qui règle l'épaisseur des traits (référence du format) ; absente : `largeurImage`. */
  largeurTrait?: number;
}

export function BullePreuve({ element: e, bulle, avance, largeurImage, hauteurImage, largeurTrait }: ProprietesBulle) {
  const lt = largeurTrait ?? largeurImage;
  const c = bulle.cadre;
  const k = avance("cadre");
  if (k <= 0) return null;
  const trait = Math.max(2, Math.round(EPAISSEURS_VIDEO.traitFin * lt));
  const rayon = Math.round(Math.min(c.hauteur, c.largeur, 360) * 0.08);
  const taille = e.taillePx ?? bulle.tailleLegende;
  const niveau = e.niveau ?? "corps";
  // Queue : la place réservée par la mise en page, sinon sous le coin gauche.
  const q = bulle.queue ?? { x: c.x + rayon * 2, y: c.y + c.hauteur, largeur: Math.round(rayon * 1.96), hauteur: Math.round(rayon * 1.4) };
  // Deux colonnes (avant | après) : un trait entre elles.
  const apres = e.deuxColonnes ? e.lignes.find((l) => l.colonne === "apres")?.px.x : undefined;
  const sep = bulle.separateur ?? (apres === undefined ? undefined : { x: apres - Math.round((MARGES_VIDEO.entreLignes * lt) / 2), y: e.px.y + rayon, hauteur: e.px.hauteur - 2 * rayon });
  return (
    <>
      <svg style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}>
        <rect
          x={c.x}
          y={c.y}
          width={c.largeur}
          height={c.hauteur}
          rx={rayon}
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={(1 - k).toFixed(4)}
          fill="none"
          stroke={COULEURS_VIDEO.ecriture}
          strokeWidth={trait}
        />
        {k >= 1 && (
          <path
            d={`M${q.x} ${c.y + c.hauteur} L${q.x + q.largeur * 0.15} ${q.y + q.hauteur} L${q.x + q.largeur} ${c.y + c.hauteur}`}
            fill={COULEURS_VIDEO.page}
            stroke={COULEURS_VIDEO.ecriture}
            strokeWidth={trait}
            strokeLinejoin="round"
          />
        )}
        {sep && <line x1={sep.x} x2={sep.x} y1={sep.y} y2={sep.y + sep.hauteur * k} stroke={COULEURS_VIDEO.ecriture} strokeWidth={trait} strokeLinecap="round" />}
      </svg>
      {/* L'APRÈS (ou un résultat sans étiquette) est surligné ; l'AVANT reste sobre. */}
      {e.lignes.map((l, i) => (l.ton === "avant" ? null : <TraitSurligne key={`s${i}`} cible={l.px} u={avance(`surligne:${i}`)} largeurImage={lt} hauteurImage={hauteurImage} />))}
      {bulle.phrase.map((l, i) => (
        <LigneEcrite key={`p${i}`} texte={l.texte} px={l.px} taille={bulle.tailleLegende} niveau="legende" u={avance(`phrase:${i}`)} largeurImage={largeurImage} />
      ))}
      {bulle.etiquettes.map((l, i) => (
        <LigneEcrite key={`e${i}`} texte={l.texte} px={l.px} taille={bulle.tailleLegende} niveau="legende" u={avance(`etiquette:${i}`)} largeurImage={largeurImage} />
      ))}
      {e.lignes.map((l, i) => (
        <LigneEcrite key={`l${i}`} texte={l.texte} px={l.px} taille={taille} niveau={niveau} u={avance(`ligne:${i}`)} largeurImage={largeurImage} />
      ))}
      {bulle.date && <LigneEcrite texte={bulle.date.texte} px={bulle.date.px} taille={bulle.tailleLegende} niveau="legende" u={avance("date")} largeurImage={largeurImage} />}
    </>
  );
}
