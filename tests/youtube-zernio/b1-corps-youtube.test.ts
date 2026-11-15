import { describe, expect, it } from "vitest";
import { corpsPostZernio, plateformeZernio, type DemandeZernio } from "@/fournisseurs/publication/zernio-corps";
import { PROPOSITION_YOUTUBE, type ReglagesYoutube } from "@/fournisseurs/publication/zernio-youtube";
import { MOT_INTERDIT } from "../zernio/aides/faux-zernio";

const MAINTENANT = Date.parse("2026-11-01T08:00:00Z");
const base = (p: Partial<DemandeZernio> = {}): DemandeZernio => ({
  reseau: "youtube-shorts",
  texte: "Texte d'exemple",
  titre: "Titre d'exemple",
  date: "2026-11-05T10:00:00+01:00",
  fichierCle: "https://exemple-r2.test/video.mp4",
  cible: "exemple-compte-yt",
  cleEnvoi: "a".repeat(64),
  format: "9:16",
  dureeSec: 30,
  ...p,
});
const corps = (p: Partial<DemandeZernio> = {}, reglages: ReglagesYoutube | undefined = PROPOSITION_YOUTUBE) => corpsPostZernio(base(p), { maintenant: MAINTENANT, ...(reglages ? { youtube: reglages } : {}) });
const spec = (c: ReturnType<typeof corps>) => c.platforms[0].platformSpecificData as Record<string, unknown>;
const avec = (r: Partial<ReglagesYoutube>): ReglagesYoutube => ({ ...PROPOSITION_YOUTUBE, ...r });

describe("b1 · corps YouTube Shorts", () => {
  it("plateformeZernio : youtube-shorts → youtube ; youtube (long) refusé", () => {
    expect(plateformeZernio("youtube-shorts")).toBe("youtube");
    expect(() => plateformeZernio("youtube")).toThrow(/pas pris en charge/);
  });

  it("réglages = proposition : platformSpecificData STRICT, content, brouillon, clé Studio", () => {
    const c = corps();
    expect(c.platforms[0]).toMatchObject({ platform: "youtube", accountId: "exemple-compte-yt" });
    expect(spec(c)).toStrictEqual({ title: "Titre d'exemple", visibility: "public", categoryId: "27", containsSyntheticMedia: true, madeForKids: false });
    expect(c.content).toBe("Texte d'exemple");
    expect(c.isDraft).toBe(true);
    expect(c.metadata).toEqual({ origine: "studio", studioCle: "a".repeat(64) });
    expect(c.mediaItems).toEqual([{ type: "video", url: "https://exemple-r2.test/video.mp4" }]);
  });

  it("titre : du kit ; sinon 1re ligne non vide ; 150 signes → 100 avec « … » ; vide, < ou > : refus ; mot interdit", () => {
    expect(spec(corps({ titre: undefined, texte: "\n\n  Première   ligne  \nSuite" })).title).toBe("Première ligne");
    const long = "a".repeat(150);
    const t = spec(corps({ titre: long })).title as string;
    expect(t.length).toBe(100);
    expect(t.endsWith("…")).toBe(true);
    expect(t).toBe(`${"a".repeat(99)}…`);
    expect(() => corps({ titre: undefined, texte: "   " })).toThrow(/titre manque/);
    expect(() => corps({ titre: "a < b" })).toThrow(/< ni >/);
    expect(() => corps({ titre: "a > b" })).toThrow(/< ni >/);
    try {
      corps({ titre: `Un ${MOT_INTERDIT}` });
      expect.unreachable();
    } catch (e) {
      expect((e as { code?: string }).code).toBe("mot-interdit");
    }
  });

  it("titre « premiere-ligne » : aucune clé title", () => {
    const s = spec(corps({}, avec({ titre: "premiere-ligne" })));
    expect("title" in s).toBe(false);
    expect(s).toStrictEqual({ visibility: "public", categoryId: "27", containsSyntheticMedia: true, madeForKids: false });
  });

  it("description : plus de 5 000 octets (accents comptés) refusée ; 5 000 acceptée ; < ou > refusés", () => {
    expect(() => corps({ texte: "é".repeat(2501) })).toThrow(/5 000 octets/);
    expect(corps({ texte: "é".repeat(2500) }).content.length).toBe(2500);
    expect(() => corps({ texte: "a".repeat(5001) })).toThrow(/5 000 octets/);
    expect(() => corps({ texte: "voir -> ici" })).toThrow(/< ni >/);
    expect(() => corps({ texte: "a < b" })).toThrow(/< ni >/);
  });

  it("synthétique : oui, non, selon-la-video (contenuIA vrai, faux, absent)", () => {
    expect(spec(corps({}, avec({ synthetique: "oui" }))).containsSyntheticMedia).toBe(true);
    expect(spec(corps({ contenuIA: false }, avec({ synthetique: "oui" }))).containsSyntheticMedia).toBe(true);
    expect(spec(corps({ contenuIA: true }, avec({ synthetique: "non" }))).containsSyntheticMedia).toBe(false);
    expect(spec(corps({ contenuIA: true }, avec({ synthetique: "selon-la-video" }))).containsSyntheticMedia).toBe(true);
    expect(spec(corps({ contenuIA: false }, avec({ synthetique: "selon-la-video" }))).containsSyntheticMedia).toBe(false);
    expect(spec(corps({}, avec({ synthetique: "selon-la-video" }))).containsSyntheticMedia).toBe(false);
  });

  it("pour enfants : madeForKids toujours envoyé (vrai et faux)", () => {
    expect(spec(corps({}, avec({ pourEnfants: true }))).madeForKids).toBe(true);
    const s = spec(corps({}, avec({ pourEnfants: false })));
    expect("madeForKids" in s).toBe(true);
    expect(s.madeForKids).toBe(false);
  });

  it("visibilité et catégorie : celles des réglages, jamais figées", () => {
    const s = spec(corps({}, avec({ visibilite: "private", categorieId: "22" })));
    expect(s).toMatchObject({ visibility: "private", categoryId: "22" });
    expect(spec(corps({}, avec({ visibilite: "unlisted", categorieId: "10" }))).categoryId).toBe("10");
  });

  it("sans réglages : refus net", () => {
    expect(() => corps({}, undefined)).toThrow(/réglages .* pas été choisis/);
  });

  it("images ou document : refus (seule une vidéo est publiée)", () => {
    expect(() => corps({ images: [{ url: "https://x.test/a.png", texteAlternatif: "Image d'exemple" }] })).toThrow(/seule une vidéo/);
    expect(() => corps({ document: { url: "https://x.test/a.pdf", titre: "Doc" } })).toThrow(/seule une vidéo/);
  });

  it("format et durée : 16:9, 1:1, absent ; 181, 0, NaN, négative, absente : refus ; 180 accepté", () => {
    for (const format of ["16:9", "1:1", undefined]) expect(() => corps({ format })).toThrow(/verticale \(9:16\)/);
    for (const dureeSec of [181, 0, Number.NaN, -3, Number.POSITIVE_INFINITY, undefined]) expect(() => corps({ dureeSec })).toThrow(/3 minutes au plus/);
    expect(spec(corps({ dureeSec: 180 })).visibility).toBe("public");
    expect(spec(corps({ dureeSec: 0.5 })).visibility).toBe("public");
  });

  it("premier commentaire : jamais transmis, aucune clé firstComment, playlist, notification, étiquettes", () => {
    const c = corps({ premierCommentaire: "Un commentaire d'exemple" });
    const t = JSON.stringify(c);
    expect(t).not.toMatch(/firstComment|playlistId|notifySubscribers|tags/);
    expect(spec(c)).not.toHaveProperty("firstComment");
  });

  it("refus avant tout : date non future", () => {
    expect(() => corps({ date: "2026-11-01T07:00:00Z" })).toThrow(/futur/);
  });
});
