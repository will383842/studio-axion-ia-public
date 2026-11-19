import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { controlerVideoFinie, couleursHorsCharte, policesHorsCharte, type EntreeVideoFinie } from "../../../src/briques/controle-image/video-finie";
import type { MiseEnPage } from "../../../src/briques/controle-image";

const MESURES = { lufs: -14, creteVraieDbtp: -2, imageNoireTete: 0, imagesFigeesHorsFin: 0, dureeSec: 48, vmaf: 95, vmafSeuil: 93 };
const PAGE: MiseEnPage = {
  boites: [{ role: "accroche", texte: "Votre patron lit-il vos messages ?", taille: 0.058, couleur: "#141413", fond: "#FAF9F5", x: 0.1, y: 0.2, largeur: 0.6, hauteur: 0.12, debutSec: 0 }],
};
const BASE: EntreeVideoFinie = { ratio: "9:16", reseaux: ["tiktok", "instagram", "facebook", "youtube-shorts"] };
const CONFORME: EntreeVideoFinie = { ...BASE, mesures: MESURES, miseEnPage: PAGE, couleursRendues: ["#B23F16", "#FAF9F5"], policesRendues: ["Manrope"] };

describe("contrôle commun de la vidéo finie", () => {
  it("sans mesures ni mise en page : tout est « non fait », jamais « réussi », jamais livrable", () => {
    const r = controlerVideoFinie(BASE);
    expect(r.livrable).toBe(false);
    expect(r.image.controles.every((c) => c.etat !== "reussi")).toBe(true);
    expect(r.image.controles.some((c) => c.etat === "non-fait")).toBe(true);
    expect(r.charte.map((c) => [c.id, c.etat])).toEqual([
      ["couleurs", "non-fait"],
      ["polices", "non-fait"],
    ]);
  });

  it("mesures et mise en page conformes, couleurs de la charte, Manrope : livrable", () => {
    const r = controlerVideoFinie(CONFORME);
    expect(r.image.verdict).toBe("livrable");
    expect(r.charte.every((c) => c.etat === "reussi")).toBe(true);
    expect(r.livrable).toBe(true);
  });

  it("un bleu est bloqué, nommé « bleu »", () => {
    const r = controlerVideoFinie({ ...CONFORME, couleursRendues: ["#B23F16", "#1E6FD9"] });
    expect(r.livrable).toBe(false);
    const c = r.charte.find((x) => x.id === "couleurs")!;
    expect(c.etat).toBe("echoue");
    expect(c.details.join(" ")).toContain("bleu");
  });

  it("un jaune est bloqué, nommé « jaune »", () => {
    const r = controlerVideoFinie({ ...CONFORME, couleursRendues: ["#F5C518"] });
    expect(r.livrable).toBe(false);
    expect(r.charte.find((x) => x.id === "couleurs")!.details.join(" ")).toContain("jaune");
  });

  it("une police hors charte est bloquée", () => {
    const r = controlerVideoFinie({ ...CONFORME, policesRendues: ["Inter"] });
    expect(r.livrable).toBe(false);
    expect(r.charte.find((x) => x.id === "polices")!.etat).toBe("echoue");
  });

  it("l'image figée mesurée bloque (contrôle d'image repris tel quel)", () => {
    const r = controlerVideoFinie({ ...CONFORME, mesures: { ...MESURES, imagesFigeesHorsFin: 2 } });
    expect(r.image.verdict).toBe("bloque");
    expect(r.livrable).toBe(false);
  });

  it("couleurs : opacité ignorée, gris neutre permis, formes rgb/rgba/hex court lues", () => {
    expect(couleursHorsCharte(["#B23F16", "#FAF9F5", "#777777", "rgba(178, 63, 22, 0.4)", "rgb(20, 20, 19)", "#777"])).toEqual([]);
    expect(couleursHorsCharte(["#1E6FD9"])[0]?.motif).toBe("bleu");
    expect(couleursHorsCharte(["rgb(30, 111, 217)"])[0]?.motif).toBe("bleu");
    expect(couleursHorsCharte(["#F5C518"])[0]?.motif).toBe("jaune");
    expect(couleursHorsCharte(["#2E9E3E"])[0]?.motif).toBe("hors charte");
    expect(couleursHorsCharte(["pas-une-couleur"])[0]?.motif).toBe("hors charte");
  });

  it("polices : Manrope, Axion Manrope et leur pile de repli permises ; repli seul refusé", () => {
    expect(policesHorsCharte(["Manrope", "Axion Manrope", '"Axion Manrope", "Manrope", sans-serif'])).toEqual([]);
    expect(policesHorsCharte(["sans-serif"])).toHaveLength(1);
    expect(policesHorsCharte(["system-ui, Manrope"])).toHaveLength(1);
    expect(policesHorsCharte(["Inter"])).toHaveLength(1);
    expect(policesHorsCharte(["Manrope, Arial"])).toHaveLength(1);
  });

  it("pièce commune : n'importe rien du tutoriel, ni service, ni fournisseur", () => {
    const texte = readFileSync("src/briques/controle-image/video-finie.ts", "utf8");
    expect(texte).not.toContain("montage-tutoriel-outil");
    expect(texte).not.toContain("@/services");
    expect(texte).not.toContain("@/fournisseurs");
  });
});
