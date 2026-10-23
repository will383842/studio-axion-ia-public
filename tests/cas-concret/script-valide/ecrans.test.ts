/**
 * V4-3 · ÉCRANS : avant la voix, Will voit le texte dit et l'ordre des écrans (feuille « Votre vidéo » : le script
 * validé du cas ; fiche vidéo : le script écrit qui attend sa validation, boutons « Valider ce script » / « Corriger »).
 * Rendu statique des composants (aucun style nouveau).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, back: () => undefined }), usePathname: () => "/videos/v", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/(studio)/cas-concret/actions", () => ({ confirmerCasAction: vi.fn(), estimerCasAction: vi.fn(), preparerEtLancerAction: vi.fn(), validerScriptAction: vi.fn() }));

import { ContenuVotreVideo } from "../../../src/components/formats/cas-concret/entree/FeuilleVotreVideo";
import { versVueCas } from "../../../src/components/formats/cas-concret/entree/vue";
import { ScriptEcrans } from "../../../src/components/formats/cas-concret/fiche-video/ScriptEcrans";
import { ValidationScript } from "../../../src/components/formats/cas-concret/fiche-video/ValidationScript";
import { empreinteCas } from "../../../src/formats/cas-concret/cas";
import { trouverCas } from "../../../src/formats/cas-concret/catalogue";
import { apercuDesEcrans, scriptValideDuCatalogue } from "../../../src/moteurs/montage-cas-concret/script-valide";

const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const cas = trouverCas("recrutement-apporteurs")!;
const apercu = apercuDesEcrans(scriptValideDuCatalogue(cas.id)!.ecrans);

describe("V4-3 · aperçu du script", () => {
  it("les écrans dans l'ordre, chacun avec son texte dit et ce qu'il affiche", () => {
    expect(apercu.map((e) => e.rang)).toEqual(apercu.map((_, i) => i + 1));
    expect(apercu[2]).toMatchObject({ nom: "Avant", affiches: expect.arrayContaining(["Courir après la signature", "+1 H"]) });
    const t = texte(renderToStaticMarkup(createElement(ScriptEcrans, { ecrans: apercu })));
    expect(t.indexOf("Nous, on arrive pour la visio")).toBeLessThan(t.indexOf("Derrière, le contrat part tout seul"));
    expect(t).toContain("À l'écran : Le contrat · Il part tout seul.");
  });

  it("feuille « Votre vidéo » : le script validé est montré avant le prix", () => {
    const vue = versVueCas(cas, empreinteCas(cas), true, apercu);
    const html = renderToStaticMarkup(createElement(ContenuVotreVideo, { cas: vue, essai: false, reseaux: ["facebook"], onReseaux: () => undefined, mot: "IA", onMot: () => undefined, avecMot: false, onAvecMot: () => undefined, onValider: () => undefined } as never));
    expect(texte(html)).toContain("Le script validé, dit mot pour mot");
    expect(texte(html)).toContain("Oui, quinze minutes.");
    const sans = renderToStaticMarkup(createElement(ContenuVotreVideo, { cas: versVueCas(cas, empreinteCas(cas), true), essai: false, reseaux: ["facebook"], onReseaux: () => undefined, mot: "IA", onMot: () => undefined, avecMot: false, onAvecMot: () => undefined, onValider: () => undefined } as never));
    expect(texte(sans)).not.toContain("Le script validé");
  });

  it("fiche vidéo : le script à valider, « Valider ce script », « Modifier le script » et « Faire réécrire »", () => {
    const t = texte(renderToStaticMarkup(createElement(ValidationScript, { videoId: "v", travailId: "t", ecrans: apercu })));
    expect(t).toContain("Le script à valider : texte dit et ordre des écrans");
    expect(t).toContain("Valider ce script");
    expect(t).toContain("Modifier le script");
    expect(t).toContain("Faire réécrire");
    expect(t).toContain("Aucune voix n'est payée tant que vous n'avez pas validé ce script.");
    // Brique 3 : écran commun « Relire le script » : les écrans regroupés par type, numérotés, à toucher pour modifier.
    expect(t).toMatch(/Accroche 1 Nos collaborateurs, on les recrute en/);
  });
});
