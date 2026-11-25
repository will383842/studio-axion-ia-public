// T-EXT-51a : tests du jugement du poste de capture. AUCUN navigateur lancé, aucun réseau.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MESSAGE_ENVIRONNEMENT_INTERDIT } from "../../../outils/maquettes-tableaux-de-bord/capture/garde";
import {
  EXIGENCES_POSTE,
  empreintePoste,
  jugerPoste,
  lireEncodeurs,
  lireFiltres,
  lireVersionFfmpeg,
  posteJson,
  type SondesPoste,
} from "../../../outils/maquettes-tableaux-de-bord/poste/poste";

const FILTRES_TXT = `Filters:
  T.. = Timeline support
 ... abench            A->A       Benchmark part of a filtergraph.
 ... blackdetect       V->V       Detect video intervals that are (almost) black.
 T.. freezedetect      V->V       Detect frozen video input.
 T.. ssim              VV->V      Calculate the SSIM between two video streams.
 ... anullsrc          |->A       Null audio source.
`;
const ENCODEURS_TXT = `Encoders:
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)
 V....D libx264rgb           libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 RGB (codec h264)
 A....D aac                  AAC (Advanced Audio Coding)
`;

function poste(sur: Partial<SondesPoste> = {}): SondesPoste {
  return {
    plateforme: "linux",
    env: { CLAUDE_CODE_REMOTE: "true" },
    playwright: EXIGENCES_POSTE.playwright,
    chromium: { chemin: "/opt/pw-browsers/chromium-1243/chrome", version: "141.0.7390.37" },
    ffmpeg: { version: "8.1.1", encodeurs: lireEncodeurs(ENCODEURS_TXT), filtres: lireFiltres(FILTRES_TXT) },
    ffprobe: "8.1.1",
    policeSha256: "a".repeat(64),
    espaceLibreMo: 5000,
    ...sur,
  };
}

describe("lecture des sorties de FFmpeg", () => {
  it("version", () => {
    expect(lireVersionFfmpeg("ffmpeg version 8.1.1-static https://johnvansickle.com/ffmpeg/  Copyright")).toBe("8.1.1");
    expect(lireVersionFfmpeg("ffmpeg version 6.1.1-3ubuntu5 Copyright (c) 2000-2023")).toBe("6.1.1");
    expect(lireVersionFfmpeg("n'importe quoi")).toBeUndefined();
  });
  it("filtres, avec et sans ssim", () => {
    const f = lireFiltres(FILTRES_TXT);
    expect(f).toEqual(expect.arrayContaining(["ssim", "freezedetect", "blackdetect"]));
    expect(lireFiltres(FILTRES_TXT.replace(/.*ssim.*\n/, ""))).not.toContain("ssim");
  });
  it("encodeurs, avec et sans libx264", () => {
    expect(lireEncodeurs(ENCODEURS_TXT)).toContain("libx264");
    expect(lireEncodeurs("Encoders:\n V..... = Video\n V....D libx264 H.264")).toEqual(["libx264"]);
    expect(lireEncodeurs(ENCODEURS_TXT.replace(/ V....D libx264 .*\n/, ""))).not.toContain("libx264");
  });
});

// Extrait RÉEL de `ffmpeg -hide_banner -filters` / `-encoders` de FFmpeg 8.1.1 (image studio-capture, binaire
// /usr/local/bin/ffmpeg issu de mwader/static-ffmpeg:8.1.1) : 2 caractères d'options pour les filtres.
const FILTRES_TXT_FFMPEG8 = `Filters:
  T.. = Timeline support
  .S. = Slice threading
  A = Audio input/output
  V = Video input/output
  N = Dynamic number and/or type of input/output
  | = Source or sink filter
  ------
 TS aap               AA->A      Apply Affine Projection algorithm to first audio stream.
 .. anull             A->A       Pass the source unchanged to the output.
 .S blackdetect       V->V       Detect video intervals that are (almost) black.
 .. freezedetect      V->V       Detects frozen video input.
 TS ssim              VV->V      Calculate the SSIM between two video streams.
`;
const ENCODEURS_TXT_FFMPEG8 = `Encoders:
 V..... = Video
 A..... = Audio
 S..... = Subtitle
 ....B. = Supports draw_horiz_band
 .....D = Supports direct rendering method 1
 ------
 V....D amv                  AMV Video
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)
 V....D libx264rgb           libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 RGB (codec h264)
`;

describe("FFmpeg 8.1.1 : sortie réelle à 2 caractères d'options", () => {
  it("lireFiltres lit les noms, sans lire l'en-tête ni la légende", () => {
    expect(lireFiltres(FILTRES_TXT_FFMPEG8)).toEqual(["aap", "anull", "blackdetect", "freezedetect", "ssim"]);
  });
  it("lireEncodeurs lit libx264 sur la sortie réelle", () => {
    expect(lireEncodeurs(ENCODEURS_TXT_FFMPEG8)).toEqual(["amv", "libx264", "libx264rgb"]);
  });
  it("jugerPoste accepte un poste FFmpeg 8.1.1 avec ces filtres", () => {
    const j = jugerPoste(
      poste({ ffmpeg: { version: "8.1.1", encodeurs: lireEncodeurs(ENCODEURS_TXT_FFMPEG8), filtres: lireFiltres(FILTRES_TXT_FFMPEG8) } }),
    );
    expect(j.manques).toEqual([]);
    expect(j.ok).toBe(true);
  });
});

describe("jugerPoste", () => {
  it("poste complet en cloud → ok", () => {
    const j = jugerPoste(poste());
    expect(j).toMatchObject({ ok: true, manques: [] });
  });
  it("poste complet en CI → ok", () => {
    expect(jugerPoste(poste({ env: { CI: "true" } })).ok).toBe(true);
  });
  it("sans CI ni CLAUDE_CODE_REMOTE → refus avec la phrase de garde.ts", () => {
    const j = jugerPoste(poste({ env: {} }));
    expect(j.ok).toBe(false);
    expect(j.manques).toContain(MESSAGE_ENVIRONNEMENT_INTERDIT);
  });
  it("win32 et darwin → refus", () => {
    expect(jugerPoste(poste({ plateforme: "win32", env: { CI: "true" } })).ok).toBe(false);
    const d = jugerPoste(poste({ plateforme: "darwin" }));
    expect(d.ok).toBe(false);
    expect(d.manques.join(" ")).toContain("darwin");
  });
  it("Playwright 1.62.0 → refus", () => {
    expect(jugerPoste(poste({ playwright: "1.62.0" })).ok).toBe(false);
  });
  it("Chromium introuvable → refus", () => {
    const sans = { ...poste(), chromium: undefined };
    expect(jugerPoste(sans).manques.join(" ")).toContain("Chromium");
  });
  it("FFmpeg absent ou 5.1 → refus", () => {
    const sans = { ...poste(), ffmpeg: undefined };
    expect(jugerPoste(sans).ok).toBe(false);
    const j = jugerPoste(poste({ ffmpeg: { version: "5.1", encodeurs: ["libx264"], filtres: lireFiltres(FILTRES_TXT) } }));
    expect(j.ok).toBe(false);
  });
  it("ssim absent → refus nommant ssim", () => {
    const j = jugerPoste(poste({ ffmpeg: { version: "8.1.1", encodeurs: ["libx264"], filtres: ["freezedetect", "blackdetect"] } }));
    expect(j.ok).toBe(false);
    expect(j.manques.join(" ")).toContain("ssim");
  });
  it("libx264 absent → refus nommant libx264", () => {
    const j = jugerPoste(poste({ ffmpeg: { version: "8.1.1", encodeurs: [], filtres: lireFiltres(FILTRES_TXT) } }));
    expect(j.manques.join(" ")).toContain("libx264");
  });
  it("police absente → refus", () => {
    const sans = { ...poste(), policeSha256: undefined };
    expect(jugerPoste(sans).manques.join(" ")).toContain("Police");
  });
  it("1 500 Mo libres → refus", () => {
    expect(jugerPoste(poste({ espaceLibreMo: 1500 })).ok).toBe(false);
  });
  it("ne lève jamais, même sur une entrée vide", () => {
    expect(() => jugerPoste({} as SondesPoste)).not.toThrow();
    expect(jugerPoste({} as SondesPoste).ok).toBe(false);
  });
});

describe("EXIGENCES_POSTE", () => {
  it("Playwright = la version verrouillée dans pnpm-lock.yaml", () => {
    const lock = readFileSync(resolve(__dirname, "../../../pnpm-lock.yaml"), "utf8");
    const m = /'@playwright\/test':\s*\n\s*specifier: [^\n]+\n\s*version: (\d+\.\d+\.\d+)/.exec(lock);
    expect(m?.[1]).toBe(EXIGENCES_POSTE.playwright);
  });
});

describe("empreintePoste et poste.json", () => {
  it("stable ; change avec FFmpeg ou Chromium ; ignore le chemin de Chromium", () => {
    const base = empreintePoste(poste());
    expect(empreintePoste(poste())).toBe(base);
    expect(empreintePoste(poste({ ffmpeg: { version: "8.1.2", encodeurs: [], filtres: [] } }))).not.toBe(base);
    expect(empreintePoste(poste({ chromium: { chemin: "/opt/pw-browsers/chromium-1243/chrome", version: "142.0.1" } }))).not.toBe(base);
    expect(empreintePoste(poste({ chromium: { chemin: "/autre/chemin", version: "141.0.7390.37" } }))).toBe(base);
    expect(empreintePoste(poste({ espaceLibreMo: 1 }))).toBe(base);
  });
  it("posteJson : version, type, sans env, empreinte", () => {
    const s = poste();
    const j = posteJson(s, jugerPoste(s));
    expect(j).toMatchObject({ version: "poste-capture.v1", type: "routine-cloud", ok: true, empreinte: empreintePoste(s) });
    expect(j).not.toHaveProperty("env");
    expect(posteJson(poste({ env: { CI: "true" } }), { ok: true, manques: [], remarques: [] }).type).toBe("ci");
    expect(posteJson(poste({ env: { CI: "true", CAPTURE_CONTENEUR: "true" } }), { ok: true, manques: [], remarques: [] }).type).toBe("conteneur");
    expect(posteJson(poste({ env: { CLAUDE_CODE_REMOTE: "true", CAPTURE_CONTENEUR: "oui" } }), { ok: true, manques: [], remarques: [] }).type).toBe("routine-cloud");
  });
});

describe("texte de verifier-poste.mts", () => {
  const src = readFileSync(resolve(__dirname, "../../../outils/maquettes-tableaux-de-bord/poste/verifier-poste.mts"), "utf8");
  it("environnementAutorise est appelé avant toute sonde", () => {
    const garde = src.indexOf("environnementAutorise(process.env");
    expect(garde).toBeGreaterThan(0);
    for (const sonde of ["lancer(\"ffmpeg\"", "lirePlaywright()", "sondeChromium()", "readFileSync(join(RACINE_DEPOT, EXIGENCES"]) {
      expect(src.indexOf(sonde, src.indexOf("function main"))).toBeGreaterThan(garde);
    }
  });
  it("aucun lancement de navigateur, aucun http, spawnSync sans shell", () => {
    expect(src).not.toMatch(/\.launch\s*\(/);
    expect(src).not.toMatch(/http/i);
    expect(src).not.toMatch(/shell\s*:\s*true/);
    expect(src).toContain("spawnSync");
  });
});

describe("T-EXT-51c : CAPTURE_CONTENEUR et indice de conteneur dans le poste", () => {
  const OK = { ok: true, manques: [], remarques: [] };
  it("jugerPoste : CAPTURE_CONTENEUR=true + indice → ok ; sans indice (ou indice faux) → refus avec la phrase de garde", () => {
    expect(jugerPoste(poste({ env: { CAPTURE_CONTENEUR: "true" }, indicesConteneur: true })).ok).toBe(true);
    for (const i of [false, undefined]) {
      const j = jugerPoste(poste({ env: { CAPTURE_CONTENEUR: "true" }, indicesConteneur: i }));
      expect(j.ok).toBe(false);
      expect(j.manques.join(" ")).toContain("Capture interdite ici");
    }
  });
  it("jugerPoste : « 1 » ou « TRUE » refusés même avec l'indice ; win32 refusé", () => {
    for (const v of ["1", "TRUE"]) expect(jugerPoste(poste({ env: { CAPTURE_CONTENEUR: v }, indicesConteneur: true })).ok).toBe(false);
    expect(jugerPoste(poste({ plateforme: "win32", env: { CAPTURE_CONTENEUR: "true" }, indicesConteneur: true })).ok).toBe(false);
  });
  it("posteJson : type « conteneur » seulement avec la variable exacte ET sans indice absent ; l'indice n'entre pas dans la fiche", () => {
    const f = posteJson(poste({ env: { CAPTURE_CONTENEUR: "true" }, indicesConteneur: true }), OK);
    expect(f.type).toBe("conteneur");
    expect(f).not.toHaveProperty("indicesConteneur");
    expect(posteJson(poste({ env: { CAPTURE_CONTENEUR: "true" }, indicesConteneur: false }), OK).type).toBe("routine-cloud");
    expect(posteJson(poste({ env: { CAPTURE_CONTENEUR: "1" }, indicesConteneur: true }), OK).type).toBe("routine-cloud");
  });
  it("verifier-poste.mts lit les indices sur le disque (existsSync) et les passe à la garde et aux sondes", () => {
    const src = readFileSync(resolve(__dirname, "../../../outils/maquettes-tableaux-de-bord/poste/verifier-poste.mts"), "utf8");
    expect(src).toContain("environnementAutorise(process.env, process.platform, indicesConteneur(existsSync))");
    expect(src).toMatch(/indicesConteneur:\s*indicesConteneur\(existsSync\)/);
  });
});
