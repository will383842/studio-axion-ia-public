/** Vignette par défaut = une vraie image du début de la vidéo finale, sans titre ajouté. */
import { describe, expect, it } from "vitest";
import { choisirImageDebut, instantsDebut, type MesureImage } from "../../studio-rendu/src/operations/miniature";

const bonne = (t: number): MesureImage => ({ instantSec: t, flou: 2, luminosite: 150, contraste: 90 });
const noire = (t: number): MesureImage => ({ instantSec: t, flou: 2, luminosite: 5, contraste: 3 });

describe("instantsDebut", () => {
  it("commence à 0,05 s puis pas de 0,1 s jusqu'à 2 s", () => {
    const { premiers } = instantsDebut(30);
    expect(premiers[0]).toBe(0.05);
    expect(premiers[1]).toBe(0.1);
    expect(premiers[2]).toBe(0.2);
    expect(premiers.at(-1)).toBe(2);
  });
  it("le secours couvre jusqu'à 6 s, après les 2 premières", () => {
    const { premiers, secours } = instantsDebut(30);
    expect(secours[0]).toBeGreaterThan(premiers.at(-1)!);
    expect(secours.at(-1)).toBeLessThanOrEqual(6);
  });
  it("une vidéo très courte : jamais au-delà de sa durée", () => {
    const { premiers, secours } = instantsDebut(1);
    for (const t of [...premiers, ...secours]) expect(t).toBeLessThan(1);
  });
});

describe("choisirImageDebut", () => {
  it("la première image bonne des 2 premières secondes (pas la plus nette d'après)", () => {
    expect(choisirImageDebut([noire(0.05), noire(0.1), bonne(0.2), bonne(0.3)])?.instantSec).toBe(0.2);
  });
  it("toutes rejetées : la meilleure des 6 premières secondes (ni noire ni vide)", () => {
    const r = choisirImageDebut([noire(0.05), { ...bonne(0.5), contraste: 10 }, { ...bonne(3), contraste: 10, flou: 1 }]);
    expect(r?.instantSec).toBe(3);
  });
  it("rien d'utilisable (tout noir) : null, la carte de la charte en dernier recours", () => {
    expect(choisirImageDebut([noire(0.05), noire(1), noire(4)])).toBeNull();
    expect(choisirImageDebut([])).toBeNull();
  });
});
