/**
 * GV2-21 : chaque ligne reste visible assez longtemps, le .srt garde tous les mots, et le contrôle compare les mots
 * du script aux mots réellement dessinés (jamais bloquant).
 */
import { describe, expect, it } from "vitest";
import type { MotHorodate, SegmentSousTitres } from "@/domaine/types";
import { grouperMots } from "@/briques/sous-titres/groupement";
import { exporterSrt } from "@/briques/sous-titres/export";
import { controlerSousTitres, donneesCalque } from "@/briques/sous-titres";

const FPS = 30;
const COULEURS = { texte: "#F3EDE4", accent: "#E07040", contour: "#16120F" };
const MOTS = "voici le texte du script qui doit rester entierement visible dans la video finale avec chaque mot present et rien ne manque jamais".split(" ").slice(0, 22);

/** Voix rapide : un mot toutes les `pas` secondes, sans blanc. */
function voix(n: number, pas: number, debut = 0): MotHorodate[] {
  return MOTS.slice(0, n).map((m, i) => ({ mot: m, debutSec: +(debut + i * pas).toFixed(3), finSec: +(debut + (i + 1) * pas).toFixed(3) }));
}
const complet = (segments: SegmentSousTitres[]) => segments.map((s) => ({ ...s, style: "base" as const, importance: 0, souligne: null, position: "auto" as const, inclinaison: 0 }));
const calque = (segments: SegmentSousTitres[]) => donneesCalque({ segments: complet(segments), base: "karaoke", couleurs: COULEURS, reseaux: ["tiktok"] });
const motsDe = (srt: string) => srt.split("\n\n").flatMap((b) => b.split("\n").slice(2).join(" ").split(/\s+/)).filter(Boolean);

describe("GV2-21 : durée minimale d'une ligne", () => {
  it("voix rapide (B) : aucune ligne sous 6 images, sauf une ligne seule de fin", () => {
    const segs = grouperMots(voix(22, 0.06));
    for (const [i, s] of segs.entries()) {
      const derniere = i === segs.length - 1;
      if (!derniere) expect(s.finSec - s.debutSec).toBeGreaterThanOrEqual(0.2 - 1e-6);
      expect(s.finSec - s.debutSec).toBeGreaterThan(0);
    }
    expect(segs.flatMap((s) => s.mots).length).toBe(22);
  });

  it("jamais d'affichage pendant un vrai blanc long", () => {
    const mots = [...voix(4, 0.05), ...voix(4, 0.05, 2)];
    const segs = grouperMots(mots);
    const pendantBlanc = segs.filter((s) => s.debutSec < 1.9 && s.finSec > 0.7 && s.finSec - s.debutSec > 0.9);
    expect(pendantBlanc).toEqual([]);
  });
});

describe("GV2-21 : le .srt garde tous les mots", () => {
  it("ligne de durée nulle (C) : ses mots rejoignent la voisine", () => {
    const m = (t: string, d: number, f: number) => ({ mot: t, debutSec: d, finSec: f });
    const segs: SegmentSousTitres[] = complet([
      { id: "a", debutSec: 0, finSec: 1, mots: [m("un", 0, 0.5), m("deux", 0.5, 1)] },
      { id: "b", debutSec: 1, finSec: 1, mots: [m("trois", 1, 1.1)] },
      { id: "c", debutSec: 1, finSec: 2, mots: [m("quatre", 1.1, 2)] },
    ] as SegmentSousTitres[]);
    expect(motsDe(exporterSrt(segs))).toEqual(["un", "deux", "trois", "quatre"]);
  });

  it("ligne nulle en tête : ses mots passent à la suivante (E)", () => {
    const m = (t: string, d: number, f: number) => ({ mot: t, debutSec: d, finSec: f });
    const segs = complet([
      { id: "a", debutSec: 0, finSec: 0, mots: [m("un", 0, 0.1)] },
      { id: "b", debutSec: 0, finSec: 1, mots: [m("deux", 0.1, 1)] },
    ] as SegmentSousTitres[]);
    expect(motsDe(exporterSrt(segs))).toEqual(["un", "deux"]);
  });

  it("voix rapide : 22 mots dans le .srt", () => {
    expect(motsDe(exporterSrt(grouperMots(voix(22, 0.06)))).length).toBe(22);
  });
});

describe("GV2-21 : contrôle « mots du script = mots dessinés »", () => {
  const script = (n: number) => MOTS.slice(0, n);

  it("script normal : aucune alerte", () => {
    const d = calque(grouperMots(voix(22, 0.3)));
    expect(controlerSousTitres(d, { motsScript: script(22), dureeVideoSec: 22 * 0.3 + 1, fps: FPS })).toEqual([]);
  });

  it("vidéo plus courte que la voix (D) : alerte « sous-titres-incomplets », jamais bloquante", () => {
    const d = calque(grouperMots(voix(22, 0.3)));
    const a = controlerSousTitres(d, { motsScript: script(22), dureeVideoSec: 3, fps: FPS });
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ code: "sous-titres-incomplets", gravite: "attention" });
    expect(a[0].message).toMatch(/mot\(s\) du texte jamais affiché\(s\)/);
  });

  it("voix qui ne rend pas les derniers mots : alerte", () => {
    const d = calque(grouperMots(voix(12, 0.3)));
    const a = controlerSousTitres(d, { motsScript: script(22), dureeVideoSec: 10, fps: FPS });
    expect(a[0]?.code).toBe("sous-titres-incomplets");
    expect(a[0].message).toContain("10 mot(s)");
  });

  it("comparaison sans casse ni ponctuation", () => {
    const d = calque(grouperMots(voix(4, 0.3)));
    expect(controlerSousTitres(d, { motsScript: ["Voici,", "LE", "texte", "du."], dureeVideoSec: 5, fps: FPS })).toEqual([]);
  });

  it("un groupe masqué exprès (carte, montant) ne déclenche pas l'alerte", () => {
    const segs = grouperMots(voix(8, 0.3));
    const sans = segs.slice(0, 1).concat(segs.slice(2));
    const d = calque(sans);
    const manque = segs[1].mots.length;
    expect(controlerSousTitres(d, { motsScript: script(8), dureeVideoSec: 5, fps: FPS })[0]?.code).toBe("sous-titres-incomplets");
    expect(controlerSousTitres(d, { motsScript: script(8), motsVoulusMasques: manque, dureeVideoSec: 5, fps: FPS })).toEqual([]);
  });

  it("sans les options : résultat identique à avant", () => {
    const d = calque(grouperMots(voix(4, 0.3)));
    expect(controlerSousTitres(d)).toEqual([]);
  });
});
