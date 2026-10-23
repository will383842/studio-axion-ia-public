/**
 * SOUS-TITRES DU TABLEAU AU DESIGN CENTRAL EXACT (retour de Will sur les images de #330, 17/10/2026 : « ce ne sont pas
 * les bonnes couleurs, ce n'est pas ce qui est centralisé ; je parle du DESIGN »). Sur la fiche RÉELLE v-6616b3800357 ×
 * les 3 fonds × les 4 formats, par la chaîne de la fabrication :
 * - les couleurs du calque (texte, mot dit, contour) sont EXACTEMENT celles du central pour la même marque
 *   (`couleursDepuisMarque`) et celles du calque de l'avocat ;
 * - chaque groupe est dessiné comme le central le dessine (gabarit, police, couleur de chaque mot, contour, ombre,
 *   rectangle du Bandeau) : aucune pastille, aucun fond coloré inventé, aucune couleur propre au tableau ;
 * - les fonds clairs reçoivent une bande sombre de FOND (jeton `fond` de la marque, ≥ 0,85) dans la bande réservée ;
 *   l'ardoise n'en a pas ; le texte et le mot dit y passent 4,5:1 ;
 * - le défaut du format est le style central de la face caméra et de l'avocat (« Avocat », `st-avocat-v1`) ;
 * - les autres formats (avocat, face caméra, image → vidéo) sont inchangés au caractère près (témoin calculé sur la
 *   base de la pile).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parametresComposition } from "../../../src/briques/composition/parametres";
import { COULEURS_REPLI, couleursDepuisMarque, cssElement, donneesCalque, elementDe, type DonneesCalque, type ElementDessine } from "../../../src/briques/sous-titres";
import { CHARTES_TABLEAU, horsCharteTableau, melangeTableau, STYLES_TABLEAU } from "../../../src/briques/tableau-scene/trois-styles/styles";
import { contraste, sousTitresSurDecor } from "../../../src/domaine/decors";
import type { SegmentSousTitres, StyleResolu, ValeurStyleSousTitres } from "../../../src/domaine/types";
import { STYLE_SOUS_TITRES_AVOCAT } from "../../../src/donnees/elements-avocat";
import { creerDonneesDemo } from "../../../src/donnees/memoire/demo";
import { obtenirFormat } from "../../../src/formats";
import { RECETTE_COMPOSITION_AVOCAT } from "../../../src/moteurs/montage-avocat/recette-composition";
import { IDS_FORMATS_SORTIE } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { BANDE_FOND_TABLEAU, ID_STYLE_SOUS_TITRES_TABLEAU, STYLE_SOUS_TITRES_TABLEAU } from "../../../src/moteurs/montage-tableau/sous-titres-tableau";
import { sortieV6616 } from "../sous-titres-dynamiques/chaine";
import { calquesAutresFormats } from "./autres-formats";

/** Chaîne de fabrication complète sur la fiche réelle : le premier test paie le démarrage à froid (> 5 s). */
const LONG = 60_000;
const texteDe = (s: SegmentSousTitres) => s.mots.map((m) => m.mot).join(" ");
const CENTRAL = couleursDepuisMarque(null, STYLE_SOUS_TITRES_AVOCAT.jetonEmphase ?? "orange-vif");
const RATIO = { vertical: "9:16", portrait: "4:5", carre: "1:1", horizontal: "16:9" } as const;

/** Calque de l'AVOCAT (central) pour les mêmes groupes et le même ratio : la référence du design. */
function calqueAvocat(segments: SegmentSousTitres[], ratio: "9:16" | "4:5" | "1:1" | "16:9"): DonneesCalque {
  return donneesCalque({ segments, base: "karaoke", ratio, style: STYLE_SOUS_TITRES_AVOCAT });
}

/** Ce qui fait le DESIGN d'un groupe dessiné (sans sa taille ni sa place, que la bande du tableau décide). */
function design(el: ElementDessine, calque: DonneesCalque) {
  const css = cssElement(el, calque, `"${el.police}"`);
  const couleurDe = (v: unknown) => (typeof v === "string" ? v.replace(/^[\d.]+px /, "").replace(/0 [\d.]+px [\d.]+px /, "") : v);
  return {
    gabarit: el.gabarit.id,
    police: el.police,
    rotationDeg: el.rotationDeg,
    mots: el.mots.map((m) => ({ texte: m.texte, couleur: m.couleur, opacite: m.opacite, souligne: m.souligne })),
    couleurSoulignement: el.couleurSoulignement,
    fond: el.fond?.couleur ?? null,
    pastille: el.pastille ?? null,
    clair: el.clair ?? null,
    ligne: { fontWeight: css.ligne.fontWeight, textTransform: css.ligne.textTransform, paintOrder: css.ligne.paintOrder, contour: couleurDe(css.ligne.WebkitTextStroke) ?? null, ombre: couleurDe(css.ligne.textShadow) ?? null, fond: css.ligne.background ?? null },
  };
}

describe("le défaut du format tableau est le style central de la face caméra et de l'avocat", () => {
  it("« Avocat » (st-avocat-v1), comme la face caméra et l'avocat ; aucune « Pastille Axion » dans la Bibliothèque", () => {
    expect(obtenirFormat("tableau-anime").stylesParDefaut.sousTitres).toBe("st-avocat-v1");
    expect(obtenirFormat("tableau-anime").stylesParDefaut.sousTitres).toBe(obtenirFormat("facecam").stylesParDefaut.sousTitres);
    expect(obtenirFormat("tableau-anime").stylesParDefaut.sousTitres).toBe(obtenirFormat("avocat").stylesParDefaut.sousTitres);
    expect(ID_STYLE_SOUS_TITRES_TABLEAU).toBe("st-avocat-v1");
    expect(STYLE_SOUS_TITRES_TABLEAU).toBe(STYLE_SOUS_TITRES_AVOCAT);
    const styles = creerDonneesDemo(0).elements.filter((e) => e.type === "style-sous-titres");
    expect(styles.map((e) => e.id)).not.toContain("st-pastille-axion");
    expect(styles.find((e) => e.id === "st-avocat-v1")?.valeur).toEqual(STYLE_SOUS_TITRES_AVOCAT);
  });

  it("le style central ne porte aucune couleur écrite : ni pastille, ni encre (les couleurs viennent de la marque)", () => {
    expect(STYLE_SOUS_TITRES_AVOCAT.pastille).toBeUndefined();
    expect(STYLE_SOUS_TITRES_AVOCAT.encre).toBeUndefined();
    expect(CENTRAL).toEqual(COULEURS_REPLI);
    // Une marque qui change ses jetons change les sous-titres du tableau comme ceux des autres formats.
    const marque = { couleurs: [{ nom: "Crème", jeton: "--texte", valeur: "#FAF6EF" }, { nom: "Orange", jeton: "--orange-vif", valeur: "#E57A45" }, { nom: "Fond", jeton: "--fond", valeur: "#120E0B" }] };
    expect(donneesCalque({ segments: [], base: "karaoke", style: STYLE_SOUS_TITRES_TABLEAU, marque }).couleurs).toEqual(couleursDepuisMarque(marque, "orange-vif"));
  });
});

describe("fiche réelle v-6616b3800357 × 3 fonds × 4 formats : le design du central, exactement", { timeout: LONG }, () => {
  for (const fond of STYLES_TABLEAU)
    for (const format of IDS_FORMATS_SORTIE) {
      it(`${fond} · ${format}`, () => {
        const r = sortieV6616(fond, format);
        const ratio = RATIO[format];
        // Couleurs : celles du central pour la même marque, et celles du calque de l'avocat.
        expect(r.calque.couleurs).toEqual(CENTRAL);
        const avocat = calqueAvocat(r.calque.segments, ratio);
        expect(r.calque.couleurs).toEqual(avocat.couleurs);
        expect(r.calque.couleurs).toEqual(parametresComposition({ ...r.c, formatId: "avocat", moteurId: "montage-avocat", styles: { ...r.c.styles, decor: null } } as never, { ratio, plans: [], segments: r.calque.segments, dureeSec: 30 }, RECETTE_COMPOSITION_AVOCAT).texte.sousTitres!.couleurs);
        // Aucune couleur propre au tableau : ni pastille, ni encre, ni style à couleurs.
        expect(r.calque.pastille).toBeUndefined();
        expect(r.calque.encre).toBeUndefined();
        expect(r.c.styles.sousTitres?.id).toBe("st-avocat-v1");
        expect(r.c.styles.sousTitres?.valeur?.pastille).toBeUndefined();
        expect(r.c.styles.sousTitres?.valeur?.encre).toBeUndefined();
        expect(r.st.couleurs.sort()).toEqual([CENTRAL.texte, CENTRAL.accent, CENTRAL.contour].sort());
        expect(r.st.couleurs.filter(horsCharteTableau)).toEqual([]);
        expect(r.calque.facteurOmbre ?? 1).toBe(1);
        // Le modèle de mouvement de #330 est gardé : accroche en Impact, au moins un Bandeau, la base partout ailleurs.
        const segs = r.calque.segments;
        expect(segs.some((s) => s.debutSec < 2 && s.style === "impact"), "aucune accroche en Impact").toBe(true);
        expect(segs.some((s) => s.style === "bandeau"), "aucun Bandeau").toBe(true);
        // Chaque groupe, à trois instants : dessiné exactement comme le central le dessine.
        for (const s of segs)
          for (const t of [s.debutSec + 0.001, (s.debutSec + s.finSec) / 2, s.finSec - 0.001]) {
            const el = elementDe(r.calque, s, t);
            expect(design(el, r.calque), `« ${texteDe(s)} » (${s.style}) à ${t.toFixed(2)} s`).toEqual(design(elementDe(avocat, s, t), avocat));
            expect(el.pastille).toBeUndefined();
            if (el.fond) expect(el.fond.couleur).toBe(CENTRAL.texte);
          }
        // Lisibilité : bande sombre de fond (jeton `fond`) sur les fonds clairs, rien sur l'ardoise.
        const teinte = CHARTES_TABLEAU[fond].fond;
        if (fond === "ardoise") {
          expect(r.calque.bandeFond).toBeUndefined();
          expect(sousTitresSurDecor({ type: "decor", mode: "teinte", teinte, profondeurFlou: 0, directionLumiere: "face", positionSujet: 0.5, clair: false }).mode).toBe("normal");
        } else {
          const b = r.calque.bandeFond!;
          expect(b.couleur).toBe(CENTRAL.contour);
          expect(b.opacite).toBeGreaterThanOrEqual(BANDE_FOND_TABLEAU.opaciteMin);
          expect(b.opacite).toBeLessThanOrEqual(1);
          // Dans la bande réservée : jamais au-dessus du contenu.
          expect(b.yPx).toBeGreaterThanOrEqual(r.bande.y - 0.5);
          expect(b.hauteurPx).toBeLessThanOrEqual(r.bande.hauteur + 0.5);
          const derriere = melangeTableau(b.couleur, teinte, b.opacite);
          expect(contraste(CENTRAL.texte, derriere)).toBeGreaterThanOrEqual(4.5);
          expect(contraste(CENTRAL.accent, derriere)).toBeGreaterThanOrEqual(4.5);
          // Le texte est posé sous le dégradé du haut, dans la partie pleine.
          const e = r.calque.echelleTexte ?? r.calque.largeur / 1080;
          for (const s of segs) {
            const el = elementDe(r.calque, s, s.finSec - 0.001);
            const demi = el.fond ? el.taillePx / 2 + el.fond.margeYPx : (el.taillePx * 1.1) / 2 + (el.gabarit.contourPx * e) / 2;
            expect(el.yPx - demi * el.echelle, `« ${texteDe(s)} » dans le dégradé`).toBeGreaterThanOrEqual(b.yPx + b.fonduPx - 1);
          }
        }
      });
    }
});

describe("un style choisi à pastille ou à encre n'impose plus ses couleurs au tableau", { timeout: LONG }, () => {
  const pastille: StyleResolu<ValeurStyleSousTitres> = { id: "st-ancienne-pastille", nom: "Ancienne pastille", valeur: { ...STYLE_SOUS_TITRES_AVOCAT, pastille: "axion", encre: { texte: "#110A05", page: "#F6F1E8", accent: "#B44F29" } } };
  const encre: StyleResolu<ValeurStyleSousTitres> = { id: "st-bleu", nom: "Bleu", valeur: { ...STYLE_SOUS_TITRES_AVOCAT, encre: { texte: "#1E3FA8", page: "#F4F2EE" } } };
  for (const choisi of [pastille, encre])
    for (const fond of STYLES_TABLEAU)
      it(`${choisi.nom} · ${fond} : design central, couleurs de la marque`, () => {
        const r = sortieV6616(fond, "vertical", { choisi });
        expect(r.calque.pastille).toBeUndefined();
        expect(r.calque.encre).toBeUndefined();
        expect(r.calque.couleurs).toEqual(CENTRAL);
        expect(r.c.styles.sousTitres?.id).toBe("st-avocat-v1");
      });
});

describe("les autres formats ne changent pas (au caractère près)", () => {
  it("avocat, face caméra (9:16, 4:5, 1:1) et image → vidéo : calques et dessins identiques au témoin de la base", () => {
    const temoin = JSON.parse(readFileSync(join(__dirname, "autres-formats.temoin.json"), "utf8"));
    const maintenant = calquesAutresFormats();
    expect(Object.keys(maintenant)).toEqual(Object.keys(temoin));
    for (const cle of Object.keys(temoin)) expect(JSON.stringify(maintenant[cle]), cle).toBe(JSON.stringify(temoin[cle]));
    // Les ajouts du tableau n'apparaissent jamais ailleurs.
    expect(JSON.stringify(maintenant)).not.toMatch(/bandeFond|glissement/);
  });
});
