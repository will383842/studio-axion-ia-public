/**
 * CONTRÔLES DES TROIS STYLES DU TABLEAU (16/10/2026, maquettes validées PR #280). PURS : ils lisent la mise en page et
 * le plan d'animation (`animation-3.ts`), jamais une image. Chacun répond à une règle des maquettes ou à un défaut de la
 * vidéo d'essai v-667edcd8e3a8 :
 *  - CONTRASTE : chaque texte ≥ 4,5:1 sur ce qui est sous lui (surface, post-it, carte, plaque, surligneur), à chaque
 *    image (le rendu n'écrit jamais un texte en transparence : il le révèle sous la pointe) ; chaque trait plein ≥ 3:1 ;
 *  - CHARTE : aucune couleur verte, bleue ou violette (texte, traits, objets) ;
 *  - BANDE LIBRE : ni texte, ni trait, ni objet, ni l'outil (pointe, corps et ombre) dans la bande des sous-titres ;
 *  - TEXTE NON COUPÉ : chaque ligne tient dans la zone sûre, au-dessus de la bande, à sa largeur mesurée ;
 *  - ENTRE DEUX PAGES : l'effacement dure ≤ 0,5 s et la nouvelle page arrive avec son contenu (jamais d'écran vide) ;
 *  - REMPLISSAGE : le contenu couvre 85 à 95 % de la hauteur utile ;
 *  - DOUBLONS : la phrase ne reprend pas le titre, « Avant » / « Maintenant » ne se répètent pas dans leur texte.
 */
import { planPage3 } from "@/briques/tableau-scene/reference/animation-3";
import type { ProprietesTableauScene } from "@/briques/tableau-scene/types";
import { boiteOutil, OUTIL_TABLEAU, reposOutil } from "@/briques/tableau-scene/trois-styles/outil";
import { etatOutil, type EtatOutil } from "@/briques/tableau-scene/trois-styles/pose-outil";
import type { Plan3 } from "@/briques/tableau-scene/reference/animation-3";
import { largeurTableau } from "@/briques/tableau-scene/trois-styles/mesure";
import { CHARTES_TABLEAU, contrasteTableau, horsCharteTableau, melangeTableau, type CharteTableau } from "@/briques/tableau-scene/trois-styles/styles";
import { cleMot } from "./fiche";
import type { MiseEnPageTableau, RectPx } from "./mise-en-page";
import { REMPLISSAGE_TABLEAU } from "./mise-en-page-tableau";

/** Durée de l'effacement entre deux pages (s) : celle du rendu (`PageTableau.tsx`). */
export const EFFACEMENT_TABLEAU_SEC = 0.42;
export const SEUILS_TABLEAU = Object.freeze({ texte: 4.5, trait: 3, effacementMax: 0.5 });

export interface ProblemeTableau {
  controle: "contraste" | "charte" | "bande" | "coupe" | "pages" | "remplissage" | "doublon" | "outil";
  page?: number;
  detail: string;
}

const dans = (r: RectPx, x: number, y: number) => x >= r.x && x <= r.x + r.largeur && y >= r.y && y <= r.y + r.hauteur;

/** Ce qui est sous un point de la page : la surface du style, ou le post-it, la carte, la plaque posés là. */
function fondSous(S: CharteTableau, objets: { x: number; y: number; l: number; h: number; c: string; sorte: string }[], x: number, y: number): string {
  const o = [...objets].reverse().find((b) => b.sorte !== "aimant" && b.sorte !== "ruban" && dans({ x: b.x, y: b.y, largeur: b.l, hauteur: b.h }, x, y));
  return o ? o.c : S.fond;
}

/** Contrôles statiques d'une mise en page (sans heures). */
export function controlerMiseEnPageTableau(mise: MiseEnPageTableau): ProblemeTableau[] {
  const res: ProblemeTableau[] = [];
  const t = mise.styleReference?.tableau;
  if (!t) return res;
  const S = CHARTES_TABLEAU[t.style];
  const bande = mise.bandeSousTitres.px;
  const zone = mise.zoneSure.px;
  const k = mise.styleReference!.k;
  for (const p of mise.pages) {
    const objets = p.elements.flatMap((e) => e.tableau?.objets ?? []);
    const surligneurs = p.elements.flatMap((e) => (e.tableau?.avant ?? []).filter((x) => x.g === "s"));
    for (const e of p.elements) {
      const tb = e.tableau;
      // Contraste et charte des textes.
      e.lignes.forEach((l, i) => {
        const m = tb?.lignes[i];
        if (!m) return;
        const cx = l.px.x + l.px.largeur / 2;
        const cy = l.px.y + l.px.hauteur / 2;
        let fond = e.gabarit?.sorte === "pastille" && t.style !== "ardoise" ? S.fondPostit : fondSous(S, objets, cx, cy);
        if (surligneurs.some((s) => { const ys = s.p.filter((_, j) => j % 2).reduce((a, b) => a + b, 0) / (s.p.length / 2); return Math.abs(ys - cy) < l.px.hauteur / 2 && s.p[0] < l.px.x + l.px.largeur && s.p[s.p.length - 2] > l.px.x; }))
          fond = melangeTableau(S.surligneur ?? S.moyen, fond, 0.5);
        const c = contrasteTableau(m.couleur, fond);
        if (c < SEUILS_TABLEAU.texte) res.push({ controle: "contraste", page: p.page, detail: `« ${l.texte} » : ${m.couleur} sur ${fond}, ${c.toFixed(2)}:1 (${SEUILS_TABLEAU.texte}:1 au moins).` });
        if (horsCharteTableau(m.couleur)) res.push({ controle: "charte", page: p.page, detail: `« ${l.texte} » est écrit en ${m.couleur}, hors charte (vert, bleu ou violet).` });
        // Texte non coupé : dans la zone sûre, au-dessus de la bande, à sa largeur mesurée.
        const w = largeurTableau(l.texte, m.police, m.taille);
        if (w > l.px.largeur + 2 * k) res.push({ controle: "coupe", page: p.page, detail: `« ${l.texte} » mesure ${Math.round(w)} px pour ${l.px.largeur} px posés.` });
        if (l.px.x < zone.x - 1 || l.px.x + Math.max(w, l.px.largeur) > zone.x + zone.largeur + 1) res.push({ controle: "coupe", page: p.page, detail: `« ${l.texte} » sort de la zone sûre (x ${l.px.x} à ${Math.round(l.px.x + w)}).` });
        if (l.px.y + l.px.hauteur > bande.y) res.push({ controle: "bande", page: p.page, detail: `« ${l.texte} » descend dans la bande des sous-titres (bas ${l.px.y + l.px.hauteur} > ${bande.y}).` });
      });
      // Traits : charte, contraste des traits pleins, bande.
      for (const tr of [...(tb?.avant ?? []), ...(tb?.apres ?? [])]) {
        if (horsCharteTableau(tr.c)) res.push({ controle: "charte", page: p.page, detail: `un trait de « ${e.elementId} » est en ${tr.c}, hors charte.` });
        const ys = tr.p.filter((_, j) => j % 2);
        if (Math.max(...ys) + tr.w / 2 > bande.y) res.push({ controle: "bande", page: p.page, detail: `un trait de « ${e.elementId} » descend dans la bande des sous-titres.` });
        if (!tr.g && (tr.a ?? 1) >= 0.8 && tr.w >= 4 * k) {
          const fond = fondSous(S, objets, tr.p[0], tr.p[1]);
          const c = contrasteTableau(melangeTableau(tr.c, fond, tr.a ?? 1), fond);
          if (c < SEUILS_TABLEAU.trait) res.push({ controle: "contraste", page: p.page, detail: `un trait plein de « ${e.elementId} » (${tr.c} sur ${fond}) : ${c.toFixed(2)}:1 (${SEUILS_TABLEAU.trait}:1 au moins).` });
        }
      }
      for (const o of tb?.objets ?? []) {
        if (horsCharteTableau(o.c)) res.push({ controle: "charte", page: p.page, detail: `l'objet « ${o.sorte} » de « ${e.elementId} » est en ${o.c}, hors charte.` });
        if (o.y + o.h > bande.y && o.sorte !== "ruban") res.push({ controle: "bande", page: p.page, detail: `l'objet « ${o.sorte} » de « ${e.elementId} » descend dans la bande des sous-titres.` });
      }
      if (e.encombrement.px.y + e.encombrement.px.hauteur > bande.y + 1) res.push({ controle: "bande", page: p.page, detail: `« ${e.elementId} » occupe la bande des sous-titres (bas ${e.encombrement.px.y + e.encombrement.px.hauteur} > ${bande.y}).` });
    }
    // Remplissage.
    const occ = p.occupation ?? 0;
    if (occ < REMPLISSAGE_TABLEAU.min - 1e-6 || occ > REMPLISSAGE_TABLEAU.max + 1e-6) res.push({ controle: "remplissage", page: p.page, detail: `le contenu couvre ${Math.round(occ * 100)} % de la hauteur utile (${REMPLISSAGE_TABLEAU.min * 100} à ${REMPLISSAGE_TABLEAU.max * 100} %).` });
    // Doublons : titre répété dans la phrase, étiquette répétée dans son texte.
    const titre = p.elements.find((e) => e.gabarit?.sorte === "titre");
    const motsDe = (s: string) => s.split(/\s+/).map(cleMot).filter(Boolean);
    if (titre) {
      const mt = motsDe(titre.lignes.map((l) => l.texte).join(" "));
      for (const e of p.elements) {
        if (e === titre || !e.lignes.length || e.gabarit?.sorte === "partie") continue;
        const me = motsDe(e.lignes.map((l) => l.texte).join(" "));
        if (me.length >= mt.length && mt.every((m, i) => me[i] === m)) res.push({ controle: "doublon", page: p.page, detail: `« ${e.lignes.map((l) => l.texte).join(" ")} » répète le titre « ${titre.lignes.map((l) => l.texte).join(" ")} ».` });
      }
    }
    for (const e of p.elements.filter((x) => x.elementId.endsWith("~etiquette"))) {
      const cible = p.elements.find((x) => x.elementId === e.elementId.replace(/~etiquette$/, ""));
      const et = motsDe(e.lignes[0]?.texte ?? "")[0];
      const autres = cible?.lignes.map((l) => motsDe(l.texte)[0]).filter(Boolean) ?? [];
      if (et && autres.includes(et)) res.push({ controle: "doublon", page: p.page, detail: `l'étiquette « ${e.lignes[0].texte} » est répétée dans son texte.` });
    }
  }
  return res;
}

/**
 * Contrôles animés des scènes d'une vidéo (propriétés de rendu) : entre deux pages (effacement court, jamais d'écran
 * vide), et l'outil (pointe aux points de ses tracés, corps et ombre) jamais dans la bande des sous-titres.
 */
export function controlerAnimationTableau(props: readonly ProprietesTableauScene[], options: { etat?: (plan: Plan3, t: number) => EtatOutil | null } = {}): ProblemeTableau[] {
  const etat = options.etat ?? etatOutil;
  const res: ProblemeTableau[] = [];
  if (EFFACEMENT_TABLEAU_SEC > SEUILS_TABLEAU.effacementMax) res.push({ controle: "pages", detail: `l'effacement dure ${EFFACEMENT_TABLEAU_SEC} s ; ${SEUILS_TABLEAU.effacementMax} s au plus.` });
  const vues = new Set<number>();
  for (const p of props) {
    const r = p.styleReference;
    const t = r?.tableau;
    if (!r || !t || vues.has(p.page.page)) continue;
    vues.add(p.page.page);
    const plan = planPage3(p.page, r, { largeur: p.largeur, hauteur: p.hauteur });
    const bande = p.bandeSousTitres.px;
    // Jamais d'écran vide : la page arrive avec son contenu (posé, révélé par la brosse), ou l'outil y écrit dans les 0,5 s.
    const premier = Math.min(...plan.actions.map((a) => a.debut));
    if (plan.debutPage > 0.01 && !plan.poses.size && premier - plan.debutPage > SEUILS_TABLEAU.effacementMax + 0.08) res.push({ controle: "pages", page: p.page.page, detail: `la page ${p.page.page} reste vide ${(premier - plan.debutPage).toFixed(2)} s après l'effacement.` });
    // L'outil : aux points de chacun de ses tracés, et au repos.
    const pointes = [...plan.actions.filter((a) => !a.fondu && !a.sansCrayon).flatMap((a) => [a.points[0], a.points[a.points.length - 1]]), { x: reposOutil(t, r.k)[0], y: reposOutil(t, r.k)[1] }];
    // L'outil ne reste jamais plus de 0,6 s dans l'image sans tracer (levé, immobile ou qui se balance au-dessus du
    // contenu : critique #291, B1) ; au-delà, il sort de l'image (hors de l'effacement entre deux pages).
    let libre: number | null = null;
    let pire = { duree: 0, de: 0 };
    for (let i = 0, t = plan.finTransition; t <= plan.finPage + 1e-9; t = plan.finTransition + ++i / 60) {
      const e = etat(plan, t);
      if (e && e.mode !== "trace") libre ??= t;
      else if (libre !== null) {
        if (t - libre > pire.duree) pire = { duree: t - libre, de: libre };
        libre = null;
      }
    }
    if (libre !== null && plan.finPage - libre > pire.duree) pire = { duree: plan.finPage - libre, de: libre };
    if (pire.duree > OUTIL_TABLEAU.libreMaxSec + 0.04) res.push({ controle: "outil", page: p.page.page, detail: `l'outil reste ${pire.duree.toFixed(2).replace(".", ",")} s dans l'image sans tracer (à ${pire.de.toFixed(2).replace(".", ",")} s) ; ${String(OUTIL_TABLEAU.libreMaxSec).replace(".", ",")} s au plus, puis il sort de l'image.` });
    for (const q of pointes) {
      if (!q) continue;
      for (const lev of [0, 1]) {
        const b = boiteOutil(t.style, q.x, q.y, lev, bande.y, r.k);
        if (b.y1 > bande.y) {
          res.push({ controle: "bande", page: p.page.page, detail: `l'outil (pointe en ${Math.round(q.x)}, ${Math.round(q.y)}) descend dans la bande des sous-titres (bas ${Math.round(b.y1)} > ${bande.y}).` });
          break;
        }
      }
    }
  }
  return res;
}
