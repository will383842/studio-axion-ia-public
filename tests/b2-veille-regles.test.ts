/**
 * Lot B2 — VEILLE DES OUTILS : les règles (PURES), une règle = un test. Aucune mise à jour automatique : ces règles
 * ne font que prévenir (carte, cloche, e-mail filtré, résumé du lundi).
 */
import { describe, expect, it } from "vitest";
import type { VeilleOutil } from "@/domaine/types";
import { OUTILS_DEPART, outilNeuf } from "@/veille/outils-depart";
import { deciderApresLecture, doitEnvoyerEmail, doitEnvoyerResumeHebdo, etatOutil, lectureDue, semaineIso, texteResumeHebdo } from "@/veille/regles";
import { resumerNouveauteSimule } from "@/veille/resume-simule";
import type { LectureReussie } from "@/veille/types";

const MAINTENANT = "2026-10-02T09:00:00.000Z";
const remotion = (): VeilleOutil => outilNeuf(OUTILS_DEPART.find((o) => o.id === "veille-remotion")!, "2026-10-01T00:00:00.000Z");
const lu = (l: Partial<LectureReussie> = {}): LectureReussie => ({ ok: true, version: "4.0.532", notes: "", empreinte: "e1", fichiers: { "LICENSE.md": "lic1" }, ...l });
/** Outil déjà lu une fois (point de départ posé). */
function dejaLu(o: VeilleOutil, l: LectureReussie): VeilleOutil {
  return { ...o, ...deciderApresLecture(o, l, "2026-10-01T09:00:00.000Z").patch };
}

const MOTS_INTERDITS = /\b(job|render|prompt|token|API|upload|pipeline|workflow|mock|fictif|dashboard|avatar)\b/i;

describe("décision après une lecture", () => {
  it("première lecture = point de départ, aucune alerte (Remotion 4.0.532 utilisée = dernière)", () => {
    const d = deciderApresLecture(remotion(), lu(), MAINTENANT);
    expect(d.nouveaute).toBeUndefined();
    expect(d.patch).toMatchObject({ derniereVersion: "4.0.532", verifieLe: MAINTENANT });
  });
  it("première lecture plus récente que la version utilisée (FFmpeg 9.0.2 contre 5.1) : nouveauté", () => {
    const ffmpeg = outilNeuf(OUTILS_DEPART.find((o) => o.id === "veille-ffmpeg")!, MAINTENANT);
    expect(deciderApresLecture(ffmpeg, lu({ version: "9.0.2", fichiers: undefined }), MAINTENANT).nouveaute?.versionVue).toBe("9.0.2");
  });
  it("nouvelle version publiée : nouveauté", () => {
    const o = dejaLu(remotion(), lu());
    expect(deciderApresLecture(o, lu({ version: "4.0.533" }), MAINTENANT).nouveaute).toMatchObject({ versionVue: "4.0.533", fichiersChanges: [] });
  });
  it("même version relue : rien", () => {
    const o = dejaLu(remotion(), lu());
    expect(deciderApresLecture(o, lu(), MAINTENANT).nouveaute).toBeUndefined();
  });
  it("LICENSE.md de Remotion qui change, même sans nouvelle version : nouveauté, fichier nommé", () => {
    const o = dejaLu(remotion(), lu());
    const d = deciderApresLecture(o, lu({ fichiers: { "LICENSE.md": "lic2" } }), MAINTENANT);
    expect(d.nouveaute?.fichiersChanges).toEqual(["LICENSE.md"]);
    expect(d.nouveaute?.versionVue).toBe("LICENSE.md modifié le 02/10");
  });
  it("…et le résumé la classe ROUGE (licence)", () => {
    const o = dejaLu(remotion(), lu());
    const d = deciderApresLecture(o, lu({ fichiers: { "LICENSE.md": "lic2" } }), MAINTENANT);
    const r = resumerNouveauteSimule({ outil: "Remotion", role: "Montage", versionUtilisee: "4.0.532", versionVue: d.nouveaute!.versionVue, notes: d.nouveaute!.notes });
    expect(r.rouge).toBe(true);
    expect(r.risque).toContain("licence");
  });
  it("page sans version : une empreinte qui change = nouveauté ; une date qui recule n'en est pas une", () => {
    const page: VeilleOutil = outilNeuf({ id: "x", nom: "YouTube", role: "Règles", source: { type: "page", url: "https://x" } }, MAINTENANT);
    const o = dejaLu(page, { ok: true, notes: "", empreinte: "p1" });
    expect(deciderApresLecture(o, { ok: true, notes: "", empreinte: "p2" }, MAINTENANT).nouveaute?.versionVue).toBe("Page modifiée le 02/10");
    const journal = dejaLu(page, { ok: true, version: "2026-09-28", notes: "", empreinte: "p1" });
    expect(deciderApresLecture(journal, { ok: true, version: "2026-09-21", notes: "", empreinte: "p3" }, MAINTENANT).nouveaute).toBeUndefined();
    expect(deciderApresLecture(journal, { ok: true, version: "2026-10-01", notes: "", empreinte: "p3" }, MAINTENANT).nouveaute?.versionVue).toBe("2026-10-01");
  });
  it("source muette : carte grise, la dernière version connue reste", () => {
    const o = dejaLu(remotion(), lu());
    const d = deciderApresLecture(o, { ok: false, raison: "La source ne répond pas." }, MAINTENANT);
    expect(d.patch).toEqual({ etat: "injoignable", verifieLe: MAINTENANT });
    expect(d.nouveaute).toBeUndefined();
  });
});

describe("état d'une carte", () => {
  const base = { etat: "a-jour" as const, versionUtilisee: "4.0.532", derniereVersion: "4.0.532", verifieLe: MAINTENANT };
  it("jamais « à jour » par défaut : pas encore lu ou lecture ratée = gris", () => {
    expect(etatOutil({ ...base, verifieLe: undefined }, [], true)).toBe("injoignable");
    expect(etatOutil(base, [], false)).toBe("injoignable");
  });
  it("à jour, nouveauté (version plus récente ou nouveauté ouverte), attention (rouge ouverte)", () => {
    expect(etatOutil(base, [], true)).toBe("a-jour");
    expect(etatOutil({ ...base, derniereVersion: "4.0.540" }, [], true)).toBe("nouveaute");
    expect(etatOutil(base, [{ statut: "nouvelle", rouge: false }], true)).toBe("nouveaute");
    expect(etatOutil(base, [{ statut: "essayer", rouge: true }], true)).toBe("attention");
  });
  it("une nouveauté ignorée ne colore plus la carte", () => {
    expect(etatOutil(base, [{ statut: "ignoree", rouge: true }], true)).toBe("a-jour");
  });
});

describe("alertes", () => {
  const n = (interet: "fort" | "moyen" | "faible", rouge = false) => ({ rouge, resume: { ceQueCaChange: "", interet } });
  it("e-mail seulement si intérêt fort ou alerte rouge", () => {
    expect(doitEnvoyerEmail(n("fort"))).toBe(true);
    expect(doitEnvoyerEmail(n("faible", true))).toBe(true);
    expect(doitEnvoyerEmail(n("moyen"))).toBe(false);
    expect(doitEnvoyerEmail(n("faible"))).toBe(false);
  });
  it("résumé du lundi : à partir de 8 h (Paris), une fois par semaine", () => {
    // Lundi 5 octobre 2026 : 8 h à Paris = 6 h UTC (heure d'été).
    expect(doitEnvoyerResumeHebdo(new Date("2026-10-05T05:30:00Z"), null)).toBe(false);
    expect(doitEnvoyerResumeHebdo(new Date("2026-10-05T06:05:00Z"), null)).toBe(true);
    expect(doitEnvoyerResumeHebdo(new Date("2026-10-05T06:05:00Z"), semaineIso(new Date("2026-10-05T06:05:00Z")))).toBe(false);
    expect(doitEnvoyerResumeHebdo(new Date("2026-10-06T06:05:00Z"), null)).toBe(false); // mardi
  });
  it("semaine ISO à Paris (dimanche soir tard reste la semaine d'avant)", () => {
    expect(semaineIso(new Date("2026-10-05T06:00:00Z"))).toBe("2026-W41");
    expect(semaineIso(new Date("2026-10-04T21:30:00Z"))).toBe("2026-W40");
    expect(semaineIso(new Date("2027-01-01T12:00:00Z"))).toBe("2026-W53");
  });
  it("texte du résumé : rouges, intérêt fort, outils impossibles à vérifier", () => {
    const t = texteResumeHebdo([{ nom: "Claude", etat: "injoignable" }, { nom: "Remotion", etat: "attention" }], [{ ...n("faible", true), statut: "nouvelle" }, { ...n("fort"), statut: "ignoree" }]);
    expect(t.titre).toBe("Veille de la semaine : une alerte à lire");
    expect(t.message).toBe("2 nouveautés cette semaine, 1 à regarder. 1 alerte rouge (licence, prix ou fonction retirée). 1 à fort intérêt pour vos vidéos. Impossible de vérifier : Claude.");
    expect(texteResumeHebdo([], []).message).toBe("Aucune nouveauté cette semaine.");
  });
  it("une lecture par jour", () => {
    expect(lectureDue(null, new Date(MAINTENANT))).toBe(true);
    expect(lectureDue("2026-10-02T01:00:00.000Z", new Date(MAINTENANT))).toBe(false);
    expect(lectureDue("2026-10-01T09:00:00.000Z", new Date(MAINTENANT))).toBe(true);
  });
});

describe("résumé simulé (règles fixes tant que Claude n'est pas relié)", () => {
  it("prix → rouge", () => {
    expect(resumerNouveauteSimule({ outil: "HeyGen", role: "Double", versionVue: "2026-09", notes: "New pricing for credits starting November" })).toMatchObject({ rouge: true, risque: "Le prix peut changer." });
  });
  it("fonction arrêtée → rouge", () => {
    expect(resumerNouveauteSimule({ outil: "HeyGen", role: "Double", versionVue: "2026-09", notes: "/v1/brand_voice will sunset on October 31" }).rouge).toBe(true);
  });
  it("voix → intérêt fort ; simple correctif → faible", () => {
    expect(resumerNouveauteSimule({ outil: "ElevenLabs", role: "Voix", versionVue: "2026-09-28", notes: "Eleven v4: more natural French voices" }).interet).toBe("fort");
    expect(resumerNouveauteSimule({ outil: "Remotion", role: "Montage", versionUtilisee: "4.0.532", versionVue: "4.0.533", notes: "Fix a typo in docs" })).toMatchObject({ interet: "faible", rouge: false });
  });
  it("version majeure → moyen ; une mention ordinaire du mot « license » ne déclenche pas d'alerte", () => {
    expect(resumerNouveauteSimule({ outil: "FFmpeg", role: "Image", versionUtilisee: "5.1", versionVue: "9.0.2", notes: "FFmpeg 9.0.2" }).interet).toBe("moyen");
    expect(resumerNouveauteSimule({ outil: "fal", role: "Images", versionVue: "Flux", notes: "Apache 2.0 license, commercial use" }).rouge).toBe(false);
  });
  it("français simple, vouvoiement, aucun mot interdit", () => {
    for (const notes of ["New voice model", "pricing change", "LICENSE.md a changé", "Fix", "image-to-video model", "captions alignment"]) {
      const r = resumerNouveauteSimule({ outil: "HeyGen", role: "Double", versionUtilisee: "4.0.0", versionVue: "4.1.0", notes });
      expect(`${r.ceQueCaChange} ${r.risque ?? ""}`).not.toMatch(MOTS_INTERDITS);
      expect(r.ceQueCaChange).not.toMatch(/\btu\b|\bton\b|\bta\b/);
    }
  });
});
