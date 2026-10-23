import { Composition } from "remotion";
import { Essai } from "./Essai";
import { ApercuSousTitres, CalqueSousTitres, type ProprietesApercu, type ProprietesCalque } from "./sous-titres";
import { AccessoireSeul, DoubleEssai, ImageComposee, Miniature, TexteCompose, type ProprietesAccessoire, type ProprietesDoubleEssai } from "./commune";
import { formatMiniature, type ProprietesMiniature } from "./commune/miniature-mise-en-page";
import { VignetteAxion } from "./commune/vignette/VignetteAxion";
import { metaVignette } from "./commune/vignette/socle";
import type { ProprietesVignetteAxion } from "./commune/vignette/VignetteAxion";
import { CompositionsMotion } from "./commune/motion";
import { CompositionsEffets } from "./commune/effets";
import { CompositionsTableau } from "./tableau/Compositions";
import { CompositionsCasConcret } from "./cas-concret/Compositions";
import { CompositionsInterfaceClaire } from "./interface-claire/Compositions";
import { CompositionsImageVideo } from "./image-video/Compositions";
import { CompositionsVisuels } from "./visuels/Compositions";
import { tailleAccessoire, type ProprietesImageComposition, type ProprietesTexteComposition } from "../../src/briques/composition/scene";

/** Données vides : les vraies arrivent par les propriétés de la demande de rendu. */
const CALQUE_VIDE: ProprietesCalque = {
  donnees: {
    largeur: 1080,
    hauteur: 1920,
    segments: [],
    base: "karaoke",
    couleurs: { texte: "#F3EDE4", accent: "#E07040", contour: "#16120F" },
    largeurMaxPx: 691,
    positions: { milieuPct: 48, hautPct: 19, basPct: 65, poitrinePct: 51 },
  },
};

/** Durée du calque : jusqu'au dernier groupe (au moins une image). */
const dureeCalque = ({ props }: { props: ProprietesCalque }) => ({
  durationInFrames: Math.max(1, Math.ceil((props.donnees.segments.at(-1)?.finSec ?? 0) * 25) + 1),
});

/** Propriétés vides de la composition : les vraies arrivent par la demande de rendu (taille et durée comprises). */
const IMAGE_VIDE: ProprietesImageComposition = {
  ratio: "9:16",
  largeur: 1080,
  hauteur: 1920,
  fps: 25,
  images: 25,
  decor: { teinte: "#110A05", directionLumiere: "face", flouPx: 0, clair: false },
  doubles: { principal: { type: "silhouette", tenue: "#1E2128", peau: "#C4967A" } },
  plans: [],
};
const TEXTE_VIDE: ProprietesTexteComposition = { ratio: "9:16", largeur: 1080, hauteur: 1920, fps: 25, images: 25, incrustations: [] };
const DOUBLE_VIDE: ProprietesDoubleEssai = { tenue: "#1E2128", peau: "#C4967A", images: 25 };
const ACCESSOIRE_VIDE: ProprietesAccessoire = { accessoire: { x: 0.78, y: 0.3, largeurPct: 22, flouPx: 3 } };
const MINIATURE_VIDE: ProprietesMiniature = { ratio: "9:16", image: "", couverture: "", variante: "bas" };
const VIGNETTE_VIDE: ProprietesVignetteAxion = { ratio: "9:16", couverture: "" };

/** Taille, cadence et durée lues dans les propriétés (une composition par format d'image). */
const metaComposition = <P extends { largeur: number; hauteur: number; fps: number; images: number }>({ props }: { props: P }) => ({
  width: props.largeur,
  height: props.hauteur,
  fps: props.fps,
  durationInFrames: Math.max(1, props.images),
});

/** Calques texte (lot M4b) : une image par instant DIFFÉRENT quand `instants` est donné, sinon une par image. */
const metaTexte = ({ props }: { props: ProprietesTexteComposition }) => ({ ...metaComposition({ props }), durationInFrames: Math.max(1, props.instants?.length ?? props.images) });

/** Compositions inscrites. Lot M1b : la composition d'essai ; M2 : les sous-titres ; M4 : le montage (commun depuis le 02/10). */
export function Racine() {
  return (
    <>
      <Composition id="Essai" component={Essai} durationInFrames={75} fps={25} width={1080} height={1920} defaultProps={{ titre: "Studio Axion-IA" }} />
      <Composition id="SousTitres" component={CalqueSousTitres} durationInFrames={1} fps={25} width={1080} height={1920} defaultProps={CALQUE_VIDE} calculateMetadata={dureeCalque} />
      <Composition
        id="ApercuSousTitres"
        component={ApercuSousTitres}
        durationInFrames={1}
        fps={25}
        width={1080}
        height={1920}
        defaultProps={{ ...CALQUE_VIDE, fond: { couleur: "#000000" } } satisfies ProprietesApercu}
      />
      {/* Brique commune « composition » (02/10) : calques image, texte, accessoire seul — pour tous les formats. */}
      <Composition id="CompositionImage" component={ImageComposee} durationInFrames={25} fps={25} width={1080} height={1920} defaultProps={IMAGE_VIDE} calculateMetadata={metaComposition} />
      <Composition id="CompositionTexte" component={TexteCompose} durationInFrames={25} fps={25} width={1080} height={1920} defaultProps={TEXTE_VIDE} calculateMetadata={metaTexte} />
      <Composition
        id="CompositionAccessoire"
        component={AccessoireSeul}
        durationInFrames={1}
        fps={25}
        width={240}
        height={1400}
        defaultProps={ACCESSOIRE_VIDE}
        calculateMetadata={({ props }) => {
          const t = tailleAccessoire(props.accessoire);
          return { width: t.largeur, height: t.hauteur };
        }}
      />
      {/* Anciens noms (lot M4, montage avocat), gardés : mêmes composants. */}
      <Composition id="AvocatImage" component={ImageComposee} durationInFrames={25} fps={25} width={1080} height={1920} defaultProps={IMAGE_VIDE} calculateMetadata={metaComposition} />
      <Composition id="AvocatTexte" component={TexteCompose} durationInFrames={25} fps={25} width={1080} height={1920} defaultProps={TEXTE_VIDE} calculateMetadata={metaTexte} />
      <Composition
        id="AvocatAccessoire"
        component={AccessoireSeul}
        durationInFrames={1}
        fps={25}
        width={240}
        height={1400}
        defaultProps={ACCESSOIRE_VIDE}
        calculateMetadata={({ props }) => {
          const t = tailleAccessoire(props.accessoire);
          return { width: t.largeur, height: t.hauteur };
        }}
      />
      <Composition
        id="DoubleEssai"
        component={DoubleEssai}
        durationInFrames={25}
        fps={25}
        width={1080}
        height={1920}
        defaultProps={DOUBLE_VIDE}
        calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, props.images) })}
      />
      {/* Lot R4 : miniature réelle (une image ; 1080 × 1920, ou 1280 × 720 en 16:9). */}
      <Composition
        id="Miniature"
        component={Miniature}
        durationInFrames={1}
        fps={25}
        width={1080}
        height={1920}
        defaultProps={MINIATURE_VIDE}
        calculateMetadata={({ props }) => {
          const f = formatMiniature(props.ratio);
          return { width: f.largeur, height: f.hauteur };
        }}
      />
      {/* Vignettes lot 1 (17/10) : socle v2, derrière le réglage `miniature.gabarit` (éteint). */}
      <Composition id="VignetteAxion" component={VignetteAxion} durationInFrames={1} fps={25} width={1080} height={1920} defaultProps={VIGNETTE_VIDE} calculateMetadata={({ props }) => metaVignette(props)} />
      {/* Facecam lot C (09/10) : brique commune `motion` — 6 modèles et la carte sur mesure, pour tous les formats. */}
      <CompositionsMotion />
      {/* Facecam lot F3 : effets spéciaux à la demande (objet 3D dans la main, vitre, pli, zoom traversant). */}
      <CompositionsEffets />
      <CompositionsTableau />
      <CompositionsCasConcret />
      {/* Face caméra animé, style « interface claire » (14/10) : générateur indépendant, dossier `interface-claire/`. */}
      <CompositionsInterfaceClaire />
      <CompositionsImageVideo />
      <CompositionsVisuels />
    </>
  );
}
