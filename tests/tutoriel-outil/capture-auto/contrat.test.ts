/** POSTE-3 : contrat de la boîte `capture-boite.v1` (module pur). Aucun disque, aucun navigateur, 0 appel payant. */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { lireCalage } from "../../../outils/maquettes-tableaux-de-bord/capture/plan-capture";
import {
  CODES_REPONSE,
  PHRASES_CODE,
  PHRASE_BOITE_NON_PRETE,
  PHRASE_POSTE_ETEINT,
  PHRASE_SANS_REPONSE,
  TYPES_DEMANDE,
  TYPES_SERVIS,
  calageDepuis,
  calageRegulier,
  dimensionsFilm,
  idDemande,
  jugerFfprobe,
  lireEtat,
  lireNomDossier,
  nomDossier,
  signatureMp4,
} from "../../../src/moteurs/montage-tutoriel-outil/capture-auto/contrat";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const INTERDIT = /€|\$|\bEUR\b|\bUSD\b|euros?\b|dollars?\b|\bco[ûu]ts?\b|\bprix\b/i;

describe("idDemande", () => {
  it("est déterministe et conforme au motif", () => {
    const a = idDemande("Vidéo_42", "contenu", sha);
    expect(a).toBe(idDemande("Vidéo_42", "contenu", sha));
    expect(a).toMatch(/^[a-z0-9-]{8,64}$/);
    expect(idDemande("Vidéo_42", "autre", sha)).not.toBe(a);
  });
  it("coupe le videoId à 40 caractères", () => {
    const id = idDemande("x".repeat(200), "c", sha);
    expect(id.length).toBe(40 + 1 + 12);
  });
  it("accepte un videoId vide et refuse une empreinte tordue", () => {
    expect(idDemande("", "c", sha)).toMatch(/^[a-z0-9-]{8,64}$/);
    expect(() => idDemande("v", "c", () => "zz")).toThrow();
  });
});

describe("noms de dossiers", () => {
  const id = "abcdefgh-123456789012";
  it("accepte les trois types", () => {
    for (const t of TYPES_DEMANDE) expect(lireNomDossier(nomDossier(t, id))).toEqual({ type: t, id });
  });
  it("refuse tout autre motif", () => {
    for (const n of [`film-zip--..`, `film-zip--../${id}`, `film-zip--${id}/x`, `film-zip--ABCDEFGH`, `film-zip--${"a".repeat(65)}`, `inconnu--${id}`, `film-zip-${id}`, "", `/film-zip--${id}`])
      expect(lireNomDossier(n)).toBeNull();
    expect(lireNomDossier(42)).toBeNull();
    expect(() => nomDossier("inconnu" as never, id)).toThrow();
    expect(() => nomDossier("film-zip", "court")).toThrow();
  });
});

describe("types servis", () => {
  it("le contrat garde les trois types, le veilleur ne sert que film-zip", () => {
    expect(TYPES_DEMANDE).toEqual(["film-zip", "film-description", "apercu"]);
    expect(TYPES_SERVIS).toEqual(["film-zip"]);
  });
});

describe("lireEtat", () => {
  it("lit les deux lignes", () => {
    expect(lireEtat("ok\nOK\n")).toEqual({ ok: true, statut: "ok", code: "OK" });
    expect(lireEtat("panne\nCAPTURE_ECHEC")).toEqual({ ok: true, statut: "panne", code: "CAPTURE_ECHEC" });
  });
  it("refuse code hors liste, statut inconnu, incohérence, lignes en trop", () => {
    for (const t of ["ok\nPIRATE\n", "bof\nOK\n", "ok\nCAPTURE_ECHEC\n", "refus\nOK\n", "ok\n", "ok\nOK\nplus\n", "", "ok\r\nOK\r\n", "ok\n\nOK\n"]) expect(lireEtat(t).ok).toBe(false);
    expect(lireEtat(undefined).ok).toBe(false);
  });
});

describe("jugerFfprobe", () => {
  const attendu = { dureeMs: 18_500, ...dimensionsFilm(1080, 1350) };
  const bon = { streams: [{ codec_type: "video", codec_name: "h264", width: 2160, height: 2700 }], format: { duration: "18.5" } };
  it("accepte le bon film (texte ou objet)", () => {
    expect(jugerFfprobe(bon, attendu).ok).toBe(true);
    expect(jugerFfprobe(JSON.stringify(bon), attendu).ok).toBe(true);
    expect(jugerFfprobe({ ...bon, format: { duration: "19.4" } }, attendu).ok).toBe(true);
  });
  it("refuse codec, durée, dimensions, flux en trop, JSON tordu", () => {
    const v = (x: unknown) => jugerFfprobe(x, attendu).ok;
    expect(v({ ...bon, streams: [{ ...bon.streams[0], codec_name: "vp9" }] })).toBe(false);
    expect(v({ ...bon, format: { duration: "20" } })).toBe(false);
    expect(v({ ...bon, format: { duration: "17" } })).toBe(false);
    expect(v({ ...bon, streams: [{ ...bon.streams[0], width: 1080 }] })).toBe(false);
    expect(v({ ...bon, streams: [...bon.streams, { codec_type: "audio", codec_name: "aac" }] })).toBe(false);
    expect(v({ ...bon, streams: [{ ...bon.streams[0], codec_type: "audio" }] })).toBe(false);
    expect(v({ ...bon, format: {} })).toBe(false);
    expect(v({ streams: "x" })).toBe(false);
    expect(v("{pas du json")).toBe(false);
    expect(v(null)).toBe(false);
    expect(v([])).toBe(false);
  });
});

describe("calage", () => {
  it("calageRegulier est lu sans erreur par lireCalage", () => {
    const c = calageRegulier(["a", "b", "c"]);
    expect(c).toEqual({ dureeVoixMs: 9000, etapes: [{ id: "a", debutMs: 0, finMs: 3000 }, { id: "b", debutMs: 3000, finMs: 6000 }, { id: "c", debutMs: 6000, finMs: 9000 }] });
    expect(lireCalage(c).ok).toBe(true);
    expect(lireCalage(calageDepuis([{ id: "a", debutMs: 0, finMs: 1000 }], 1000)).ok).toBe(true);
  });
  it("refuse un calage vide ou invalide", () => {
    expect(() => calageDepuis([], 1000)).toThrow();
    expect(() => calageRegulier([])).toThrow();
    expect(() => calageDepuis([{ id: "a", debutMs: 5, finMs: 5 }], 1000)).toThrow();
    expect(() => calageDepuis([{ id: "a", debutMs: 0, finMs: 5 }], 0)).toThrow();
  });
});

describe("signature MP4", () => {
  it("reconnaît ftyp et refuse le reste", () => {
    expect(signatureMp4(Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73]))).toBe(true);
    expect(signatureMp4(Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00"))).toBe(false);
    expect(signatureMp4(new Uint8Array(3))).toBe(false);
  });
});

describe("phrases pour Williams", () => {
  it("chaque code a une phrase, sans montant ni jargon d'argent", () => {
    for (const c of CODES_REPONSE) {
      expect(PHRASES_CODE[c].length).toBeGreaterThan(10);
      expect(PHRASES_CODE[c]).not.toMatch(INTERDIT);
    }
    for (const p of [PHRASE_POSTE_ETEINT, PHRASE_BOITE_NON_PRETE, PHRASE_SANS_REPONSE]) expect(p).not.toMatch(INTERDIT);
    expect(Object.keys(PHRASES_CODE).sort()).toEqual([...CODES_REPONSE].sort());
  });
});
