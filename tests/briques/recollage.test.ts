/** Recollage commun des élisions coupées par Whisper (« l » + « 'IA » → « l'IA ») : brique pure + non-régression des générateurs. */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planRecollage, recollerElisionsHorodatees, recollerElisionsTranscrites } from "../../src/briques/sous-titres/recollage";
import { recollerElisions } from "@/moteurs/montage-facecam-animee/realisateur/mots";
import { recollerMotsWhisper } from "@/moteurs/montage-image-video/ecoute";
import { habillageFacecam } from "@/moteurs/montage-facecam/habillage";
import { habillageFacecamRatio } from "@/moteurs/montage-facecam/declinaisons";
import { exporterSrt } from "@/briques/sous-titres/export";
import { sousTitresIV } from "@/moteurs/montage-image-video/sous-titres";
import { cleMot } from "@/moteurs/montage-image-video/calage";

const REEL = JSON.parse(readFileSync("docs/facecam-animee-v4/repetition-generale/transcription.json", "utf8")).motsPriseBrute as { w: string; a: number; f: number }[];
const lettres = (ws: string[]) => ws.join("").replace(/['’]/g, "").length;

describe("recollage commun · cœur pur", () => {
  it("(a) « l » + « 'IA » → « l'IA »", () => {
    expect(planRecollage(["l", "'IA"])).toEqual([{ de: 0, a: 1, texte: "l'IA" }]);
  });
  it("(b) « 'IA » en tête → « IA »", () => {
    expect(planRecollage(["'IA", "est"])).toEqual([{ de: 0, a: 0, texte: "IA" }, { de: 1, a: 1, texte: "est" }]);
  });
  it("après une ponctuation finale, l'apostrophe est retirée", () => {
    expect(planRecollage(["fin.", "’IA"]).map((p) => p.texte)).toEqual(["fin.", "IA"]);
  });
  it("habillages : champs gardés, temps du premier début et du second fin, fort combiné", () => {
    expect(recollerElisionsTranscrites([{ w: "l", a: 1, f: 1.1, fort: true, x: 1 }, { w: "'IA", a: 1.1, f: 1.4, x: 2 }])).toEqual([{ w: "l'IA", a: 1, f: 1.4, fort: true, x: 1 }]);
    expect(recollerElisionsHorodatees([{ mot: "l", debutSec: 1, finSec: 1.1 }, { mot: "'IA", debutSec: 1.1, finSec: 1.4, enValeur: true }])).toEqual([{ mot: "l'IA", debutSec: 1, finSec: 1.4, enValeur: true }]);
  });
  it("(c) fichier réel : plus aucun mot à apostrophe de tête, lettres conservées", () => {
    const sortie = recollerElisionsTranscrites(REEL);
    expect(REEL.some((m) => /^['’]/.test(m.w))).toBe(true);
    expect(sortie.filter((m) => /^['’]/.test(m.w))).toEqual([]);
    expect(lettres(sortie.map((m) => m.w))).toBe(lettres(REEL.map((m) => m.w)));
  });
});

describe("recollage commun · anti-divergence", () => {
  it("brique = recollerElisions (face caméra animée), mots et début identiques", () => {
    const a = recollerElisions(REEL).map(({ w, a }) => ({ w, a }));
    expect(recollerElisionsTranscrites(REEL).map(({ w, a }) => ({ w, a }))).toEqual(a);
  });
  it("brique = recollerMotsWhisper (Q18) pour les fragments à apostrophe hors ponctuation", () => {
    const cas = [{ mot: "l", debutSec: 0, finSec: 1 }, { mot: "'IA", debutSec: 1, finSec: 2 }, { mot: "d", debutSec: 2, finSec: 3 }, { mot: "'abord", debutSec: 3, finSec: 4 }];
    expect(recollerElisionsHorodatees(cas)).toEqual(recollerMotsWhisper(cas));
  });
  it("brique = recollerElisionsRendu (copie du rendu, nécessite remotion)", async () => {
    const { recollerElisionsRendu } = await import("../../studio-rendu/compositions/interface-claire/VideoAnimeeV4");
    expect(recollerElisionsRendu(REEL).map(({ w, a }) => ({ w, a }))).toEqual(recollerElisionsTranscrites(REEL).map(({ w, a }) => ({ w, a })));
  });
});

describe("face caméra ancien : sous-titres recollés", () => {
  const mots = [
    { mot: "Avec", debutSec: 0, finSec: 0.3 }, { mot: "l", debutSec: 0.3, finSec: 0.4 }, { mot: "'IA", debutSec: 0.4, finSec: 0.8 },
    { mot: "on", debutSec: 0.8, finSec: 1 }, { mot: "gagne", debutSec: 1, finSec: 1.4 }, { mot: "d", debutSec: 1.4, finSec: 1.5 }, { mot: "'abord", debutSec: 1.5, finSec: 2 },
    { mot: "du", debutSec: 2, finSec: 2.2 }, { mot: "temps.", debutSec: 2.2, finSec: 2.8 },
  ];
  const base = { pisteMonteeCle: "p.mov", dureeSec: 3, mots, prefixeCartes: "c" };
  const motsDe = (segs: { mots: { mot: string }[] }[]) => segs.flatMap((s) => s.mots.map((m) => m.mot));
  it("habillageFacecam : aucun mot à apostrophe de tête, SRT « l'IA »", () => {
    const h = habillageFacecam(base);
    expect(motsDe(h.segments).filter((m) => /^['’]/.test(m))).toEqual([]);
    expect(exporterSrt(h.segments)).toContain("l'IA");
  });
  it("habillageFacecamRatio (déclinaisons 4:5) : idem", () => {
    const h = habillageFacecamRatio(base, "4:5");
    expect(motsDe(h.segments).filter((m) => /^['’]/.test(m))).toEqual([]);
    expect(exporterSrt(h.segments)).toContain("l'IA");
  });
});

describe("image → vidéo : sous-titres", () => {
  it("mots HeyGen entiers : sortie strictement identique à la référence d'avant recollage", () => {
    const ref = JSON.parse(readFileSync("tests/fixtures/recollage-iv-reference.json", "utf8"));
    const fichiers = readdirSync("docs/captures/m0b-voix").filter((n) => n.endsWith(".heygen.json"));
    expect(fichiers.length).toBeGreaterThan(0);
    for (const f of fichiers) {
      const mots = JSON.parse(readFileSync(`docs/captures/m0b-voix/${f}`, "utf8")).mots;
      expect(JSON.parse(JSON.stringify(sousTitresIV(mots, { reseaux: ["linkedin"] }))), f).toEqual(ref[f]);
    }
  });
  it("« l » + « 'IA » : un seul mot, « IA » reste mot fort (orange)", () => {
    expect(cleMot("l'IA")).toBe("l ia");
    const mots = [{ mot: "Avec", debutSec: 0, finSec: 0.3 }, { mot: "l", debutSec: 0.3, finSec: 0.4 }, { mot: "'IA", debutSec: 0.4, finSec: 0.8 }, { mot: "on", debutSec: 0.8, finSec: 1 }];
    const st = sousTitresIV(mots, { reseaux: ["linkedin"], motsForts: [{ mot: "l'IA", debutSec: 0.2, finSec: 0.9 }] });
    const tous = st.groupes.flatMap((g) => g.mots);
    expect(tous.map((m) => m.mot)).toEqual(["Avec", "l'IA", "on"]);
    expect(tous.find((m) => m.mot === "l'IA")?.orange).toBe(true);
  });
});
