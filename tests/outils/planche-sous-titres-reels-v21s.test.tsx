/**
 * FIX-MINIMAL-FOND-CLAIR-v21s : planche locale des sous-titres dessinés par le vrai moteur, dans la police réellement chargée.
 * Outil local, 0 €, rien allumé, aucun rendu Remotion en CI.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FONDS_REELS, PlancheSousTitresReels } from "../../outils/planche-sous-titres-reels/PlancheSousTitresReels";
import { COULEURS_REPLI } from "../../src/briques/sous-titres/style";

const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const FAMILLES = { "Manrope Medium": "Axion Manrope Medium", "Manrope ExtraBold": "Axion Manrope ExtraBold", "Manrope Bold": "Axion Manrope Bold", "Manrope SemiBold": "Axion Manrope SemiBold" };
const html = (facteurOmbre: number, format: "9x16" | "16x9" = "9x16") =>
  renderToStaticMarkup(createElement(PlancheSousTitresReels, { phrase: "Ton droit reste gratuit", gabarits: ["minimal"], facteurOmbre, format, familles: FAMILLES }));
/** Contenu de la case d'un fond. */
const caseDe = (h: string, fond: string) => h.split(`data-fond="${fond}"`)[1]?.split("data-fond=")[0] ?? "";

describe("planche sous-titres réels", () => {
  it("(g) police réelle et couleur foncée sur le fond clair avec facteur 2 ; texte crème avec facteur 1 ; déterministe", () => {
    const deux = html(2);
    expect(deux).toContain("font-family:Axion Manrope Medium");
    expect(caseDe(deux, "clair")).toContain(`color:${COULEURS_REPLI.contour}`);
    expect(caseDe(deux, "sombre")).toContain(`color:${COULEURS_REPLI.texte}`);
    const un = html(1);
    expect(caseDe(un, "clair")).toContain(`color:${COULEURS_REPLI.texte}`);
    expect(html(2)).toBe(deux);
    expect(deux).toContain("minimal · facteur d&#x27;ombre 2");
    expect(html(2, "16x9")).toContain('data-fond="illustration-claire"');
    expect(Object.keys(FONDS_REELS)).toHaveLength(3);
  });

  it("(h) gardes de l'outil : pas de réglage, env, réseau, mention IA ; finally + rmSync ; sortie captures/sous-titres-reels ; Manrope chargée ; aucun hexadécimal ; rien de studio-rendu importé", () => {
    for (const f of ["outils/planche-sous-titres-reels/PlancheSousTitresReels.tsx", "outils/planche-sous-titres-reels/planche.mts"]) {
      expect(lire(f), f).not.toMatch(/reglages|depots|process\.env|fetch\(|mention-ia|MentionIA/i);
    }
    const s = lire("outils/planche-sous-titres-reels/planche.mts");
    expect(s).toMatch(/finally\s*\{[^}]*rmSync/);
    expect(s).toContain('"captures", "sous-titres-reels"');
    expect(s).toContain("chargerPolices");
    expect(s).toContain("FAMILLES");
    const p = lire("outils/planche-sous-titres-reels/PlancheSousTitresReels.tsx");
    expect(p).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(p).not.toMatch(/from\s+["'][^"']*studio-rendu/);
  });

  it("(i) rien n'importe l'outil : aucun fichier de src/ ni de studio-rendu/ ne le cite", () => {
    const parcourir = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        if (n === "node_modules" || n.startsWith(".")) return [];
        const p = join(dir, n);
        return statSync(p).isDirectory() ? parcourir(p) : /\.(tsx?|mts|json)$/.test(n) ? [p] : [];
      });
    const fichiers = [...parcourir(join(process.cwd(), "src")), ...parcourir(join(process.cwd(), "studio-rendu"))];
    expect(fichiers.length).toBeGreaterThan(50);
    for (const f of fichiers) expect(readFileSync(f, "utf8"), f).not.toMatch(/planche-sous-titres-reels|PlancheSousTitresReels/);
  });
});
