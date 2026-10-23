/**
 * IMAGE → VIDÉO · la HAUTEUR d'une fin se juge par rapport au corps de la même vidéo (18/10, v-dcc902c3f3dd).
 * Prod : fin TikTok (« …qui répond aux clients après la fermeture ? … ») à 170,21 Hz puis 166,67 Hz contre une v4 à
 * 152,4 Hz (+12 % puis +9 %, toléré 8 %), alors que le corps de la même vidéo était à 158,42 Hz (+7,4 % / +5,2 %).
 */
import { describe, expect, it } from "vitest";
import { refusReessayableIV } from "@/components/formats/image-video/vue";
import { REFERENCE_V4, VERSION_MESURE_VOIX, type MesureVoix } from "@/briques/voix-maitre/reference";
import { ecartFinHorsReference, ecartHorsReference, finsHorsReferenceIV, voixAcceptableParLaRegleDesFinsIV } from "@/moteurs/montage-image-video/secours";
import { verdictVoixFaite, type EtatVoixIV } from "@/moteurs/montage-image-video/voix";
import type { PriseVoix } from "@/moteurs/montage-image-video/emprunts";

/** Mesure de la fin TikTok de prod (seule la hauteur sort de la tolérance contre la v4). */
const mesureFin = (hauteurHz: number, sur: Partial<MesureVoix> = {}): MesureVoix => ({ hauteurHz, variationHz: 34.4, energie: 0.14, dynamique: 0.577, rythmePicsParSec: 4.93, partieParole: 0.784, ...sur });

/** Prise faite, mesurée à la version courante ; ressemblante ou non contre la v4 (ce que dit la voix maître). */
function prise(mesure: MesureVoix, ressemblante: boolean, controle: unknown = { ok: true }): PriseVoix {
  const ecarts = ressemblante ? [] : [`hauteur +${Math.round((mesure.hauteurHz / REFERENCE_V4.hauteurHz - 1) * 100)} % (toléré 8 %)`];
  return {
    texte: "t",
    empreinte: "e",
    etat: { phase: "faite", audio: { ressemblance: { prises: [{ empreinteDemande: "x#lecture-1", fichierCle: "b.mp3", coutCentimes: 4, caracteres: 139, mesure, versionMesure: VERSION_MESURE_VOIX, ressemblante, ecarts }], retenue: 0, ressemblante } } },
    controle,
  } as unknown as PriseVoix;
}

const CORPS = () => prise({ ...REFERENCE_V4, hauteurHz: 158.42 }, true);

function etatVoix(corps: PriseVoix, fin: PriseVoix): EtatVoixIV {
  return {
    segments: { fins: [{ id: "f1", reseaux: ["tiktok"] }] },
    voix: { corps: { texte: "c", lectures: 1, retenu: true, prise: corps }, fins: [{ id: "f1", texte: "t", lectures: 2, prise: fin }], payees: [], reformulations: [], issue: { statut: "faite" } },
  } as unknown as EtatVoixIV;
}

describe("fin : hauteur jugée par rapport au corps (18/10)", () => {
  it("les deux prises de prod (170,21 Hz et 166,67 Hz) sont dans la tolérance du corps à 158,42 Hz", () => {
    expect(ecartFinHorsReference(prise(mesureFin(170.21), false), CORPS())).toBeNull();
    expect(ecartFinHorsReference(prise(mesureFin(166.67), false), CORPS())).toBeNull();
  });

  it("une fin à +8,9 % du corps reste refusée, avec la phrase « par rapport au corps »", () => {
    const e = ecartFinHorsReference(prise(mesureFin(172.5), false), CORPS());
    expect(e).toContain("hauteur +9 % par rapport au corps (toléré 8 %)");
  });

  it("une fin plus basse que le corps est jugée de la même façon", () => {
    expect(ecartFinHorsReference(prise(mesureFin(140), false), CORPS())).toContain("par rapport au corps");
  });

  it("les cinq autres mesures restent jugées contre la v4", () => {
    const e = ecartFinHorsReference(prise(mesureFin(166.67, { partieParole: 0.6 }), false), CORPS());
    expect(e).toContain("part de parole");
    expect(e).not.toContain("hauteur");
  });

  it("les cas Facebook de la prod (corps à la référence, fin +17 %) restent refusés", () => {
    const corps = prise({ ...REFERENCE_V4 }, true);
    expect(ecartFinHorsReference(prise(mesureFin(178.3), false), corps)).toContain("par rapport au corps");
  });

  it("une fin ressemblante ou pas encore faite n'a aucun écart", () => {
    expect(ecartFinHorsReference(prise(mesureFin(152.4), true), CORPS())).toBeNull();
    expect(ecartFinHorsReference(undefined, CORPS())).toBeNull();
  });

  it("corps sans mesure lisible : jugement contre la v4, comme avant", () => {
    const sansMesure = { ...CORPS(), etat: { phase: "faite", audio: { ressemblance: { prises: [{ mesure: null, ressemblante: true, ecarts: [] }], retenue: 0, ressemblante: true } } } } as unknown as PriseVoix;
    const fin = prise(mesureFin(170.21), false);
    expect(ecartFinHorsReference(fin, sansMesure)).toBe(ecartHorsReference(fin));
    expect(ecartFinHorsReference(fin, undefined)).toBe(ecartHorsReference(fin));
  });

  it("verdict de la voix finie : la voix de prod est « faite » ; un corps hors v4 reste refusé", () => {
    expect(verdictVoixFaite(etatVoix(CORPS(), prise(mesureFin(170.21), false)))).toEqual({ statut: "faite" });
    const corpsHaut = prise({ ...REFERENCE_V4, hauteurHz: 175 }, false);
    expect(verdictVoixFaite(etatVoix(corpsHaut, prise(mesureFin(175), false)))).toMatchObject({ statut: "refus", controle: "Q16" });
    expect(verdictVoixFaite(etatVoix(CORPS(), prise(mesureFin(172.5), false)))).toMatchObject({ statut: "refus", controle: "Q16", message: expect.stringContaining("par rapport au corps") });
  });

  it("une fin hors référence ne demande pas de fin de secours quand elle est dans la tolérance du corps", () => {
    expect(finsHorsReferenceIV(etatVoix(CORPS(), prise(mesureFin(170.21), false)))).toEqual([]);
    expect(finsHorsReferenceIV(etatVoix(CORPS(), prise(mesureFin(172.5), false)))).toEqual(["f1"]);
  });

  it("« Refaire cette partie » est proposé pour l'arrêt gardé de prod (0 lecture), pas pour un vrai écart", () => {
    const refus = { etape: "voix", code: "IV_VOIX", message: "La voix de la fin pour tiktok ne ressemble pas assez à la voix de référence (hauteur +12 % (toléré 8 %)).", reessayable: false };
    const arret = (fin: PriseVoix, corps = CORPS()) => ({ refus, voix: etatVoix(corps, fin) }) as unknown as Parameters<typeof refusReessayableIV>[0];
    expect(voixAcceptableParLaRegleDesFinsIV(etatVoix(CORPS(), prise(mesureFin(170.21), false)))).toBe(true);
    expect(refusReessayableIV(arret(prise(mesureFin(170.21), false)))).toBe(true);
    expect(refusReessayableIV(arret(prise(mesureFin(172.5), false)))).toBe(false);
    expect(refusReessayableIV(arret(prise(mesureFin(170.21), false), prise({ ...REFERENCE_V4, hauteurHz: 175 }, false)))).toBe(false);
    // Fin de secours refusée avant la règle (« ne ressemble pas NON PLUS ») : « Refaire » reste proposé.
    const ancienSecours = { refus: { ...refus, message: "La voix de la fin de secours pour facebook ne ressemble pas non plus à la voix de référence (hauteur +12 % (toléré 8 %))." }, voix: etatVoix(CORPS(), prise(mesureFin(170.21), false)) } as unknown as Parameters<typeof refusReessayableIV>[0];
    expect(refusReessayableIV(ancienSecours)).toBe(true);
    expect(refusReessayableIV(arret(prise(mesureFin(170.21), false, { rejet: true, detail: "euh", phrase: "x" })))).toBe(false);
  });
});
