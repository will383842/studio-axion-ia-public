/**
 * Sous-titres du tableau sur le système CENTRAL (ordre de Will du 17/10/2026) : le style vient de la Bibliothèque (choix
 * de la vidéo, sinon défaut du format, le style central « Avocat ») ; quel que soit le style, le tableau garde ses
 * garanties (design central exact : voir `sous-titres-design-central/design-central.test.ts`).
 * Pour CHAQUE style de sous-titres de la Bibliothèque × les 3 fonds (tableau blanc, ardoise, paperboard) × les 4
 * formats : chaque groupe est dans la bande basse réservée, le texte se lit (≥ 4,5:1 sur ce qui est derrière lui), aucune
 * couleur hors charte (ni vert, ni bleu, ni violet).
 */
import { describe, expect, it } from "vitest";
import { parametresComposition } from "../../../src/briques/composition/parametres";
import { sceneAuTemps } from "../../../src/briques/sous-titres";
import { CHARTES_TABLEAU, horsCharteTableau, melangeTableau, STYLES_TABLEAU, type StyleTableau } from "../../../src/briques/tableau-scene/trois-styles/styles";
import { contraste } from "../../../src/domaine/decors";
import type { ElementBibliotheque, StyleResolu, ValeurStyleSousTitres } from "../../../src/domaine/types";
import { creerDonneesDemo } from "../../../src/donnees/memoire/demo";
import { STYLE_SOUS_TITRES_AVOCAT } from "../../../src/donnees/elements-avocat";
import { centreBandePct, commandeTableau, plansTableau, RECETTE_COMPOSITION_TABLEAU, reseauxDuRatio, segmentsSousTitresTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { formatSortie, IDS_FORMATS_SORTIE, type IdFormatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage, reseauxVerticaux } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { bandeDe, bandeDuCalque, encombrementTableau, INCLINAISON_MAX_TABLEAU, sousTitresTableau, supplementsSousTitresTableau, zoneTexteTableau } from "../../../src/moteurs/montage-tableau/sous-titres-tableau";
import { caleeEcritureALHeure } from "../reference-3/fiches";

const STYLES_BIBLIOTHEQUE: ElementBibliotheque[] = creerDonneesDemo(0).elements.filter((e) => e.type === "style-sous-titres");
const choix = (e: Pick<ElementBibliotheque, "id" | "nom" | "valeur">): StyleResolu<ValeurStyleSousTitres> => ({ id: e.id, nom: e.nom, valeur: e.valeur as ValeurStyleSousTitres });

const { fiche: ficheBase, mots } = caleeEcritureALHeure();
const texte = ficheBase.scenes.map((s) => s.texteDit).join(" ");
const dureeSec = mots.at(-1)!.finSec + 0.5;
const scenes = [{ id: "s01", debutSec: 0, finSec: dureeSec, cle: "k" }];

/** Tout ce qu'il faut pour une sortie : la commande, les groupes, le calque, la bande. */
function rendre(fond: StyleTableau, format: IdFormatSortie, choisi?: StyleResolu<ValeurStyleSousTitres>) {
  const fiche: FicheTableau = { ...ficheBase, styleTableau: fond };
  const mise = mettreEnPage(fiche, format === "vertical" ? {} : { format });
  const f = formatSortie(format);
  const verticale = format === "vertical";
  const reseaux = verticale ? reseauxVerticaux() : reseauxDuRatio(f.ratio);
  const bande = bandeDe(mise, f.ratio, verticale, reseaux);
  const st = sousTitresTableau({ fiche, choisi, positionPct: centreBandePct(mise), bande });
  const c = commandeTableau({ videoId: "v", fiche, texteScript: texte, dureeSec, centreSousTitresPct: centreBandePct(mise), scenes, ratio: f.ratio, ...(choisi ? { styleSousTitres: choisi } : {}), bandeSousTitres: bande });
  // 17/10 : la chaîne de la fabrication (mélange central, garde-fous du tableau, bande).
  const supplements = supplementsSousTitresTableau({ st, mise, ratio: f.ratio, verticale, dynamiques: true });
  const segments = segmentsSousTitresTableau({ c, st, dynamiques: true, texte, dureeSec, mots, ratio: f.ratio, reseaux, scenes, mise, supplements });
  const params = parametresComposition(c, { ratio: f.ratio, plans: plansTableau(scenes), segments, dureeSec, mots, pistesDouble: { face: "k" }, ...supplements }, RECETTE_COMPOSITION_TABLEAU);
  const calque = params.texte.sousTitres!;
  // Bande dans les px du calque (la mise en page peut avoir une autre taille d'image que le calque) ; le texte se pose
  // dans sa partie pleine (sous le dégradé de la bande de fond).
  const bandeCalque = bandeDuCalque(mise, calque);
  return { st, c, calque, bande: bandeCalque, zone: zoneTexteTableau(st, bandeCalque), mise };
}

/** Ce qui est réellement derrière le texte : le rectangle du Bandeau, sinon la bande de fond posée sur le tableau. */
const derriereDe = (calque: { bandeFond?: { couleur: string; opacite: number } }, el: { fond?: { couleur: string } }, fond: StyleTableau) => el.fond?.couleur ?? (calque.bandeFond ? melangeTableau(calque.bandeFond.couleur, CHARTES_TABLEAU[fond].fond, calque.bandeFond.opacite) : CHARTES_TABLEAU[fond].fond);

describe("Bibliothèque : plus de style « Pastille Axion » (17/10, retour de Will sur #330)", () => {
  it("les styles de la Bibliothèque sont ceux d'avant la pile, inchangés", () => {
    expect(STYLES_BIBLIOTHEQUE.map((e) => e.id).sort()).toEqual(["st-avocat-v1", "st-axion-pop", "st-karaoke", "st-sobre"]);
  });
});

describe("le tableau suit le style choisi", () => {
  it("sans style transmis : le style central « Avocat », sans pastille", () => {
    for (const fond of STYLES_TABLEAU) {
      const { c, calque } = rendre(fond, "vertical");
      expect(c.styles.sousTitres?.id).toBe("st-avocat-v1");
      expect(c.styles.sousTitres?.valeur?.pastille).toBeUndefined();
      expect(calque.pastille).toBeUndefined();
      expect(c.styles.decor?.id).toBe("fond-tableau");
    }
  });

  it("un style Karaoké crème sur l'ardoise garde son dessin (pas de pastille), à la position de la bande", () => {
    const { c, calque, st } = rendre("ardoise", "vertical", choix(STYLES_BIBLIOTHEQUE.find((x) => x.id === "st-karaoke")!));
    expect(st.gabarit).toBe("karaoke");
    expect(calque.pastille).toBeUndefined();
    expect(c.styles.sousTitres?.id).toBe("st-karaoke");
    expect(c.styles.decor?.valeur).toMatchObject({ teinte: CHARTES_TABLEAU.ardoise.fond, clair: false });
    expect(st.alerte).toBeUndefined();
  });

  it("un style crème sur un fond clair garde son dessin : une bande sombre de fond est posée derrière, sans alerte", () => {
    const { st, calque } = rendre("tableau-blanc", "vertical", choix(STYLES_BIBLIOTHEQUE.find((x) => x.id === "st-karaoke")!));
    expect(st.gabarit).toBe("karaoke");
    expect(calque.segments.some((s) => s.style === "base")).toBe(true);
    expect(calque.bandeFond).toBeDefined();
    expect(st.alerte).toBeUndefined();
  });

  it("un style à encre (couleurs écrites) ne les impose plus : design central, couleurs de la marque", () => {
    const bleu: StyleResolu<ValeurStyleSousTitres> = { id: "st-bleu", nom: "Bleu", valeur: { ...STYLE_SOUS_TITRES_AVOCAT, encre: { texte: "#1E3FA8", page: "#F4F2EE" } } };
    for (const fond of STYLES_TABLEAU) {
      const r = rendre(fond, "vertical", bleu);
      expect(r.calque.pastille).toBeUndefined();
      expect(r.calque.encre).toBeUndefined();
      expect(r.st.couleurs.filter(horsCharteTableau)).toEqual([]);
      expect(r.c.styles.sousTitres?.id).toBe("st-avocat-v1");
    }
  });

  it("un style qui demande le haut de l'image ou une grande taille reste dans la bande", () => {
    const haut: StyleResolu<ValeurStyleSousTitres> = { id: "st-haut", nom: "Haut", valeur: { ...(STYLES_BIBLIOTHEQUE.find((x) => x.id === "st-avocat-v1")!.valeur as ValeurStyleSousTitres), position: "haut", positionPct: 12, tailleRelative: 1.4 } };
    const { calque, bande } = rendre("ardoise", "carre", haut);
    for (const s of calque.segments) {
      const el = sceneAuTemps(calque, s.finSec - 0.001)!;
      const e = calque.echelleTexte ?? calque.largeur / 1080;
      expect(el.yPx - encombrementTableau(el, e).demiHauteur).toBeGreaterThanOrEqual(bande.y - 1);
      expect(el.yPx + encombrementTableau(el, e).demiHauteur).toBeLessThanOrEqual(bande.y + bande.hauteur + 1);
    }
  });
});

describe("chaque style de la Bibliothèque × 3 fonds × 4 formats : dans la bande, lisible, dans la charte", () => {
  for (const style of STYLES_BIBLIOTHEQUE)
    for (const fond of STYLES_TABLEAU)
      for (const format of IDS_FORMATS_SORTIE) {
        it(`${style.nom} · ${fond} · ${format}`, () => {
          const { calque, bande, zone, st } = rendre(fond, format, choix(style));
          expect(st.contraste).toBeGreaterThanOrEqual(4.5);
          expect(st.couleurs.filter(horsCharteTableau)).toEqual([]);
          const e = calque.echelleTexte ?? calque.largeur / 1080;
          expect(calque.segments.length).toBeGreaterThan(5);
          for (const s of calque.segments) {
            // Fin du groupe : entrée finie, chaque mot dit (le dernier au mot dit, les autres au texte).
            const t = Math.max(s.debutSec + 0.3, s.mots.at(-1)!.debutSec + 0.01);
            const el = sceneAuTemps(calque, Math.min(t, s.finSec - 0.001))!;
            const quoi = `« ${s.mots.map((m) => m.mot).join(" ")} »`;
            const demi = encombrementTableau(el, e).demiHauteur;
            expect(el.yPx + el.decalageYPx - demi, `${quoi} monte sur la page`).toBeGreaterThanOrEqual(zone.y - 1);
            expect(el.yPx + el.decalageYPx + demi, `${quoi} sort de la bande`).toBeLessThanOrEqual(bande.y + bande.hauteur + 1);
            expect(encombrementTableau(el, e).largeur, `${quoi} plus large que la bande`).toBeLessThanOrEqual(bande.largeur + 1);
            // Sous-titres dynamiques (17/10) : un Impact penche au plus de 2°.
            expect(Math.abs(el.rotationDeg)).toBeLessThanOrEqual(INCLINAISON_MAX_TABLEAU);
            const derriere = derriereDe(calque, el, fond);
            for (const m of el.mots) {
              const couleur = el.surlignage && m.souligne ? el.surlignage.texte : m.couleur;
              expect(contraste(couleur, derriere), `${quoi} : « ${m.texte} » ${couleur} sur ${derriere}`).toBeGreaterThanOrEqual(4.5);
              expect(horsCharteTableau(couleur), `${couleur} hors charte`).toBe(false);
            }
            if (el.pastille) expect(horsCharteTableau(el.pastille.fond)).toBe(false);
            if (el.fond) expect(horsCharteTableau(el.fond.couleur)).toBe(false);
          }
        });
      }
});
