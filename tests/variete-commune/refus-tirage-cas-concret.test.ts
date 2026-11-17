import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { versCommun } from "@/briques/variete-commune/vocabulaire";
import { empreinteCasConcret } from "@/services/variete-commune/empreintes-a";
import { empreinteDuTirage, refusPourTirage } from "@/services/variete-commune/refus-tirage-cas-concret";
import { mettre, tirer, type EcranAMettre, type Tirage } from "@/moteurs/montage-cas-concret/variete";
import type { EmpreinteVideo, ResultatGarde } from "@/briques/variete-commune/types";

const LE = "2026-11-17T10:00:00.000Z";
const OUV_CHIFFRE = versCommun("cas-concret", "ouverture", "chiffre-choc");
const ECRANS: EcranAMettre[] = [{ id: "e01", type: "titre" }, { id: "e02", type: "etape" }, { id: "e03", type: "etape" }];

const TIRAGES: Tirage[] = Array.from({ length: 200 }, (_, i) => tirer({ videoId: "v" + i, canaux: [], historique: [] }));
const OUV_CHIFFRE_TIRAGE = TIRAGES.findIndex((t) => t.ouverture === "chiffre-choc");
const AUTRE_TIRAGE = TIRAGES.findIndex((t) => t.ouverture !== "chiffre-choc");

describe("empreinteDuTirage", () => {
  it.each(TIRAGES.map((t, i) => [i, t] as const))("tirage %i : mêmes axes que empreinteCasConcret (hors transitions)", (_i, t) => {
    const ref = empreinteCasConcret("v1", LE, mettre(t, ECRANS));
    delete ref.axes.transitions;
    const e = empreinteDuTirage("v1", LE, t);
    expect(e.version).toBe(ref.version);
    expect(e.formatId).toBe(ref.formatId);
    expect(e.videoId).toBe("v1");
    expect(e.le).toBe(LE);
    expect(e.axes).toEqual(ref.axes);
    expect(Object.keys(e.axes)).toEqual(Object.keys(ref.axes));
    expect(e.axes.transitions).toBeUndefined();
  });
  it("les tirages réels couvrent « aucune-v4 » habillé et un autre style habillé", () => {
    expect(TIRAGES.some((t) => t.habille === true && t.camera.style === "aucune-v4")).toBe(true);
    expect(TIRAGES.some((t) => t.habille === true && t.camera.style !== "aucune-v4")).toBe(true);
  });
  it("déterministe", () => {
    expect(empreinteDuTirage("v", LE, TIRAGES[AUTRE_TIRAGE])).toEqual(empreinteDuTirage("v", LE, TIRAGES[AUTRE_TIRAGE]));
  });
});

const garde = (ok: boolean, phrase = ""): ResultatGarde => ({ ok, score: null, axesCommuns: [], phrase });

describe("refusPourTirage", () => {
  const rejetteChiffreChoc = (e: EmpreinteVideo) =>
    e.axes.ouverture?.includes(OUV_CHIFFRE) ? garde(false, "ouverture déjà vue") : garde(true);
  it("raison non nulle pour le tirage rejeté, null pour un autre", () => {
    const f = refusPourTirage(rejetteChiffreChoc, "v1", LE);
    expect(f(TIRAGES[OUV_CHIFFRE_TIRAGE])).toBe("ouverture déjà vue");
    expect(f(TIRAGES[AUTRE_TIRAGE])).toBeNull();
  });
  it("phrase vide : repli", () => {
    expect(refusPourTirage(() => garde(false, ""), "v1", LE)(TIRAGES[OUV_CHIFFRE_TIRAGE])).toBe("trop proche d'une vidéo récente");
  });
  it("exception → null", () => {
    expect(refusPourTirage(() => { throw new Error("x"); }, "v1", LE)(TIRAGES[AUTRE_TIRAGE])).toBeNull();
  });
  it("déterministe", () => {
    const f = refusPourTirage(rejetteChiffreChoc, "v1", LE);
    expect(f(TIRAGES[AUTRE_TIRAGE])).toBe(f(TIRAGES[AUTRE_TIRAGE]));
  });
  it("aucun import de fabrication, publications, reglages", () => {
    const src = readFileSync(resolve(__dirname, "../../src/services/variete-commune/refus-tirage-cas-concret.ts"), "utf8");
    expect(src).not.toMatch(/from\s+["'][^"']*(fabrication|publications|reglages)/);
  });
});
