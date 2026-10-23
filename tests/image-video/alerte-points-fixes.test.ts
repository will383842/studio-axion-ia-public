/**
 * Alerte : les trois points « en train d'écrire » sont FIXES (décision de Will du 17/10 : aucun micro-mouvement).
 * Lecture du source du composant : ni `Math.sin`, ni `interpolate`, ni `spring` ne les anime.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planAlerte } from "@/briques/schema-motion/plan-objets";

const SOURCE = readFileSync("studio-rendu/compositions/image-video/Alerte.tsx", "utf8");

/** Le bloc qui dessine les trois points (de leur `map` à sa fermeture). */
function blocPoints(): string {
  const debut = SOURCE.indexOf("[0, 1, 2].map");
  expect(debut).toBeGreaterThan(-1);
  return SOURCE.slice(debut, SOURCE.indexOf("))}", debut) + 3);
}

describe("Alerte : points « en train d'écrire » sans micro-mouvement", () => {
  it("aucune oscillation ni interpolation ne les anime", () => {
    const bloc = blocPoints();
    expect(bloc).not.toMatch(/Math\.(sin|cos)|interpolate|spring/);
    expect(bloc).not.toMatch(/\bt\b\s*[*\-+]/);
  });

  it("leur opacité est une constante", () => {
    expect(blocPoints()).toMatch(/opacity: 0\.\d+ \}\}/);
  });

  it("le composant n'utilise ni Math.sin ni interpolate", () => {
    expect(SOURCE).not.toMatch(/Math\.sin|interpolate\(/);
  });
});

describe("Alerte : la notification ne recouvre pas les déclencheurs en chutant", () => {
  it("avec deux déclencheurs, son haut reste sous le dernier déclencheur pendant toute la chute et la secousse", () => {
    const p = {
      source: "Telegram",
      message: "Intervention requise",
      t: 2,
      declencheurs: [
        { texte: "Ticket urgent", t: 0.5 },
        { texte: "Envoyé équipe concernée", t: 1 },
      ],
    };
    for (let t = p.t; t <= p.t + 0.8 + 1e-9; t += 0.02) {
      const a = planAlerte(p, t);
      const dernier = a.declencheurs[a.declencheurs.length - 1]!;
      const haut = a.notification.y + a.decalageY + a.secousse.y;
      expect(haut, `t = ${t.toFixed(2)} s`).toBeGreaterThanOrEqual(dernier.y + dernier.hauteur - 1);
    }
  });

  it("un déclencheur dit APRÈS la notification (d.t > p.t) ne la recouvre pas non plus, entrée du déclencheur comprise", () => {
    const p = {
      source: "Telegram",
      message: "Intervention requise",
      t: 2,
      declencheurs: [
        { texte: "Ticket urgent", t: 0.5 },
        { texte: "Envoyé équipe concernée", t: 2.4 },
      ],
    };
    for (let t = 0; t <= 4 + 1e-9; t += 0.02) {
      const a = planAlerte(p, t);
      const dernier = a.declencheurs[a.declencheurs.length - 1]!;
      const bas = dernier.y + dernier.decalageY + dernier.hauteur;
      const haut = a.notification.y + a.decalageY + a.secousse.y;
      if (a.opacite > 0.05 && dernier.opacite > 0.05) expect(haut, `t = ${t.toFixed(2)} s`).toBeGreaterThanOrEqual(bas - 1);
    }
  });

  it("sans déclencheur, la notification tombe toujours de 420 px", () => {
    expect(planAlerte({ source: "Telegram", message: "x", t: 1 }, 0.5).decalageY).toBe(-420);
  });
});
