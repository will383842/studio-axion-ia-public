import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { grapheBrollPlage, type EntreeBrollPlage } from "../../studio-rendu/src/composition/graphe-broll-plage";

const base = (): EntreeBrollPlage => ({
  master: { largeur: 1080, hauteur: 1920, fps: 30 },
  extrait: { entree: 1, debutSec: 2, finSec: 6 },
  plage: { debutSec: 5, finSec: 8.5 },
  transitionsVisage: [],
});

describe("grapheBrollPlage", () => {
  it("donne la chaîne exacte pour un cas 9:16", () => {
    const r = grapheBrollPlage(base());
    expect(r).toEqual({
      ok: true,
      filtre:
        "[1:v]trim=start=2:end=5.5,setpts=PTS-STARTPTS+5/TB,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1[vb1_5000]" +
        ";[0:v][vb1_5000]overlay=enable='between(t,5,8.5)':eof_action=pass[vo1_5000]",
      cartes: ["[vo1_5000]", "0:a"],
    });
  });

  it("recopie le son du master : carte audio 0:a, aucun mixage", () => {
    const r = grapheBrollPlage(base());
    if (!r.ok) throw new Error("attendu ok");
    expect(r.cartes[1]).toBe("0:a");
    expect(r.filtre).not.toMatch(/\[\d+:a\]|amix|amerge|volume/);
  });

  it("refuse une plage qui chevauche une transition de visage", () => {
    const r = grapheBrollPlage({ ...base(), transitionsVisage: [{ debutSec: 8, finSec: 9 }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toMatch(/transition/);
  });

  it("accepte une transition qui touche seulement le bord", () => {
    expect(grapheBrollPlage({ ...base(), transitionsVisage: [{ debutSec: 8.5, finSec: 9 }, { debutSec: 4, finSec: 5 }] }).ok).toBe(true);
  });

  it("refuse un extrait plus court que la plage", () => {
    const r = grapheBrollPlage({ ...base(), extrait: { entree: 1, debutSec: 2, finSec: 4 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toMatch(/court/);
  });

  it("refuse une plage hors durée ou incohérente", () => {
    expect(grapheBrollPlage({ ...base(), plage: { debutSec: -1, finSec: 2 } }).ok).toBe(false);
    expect(grapheBrollPlage({ ...base(), plage: { debutSec: 5, finSec: 5 } }).ok).toBe(false);
    expect(grapheBrollPlage({ ...base(), master: { largeur: 1080, hauteur: 1920, fps: 30, dureeSec: 7 } }).ok).toBe(false);
    expect(grapheBrollPlage({ ...base(), plage: { debutSec: Number.NaN, finSec: 2 } }).ok).toBe(false);
  });

  it("refuse un master ou une entrée invalide", () => {
    expect(grapheBrollPlage({ ...base(), master: { largeur: 0, hauteur: 1920, fps: 30 } }).ok).toBe(false);
    expect(grapheBrollPlage({ ...base(), extrait: { entree: 0, debutSec: 2, finSec: 6 } }).ok).toBe(false);
  });

  it("étiquettes distinctes pour deux graphes différents", () => {
    const a = grapheBrollPlage(base());
    const b = grapheBrollPlage({ ...base(), extrait: { entree: 2, debutSec: 0, finSec: 4 }, plage: { debutSec: 10, finSec: 12 } });
    if (!a.ok || !b.ok) throw new Error("attendu ok");
    expect(a.cartes[0]).not.toBe(b.cartes[0]);
  });

  it("garde statique : pas d'import @/, pas de spawn, pas d'amix/amerge", () => {
    const src = readFileSync("studio-rendu/src/composition/graphe-broll-plage.ts", "utf8");
    expect(src).not.toMatch(/from\s+["']@\//);
    expect(src).not.toMatch(/amix|amerge|spawn/);
  });
});
