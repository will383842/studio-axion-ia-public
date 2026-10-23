/**
 * SOUS-TITRES DYNAMIQUES DU TABLEAU (ordre de Will du 17/10/2026 : « les sous-titres doivent dépendre de l'importance du
 * mot ou du message, de façon automatique, comme dans le système central »). Sur la fiche RÉELLE de v-6616b3800357
 * (« Réunion finie depuis trois jours… ») × les 3 fonds × les 4 formats, par la chaîne de la fabrication :
 * - équilibré (défaut) : l'accroche sort en Impact, les chiffres dits (« trois jours », « dix minutes ») sont mis en
 *   valeur, au moins une phrase clé en Bandeau, jamais deux Impact de suite ;
 * - sobre : le style de base seul ;
 * - toujours : dans la bande (jamais sur la page), inclinaison ≤ 2°, texte ≥ 4,5:1 sur ce qui est derrière lui, aucune
 *   couleur verte, bleue ou violette.
 */
import { describe, expect, it } from "vitest";
import { COULEURS_REPLI, elementDe, noterImportance, type ElementDessine } from "../../../src/briques/sous-titres";
import { CHARTES_TABLEAU, horsCharteTableau, melangeTableau, STYLES_TABLEAU, type StyleTableau } from "../../../src/briques/tableau-scene/trois-styles/styles";
import { contraste } from "../../../src/domaine/decors";
import type { SegmentSousTitres, StyleResolu, ValeurStyleSousTitres } from "../../../src/domaine/types";
import { creerDonneesDemo } from "../../../src/donnees/memoire/demo";
import { IDS_FORMATS_SORTIE } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { encombrementTableau, INCLINAISON_MAX_TABLEAU, marquerChiffresDits, sousTitresDynamiquesTableau } from "../../../src/moteurs/montage-tableau/sous-titres-tableau";
import { sortieV6616, type SortieSousTitres } from "./chaine";

/** Chaîne de fabrication complète sur la fiche réelle : le premier test paie le démarrage à froid (> 5 s). */
const LONG = 60_000;
const texteDe = (s: SegmentSousTitres) => s.mots.map((m) => m.mot).join(" ");
const elements = creerDonneesDemo(0).elements;
const choix = (id: string): StyleResolu<ValeurStyleSousTitres> => {
  const e = elements.find((x) => x.id === id)!;
  return { id: e.id, nom: e.nom, valeur: e.valeur as ValeurStyleSousTitres };
};

/** Chaque groupe, à son entrée, au milieu et à sa fin : dans la bande, lisible, dans la charte, peu incliné. */
function verifierChaqueGroupe(r: SortieSousTitres, fond: StyleTableau) {
  const e = r.calque.echelleTexte ?? r.calque.largeur / 1080;
  // Derrière le texte : la bande sombre de fond posée sur le tableau (fonds clairs, 17/10), sinon le tableau.
  const b = r.calque.bandeFond;
  const teinte = b ? melangeTableau(b.couleur, CHARTES_TABLEAU[fond].fond, b.opacite) : CHARTES_TABLEAU[fond].fond;
  for (const s of r.calque.segments) {
    const quoi = `« ${texteDe(s)} » (${s.style})`;
    expect(s.position, quoi).toBe("auto");
    const fin = Math.min(s.finSec - 0.001, Math.max(s.debutSec + 0.3, s.mots.at(-1)!.debutSec + 0.01));
    for (const t of [s.debutSec + 0.001, (s.debutSec + s.finSec) / 2, fin]) {
      const el: ElementDessine = elementDe(r.calque, s, t);
      const { demiHauteur, largeur } = encombrementTableau(el, e);
      const y = el.yPx + el.decalageYPx;
      expect(y - demiHauteur, `${quoi} monte sur la page`).toBeGreaterThanOrEqual(r.bande.y - 1);
      expect(y + demiHauteur, `${quoi} sort de la bande`).toBeLessThanOrEqual(r.bande.y + r.bande.hauteur + 1);
      expect(largeur, `${quoi} plus large que la bande`).toBeLessThanOrEqual(r.bande.largeur + 1);
      expect(Math.abs(el.rotationDeg)).toBeLessThanOrEqual(INCLINAISON_MAX_TABLEAU);
      // Lisibilité à la fin du groupe, chaque mot dit (le Karaoké atténue les mots à venir, comme partout ; #322).
      if (t !== fin) continue;
      const derriere = el.pastille?.fond ?? el.fond?.couleur ?? teinte;
      for (const m of el.mots) {
        expect(contraste(m.couleur, derriere), `${quoi} : « ${m.texte} » ${m.couleur} sur ${derriere}`).toBeGreaterThanOrEqual(4.5);
        expect(horsCharteTableau(m.couleur), `${m.couleur} hors charte`).toBe(false);
      }
      if (el.pastille) expect(horsCharteTableau(el.pastille.fond)).toBe(false);
      if (el.fond) expect(horsCharteTableau(el.fond.couleur)).toBe(false);
      if (el.mots.some((m) => m.souligne > 0)) expect(horsCharteTableau(el.couleurSoulignement)).toBe(false);
    }
  }
  // Jamais deux Impact de suite (règle centrale, gardée après les garde-fous) ; un style dont la base EST l'Impact
  // (Axion pop) dessine chaque groupe ainsi, la règle porte alors sur ses accents.
  if (r.st.gabarit !== "impact") r.calque.segments.forEach((s, i) => {
    if (i > 0 && s.style === "impact") expect(r.calque.segments[i - 1].style, `deux Impact de suite : « ${texteDe(s)} »`).not.toBe("impact");
  });
}

describe("les chiffres DITS comptent comme des chiffres", () => {
  it("« trois jours », « dix minutes », « 3 min » passent en valeur ; « trois titres », « Un nom » non", () => {
    const seg = (id: string, mots: string[], debut: number): SegmentSousTitres => ({ id, debutSec: debut, finSec: debut + 1, mots: mots.map((mot, k) => ({ mot, debutSec: debut + k * 0.2, finSec: debut + (k + 1) * 0.2 })) });
    const { segments, chiffres } = marquerChiffresDits([seg("a", ["depuis", "trois"], 0), seg("b", ["jours,", "et"], 1), seg("c", ["en", "dix", "minutes."], 2), seg("d", ["Trois", "titres"], 3), seg("e", ["Un", "nom", "faux"], 4), seg("f", ["en", "3", "min"], 5)]);
    expect([...chiffres].sort()).toEqual([0, 1, 2, 5]);
    expect(segments[0].mots[1].enValeur).toBe(true);
    expect(segments[1].mots[0].enValeur).toBe(true);
    expect(segments[2].mots.map((m) => !!m.enValeur)).toEqual([false, true, true]);
    expect(segments[3].mots.some((m) => m.enValeur)).toBe(false);
    expect(segments[4].mots.some((m) => m.enValeur)).toBe(false);
  });

  it("un groupe verrouillé par Will n'est jamais réécrit (style, importance, soulignement)", () => {
    const verrou: SegmentSousTitres = { id: "v", debutSec: 0.1, finSec: 1, mots: [{ mot: "trois", debutSec: 0.1, finSec: 0.5 }, { mot: "jours", debutSec: 0.5, finSec: 1 }], style: "bandeau", importance: 1, souligne: 1, position: "haut", inclinaison: 0, verrouille: true };
    const libre: SegmentSousTitres = { id: "l", debutSec: 1, finSec: 2, mots: [{ mot: "Réunion", debutSec: 1, finSec: 2 }] };
    const [v] = sousTitresDynamiquesTableau([verrou, libre], { st: { gabarit: "karaoke", accents: { impact: true, bandeau: true } } });
    expect(v).toMatchObject({ style: "bandeau", importance: 1, souligne: 1, verrouille: true });
    expect(v.mots.some((m) => m.enValeur)).toBe(false);
    // Seule la place change : la bande, jamais le haut de la page.
    expect(v.position).toBe("auto");
  });

  it("la note centrale elle-même est inchangée (les autres formats ne voient rien)", () => {
    const seg: SegmentSousTitres = { id: "a", debutSec: 5, finSec: 6, mots: [{ mot: "dix", debutSec: 5, finSec: 5.5 }, { mot: "minutes", debutSec: 5.5, finSec: 6 }] };
    expect(noterImportance([seg])).toEqual([[0, 1]]);
  });
});

describe("fiche réelle v-6616b3800357, style central « Avocat » (défaut) × 3 fonds × 4 formats", { timeout: LONG }, () => {
  for (const fond of STYLES_TABLEAU)
    for (const format of IDS_FORMATS_SORTIE) {
      it(`${fond} · ${format} · équilibré : accroche en Impact, chiffres mis en valeur, phrase clé en Bandeau, tout dans la bande`, () => {
        const r = sortieV6616(fond, format);
        expect(r.c.sousTitres?.intensite).toBe("equilibre");
        const segs = r.calque.segments;
        // L'accroche (0-2 s) sort en Impact.
        const accroche = segs.find((s) => s.debutSec < 2 && s.style === "impact");
        expect(accroche, "aucune accroche en Impact").toBeDefined();
        // Les chiffres dits : en Impact ou plus grands (importance 3), le nombre en valeur (couleur du mot dit).
        const enValeur = segs.filter((s) => s.mots.some((m) => m.enValeur));
        for (const motif of [/\btrois\b/i, /\bdix\b/i]) expect(enValeur.some((s) => motif.test(texteDe(s))), `${motif} pas en valeur`).toBe(true);
        for (const s of enValeur) expect(s.style !== "base" || (s.importance ?? 0) >= 3, `« ${texteDe(s)} » n'est pas mis en valeur`).toBe(true);
        expect(segs.filter((s) => s.style === "bandeau").length, "aucune phrase clé en Bandeau").toBeGreaterThanOrEqual(1);
        // La base reste la règle (≈ 80 % des groupes).
        expect(segs.filter((s) => s.style === "base").length / segs.length).toBeGreaterThanOrEqual(0.7);
        verifierChaqueGroupe(r, fond);
        // Un accent dessiné comme le central (17/10) : Impact crème cerné, Bandeau sur le rectangle crème, sans pastille.
        const el = elementDe(r.calque, accroche!, accroche!.finSec - 0.01);
        expect(el.pastille).toBeUndefined();
        expect(el.gabarit.id).toBe("impact");
        const b = segs.find((s) => s.style === "bandeau")!;
        const eb = elementDe(r.calque, b, b.finSec - 0.01);
        expect(eb.pastille).toBeUndefined();
        expect(eb.fond?.couleur).toBe(COULEURS_REPLI.texte);
      });

      it(`${fond} · ${format} · sobre : le style de base seul`, () => {
        const r = sortieV6616(fond, format, { intensite: "sobre" });
        expect(r.calque.segments.every((s) => s.style === "base" && !s.inclinaison && (s.souligne === null || s.souligne === undefined))).toBe(true);
        verifierChaqueGroupe(r, fond);
      });
    }

  it("très dynamique : plus d'accents qu'en équilibré, toujours dans la bande", () => {
    const eq = sortieV6616("ardoise", "vertical");
    const td = sortieV6616("ardoise", "vertical", { intensite: "tres-dynamique" });
    const accents = (r: SortieSousTitres) => r.calque.segments.filter((s) => s.style !== "base" || s.souligne != null).length;
    expect(accents(td)).toBeGreaterThan(accents(eq));
    verifierChaqueGroupe(td, "ardoise");
  });

  it("en 9:16 et 4:5 l'Impact garde une légère inclinaison ; en carré et 16:9 (bande plus basse) il se redresse", () => {
    for (const fond of STYLES_TABLEAU) {
      expect(sortieV6616(fond, "vertical").calque.segments.some((s) => s.style === "impact" && s.inclinaison !== 0)).toBe(true);
      expect(sortieV6616(fond, "horizontal").calque.segments.every((s) => s.style !== "impact" || Math.abs(s.inclinaison ?? 0) <= INCLINAISON_MAX_TABLEAU)).toBe(true);
    }
  });
});

describe("styles choisis dans la Bibliothèque : les accents du central, lisibles sur la bande de fond", { timeout: LONG }, () => {
  for (const id of ["st-karaoke", "st-axion-pop", "st-avocat-v1", "st-sobre"])
    for (const fond of STYLES_TABLEAU)
      for (const format of IDS_FORMATS_SORTIE)
        it(`${id} · ${fond} · ${format}`, () => {
          const r = sortieV6616(fond, format, { choisi: choix(id) });
          expect(r.st.couleurs.filter(horsCharteTableau)).toEqual([]);
          expect(r.st.accents).toEqual({ impact: true, bandeau: true });
          verifierChaqueGroupe(r, fond);
        });
});
