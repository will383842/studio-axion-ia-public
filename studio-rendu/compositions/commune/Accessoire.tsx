/**
 * ACCESSOIRE (calque 3, lot M4 / M4b) : image détourée de la Bibliothèque, ou micro dessiné. Posé dans le CADRE
 * SOURCE du double (avant le recadrage), dans `boiteAccessoire` : il suit donc le plan poitrine comme le double.
 *
 * Deux usages :
 *  - dans « CompositionImage » (montage tout navigateur, double simulé) ;
 *  - seul, en une image PNG transparente (composition « CompositionAccessoire », `renderStill`) que FFmpeg pose ensuite
 *    sur chaque image (montage FFmpeg du lot M4b) : le flou et le dessin ne sont calculés qu'UNE fois par vidéo.
 */
import { AbsoluteFill, Img } from "remotion";
import { boiteAccessoire, margeFlou, type AccessoireScene } from "../../../src/briques/composition/scene";
import { MicroPodcast } from "./MicroPodcast";

/**
 * Contenu de la boîte (sans position) : image détourée en haut de la boîte, ou micro dessiné. `prolongementBasPx` :
 * la boîte descend d'autant SOUS le bas du cadre (le pied du micro y est rogné net au lieu de s'estomper dans le flou).
 */
export function ContenuAccessoire({ accessoire, flouPx, lumiere, prolongementBasPx = 0 }: { accessoire: AccessoireScene; flouPx: number; lumiere?: string; prolongementBasPx?: number }) {
  const b = boiteAccessoire(accessoire);
  const filtre = flouPx > 0 ? `blur(${flouPx}px)` : undefined;
  return (
    <div style={{ position: "absolute", inset: 0, filter: filtre }}>
      {accessoire.url ? (
        <Img src={accessoire.url} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "50% 0%" }} />
      ) : (
        <MicroPodcast rapportHauteur={(b.hauteur + prolongementBasPx) / b.largeur} versLaGauche={accessoire.x >= 0.5} lumiere={lumiere} />
      )}
    </div>
  );
}

export type ProprietesAccessoire = { accessoire: AccessoireScene; lumiere?: string };

/**
 * Composition « CompositionAccessoire » (ancien nom « AvocatAccessoire ») : la boîte de l'accessoire seule, marge de flou comprise, fond transparent.
 * Taille : `tailleAccessoire` ; posée par FFmpeg à (gauche − m, haut − m) du cadre source, son bas à m sous le cadre.
 */
export function AccessoireSeul({ accessoire, lumiere }: ProprietesAccessoire) {
  const m = margeFlou(accessoire.flouPx);
  return (
    <AbsoluteFill>
      {/* La boîte descend jusqu'au bas de l'image (marge comprise) : le bas du cadre source tombe à `m` du bas. */}
      <div style={{ position: "absolute", left: m, top: m, right: m, bottom: 0 }}>
        <ContenuAccessoire accessoire={accessoire} flouPx={accessoire.flouPx} lumiere={lumiere} prolongementBasPx={m} />
      </div>
    </AbsoluteFill>
  );
}

