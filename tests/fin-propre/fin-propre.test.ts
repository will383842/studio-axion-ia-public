import { describe, expect, it } from "vitest";
import { argumentsExport, argumentsVmaf, filtresFinPropre } from "../../studio-rendu/src/composition/ffmpeg";
import { controleFinDesMesures, controleFinPropre, FIN_PROPRE_COMMUNE } from "@/briques/composition/fin-propre";
import { controlerSortie } from "@/moteurs/montage-tableau/controles-sortie";
import type { ParametresExport } from "@/briques/composition/scene";

const base: ParametresExport = { fps: 25, debitKbps: 14000, debitMaxKbps: 16000, audioKbps: 256, audioHz: 48000, mode: "crf", crf: 17 };
const fin = { ...FIN_PROPRE_COMMUNE, dureeSec: 40 };

describe("fin propre : filtres", () => {
  it("tient l'image finale puis efface image et son ensemble, terminés à la dernière image", () => {
    const f = filtresFinPropre({ fonduSec: 0.45, tenueSec: 0.6, dureeSec: 40, couleur: "0xF2EEE4" });
    expect(f.dureeTotaleSec).toBeCloseTo(40.6, 5);
    expect(f.debutFonduSec).toBeCloseTo(40.15, 5);
    expect(f.video).toBe("tpad=stop_mode=clone:stop_duration=0.600,fade=t=out:st=40.150:d=0.450:color=0xF2EEE4");
    expect(f.audio).toBe("apad=pad_dur=0.600,afade=t=out:st=40.150:d=0.450");
    expect(f.finMesureSec).toBeCloseTo(40, 5);
  });
  it("sans tenue : fondu seul, jamais plus long que la vidéo, couleur douteuse → noir", () => {
    const f = filtresFinPropre({ fonduSec: 9, tenueSec: 0, dureeSec: 2, couleur: "x;rm -rf" });
    expect(f.video).toBe("fade=t=out:st=0.000:d=2.000:color=black");
    expect(f.audio).toBe("afade=t=out:st=0.000:d=2.000");
  });
  it("valeurs absurdes : aucune valeur négative ni NaN", () => {
    const f = filtresFinPropre({ fonduSec: Number.NaN, tenueSec: -3, dureeSec: 10, couleur: "black" });
    expect(f.video).not.toMatch(/NaN|-\d/);
    expect(f.dureeTotaleSec).toBe(10);
  });
});

describe("fin propre : export", () => {
  it("sans fin propre : l'export d'avant, inchangé", () => {
    const a = argumentsExport("m.mov", "t-%06d.png", base, "p", "v.mp4").passe2;
    expect(a.join(" ")).not.toMatch(/tpad|afade|\[vf\]/);
    expect(a).toContain("[v]");
  });
  it("avec fin propre : l'image est prolongée, le son prolongé, les deux effacés (fini 3 images avant la fin, à 25 i/s)", () => {
    const a = argumentsExport("m.mov", "t-%06d.png", { ...base, finPropre: fin }, "p", "v.mp4").passe2;
    const graphe = a[a.indexOf("-filter_complex") + 1];
    expect(graphe).toMatch(/;\[v\]tpad=stop_mode=clone:stop_duration=0\.600,fade=t=out:st=40\.030:d=0\.450:color=0xF2EEE4\[vf\]$/);
    expect(a[a.indexOf("-map") + 1]).toBe("[vf]");
    expect(a[a.indexOf("-af") + 1]).toBe("apad=pad_dur=0.600,afade=t=out:st=40.030:d=0.450");
  });
  it("avec l'image par seconde : le fondu finit IMAGES_PLEINES_FIN images avant la fin (dernières images identiques)", () => {
    const f = filtresFinPropre({ fonduSec: 0.45, tenueSec: 0.6, dureeSec: 40, couleur: "0xF2EEE4" }, 25);
    expect(f.dureeTotaleSec).toBeCloseTo(40.6, 5);
    expect(f.debutFonduSec + 0.45).toBeCloseTo(40.6 - 3 / 25, 5);
    expect(f.finMesureSec).toBeCloseTo(40, 5);
  });
  it("la mesure VMAF s'arrête avant la tenue et le fondu", () => {
    const a = argumentsVmaf("v.mp4", "m.mov", "t.txt", { ...base, finPropre: fin }, "j.json");
    const graphe = a[a.indexOf("-filter_complex") + 1];
    expect(graphe).toContain("[0:v]trim=end=40.000,");
    expect(graphe).toContain("[1:v]trim=end=40.000,");
    expect(argumentsVmaf("v.mp4", "m.mov", "t.txt", base, "j.json")[a.indexOf("-filter_complex")]).not.toContain("trim=");
  });
});

describe("fin propre : contrôle de la vidéo exportée", () => {
  it("refuse un son coupé net ou une image qui bouge", () => {
    expect(controleFinPropre({ sonDerniere100msDb: -45, mouvementDerniereImage: 6 })).toHaveLength(2);
    expect(controleFinPropre({ sonDerniere100msDb: Number.NaN, mouvementDerniereImage: 0 })).toHaveLength(1);
  });
  it("accepte une fin effacée", () => {
    expect(controleFinPropre({ sonDerniere100msDb: -100, mouvementDerniereImage: 0.2 })).toEqual([]);
  });
});

describe("fin propre : contrôle de sortie du tableau animé", () => {
  const bonnes = { largeur: 1080, hauteur: 1920, bordNoirGauche: 0, bordNoirDroite: 0, bordNoirHaut: 0, bordNoirBas: 0 };
  it("fin coupée net : non conforme, dit en français ; sans l'option : contrôle d'avant", () => {
    const c = controlerSortie("vertical", { ...bonnes, sonDerniere100msDb: -18, mouvementDerniereImage: 12 }, { finPropre: true });
    expect(c.etat).toBe("non-conforme");
    expect(c.phrases).toEqual([expect.stringMatching(/^La vidéo s'arrête net : le son/), expect.stringMatching(/^La vidéo s'arrête net : l'image bouge/)]);
    expect(controlerSortie("vertical", { ...bonnes, sonDerniere100msDb: -18, mouvementDerniereImage: 12 }).etat).toBe("conforme");
  });
  it("fin propre : conforme ; fin non mesurée : « non mesurée », jamais réussie", () => {
    expect(controlerSortie("vertical", { ...bonnes, sonDerniere100msDb: -120, mouvementDerniereImage: 0 }, { finPropre: true }).etat).toBe("conforme");
    expect(controlerSortie("vertical", bonnes, { finPropre: true })).toMatchObject({ etat: "non-mesure", phrases: ["Fin de la vidéo non mesurée."] });
  });
  it("lecture des mesures : absente → non mesurée", () => {
    expect(controleFinDesMesures(undefined)).toEqual({ mesuree: false, defauts: [] });
    expect(controleFinDesMesures({ sonDerniere100msDb: -100, mouvementDerniereImage: 0.1 })).toEqual({ mesuree: true, defauts: [] });
  });
});
