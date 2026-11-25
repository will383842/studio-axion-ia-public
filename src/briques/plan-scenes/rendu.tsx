/**
 * RENDU D'UN PLAN DE SCÈNES (lot C) — PUR (aucun hook, aucun Remotion, aucun Zod) : `ImagePlan` dessine l'image n° `image`
 * d'un plan validé. La composition Remotion `PlanDeScenes` (`studio-rendu/compositions/plan-scenes/`) ne fait que lui
 * passer `useCurrentFrame()`. Même plan + même image = même rendu.
 */
import type { CSSProperties, ReactNode } from "react";
import { adoucir, couleursSur, entre, FAMILLE_CSS_AXION, msEnImages, progression } from "../jetons-motion";
import type { PlanHabille } from "../motion/habillage-commun/types";
import { IDS_TRANSITIONS_COMMUNES, TRANSITIONS_COMMUNES, type IdTransitionCommune } from "../motion/habillage-commun/transitions";
import { cheminAuTemps, choisirRaccordForme, DUREE_RACCORD_IMAGES } from "../motion/habillage-commun/raccord-forme";
import { RENDUS_BRIQUES, transformZoom } from "./briques";
import type { IdPiece } from "./catalogue";
import type { Calque, PlanValide, SceneValide } from "./schema";
import { TOILES } from "./toiles";
import { SOUS_ZONES, ZONES, type Rectangle, type Transition } from "./zones";

/** FIX-OBJETS-CC-PLACE-v21u : champ posé seulement par `reserverZoneObjets` (cas concret) : la boîte, en px de l'image, où se posent les pièces `objet-*` (sous les textes). Absent : rendu inchangé. */
export type PlanZoneObjets = PlanValide & { zoneObjets?: Rectangle };

export function dureeImagesPlan(plan: Pick<PlanValide, "dureeMs" | "format">): number {
  return Math.max(1, Math.ceil((plan.dureeMs * plan.format.fps) / 1000));
}

export function sceneActive(plan: PlanValide, image: number): SceneValide | undefined {
  const ms = (image * 1000) / plan.format.fps;
  return plan.scenes.find((s) => ms >= s.debutMs && ms < s.finMs);
}

function enPx(r: Rectangle, largeur: number, hauteur: number): Rectangle {
  return { x: (r.x / 100) * largeur, y: (r.y / 100) * hauteur, largeur: (r.largeur / 100) * largeur, hauteur: (r.hauteur / 100) * hauteur };
}

/** Effet d'une transition à l'avancement `t` (0 : invisible, 1 : en place). Doux, sans dépassement. */
export function effet(transition: Transition, t: number): CSSProperties {
  const r = (n: number) => Math.round(n * 100) / 100;
  switch (transition) {
    case "glisse-haut":
      return { opacity: r(t), transform: `translateY(${r(entre(40, 0, t))}px)` };
    case "glisse-gauche":
      return { opacity: r(t), transform: `translateX(${r(entre(60, 0, t))}px)` };
    case "zoom-doux":
      return { opacity: r(t), transform: `scale(${r(entre(0.94, 1, t))})` };
    default:
      return { opacity: r(t) };
  }
}

/** Une pièce à l'échelle de sa boîte (toile centrée, proportions gardées). */
function Piece({ piece, parametres, boite, image, dureeImages, plan, enfants }: { piece: IdPiece; parametres: unknown; boite: Rectangle; image: number; dureeImages: number; plan: PlanValide; enfants?: ReactNode }) {
  const toile = TOILES[piece];
  const echelle = Math.min(boite.largeur / toile.largeur, boite.hauteur / toile.hauteur);
  const Rendu = RENDUS_BRIQUES[piece];
  return (
    <div style={{ position: "absolute", left: boite.x, top: boite.y, width: boite.largeur, height: boite.hauteur }}>
      <div style={{ position: "absolute", left: (boite.largeur - toile.largeur * echelle) / 2, top: (boite.hauteur - toile.hauteur * echelle) / 2, width: toile.largeur, height: toile.hauteur, transform: `scale(${Math.round(echelle * 10000) / 10000})`, transformOrigin: "0 0" }}>
        <Rendu image={image} fps={plan.format.fps} dureeImages={dureeImages} fond={plan.habillage.fond} accent={plan.habillage.accent} parametres={parametres as never} enfants={enfants} />
      </div>
    </div>
  );
}

function Calques({ calques, boite, image, dureeImages, plan }: { calques: Calque[]; boite: Rectangle; image: number; dureeImages: number; plan: PlanValide }) {
  const zoom = calques.find((c) => c.piece === "zoom-camera");
  const autres = calques.filter((c) => c !== zoom);
  const contenu = autres.map((c, i) => {
    const depart = msEnImages(c.debutMs, plan.format.fps);
    if (image < depart) return null;
    const sz = SOUS_ZONES[c.zone];
    const b = { x: (sz.x / 100) * boite.largeur, y: (sz.y / 100) * boite.hauteur, largeur: (sz.largeur / 100) * boite.largeur, hauteur: (sz.hauteur / 100) * boite.hauteur };
    return <Piece key={i} piece={c.piece} parametres={c.parametres} boite={b} image={image - depart} dureeImages={Math.max(1, dureeImages - depart)} plan={plan} />;
  });
  const z = zoom ? transformZoom(zoom.parametres as never, image - msEnImages(zoom.debutMs, plan.format.fps), dureeImages) : {};
  return (
    <div style={{ position: "absolute", left: boite.x, top: boite.y, width: boite.largeur, height: boite.hauteur, ...z }}>
      {contenu}
    </div>
  );
}

function Scene({ scene, plan, image }: { scene: SceneValide; plan: PlanValide; image: number }) {
  const { largeur, hauteur, fps } = plan.format;
  const debut = msEnImages(scene.debutMs, fps);
  const duree = Math.max(1, msEnImages(scene.finMs, fps) - debut);
  const local = image - debut;
  const dT = Math.max(1, msEnImages(scene.transition.dureeMs, fps));
  const tEntree = progression(local, 0, dT, adoucir);
  const tSortie = 1 - progression(local, duree - dT, dT, adoucir);
  // C6-H3 : champ posé seulement par C6-H4, derrière `habillage.transitionsPlanScenes` (éteint). `TRANSITIONS` de `zones.ts:9` n'est jamais allongé.
  const habillageCommun = (plan as PlanHabille).habillageCommun;
  const boiteTransition = { largeur: ZONES[scene.position].largeur * largeur / 100, hauteur: ZONES[scene.position].hauteur * hauteur / 100 };
  const commune = (sens: "entree" | "sortie", t: number): CSSProperties | null => {
    const id = habillageCommun?.transitions?.[scene.id]?.[sens];
    if (!id || !(IDS_TRANSITIONS_COMMUNES as readonly string[]).includes(id)) return null;
    const def = TRANSITIONS_COMMUNES[id as IdTransitionCommune];
    if (def.emprise === "plein-cadre" && habillageCommun?.pleinCadrePermis !== true) return null;
    return def.style(t, sens, boiteTransition);
  };
  const style = tEntree < 1 ? (commune("entree", tEntree) ?? effet(scene.transition.entree, tEntree)) : tSortie < 1 ? (commune("sortie", tSortie) ?? effet(scene.transition.sortie, tSortie)) : {};
  const zoneObjets = (plan as PlanZoneObjets).zoneObjets;
  const boite = zoneObjets && scene.niveau === 1 && scene.piece.startsWith("objet-") ? zoneObjets : enPx(ZONES[scene.position], largeur, hauteur);
  const etiquette = scene.texte && scene.piece !== "legende" && scene.position !== "haut" && scene.position !== "plein";
  // BR-RACCORD-FORME-a : forme pleine tracée SOUS le contenu pendant 14 images, effacée sur les 4 dernières ; jamais avec visage.
  const paire = habillageCommun?.raccords?.[scene.id];
  const raccord = paire && local >= 0 && local < DUREE_RACCORD_IMAGES ? choisirRaccordForme({ de: paire.de, vers: paire.vers, avecVisage: plan.facecam === true, boite: { largeur: boite.largeur, hauteur: boite.hauteur } }) : null;
  const opaciteRaccord = Math.round(Math.min(1, Math.max(0, (DUREE_RACCORD_IMAGES - 1 - local) / 4)) * 100) / 100;
  return (
    <div style={{ position: "absolute", inset: 0, ...style }}>
      {raccord && (
        <svg data-raccord-forme="1" style={{ position: "absolute", left: boite.x, top: boite.y, width: boite.largeur, height: boite.hauteur }} viewBox={`0 0 ${boite.largeur} ${boite.hauteur}`}>
          <path d={cheminAuTemps(raccord, local / (DUREE_RACCORD_IMAGES - 1))} fill={raccord.couleur} opacity={opaciteRaccord} />
        </svg>
      )}
      {scene.niveau === 2 && scene.calques?.length ? (
        <Calques calques={scene.calques} boite={boite} image={local} dureeImages={duree} plan={plan} />
      ) : (
        <Piece piece={scene.piece} parametres={scene.parametres} boite={boite} image={local} dureeImages={duree} plan={plan} />
      )}
      {etiquette && <Piece piece="legende" parametres={{ texte: scene.texte!, sousTexte: "", style: "etiquette" }} boite={enPx(ZONES.haut, largeur, hauteur)} image={local} dureeImages={duree} plan={plan} />}
    </div>
  );
}

/** Image n° `image` du plan : fond de la charte (transparent en face caméra, la vidéo passe dessous) + scène active. */
export function ImagePlan({ plan, image }: { plan: PlanValide; image: number }) {
  const c = couleursSur(plan.habillage.fond, plan.habillage.accent);
  const scene = sceneActive(plan, image);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", width: plan.format.largeur, height: plan.format.hauteur, background: plan.facecam ? "transparent" : c.fond, fontFamily: FAMILLE_CSS_AXION }}>
      {scene && <Scene key={scene.id} scene={scene} plan={plan} image={image} />}
    </div>
  );
}
