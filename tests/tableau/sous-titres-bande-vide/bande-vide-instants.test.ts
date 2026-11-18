/**
 * FIX-BANDE-VIDE-TABLEAU (18/11/2026) : la bande noire des sous-titres disparaît VRAIMENT pendant les silences,
 * PAR LE CHEMIN RÉEL de fabrication : calque réel du tableau → `instantsTexte` (une image par état, recopiée par
 * FFmpeg via `liste.txt`) → l'image dessinée n° k l'est à `instants[k]` (`TexteCompose.tsx:18`).
 * `.tsx` lus en TEXTE seulement (PIEGE-REMOTION-TSC.md). Voir ANALYSE-BANDE-VIDE.md § 3.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bandeauAuTemps } from "../../../src/briques/sous-titres/bandeau-nom";
import { etiquetteAuTemps, opaciteBandeFond, sceneAuTemps, type DonneesCalque } from "../../../src/briques/sous-titres/scene";
import { encadreVisible, incrustationsAuTemps } from "../../../src/briques/composition/scene";
import { STYLES_TABLEAU } from "../../../src/briques/tableau-scene/trois-styles/styles";
import { instantsTexte } from "../../../studio-rendu/src/composition/texte-instants";
import { sortieV6616 } from "../sous-titres-dynamiques/chaine";

const FPS = 30;
type P = { sousTitres: DonneesCalque; encadre: undefined; incrustations: [] };

/** Copie FIGÉE de l'empreinte d'AVANT FIX-BANDE-VIDE-TABLEAU (origin/master 92ce79a8), modèle empreinte-pastille.test.ts. */
function ancienneEmpreinte(p: P, t: number): string {
  const el = p.sousTitres ? sceneAuTemps(p.sousTitres, t) : null;
  const sous = el
    ? [el.cle, el.taillePx, +el.yPx.toFixed(2), el.rotationDeg, +el.echelle.toFixed(4), +el.opacite.toFixed(4), +el.decalageYPx.toFixed(2), el.mots.map((m) => [m.texte, m.couleur, +m.opacite.toFixed(4), +m.souligne.toFixed(4), ...(m.echelle === undefined && m.monteePx === undefined ? [] : [+(m.echelle ?? 1).toFixed(4), +(m.monteePx ?? 0).toFixed(2)]), ...(m.plaque ? [1] : []), ...(m.etiquette ? [m.etiquette] : [])])]
    : null;
  const inc = incrustationsAuTemps(p.incrustations, t).map((i) => p.incrustations.indexOf(i));
  const bandeau = p.sousTitres?.bandeauNom ? bandeauAuTemps(p.sousTitres.bandeauNom, t) : null;
  const etiquette = p.sousTitres?.etiquettesOutils ? etiquetteAuTemps(p.sousTitres, t) : null;
  return JSON.stringify([sous, encadreVisible(p.encadre, t), inc, ...(bandeau ? [[bandeau.visible, +bandeau.opacite.toFixed(4), +bandeau.decalageXPx.toFixed(2)]] : []), ...(etiquette ? [[etiquette.id, +etiquette.opacite.toFixed(4)]] : [])]);
}
function anciensInstants(p: P, images: number) {
  const instants: number[] = [];
  const durees: number[] = [];
  let prec: string | null = null;
  for (let i = 0; i < Math.max(1, images); i++) {
    const e = ancienneEmpreinte(p, i / FPS);
    if (e === prec) durees[durees.length - 1]++;
    else {
      instants.push(i / FPS);
      durees.push(1);
      prec = e;
    }
  }
  return { instants, durees };
}

const CAS = [...STYLES_TABLEAU.map((f) => ({ fond: f, format: "vertical" as const })), { fond: "tableau-blanc" as const, format: "horizontal" as const }].map((c) => ({ ...c, calque: sortieV6616(c.fond, c.format).calque }));
const AVEC = CAS.filter((c) => c.calque.bandeFond);
const SANS = CAS.filter((c) => !c.calque.bandeFond);
const finDernier = (d: DonneesCalque) => Math.max(...d.segments.map((s) => s.finSec));
const imagesDe = (d: DonneesCalque) => Math.ceil((finDernier(d) + 3) * FPS);

describe("a) par le chemin réel : ce qui est dessiné (instants[k]) = ce qui est voulu, image par image", () => {
  it("au moins un fond du tableau a une bande", () => expect(AVEC.length).toBeGreaterThan(0));
  for (const { fond, format, calque } of AVEC) {
    it(`${fond} ${format}`, () => {
      const images = imagesDe(calque);
      const { instants, durees } = instantsTexte({ sousTitres: calque, encadre: undefined, incrustations: [], images, fps: FPS });
      expect(durees.reduce((a, b) => a + b, 0)).toBe(images);
      // Comme liste.txt : chaque image f de la vidéo est dessinée à l'instant de sa suite.
      const dessinee: number[] = [];
      instants.forEach((t, k) => { for (let j = 0; j < durees[k]; j++) dessinee.push(opaciteBandeFond(calque, t)); });
      const fausses: number[] = [];
      for (let f = 0; f < images; f++) if (Math.abs(dessinee[f] - opaciteBandeFond(calque, f / FPS)) > 0.01) fausses.push(f);
      expect(fausses, `images fausses : ${fausses.length} (première ${fausses[0]})`).toEqual([]);
      // Après le dernier mot + 0,2 s : aucune bande.
      for (let f = Math.ceil((finDernier(calque) + 0.2) * FPS) + 1; f < images; f++) expect(dessinee[f], `image ${f}`).toBe(0);
      // Chaque silence où la bande voulue atteint 0 : au moins une image dessinée à 0.
      let debut = -1;
      let aZero = false;
      for (let f = 0; f <= images; f++) {
        const zero = f < images && opaciteBandeFond(calque, f / FPS) === 0;
        if (zero && debut < 0) { debut = f; aZero = false; }
        if (zero && dessinee[f] === 0) aZero = true;
        if (!zero && debut >= 0) { expect(aZero, `silence image ${debut}-${f - 1} sans image à 0`).toBe(true); debut = -1; }
      }
    });
  }
});

describe("b) éteint = identique : sans bandeFond, mêmes instants/durées qu'avec l'ancienne empreinte", () => {
  const sans = [...SANS.map((c) => ({ nom: `${c.fond} ${c.format}`, calque: c.calque })), ...AVEC.map((c) => ({ nom: `${c.fond} ${c.format} (bande retirée)`, calque: { ...c.calque, bandeFond: undefined } as DonneesCalque }))];
  for (const { nom, calque } of sans) {
    it(nom, () => {
      const images = imagesDe(calque);
      const p: P = { sousTitres: calque, encadre: undefined, incrustations: [] };
      expect(instantsTexte({ ...p, images, fps: FPS })).toEqual(anciensInstants(p, images));
    });
  }
});

describe("c) garde-fou : tout ce que le calque dessine selon le temps entre dans empreinteTexte", () => {
  const calque = readFileSync("studio-rendu/compositions/sous-titres/CalqueSousTitres.tsx", "utf8");
  const empreinte = readFileSync("studio-rendu/src/composition/texte-instants.ts", "utf8");
  const corps = empreinte.slice(empreinte.indexOf("export function empreinteTexte"), empreinte.indexOf("export function instantsTexte"));
  for (const f of ["sceneAuTemps", "bandeauAuTemps", "etiquetteAuTemps", "opaciteBandeFond"]) {
    it(f, () => {
      expect(calque.includes(`${f}(`)).toBe(true);
      expect(corps.includes(`${f}(`), `${f} appelée dans le calque mais absente de empreinteTexte`).toBe(true);
    });
  }
});
