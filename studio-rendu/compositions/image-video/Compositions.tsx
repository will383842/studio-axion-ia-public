import React from "react";
/**
 * Compositions du format « Image → vidéo » : `ImageVideoScene` (une séquence continue sur la toile, pilotée par ses
 * propriétés), `ImageVideoGalerie` (la même scène sur l'image C du jeu d'essai, pour juger à l'image sans rien
 * payer), `ImageVideoGalerieD/E/F` (objets de L8 : entonnoir, nuée, écran partagé, additionneur) et les galeries des
 * composants L9a (`ImageVideoGalerieA`, `…B`, `…Objets` : un composant par moment), et pour le rendu RÉEL des versions
 * `ImageVideoObjets` et `ImageVideoMoments` (mêmes composants, sans témoin des sous-titres), et `ImageVideoEcranFin` (le
 * dernier écran v4 d'une version, trait de fin par-dessus). Toutes dessinent le trait de fin (`QueueFin`) quand le bloc
 * finit la vidéo (`queue` de leurs propriétés). Inscrites dans `Racine.tsx` (lot L17). Rien ne se calcule au chargement du module : aucun JSX ni
 * calcul au niveau module (le rendu de prod pose `React` après le chargement des compositions).
 */
import { useMemo } from "react";
import { AbsoluteFill, Composition, useCurrentFrame } from "remotion";
import { cameraA, type AvecVarieteIV, type ProprietesSceneIV } from "../../../src/briques/schema-motion";
import type { AvecQueueIV } from "../../../src/briques/schema-motion/queue-fin";
import { imagesEcran, type ProprietesEcran } from "../../../src/briques/ecrans-motion";
import { exempleEcran } from "../cas-concret/exemples";
import { Ecran } from "../cas-concret/Ecran";
import { chargerPoliceAnton, chargerPoliceTitre } from "../commune/polices";
import { FondIV } from "./variete/fond/FondVarie";
import { Camera } from "./Camera";
import { sceneGalerieC } from "./donnees-galerie";
import { SCENES_GALERIE_OBJETS } from "./donnees-galerie-objets";
import { Additionneur } from "./Additionneur";
import { EcranPartage } from "./EcranPartage";
import { Entonnoir } from "./Entonnoir";
import { Nuee } from "./Nuee";
import { Alerte } from "./Alerte";
import { BandeauChiffres } from "./BandeauChiffres";
import { Benefices, Paperboard, RecapBenefices } from "./CarteBenefice";
import { galerieA, galerieB, galerieObjets, type MomentGalerie, type ProprietesGalerieIV } from "./donnees-galerie-l9a";
import { Dossiers } from "./Dossiers";
import { EmailStructure } from "./EmailStructure";
import { Ensemble } from "./Ensemble";
import { EnteteVarie } from "./variete/entete/EnteteVarie";
import { PhraseChoc } from "./PhraseChoc";
import { Affiche } from "./Affiche";
import { QueueFin } from "./QueueFin";
import type { AvecAfficheIV } from "./variete/ouverture/donnees";
import { decalageReferenceIV } from "./mise-en-page";
import { calculerScene, enteteA, ensembleA, fondSceneA, masqueSchemaMuet, masqueToile, opaciteRail, placeRail } from "./plan";
import { objetsA, planEnsemble, secousseAlerte, type ObjetSceneIV, type ProprietesSceneObjetsIV } from "./plan-objets";
import { Recherche } from "./Recherche";
import { RepereChapitre } from "./RepereChapitre";
import { Sources } from "./Sources";
import { TemoinSousTitres } from "./TemoinSousTitres";
import { SchemaMuet, Toile } from "./Toile";
import { RailVarie } from "./variete/rail/RailVarie";
import { COMPOSITION_VARIETE_IV, metaVarieteIV, proprietesVarieteDefaut, SceneVarieteIV } from "./variete/CompositionVariete";
import { recadrage } from "./variete/camera/calque";
import { donneesToile } from "./variete/camera/donnees";
import { ContexteVariete } from "./variete/ContexteVariete";
import { HabillageVariete } from "./variete/HabillageVariete";

/** Identifiants des compositions du format. */
export const COMPOSITIONS_IMAGE_VIDEO = Object.freeze({
  scene: "ImageVideoScene",
  galerie: "ImageVideoGalerie",
  galerieD: "ImageVideoGalerieD",
  galerieE: "ImageVideoGalerieE",
  galerieF: "ImageVideoGalerieF",
  galerieA: "ImageVideoGalerieA",
  galerieB: "ImageVideoGalerieB",
  galerieObjets: "ImageVideoGalerieObjets",
  // Production (rendu réel des versions) : les mêmes composants que les galeries, SANS témoin des sous-titres (les vrais
  // sous-titres sont posés par la composition finale, sur la voix).
  objets: "ImageVideoObjets",
  moments: "ImageVideoMoments",
  variete: COMPOSITION_VARIETE_IV,
  ecranFin: "ImageVideoEcranFin",
});

/** Propriétés du dernier écran v4 d'une version : celles de `CasConcretEcran`, et la queue du bloc. */
export type ProprietesEcranFinIV = ProprietesEcran & AvecQueueIV & AvecAfficheIV;

/**
 * `ImageVideoEcranFin` : le DERNIER écran v4 d'une version qui a une queue animée. L'écran est celui du cas concret
 * (`Ecran`, mêmes propriétés, inchangé) ; le trait de fin (`QueueFin`) se dessine par-dessus pendant la queue, pour que
 * l'image ne reste pas figée après la dernière parole (Q24).
 */
export function EcranFinIV(p: ProprietesEcranFinIV) {
  const t = useCurrentFrame() / p.fps;
  return (
    <AbsoluteFill>
      <Ecran {...p} />
      <QueueFin queue={p.queue} t={t} largeur={p.largeur} hauteur={p.hauteur} />
      <Affiche affiche={p.affiche} largeur={p.largeur} hauteur={p.hauteur} />
    </AbsoluteFill>
  );
}

/** Dernier écran v4 : taille, cadence et durée comme `CasConcretEcran` (`finMs − debutMs`). */
export const metaEcranFinIV = ({ props }: { props: ProprietesEcranFinIV }) => ({ width: props.largeur, height: props.hauteur, fps: props.fps, durationInFrames: imagesEcran(props) });

/** Taille, cadence et durée lues dans les propriétés. */
export const metaSceneIV = ({ props }: { props: ProprietesSceneIV }) => ({
  width: props.largeur,
  height: props.hauteur,
  fps: props.fps,
  durationInFrames: Math.max(1, Math.round(props.dureeSec * props.fps)),
});

/**
 * Lot G · CAM-C pose ses « cartes en attente » sous les sous-titres (`variete/camera/point.tsx`, `CartesEnAttente`) :
 * même condition qu'elle (nœud dont on parle, suivants pas encore dits, hors vue d'ensemble). Le rail lui cède alors la place.
 */
function cartesEnAttenteCamC(scene: ReturnType<typeof calculerScene>, ensembles: { debut: number; fin: number }[], t: number): boolean {
  if (ensembles.some((e) => t >= e.debut - 0.3 && t < e.fin + 0.2)) return false;
  const dits = scene.mots.filter((m) => m.t - 0.15 <= t);
  const courant = dits.length ? dits[dits.length - 1].noeud : null;
  return !!courant && scene.toile.fleches.some((f) => f.de === courant && (scene.premierMot.get(f.vers) ?? Infinity) - 0.15 > t && scene.parId.has(f.vers));
}

export function SceneImageVideo(p: ProprietesSceneIV & AvecVarieteIV & AvecQueueIV & AvecAfficheIV) {
  chargerPoliceAnton();
  chargerPoliceTitre();
  const t = useCurrentFrame() / p.fps;
  const scene = useMemo(() => calculerScene(p), [p]);
  // Pendant une vue d'ensemble la ligne de temps déclare le plan IVOIRE (sous-titres à l'encre sombre) : on peint ivoire aussi.
  const fondVu = fondSceneA(p, t);
  const entete = enteteA(p, t);
  const ensemble = ensembleA(p, scene, t);
  // Calcul léger, refait à chaque image comme `ensembleA` : le schéma lisible dans la zone utile (sous l'en-tête).
  const vue = ensemble ? planEnsemble(p.schema, { allumes: ensemble.options.allumes, chiffresCles: ensemble.options.chiffresCles }) : null;
  const fonduToile = ensemble ? 1 - ensemble.fondu : 1;
  // Sous l'en-tête, la toile s'efface en douceur : un nœud vu reste deviné, jamais mêlé au titre ; en bas, avant les sous-titres.
  const masque = masqueToile(p.hauteur, !!entete);
  // Lot G : le reste du schéma en cartes muettes (sans texte), visible dès le bas de l'en-tête ; au-dessus de la toile,
  // les cartes déjà dites en silhouette ; le rail des cartes suivantes (9:16 : sous les sous-titres, il reste pendant la
  // vue d'ensemble ; 4:5 : au-dessus d'eux, s'il a la place).
  const muetFuturs = masqueSchemaMuet(p.hauteur, !!entete, "futurs")!;
  const muetDessus = masqueSchemaMuet(p.hauteur, !!entete, "dessus");
  const placeDuRail = placeRail(p.hauteur);
  const camC = donneesToile(p.variete?.donnees?.camera);
  const rail = camC?.code === "CAM-C" && cartesEnAttenteCamC(scene, camC.ensembles ?? [], t) ? 0 : opaciteRail(scene, p.hauteur, t, fonduToile);
  // Le calque caméra (CAM-B, CAM-C) recadre toute la scène ; le rail, fixe à l'écran, en reçoit l'inverse.
  const r = camC ? recadrage(cameraA(scene.trajectoire, t), cameraA({ images: camC.trajectoire }, t)) : { s: 1, tx: 0, ty: 0 };
  const echelle = p.largeur / 1080;
  const fixe = r.s === 1 && r.tx === 0 && r.ty === 0 ? "" : `translate(${(-r.tx * echelle) / r.s}px, ${(-r.ty * echelle) / r.s}px) scale(${1 / r.s}) `;
  // Place de master : après l'en-tête, dans la scène. Filmée par CAM-B ou CAM-C, la queue et l'affiche passent dans
  // `horsCamera` : le calque caméra les pose après la scène recadrée, jamais recadrées, et toujours sous la matière et les transitions.
  const finDeScene = (
    <>
      <QueueFin queue={p.queue} t={t} largeur={p.largeur} hauteur={p.hauteur} />
      <Affiche affiche={p.affiche} largeur={p.largeur} hauteur={p.hauteur} />
    </>
  );
  return (
    <ContexteVariete variete={p.variete} scene={scene} ensembles={p.ensembles}>
      <HabillageVariete horsCamera={camC ? finDeScene : undefined}>
        <AbsoluteFill>
          <FondIV fond={fondVu} largeur={p.largeur} hauteur={p.hauteur} />
          {fonduToile > 0 ? (
            <AbsoluteFill style={{ opacity: fonduToile, maskImage: muetFuturs, WebkitMaskImage: muetFuturs }}>
              <Camera trajectoire={scene.trajectoire} t={t} largeur={p.largeur}>
                <SchemaMuet scene={scene} schema={p.schema} t={t} fond={fondVu} mode="futurs" />
              </Camera>
            </AbsoluteFill>
          ) : null}
          {fonduToile > 0 && muetDessus ? (
            <AbsoluteFill style={{ opacity: fonduToile, maskImage: muetDessus, WebkitMaskImage: muetDessus }}>
              <Camera trajectoire={scene.trajectoire} t={t} largeur={p.largeur}>
                <SchemaMuet scene={scene} schema={p.schema} t={t} fond={fondVu} mode="dits" />
              </Camera>
            </AbsoluteFill>
          ) : null}
          {fonduToile > 0 ? (
            <AbsoluteFill style={{ opacity: fonduToile, maskImage: masque, WebkitMaskImage: masque }}>
              <Camera trajectoire={scene.trajectoire} t={t} largeur={p.largeur}>
                <Toile scene={scene} schema={p.schema} t={t} dejaVus={(p as { dejaVus?: string[] }).dejaVus} />
              </Camera>
            </AbsoluteFill>
          ) : null}
          <AbsoluteFill style={{ transform: `${fixe}scale(${echelle})`, transformOrigin: "0 0" }}>
            <RailVarie scene={scene} schema={p.schema} t={t} fond={fondVu} place={placeDuRail} opacite={rail} />
          </AbsoluteFill>
          {ensemble && vue ? (
            <AbsoluteFill style={{ transform: `${decalageReferenceIV(p.hauteur)} scale(${p.largeur / 1080})`, transformOrigin: "0 0" }}>
              <Ensemble plan={vue} schema={p.schema} ecoule={ensemble.ecoule} fondu={ensemble.fondu} />
            </AbsoluteFill>
          ) : null}
          {/* CAM-B, CAM-C : le calque caméra repose la marque et l'en-tête, fixes, au-dessus de la scène recadrée (jamais deux titres). */}
          {camC ? null : <EnteteVarie entete={entete?.entete ?? null} ecoule={entete?.ecoule ?? 0} sortie={entete?.sortie ?? 0} fond={fondVu} marque={p.marque} largeur={p.largeur} hauteur={p.hauteur} />}
          {camC ? null : finDeScene}
        </AbsoluteFill>
      </HabillageVariete>
    </ContexteVariete>
  );
}

/** Témoin des sous-titres d'une galerie : le titre de l'en-tête en cours (les vrais sous-titres viennent de la voix). */
function TemoinEntete({ p, t }: { p: Pick<ProprietesSceneIV, "entetes" | "fond" | "largeur">; t: number }) {
  const e = enteteA(p, t);
  if (!e) return null;
  return (
    <AbsoluteFill style={{ transform: `scale(${p.largeur / 1080})`, transformOrigin: "0 0", width: 1080, height: 1920 }}>
      <TemoinSousTitres texte={e.entete.titre} fond={p.fond} />
    </AbsoluteFill>
  );
}

/** La scène de l'image C pour la GALERIE : la même scène, avec le témoin des sous-titres. */
export function SceneGalerieImageVideo(p: ProprietesSceneIV) {
  const t = useCurrentFrame() / p.fps;
  return (
    <AbsoluteFill>
      <SceneImageVideo {...p} />
      <TemoinEntete p={p} t={t} />
    </AbsoluteFill>
  );
}

/** Taille, cadence et durée d'une scène d'objets (L8). */
export const metaSceneObjetsIV = ({ props }: { props: ProprietesSceneObjetsIV }) => ({
  width: props.largeur,
  height: props.hauteur,
  fps: props.fps,
  durationInFrames: Math.max(1, Math.round(props.dureeSec * props.fps)),
});

/** Un objet de L8 à l'instant `t` (pixels de l'écran de référence). */
function ObjetIV({ objet, t, fond }: { objet: ObjetSceneIV; t: number; fond: ProprietesSceneObjetsIV["fond"] }) {
  if (objet.sorte === "entonnoir") return <Entonnoir {...objet.proprietes} t={t} fond={fond} />;
  if (objet.sorte === "nuee") return <Nuee {...objet.proprietes} t={t} fond={fond} />;
  if (objet.sorte === "ecran-partage") return <EcranPartage {...objet.proprietes} t={t} />;
  return <Additionneur {...objet.proprietes} t={t} fond={fond} />;
}

/** Scène d'objets (L8) : fond v4, objets de l'instant en fondu, en-tête et marque comme la scène de toile. */
export function SceneObjetsImageVideo(p: ProprietesSceneObjetsIV) {
  return <CorpsSceneObjets p={p} temoin />;
}

/** Scène d'objets de production : la même, sans témoin des sous-titres. */
export function SceneObjetsProductionIV(p: ProprietesSceneObjetsIV & AvecQueueIV & AvecAfficheIV) {
  return <CorpsSceneObjets p={p} temoin={false} />;
}

function CorpsSceneObjets({ p, temoin }: { p: ProprietesSceneObjetsIV & AvecVarieteIV & AvecQueueIV & AvecAfficheIV; temoin: boolean }) {
  chargerPoliceAnton();
  chargerPoliceTitre();
  const t = useCurrentFrame() / p.fps;
  const entete = enteteA(p, t);
  return (
    <ContexteVariete variete={p.variete}>
      <HabillageVariete>
        <AbsoluteFill>
          <FondIV fond={p.fond} largeur={p.largeur} hauteur={p.hauteur} />
          <AbsoluteFill style={{ transform: `${decalageReferenceIV(p.hauteur)} scale(${p.largeur / 1080})`, transformOrigin: "0 0" }}>
            {objetsA(p, t).map(({ objet, opacite }, i) => (
              <AbsoluteFill key={`${objet.sorte}-${i}`} style={{ opacity: opacite }}>
                <ObjetIV objet={objet} t={t} fond={p.fond} />
              </AbsoluteFill>
            ))}
          </AbsoluteFill>
          <EnteteVarie entete={entete?.entete ?? null} ecoule={entete?.ecoule ?? 0} sortie={entete?.sortie ?? 0} fond={p.fond} marque={p.marque} largeur={p.largeur} hauteur={p.hauteur} />
          {temoin ? <TemoinEntete p={p} t={t} /> : null}
          <QueueFin queue={p.queue} t={t} largeur={p.largeur} hauteur={p.hauteur} />
          <Affiche affiche={p.affiche} largeur={p.largeur} hauteur={p.hauteur} />
        </AbsoluteFill>
      </HabillageVariete>
    </ContexteVariete>
  );
}

/** Durée d'une galerie L9a lue dans ses propriétés. */
export const metaGalerieIV = ({ props }: { props: ProprietesGalerieIV }) => ({
  width: props.largeur,
  height: props.hauteur,
  fps: props.fps,
  durationInFrames: Math.max(1, Math.round(props.dureeSec * props.fps)),
});

/** Le composant L9a d'un moment, à l'instant `t` (pixels de l'écran de référence). */
function ObjetDuMoment({ m, t, hauteur }: { m: MomentGalerie; t: number; hauteur: number }) {
  switch (m.sorte) {
    case "paperboard":
      return <Paperboard etapes={m.etapes} t={t} debut={m.debut + 0.2} fond={m.fond} />;
    case "benefices":
      return <Benefices benefices={m.benefices} heures={m.heures} t={t} fond={m.fond} />;
    case "recap":
      return <RecapBenefices benefices={m.benefices} t={t} debut={m.debut + 0.3} fond={m.fond} />;
    case "bandeau":
      return <BandeauChiffres chiffres={m.chiffres} t={t} etiquette={m.etiquette} />;
    case "recherche":
      return <Recherche requete={m.requete} debut={m.frappe} mots={m.mots} trouve={m.trouve} t={t} fond={m.fond} />;
    case "alerte":
      return <Alerte source={m.source} moment={m.moment} message={m.message} t0={m.t0} frappe={m.frappe} declencheurs={m.declencheurs} tampon={m.tampon} t={t} />;
    case "email":
      return <EmailStructure champs={m.champs} debut={m.debut + 0.2} tampon={m.tampon} t={t} fond={m.fond} />;
    case "dossiers":
      return <Dossiers dossiers={m.dossiers} debut={m.debut + 0.2} t={t} fond={m.fond} />;
    case "sources":
      return <Sources sources={m.sources} cible={m.cible} t={t} fond={m.fond} />;
    case "phrase-choc":
      return <PhraseChoc phrase={m.phrase} debut={m.debut + 0.3} heures={m.heures} t={t} hauteur={hauteur} />;
    case "ensemble":
      return <EnsembleDuMoment m={m} t={t} />;
  }
}

function EnsembleDuMoment({ m, t }: { m: Extract<MomentGalerie, { sorte: "ensemble" }>; t: number }) {
  const plan = planEnsemble(m.schema, m.options);
  return <Ensemble plan={plan} schema={m.schema} ecoule={t - m.debut} fondu={1} />;
}

/** Galerie L9a : un composant par moment, sur son fond, avec son en-tête et le repère de progression. */
export function GalerieImageVideo(p: ProprietesGalerieIV) {
  return <CorpsMoments p={p} temoin />;
}

/** Moments de production : la galerie sans témoin des sous-titres. */
export function MomentsProductionIV(p: ProprietesGalerieIV & AvecQueueIV & AvecAfficheIV) {
  return <CorpsMoments p={p} temoin={false} />;
}

function CorpsMoments({ p, temoin }: { p: ProprietesGalerieIV & AvecVarieteIV & AvecQueueIV & AvecAfficheIV; temoin: boolean }) {
  chargerPoliceAnton();
  chargerPoliceTitre();
  const t = useCurrentFrame() / p.fps;
  const m = p.moments.find((x) => t >= x.debut && t < x.fin) ?? p.moments[p.moments.length - 1];
  const secousse = m.sorte === "alerte" ? secousseAlerte(t, m.t0) : { x: 0, y: 0 };
  const entete = m.entete ? { ...m.entete, debut: m.debut, fin: m.fin } : null;
  const echelle = p.largeur / 1080;
  return (
    <ContexteVariete variete={p.variete}>
      <HabillageVariete>
        <AbsoluteFill>
          <FondIV fond={m.fond} largeur={p.largeur} hauteur={p.hauteur} />
          {/* Seul le contenu tremble à l'arrivée d'une alerte : le fond reste, aucun bord découvert. */}
          <AbsoluteFill style={{ transform: `${decalageReferenceIV(p.hauteur)} translate(${secousse.x * echelle}px, ${secousse.y * echelle}px) scale(${echelle})`, transformOrigin: "0 0", width: 1080, height: 1920 }}>
            <ObjetDuMoment m={m} t={t} hauteur={p.hauteur} />
            {p.repere ? <RepereChapitre changements={p.repere.changements} total={p.repere.total} prefixe={p.repere.prefixe} t={t} fond={m.fond} /> : null}
            {temoin && (m.sousTitre ?? m.entete?.titre) ? <TemoinSousTitres texte={(m.sousTitre ?? m.entete?.titre)!} fond={m.fond} /> : null}
          </AbsoluteFill>
          <EnteteVarie entete={entete} ecoule={t - m.debut} sortie={entete ? Math.max(0, Math.min(1, (t - (m.fin - 0.15)) / 0.15)) : 0} fond={m.fond} marque={p.marque} largeur={p.largeur} hauteur={p.hauteur} />
          <QueueFin queue={p.queue} t={t} largeur={p.largeur} hauteur={p.hauteur} />
          <Affiche affiche={p.affiche} largeur={p.largeur} hauteur={p.hauteur} />
        </AbsoluteFill>
      </HabillageVariete>
    </ContexteVariete>
  );
}

export function CompositionsImageVideo() {
  const galerie = sceneGalerieC();
  const meta = metaSceneIV({ props: galerie });
  const galeries = [
    { id: COMPOSITIONS_IMAGE_VIDEO.galerieA, props: galerieA() },
    { id: COMPOSITIONS_IMAGE_VIDEO.galerieB, props: galerieB() },
    { id: COMPOSITIONS_IMAGE_VIDEO.galerieObjets, props: galerieObjets() },
  ];
  // Propriétés par défaut des compositions de production : celles des galeries (les vraies arrivent par la demande).
  const objetsDefaut = SCENES_GALERIE_OBJETS.D();
  const metaObjets = metaSceneObjetsIV({ props: objetsDefaut });
  // Sans repère : le « 1/3 » de la galerie ne doit jamais se mêler à un vrai bloc qui n'en a pas.
  const momentsDefaut: ProprietesGalerieIV = { ...galerieObjets(), repere: null };
  const metaMoments = metaGalerieIV({ props: momentsDefaut });
  const varieteDefaut = proprietesVarieteDefaut();
  const metaVariete = metaVarieteIV({ props: varieteDefaut });
  // Dernier écran v4 : l'exemple du cas concret, sans queue (les vraies propriétés arrivent par la demande).
  const ecranFinDefaut: ProprietesEcranFinIV = { ...exempleEcran("accroche"), queue: null };
  const metaEcranFin = metaEcranFinIV({ props: ecranFinDefaut });
  return (
    <>
      <Composition
        id={COMPOSITIONS_IMAGE_VIDEO.scene}
        component={SceneImageVideo}
        durationInFrames={meta.durationInFrames}
        fps={meta.fps}
        width={meta.width}
        height={meta.height}
        defaultProps={galerie}
        calculateMetadata={metaSceneIV}
      />
      <Composition
        id={COMPOSITIONS_IMAGE_VIDEO.galerie}
        component={SceneGalerieImageVideo}
        durationInFrames={meta.durationInFrames}
        fps={meta.fps}
        width={meta.width}
        height={meta.height}
        defaultProps={galerie}
        calculateMetadata={metaSceneIV}
      />
      {(["D", "E", "F"] as const).map((image) => {
        const props = SCENES_GALERIE_OBJETS[image]();
        const m = metaSceneObjetsIV({ props });
        return (
          <Composition
            key={image}
            id={COMPOSITIONS_IMAGE_VIDEO[`galerie${image}`]}
            component={SceneObjetsImageVideo}
            durationInFrames={m.durationInFrames}
            fps={m.fps}
            width={m.width}
            height={m.height}
            defaultProps={props}
            calculateMetadata={metaSceneObjetsIV}
          />
        );
      })}
      <Composition
        id={COMPOSITIONS_IMAGE_VIDEO.objets}
        component={SceneObjetsProductionIV}
        durationInFrames={metaObjets.durationInFrames}
        fps={metaObjets.fps}
        width={metaObjets.width}
        height={metaObjets.height}
        defaultProps={objetsDefaut}
        calculateMetadata={metaSceneObjetsIV}
      />
      <Composition
        id={COMPOSITIONS_IMAGE_VIDEO.moments}
        component={MomentsProductionIV}
        durationInFrames={metaMoments.durationInFrames}
        fps={metaMoments.fps}
        width={metaMoments.width}
        height={metaMoments.height}
        defaultProps={momentsDefaut}
        calculateMetadata={metaGalerieIV}
      />
      <Composition
        id={COMPOSITIONS_IMAGE_VIDEO.variete}
        component={SceneVarieteIV}
        durationInFrames={metaVariete.durationInFrames}
        fps={metaVariete.fps}
        width={metaVariete.width}
        height={metaVariete.height}
        defaultProps={varieteDefaut}
        calculateMetadata={metaVarieteIV}
      />
      <Composition
        id={COMPOSITIONS_IMAGE_VIDEO.ecranFin}
        component={EcranFinIV}
        durationInFrames={metaEcranFin.durationInFrames}
        fps={metaEcranFin.fps}
        width={metaEcranFin.width}
        height={metaEcranFin.height}
        defaultProps={ecranFinDefaut}
        calculateMetadata={metaEcranFinIV}
      />
      {galeries.map((g) => {
        const mg = metaGalerieIV({ props: g.props });
        return (
          <Composition
            key={g.id}
            id={g.id}
            component={GalerieImageVideo}
            durationInFrames={mg.durationInFrames}
            fps={mg.fps}
            width={mg.width}
            height={mg.height}
            defaultProps={g.props}
            calculateMetadata={metaGalerieIV}
          />
        );
      })}
    </>
  );
}
