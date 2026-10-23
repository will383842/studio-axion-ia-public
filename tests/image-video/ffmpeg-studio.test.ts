/**
 * FFMPEG DANS LE CONTENEUR DU STUDIO (panne du 15/10 : `ffmpeg` absent de l'image `studio`, la lecture de l'image
 * s'arrêtait et la mesure Q24 serait restée « non mesurée »). Garde-fous :
 *  1. chaque appel d'un outil système (`execFile`, `spawn`, `exec`…) du format « Image → vidéo » côté studio est un
 *     `execFile("ffmpeg", <fabrique>(…))` dont la fabrique figure dans `COMMANDES_FFMPEG_IV` ET est exécutée par le
 *     contrôle avant mise en ligne (`deploiement/studio/controle-ffmpeg-iv.mjs`) ;
 *  2. ce contrôle est lancé par `deploiement/verifier-outils-video.sh` DANS l'image du studio, et le Dockerfile du studio
 *     y installe le MÊME FFmpeg statique (même empreinte) que studio-rendu, et y copie le contrôle ;
 *  3. avec le FFmpeg du poste (s'il existe), le contrôle passe.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMMANDES_FFMPEG_IV } from "@/moteurs/montage-image-video/commandes-ffmpeg";

const RACINE = join(__dirname, "../..");
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), "utf8");
const CONTROLE = "deploiement/studio/controle-ffmpeg-iv.mjs";

/** Fichiers TypeScript du format exécutés par le studio : services `image-video*` et moteur `montage-image-video`. */
function fichiersDuFormat(): string[] {
  const services = readdirSync(join(RACINE, "src/services")).filter((f) => /^image-video.*\.tsx?$/.test(f)).map((f) => `src/services/${f}`);
  const moteur: string[] = [];
  const parcourir = (d: string) => {
    for (const f of readdirSync(join(RACINE, d))) {
      const c = `${d}/${f}`;
      if (statSync(join(RACINE, c)).isDirectory()) parcourir(c);
      else if (/\.tsx?$/.test(f)) moteur.push(c);
    }
  };
  parcourir("src/moteurs/montage-image-video");
  return [...services, ...moteur];
}

describe("FFmpeg du format Image → vidéo dans le conteneur du studio", () => {
  it("chaque outil système appelé par le format est un execFile(\"ffmpeg\", …) couvert par le contrôle avant mise en ligne", () => {
    const controle = lire(CONTROLE);
    const nonCouverts: string[] = [];
    let appels = 0;
    for (const f of fichiersDuFormat()) {
      // Commentaires retirés ; `x.exec(…)` (méthode, ex. d'une expression régulière) n'est pas un appel de processus.
      const texte = lire(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      for (const m of texte.matchAll(/(?<![.\w])(execFile|execFileSync|spawn|spawnSync|exec|execSync|fork)\s*\(/g)) {
        appels++;
        const suite = texte.slice(m.index! + m[0].length, m.index! + m[0].length + 200);
        const appel = /^\s*"([^"]+)"\s*,\s*(\w+)\s*\(/.exec(suite);
        const fabrique = appel?.[2] ?? "";
        const couvert = m[1] === "execFile" && appel?.[1] === "ffmpeg" && (COMMANDES_FFMPEG_IV as readonly string[]).includes(fabrique) && new RegExp(`\\b${fabrique}\\(`).test(controle);
        if (!couvert) nonCouverts.push(`${f} : ${m[1]}(${suite.slice(0, 60).trim()}…)`);
      }
    }
    expect(nonCouverts).toEqual([]);
    expect(appels).toBeGreaterThanOrEqual(2); // conversion en PNG et mesure Q24
  });

  it("le contrôle importe les fabriques du module pur (pas une copie) et les déclare toutes", () => {
    const controle = lire(CONTROLE);
    expect(controle).toContain('from "../../src/moteurs/montage-image-video/commandes-ffmpeg.ts"');
    expect(controle).toContain('from "../../src/moteurs/montage-image-video/lecture/preparation.ts"');
    for (const c of COMMANDES_FFMPEG_IV) expect(controle).toMatch(new RegExp(`COMMANDES_CONTROLEES = \\[[^\\]]*"${c}"`));
    // Le module pur est copié tel quel dans l'image et lu par Node (types effacés) : aucun import, aucune syntaxe à transformer.
    const pur = lire("src/moteurs/montage-image-video/commandes-ffmpeg.ts");
    expect(pur).not.toMatch(/^\s*import\s/m);
    expect(pur).not.toMatch(/\benum\b|\bnamespace\b/);
    expect(lire("src/moteurs/montage-image-video/lecture/preparation.ts").match(/^import .*$/gm)?.every((l) => l.startsWith("import type "))).toBe(true);
  });

  it("verifier-outils-video.sh exécute le contrôle DANS l'image du studio, sans réseau", () => {
    const script = lire("deploiement/verifier-outils-video.sh");
    expect(script).toMatch(/IMAGE_STUDIO="\$\{IMAGE_STUDIO:-studio-axion-ia:local\}"/);
    expect(script).toMatch(/docker run --rm --network none[^\n]*"\$IMAGE_STUDIO"[\s\\]*\n\s*node [^\n]*\n\s*deploiement\/studio\/controle-ffmpeg-iv\.mjs/);
    // L'image du studio est bien celle que construit le compose et que mettre-a-jour.sh contrôle avant de redémarrer.
    expect(lire("deploiement/docker-compose.yml")).toMatch(/studio:\n\s+build:\n\s+context: \.\.\n[\s\S]*?image: studio-axion-ia:local/);
  });

  it("le Dockerfile du studio installe le même FFmpeg statique que studio-rendu et copie le contrôle", () => {
    const studio = lire("Dockerfile");
    const rendu = lire("deploiement/studio-rendu/Dockerfile");
    const ffmpeg = /^FROM (mwader\/static-ffmpeg:[^\s]+@sha256:[0-9a-f]{64}) AS ffmpeg$/m;
    expect(rendu.match(ffmpeg)?.[1]).toBeTruthy();
    expect(studio.match(ffmpeg)?.[1]).toBe(rendu.match(ffmpeg)?.[1]);
    // ffprobe aussi : l'étape « vidéos » (images/preparation.ts) le lance ; copié ET vérifié à la construction.
    expect(studio).toMatch(/COPY --from=ffmpeg \/ffmpeg \/ffprobe \/usr\/local\/bin\//);
    expect(studio).toMatch(/RUN [^\n]*ffprobe -hide_banner -version >\/dev\/null/);
    expect(lire("deploiement/verifier-outils-video.sh")).toMatch(/docker run --rm --network none "\$IMAGE_STUDIO" ffprobe -hide_banner -version/);
    expect(studio).not.toMatch(/apt-get install[^\n]*ffmpeg/);
    for (const f of [CONTROLE, "src/moteurs/montage-image-video/commandes-ffmpeg.ts", "src/moteurs/montage-image-video/lecture/preparation.ts"]) {
      const dossier = f.slice(0, f.lastIndexOf("/") + 1);
      expect(studio).toContain(`COPY ${f} /app/controle-iv/${dossier}`);
    }
  });
});

const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const sonde = spawnSync(FFMPEG, ["-hide_banner", "-version"], { encoding: "utf8" });
const version = sonde.status === 0 ? sonde.stdout.split("\n")[0] : null;
if (!version) console.warn(`[ffmpeg-studio] FFmpeg introuvable (${FFMPEG}) : contrôle NON exécuté, test sauté.`);

describe.skipIf(!version)(`FFmpeg réel : contrôle du format Image → vidéo (${version ?? "FFmpeg absent"})`, () => {
  it("le contrôle avant mise en ligne passe (conversion en PNG, noir et figé mesurés, son brut MP3 → WAV)", () => {
    const r = spawnSync(process.execPath, ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", CONTROLE], { cwd: RACINE, encoding: "utf8", env: { ...process.env, FFMPEG } });
    expect(r.stdout + r.stderr).not.toContain("ÉCHEC");
    expect(r.status).toBe(0);
    expect(r.stdout.match(/^OK /gm)?.length).toBe(14);
  }, 120_000);
});
