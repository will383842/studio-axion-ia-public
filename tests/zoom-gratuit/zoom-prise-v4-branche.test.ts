/**
 * Fiche C8-Z08b : le service de rendu applique les zooms de prise qu'on lui envoie (`parametres.zoomsPrise`, absent partout).
 * Chemin réel : vraies `lireParametresFacecamV4`, `filtreMontageV4` et `compositionFacecamV4` (refus avant tout téléchargement),
 * puis rendu « par instants » par FFmpeg avec le vrai filtre du montage.
 * Absent ou vide : chaîne rendue identique au caractère à celle de master (empreintes sha256 calculées AVANT le changement).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const telechargements = vi.hoisted(() => ({ n: 0 }));
vi.mock("../../studio-rendu/src/outils", async (importOriginal) => {
  const vrai = await importOriginal<typeof import("../../studio-rendu/src/outils")>();
  return { ...vrai, telecharger: async () => { telechargements.n++; throw new Error("téléchargement interdit dans ce test"); } };
});

import { filtreZoomPrise } from "../../studio-rendu/src/composition/zoom-prise";
import { compositionFacecamV4, filtreMontageV4, lireParametresFacecamV4, PRISE_MONTEE_V4, type RecadrageMontageV4 } from "../../studio-rendu/src/operations/facecam-v4";
import type { ContexteOperation, DemandeRendu } from "../../studio-rendu/src/contrat";

const RACINE = join(__dirname, "..", "..");
const TRANS = JSON.parse(readFileSync(join(RACINE, "docs/facecam-animee-v4/repetition-generale/transcription.json"), "utf8")) as { gardes: { debutSec: number; finSec: number }[] };
const GARDES = TRANS.gardes;
const RECADRAGE: RecadrageMontageV4 = { x: 656, largeur: 608, hauteur: 1080, sortieLargeur: 1080, sortieHauteur: 1920 };
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Empreintes de `filtreMontageV4` sur master (avant C8-Z08b), gardes de la répétition générale (lot-i.test.ts). */
const EMPREINTES_MASTER: { recadrage: boolean; finDouce: boolean; sha: string }[] = [
  { recadrage: false, finDouce: false, sha: "45985cb6b5c1c15a79a68f54cab3fb4dd3b88ca983e8a71f9988d3bde7826725" },
  { recadrage: false, finDouce: true, sha: "47e5a157f9ad397588808ffd7a474d7a2757554c0665a525a507392c1c873b1e" },
  { recadrage: true, finDouce: false, sha: "286d84476a5d2cf8bae84f0527e6d7e4662833ac38a23e0b38368a8be183d3a4" },
  { recadrage: true, finDouce: true, sha: "cccedced5c25d1e1dd435dde92bc444740af3e17355b29f618b46a1930b51ad6" },
];
/** Empreinte de `JSON.stringify(lireParametresFacecamV4(COMPLET))` sur master. */
const EMPREINTE_PARAMETRES_MASTER = "91dada95ae434e17ebdca26fc8c872073e0c5904442a54ad14ffa61bc4e9314b";
const CLES_MASTER = ["mode", "plan", "gardes", "recadrage", "finDouce", "crf", "debitMax", "vignette", "master"];

const plan = () => ({ elementsV4: [{ type: "texte" }], duree: 10, fps: 30, prise: { src: PRISE_MONTEE_V4 } });
const COMPLET = (): Record<string, unknown> => ({
  plan: plan(), gardes: GARDES, recadrage: RECADRAGE, finDouce: true, crf: 18, debitMax: "3000k",
  vignette: { urlDepot: "u", cle: "k" }, master: { urlDepot: "m", cle: "km" },
});
const FENETRES = [
  { debutSec: 3, finSec: 5, facteur: 1.05 },
  { debutSec: 12, finSec: 14.5, facteur: 1.04 },
];
const ZOOMS = { fenetres: FENETRES, largeur: 1080, hauteur: 1920 };

describe("C8-Z08b (a) · éteint = identique au caractère", () => {
  for (const e of EMPREINTES_MASTER) {
    const r = e.recadrage ? RECADRAGE : undefined;
    const f = e.finDouce ? true : undefined;
    it(`recadrage=${e.recadrage} finDouce=${e.finDouce} : sans 4e argument, undefined, fenêtres vides → chaîne de master`, () => {
      expect(sha(filtreMontageV4(GARDES, r, f))).toBe(e.sha);
      expect(sha(filtreMontageV4(GARDES, r, f, undefined))).toBe(e.sha);
      expect(sha(filtreMontageV4(GARDES, r, f, { fenetres: [], largeur: 1080, hauteur: 1920 }))).toBe(e.sha);
    });
  }

  it("lireParametresFacecamV4 sans zoomsPrise : objet de master, aucune clé neuve", () => {
    const lu = lireParametresFacecamV4(COMPLET());
    expect(Object.keys(lu)).toEqual(CLES_MASTER);
    expect(sha(JSON.stringify(lu))).toBe(EMPREINTE_PARAMETRES_MASTER);
    expect("zoomsPrise" in lireParametresFacecamV4({ ...COMPLET(), zoomsPrise: null })).toBe(false);
    expect("zoomsPrise" in lireParametresFacecamV4({ plan: plan(), gardes: GARDES })).toBe(false);
  });

  it("zoomsPrise aux fenêtres vides : aucune clé ajoutée", () => {
    expect(lireParametresFacecamV4({ ...COMPLET(), zoomsPrise: { fenetres: [], largeur: 1080, hauteur: 1920 } })).toEqual(lireParametresFacecamV4(COMPLET()));
  });
});

describe("C8-Z08b (b) · allumé : le zoom passe entre le montage et [v]", () => {
  const zoom = filtreZoomPrise(FENETRES, 1080, 1920);
  const compter = (s: string, m: string) => s.split(m).length - 1;

  it("sans recadrage : concat=…[vz][a];[vz]<zoom>[v]", () => {
    const f = filtreMontageV4(GARDES, undefined, undefined, ZOOMS);
    expect(compter(f, zoom)).toBe(1);
    expect(f.endsWith(`concat=n=${GARDES.length}:v=1:a=1[vz][a];[vz]${zoom}[v]`)).toBe(true);
    expect(compter(f, "[a]")).toBe(1);
    expect(f.startsWith(filtreMontageV4(GARDES).replace(/\[v\]\[a\]$/, ""))).toBe(true);
  });

  it("avec recadrage et fin douce : …setsar=1[vr];[vr]<zoom>[v]", () => {
    const f = filtreMontageV4(GARDES, RECADRAGE, true, ZOOMS);
    expect(compter(f, zoom)).toBe(1);
    expect(f.endsWith(`setsar=1[vr];[vr]${zoom}[v]`)).toBe(true);
    expect(compter(f, "[a]")).toBe(1);
    expect(f.replace(`[vr];[vr]${zoom}[v]`, "[v]")).toBe(filtreMontageV4(GARDES, RECADRAGE, true));
  });

  it("lireParametresFacecamV4 garde les zooms valides (avec et sans recadrage)", () => {
    expect(lireParametresFacecamV4({ plan: plan(), gardes: GARDES, zoomsPrise: ZOOMS }).zoomsPrise).toEqual(ZOOMS);
    const lu = lireParametresFacecamV4({ ...COMPLET(), zoomsPrise: ZOOMS });
    expect(lu.zoomsPrise).toEqual(ZOOMS);
    const { zoomsPrise, ...reste } = lu;
    expect(zoomsPrise).toBeDefined();
    expect(reste).toEqual(lireParametresFacecamV4(COMPLET()));
  });
});

describe("C8-Z08b (c) · refus AVANT tout téléchargement", () => {
  beforeEach(() => {
    telechargements.n = 0;
  });
  const contexte = (): ContexteOperation => ({ dossier: mkdtempSync(join(tmpdir(), "c8-z08b-")), signal: new AbortController().signal, progression: () => {} }) as unknown as ContexteOperation;
  const demande = (zoomsPrise: unknown, avecRecadrage = false): DemandeRendu =>
    ({ operation: "composition", parametres: { plan: plan(), gardes: GARDES, ...(avecRecadrage ? { recadrage: RECADRAGE } : {}), zoomsPrise }, entrees: { prise: "https://depot.exemple/prise.mp4" }, sortie: { urlDepot: "https://depot.exemple/v.mp4" } }) as unknown as DemandeRendu;

  const cas: [string, unknown, boolean][] = [
    ["dimensions impaires", { fenetres: FENETRES, largeur: 1081, hauteur: 1920 }, false],
    ["dimensions nulles", { fenetres: FENETRES, largeur: 0, hauteur: 1920 }, false],
    ["dimensions non entières", { fenetres: FENETRES, largeur: 1080.5, hauteur: 1920 }, false],
    ["fenêtres chevauchantes", { fenetres: [{ debutSec: 1, finSec: 4, facteur: 1.05 }, { debutSec: 3, finSec: 6, facteur: 1.05 }], largeur: 1080, hauteur: 1920 }, false],
    ["facteur 1,2", { fenetres: [{ debutSec: 1, finSec: 4, facteur: 1.2 }], largeur: 1080, hauteur: 1920 }, false],
    ["fenêtre non finie", { fenetres: [{ debutSec: 1, finSec: Infinity, facteur: 1.05 }], largeur: 1080, hauteur: 1920 }, false],
    ["fenêtres absentes", { largeur: 1080, hauteur: 1920 }, false],
    ["largeur ≠ sortieLargeur avec recadrage", { fenetres: FENETRES, largeur: 608, hauteur: 1080 }, true],
  ];
  for (const [nom, z, avecRecadrage] of cas) {
    it(`${nom} → ErreurRendu « refuse », aucun téléchargement`, async () => {
      expect(() => lireParametresFacecamV4({ ...(demande(z, avecRecadrage).parametres as Record<string, unknown>) })).toThrow(expect.objectContaining({ name: "ErreurRendu", erreur: expect.objectContaining({ code: "refuse", reessayable: false }) }));
      await expect(compositionFacecamV4(demande(z, avecRecadrage), contexte())).rejects.toMatchObject({ name: "ErreurRendu", erreur: { code: "refuse", reessayable: false } });
      expect(telechargements.n).toBe(0);
    });
  }

  it("témoin : des zooms valides passent le contrôle et arrivent au téléchargement", async () => {
    await expect(compositionFacecamV4(demande(ZOOMS, true), contexte())).rejects.toThrow(/téléchargement interdit/);
    expect(telechargements.n).toBe(1);
  });
});

// (d) Rendu « par instants » : le vrai filtre du montage appliqué par FFmpeg comme l'opération (filter_complex_script, [v] et [a]).
const aFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0 && spawnSync("ffprobe", ["-version"]).status === 0;

describe.skipIf(!aFfmpeg)("C8-Z08b (d) · rendu par instants (FFmpeg réel)", () => {
  const dossier = mkdtempSync(join(tmpdir(), "c8-z08b-rendu-"));
  afterAll(() => rmSync(dossier, { recursive: true, force: true }));
  const source = join(dossier, "prise.mp4");
  const gardes = [{ debutSec: 0, finSec: 4 }];
  const zooms = { fenetres: [{ debutSec: 1, finSec: 2.5, facteur: 1.06 }], largeur: 1080, hauteur: 1920 };

  const monter = (nom: string, filtre: string): { chemin: string; secondes: number } => {
    const script = join(dossier, `${nom}.txt`);
    writeFileSync(script, filtre);
    const chemin = join(dossier, `${nom}.mp4`);
    const t = Date.now();
    execFileSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", "-i", source, "-filter_complex_script", script, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "17", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-r", "30", "-g", "30", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", chemin]);
    return { chemin, secondes: (Date.now() - t) / 1000 };
  };
  const sonde = (chemin: string) => {
    const j = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", chemin]).toString()) as { format: { duration: string }; streams: { codec_type: string; width?: number; height?: number }[] };
    const v = j.streams.find((s) => s.codec_type === "video");
    return { duree: Number(j.format.duration), largeur: v?.width, hauteur: v?.height, son: j.streams.some((s) => s.codec_type === "audio") };
  };
  const image = (chemin: string, t: number): Buffer => execFileSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", chemin, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"], { maxBuffer: 1 << 25 });
  const psnr = (a: Buffer, b: Buffer): number => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
    const mse = s / a.length;
    return mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
  };

  it("durée et dimensions identiques ; 0,5 s = filtre éteint ; 1,8 s zoomée", () => {
    execFileSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=1080x1920:rate=30:duration=4", "-f", "lavfi", "-i", "sine=frequency=440:duration=4:sample_rate=48000", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "10", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", source]);
    const eteint = monter("eteint", filtreMontageV4(gardes));
    const allume = monter("allume", filtreMontageV4(gardes, undefined, undefined, zooms));
    const e = sonde(eteint.chemin);
    const a = sonde(allume.chemin);
    expect(a.largeur).toBe(1080);
    expect(a.hauteur).toBe(1920);
    expect(a.son).toBe(true);
    expect([a.largeur, a.hauteur]).toEqual([e.largeur, e.hauteur]);
    expect(Math.abs(a.duree - e.duree)).toBeLessThan(0.05);
    expect(Math.abs(a.duree - 4)).toBeLessThan(0.1);
    expect(psnr(image(allume.chemin, 0.5), image(eteint.chemin, 0.5))).toBeGreaterThanOrEqual(40);
    expect(psnr(image(allume.chemin, 1.8), image(eteint.chemin, 1.8))).toBeLessThan(30);
    // Temps de montage mesuré (0 € : rendu sur le serveur du Studio) : le zoom ne doit pas exploser le temps.
    expect(Number.isFinite(allume.secondes) && allume.secondes > 0).toBe(true);
    expect(allume.secondes).toBeLessThan(eteint.secondes * 4 + 2);
  }, 120_000);
});
