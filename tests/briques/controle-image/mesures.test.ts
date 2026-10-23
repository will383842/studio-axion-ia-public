import { describe, expect, it } from "vitest";
import {
  controleCrete,
  controleDuree,
  controleImageFigee,
  controleImageNoire,
  controleNoteQualite,
  controleVolume,
  controlerMesures,
} from "../../../src/briques/controle-image";

/** Mesures telles que la composition `complet` les rend (étapes 7 et 7 bis), valeurs saines. */
const BONNES = { lufs: -14.2, creteVraieDbtp: -1.8, imageNoireTete: 0, dureeSec: 62.4, vmaf: 95.1, vmafSeuil: 93, largeur: 1080, hauteur: 1920 };

describe("contrôle de l'image finale — mesures du fichier exporté", () => {
  it("volume : réussi dans −14 ± 1, échoué au-delà, avec la valeur", () => {
    expect(controleVolume(BONNES)).toMatchObject({ etat: "reussi", bloquant: true, raison: "Volume à −14,2, dans la cible (−14,0 à 1,0 près)." });
    expect(controleVolume({ ...BONNES, lufs: -16.3 })).toMatchObject({ etat: "echoue", raison: "Volume à −16,3, hors de la cible (−14,0 à 1,0 près)." });
  });

  it("crête : réussie sous −1,5, échouée au-dessus", () => {
    expect(controleCrete(BONNES)).toMatchObject({ etat: "reussi", raison: "Crête à −1,8, sous le plafond de −1,5." });
    expect(controleCrete({ ...BONNES, creteVraieDbtp: -0.6 })).toMatchObject({ etat: "echoue", raison: "Crête à −0,6, au-dessus du plafond de −1,5 : risque de son saturé." });
  });

  it("image noire : réussie sans noir en tête, échouée sinon ou si un passage noir est compté avant la fin", () => {
    expect(controleImageNoire(BONNES)).toMatchObject({ etat: "reussi", raison: "Aucune image noire au début de la vidéo." });
    expect(controleImageNoire({ ...BONNES, imageNoireTete: 1 })).toMatchObject({ etat: "echoue", raison: "La vidéo commence sur une image noire." });
    expect(controleImageNoire({ ...BONNES, imagesNoiresHorsFin: 2 })).toMatchObject({ etat: "echoue", raison: "2 passages noirs avant la fin." });
    expect(controleImageNoire({ ...BONNES, imagesNoiresHorsFin: 0 })).toMatchObject({ etat: "reussi", raison: "Aucune image noire avant la fin." });
  });

  it("image figée : réussie à 0, échouée sinon, « non faite » quand la mesure manque (cas actuel)", () => {
    expect(controleImageFigee({ ...BONNES, imagesFigeesHorsFin: 0 })).toMatchObject({ etat: "reussi", raison: "Aucune image figée avant la fin." });
    expect(controleImageFigee({ ...BONNES, imagesFigeesHorsFin: 1 })).toMatchObject({ etat: "echoue", raison: "1 passage figé avant la fin." });
    expect(controleImageFigee(BONNES)).toMatchObject({ etat: "non-fait", raison: "Images figées non mesurées sur le fichier exporté." });
  });

  it("durée : réussie jusqu'à 90 s, échouée au-delà", () => {
    expect(controleDuree(BONNES)).toMatchObject({ etat: "reussi", raison: "Durée de 62,4 s, dans la limite de 90 s." });
    expect(controleDuree({ ...BONNES, dureeSec: 91.2 })).toMatchObject({ etat: "echoue", raison: "Durée de 91,2 s, au-delà de la limite de 90 s." });
  });

  it("note de qualité : indicative, réussie au-dessus du seuil, échouée dessous", () => {
    expect(controleNoteQualite(BONNES)).toMatchObject({ etat: "reussi", bloquant: false, raison: "Note de 95,1 sur 100, au-dessus du seuil de 93." });
    expect(controleNoteQualite({ ...BONNES, vmaf: 90.4 })).toMatchObject({ etat: "echoue", bloquant: false, raison: "Note de 90,4 sur 100, sous le seuil de 93 : image moins fine que voulu." });
  });

  it("une mesure absente n'est jamais « réussie »", () => {
    for (const c of controlerMesures({})) expect(c.etat).toBe("non-fait");
  });

  it("aucun message ne contient de sigle", () => {
    const tous = [...controlerMesures(BONNES), ...controlerMesures({ ...BONNES, lufs: -20, creteVraieDbtp: 0, imageNoireTete: 1, dureeSec: 120, vmaf: 50 }), ...controlerMesures({})];
    for (const c of tous) expect(`${c.libelle} ${c.raison}`).not.toMatch(/LUFS|dBTP|VMAF|\b[A-Z]{2,}\b/);
  });
});
