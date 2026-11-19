/**
 * FIX-RENDU-IMAGE-FIGEE (rendu réel `v-64a273d3580c` : « Image figée : Non vérifié ») : la mesure `freezedetect` du
 * fichier exporté existe, elle est demandée par le tableau seulement, la tenue finale n'est jamais comptée, et une
 * mesure absente reste « non fait ».
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parametresComposition } from "../../../src/briques/composition/parametres";
import { controleImageFigee } from "../../../src/briques/controle-image/mesures";
import { controlerImageFinale } from "../../../src/briques/controle-image/rapport";
import { RECETTE_COMPOSITION_CAS_CONCRET } from "../../../src/moteurs/montage-cas-concret/fabriquer";
import { controlerVideoTableau } from "../../../src/moteurs/montage-tableau/controles";
import { centreBandePct, commandeTableau, plansTableau, RECETTE_COMPOSITION_TABLEAU, SEUIL_FIGE_TABLEAU_SEC } from "../../../src/moteurs/montage-tableau/fabriquer";
import { qualiteDe } from "../../../src/moteurs/montage-tableau/index";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { argumentsFiges, lirePassagesFigesExport, mesuresFiges } from "../../../studio-rendu/src/controle-figes";
import { contexteExemple, copie, ficheErreurCorrigee } from "../regles/exemples";
import { caleeEcritureALHeure } from "../reference-3/fiches";

const JOURNAL = [
  "[freezedetect @ 0x1] lavfi.freezedetect.freeze_start: 10",
  "[freezedetect @ 0x1] lavfi.freezedetect.freeze_duration: 1.2",
  "[freezedetect @ 0x1] lavfi.freezedetect.freeze_end: 11.2",
  "[freezedetect @ 0x1] lavfi.freezedetect.freeze_start: 30",
  "[freezedetect @ 0x1] lavfi.freezedetect.freeze_duration: 5",
  "[freezedetect @ 0x1] lavfi.freezedetect.freeze_end: 35",
].join("\n");

describe("lecture pure du journal FFmpeg", () => {
  it("2 passages hors fin : nombre et plus longue durée", () => {
    expect(mesuresFiges(JOURNAL, 46, 1.05)).toEqual({ imagesFigeesHorsFin: 2, figeMaxHorsFinSec: 5 });
  });

  it("un passage qui commence dans la fin (45,2 s) n'est pas compté", () => {
    const j = `${JOURNAL}\nlavfi.freezedetect.freeze_start: 45.2\nlavfi.freezedetect.freeze_duration: 0.8`;
    expect(mesuresFiges(j, 46, 1.05)).toEqual({ imagesFigeesHorsFin: 2, figeMaxHorsFinSec: 5 });
  });

  it("un freeze_start sans durée court jusqu'à la fin du fichier", () => {
    expect(lirePassagesFigesExport("lavfi.freezedetect.freeze_start: 40", 46)).toEqual([{ debutSec: 40, dureeSec: 6 }]);
    expect(mesuresFiges("lavfi.freezedetect.freeze_start: 40", 46, 1.05)).toEqual({ imagesFigeesHorsFin: 1, figeMaxHorsFinSec: 6 });
  });

  it("aucun passage : 0 et 0", () => {
    expect(mesuresFiges("", 46, 1.05)).toEqual({ imagesFigeesHorsFin: 0, figeMaxHorsFinSec: 0 });
  });

  it("les arguments FFmpeg portent le seuil", () => {
    expect(argumentsFiges("a.mp4", 4)).toContain("freezedetect=n=-60dB:d=4");
  });
});

describe("recette : le tableau demande la mesure, le cas concret non", () => {
  const { fiche, mots } = caleeEcritureALHeure();
  const texte = fiche.scenes.map((s) => s.texteDit).join(" ");
  const dureeSec = mots.at(-1)!.finSec + 0.5;
  const sc = [{ id: "s01", debutSec: 0, finSec: dureeSec, cle: "k" }];
  const mise = mettreEnPage(fiche, { format: "carre" });
  const c = commandeTableau({ videoId: "v", fiche, texteScript: texte, dureeSec, centreSousTitresPct: centreBandePct(mise), scenes: sc, ratio: "1:1", bandeSousTitres: undefined as never });
  const params = (r: typeof RECETTE_COMPOSITION_TABLEAU) => parametresComposition(c, { ratio: "1:1", plans: plansTableau(sc), segments: [], dureeSec, mots, pistesDouble: { face: "k" } }, r);

  it("tableau : mesurerFiges = { seuilSec, finSec }", () => {
    expect(SEUIL_FIGE_TABLEAU_SEC).toBe(4);
    expect(params(RECETTE_COMPOSITION_TABLEAU).export.mesurerFiges).toEqual({ seuilSec: 4, finSec: 1.05 });
  });

  it("cas concret : champ ABSENT (éteint = identique)", () => {
    expect("mesurerFiges" in params(RECETTE_COMPOSITION_CAS_CONCRET).export).toBe(false);
  });
});

describe("contrôle « Image figée »", () => {
  const BONNES = { lufs: -14, creteVraieDbtp: -2, imageNoireTete: 0, imagesNoiresHorsFin: 0, dureeSec: 60, vmaf: 95, vmafSeuil: 90 };

  it("0 passage : réussi ; 1 passage : échoué ; mesure absente : non fait", () => {
    expect(controleImageFigee({ ...BONNES, imagesFigeesHorsFin: 0 }).etat).toBe("reussi");
    expect(controleImageFigee({ ...BONNES, imagesFigeesHorsFin: 1 }).etat).toBe("echoue");
    expect(controleImageFigee(BONNES).etat).toBe("non-fait");
    expect(controlerImageFinale({ mesures: { ...BONNES, imagesFigeesHorsFin: 0 }, zone: null }).controles.find((l) => l.id === "image-figee")?.etat).toBe("reussi");
  });

  it("tableau après montage : 1 passage figé est une alerte, jamais un refus de la vidéo", async () => {
    const f = copie(ficheErreurCorrigee);
    const r = await controlerVideoTableau({ fiche: f, contexte: contexteExemple(f), historique: [], dejaVu: { coche: true, le: "2026-10-10" }, mesures: { ...BONNES, imagesFigeesHorsFin: 1 }, apresMontage: true }, { relireImagesCles: () => ({ imagesLues: 6, remarques: [] }) });
    expect(r.bloquants.map((l) => l.libelle)).not.toContain("Image figée");
    expect([...r.indicatifs, ...r.nonFaits].map((l) => l.libelle)).toContain("Image figée");
  });

  it("rapport : mesure à 0 → plus de « Image figée » non faite ; note 80 si seule la relecture reste non faite", async () => {
    const f = copie(ficheErreurCorrigee);
    const sans = await controlerVideoTableau({ fiche: f, contexte: contexteExemple(f), historique: [], dejaVu: { coche: true, le: "2026-10-10" }, mesures: { ...BONNES, imagesFigeesHorsFin: 0 }, apresMontage: true }, {});
    expect(sans.nonFaits.map((l) => l.libelle)).not.toContain("Image figée");
    const q = qualiteDe(sans as never, undefined as never, undefined as never);
    expect(q.alertes.some((a) => a.message.includes("Image figée"))).toBe(false);
    expect(q.note).toBe(80);
    const avant = await controlerVideoTableau({ fiche: f, contexte: contexteExemple(f), historique: [], dejaVu: { coche: true, le: "2026-10-10" }, mesures: BONNES, apresMontage: true }, {});
    expect(qualiteDe(avant as never, undefined as never, undefined as never).note).toBe(70);
  });
});

const ffmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
describe.skipIf(!ffmpeg)("fichier réel (FFmpeg du poste)", () => {
  it("1 s de mouvement, 1,5 s figée, 0,5 s de fin : 1 passage à 1 s de seuil", () => {
    const dossier = mkdtempSync(join(tmpdir(), "figes-"));
    const f = join(dossier, "t.mp4");
    const g = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=s=160x120:r=25:d=1", "-f", "lavfi", "-i", "color=c=gray:s=160x120:r=25:d=2", "-filter_complex", "[0][1]concat=n=2:v=1:a=0,format=yuv420p", f]);
    expect(g.status).toBe(0);
    const r = spawnSync("ffmpeg", argumentsFiges(f, 1));
    expect(mesuresFiges(String(r.stderr), 3, 0.5).imagesFigeesHorsFin).toBe(1);
  });
});
