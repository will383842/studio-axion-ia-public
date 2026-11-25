/** POSTE-3 : contrat de la boîte `capture-boite.v1` (module pur). Aucun disque, aucun navigateur, 0 appel payant. */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { IMAGES_PAR_SECONDE_FILM, MARGE_FIN_FILM_MS } from "../../../outils/maquettes-tableaux-de-bord/capture/film-images";
import { lireCalage } from "../../../outils/maquettes-tableaux-de-bord/capture/plan-capture";
import {
  IMAGES_PAR_SECONDE_FILM as IMAGES_CONTRAT,
  MARGE_FIN_FILM_MS as MARGE_CONTRAT,
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
  dureeFilmAttendueMs,
  idDemande,
  idFilm,
  jugerFfprobe,
  lireEtat,
  lireNomDossier,
  nomDossier,
  signatureMp4,
} from "../../../src/moteurs/montage-tutoriel-outil/capture-auto/contrat";

// sha256 des octets UTF-8 : `printf '%s\n%s' '{"titre":"Gestion des stocks : été à Zürich"}' '{"dureeVoixMs":9000}' | sha256sum`, 12 premiers hex.
const EMPREINTE_ACCENTUEE = "966c8ee250e3";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
// Motif « aucun prix » de fiches-audit-25-11/00-COMMUN.md (FIN), plus les monnaies écrites.
const AUCUN_PRIX = /\b(prix|budget|plafond|coût|couts?|tarif|devis)\b|€/i;
const INTERDIT_PLUS = /\$|\bEUR\b|\bUSD\b|euros?\b|dollars?\b|\bco[ûu]ts?/i;
const INTERDIT = new RegExp(`${AUCUN_PRIX.source}|${INTERDIT_PLUS.source}`, "i");

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

describe("idFilm (formule unique : sha256 sur des octets UTF-8)", () => {
  const shaO = (o: Uint8Array) => createHash("sha256").update(o).digest("hex");
  const scenario = Buffer.from('{"titre":"Gestion des stocks : été à Zürich"}', "utf8");
  const calage = Buffer.from('{"dureeVoixMs":9000}', "utf8");
  it("= videoId nettoyé + « - » + 12 premiers hexadécimaux du sha256 de scénario + 0x0A + calage (octets UTF-8)", () => {
    const attendu = createHash("sha256").update(Buffer.concat([scenario, Buffer.from([0x0a]), calage])).digest("hex").slice(0, 12);
    expect(idFilm("Stocks_05", scenario, calage, shaO)).toBe(`stocks-05-${attendu}`);
  });
  it("cas accentué : valeur fixe, différente de celle d'un hachage latin1 (l'ancien écart avec POSTE-4)", () => {
    // sha256( UTF-8 de {"titre":"Gestion des stocks : été à Zürich"} + 0x0A + {"dureeVoixMs":9000} ), 12 premiers hex, calculé avec `sha256sum`.
    const id = idFilm("stocks", scenario, calage, shaO);
    expect(id).toMatch(/^stocks-[a-f0-9]{12}$/);
    const latin1 = createHash("sha256").update(Buffer.concat([scenario, Buffer.from([0x0a]), calage]).toString("latin1")).digest("hex").slice(0, 12);
    expect(id).not.toBe(`stocks-${latin1}`);
    expect(id).toBe(`stocks-${EMPREINTE_ACCENTUEE}`);
  });
  it("change avec le scénario ou le calage, reste conforme au motif, refuse une empreinte tordue", () => {
    const a = idFilm("v", scenario, calage, shaO);
    expect(idFilm("v", scenario, Buffer.from("{}"), shaO)).not.toBe(a);
    expect(idFilm("v", Buffer.from("{}"), calage, shaO)).not.toBe(a);
    expect(a).toMatch(/^[a-z0-9-]{8,64}$/);
    expect(() => idFilm("v", scenario, calage, () => "zz")).toThrow();
  });
});

describe("constantes du film = celles de capture/film-images.ts", () => {
  it("MARGE_FIN_FILM_MS et IMAGES_PAR_SECONDE_FILM sont égales", () => {
    expect(MARGE_CONTRAT).toBe(MARGE_FIN_FILM_MS);
    expect(IMAGES_CONTRAT).toBe(IMAGES_PAR_SECONDE_FILM);
  });
  it("la durée attendue d'un film = durée de la voix + la marge", () => {
    expect(dureeFilmAttendueMs(9000)).toBe(9000 + MARGE_FIN_FILM_MS);
    // 8 s de voix : le film dure 8,5 s ; comparer à 8 s seul mangerait la moitié de la tolérance de 1 s.
    const bon = { streams: [{ codec_type: "video", codec_name: "h264", width: 2160, height: 2700 }], format: { duration: "9.5" } };
    expect(jugerFfprobe(bon, { dureeMs: dureeFilmAttendueMs(8000), ...dimensionsFilm(1080, 1350) }).ok).toBe(true);
    expect(jugerFfprobe({ ...bon, format: { duration: "10.6" } }, { dureeMs: dureeFilmAttendueMs(8000), ...dimensionsFilm(1080, 1350) }).ok).toBe(false);
  });
});

describe("motif « aucun prix »", () => {
  it("attrape budget, plafond, tarif, devis, coût, prix, €", () => {
    for (const m of ["le budget", "un plafond", "le tarif", "un devis", "le coût", "les couts", "le prix", "5 €"]) expect(AUCUN_PRIX.test(m)).toBe(true);
  });
});
