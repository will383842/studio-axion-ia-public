/**
 * « Supprimer définitivement » (décision de Will du 17/10) : la confirmation dit QUOI part (titre ou nombre),
 * « Ça ne se rattrape pas », et ce qui reste (les dépenses). Vouvoiement, très peu de texte.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const { CorpsSuppression, textesSuppression } = await import("@/components/videos/ConfirmationSuppression");
const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

describe("confirmation de suppression", () => {
  it("une vidéo : son titre, l'avertissement, les dépenses gardées", () => {
    const t = textesSuppression({ titre: "Licenciement abusif", nombre: 1 });
    expect(t.titre).toBe("Supprimer cette vidéo ?");
    expect(t.bouton).toBe("Supprimer définitivement");
    expect(texte(renderToStaticMarkup(createElement(CorpsSuppression, { titre: "Licenciement abusif", nombre: 1 })))).toBe(
      "« Licenciement abusif » Ça ne se rattrape pas. Le texte écrit pour elle part aussi, sauf favori. Les dépenses restent dans vos comptes. Le journal et les publications déjà publiées, avec leurs mesures, restent aussi.",
    );
  });

  it("une sélection : le nombre", () => {
    expect(textesSuppression({ nombre: 3 }).titre).toBe("Supprimer 3 vidéos ?");
    expect(texte(renderToStaticMarkup(createElement(CorpsSuppression, { nombre: 3 })))).toMatch(/^3 vidéos Ça ne se rattrape pas\. Les textes écrits pour elles partent aussi, sauf favoris\./);
  });

  it("fiche et galerie passent par la confirmation, jamais l'action directe", () => {
    for (const f of ["src/components/videos/EnTeteVideo.tsx", "src/components/videos/GalerieVideos.tsx"]) {
      const source = readFileSync(f, "utf8");
      expect(source, f).toMatch(/suppression\.demander\(/);
      // L'action de suppression n'est appelée QUE dans le rappel passé à la confirmation.
      for (const appel of source.matchAll(/supprimerVideosAction\(/g)) {
        const avant = source.slice(Math.max(0, appel.index! - 400), appel.index);
        expect(avant, f).toMatch(/suppression\.demander\(/);
      }
    }
    expect(readFileSync("src/app/(studio)/videos/page.tsx", "utf8")).not.toMatch(/jamais supprimée/);
  });
});
