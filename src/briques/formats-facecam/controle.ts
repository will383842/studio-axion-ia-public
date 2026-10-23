/**
 * CONTRÔLE MACHINE PAR FORMAT (lot F1). PUR, avant toute relecture : rien de coupé, rien sous l'interface du réseau.
 *  - visage : yeux à 30-38 % de la hauteur, ovale entier dans l'image (front et menton compris), jamais sous les marges
 *    sûres des côtés ; pendant un écran partagé, visage entier dans SA partie, yeux à 30-50 % de sa partie (haut / bas)
 *    ou visage à 35-45 % de sa colonne (côte à côte) ;
 *  - sous-titres : la ligne entière dans la zone sûre, jamais sur la bouche ni, à la jonction, sur le visage ; côte à
 *    côte, dans la colonne de Will ;
 *  - cartes : entières dans l'image, jamais sur le visage (écran partagé).
 * Chaque écart devient une alerte lisible (jamais bloquante : la vidéo sort, l'écart est montré).
 */
import type { AlerteQualite } from "@/domaine/types";
import { CADRAGE_FORMATS, visagePx, type PlanFormat } from "./cadrage";
import { dispositionEcranPartage, rectanglesEcranPartage, VISAGE_COLONNE, versImageFinale, type PlacementPersonne } from "./ecran-partage";
import { DIMENSIONS_FACECAM, type RatioFacecam } from "./ratios";
import { hauteurLettrePx } from "./sous-titres";
import { contenuDans, rectangleSur, seRecouvrent, zoneSure, type RectanglePx } from "./zones";

export type TypeDefautFormat =
  | "yeux-hors-bande"
  | "visage-coupe"
  | "visage-sous-interface"
  | "visage-hors-partie"
  | "visage-colonne"
  | "sous-titres-hors-zone"
  | "sous-titres-sur-visage"
  | "sous-titres-hors-colonne"
  | "carte-hors-image"
  | "carte-sur-visage";

export interface DefautFormat {
  type: TypeDefautFormat;
  debutSec: number;
  finSec: number;
  message: string;
}

export interface PassageControle {
  debutSec: number;
  finSec: number;
  placement: PlacementPersonne;
}

export interface EntreeControleFormat {
  ratio: RatioFacecam;
  plans: PlanFormat[];
  /** Ligne des sous-titres : centre (%) hors écran partagé ; absente : pas de sous-titres. */
  sousTitres?: { centrePct: number; jonctions?: { debutSec: number; finSec: number; centrePct: number; colonne?: { gauchePx: number; largeurPx: number } }[] };
  ecransPartages?: PassageControle[];
  /** Cartes plein écran (Will n'est pas à l'image : rien à contrôler pour lui). */
  cartesPleinEcran?: { debutSec: number; finSec: number }[];
}

export interface ControleFormat {
  ratio: RatioFacecam;
  ok: boolean;
  defauts: DefautFormat[];
  alertes: AlerteQualite[];
}

const chevauche = (a: { debutSec: number; finSec: number }, b: { debutSec: number; finSec: number }) => Math.min(a.finSec, b.finSec) - Math.max(a.debutSec, b.debutSec) > 1e-3;
const pct = (x: number) => `${Math.round(x * 100)} %`;

/** Ovale du visage d'un plan, avec l'air des cheveux au-dessus du front (px de l'image pré-cadrée). */
function tete(p: PlanFormat): RectanglePx {
  const v = visagePx(p);
  const cheveux = v.hauteur * 0.12;
  return { x: v.x, y: v.y - cheveux, largeur: v.largeur, hauteur: v.hauteur + cheveux };
}

export function controlerFormat(e: EntreeControleFormat): ControleFormat {
  const { largeur: W, hauteur: H } = DIMENSIONS_FACECAM[e.ratio];
  const image: RectanglePx = { x: 0, y: 0, largeur: W, hauteur: H };
  const zone = zoneSure(e.ratio);
  const sur = rectangleSur(e.ratio, zone);
  const defauts: DefautFormat[] = [];
  const noter = (type: TypeDefautFormat, b: { debutSec: number; finSec: number }, message: string) => defauts.push({ type, debutSec: b.debutSec, finSec: b.finSec, message });
  const partage = (b: { debutSec: number; finSec: number }) => e.ecransPartages?.find((p) => chevauche(p, b));
  const pleinEcran = (b: { debutSec: number; finSec: number }) => e.cartesPleinEcran?.some((c) => c.debutSec <= b.debutSec + 1e-3 && c.finSec >= b.finSec - 1e-3);
  const demiLigne = 0.6 * hauteurLettrePx(e.ratio);
  const rects = rectanglesEcranPartage(e.ratio);
  const d = dispositionEcranPartage(e.ratio);

  for (const p of e.plans) {
    if (pleinEcran(p)) continue;
    const v = visagePx(p);
    const t = tete(p);
    const ep = partage(p);
    if (!ep) {
      if (p.yeuxHauteur < CADRAGE_FORMATS.yeux.min - 5e-3 || p.yeuxHauteur > CADRAGE_FORMATS.yeux.max + 5e-3) noter("yeux-hors-bande", p, `Yeux à ${pct(p.yeuxHauteur)} de la hauteur (30 à 38 % attendus).`);
      if (!contenuDans(t, image)) noter("visage-coupe", p, "Le visage touche le bord de l'image.");
      else if (t.x < sur.x - 1 || t.x + t.largeur > sur.x + sur.largeur + 1) noter("visage-sous-interface", p, "Le visage passe sous l'interface du réseau, sur le côté.");
    } else {
      // Écran partagé : le visage, une fois la personne placée, reste entier dans sa partie.
      const coin = versImageFinale(e.ratio, ep.placement, { x: t.x, y: t.y });
      const place: RectanglePx = { x: coin.x, y: coin.y, largeur: t.largeur, hauteur: t.hauteur };
      if (!contenuDans(place, rects.personne)) noter("visage-hors-partie", p, "Pendant l'écran partagé, le visage sort de sa partie.");
      if (seRecouvrent(place, rects.carte)) noter("carte-sur-visage", p, "La carte recouvre le visage.");
      if (d.type === "haut") {
        const yeux = versImageFinale(e.ratio, ep.placement, { x: v.yeuxX, y: v.yeuxY });
        const r = (yeux.y - d.hauteurCarte) / d.hauteurPersonne;
        if (r < 0.3 - 5e-3 || r > 0.5 + 5e-3) noter("yeux-hors-bande", p, `Pendant l'écran partagé, yeux à ${pct(r)} de la partie de Will.`);
      } else {
        const yeux = versImageFinale(e.ratio, ep.placement, { x: v.yeuxX, y: v.yeuxY });
        const depuisExterieur = (W - yeux.x) / d.largeurPersonne;
        if (depuisExterieur < VISAGE_COLONNE[0] - 0.02 || depuisExterieur > VISAGE_COLONNE[1] + 0.02) noter("visage-colonne", p, `Visage à ${pct(depuisExterieur)} de sa colonne (35 à 45 % attendus).`);
        if (p.yeuxHauteur < CADRAGE_FORMATS.yeux.min - 5e-3 || p.yeuxHauteur > CADRAGE_FORMATS.yeux.max + 5e-3) noter("yeux-hors-bande", p, `Yeux à ${pct(p.yeuxHauteur)} de la hauteur (30 à 38 % attendus).`);
      }
    }

    // Sous-titres.
    if (!e.sousTitres) continue;
    const jonction = e.sousTitres.jonctions?.find((j) => chevauche(j, p));
    const centre = ((jonction?.centrePct ?? e.sousTitres.centrePct) / 100) * H;
    const ligne: RectanglePx = jonction?.colonne
      ? { x: jonction.colonne.gauchePx, y: centre - demiLigne, largeur: jonction.colonne.largeurPx, hauteur: 2 * demiLigne }
      : { x: sur.x, y: centre - demiLigne, largeur: sur.largeur, hauteur: 2 * demiLigne };
    if (ligne.y < sur.y - 1 || ligne.y + ligne.hauteur > sur.y + sur.hauteur + 1) noter("sous-titres-hors-zone", p, "La ligne des sous-titres entre dans la zone de l'interface du réseau.");
    if (jonction?.colonne && !contenuDans(ligne, rects.personne)) noter("sous-titres-hors-colonne", p, "La ligne des sous-titres déborde de la colonne de Will.");
    if (ep && d.type === "haut") {
      // À la jonction : jamais sur le visage placé en bas.
      const coin = versImageFinale(e.ratio, ep.placement, { x: t.x, y: t.y });
      if (ligne.y + ligne.hauteur > coin.y + 1 && ligne.y < coin.y + t.hauteur) noter("sous-titres-sur-visage", p, "À la jonction, la ligne des sous-titres touche le visage.");
    } else {
      // Sous la bouche, jamais dessus (16:9 côte à côte compris : même hauteur d'image).
      const bouche = v.yeuxY + CADRAGE_FORMATS.boucheSousYeux * v.hauteur;
      if (ligne.y < bouche) noter("sous-titres-sur-visage", p, "La ligne des sous-titres couvre la bouche.");
    }
  }

  // Cartes des écrans partagés : entières dans l'image.
  for (const ep of e.ecransPartages ?? []) if (!contenuDans(rects.carte, image)) noter("carte-hors-image", ep, "La carte sort de l'image.");

  const alertes: AlerteQualite[] = regrouper(defauts).map((x) => ({
    code: x.type.startsWith("sous-titres") ? "debordement-sous-titres" : x.type === "visage-sous-interface" || x.type === "sous-titres-hors-zone" ? "zone-protegee" : "defaut-visuel",
    gravite: x.type === "visage-coupe" || x.type === "carte-sur-visage" || x.type === "sous-titres-sur-visage" || x.type === "visage-hors-partie" ? "attention" : "info",
    message: `${e.ratio} : ${x.message}${x.nombre > 1 ? ` (${x.nombre} plans)` : ""}`,
  }));
  return { ratio: e.ratio, ok: defauts.length === 0, defauts, alertes };
}

/** Une alerte par type de défaut (avec le nombre de plans), pour ne pas noyer Will. */
function regrouper(defauts: DefautFormat[]): (DefautFormat & { nombre: number })[] {
  const parType = new Map<TypeDefautFormat, DefautFormat & { nombre: number }>();
  for (const x of defauts) {
    const deja = parType.get(x.type);
    if (deja) deja.nombre++;
    else parType.set(x.type, { ...x, nombre: 1 });
  }
  return [...parType.values()];
}
