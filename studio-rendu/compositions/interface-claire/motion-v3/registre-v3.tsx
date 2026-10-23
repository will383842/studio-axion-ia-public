import React from "react";
import { staticFile } from "remotion";
import type { ElementV3Plan, PlanFacecamAnimee } from "../../../../src/domaine/facecam-animee/plan";
import { ArcheBas } from "./lotB/ArcheBas";
import { BandeVideo } from "./lotB/BandeVideo";
import { CercleEpaule } from "./lotB/CercleEpaule";
import { PiluleCote } from "./lotB/PiluleCote";
import { FenetreDouble } from "./lotA/FenetreDouble";
import { FenetrePivot } from "./lotA/FenetrePivot";
import { FenetrePleinCadre } from "./lotA/FenetrePleinCadre";
import { FenetreTelephone } from "./lotA/FenetreTelephone";
import { CarteRetournee } from "./lotC/CarteRetournee";
import { CartePreuve } from "./lotC/CartePreuve";
import { CarteVerre, descentePrise } from "./lotC/CarteVerre";
import { NotificationsVerre } from "./lotC/NotificationsVerre";
import { WidgetChiffre } from "./lotC/WidgetChiffre";
import { CitationVerre } from "./lotD/CitationVerre";
import { MotDerriere } from "./lotD/MotDerriere";
import { MotSaute } from "./lotD/MotSaute";
import { MotVerticalBord } from "./lotD/MotVerticalBord";
import { RafaleTroisMots } from "./lotD/RafaleTroisMots";
import { DalleClaqueeV3 } from "./lotE/DalleClaqueeV3";
import { DuelVideo } from "./lotE/DuelVideo";
import { EclatChiffreV3 } from "./lotE/EclatChiffreV3";
import { MosaiqueVideos } from "./lotE/MosaiqueVideos";
import { MotFenetre } from "./lotE/MotFenetre";

/**
 * REGISTRE DES ÉLÉMENTS V3 pour le rendu final (`VideoAnimee`) : associe l'id d'une fiche du catalogue
 * (`src/moteurs/montage-facecam-animee/realisateur/catalogue-v3.ts`) au composant Remotion, et traduit un `ElementV3Plan` (secondes,
 * mots dits, clés de vidéos) en props du composant (images à 30 i/s depuis le début de l'élément, chemins `staticFile`).
 * Les 23 ids y sont ; seuls les éléments `actif` du catalogue sont choisis par le réalisateur.
 *
 * - Les BRUITAGES ne sont PAS joués par les composants (`avecSons: false`) : `bruitagesDuPlan` les tire du catalogue vers `plan.sons`,
 *   que `VideoAnimee` joue (aucune musique).
 * - `medias` : chemins dans le dossier public du rendu (comme `fenetres[].media`). Les éléments du lot E lisent leurs vidéos dans
 *   `broll/` : on retire alors le préfixe `broll/` de la clé.
 * - `mot-derriere` : le détourage de Will (`masque`) n'est pas encore fourni par la chaîne ; sans lui, le mot passe AU-DESSUS de la tête.
 * - La position des sous-titres et la descente de la prise sous `carte-verre` sont recopiées de la fiche du catalogue (test d'égalité :
 *   `tests/facecam-animee/catalogue-v3.test.ts`) pour que le conteneur de rendu n'importe rien du dossier `src/` à l'exécution.
 */

export const FPS_V3 = 30;
/** Fin de l'élément + délai pendant lequel on continue de le rendre (sorties qui dépassent un peu `fin`). */
const QUEUE_SEC = 0.35;

export interface ContexteV3 {
  t: number;
  W: number;
  H: number;
  prise: PlanFacecamAnimee["prise"];
  /** URL du PNG de détourage de Will et nœud de la prise à reposer par-dessus (mot derrière la tête). */
  masque?: string;
  priseNode?: React.ReactNode;
}

type Rendu = (e: ElementV3Plan, c: ContexteV3) => React.ReactNode;

const base = (e: ElementV3Plan, c: ContexteV3) => ({ t: c.t, debut: e.debut, fin: e.fin, largeurImage: c.W, hauteurImage: c.H });
const mot = (e: ElementV3Plan, k = 0) => e.mots?.[k] ?? "";
const media = (e: ElementV3Plan, k = 0) => staticFile(e.medias?.[k] ?? e.medias?.[0] ?? "");
/** Nom de fichier dans `broll/` (lot E) : la clé du plan sans son dossier. */
const broll = (e: ElementV3Plan, k = 0) => (e.medias?.[k] ?? e.medias?.[0] ?? "").replace(/^broll\//, "");
const images = (e: ElementV3Plan, s: number) => Math.max(0, Math.round((s - e.debut) * FPS_V3));
const dureeImages = (e: ElementV3Plan) => Math.round((e.fin - e.debut) * FPS_V3);
const depuis = (e: ElementV3Plan) => e.depuisSec ?? 0;
/** Image où l'élément commence sa sortie : ses derniers `n` images. */
const sortieA = (e: ElementV3Plan, n = 10) => Math.max(20, dureeImages(e) - n);
const cote = (e: ElementV3Plan) => e.sens ?? "gauche";
const sensFenetre = (e: ElementV3Plan): 1 | -1 => (e.sens === "gauche" ? -1 : 1);
/** Les éléments à base `i` (images depuis le début) ne se rendent qu'à partir de leur début. */
const avec = (e: ElementV3Plan, c: ContexteV3, f: (i: number) => React.ReactNode) => (c.t < e.debut ? null : f((c.t - e.debut) * FPS_V3));

export const RENDUS_V3: Readonly<Record<string, Rendu>> = Object.freeze({
  /* Lot A : fenêtres sur le visage */
  "fenetre-pivot": (e, c) => <FenetrePivot {...base(e, c)} src={media(e)} depuisSec={depuis(e)} etiquette={mot(e)} sens={sensFenetre(e)} avecSons={false} />,
  "fenetre-telephone": (e, c) => <FenetreTelephone {...base(e, c)} src={media(e)} depuisSec={depuis(e)} etiquette={mot(e)} avecSons={false} />,
  "fenetre-double": (e, c) => <FenetreDouble {...base(e, c)} srcA={media(e, 0)} srcB={media(e, 1)} depuisSecA={depuis(e)} depuisSecB={depuis(e)} etiquetteA={mot(e, 0)} etiquetteB={mot(e, 1)} sens={sensFenetre(e)} avecSons={false} />,
  "fenetre-plein-cadre": (e, c) => <FenetrePleinCadre {...base(e, c)} src={media(e)} depuisSec={depuis(e)} etiquette={mot(e)} sens={sensFenetre(e)} avecSons={false} />,
  /* Lot B : formes vidéo */
  "pilule-cote": (e, c) => <PiluleCote {...base(e, c)} src={media(e)} etiquette={mot(e)} cote={cote(e)} />,
  "cercle-epaule": (e, c) => <CercleEpaule {...base(e, c)} src={media(e)} cote={e.sens === "gauche" ? "gauche" : "droite"} />,
  "bande-video": (e, c) => <BandeVideo {...base(e, c)} src={media(e)} etiquette={mot(e)} />,
  "arche-bas": (e, c) => <ArcheBas {...base(e, c)} src={media(e)} etiquette={mot(e)} cote={e.sens === "gauche" ? "gauche" : "droite"} />,
  /* Lot C : cartes en verre (images depuis le début de l'élément) */
  "carte-verre": (e, c) => avec(e, c, (i) => <CarteVerre i={i} W={c.W} H={c.H} titre={mot(e)} lignes={(e.lignes ?? []).map((l) => ({ texte: l.texte, icone: l.icone, a: images(e, l.a) }))} sortieA={sortieA(e, 12)} />),
  "carte-preuve": (e, c) => avec(e, c, (i) => <CartePreuve i={i} W={c.W} H={c.H} titrePage={mot(e)} capture={e.medias?.[0] ? media(e) : undefined} sortieA={sortieA(e, 10)} clicA={Math.round(dureeImages(e) * 0.45)} />),
  "notifications-verre": (e, c) => avec(e, c, (i) => <NotificationsVerre i={i} W={c.W} H={c.H} bulles={(e.lignes ?? []).map((l) => ({ message: l.texte, icone: l.icone ?? "coche", a: images(e, l.a) }))} sortieA={sortieA(e, 12)} />),
  "widget-chiffre": (e, c) => avec(e, c, (i) => <WidgetChiffre i={i} W={c.W} H={c.H} nombre={e.nombre} unite={mot(e, 0) || undefined} precision={mot(e, 1) || undefined} sortieA={sortieA(e, 10)} />),
  "carte-retournee": (e, c) => avec(e, c, (i) => <CarteRetournee i={i} W={c.W} H={c.H} recto={{ lignes: [mot(e, 0)], icone: "loupe" }} verso={{ lignes: [mot(e, 1)], icone: "coche" }} basculeA={Math.round(dureeImages(e) * 0.45)} sortieA={sortieA(e, 10)} />),
  /* Lot D : typographie vivante */
  "mot-vertical-bord": (e, c) => <MotVerticalBord {...base(e, c)} mot={mot(e)} cote={cote(e)} />,
  "mot-saute": (e, c) => <MotSaute {...base(e, c)} mot={mot(e)} prise={{ yeux: c.prise.yeux ?? 0.34, centreX: c.prise.centreX ?? 0.5, largeurVisage: c.prise.largeurVisage ?? 0.38 }} />,
  "mot-derriere": (e, c) => <MotDerriere {...base(e, c)} mot={mot(e)} masque={c.masque} priseNode={c.priseNode} />,
  "rafale-trois-mots": (e, c) => (
    <RafaleTroisMots {...base(e, c)} mots={[mot(e, 0), mot(e, 1), mot(e, 2)]} {...(e.instants?.length === 2 ? { tMots: [e.instants[0], e.instants[1]] as const } : {})} prise={{ yeux: c.prise.yeux ?? 0.34, centreX: c.prise.centreX ?? 0.5, largeurVisage: c.prise.largeurVisage ?? 0.38 }} />
  ),
  "citation-verre": (e, c) => <CitationVerre {...base(e, c)} lignes={e.mots ?? []} />,
  /* Lot E : coups de poing */
  "duel-video": (e, c) => <DuelVideo {...base(e, c)} motA={mot(e, 0)} motB={mot(e, 1)} videoA={broll(e, 0)} videoB={broll(e, 1)} verdict={e.verdict} />,
  "dalle-claquee": (e, c) => <DalleClaqueeV3 {...base(e, c)} mot={mot(e)} />,
  "eclat-chiffre": (e, c) => <EclatChiffreV3 {...base(e, c)} valeur={e.nombre ?? 0} unite={mot(e) || undefined} />,
  "mot-fenetre": (e, c) => <MotFenetre {...base(e, c)} mot={mot(e)} video={broll(e)} />,
  "mosaique-videos": (e, c) => <MosaiqueVideos {...base(e, c)} videos={Array.from({ length: 6 }, (_, k) => broll(e, k % Math.max(1, e.medias?.length ?? 1)))} motFort={mot(e)} />,
});

export const IDS_V3 = Object.freeze(Object.keys(RENDUS_V3));

/** Élément à l'écran à l'instant `t` (de son début à sa fin + la queue de sa sortie). */
export const enCoursV3 = (e: ElementV3Plan, t: number) => t >= e.debut - 0.05 && t < e.fin + QUEUE_SEC;

/** Rend un élément v3 (rien si l'id est inconnu). */
export function rendreElementV3(e: ElementV3Plan, c: ContexteV3): React.ReactNode {
  const rendu = RENDUS_V3[e.id];
  return rendu ? rendu(e, c) : null;
}

/* ---------------- Mise en page : sous-titres et descente de la prise ---------------- */

/**
 * Hauteur du centre des sous-titres (fraction de H) pendant chaque élément, recopiée de `catalogue-v3.ts` (`sousTitresY`) ; `null` :
 * sous-titres masqués. Par défaut (aucun élément) : la mise en page de `cadrage.ts`.
 */
export const SOUS_TITRES_Y_V3: Readonly<Record<string, number | null>> = Object.freeze({
  "fenetre-pivot": 0.8, "fenetre-telephone": 0.835, "fenetre-double": 0.075, "fenetre-plein-cadre": null,
  "pilule-cote": 0.075, "cercle-epaule": 0.075, "bande-video": 0.075, "arche-bas": 0.075,
  "carte-verre": 0.865, "carte-preuve": 0.775, "notifications-verre": 0.625, "widget-chiffre": 0.625, "carte-retournee": 0.625,
  "mot-vertical-bord": 0.66, "mot-saute": 0.66, "mot-derriere": 0.66, "rafale-trois-mots": null, "citation-verre": 0.66,
  "duel-video": null, "dalle-claquee": null, "eclat-chiffre": null, "mot-fenetre": null, "mosaique-videos": null,
});

/** Position des sous-titres imposée par l'élément v3 à l'écran à `t` : `undefined` = pas d'élément (mise en page habituelle), `null` = masqués. */
export function sousTitresYV3(elements: readonly ElementV3Plan[] | undefined, t: number): number | null | undefined {
  const e = (elements ?? []).find((x) => t >= x.debut && t < x.fin);
  return e ? (SOUS_TITRES_Y_V3[e.id] ?? undefined) : undefined;
}

/** Descente de la prise (fraction de H) sous `carte-verre` à l'instant `t` (descente permise par Will ; 0 sans carte). */
export function descentePriseV3(elements: readonly ElementV3Plan[] | undefined, t: number): number {
  let d = 0;
  for (const e of elements ?? []) {
    if (e.id !== "carte-verre" || t < e.debut || t > e.fin + 0.5) continue;
    d = Math.max(d, descentePrise((t - e.debut) * FPS_V3, sortieA(e, 12)));
  }
  return d;
}
