/**
 * CC-SV · le choix « Sans voix (sous-titres et texte à l'écran) » de la feuille « Votre vidéo » : éteint par défaut (le mode avec
 * voix reste le défaut), envoyé seulement coché. Pas de jsdom : rendu serveur de `ContenuVotreVideo` + lecture des sources.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { ContenuVotreVideo } = await import("@/components/formats/cas-concret/entree/FeuilleVotreVideo");
const { versVueCas } = await import("@/components/formats/cas-concret/entree/vue");
const { CATALOGUE } = await import("@/formats/cas-concret/catalogue");
const { empreinteCas } = await import("@/formats/cas-concret/cas");

const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");
const feuille = readFileSync("src/components/formats/cas-concret/entree/FeuilleVotreVideo.tsx", "utf8");
const entree = readFileSync("src/components/formats/cas-concret/entree/EntreeCasConcret.tsx", "utf8");
const cas = versVueCas(CATALOGUE[0], empreinteCas(CATALOGUE[0]), true);
const rendre = (extra: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(ContenuVotreVideo, { cas, essai: false, reseaux: ["facebook"], onReseaux: () => undefined, mot: cas.mot, onMot: () => undefined, avecMot: false, onAvecMot: () => undefined, onValider: () => undefined, ...extra } as never));

describe("CC-SV · choix « Sans voix » dans la feuille", () => {
  it("le choix est visible, avec son libellé exact, et éteint par défaut", () => {
    const html = rendre({ sansVoix: false, onSansVoix: () => undefined });
    expect(html).toContain('aria-label="Sans voix"');
    expect(texte(html)).toContain("Sans voix (sous-titres et texte à l'écran)");
    expect(html).not.toMatch(/aria-label="Sans voix"[\s\S]*?aria-checked="true"/);
  });

  it("sans gestionnaire, le choix n'est pas montré", () => {
    expect(rendre({})).not.toContain('aria-label="Sans voix"');
  });

  it("câblage : `sansVoix` n'est envoyé que coché (estimer, fabriquer, relire)", () => {
    const envois = feuille.match(/\.\.\.\(sansVoixVoulu \? \{ sansVoix: true as const \} : \{\}\)/g) ?? [];
    expect(envois.length).toBe(3);
    expect(feuille).toMatch(/const \[sansVoixVoulu, setSansVoix\] = useState\(false\)/);
    expect(entree.match(/\.\.\.\(choix\.sansVoix \? \{ sansVoix: true \} : \{\}\)/g)?.length).toBe(3);
  });
});
