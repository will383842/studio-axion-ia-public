// T-EXT-03 : tests du plan et des gardes de la capture filmée. AUCUN navigateur lancé ici.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { adresseAutorisee, environnementAutorise, RACINES_PAR_DEFAUT } from "../../../outils/maquettes-tableaux-de-bord/capture/garde";
import {
  AVANCE_GESTE_MS,
  empreinteCapture,
  lireCalage,
  lireFreezedetect,
  navigationJson,
  nomDossierSortie,
  planCaptures,
  planFilm,
  type Calage,
} from "../../../outils/maquettes-tableaux-de-bord/capture/plan-capture";
import { lireScenarioMaquette, type ScenarioMaquette } from "../../../src/moteurs/montage-tutoriel-outil/scenario-maquette";

const RACINE = "/depot/outils/maquettes-tableaux-de-bord/";
const POLICE = "/depot/src/app/polices/manrope-latin.woff2";

function scenario(n = 5): ScenarioMaquette {
  const roles = ["accroche", "probleme", "parcours", "bonne-pratique"] as const;
  const etapes = Array.from({ length: n }, (_, i) => ({
    id: `e${i + 1}`,
    role: i === n - 1 ? ("appel" as const) : roles[i % roles.length]!,
    aller: `ecran-${i + 1}`,
    ...(i % 2 === 0 ? { cible: `#zone-${i + 1}` } : {}),
    ancre: i === 0 ? { surMot: "bonjour" } : { apresEtape: `e${i}`, delaiMs: 0 },
  }));
  const l = lireScenarioMaquette({ version: "scenario-maquette.v1", maquette: "05-stocks", largeur: 1280, hauteur: 720, etapes });
  if (!l.ok) throw new Error(l.erreurs.join(" | "));
  return l.scenario;
}
function calage(n = 5): Calage {
  return { dureeVoixMs: n * 3000, etapes: Array.from({ length: n }, (_, i) => ({ id: `e${i + 1}`, debutMs: i * 3000, finMs: (i + 1) * 3000 })) };
}

describe("garde", () => {
  it("environnement : CI ou cloud, jamais win32", () => {
    expect(environnementAutorise({ CI: "true" }, "linux").ok).toBe(true);
    expect(environnementAutorise({ CLAUDE_CODE_REMOTE: "true" }, "linux").ok).toBe(true);
    const r = environnementAutorise({}, "linux");
    expect(r).toEqual({ ok: false, raison: "Capture interdite ici : seulement dans le cloud ou la CI, jamais sur le PC." });
    expect(environnementAutorise({ CI: "true" }, "win32").ok).toBe(false);
  });
  it("adresses : fichiers sous racine, rien d'autre", () => {
    const racines = [RACINE, POLICE];
    expect(adresseAutorisee(`file://${RACINE}05/index.html`, racines)).toBe(true);
    expect(adresseAutorisee(`file://${POLICE}`, racines)).toBe(true);
    expect(adresseAutorisee(`file://${RACINE}../../secret.txt`, racines)).toBe(false);
    expect(adresseAutorisee(`file://${RACINE}%2e%2e/x`, racines)).toBe(false);
    expect(adresseAutorisee("file:///etc/passwd", racines)).toBe(false);
    expect(adresseAutorisee("about:blank", racines)).toBe(true);
    expect(adresseAutorisee("data:text/plain,a", racines)).toBe(true);
    for (const u of ["https://fonts.googleapis.com/css", "http://localhost:3000", "ws://x", "wss://x", "ftp://x"]) {
      expect(adresseAutorisee(u, racines)).toBe(false);
    }
  });
  it("racines par défaut : dossier des maquettes et Manrope locale", () => {
    expect(RACINES_PAR_DEFAUT).toEqual(["outils/maquettes-tableaux-de-bord/", "src/app/polices/manrope-latin.woff2"]);
  });
});

describe("lireCalage", () => {
  it("accepte la sortie de T-EXT-02 avec des champs en plus", () => {
    const brut = { ...calage(3), version: "x", etapes: calage(3).etapes.map((e) => ({ ...e, texte: "phrase", mots: [] })) };
    const r = lireCalage(brut);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.calage).toEqual(calage(3));
  });
  it("refuse les nombres non finis et les formes fausses", () => {
    expect(lireCalage({ dureeVoixMs: Infinity, etapes: [] }).ok).toBe(false);
    expect(lireCalage({ dureeVoixMs: 9000, etapes: [{ id: "a", debutMs: NaN, finMs: 3 }] }).ok).toBe(false);
    expect(lireCalage(null).ok).toBe(false);
  });
});

describe("planFilm", () => {
  it("5 étapes : geste = début + 600, noms 01 à 05", () => {
    const p = planFilm(scenario(), calage());
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(AVANCE_GESTE_MS).toBe(600);
    expect(p.actions.map((a) => a.gesteMs)).toEqual([600, 3600, 6600, 9600, 12600]);
    expect(p.actions.map((a) => a.fichierPng)).toEqual(["01-e1.png", "02-e2.png", "03-e3.png", "04-e4.png", "05-e5.png"]);
    expect(p.actions[0]).toMatchObject({ etapeId: "e1", aller: "ecran-1", cible: "#zone-1", finMs: 3000 });
    expect(p.actions[1]!.cible).toBeUndefined();
  });
  it("étape de 700 ms : geste borné à fin − 200", () => {
    const c = calage(2);
    c.etapes[0]!.finMs = 700;
    c.etapes[1]!.debutMs = 700;
    const p = planFilm(scenario(2), c);
    expect(p.ok && p.actions[0]!.gesteMs).toBe(500);
  });
  it("refus : ids, ordre, durée courte, voix trop courte", () => {
    const manquante = calage(5);
    manquante.etapes.splice(2, 1);
    const r1 = planFilm(scenario(), manquante);
    expect(!r1.ok && r1.erreurs).toContain("Étape e3 absente du calage.");

    const inconnue = calage(5);
    inconnue.etapes[0]!.id = "zz";
    expect(planFilm(scenario(), inconnue).ok).toBe(false);

    const desordre = calage(5);
    desordre.etapes[2]!.debutMs = 100;
    desordre.etapes[2]!.finMs = 2900;
    const r2 = planFilm(scenario(), desordre);
    expect(!r2.ok && r2.erreurs.join(" ")).toContain("croissants");

    const courte = calage(5);
    courte.etapes[1]!.finMs = courte.etapes[1]!.debutMs + 399;
    const r3 = planFilm(scenario(), courte);
    expect(!r3.ok && r3.erreurs.join(" ")).toContain("trop courte pour un geste");

    const voix = calage(5);
    voix.dureeVoixMs = 14000;
    const r4 = planFilm(scenario(), voix);
    expect(!r4.ok && r4.erreurs.join(" ")).toContain("durée de la voix");
  });
  it("déterministe", () => {
    expect(planFilm(scenario(), calage())).toEqual(planFilm(scenario(), calage()));
  });
});

describe("planCaptures et nomDossierSortie", () => {
  it("stables et dans l'ordre", () => {
    const p = planCaptures(scenario(3));
    expect(p).toEqual(planCaptures(scenario(3)));
    expect(p.map((a) => a.fichierPng)).toEqual(["01-e1.png", "02-e2.png", "03-e3.png"]);
    expect(p[1]).toEqual({ etapeId: "e2", aller: "ecran-2", fichierPng: "02-e2.png" });
  });
  it("l'empreinte dépend du scénario ET du calage, pas de l'horloge", () => {
    const e1 = empreinteCapture(scenario(), calage());
    expect(e1).toBe(empreinteCapture(scenario(), calage()));
    const autre = calage();
    autre.etapes[0]!.finMs = 2900;
    expect(empreinteCapture(scenario(), autre)).not.toBe(e1);
    expect(empreinteCapture(scenario())).not.toBe(e1);
    expect(nomDossierSortie("05-stocks", e1)).toBe(`05-stocks-${e1.slice(0, 12)}`);
  });
});

// Sortie recopiée d'un FFmpeg réel (`-vf freezedetect=n=0.003:d=0.5 -f null -`), 9,04 s de film.
const FFMPEG = `Input #0, matroska,webm, from 'navigation.webm':
  Duration: 00:00:09.04, start: 0.000000, bitrate: 311 kb/s
  Stream #0:0: Video: vp8, yuv420p(progressive), 2560x1440, SAR 1:1 DAR 16:9, 25 fps, 25 tbr, 1k tbn
[freezedetect @ 0x55d0c2b3a1c0] lavfi.freezedetect.freeze_start: 1.5
[freezedetect @ 0x55d0c2b3a1c0] lavfi.freezedetect.freeze_duration: 2.04
[freezedetect @ 0x55d0c2b3a1c0] lavfi.freezedetect.freeze_end: 3.54
[freezedetect @ 0x55d0c2b3a1c0] lavfi.freezedetect.freeze_start: 7.5
frame=  226 fps=0.0 q=-0.0 Lsize=N/A time=00:00:09.04 bitrate=N/A speed=22.1x`;

describe("lireFreezedetect", () => {
  it("ramène les gels sur l'horloge de la voix ; un gel sans fin finit à la fin du film", () => {
    expect(lireFreezedetect(FFMPEG, 500)).toEqual([
      { debutMs: 1000, finMs: 3040 },
      { debutMs: 7000, finMs: 8540 },
    ]);
  });
  it("borne à 0 ; texte vide → []", () => {
    expect(lireFreezedetect(FFMPEG, 2000)[0]).toEqual({ debutMs: 0, finMs: 1540 });
    expect(lireFreezedetect("", 500)).toEqual([]);
  });
});

describe("navigationJson", () => {
  const base = {
    maquette: "05-stocks",
    largeur: 1000,
    hauteur: 500,
    debutFilmMs: 812.4,
    dureeVoixMs: 15000.2,
    mesures: [
      { etapeId: "e1", rectPx: { x: 100, y: 50, largeur: 333.333, hauteur: 100 }, instantMs: 600.6, finMs: 3000 },
      { etapeId: "e2", instantMs: 3601.2, finMs: 6000 },
    ],
  };
  it("conforme au contrat, arrondis, figees absent si non fourni", () => {
    const n = navigationJson(base);
    expect(n).toEqual({
      version: "navigation-filmee.v1",
      maquette: "05-stocks",
      largeur: 1000,
      hauteur: 500,
      debutFilmMs: 812,
      dureeVoixMs: 15000,
      cibles: [
        { etapeId: "e1", zonePct: { x: 10, y: 10, largeur: 33.33, hauteur: 20 }, instantMs: 601, finMs: 3000 },
        { etapeId: "e2", instantMs: 3601, finMs: 6000 },
      ],
    });
    expect("figees" in n).toBe(false);
  });
  it("figees présent quand mesuré (même vide)", () => {
    expect(navigationJson({ ...base, figees: [] }).figees).toEqual([]);
    expect(navigationJson({ ...base, figees: [{ debutMs: 1000.4, finMs: 2000.6 }] }).figees).toEqual([{ debutMs: 1000, finMs: 2001 }]);
  });
});

describe("texte de capturer.mts", () => {
  const texte = readFileSync(resolve(__dirname, "../../../outils/maquettes-tableaux-de-bord/capture/capturer.mts"), "utf8");
  const filmDebut = texte.indexOf("async function passeFilm");
  const controlesDebut = texte.indexOf("async function passeControles");
  const film = texte.slice(filmDebut, controlesDebut);
  const controles = texte.slice(controlesDebut, texte.indexOf("function sonde"));

  it("environnementAutorise avant tout chromium.launch", () => {
    const principal = texte.slice(texte.indexOf("async function principal"));
    expect(principal.indexOf("environnementAutorise(process.env")).toBeGreaterThan(-1);
    expect(principal).not.toContain("chromium.launch");
    // Le navigateur n'est lancé que dans les deux passes, appelées après la garde.
    expect(texte.match(/chromium\.launch\(/g)).toHaveLength(2);
    expect(principal.indexOf("environnementAutorise(process.env")).toBeLessThan(principal.indexOf("passeFilm("));
    expect(principal.indexOf("environnementAutorise(process.env")).toBeLessThan(principal.indexOf("passeControles("));
  });
  it("recordVideo n'apparaît plus ; film image par image en .mp4", () => {
    expect(filmDebut).toBeGreaterThan(-1);
    expect(texte).not.toContain("recordVideo");
    expect(texte).not.toContain("navigation.webm");
    expect(texte).toContain("navigation.mp4");
  });
  it("horloge arrêtée avant la boucle ; captures d'image dans les deux passes", () => {
    expect(film.indexOf("page.clock.pauseAt")).toBeGreaterThan(-1);
    expect(film.indexOf("page.clock.pauseAt")).toBeLessThan(film.indexOf("for (let i = 0"));
    expect(film).toContain("page.screenshot");
    expect(controles).toContain("page.screenshot");
  });
  it("pauseAt reçoit une heure lue dans la page, pas une heure fixe", () => {
    expect(film).toContain("page.evaluate(() => Date.now())");
    expect(film).toMatch(/page\.clock\.pauseAt\(new Date\(maintenant \+/);
    expect(film).not.toMatch(/pauseAt\([^)]*HEURE_FIGEE/);
    expect(film.indexOf("Date.now()")).toBeLessThan(film.indexOf("page.clock.pauseAt"));
  });
  it("aucune adresse réseau en dur ; garde réseau dans les deux passes", () => {
    expect(texte).not.toMatch(/https?:\/\//);
    expect(film).toContain('context.route("**/*"');
    expect(controles).toContain('context.route("**/*"');
  });
});
