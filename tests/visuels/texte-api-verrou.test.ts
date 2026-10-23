// Ne modifier qu'après un ordre ÉCRIT de Will (abonnement, jamais l'API payante).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_PAYANTE_AUTORISEE } from "@/visuels/texte/verrou-api";
import { creerFournisseurApi } from "@/visuels/texte/api";
import { fournisseurTexte } from "@/visuels/texte/choisir";
import type { DemandeTexteCarrousel } from "@/domaine/visuels/contrats";

const RACINE = process.cwd();
const DOSSIERS = ["src/visuels", "src/domaine/visuels", "src/domaine/controles-visuel", "src/components/visuels", "src/app/(studio)/carrousels"];

function fichiers(dossier: string): string[] {
  let noms: string[];
  try {
    noms = readdirSync(dossier);
  } catch {
    return [];
  }
  return noms.flatMap((n) => {
    const chemin = join(dossier, n);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}

const DEMANDES: DemandeTexteCarrousel[] = [
  { type: "sujet", sujet: "Ranger son bureau" },
  { type: "sujet", sujet: "" },
  { type: "paquet-session", contenu: "{}" },
  { type: "paquet-session", contenu: "" },
];

const cleAvant = process.env.ANTHROPIC_API_KEY;
afterEach(() => {
  if (cleAvant === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = cleAvant;
});

describe("verrou de l'API payante", () => {
  it("(1) la constante vaut false", () => {
    expect(API_PAYANTE_AUTORISEE).toBe(false);
  });

  it("(2) le fournisseur API rejette sans rien appeler, même avec une clé posée", async () => {
    process.env.ANTHROPIC_API_KEY = "cle-fictive-pour-le-test";
    const espion = vi.fn(async () => "{}");
    const f = creerFournisseurApi({ appeler: espion });
    for (const d of DEMANDES) await expect(f.ecrire(d)).rejects.toMatchObject({ code: "API_PAYANTE_VERROUILLEE" });
    await expect(f.ecrire(DEMANDES[0])).rejects.toThrow("L'écriture par l'API payante est verrouillée : ordre de Will requis");
    expect(espion).toHaveBeenCalledTimes(0);
  });

  it("(3) le choix du fournisseur ne renvoie jamais le mode api", () => {
    for (const d of DEMANDES) expect(fournisseurTexte(d).mode).not.toBe("api");
    expect(fournisseurTexte(DEMANDES[0]).mode).toBe("simulation");
    expect(fournisseurTexte(DEMANDES[2]).mode).toBe("session");
  });

  it("(4) aucune source des dossiers visuels ne touche à l'API payante", () => {
    const sources = DOSSIERS.flatMap((d) => fichiers(join(RACINE, d))).filter((f) => /\.(?:ts|tsx|js|mjs|json)$/u.test(f));
    expect(sources.length).toBeGreaterThan(0);
    for (const f of sources) {
      const texte = readFileSync(f, "utf8");
      for (const interdit of ["fournisseurs/claude", "api.anthropic.com", "@anthropic-ai/sdk", "ANTHROPIC_API_KEY", "ANTHROPIC_", "reserverCredits"]) {
        expect(texte.includes(interdit), `${f} : ${interdit}`).toBe(false);
      }
      expect(/\bfetch\s*\(/u.test(texte), `${f} : fetch(`).toBe(false);
    }
  });

  it("(5) api.ts appelle exigerApiDeverrouillee( avant toute utilisation de deps.appeler", () => {
    const texte = readFileSync(join(RACINE, "src/visuels/texte/api.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//gu, "")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    const garde = texte.indexOf("exigerApiDeverrouillee(");
    const appel = texte.indexOf("deps.appeler");
    expect(garde).toBeGreaterThanOrEqual(0);
    expect(appel).toBeGreaterThan(garde);
  });
});
