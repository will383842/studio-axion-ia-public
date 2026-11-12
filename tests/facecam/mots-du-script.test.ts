/**
 * GV-ST-10 : face caméra, les mots désignés dans le script colorent les sous-titres, et le rapport dit d'où ils viennent.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, MotHorodate } from "@/domaine/types";
import { emphaseDuScript, habillageFacecam, type EntreeHabillageFacecam } from "@/moteurs/montage-facecam/habillage";
import { habillageFacecamRatio } from "@/moteurs/montage-facecam/declinaisons";
import { resultatChaine } from "@/moteurs/montage-facecam/etapes-chaine";

const TEXTE =
  "nous parlons ici de ce que je vois tous les matins quand je m'assois devant mon ordinateur et que je regarde la liste. " +
  "Voilà ce qui se passe chez les gens que je rencontre dans mes rendez-vous : ils ont trois choses ouvertes en même temps. " +
  "Alors je prends mon stylo et je note le devis du voisin, puis celui des clients de la rue d'à côté, un par un, sans me presser.";
const mots: MotHorodate[] = TEXTE.split(/\s+/).map((mot, i) => ({ mot, debutSec: +(i * 0.3).toFixed(2), finSec: +(i * 0.3 + 0.28).toFixed(2) }));
const base = (emphase?: string[]): EntreeHabillageFacecam => ({ pisteMonteeCle: "facecam/v/ver/montage.mov", dureeSec: 20, mots, prefixeCartes: "facecam/v/ver/cartes", ...(emphase ? { emphase } : {}) });
const enValeur = (h: ReturnType<typeof habillageFacecam>) => h.segments.flatMap((s) => s.mots).filter((m) => m.enValeur).map((m) => m.mot.replace(/[^\p{L}]/gu, "").toLowerCase());

describe("emphaseDuScript", () => {
  const seg = (emphase?: string[]) => ({ id: "s", texte: "x", ...(emphase ? { emphase } : {}) });
  it("rassemble les mots des segments, sans doublon", () => {
    const c = { script: { blocs: [{ segments: [seg(["devis", "stylo"]), seg(["devis"])] }, { segments: [seg()] }] }, plans: [{ motsEnValeur: ["autre"] }] } as never;
    expect(emphaseDuScript(c)).toEqual(["devis", "stylo"]);
  });
  it("sans emphase dans le script : les mots des plans ; sinon vide", () => {
    expect(emphaseDuScript({ script: { blocs: [{ segments: [seg()] }] }, plans: [{ motsEnValeur: ["a", "a", "b"] }] } as never)).toEqual(["a", "b"]);
    expect(emphaseDuScript({ script: { blocs: [] }, plans: [] } as never)).toEqual([]);
  });
});

describe("habillage : source des mots colorés", () => {
  it("emphase dite : le mot est en valeur, source « script »", () => {
    const h = habillageFacecam(base(["devis"]));
    expect(h.sourceMotsImportants).toBe("script");
    expect(enValeur(h)).toEqual(["devis"]);
  });
  it("emphase jamais dite : repli transcription, au moins un groupe marqué", () => {
    const h = habillageFacecam(base(["inexistant"]));
    expect(h.sourceMotsImportants).toBe("transcription");
    expect(enValeur(h).length).toBeGreaterThan(0);
  });
  it("script sans emphase : transcription, comme avant", () => {
    const h = habillageFacecam(base());
    expect(h.sourceMotsImportants).toBe("transcription");
    expect(enValeur(h)).toEqual(enValeur(habillageFacecam(base([]))));
  });
  it("le texte et les groupes ne changent pas ; le 9:16 et les autres formats portent le champ", () => {
    const a = habillageFacecam(base(["devis"]));
    const b = habillageFacecam(base());
    expect(a.segments.map((s) => s.mots.map((m) => m.mot))).toEqual(b.segments.map((s) => s.mots.map((m) => m.mot)));
    expect(habillageFacecamRatio(base(["devis"]), "9:16").sourceMotsImportants).toBe("script");
    expect(habillageFacecamRatio(base(["devis"]), "4:5").sourceMotsImportants).toBe("script");
    expect(habillageFacecamRatio(base(["inexistant"]), "1:1").sourceMotsImportants).toBe("transcription");
  });
});

describe("resultatChaine : alerte d'information", () => {
  const commande = { briques: {} } as unknown as CommandeFabrication;
  const etat = (motsImportants?: { source: "script" | "transcription"; emphase?: string[] }) =>
    ({
      travaux: {}, sauts: [],
      habillage: { cartes: [], base: { segments: [] }, sortie: { fichierCle: "f.mp4", vignetteCle: "v.jpg", alertes: [] }, ...(motsImportants ? { motsImportants } : {}) },
    }) as never;
  const messages = (r: ReturnType<typeof resultatChaine>) => r.noteQualite.alertes.map((a) => a.message);

  it("script : l'alerte info est présente, la note ne change pas", () => {
    const sans = resultatChaine(commande, etat(), false);
    const avec = resultatChaine(commande, etat({ source: "script", emphase: ["devis"] }), false);
    expect(messages(avec)).toContain("Mots mis en valeur dans les sous-titres : ceux désignés dans le script.");
    expect(avec.noteQualite.globale).toBe(sans.noteQualite.globale);
    expect(avec.sorties[0].rapportQualite.note).toBe(sans.sorties[0].rapportQualite.note);
    expect(avec.sorties[0].rapportQualite.alertes).toEqual(avec.noteQualite.alertes);
    expect(avec.noteQualite.alertes.at(-1)).toMatchObject({ code: "defaut-visuel", gravite: "info" });
  });
  it("repli : les deux messages de repli", () => {
    expect(messages(resultatChaine(commande, etat({ source: "transcription", emphase: ["x"] }), false))).toContain("Mots mis en valeur dans les sous-titres : mots forts de la transcription (aucun mot désigné dans le script n'a été dit).");
    expect(messages(resultatChaine(commande, etat({ source: "transcription" }), false))).toContain("Mots mis en valeur dans les sous-titres : mots forts de la transcription (le script n'en désigne aucun).");
  });
  it("habillage non fait : aucune alerte ajoutée", () => {
    const e = { travaux: {}, sauts: [], habillage: { cartes: [], base: { segments: [] }, motsImportants: { source: "script" } } } as never;
    expect(messages(resultatChaine(commande, e, false)).some((m) => m.startsWith("Mots mis en valeur"))).toBe(false);
  });
});
