/**
 * Variété « Image → vidéo » · axe 14, en-tête (ENT-A à ENT-D) : l'habillage du titre reste dans la zone de l'en-tête
 * d'aujourd'hui (9:16 et 4:5), loin des sous-titres, et le titre reste lisible (contraste ≥ 4,5:1).
 */
import { describe, expect, it } from "vitest";
import { CADRES_IV, VARIANTES_GARDEES, tirablesDe } from "@/briques/schema-motion/variete";
import { PLANCHER_PX } from "@/briques/schema-motion/plan-objets";
import { TAILLES_DUO } from "@/briques/habillage/charte-duo";
import { miseEnPageDeHauteurIV } from "@/briques/schema-motion/types";
import { LIGNES_ETIQUETTE_MAX, geometrieEntete, habillageApplique, lignesEtiquetteEstimees, type CodeEntete } from "../../../studio-rendu/compositions/image-video/variete/entete/geometrie";

const CODES: CodeEntete[] = ["ENT-A", "ENT-B", "ENT-C", "ENT-D"];
const TITRES = ["Vos relances partent seules", "Un devis envoyé en deux minutes chrono", "BON DE COMMANDE MARTIN", "Gagnez du temps"];

function luminance(hex: string): number {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
const contraste = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe("axe entete", () => {
  it("variantes gardées B, C, D ; tirables avec la référence", () => {
    expect(VARIANTES_GARDEES.entete).toEqual(["ENT-B", "ENT-C", "ENT-D"]);
    expect(tirablesDe("entete")).toEqual(["ENT-A", "ENT-B", "ENT-C", "ENT-D"]);
  });
  for (const format of ["9:16", "4:5"] as const) {
    for (const code of CODES) {
      for (const fond of ["ivoire", "sombre"] as const) {
        it(`${code} · ${format} · ${fond} : boîtes dans la zone d'aujourd'hui, hors sous-titres, contraste ≥ 4,5`, () => {
          for (const titre of TITRES) {
            const g = geometrieEntete(code, titre, format, fond);
            const z = g.zone;
            for (const b of [g.boite, g.texte]) {
              if (!b) continue;
              expect(b.x).toBeGreaterThanOrEqual(0);
              expect(b.x + b.largeur).toBeLessThanOrEqual(1080 + 1e-6);
              expect(b.y).toBeGreaterThanOrEqual(z.y - 1e-6);
              expect(b.y + b.hauteur).toBeLessThanOrEqual(z.y + z.hauteur + 1e-6);
              expect(b.y + b.hauteur).toBeLessThan(CADRES_IV[format].sousTitres.haut);
            }
            expect(contraste(g.couleurTitre, g.fondDuTitre)).toBeGreaterThanOrEqual(4.5);
            expect(contraste(g.couleurAccent, g.fondDuTitre)).toBeGreaterThanOrEqual(4.5 - (code === "ENT-A" || code === "ENT-C" ? 1.5 : 0));
          }
        });
      }
    }
  }
  const ETIQUETTES_LONGUES = ["Les justificatifs clients triés et classés par l'IA", "Chaque pièce reçue est lue, rangée et classée sans effort"];
  const TITRES_LONGS = ["Fini les heures à ouvrir les pièces une par une", "Un devis envoyé en deux minutes chrono depuis votre téléphone"];
  /** Pire cas indépendant de l'estimation : toutes les lettres larges (M, W ≈ 1,27 em avec l'espacement), coupure aux espaces. */
  function lignesPireCas(etiquette: string, ht: number): number {
    const parLigne = Math.max(1, Math.floor(1080 / (1.27 * TAILLES_DUO.etiquette * ht)));
    let lignes = 1;
    let courant = 0;
    for (const mot of etiquette.trim().split(/\s+/)) {
      if (courant === 0) courant = mot.length;
      else if (courant + 1 + mot.length <= parLigne) courant += 1 + mot.length;
      else { lignes += 1; courant = mot.length; }
    }
    return lignes;
  }
  for (const format of ["9:16", "4:5"] as const) {
    for (const code of ["ENT-B", "ENT-C", "ENT-D"] as const) {
      it(`${code} · ${format} · étiquette longue (2 lignes) : titre jamais sous le plancher ; sinon alerte signalée non bloquante`, () => {
        const hauteurFormat = format === "9:16" ? 1920 : 1350;
        const m = miseEnPageDeHauteurIV(hauteurFormat);
        for (const etiquette of ETIQUETTES_LONGUES) {
          expect(etiquette.length).toBeGreaterThan(50);
          for (const titre of [...TITRES_LONGS, ...TITRES]) {
            const g = geometrieEntete(code, titre, format, "ivoire", etiquette);
            expect(g.lignesEtiquette).toBeGreaterThanOrEqual(2);
            // Lisibilité : le titre n'est jamais réduit sous le plancher (B3/Q21).
            expect(g.tailleTitre).toBeGreaterThanOrEqual(PLANCHER_PX - 1e-6);
            // Non circulaire : la fin de l'étiquette est bornée par le pire cas (lettres larges), pas par l'estimation du code.
            const finPireCas = m.entete.haut * hauteurFormat + lignesPireCas(etiquette, m.hauteurTexte) * 1.21 * TAILLES_DUO.etiquette * m.hauteurTexte;
            const bas = g.zone.y + g.zone.hauteur;
            // Sans alerte, tout tient : rien ne recouvre l'étiquette (même au pire cas), le titre est dans l'habillage et dans la zone.
            if (g.alerte === null) {
              for (const b of [g.boite, g.texte]) {
                if (!b) continue;
                expect(b.y).toBeGreaterThanOrEqual(finPireCas - 1e-6);
                expect(b.y + b.hauteur).toBeLessThanOrEqual(bas + 1e-6);
                expect(b.y + b.hauteur).toBeLessThan(CADRES_IV[format].sousTitres.haut);
                expect(b.x).toBeGreaterThanOrEqual(0);
                expect(b.x + b.largeur).toBeLessThanOrEqual(1080 + 1e-6);
              }
              if (g.forme === "capsule" || g.forme === "bandeau") {
                const b = g.boite!;
                const t = g.texte;
                expect(t.x).toBeGreaterThanOrEqual(b.x);
                expect(t.x + t.largeur).toBeLessThanOrEqual(b.x + b.largeur + 1e-6);
                expect(t.y).toBeGreaterThanOrEqual(b.y);
                expect(t.y + t.hauteur).toBeLessThanOrEqual(b.y + b.hauteur + 1e-6);
                // Marge basse : le texte ne colle ni à la bordure ni aux coins arrondis.
                expect(b.y + b.hauteur - (t.y + t.hauteur)).toBeGreaterThanOrEqual(8);
              }
            } else {
              // L'alerte est vraie : soit l'étiquette est trop longue, soit le titre ne tient pas à son plancher.
              const depasse = g.texte.y + g.texte.hauteur > bas + 1e-6;
              expect(g.lignesEtiquette > LIGNES_ETIQUETTE_MAX || depasse).toBe(true);
              // Repli : en cas d'alerte, aucun habillage n'est rendu (en-tête simple).
              expect(habillageApplique(g)).toBe(false);
            }
          }
        }
      });
    }
  }
  it("étiquette de plus de 2 lignes : alerte signalée non bloquante", () => {
    const g = geometrieEntete("ENT-B", "Gagnez du temps", "9:16", "ivoire", "Chaque pièce reçue est lue, rangée, classée, archivée, rapprochée et envoyée au comptable sans aucun effort de votre part");
    expect(g.lignesEtiquette).toBeGreaterThan(LIGNES_ETIQUETTE_MAX);
    expect(g.alerte).toMatch(/Étiquette trop longue/);
  });
  it("étiquette de lettres larges (36 signes) : estimée sur 2 lignes, pas 1", () => {
    expect(lignesEtiquetteEstimees("MMMMM WWWWW MMMMM WWWWW MMMMM WWWWW", 1920)).toBe(2);
  });
  it("étiquette de 32 signes en M et W : l'estimation ne sous-compte pas les lignes du pire cas", () => {
    const e32 = "MWMWMWMW MWMWMWMW MWMWMWMW MWMWM";
    expect(e32.length).toBe(32);
    for (const ht of [1920, 1350]) {
      const m = miseEnPageDeHauteurIV(ht);
      expect(lignesEtiquetteEstimees(e32, m.hauteurTexte)).toBeGreaterThanOrEqual(lignesPireCas(e32, m.hauteurTexte));
    }
  });
  it("étiquette courte : une ligne ; étiquette longue : deux", () => {
    expect(lignesEtiquetteEstimees("Étape 1", 1920)).toBe(1);
    expect(lignesEtiquetteEstimees("Les justificatifs clients triés et classés par l'IA", 1920)).toBe(2);
  });
  describe("filet et habillage posés d'après la hauteur d'étiquette réservée", () => {
    for (const format of ["9:16", "4:5"] as const) {
      for (const code of ["ENT-B", "ENT-C", "ENT-D"] as const) {
        it(`${code} · ${format} : étiquettes de 7, 32, 36 et 38 signes`, () => {
          const etiquettes = ["ÉTAPE 1", "SUIVI LE JOUR MÊME DES RELANCES.", "PRÉVENU DE CHAQUE RETARD DE PAIEMENT", "SUIVIS AUTOMATIQUEMENT SANS RELANCERAB"];
          expect(etiquettes.map((e) => e.length)).toEqual([7, 32, 36, 38]);
          for (const e of etiquettes) for (const titre of TITRES) {
            const g = geometrieEntete(code, titre, format, "ivoire", e);
            const haut = g.zone.y;
            expect(g.hauteurEtiquette).toBeCloseTo(g.lignesEtiquette * 1.21 * TAILLES_DUO.etiquette * miseEnPageDeHauteurIV(format === "9:16" ? 1920 : 1350).hauteurTexte, 6);
            if (g.alerte !== null) continue;
            const b = g.boite!;
            if (code === "ENT-C") {
              // Le filet est entre l'étiquette et le titre, jamais dans la boîte du texte.
              expect(b.y).toBeGreaterThanOrEqual(haut + g.hauteurEtiquette - 1e-6);
              expect(b.y + b.hauteur).toBeLessThanOrEqual(g.texte.y + 1e-6);
            } else {
              expect(b.y).toBeLessThanOrEqual(g.texte.y + 1e-6);
              expect(b.y + b.hauteur).toBeGreaterThanOrEqual(g.texte.y + g.texte.hauteur - 1e-6);
              expect(b.y).toBeGreaterThanOrEqual(haut + g.hauteurEtiquette - 1e-6);
            }
          }
        });
      }
    }
  });
  it("ENT-A : aucun habillage", () => {
    expect(geometrieEntete("ENT-A", "Gagnez du temps", "9:16").boite).toBeNull();
  });
});
