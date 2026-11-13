/**
 * GV2-49 : plaquettes chiffrées de la face caméra animée v4 : seulement des valeurs DITES.
 * La jauge ne montre que le pourcentage dit (aucun palier inventé) ; les barres ont les hauteurs des valeurs dites ;
 * D15l refuse des barres sans valeurs dites (plan du réalisateur) ; un plan ancien reste rendu comme avant.
 * AUCUN rendu vidéo, aucun réseau.
 */
import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

/** Les dépendances de studio-rendu ne sont pas installées par les contrôles obligatoires de GitHub : les tests de rendu se sautent alors. */
const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
let imageCourante = 60;
vi.mock("../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<typeof import("../../studio-rendu/node_modules/remotion")>();
  // @ts-expect-error le react de studio-rendu n'a pas de types ici
  const { createElement: element, Fragment } = (await import("../../studio-rendu/node_modules/react/index.js")) as typeof import("react");
  return { ...vrai, Sequence: (p: { children?: React.ReactNode }) => element(Fragment, null, p.children), Audio: () => null, useCurrentFrame: () => imageCourante, useVideoConfig: () => ({ fps: 30, width: 1080, height: 1920, durationInFrames: 90, id: "essai", defaultProps: {}, props: {}, defaultCodec: null }) };
});

import { schemaElementV4, type ElementV4Plan } from "@/domaine/facecam-animee/plan";
import { consigneRealisateur } from "@/moteurs/montage-facecam-animee/realisateur/consignes";
import { controlerSuiteV4, resoudreElementsV4 } from "@/moteurs/montage-facecam-animee/realisateur/regles-v4";
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { createElement } = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react/index.js")) as typeof import("react")) : ({} as typeof import("react"));
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { renderToStaticMarkup } = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server")) : ({} as typeof import("react-dom/server"));
const { RENDUS_V4 } = AVEC_RENDU ? await import("../../studio-rendu/compositions/interface-claire/motion-v4/registre-v4") : { RENDUS_V4: {} as Record<string, never> };

const ctx = { duree: 30, fps: 30 } as never;
const rendre = (e: ElementV4Plan, image: number): string => {
  imageCourante = image;
  return renderToStaticMarkup(createElement("div", null, (RENDUS_V4[e.id] as (e: ElementV4Plan, c: never, d: number) => React.ReactNode)(e, ctx, 90)));
};
const jauge = (extra: Partial<ElementV4Plan> = {}): ElementV4Plan => ({ id: "JaugePourcentage", debut: 5, fin: 8, mots: ["MONTAGE"], instants: [5.5, 6.2, 6.8], ...extra });
const barres = (extra: Partial<ElementV4Plan> = {}): ElementV4Plan => ({ id: "GraphiqueBarres", debut: 5, fin: 8.5, mots: ["TAUX"], instants: [5.2, 6.5, 7.5], ...extra });
/** Les hauteurs relatives des barres rendues (rapport hauteur / hauteur maximale de 340 px). */
const hauteursBarres = (html: string): number[] => [...html.matchAll(/height:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
const d15l = (e: ElementV4Plan, dit: number[]): string[] => {
  const mots = dit.map((n, k) => ({ w: String(n), a: 5.5 + k * 0.5 }));
  const r = resoudreElementsV4([e], 30);
  return controlerSuiteV4(r.elements, { duree: 30, finDebut: 30, valeursDitesExigees: true }, mots as never).erreurs.filter((m) => m.startsWith("D15l"));
};

describe.skipIf(!AVEC_RENDU)("GV2-49 · jauge : une seule valeur, celle qui est dite", () => {
  it("« 40 % » dit : aucun palier 5, 15 ou 28 (12 %, 38 %, 69 % de 40) à l'écran ; la valeur finale est 40", () => {
    const e = jauge({ nombre: 40 });
    const html = rendre(e, 80);
    for (const faux of [5, 15, 28]) expect(html).not.toMatch(new RegExp(`>${faux}<`));
    expect(html).toMatch(/>40</);
    for (const image of [0, 20, 40, 60, 80, 100]) for (const faux of [5, 15, 28]) expect(rendre(e, image)).not.toMatch(new RegExp(`>${faux}<`));
  });

  it("sans nombre dit : la jauge reste au repos (0), elle ne monte pas à 100", () => {
    const html = rendre(jauge(), 80);
    expect(html).toMatch(/>0</);
    expect(html).not.toMatch(/>100</);
  });
});

describe.skipIf(!AVEC_RENDU)("GV2-49 · barres : les hauteurs sont celles des valeurs dites", () => {
  it("valeurs [20, 40] : hauteurs relatives 0,5 et 1 (la dernière barre grandit encore au mot fort : on lit donc les hauteurs transmises au composant)", () => {
    const noeud = (RENDUS_V4.GraphiqueBarres as (e: ElementV4Plan, c: never, d: number) => { props: { barres?: number[] } })(barres({ valeurs: [{ valeur: 20 }, { valeur: 40 }] }), ctx, 90);
    expect(noeud.props.barres).toEqual([0.5, 1]);
    expect(rendre(barres({ valeurs: [{ valeur: 20 }, { valeur: 40 }] }), 80)).not.toBe(rendre(barres(), 80));
  });

  it("plan ancien (sans valeurs) : rendu identique à celui d'avant (les barres par défaut du composant)", () => {
    const ancien = rendre(barres(), 80);
    const sansChamp = rendre({ ...barres(), valeurs: undefined }, 80);
    expect(sansChamp).toBe(ancien);
    expect(hauteursBarres(ancien).filter((h) => h > 100).length).toBeGreaterThanOrEqual(5);
  });
});

describe("GV2-49 · schéma : le champ valeurs est facultatif", () => {
  it("un élément ancien reste valide ; 2 à 4 valeurs, libellé de 20 caractères au plus", () => {
    expect(schemaElementV4.safeParse({ id: "GraphiqueBarres", debut: 1, fin: 3 }).success).toBe(true);
    expect(schemaElementV4.safeParse({ id: "GraphiqueBarres", debut: 1, fin: 3, valeurs: [{ valeur: 20, libelle: "avant" }, { valeur: 40 }] }).success).toBe(true);
    expect(schemaElementV4.safeParse({ id: "GraphiqueBarres", debut: 1, fin: 3, valeurs: [{ valeur: 20 }] }).success).toBe(false);
    expect(schemaElementV4.safeParse({ id: "GraphiqueBarres", debut: 1, fin: 3, valeurs: [1, 2, 3, 4, 5].map((valeur) => ({ valeur })) }).success).toBe(false);
    expect(schemaElementV4.safeParse({ id: "GraphiqueBarres", debut: 1, fin: 3, valeurs: [{ valeur: 1, libelle: "x".repeat(21) }, { valeur: 2 }] }).success).toBe(false);
  });
});

describe("GV2-49 · règle D15l", () => {
  it("barres sans valeurs (plan du réalisateur) : D15l, message lisible", () => {
    const erreurs = d15l(barres(), [20, 40]);
    expect(erreurs).toHaveLength(1);
    expect(erreurs[0]).toContain("Les barres doivent montrer des nombres dits");
  });
  it("une valeur qui n'est pas dite dans la fenêtre : D15l", () => {
    const erreurs = d15l(barres({ valeurs: [{ valeur: 20 }, { valeur: 99 }] }), [20, 40]);
    expect(erreurs).toHaveLength(1);
    expect(erreurs[0]).toContain("99");
  });
  it("deux valeurs dites : aucune erreur D15l", () => {
    expect(d15l(barres({ valeurs: [{ valeur: 20 }, { valeur: 40 }] }), [20, 40])).toEqual([]);
  });
  it("plan ancien relu (sans valeurs, sans l'option) : D15l ne s'applique pas ; elle s'applique dès qu'un élément du plan porte valeurs", () => {
    const sans = controlerSuiteV4(resoudreElementsV4([barres()], 30).elements, { duree: 30, finDebut: 30 }).erreurs;
    expect(sans.some((m) => m.startsWith("D15l"))).toBe(false);
    const autre = barres({ debut: 12, fin: 15.5, valeurs: [{ valeur: 20 }, { valeur: 40 }] });
    const avec = controlerSuiteV4(resoudreElementsV4([barres(), autre], 30).elements, { duree: 30, finDebut: 30 }).erreurs;
    expect(avec.filter((m) => m.startsWith("D15l"))).toHaveLength(1);
  });
});

describe("GV2-49 · consigne du réalisateur", () => {
  it("dit quand choisir les barres et la jauge, et reste identique d'un appel à l'autre (cache)", () => {
    const c = consigneRealisateur();
    expect(c).toContain("SEULEMENT si 2 à 4 nombres sont dits");
    expect(c).toContain("SEULEMENT si un pourcentage est dit");
    expect(consigneRealisateur()).toBe(c);
  });
});
