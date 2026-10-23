import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { controlerImageFinale, etablirRapport, executerBrique, zoneSureDe, type MiseEnPage, type ResultatControle } from "../../../src/briques/controle-image";

const MESURES = { lufs: -14, creteVraieDbtp: -2, imageNoireTete: 0, imagesFigeesHorsFin: 0, dureeSec: 60, vmaf: 95, vmafSeuil: 93 };
const PAGE: MiseEnPage = {
  boites: [{ role: "accroche", texte: "Votre patron lit-il vos messages ?", taille: 0.058, couleur: "#110A05", fond: "#E9DCC8", x: 0.1, y: 0.2, largeur: 0.6, hauteur: 0.12, debutSec: 0 }],
};
const ZONE = zoneSureDe("9:16", ["tiktok", "instagram", "facebook", "youtube-shorts"]);

const c = (etat: ResultatControle["etat"], bloquant = true): ResultatControle => ({ id: "duree", libelle: "Durée", bloquant, etat, raison: "" });

describe("contrôle de l'image finale — rapport unique", () => {
  it("tout réussi : verdict livrable, onze contrôles", () => {
    const r = controlerImageFinale({ mesures: MESURES, miseEnPage: PAGE, zone: ZONE });
    expect(r.controles).toHaveLength(11);
    expect(r).toMatchObject({ verdict: "livrable", nonFaits: 0, resume: "Livrable" });
  });

  it("un contrôle bloquant échoué : verdict bloqué", () => {
    const r = controlerImageFinale({ mesures: { ...MESURES, dureeSec: 95 }, miseEnPage: PAGE, zone: ZONE });
    expect(r).toMatchObject({ verdict: "bloque", resume: "Bloqué : 1 contrôle échoué" });
  });

  it("un contrôle indicatif échoué ne bloque pas", () => {
    expect(etablirRapport([c("reussi"), c("echoue", false)])).toMatchObject({ verdict: "livrable", resume: "Livrable" });
  });

  it("une brique ratée n'empêche pas la livraison : « 1 élément non fait »", () => {
    const r = controlerImageFinale({ mesures: { lufs: -14, creteVraieDbtp: -2, imageNoireTete: 0, dureeSec: 60, vmaf: 95, vmafSeuil: 93 }, miseEnPage: PAGE, zone: ZONE });
    expect(r).toMatchObject({ verdict: "livrable", nonFaits: 1, resume: "Livrable — 1 élément non fait" });
    expect(r.controles.find((x) => x.etat === "non-fait")?.id).toBe("image-figee");
  });

  it("une brique qui lève une erreur devient un élément non fait, le rapport continue", () => {
    const res = executerBrique("contraste", "Contraste", true, () => {
      throw new Error("boom");
    });
    expect(res).toEqual([{ id: "contraste", libelle: "Contraste", bloquant: true, etat: "non-fait", raison: "Contrôle non fait : erreur pendant la vérification (boom)." }]);
    expect(etablirRapport([c("reussi"), ...res])).toMatchObject({ verdict: "livrable", resume: "Livrable — 1 élément non fait" });
    expect(etablirRapport([c("echoue"), c("echoue"), ...res, ...res]).resume).toBe("Bloqué : 2 contrôles échoués — 2 éléments non faits");
  });

  it("mise en page absente : un élément non fait, la livraison reste possible", () => {
    const r = controlerImageFinale({ mesures: MESURES, zone: ZONE });
    expect(r).toMatchObject({ verdict: "livrable", nonFaits: 1, resume: "Livrable — 1 élément non fait" });
  });

  it("brique neutre : ne nomme aucun format, ne touche pas à la simulation existante", () => {
    for (const f of ["index", "types", "seuils", "mesures", "mise-en-page", "rapport"]) {
      const src = readFileSync(`src/briques/controle-image/${f}.ts`, "utf8");
      expect(src).not.toMatch(/tableau|facecam|face cam|avocat|fetch\(/i);
    }
  });
});
