/**
 * Contrôles qualité du face caméra (10/10, `docs/facecam/JOURNAL-CONTROLES-QUALITE.md`) : la carte « Qualité ·
 * Estimation » montrait les mêmes alertes sur la v1 et la v3 (synchro 5 images, visage 141, teinte 37°). Les alertes
 * viennent maintenant des contrôles de la PISTE MONTÉE (version 2) ; ceux d'avant (version 1) ne déclenchent plus rien
 * et une retouche refait la piste montée pour les remesurer.
 */
import { describe, expect, it } from "vitest";
import { alertesControles, livraisonChaine, LUMINANCE_VISAGE, TEINTE_PEAU, VERSION_CONTROLES, type ControlesMontage, type EtatChaine } from "@/moteurs/montage-facecam/chaine";
import { etatPourRetouche, type RepriseChaine } from "@/moteurs/montage-facecam/retouche";

const messages = (ctrl: ControlesMontage | undefined, mesures?: Parameters<typeof alertesControles>[1]) => alertesControles(ctrl, mesures, undefined, 0).map((a) => `${a.gravite}:${a.message}`);

describe("alertes des contrôles machine", () => {
  it("le cas de la v1 / v3 (contrôles version 1, mesures de la passe) ne donne plus d'alerte fausse", () => {
    // Exactement ce que la prod affichait : synchro 5 (bord de la fenêtre ± 5), visage 141, teinte 37° mesurés avant la LUT.
    expect(messages({ decalageSynchroImages: 5, niveauLufs: -14 }, { luminanceVisageApres: 141, teintePeauDeg: 37, bruitRatio: 0.8 })).toEqual([]);
  });

  it("version 2 : synchro décalée → bloquant, avec le sens", () => {
    expect(messages({ version: VERSION_CONTROLES, decalageSynchroImages: 3 })).toEqual(["bloquant:Son et image décalés de 3 image(s) (le son arrive après l'image)."]);
    expect(messages({ version: VERSION_CONTROLES, decalageSynchroImages: -2 })).toEqual(["bloquant:Son et image décalés de 2 image(s) (le son arrive avant l'image)."]);
    expect(messages({ version: VERSION_CONTROLES, decalageSynchroImages: 1 })).toEqual([]);
    expect(messages({ version: VERSION_CONTROLES, decalageSynchroImages: null })).toEqual([]);
  });

  it("version 2 : luminance du visage jugée sur la piste montée, bornes 90-190 (luma BT.709 0-255)", () => {
    expect(LUMINANCE_VISAGE).toEqual({ min: 90, max: 190 });
    expect(messages({ version: 2, visage: { luminance: 141, teinteDeg: 45 } })).toEqual([]);
    expect(messages({ version: 2, visage: { luminance: 158, teinteDeg: 51 } })).toEqual([]); // ColorChecker « light skin »
    expect(messages({ version: 2, visage: { luminance: 82, teinteDeg: 50 } })).toEqual(["attention:Visage trop sombre (82)."]);
    expect(messages({ version: 2, visage: { luminance: 205, teinteDeg: 50 } })).toEqual(["attention:Visage trop clair (205)."]);
  });

  it("version 2 : teinte de la peau 50° ± 20° (CIELAB h_ab)", () => {
    expect(TEINTE_PEAU).toEqual({ centreDeg: 50, toleranceDeg: 20 });
    expect(messages({ version: 2, visage: { luminance: 140, teinteDeg: 37 } })).toEqual([]);
    expect(messages({ version: 2, visage: { luminance: 140, teinteDeg: 25 } })).toEqual(["info:Teinte de peau hors des tons chair (25°)."]);
    expect(messages({ version: 2, visage: { luminance: 140, teinteDeg: 75 } })).toEqual(["info:Teinte de peau hors des tons chair (75°)."]);
  });

  it("le bruit et le ΔE de la passe restent jugés (comparaisons relatives à la prise / au Look Will)", () => {
    expect(messages({ version: 2 }, { bruitRatio: 1.2, deltaE00Peau: 5 })).toEqual(["bloquant:Le visage est plus granuleux que l'original.", "attention:Teint éloigné du Look Will (ΔE 5.0)."]);
  });
});

describe("retouche : contrôles périmés", () => {
  const reprise = (controles: Record<string, unknown>): RepriseChaine =>
    ({
      version: "reprise-facecam-1",
      signature: { coupes: [], image: {}, teinte: "neutre", son: { nettoyer: true, musique: true, volume: "normal" }, habillage: "x" },
      travaux: {
        son: { id: "s", statut: "termine", progression: 100, essais: 0, resultat: { fichierCle: "son.flac" } },
        passe: { id: "p", statut: "termine", progression: 100, essais: 0, resultat: { fichierCle: "image.mp4" } },
        cadrage: { id: "c", statut: "termine", progression: 100, essais: 0, resultat: { fichierCle: "montage.mov", controles } },
      },
      cartes: [],
      dureeSec: 30,
    }) as unknown as RepriseChaine;
  const travaux = (e: EtatChaine) => Object.keys(e.travaux).sort();

  it("contrôles version 1 : la piste montée est refaite (la passe image et le son sont gardés)", () => {
    expect(travaux(etatPourRetouche(reprise({ decalageSynchroImages: 5 }), { entrees: {} }, new Set(["habillage"]), []))).toEqual(["passe", "son"]);
  });

  it("contrôles version 2 : rien n'est refait pour un simple habillage", () => {
    expect(travaux(etatPourRetouche(reprise({ version: 2, decalageSynchroImages: 0 }), { entrees: {} }, new Set(["habillage"]), []))).toEqual(["cadrage", "passe", "son"]);
  });
});

describe("GV2-14 : texte non retrouvé, transcription ratée, sous-titres qui suivent les coupes", () => {
  const coupes = (texteNonRetrouve: boolean): NonNullable<EtatChaine["coupes"]> => ({ mode: texteNonRetrouve ? "libre" : "texte", texteNonRetrouve, liste: [], gardes: [{ debutSec: 0, finSec: 10 }], consignes: [], dureeSourceSec: 10, dureeSortieSec: 10, resume: "", phrasesManquantes: [] });

  it("texte fourni mais non retrouvé → une alerte « les sous-titres suivent la parole »", () => {
    const a = alertesControles(undefined, undefined, coupes(true), 0);
    expect(a).toEqual([{ code: "synchronisation", gravite: "attention", message: "Votre texte n'a pas été retrouvé dans la vidéo : les sous-titres suivent la parole." }]);
  });

  it("vidéo libre voulue (sans texte) → aucune alerte", () => {
    expect(alertesControles(undefined, undefined, { ...coupes(false), mode: "libre" }, 0)).toEqual([]);
  });

  it("transcription en échec → alerte « vidéo sans sous-titres » dans la livraison", () => {
    const etat = { version: "chaine-facecam-1", travaux: { transcrire: { id: "t", statut: "echec", progression: 0, essais: 1 } }, sauts: [{ brique: "Les coupes", message: "La transcription n'a pas abouti : la vidéo est gardée entière, sans sous-titres." }] } as unknown as EtatChaine;
    const msgs = livraisonChaine(etat).alertes.map((x) => x.message);
    expect(msgs).toContain("Vidéo sans sous-titres : la transcription n'a pas abouti.");
    expect(msgs.some((m) => m.includes("sans sous-titres."))).toBe(true);
  });

  it("transcription réussie → pas d'alerte « sans sous-titres »", () => {
    const etat = { version: "chaine-facecam-1", travaux: { transcrire: { id: "t", statut: "termine", progression: 100, essais: 0 } }, sauts: [] } as unknown as EtatChaine;
    expect(livraisonChaine(etat).alertes.map((x) => x.message)).not.toContain("Vidéo sans sous-titres : la transcription n'a pas abouti.");
  });

  it("retouche : « coupe la deuxième phrase » → son texte quitte les sous-titres, les autres restent", () => {
    const mot = (m: string, d: number) => ({ mot: m, debutSec: d, finSec: d + 0.3 });
    const motsPrise = [mot("Bonjour", 1), mot("à", 1.4), mot("tous.", 1.8), mot("En", 3), mot("deux", 3.4), mot("minutes.", 3.8), mot("Merci.", 5)];
    const phrases = [
      { index: 0, texte: "Bonjour à tous.", debutSec: 1, finSec: 2.1 },
      { index: 1, texte: "En deux minutes.", debutSec: 3, finSec: 4.1 },
      { index: 2, texte: "Merci.", debutSec: 5, finSec: 5.3 },
    ];
    const reprise = {
      version: "reprise-facecam-1",
      signature: { coupes: [], image: {}, teinte: "neutre", son: { nettoyer: true, musique: true, volume: "normal" }, habillage: "x" },
      travaux: {},
      coupes: { ...coupes(false), gardes: [{ debutSec: 0, finSec: 10 }], dureeSourceSec: 10, phrases, motsPrise, texteMonte: "Bonjour à tous. En deux minutes. Merci." },
      cartes: [],
      dureeSec: 10,
    } as unknown as RepriseChaine;
    const entrees = { facecam: { coupes: { auto: [], retablies: [] } }, facecamMonteur: { coupesDemandees: [{ id: "d1", debutSec: 2.9, finSec: 4.2 }] } };
    const etat = etatPourRetouche(reprise, { entrees }, new Set(["assemblage"]), []);
    expect(etat.coupes?.texteMonte).toBe("Bonjour à tous. Merci.");
    // Ancien état sans phrases : le texte figé est gardé tel quel.
    const ancien = { ...reprise, coupes: { ...reprise.coupes, phrases: undefined, motsPrise: undefined } } as unknown as RepriseChaine;
    expect(etatPourRetouche(ancien, { entrees }, new Set(["assemblage"]), []).coupes?.texteMonte).toBe("Bonjour à tous. En deux minutes. Merci.");
  });
});
