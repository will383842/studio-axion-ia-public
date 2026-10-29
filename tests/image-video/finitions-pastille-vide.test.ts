/**
 * Finitions 4:5 : la pastille de rang ne recouvre jamais le surtitre (étiquette) d'un écran « chiffres », et un écran de
 * script collé n'a pas de texte plus long que le plafond de lisibilité (Q21). Le 9:16 est inchangé.
 */
import { describe, expect, it } from "vitest";
import { decalageRepereSurEtiquette, HAUT_REPERE, largeurRepereIV, PLANCHER_PX } from "@/briques/schema-motion/plan-objets";
import { REGLES_SCENE_IV } from "@/moteurs/montage-image-video/regles-scene";
import { ECRAN_CARACTERES_MAX, ECRAN_MOTS_MAX, ecransDuScript } from "@/moteurs/montage-image-video/script-colle";

const HAUT = HAUT_REPERE * 1920 - 60;
const Y_ETIQUETTE = 96;

function boites(etiquette: string, total = 3) {
  const d = decalageRepereSurEtiquette({ etiquette, yEtiquette: Y_ETIQUETTE, hautRepere: HAUT, total });
  const l = largeurRepereIV(total);
  const x = (1080 - l) / 2 + d.dx;
  return { d, repere: { x0: x, x1: x + l, y0: HAUT + d.dy, y1: HAUT + d.dy + PLANCHER_PX * 1.3 }, etiquette: { x0: 72, x1: 72 + etiquette.length * 28, y0: Y_ETIQUETTE, y1: Y_ETIQUETTE + 28 * 1.15 } };
}
const seRecouvrent = (a: { x0: number; x1: number; y0: number; y1: number }, b: typeof a) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

describe("pastille de rang 4:5 et surtitre", () => {
  it("sans étiquette : aucun décalage", () => {
    expect(decalageRepereSurEtiquette({ yEtiquette: Y_ETIQUETTE, hautRepere: HAUT, total: 3 })).toEqual({ dx: 0, dy: 0 });
  });
  it("étiquette longue ou courte : jamais de recouvrement", () => {
    for (const e of ["TEMPS GAGNÉ", "COMBIEN ÇA COÛTE", "CE QUE VOUS PERDEZ CHAQUE SEMAINE", "A"]) {
      const b = boites(e);
      expect(seRecouvrent(b.repere, b.etiquette), e).toBe(false);
    }
  });
  it("étiquette courte : la pastille va à droite, sur la même ligne ; longue : elle descend sous le surtitre", () => {
    expect(boites("TEMPS GAGNÉ").d.dy).toBe(0);
    expect(boites("TEMPS GAGNÉ").d.dx).toBeGreaterThan(0);
    expect(boites("CE QUE VOUS PERDEZ CHAQUE SEMAINE").d.dy).toBeGreaterThan(0);
  });
  it("la pastille reste dans le cadre (marges de 72 px)", () => {
    const b = boites("TEMPS GAGNÉ").repere;
    expect(b.x1).toBeLessThanOrEqual(1080 - 72 + 0.5);
    expect(b.x0).toBeGreaterThanOrEqual(0);
  });
});

describe("écrans d'un script collé : seuils cohérents", () => {
  it("les mots plafonnent au plafond de signes de la lisibilité", () => {
    expect(ECRAN_CARACTERES_MAX).toBe(REGLES_SCENE_IV.signesMax);
    expect(ECRAN_MOTS_MAX).toBeLessThanOrEqual(Math.ceil(REGLES_SCENE_IV.signesMax / 5.5));
  });
  it("une phrase de 15 mots courts est coupée sous 70 signes, sans changer un mot", () => {
    const script = ["Bonjour tout le monde.", "Votre cabinet perd chaque semaine plusieurs heures précieuses à ressaisir des chiffres que personne ne relit vraiment jamais.", "Un.", "Deux.", "Trois.", "Quatre. Voilà."].join(" ");
    const ecrans = ecransDuScript(script).map((m) => m.join(" "));
    for (const e of ecrans.slice(1, -1)) expect(e.length, e).toBeLessThanOrEqual(REGLES_SCENE_IV.signesMax);
    expect(ecrans.join(" ").split(/\s+/)).toEqual(script.split(/\s+/));
  });
});
