import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { cleBruitage, idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { DeclencheurBruitage } from "@/domaine/types";
import {
  CLOTURE_AVANT_FIN_SEC, DECLENCHEUR_IV, ECART_MIN_SEC, GENRES_EVENEMENT, PHRASE_AUCUN_VALIDE, SILENCE_MAX_SEC,
  SORTE_DE_GENRE, SORTES_BRUITAGE_IV, estChangementVisible, poserBruitagesIV,
  type BruitageValideIV, type EvenementIV,
} from "@/moteurs/montage-image-video/bruitages";

const EXISTANTS: readonly DeclencheurBruitage[] = ["chiffre", "document", "telephone", "illustration-forte", "impact"];
const valides: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));

const ev = (id: string, genre: EvenementIV["genre"], instantSec: number, extra: Partial<EvenementIV> = {}): EvenementIV => ({ id, genre, instantSec, ...extra });
/** Ligne de temps déterministe : un changement visible tous les 1,4 s, du début jusqu'à la clôture, en suivant un motif de genres. */
function ligneDe(dureeSec: number, motif: readonly EvenementIV["genre"][], extra: EvenementIV[] = []): { dureeSec: number; evenements: EvenementIV[] } {
  const evenements: EvenementIV[] = [ev("s0", "scene", 0.3)];
  for (let i = 0, t = 1.7; t < dureeSec - CLOTURE_AVANT_FIN_SEC; i++, t = +(t + 1.4).toFixed(3)) {
    const genre = motif[i % motif.length];
    evenements.push(genre === "compteur" ? ev(`e${i}`, genre, t, { pas: 4, finSec: +(t + 0.9).toFixed(3) }) : ev(`e${i}`, genre, t));
  }
  return { dureeSec, evenements: [...evenements, ...extra] };
}

/** Six lignes de temps d'essai, une par grande famille de scène. */
const LIGNES: Record<string, { dureeSec: number; evenements: EvenementIV[] }> = {
  schemaSimple: ligneDe(30, ["noeud", "noeud", "objet"], [ev("c0", "camera", 9, { marque: true }), ev("c1", "camera", 15)]),
  embranchement: ligneDe(28, ["separation", "noeud", "noeud", "fond"]),
  entonnoir: ligneDe(32, ["chute", "chute", "objet", "chiffre"]),
  chiffres: ligneDe(26, ["chiffre", "compteur", "chiffre", "scene"]),
  courriel: ligneDe(24, ["frappe", "alerte", "objet"]),
  coches: ligneDe(22, ["coche", "coche", "coche", "noeud", "fond"]),
};

describe("rattachement aux déclencheurs existants", () => {
  it("chaque sorte se résout vers l'un des 5 déclencheurs existants", () => {
    for (const s of SORTES_BRUITAGE_IV) expect(EXISTANTS).toContain(DECLENCHEUR_IV[s]);
    expect(Object.keys(DECLENCHEUR_IV).sort()).toEqual([...SORTES_BRUITAGE_IV].sort());
  });
  it("rattachement fixé par le plan", () => {
    expect(DECLENCHEUR_IV).toMatchObject({ separation: "illustration-forte", camera: "illustration-forte", chute: "document", frappe: "document", coche: "chiffre", alerte: "telephone" });
  });
  it("chaque genre d'événement a une sorte", () => {
    for (const g of GENRES_EVENEMENT) expect(SORTES_BRUITAGE_IV).toContain(SORTE_DE_GENRE[g]);
    expect(estChangementVisible("camera")).toBe(false);
  });
  it("la banque a bien 20 sons, 4 par déclencheur, et leurs fichiers existent", () => {
    expect(SONS_BANQUE).toHaveLength(20);
    for (const s of SONS_BANQUE) expect(existsSync(resolve("public", cleBruitage(s).slice(1)))).toBe(true);
  });
});

describe.each(Object.entries(LIGNES))("ligne de temps « %s »", (_nom, ligne) => {
  const r = poserBruitagesIV({ ...ligne, valides });
  it("pose des sons, tous issus des sons reçus", () => {
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ids = new Set(valides.map((v) => v.elementId));
    expect(r.bruitages.length).toBeGreaterThan(0);
    for (const b of r.bruitages) {
      expect(ids.has(b.elementId)).toBe(true);
      expect(EXISTANTS).toContain(b.declencheur);
      expect(b.gainDb).toBeLessThan(0);
    }
  });
  it("au moins 1 son par changement visible et aucun silence total > 1,5 s", () => {
    if (!r.ok) throw new Error("refus inattendu");
    expect(r.rapport.changementsSansSon).toEqual([]);
    expect(r.rapport.plusLongSilenceSec).toBeLessThanOrEqual(SILENCE_MAX_SEC + 1e-9);
  });
  it("jamais deux sons à moins de 0,1 s ; rien dans la dernière seconde ; clôture 1,5 s avant la fin", () => {
    if (!r.ok) throw new Error("refus inattendu");
    const t = r.bruitages.map((b) => b.debutSec);
    expect(t).toEqual([...t].sort((a, b) => a - b));
    for (let i = 1; i < t.length; i++) expect(t[i] - t[i - 1]).toBeGreaterThanOrEqual(ECART_MIN_SEC - 1e-9);
    const cloture = r.bruitages.filter((b) => b.planId === "cloture");
    expect(cloture).toHaveLength(1);
    expect(cloture[0].debutSec).toBeCloseTo(ligne.dureeSec - CLOTURE_AVANT_FIN_SEC, 3);
    expect(Math.max(...t)).toBeLessThan(ligne.dureeSec - 1);
  });
  it("jamais deux fois la même variante de suite pour un même déclencheur", () => {
    if (!r.ok) throw new Error("refus inattendu");
    for (const d of EXISTANTS) {
      const ids = r.bruitages.filter((b) => b.declencheur === d).map((b) => b.elementId);
      for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
    }
  });
  it("déterministe, indépendant de l'ordre d'arrivée", () => {
    const inverse = poserBruitagesIV({ dureeSec: ligne.dureeSec, evenements: [...ligne.evenements].reverse(), valides: [...valides].reverse() });
    expect(JSON.stringify(inverse)).toBe(JSON.stringify(r));
  });
  it("aucune piste de musique", () => {
    expect(JSON.stringify(r).toLowerCase()).not.toContain("musique");
    expect(JSON.stringify(r).toLowerCase()).not.toContain("music");
  });
});

describe("refus et limites", () => {
  it("aucun son validé : refus explicite, jamais une vidéo muette", () => {
    const r = poserBruitagesIV({ ...LIGNES.schemaSimple, valides: [] });
    expect(r).toEqual({ ok: false, motif: PHRASE_AUCUN_VALIDE });
    expect(PHRASE_AUCUN_VALIDE).toBe("aucun bruitage validé");
  });
  it("un seul déclencheur validé : les autres sont signalés, pas posés", () => {
    const seul = valides.filter((v) => v.declencheur === "chiffre");
    const r = poserBruitagesIV({ ...LIGNES.coches, valides: seul });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bruitages.every((b) => b.declencheur === "chiffre")).toBe(true);
    expect(r.rapport.declencheursSansSon).toContain("impact");
  });
  it("la caméra non marquée ne pose rien ; marquée, elle reçoit un souffle", () => {
    const sans = poserBruitagesIV({ dureeSec: 10, valides, evenements: [ev("c", "camera", 4)] });
    const avec = poserBruitagesIV({ dureeSec: 10, valides, evenements: [ev("c", "camera", 4, { marque: true })] });
    if (!sans.ok || !avec.ok) throw new Error("refus inattendu");
    expect(sans.bruitages.map((b) => b.planId)).toEqual(["cloture"]);
    expect(avec.bruitages.map((b) => b.planId)).toEqual(["camera-c", "cloture"]);
  });
  it("deux événements collés : le plus parlant reste (la coche l'emporte sur le souffle)", () => {
    const r = poserBruitagesIV({ dureeSec: 12, valides, evenements: [ev("f", "fond", 5), ev("k", "coche", 5.05)] });
    if (!r.ok) throw new Error("refus inattendu");
    expect(r.bruitages.map((b) => b.planId)).toEqual(["coche-k", "cloture"]);
    expect(r.rapport.changementsSansSon).toEqual([]);
  });
});

describe("page d'écoute", () => {
  it("liste chaque fichier de public/bruitages", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const page = readFileSync(resolve("docs/formats/image-video/ecoute-bruitages.md"), "utf8");
    const wavs = readdirSync(resolve("public/bruitages")).filter((f) => f.endsWith(".wav")).sort();
    expect(wavs.length).toBe(24);
    for (const f of wavs) expect(page).toContain(`public/bruitages/${f}`);
  });
});
