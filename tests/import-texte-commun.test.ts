/**
 * Import de fichier commun (scripts à soi) : le bouton « Importer un fichier » est un composant partagé par l'avocat
 * (ZoneColler), le tableau animé et la face caméra animée. Aucun appel réseau.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BoutonImporterTexte } from "@/assistant/express/BoutonImporterTexte";

const SRC = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");

describe("BoutonImporterTexte", () => {
  it("affiche « Importer un fichier » et n'accepte que .txt .md .docx .pdf", () => {
    const html = renderToStaticMarkup(createElement(BoutonImporterTexte, { onTexte: () => {} }));
    expect(html).toContain("Importer un fichier");
    expect(html).toContain('accept=".txt,.md,.docx,.pdf"');
  });

  it("la lecture reste celle de la zone Coller : route /api/import, garde de fichier, borne de caractères commune", () => {
    const src = SRC("src/assistant/express/BoutonImporterTexte.tsx");
    expect(src).toMatch(/\/api\/import/);
    expect(src).toMatch(/verifierFichierImport\(/);
    expect(src).toMatch(/TEXTE_MAX_CARACTERES/);
    expect(src).not.toMatch(/200[_ ]?000|5 \* 1024/);
  });

  it("ZoneColler l'utilise au lieu de sa propre copie", () => {
    const src = SRC("src/assistant/express/ZoneColler.tsx");
    expect(src).toMatch(/<BoutonImporterTexte/);
    expect(src).not.toMatch(/lireFichierSurLeServeur/);
  });
});

describe("Tableau animé : « J'ai déjà mon texte » peut importer un fichier", () => {
  const src = SRC("src/components/formats/tableau-anime/NouvelleVideoTableau.tsx");

  it("le bouton suit la zone « Le texte dit » et remplace le champ", () => {
    expect(src).toMatch(/<BoutonImporterTexte onTexte=\{\(t\) => changer\(\{ texte: t \}\)\} \/>/);
    expect(src.indexOf("<BoutonImporterTexte")).toBeGreaterThan(src.indexOf('libelle="Le texte dit"'));
  });

  it("le texte importé n'est jamais raccourci en silence (le compteur du champ le montre)", () => {
    expect(src).toMatch(/longueurMax=\{CARACTERES_DITS_MAX_TABLEAU\}/);
    expect(src).not.toMatch(/onTexte=\{\(t\) => changer\(\{ texte: t\.(slice|substring)/);
  });
});

describe("Face caméra animée : « Ajouter ce que vous dites » peut importer un fichier", () => {
  const src = SRC("src/components/formats/facecam-animee/DepotPrise.tsx");

  it("le bouton passe par texteDitDuScript (20 000 caractères, coupé au mot, avis si raccourci)", () => {
    expect(src).toMatch(/<BoutonImporterTexte/);
    expect(src).toMatch(/texteDitDuScript\(/);
    expect(src).not.toMatch(/@\/services\//);
  });

  it("texteDitDuScript est une fonction pure importable côté écran, et le service la ré-exporte", async () => {
    const pur = await import("@/components/formats/facecam-animee/scripts-valides");
    const fa = await import("@/services/facecam-animee");
    expect(pur.TEXTE_DIT_MAX_FA).toBe(20_000);
    expect(fa.texteDitDuScript).toBe(pur.texteDitDuScript);
    const r = pur.texteDitDuScript(Array.from({ length: 6000 }, () => "bonjour").join(" "));
    expect(r.tronque).toBe(true);
    expect(r.texte.length).toBeLessThanOrEqual(20_000);
    expect(r.texte.endsWith("bonjour")).toBe(true);
    expect(pur.texteDitDuScript("court")).toEqual({ texte: "court", tronque: false });
  });
});

describe("Aucun appel payant ajouté", () => {
  it("le bouton et la reprise du texte n'appellent ni fournisseur ni service, et aucun fetch hors /api/import", async () => {
    let appels = 0;
    const vraiFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      appels += 1;
      throw new Error("aucun appel réel permis");
    }) as typeof fetch;
    try {
      const pur = await import("@/components/formats/facecam-animee/scripts-valides");
      pur.texteDitDuScript("un deux trois");
      renderToStaticMarkup(createElement(BoutonImporterTexte, { onTexte: () => {} }));
    } finally {
      globalThis.fetch = vraiFetch;
    }
    expect(appels).toBe(0);
    for (const f of ["src/assistant/express/BoutonImporterTexte.tsx"]) expect(SRC(f)).not.toMatch(/fournisseurs|@\/services|claude|heygen|higgsfield|elevenlabs/i);
  });
});
