import React from "react";
/** Axe 8 · Fins (FIN-A référence, FIN-B, FIN-C, FIN-D), image C du chatbot. */
import { useCurrentFrame } from "remotion";
import { AbsoluteFill } from "../socle";
import { GalerieImageVideo } from "../../../../../../studio-rendu/compositions/image-video/Compositions";
import { galerieObjets } from "../../../../../../studio-rendu/compositions/image-video/donnees-galerie-l9a";
import { a, ANTON, C, DixBarres, Ecran, Horloge, Lueur, SousTitre, T } from "./objets";
import { MiniSchema, OuvC1, TableDeNuit } from "./ouvertures";

/* FIN-A · aujourd'hui : la phrase-choc seule, mot par mot, sur fond sombre (vraie composition, image ≈ 14,6 s). */
export const FinA1 = () => <GalerieImageVideo {...galerieObjets()} />;

/* FIN-B · tout le schéma, puis la phrase (le schéma réel de l'image C, icônes des nœuds, sans texte parasite) */
/** Image 1 : recul sur le schéma complet, figé, sous le titre « Tout le circuit. ». */
export function FinB1() {
  return (
    <Ecran fond="ivoire" titre={{ etiquette: "Vue d'ensemble", titre: "Tout le *circuit.*" }}>
      <div style={{ position: "absolute", inset: 0, transform: "translate(95px, 253px) scale(0.8)", transformOrigin: "0 0" }}>
        <MiniSchema alerteGrande={false} />
      </div>
      <SousTitre texte="Voilà tout le *circuit.*" fond="ivoire" />
    </Ecran>
  );
}

/** Image 2 : le schéma figé s'est rangé en haut à droite ; la phrase-choc arrive dessous, mot par mot (ici complète). */
export function FinB2() {
  return (
    <Ecran fond="ivoire">
      {/* le schéma reste figé, au même endroit, et pâlit derrière la phrase */}
      <div style={{ position: "absolute", inset: 0, transform: "translate(95px, 253px) scale(0.8)", transformOrigin: "0 0", opacity: 0.11, filter: "grayscale(1)" }}>
        <MiniSchema alerteGrande={false} />
      </div>
      <div style={{ position: "absolute", left: 72, top: 400, ...ANTON, color: C.encre }}>
        <div style={{ fontSize: 100, lineHeight: 1.06 }}>Votre client a</div>
        <div style={{ fontSize: 100, lineHeight: 1.06 }}>toujours une</div>
        <div style={{ fontSize: 100, lineHeight: 1.06 }}>réponse.</div>
        <div style={{ fontSize: 180, lineHeight: 1.0, marginTop: 36 }}>
          Même à <span style={{ color: C.orange }}>3h</span>
        </div>
        <div style={{ fontSize: 180, lineHeight: 1.0 }}>du matin.</div>
      </div>
      <SousTitre texte="Même à *3h* du matin." fond="ivoire" />
    </Ecran>
  );
}

/* FIN-C · boucle : la dernière image reprend la première (même horloge, même place) */
/** Dernière image : même cadrage que OUV-C-1 (horloge, chiffre, téléphone sur la table de nuit). L'horloge marque 3h,
 * l'aiguille repart (trace) vers 23h14 : la vidéo peut se relancer. Le téléphone a répondu (coche). La voix dit « Même à
 * 3h du matin » ; l'écran montre ce qu'elle ne dit pas : 24h/24. */
export function FinC1() {
  return (
    <Ecran fond="sombre">
      <Lueur x={540} y={640} r={600} o={0.7} />
      <Horloge cx={540} cy={640} r={296} h={3} m={0} traceHeure={150} />
      <T x={130} y={974} largeur={820} align="center" taille={170} couleur={C.ivoire}>24h/24</T>
      <TableDeNuit repondu />
      <SousTitre texte="Même à *3h* du matin." fond="sombre" />
    </Ecran>
  );
}
/** Première image (la même que OUV-C-1) : la boucle se referme. */
export const FinC2 = OuvC1;

/** Planche de la boucle : dernière image → première image, côte à côte, flèche de relance. */
export function FinC3() {
  const e = 0.6;
  const cadre = (x: number, Comp: React.FC) => (
    <div style={{ position: "absolute", left: x, top: 170, width: 1080 * e, height: 1920 * e, borderRadius: 30, overflow: "hidden", boxShadow: `0 30px 80px ${a(C.nuit, 0.12)}` }}>
      <div style={{ width: 1080, height: 1920, transform: `scale(${e})`, transformOrigin: "0 0", position: "relative" }}>
        <Comp />
      </div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: C.ivoire }}>
      {cadre(40, FinC1)}
      {cadre(40 + 648 + 144, OuvC1)}
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1} fill="none" stroke={C.orange} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round">
        <path d="M600 150 C 640 60, 880 60, 920 140" />
        <path d="M886 112 L920 140 L942 100" />
        <path d="M940 1345 C 900 1405, 640 1405, 600 1345" strokeDasharray="2 26" opacity={0.6} />
      </svg>
      <T x={40} y={1340} largeur={648} align="center" taille={58} police="inter" couleur={C.encre}>Fin</T>
      <T x={832} y={1340} largeur={648} align="center" taille={58} police="inter" couleur={C.encre}>Début</T>
    </AbsoluteFill>
  );
}

/* FIN-D · le chiffre qui reste */
/** Les dix barres du résultat (8 pleines, 2 vides) : elles restent d'une image à l'autre, en appoint (y 1330 → 1480). */
export const BarresResultat = ({ y = 1320, h = 186 }: { y?: number; h?: number }) => <DixBarres x={72} y={y} l={936} h={h} plein={C.ivoire} vide={C.grisClair} />;

/** Image 1 : le chiffre-clé en grand (moment des résultats) ; en appoint, les dix barres. */
export function FinD1() {
  return (
    <Ecran fond="sombre">
      <Lueur x={540} y={640} r={620} o={0.7} />
      <div style={{ position: "absolute", left: 65, width: 821, top: 300, display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
        <span style={{ ...ANTON, fontSize: 580, color: C.orangeVif }}>80</span>
        <span style={{ ...ANTON, fontSize: 220, color: C.orangeVif, marginLeft: 12, marginTop: 48 }}>%</span>
      </div>
      <div style={{ position: "absolute", left: 300, top: 908, width: 480, height: 10, borderRadius: 5, background: a(C.ivoire, 0.5) }} />
      <T x={65} y={952} largeur={821} align="center" taille={92} couleur={C.ivoire}>Résolus tout de suite</T>
      <BarresResultat />
      <SousTitre texte="Sans vous réveiller." fond="sombre" />
    </Ecran>
  );
}

/** Phrase-choc v2, mot pour mot, bien interlignée ; le « 80 % » reste AU-DESSUS (jamais derrière le texte), séparé
 * par un filet. `y0` : haut du chiffre. `barres` : les dix barres en petit, à droite du chiffre (format 4:5).
 * Accents (RÉPONSE, MÊME, À) : ≥ 16 px sous la ligne du dessus. */
function PhraseEtChiffre({ y0, barres }: { y0: number; barres?: boolean }) {
  const l1 = 88, lh1 = 1.2;
  const l2 = 156, lh2 = 1.12;
  return (
    <>
      {/* v3 : le « 80 % » en ivoire plein (rapport 17,2), plus en gris clair atténué ; le seul mot orange reste « 3h ».
          La jauge garde partout le même dessin : 8 cases ivoire pleines puis 2 cases vides cerclées de gris clair. */}
      <div style={{ position: "absolute", left: 72, top: y0, ...ANTON, fontSize: 150, lineHeight: 1, color: C.ivoire, whiteSpace: "nowrap" }}>80 %</div>
      {barres ? <DixBarres x={472} y={y0 + 12} l={536} h={124} plein={C.ivoire} vide={C.grisClair} ecart={14} /> : null}
      <div style={{ position: "absolute", left: 72, top: y0 + 164, width: 936, height: 6, borderRadius: 3, background: a(C.grisClair, 0.7) }} />
      <div style={{ position: "absolute", left: 72, top: y0 + 188, ...ANTON, color: C.ivoire, whiteSpace: "nowrap" }}>
        <div style={{ fontSize: l1, lineHeight: lh1 }}>Votre client a</div>
        <div style={{ fontSize: l1, lineHeight: lh1 }}>toujours une</div>
        {/* v3 : 8 px d'air de plus au-dessus de « RÉPONSE » (accent à ≥ 16 px de la ligne du dessus), repris sur l'écart
            avant « MÊME À » (accent de MÊME encore à ≥ 16 px) : hauteur totale inchangée. */}
        <div style={{ fontSize: l1, lineHeight: lh1, marginTop: 8 }}>réponse.</div>
        <div style={{ fontSize: l2, lineHeight: lh2, marginTop: 22 }}>
          Même à <span style={{ color: C.orangeVif }}>3h</span>
        </div>
        <div style={{ fontSize: l2, lineHeight: lh2 }}>du matin.</div>
      </div>
    </>
  );
}

/** Image 2 : la phrase-choc arrive ; le chiffre est monté au-dessus et reste (gris clair) ; les barres restent en
 * appoint. Pas de témoin de sous-titres : la voix lit la phrase écrite (l'écran ne la dirait pas deux fois). */
export function FinD2() {
  return (
    <Ecran fond="sombre">
      <Lueur x={540} y={640} r={620} o={0.5} />
      {/* v3 : y0 = 266 (haut du « 80 % » à y ≈ 274, sous la zone cachée de 269 px). */}
      <PhraseEtChiffre y0={266} />
      <BarresResultat />
    </Ecran>
  );
}
export { PhraseEtChiffre };
void useCurrentFrame;
