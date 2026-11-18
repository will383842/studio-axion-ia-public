// T-EXT-03b : tests du film image par image. AUCUN navigateur lancé ici.
import { describe, expect, it } from "vitest";
import {
  argumentsEncodage,
  avancerAnimations,
  empreinteFilm,
  instantDeLImage,
  lireCadence,
  PAS_IMAGE_MS,
  planImages,
} from "../../../outils/maquettes-tableaux-de-bord/capture/film-images";
import type { ActionFilm } from "../../../outils/maquettes-tableaux-de-bord/capture/plan-capture";

const action = (i: number, gesteMs: number, finMs: number): ActionFilm => ({ etapeId: `e${i}`, aller: `ecran-${i}`, gesteMs, finMs, fichierPng: `0${i}.png` });

describe("planImages", () => {
  it("5 gestes : image = round(gesteMs / 40) ; total pour 9 000 ms", () => {
    const actions = [600, 3600, 6600, 9600, 12600].map((g, i) => action(i + 1, g, g + 2400));
    const p = planImages(actions, 15000);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.gestes.map((g) => g.image)).toEqual([15, 90, 165, 240, 315]);
    expect(planImages([action(1, 600, 3000)], 9000)).toMatchObject({ ok: true, total: Math.ceil(9500 / 40) });
  });
  it("attenteMaxImages bornée par finMs et par 5 000 ms", () => {
    const p = planImages([action(1, 600, 1400), action(2, 1600, 9000)], 9000);
    expect(p.ok && p.gestes.map((g) => g.attenteMaxImages)).toEqual([20, 125]);
  });
  it("refuse deux gestes sur la même image, et un geste après la fin", () => {
    const deux = planImages([action(1, 600, 3000), action(2, 610, 3000)], 9000);
    expect(!deux.ok && deux.erreurs.join(" ")).toContain("même image");
    const tard = planImages([action(1, 20000, 21000)], 9000);
    expect(!tard.ok && tard.erreurs.join(" ")).toContain("après la fin");
  });
  it("instant exact de l'image", () => {
    expect(instantDeLImage(15)).toBe(600);
  });
});

describe("avancerAnimations", () => {
  const faux = () => {
    let pauses = 0;
    const anims = [0, 120, null].map((t) => ({ currentTime: t as number | null, pause: () => void pauses++ }));
    return { anims, doc: { getAnimations: () => anims }, pauses: () => pauses };
  };
  it("avance de 40 ms exactement et met en pause", () => {
    const f = faux();
    expect(avancerAnimations(f.doc, 40)).toBe(3);
    expect(f.anims.map((a) => a.currentTime)).toEqual([40, 160, 40]);
    expect(f.pauses()).toBe(3);
  });
  it("25 images = exactement +1 000 ms", () => {
    const f = faux();
    for (let i = 0; i < 25; i++) avancerAnimations(f.doc, PAS_IMAGE_MS);
    expect(f.anims.map((a) => a.currentTime)).toEqual([1000, 1120, 1000]);
  });
  it("auto-suffisante : exécutable seule, sans rien du module", () => {
    const f = faux();
    const seule = new Function(`return (${avancerAnimations.toString()})`)() as typeof avancerAnimations;
    expect(seule(f.doc, 40)).toBe(3);
    expect(avancerAnimations.toString()).not.toMatch(/PAS_IMAGE_MS|IMAGES_PAR_SECONDE|__name/);
  });
});

describe("argumentsEncodage", () => {
  const a = argumentsEncodage("/x/navigation.mp4");
  it("x264 net, 25 i/s, une image clé par seconde, aucune mise à l'échelle", () => {
    const t = a.join(" ");
    expect(t).toContain("-crf 14");
    expect(t).toContain("-r 25");
    expect(t).toContain("-g 25");
    expect(t).toContain("image2pipe");
    expect(t).toContain("libx264");
    expect(t).not.toMatch(/scale|vp8|libvpx/);
    expect(a.at(-1)).toBe("/x/navigation.mp4");
  });
});

describe("lireCadence", () => {
  const json = (temps: number[]) => JSON.stringify({ frames: temps.map((t) => ({ pts_time: t.toFixed(6) })) });
  const regulier = Array.from({ length: 25 }, (_, i) => i * 0.04);
  it("25 images régulières : ok", () => {
    const c = lireCadence(json(regulier), { images: 25 });
    expect(c.ok).toBe(true);
    expect(c.images).toBe(25);
  });
  it("une image à 80 ms : ko", () => {
    const t = regulier.map((x, i) => (i >= 10 ? x + 0.04 : x));
    expect(lireCadence(json(t), { images: 25 }).ok).toBe(false);
  });
  it("24 images au lieu de 25 : ko ; sortie illisible : ko", () => {
    expect(lireCadence(json(regulier.slice(0, 24)), { images: 25 }).ok).toBe(false);
    expect(lireCadence("pas du json", { images: 25 }).ok).toBe(false);
  });
});

describe("empreinteFilm", () => {
  const base = { scenario: { a: 1, b: [1, 2] }, calage: { dureeVoixMs: 9000 } };
  it("stable, sensible au calage, indépendante de l'ordre des clés, « inconnu » par défaut", () => {
    expect(empreinteFilm(base)).toBe(empreinteFilm({ ...base }));
    expect(empreinteFilm({ ...base, calage: { dureeVoixMs: 9001 } })).not.toBe(empreinteFilm(base));
    expect(empreinteFilm({ calage: { dureeVoixMs: 9000 }, scenario: { b: [1, 2], a: 1 } })).toBe(empreinteFilm(base));
    expect(empreinteFilm({ ...base, poste: "inconnu" })).toBe(empreinteFilm(base));
    expect(empreinteFilm({ ...base, poste: "abc" })).not.toBe(empreinteFilm(base));
  });
});
