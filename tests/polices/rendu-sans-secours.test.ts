// POLICES-P3-b : module pur de l'outil local « polices réellement rendues » (doubles, tourne en CI) + garde d'isolement
// + rendu réel opt-in (`STUDIO_ESSAI_REMOTION=1` et un Chromium local ; jamais téléchargé).
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { analyserPolices, decouperPile, policeRendue } from "../../outils/polices/analyse";
import { controlerVideoFinie, policesHorsCharte } from "@/briques/controle-image/video-finie";
import { FAMILLE_CSS, POLICE } from "@/briques/charte/axion-2026";

const RACINE = resolve(import.meta.dirname, "../..");

describe("découpage d'une pile CSS", () => {
  it("coupe aux virgules hors guillemets et retire les guillemets", () => {
    expect(decouperPile(`"Axion Manrope", 'Manrope', sans-serif`)).toEqual(["Axion Manrope", "Manrope", "sans-serif"]);
    expect(decouperPile(`"A, B", serif`)).toEqual(["A, B", "serif"]);
    expect(decouperPile("")).toEqual([]);
  });
});

describe("police réellement rendue", () => {
  it("première famille chargée, sinon le repli générique, sinon le navigateur", () => {
    expect(policeRendue([FAMILLE_CSS, "sans-serif"], [FAMILLE_CSS])).toBe(FAMILLE_CSS);
    expect(policeRendue([FAMILLE_CSS, "sans-serif"], [])).toBe("sans-serif");
    expect(policeRendue(["Inconnue"], ["Autre"])).toBe("(police du navigateur)");
    expect(policeRendue(["axion manrope"], [FAMILLE_CSS.toLowerCase()])).toBe("axion manrope");
  });
});

describe("analyse des relevés (doubles)", () => {
  it("la police de la charte chargée : aucun écart, jugée conforme par la pièce commune", () => {
    const r = analyserPolices([{ texte: "Bonjour", famillesDemandees: [FAMILLE_CSS, "sans-serif"], chargees: [FAMILLE_CSS] }]);
    expect(r.ecarts).toEqual([]);
    expect(r.policesRendues).toEqual([FAMILLE_CSS]);
    expect(policesHorsCharte(r.policesRendues)).toEqual([]);
  });

  it("la police demandée non chargée : écart, et le secours dessiné est refusé par la charte (piège de document.fonts.check)", () => {
    const r = analyserPolices([{ texte: "Étiquette", famillesDemandees: [FAMILLE_CSS, "sans-serif"], chargees: ["Autre"] }]);
    expect(r.ecarts).toEqual([{ texte: "Étiquette", demandee: FAMILLE_CSS, motif: "non-chargee", rendue: "sans-serif" }]);
    expect(r.policesRendues).toEqual(["sans-serif"]);
    expect(policesHorsCharte(r.policesRendues)).toHaveLength(1);
  });

  it("aucune famille demandée : écart « aucune » ; une pile générique seule n'est jamais « chargée »", () => {
    const r = analyserPolices([
      { texte: "a", famillesDemandees: [], chargees: [FAMILLE_CSS] },
      { texte: "b", famillesDemandees: ["sans-serif"], chargees: ["sans-serif"] },
    ]);
    expect(r.ecarts.map((e) => e.motif)).toEqual(["aucune", "non-chargee"]);
  });

  it("une liste vide ne dit rien (pas d'écart, pas de police) et les doublons sont fusionnés dans l'ordre", () => {
    expect(analyserPolices([])).toEqual({ ecarts: [], policesRendues: [] });
    const t = { famillesDemandees: [POLICE, "sans-serif"], chargees: [POLICE] };
    expect(analyserPolices([{ texte: "1", ...t }, { texte: "2", ...t }]).policesRendues).toEqual([POLICE]);
  });

  it("la sortie a la forme d'EntreeVideoFinie : une police en secours rend la vidéo non livrable sur le contrôle de police", () => {
    const bon = analyserPolices([{ texte: "x", famillesDemandees: [FAMILLE_CSS], chargees: [FAMILLE_CSS] }]);
    const mauvais = analyserPolices([{ texte: "x", famillesDemandees: [FAMILLE_CSS], chargees: [] }]);
    const verdict = (policesRendues: string[]) => controlerVideoFinie({ ratio: "9:16", reseaux: [], policesRendues }).charte.find((c) => c.id === "polices")?.etat;
    expect(verdict(bon.policesRendues)).toBe("reussi");
    expect(verdict(mauvais.policesRendues)).toBe("echoue");
  });
});

describe("isolement de l'outil", () => {
  const lister = (dossier: string): string[] =>
    readdirSync(dossier).flatMap((n) => {
      if (n === "node_modules" || n.startsWith(".")) return [];
      const p = join(dossier, n);
      return statSync(p).isDirectory() ? lister(p) : /\.(ts|tsx|mts|js|mjs)$/.test(n) ? [p] : [];
    });

  it("aucun fichier de src/** ni de studio-rendu/** n'importe outils/polices/", () => {
    const fautifs = [...lister(join(RACINE, "src")), ...lister(join(RACINE, "studio-rendu", "src")), ...lister(join(RACINE, "studio-rendu", "compositions"))].filter((f) => /outils\/polices\//.test(readFileSync(f, "utf8")));
    expect(fautifs).toEqual([]);
  });

  it("l'outil n'ouvre aucun réseau et ne télécharge aucun navigateur", () => {
    const code = readFileSync(join(RACINE, "outils/polices/verifier-rendu.mts"), "utf8");
    expect(code).not.toMatch(/https?:\/\/|fetch\(|downloadBrowser|ensureBrowser/);
  });
});

// Rendu réel (opt-in, local) : jamais en CI.
const ACTIF = process.env.STUDIO_ESSAI_REMOTION === "1";
function trouverNavigateur(): string | null {
  const env = process.env.STUDIO_RENDU_NAVIGATEUR;
  if (env) return existsSync(env) ? env : null;
  const base = "/opt/pw-browsers";
  if (!existsSync(base)) return null;
  const dossier = readdirSync(base).filter((d) => d.startsWith("chromium-")).sort().pop();
  if (dossier) for (const sous of ["chrome-linux/chrome", "chrome-linux64/chrome"]) if (existsSync(join(base, dossier, sous))) return join(base, dossier, sous);
  return existsSync(join(base, "chromium")) ? join(base, "chromium") : null;
}
const NAVIGATEUR = trouverNavigateur();

describe.skipIf(!ACTIF || !NAVIGATEUR)("outil réel sur une planche (opt-in, rendu local)", () => {
  it("relève les polices de planche-etiquettes-9x16-ivoire et écrit le relevé hors du dépôt", { timeout: 15 * 60_000 }, () => {
    const sortie = mkdtempSync(join(tmpdir(), "polices-"));
    try {
      const r = spawnSync("pnpm", ["exec", "tsx", "outils/polices/verifier-rendu.mts", "--composition", "planche-etiquettes-9x16-ivoire", "--entree", "planche", "--sortie", sortie], { cwd: RACINE, encoding: "utf8", env: { ...process.env, STUDIO_RENDU_NAVIGATEUR: NAVIGATEUR ?? "" } });
      expect(r.status, `${r.stdout}\n${r.stderr}`).toBe(0);
      const rel = JSON.parse(readFileSync(join(sortie, "planche-etiquettes-9x16-ivoire.json"), "utf8")) as { textes: number; ecarts: unknown[] };
      expect(rel.textes).toBeGreaterThan(0);
      expect(existsSync(join(RACINE, "studio-rendu", ".verif-polices-tmp"))).toBe(false);
    } finally {
      rmSync(sortie, { recursive: true, force: true });
    }
  });
});
