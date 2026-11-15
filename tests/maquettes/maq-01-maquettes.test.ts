/** MAQ-01 : quatre maquettes statiques, sans serveur, sans montant, vouvoiement, mention « fictive ». */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Motifs privés : lus à l'exécution dans un fichier fourni hors dépôt (variable INTERDITS_PUBLIC_FICHIER), jamais écrits ici.
const FICHIER_INTERDITS = process.env.INTERDITS_PUBLIC_FICHIER;
const MOTIFS_PRIVES = FICHIER_INTERDITS && existsSync(FICHIER_INTERDITS) ? readFileSync(FICHIER_INTERDITS, "utf8").split("\n").filter(Boolean).map((m) => new RegExp(m, "i")) : [];

const ECRANS = ["a-publier", "stock", "infographie", "ecrans-sans-prix"] as const;
const lire = (e: string) => readFileSync(join(process.cwd(), "docs/maquettes", e, "index.html"), "utf8");
const texte = (h: string) =>
  h.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");

describe("MAQ-01 maquettes", () => {
  for (const e of ECRANS) {
    describe(e, () => {
      it("existe", () => expect(existsSync(join(process.cwd(), "docs/maquettes", e, "index.html"))).toBe(true));
      it("porte la mention fictive", () => expect(lire(e)).toContain("Maquette fictive : rien n'est branché, rien ne part"));
      it("s'ouvre sans serveur : aucune ressource externe ni script", () => {
        const h = lire(e);
        expect(h).not.toMatch(/(src|href)\s*=\s*["'](https?:)?\/\//i);
        expect(h).not.toMatch(/<script/i);
        expect(h).not.toMatch(/href\s*=\s*["']\//);
      });
      it("aucun montant", () => {
        const t = texte(lire(e));
        expect(t).not.toMatch(/[€$]|\beuros?\b|\bdollars?\b|\bEUR\b|\bUSD\b|\bprix\b\s*:?\s*\d/i);
        expect(t).not.toMatch(/\d\s?(€|\$|euros?|dollars?)/i);
      });
      it("vouvoie, ne tutoie pas", () => {
        const t = texte(lire(e));
        expect(t).not.toMatch(/(?<![\p{L}\p{N}\x27])(tu|toi|ton|ta|tes|tiens|peux|veux|as|es)(?![\p{L}\p{N}])/iu);
        expect(t).toMatch(/\b(vous|votre|vos)\b/i);
      });
      it("barre de menu fixe à gauche, fond foncé, pages claires", () => {
        const h = lire(e);
        expect(h).toMatch(/<nav[^>]*class="menu"/);
        expect(h).toMatch(/position:\s*fixed;\s*left:\s*0/);
      });
      it("ne cite ni le fondateur par son nom ni un dépôt privé (motifs lus hors dépôt ; sans fichier, ce contrôle est sauté)", () => {
        if (MOTIFS_PRIVES.length === 0) return;
        const h = lire(e);
        for (const m of MOTIFS_PRIVES) expect(h).not.toMatch(m);
      });
      it("aucune étiquette « Essai » (évoquerait une offre payante)", () => expect(texte(lire(e))).not.toMatch(/\bEssai\b/i));
    });
  }
  it("« À publier » montre vidéo, carrousel et infographie avec icône et libellé", () => {
    const h = lire("a-publier");
    for (const [lib, ico] of [["Vidéo", "🎬"], ["Carrousel", "🖼"], ["Infographie", "📊"]]) {
      expect(h).toContain(lib);
      expect(h).toContain(ico);
    }
  });
  it("l'onglet Stock existe", () => expect(texte(lire("stock"))).toMatch(/Stock/));
  it("l'écran Infographie existe", () => expect(texte(lire("infographie"))).toMatch(/Infographie/));
});
