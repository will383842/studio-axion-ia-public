/** X3-10b-a : composant « Animations par défaut ». Rendu serveur seulement ; l'envoi est testé par la fonction extraite. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CRANS_PERMIS, PHRASE_CRAN_GRISE, type DosageMotion, type IdGenerateurDosage } from "@/briques/dosage-motion";
import { DefautsDosage, LIBELLES_GENERATEURS, envoyerDefaut } from "@/components/dosage-motion/DefautsDosage";

const GENERATEURS = Object.keys(CRANS_PERMIS) as IdGenerateurDosage[];
const defauts = Object.fromEntries(GENERATEURS.map((g) => [g, "equilibre"])) as Record<IdGenerateurDosage, DosageMotion>;
defauts["facecam-animee"] = "dynamique";
const rendre = (actif: unknown, d = defauts) => renderToStaticMarkup(createElement(DefautsDosage, { actif: actif as boolean, defauts: d }));
const echappe = (s: string) => s.replace(/'/g, "&#x27;");
/** Région d'une ligne : du libellé du générateur jusqu'au suivant. */
const ligne = (html: string, g: IdGenerateurDosage) => {
  const i = html.indexOf(`data-generateur="${g}"`);
  return html.slice(i, html.indexOf("data-generateur=", i + 10) === -1 ? undefined : html.indexOf("data-generateur=", i + 10));
};

describe("DefautsDosage", () => {
  it("rend rien si actif n'est pas exactement true", () => {
    for (const a of [false, undefined, null, "true", 1]) expect(rendre(a)).toBe("");
  });
  it("une ligne par générateur, avec son libellé français", () => {
    const html = rendre(true);
    for (const g of GENERATEURS) {
      expect(html).toContain(`data-generateur="${g}"`);
      expect(html).toContain(echappe(LIBELLES_GENERATEURS[g]));
    }
    expect(html.match(/data-generateur=/g)).toHaveLength(GENERATEURS.length);
  });
  it("aucun cran non permis (« Aucun » absent du cas concret et du tableau)", () => {
    const html = rendre(true);
    expect(ligne(html, "cas-concret")).not.toContain("Aucun");
    expect(ligne(html, "tableau")).not.toContain("Aucun");
    expect(ligne(html, "avocat")).toContain("Aucun");
    const fa = ligne(html, "facecam-animee");
    for (const l of ["Aucun", "Sobre", "Équilibré"]) expect(fa).not.toContain(l);
    expect(fa).toContain("Dynamique");
  });
  it("cran courant coché", () => {
    const d = { ...defauts, avocat: "sobre" as DosageMotion };
    const l = ligne(rendre(true, d), "avocat");
    expect(l.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(l).toMatch(/aria-checked="true"[^>]*>(?:(?!<\/button>)[\s\S])*Sobre/);
  });
  it("phrase d'explication quand des crans manquent", () => {
    const html = rendre(true);
    expect(ligne(html, "tableau")).toContain(echappe(PHRASE_CRAN_GRISE.animations));
    expect(ligne(html, "facecam-animee")).toContain(echappe(PHRASE_CRAN_GRISE.v4));
    expect(ligne(html, "avocat")).not.toContain(echappe(PHRASE_CRAN_GRISE.animations));
  });
  it("aucune couleur en dur (#…)", () => {
    const src = readFileSync(join(__dirname, "../../src/components/dosage-motion/DefautsDosage.tsx"), "utf8");
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(rendre(true)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe("envoyerDefaut", () => {
  it("rend le refus tel quel", async () => {
    const sur = vi.fn().mockResolvedValue({ ok: false, message: "Pas encore actif." });
    expect(await envoyerDefaut(sur, "avocat", "sobre")).toBe("Pas encore actif.");
  });
  it("succès : pas de message", async () => {
    expect(await envoyerDefaut(async () => ({ ok: true }), "avocat", "sobre")).toBeNull();
  });
  it("sans surChoisir : aucun appel, aucun message", async () => {
    expect(await envoyerDefaut(undefined, "avocat", "sobre")).toBeNull();
  });
  it("cran non permis : ignoré, aucun appel", async () => {
    const sur = vi.fn();
    expect(await envoyerDefaut(sur, "tableau", "aucun")).toBeNull();
    expect(sur).not.toHaveBeenCalled();
  });
  it("échec inattendu : phrase simple", async () => {
    const sur = vi.fn().mockRejectedValue(new Error("boom 503"));
    const m = await envoyerDefaut(sur, "avocat", "sobre");
    expect(m).toBe("Le choix n'a pas pu être enregistré. Réessayez.");
  });
});
