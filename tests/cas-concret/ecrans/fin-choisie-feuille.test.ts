/**
 * FIX-CC-FIN-CHOIX-b4 · la feuille « Votre vidéo » propose « La phrase de fin » (D1), « Aucune » par défaut :
 * interrupteur éteint, phrase dite montrée mot pour mot, rien envoyé tant que Will ne coche pas.
 * Pas de jsdom : rendu serveur de `ContenuVotreVideo` + lecture des sources pour le câblage.
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
const { DIT_FIN_RENDEZ_VOUS } = await import("@/moteurs/montage-cas-concret/fin-choisie");

const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");
const feuille = readFileSync("src/components/formats/cas-concret/entree/FeuilleVotreVideo.tsx", "utf8");
const entree = readFileSync("src/components/formats/cas-concret/entree/EntreeCasConcret.tsx", "utf8");
const cas = versVueCas(CATALOGUE[0], empreinteCas(CATALOGUE[0]), true);
const rendre = (extra: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(ContenuVotreVideo, { cas, essai: false, reseaux: ["facebook"], onReseaux: () => undefined, mot: cas.mot, onMot: () => undefined, avecMot: false, onAvecMot: () => undefined, onValider: () => undefined, ...extra } as never));

describe("FIX-CC-FIN-CHOIX-b4 · « La phrase de fin », éteinte par défaut", () => {
  it("par défaut : interrupteur non coché, la phrase D1 mot pour mot et « Sinon »", () => {
    const html = rendre({ finRdv: false, onFinRdv: () => undefined });
    const t = texte(html);
    expect(html).toContain('aria-label="La phrase de fin"');
    expect(t).toContain("La phrase de fin");
    expect(t).toContain(DIT_FIN_RENDEZ_VOUS);
    expect(t).toContain("Sinon : rien n'est dit après la question.");
    expect(t).not.toContain("quelques minutes");
    const section = html.slice(html.indexOf('aria-label="La phrase de fin"'));
    expect(section).toMatch(/aria-checked="false"/);
    expect(feuille).toMatch(/const \[finRdv, setFinRdv\] = useState\(false\);/);
  });

  it("coché : l'interrupteur est allumé", () => {
    const html = rendre({ finRdv: true, onFinRdv: () => undefined });
    expect(html.slice(html.indexOf('aria-label="La phrase de fin"'))).toMatch(/aria-checked="true"/);
  });

  it("sans geste fourni (autres appelants) : la section n'est pas rendue", () => {
    expect(rendre({})).not.toContain("La phrase de fin");
  });

  it("câblage : `finDemandee` n'est envoyé que coché (estimer, fabriquer, relire)", () => {
    expect(feuille).toMatch(/finDemandee\?: "rendez-vous";/);
    const envois = feuille.match(/\.\.\.\(finRdv \? \{ finDemandee: "rendez-vous" as const \} : \{\}\)/g) ?? [];
    expect(envois.length).toBe(3); // estimer, fabriquer, relire (l'estimation d'ouverture part éteinte)
    expect(feuille).toMatch(/\[reseaux, avecMot, finRdv, mot,/);
    expect(feuille).toMatch(/finRdv=\{finRdv\} onFinRdv=\{setFinRdv\}/);
    expect(entree.match(/\.\.\.\(choix\.finDemandee \? \{ finDemandee: choix\.finDemandee \} : \{\}\)/g)?.length).toBe(3);
  });

  it("le texte affiché ne contient pas d'apostrophe brute dans le JSX neuf", () => {
    const bloc = feuille.slice(feuille.indexOf('aria-label="La phrase de fin"'));
    const jsx = bloc.slice(0, bloc.indexOf("</section>"));
    expect(jsx).not.toMatch(/>[^<{]*'[^<{]*</);
  });
});
