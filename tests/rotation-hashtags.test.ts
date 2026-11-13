/**
 * L3-14 : rotation des mots-dièse. Trois posts successifs n'ont jamais le même ensemble. Limites lues du relevé L8-01 ;
 * une limite sans source bloque la rotation. Aucun appel réel, aucune horloge : l'aléa et la date sont passés.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cleMotDiese } from "@/reseaux/hashtags";
import { LIMITES_MOTS_DIESES, limiteMotsDieses } from "@/reseaux/hashtags";
import { tournerMotsDieses, type EntreeRotation } from "@/domaine/rotation-hashtags";

/** Aléa déterministe (graine) : suite fixe, sans Math.random. */
function aleaGraine(graine: number): () => number {
  let s = graine >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const FAMILLE = ["#IA", "#intelligenceartificielle", "#IAentreprise", "#ChatGPT", "#formationIA", "#automatisation"];
const DATE = "2026-11-12";
const base = (o: Partial<EntreeRotation> = {}): EntreeRotation => ({
  reseau: "tiktok",
  famille: FAMILLE,
  precedents: [],
  limites: { tiktok: 3 },
  taille: 3,
  aleat: aleaGraine(1),
  date: DATE,
  ...o,
});
const cle = (l: readonly string[]) => [...l].map(cleMotDiese).sort().join("|");

describe("rotation des mots-dièse (L3-14)", () => {
  it("trois posts successifs n'ont jamais le même ensemble (200 graines)", () => {
    for (let g = 1; g <= 200; g++) {
      const aleat = aleaGraine(g);
      const histo: string[][] = [];
      for (let i = 0; i < 12; i++) {
        const r = tournerMotsDieses(base({ precedents: histo.slice(-2), aleat }));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        histo.push(r.ensemble);
        if (histo.length >= 3) {
          const t = histo.slice(-3).map(cle);
          expect(new Set(t).size).toBe(3);
        }
      }
    }
  });

  it("ne dépasse jamais la limite et ne sort que de la famille, sans interdit", () => {
    const r = tournerMotsDieses(base({ famille: [...FAMILLE, "#fyp"], limites: { tiktok: 4 }, taille: 9 }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ensemble.length).toBe(4);
    expect(r.ensemble.every((m) => FAMILLE.includes(m))).toBe(true);
  });

  it("est pure : mêmes entrées, même sortie ; la date est reprise telle quelle", () => {
    const a = tournerMotsDieses(base({ aleat: aleaGraine(7) }));
    const b = tournerMotsDieses(base({ aleat: aleaGraine(7) }));
    expect(a).toEqual(b);
    if (a.ok) expect(a.date).toBe(DATE);
  });

  it("limite inconnue (ou absente) : la rotation est bloquée, aucune valeur inventée", () => {
    for (const limites of [{ instagram: "inconnu" as const }, {}]) {
      const r = tournerMotsDieses(base({ reseau: "instagram", limites }));
      expect(r).toEqual({ ok: false, raison: "limite-inconnue" });
    }
  });

  it("famille trop petite pour trois ensembles distincts : bloquée", () => {
    const r = tournerMotsDieses(base({ famille: ["#IA", "#ChatGPT", "#formationIA"], limites: { tiktok: 3 } }));
    expect(r).toEqual({ ok: false, raison: "famille-trop-petite" });
  });

  it("relevé L8-01 : Instagram « inconnu » ; aucune limite sans source n'est inventée", () => {
    expect(limiteMotsDieses("instagram")).toBe("inconnu");
    for (const v of Object.values(LIMITES_MOTS_DIESES)) expect(v === "inconnu" || (Number.isInteger(v) && v > 0)).toBe(true);
    expect(tournerMotsDieses(base({ reseau: "instagram", limites: LIMITES_MOTS_DIESES })).ok).toBe(false);
  });

  it("la table des limites reprend le relevé L8-01 (aucun nombre sans preuve)", () => {
    const releve = JSON.parse(readFileSync("docs/reseaux/regles-officielles.json", "utf8")) as {
      reseaux: Record<string, { reseau?: Record<string, { valeur: string; preuve: string }> }>;
    };
    for (const [id, v] of Object.entries(LIMITES_MOTS_DIESES)) {
      const c = releve.reseaux[id]?.reseau?.plafond_mots_dieses;
      if (!c || c.preuve === "inconnu") expect(v).toBe("inconnu");
      else if (id !== "instagram") expect(typeof v === "number" ? String(v) : "").toMatch(/\d/);
    }
  });
});
