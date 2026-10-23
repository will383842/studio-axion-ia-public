/**
 * VÉRIF V2 (10/10) — cartes automatiques rendues pour de vrai (studio-rendu, Remotion) sur IMG_7747 : la carte
 * « icône + mot » (« Pas un problème de travail » → « Une fuite ») posait le mot géant SUR la 2e ligne du sur-titre.
 * La géométrie supposait un sur-titre d'une ligne ; un sur-titre de 30 caractères au plus (schéma) en fait souvent deux
 * en écran partagé (capitales espacées de 0,16 em).
 */
import { describe, expect, it } from "vitest";
import { geometrieIconeMot } from "../studio-rendu/compositions/commune/motion/MotionIconeMot";
import { couperLignes, hauteurTexte } from "@/briques/motion/mesure";
import { INTERLIGNE, taillePx } from "@/briques/motion/jetons";

const tailles = { affiche: taillePx("affiche", 1920), titre: taillePx("titre", 1920), corps: taillePx("corps", 1920), legende: taillePx("legende", 1920) };
const mesurer = (texte: string, taille: number, graisse: number, largeur: number, niveau: "affiche" | "corps") => hauteurTexte(texte, niveau, taille, graisse, largeur);
const zone = { x: 80, y: 60, largeur: 920, hauteur: 840 };

describe("Vérif V2 — carte « icône + mot » : le sur-titre n'est jamais recouvert", () => {
  for (const moitie of [true, false]) {
    it(`sur-titre sur deux lignes (${moitie ? "écran partagé" : "plein écran"}) : le mot commence sous lui`, () => {
      const d = { surTitre: "Pas un problème de travail", mot: "Une fuite", icone: "goutte" as const, aSec: 1.6 };
      const g = geometrieIconeMot(d, zone, moitie, 1, tailles, mesurer);
      const largeurSur = zone.largeur - (moitie ? 1 : 2) * 92;
      const lignes = couperLignes(d.surTitre.toUpperCase(), tailles.legende, 700, largeurSur, 0.16).length;
      expect(lignes).toBe(2);
      const basSurTitre = g.haut + lignes * tailles.legende * INTERLIGNE.legende;
      expect(g.texte.y).toBeGreaterThanOrEqual(basSurTitre);
      // L'icône aussi reste sous le sur-titre.
      expect(g.cy - g.R).toBeGreaterThanOrEqual(basSurTitre);
    });
  }

  it("sur-titre court (une ligne) : géométrie inchangée", () => {
    const d = { surTitre: "Un seul mot", mot: "Déléguer", icone: "robot" as const };
    const sans = geometrieIconeMot({ ...d, surTitre: undefined }, zone, true, 1, tailles, mesurer);
    const avec = geometrieIconeMot(d, zone, true, 1, tailles, mesurer);
    expect(avec.hSur).toBeCloseTo(tailles.legende * 1.4 + 34, 5);
    expect(sans.hSur).toBe(0);
  });
});

import { planifierCartesAuto } from "@/briques/habillage-facecam";

describe("Vérif V2 — carte « chiffre » automatique : le sur-titre nomme la chose, sans le verbe", () => {
  const motsDe = (phrase: string, depart = 1) => phrase.split(/\s+/).map((mot, i) => ({ mot, debutSec: +(depart + i * 0.3).toFixed(2), finSec: +(depart + i * 0.3 + 0.25).toFixed(2) }));
  for (const [phrase, attendu] of [
    ["Le diagnostic fuite dure 45 minutes, il est gratuit et se fait en visio.", "Diagnostic fuite"],
    ["Un audit complet prend 3 jours, sur place.", "Audit complet"],
  ] as const) {
    it(`« ${phrase} » → « ${attendu} » (avant : « … ${phrase.split(/\s+/)[3]} »)`, () => {
      const cartes = planifierCartesAuto(motsDe(phrase), 20);
      const chiffre = cartes.find((c) => c.carte.modele === "chiffre");
      expect(chiffre).toBeTruthy();
      expect((chiffre!.carte.donnees as { surTitre?: string }).surTitre).toBe(attendu);
    });
  }
});
