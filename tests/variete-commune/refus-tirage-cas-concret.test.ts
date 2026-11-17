import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { versCommun } from "@/briques/variete-commune/vocabulaire";
import { empreinteCasConcret } from "@/services/variete-commune/empreintes-a";
import { empreinteDuTirage, refusPourTirage } from "@/services/variete-commune/refus-tirage-cas-concret";
import { VERSION_VARIETE, type Mise, type Tirage } from "@/moteurs/montage-cas-concret/variete";
import type { EmpreinteVideo, ResultatGarde } from "@/briques/variete-commune/types";

const LE = "2026-11-17T10:00:00.000Z";
const OUV_CHIFFRE = versCommun("cas-concret", "ouverture", "chiffre-choc");
const OUVERTURES = ["affiche-v4", "chiffre-choc", "question-plein-cadre", "avant-apres-eclair", "objet-zoom-arriere"];
const STRUCTURES = ["resultat-d-abord", "chronologique", "avant-apres"];
const INTENSITES = ["calme", "v4", "vif"];
const JEUX = ["glissement", "ressort", "fondu"];
const CAMERAS = ["douce", "rythmee", "revelation"];

const tirage = (i: number): Tirage =>
  ({
    version: VERSION_VARIETE, graine: i, sel: 0, ouverture: OUVERTURES[i % 5], structure: STRUCTURES[i % 3], jeuAnimation: JEUX[i % 3],
    sortie: "poussee", motParMot: "cascade", miseEnPage: {}, transitions: [], camera: { style: CAMERAS[i % 3], part: 0.5 }, fondFort: 0,
    particules: { groupe: 0, densite: "legere" }, sousTitres: { inclinaison: "v4", intensite: INTENSITES[i % 3], accent: "v4", hauteur: "v4" },
    bruitages: { depart: 0 }, fin: { phrase: 0, composition: 0, animation: 0 }, relache: 0, ...(i % 2 === 0 ? { habille: true } : {}),
  }) as unknown as Tirage;

const TIRAGES = Array.from({ length: 10 }, (_, i) => tirage(i));

describe("empreinteDuTirage", () => {
  it.each(TIRAGES.map((t, i) => [i, t] as const))("tirage %i : mêmes axes que empreinteCasConcret (hors transitions)", (_i, t) => {
    const mise = { version: VERSION_VARIETE, tirage: t, ecrans: t.habille === true ? { e01: { camera: "zoom-lent" } } : {} } as unknown as Mise;
    const ref = empreinteCasConcret("v1", LE, mise);
    const e = empreinteDuTirage("v1", LE, t);
    expect(e.version).toBe(ref.version);
    expect(e.formatId).toBe(ref.formatId);
    expect(e.videoId).toBe("v1");
    expect(e.le).toBe(LE);
    expect(e.axes).toEqual(ref.axes);
    expect(Object.keys(e.axes)).toEqual(Object.keys(ref.axes));
    expect(e.axes.transitions).toBeUndefined();
  });
  it("déterministe", () => {
    expect(empreinteDuTirage("v", LE, TIRAGES[0])).toEqual(empreinteDuTirage("v", LE, TIRAGES[0]));
  });
});

const garde = (ok: boolean, phrase = ""): ResultatGarde => ({ ok, score: null, axesCommuns: [], phrase });

describe("refusPourTirage", () => {
  const rejetteChiffreChoc = (e: EmpreinteVideo) =>
    e.axes.ouverture?.includes(OUV_CHIFFRE) ? garde(false, "ouverture déjà vue") : garde(true);
  it("raison non nulle pour le tirage rejeté, null pour un autre", () => {
    const f = refusPourTirage(rejetteChiffreChoc, "v1", LE);
    expect(f(TIRAGES[1])).toBe("ouverture déjà vue");
    expect(f(TIRAGES[0])).toBeNull();
  });
  it("phrase vide : repli", () => {
    expect(refusPourTirage(() => garde(false, ""), "v1", LE)(TIRAGES[1])).toBe("trop proche d'une vidéo récente");
  });
  it("exception → null", () => {
    expect(refusPourTirage(() => { throw new Error("x"); }, "v1", LE)(TIRAGES[0])).toBeNull();
  });
  it("déterministe", () => {
    const f = refusPourTirage(rejetteChiffreChoc, "v1", LE);
    expect(f(TIRAGES[0])).toBe(f(TIRAGES[0]));
  });
  it("aucun import de fabrication, publications, reglages", () => {
    const src = readFileSync(resolve(__dirname, "../../src/services/variete-commune/refus-tirage-cas-concret.ts"), "utf8");
    expect(src).not.toMatch(/from\s+["'][^"']*(fabrication|publications|reglages)/);
  });
});
