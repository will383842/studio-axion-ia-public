/**
 * T-EXT-50 · SchemaFlux : rendu serveur à 3 instants, couleurs de la charte, aucun texte hors des libellés du flux ;
 * TutorielOutil sans `schemaFlux` : même arbre qu'avant (instantané pris sur master avant la modification).
 * Rendu statique seulement, aucun réseau, aucun navigateur. Se saute si les dépendances de studio-rendu manquent.
 */
import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
const etat = vi.hoisted(() => ({ image: 0 }));
vi.mock("../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<Record<string, unknown>>();
  return {
    ...vrai,
    Sequence: (p: { children?: unknown }) => p.children ?? null,
    Audio: () => null,
    useCurrentFrame: () => etat.image,
    useVideoConfig: () => ({ fps: 25, width: 1080, height: 1350, durationInFrames: 400, id: "essai", defaultProps: {}, props: {}, defaultCodec: null }),
  };
});

import { CHARTE_AXION } from "@/briques/jetons-motion";
import { PALETTE } from "@/briques/charte/axion-2026";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { HABILLAGE_TUTORIEL, formatDuRatio, planCarteFin } from "@/moteurs/montage-tutoriel-outil/proprietes";
import { VERSION_FLUX, lireFluxAutomatisation, type FluxAutomatisation } from "@/moteurs/montage-tutoriel-outil/gabarit-flux";
import { echelleSchema, planSchemaFlux, type MotVoixFlux } from "@/moteurs/montage-tutoriel-outil/schema-flux";
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { createElement } = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react/index.js")) as typeof import("react")) : ({} as typeof import("react"));
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { renderToStaticMarkup } = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server")) : ({} as typeof import("react-dom/server"));
// Chemin calculé : tsc (projet racine, qui exclut studio-rendu) ne suit pas ces imports.
const chemin = (c: string) => `../../studio-rendu/compositions/${c}`;
const SCHEMA = AVEC_RENDU ? await import(/* @vite-ignore */ chemin("plan-scenes/tutoriel-flux/SchemaFlux")) : null;
const TUTORIEL = AVEC_RENDU ? await import(/* @vite-ignore */ chemin("plan-scenes/TutorielOutil")) : null;

/** Rendu de `TutorielOutil` (sans `schemaFlux`, image 5) pris sur origin/master 10c3642, avant la modification. */
const REFERENCE_MASTER = "<div style=\"position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;display:flex;flex-direction:column\"><div style=\"position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;display:flex;flex-direction:column\"><div style=\"position:absolute;inset:0;overflow:hidden;width:1080px;height:1350px;background:#FAF9F5;font-family:Manrope, sans-serif\"><div style=\"position:absolute;inset:0;opacity:0.5\"><div style=\"position:absolute;left:54px;top:378.00000000000006px;width:972px;height:594px\"><div style=\"position:absolute;left:0;top:151.20000000000002px;width:1000px;height:300px;transform:scale(0.972);transform-origin:0 0\"><div style=\"position:absolute;inset:0;font-family:Manrope, sans-serif;font-feature-settings:&quot;tnum&quot;;display:flex;align-items:center;justify-content:center\"><div style=\"opacity:0.7343294460641401;transform:translateY(7.44px);max-width:960px;max-height:280px;box-sizing:border-box;padding:0;border-radius:28px;background:transparent;box-shadow:none;text-align:center\"><div style=\"font-size:84px;font-weight:800;line-height:1.12;letter-spacing:-0.02em;color:#141413\">Une automatisation simple</div><div style=\"margin-top:10px;font-size:42px;font-weight:500;color:rgba(20, 20, 19, 0.62)\">de bout en bout</div><div style=\"margin:16px auto 0;height:6px;border-radius:3px;width:0;background:#B23F16\"></div></div></div></div></div></div></div></div><div style=\"position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;display:flex;flex-direction:column\"><div style=\"position:absolute;inset:0;overflow:hidden;width:1080px;height:1350px;background:#FAF9F5;font-family:Manrope, sans-serif\"><div style=\"position:absolute;inset:0;opacity:0.5\"><div style=\"position:absolute;left:54px;top:378.00000000000006px;width:972px;height:594px\"><div style=\"position:absolute;left:0;top:151.20000000000002px;width:1000px;height:300px;transform:scale(0.972);transform-origin:0 0\"><div style=\"position:absolute;inset:0;font-family:Manrope, sans-serif;font-feature-settings:&quot;tnum&quot;;display:flex;align-items:center;justify-content:center\"><div style=\"opacity:0.7343294460641401;transform:translateY(7.44px);max-width:960px;max-height:280px;box-sizing:border-box;padding:0;border-radius:28px;background:transparent;box-shadow:none;text-align:center\"><div style=\"font-size:84px;font-weight:800;line-height:1.12;letter-spacing:-0.02em;color:#141413\">Axion IA</div><div style=\"margin-top:10px;font-size:42px;font-weight:500;color:rgba(20, 20, 19, 0.62)\">axion-ia.com</div><div style=\"margin:16px auto 0;height:6px;border-radius:3px;width:0;background:#B23F16\"></div></div></div></div></div></div></div></div></div>";

const html = (el: unknown) => renderToStaticMarkup(el as never);

function flux(): FluxAutomatisation {
  const r = lireFluxAutomatisation({
    version: VERSION_FLUX,
    avant: { vue: "boite", etat: "avant", surMot: "déborde" },
    declencheur: { vue: "boite", etat: "nouveau", surMot: "arrive" },
    etapes: [
      { id: "classement", vue: "boite", etat: "etiquete", acteur: "automatisation", libelleSchema: "Classement du message", surMot: "classe" },
      { id: "brouillon", vue: "boite", etat: "brouillon", acteur: "ia", libelleSchema: "Brouillon de réponse", surMot: "brouillon" },
      { id: "validation", vue: "boite", etat: "brouillon", acteur: "humain", libelleSchema: "Vous validez", surMot: "validez" },
      { id: "equipe", vue: "messagerie", etat: "notification", acteur: "automatisation", libelleSchema: "Équipe prévenue", surMot: "équipe" },
    ],
    moments: ["brouillon"],
    resultat: { vue: "crm", etat: "fiche-remplie", surMot: "fiche" },
    contenus: { boite: { exemple: true } },
  });
  if (!r.ok) throw new Error(r.erreurs.join(" | "));
  return r.flux;
}

const DEBUT = 30_000;
const VOIX: MotVoixFlux[] = ["Le", "schéma", "classe", "puis", "rédige", "un", "brouillon", "que", "vous", "validez", "avant", "que", "équipe", "soit", "prévenue"].map((texte, i) => ({ texte, debutMs: DEBUT + i * 430 }));
const plan = () => planSchemaFlux(flux(), VOIX, DEBUT, DEBUT + 6500, { largeur: 1080, hauteur: 1350 });
const rendre = (image: number) => {
  etat.image = image;
  return html(createElement(SCHEMA!.SchemaFlux, { plan: plan() }));
};

/** Valeurs de couleur (#hex, rgb, rgba) écrites dans le HTML. */
const couleursDe = (h: string) => [...h.matchAll(/#[0-9A-Fa-f]{6}\b|rgba?\([^)]*\)/g)].map((m) => m[0].toUpperCase());
const texteDe = (h: string) => h.replace(/<[^>]*>/g, "|").split("|").map((t) => t.trim()).filter(Boolean);

describe.skipIf(!AVEC_RENDU)("SchemaFlux (T-EXT-50)", () => {
  it("rendu à trois instants : le schéma se construit (aucun bloc, puis des blocs, puis tous)", () => {
    const debut = rendre(0);
    const milieu = rendre(Math.round(4.5 * 25));
    const fin = rendre(Math.round(6.4 * 25));
    const blocs = (h: string) => (h.match(/data-bloc="/g) ?? []).length;
    expect(blocs(debut)).toBe(0);
    expect(blocs(milieu)).toBeGreaterThanOrEqual(2);
    expect(blocs(milieu)).toBeLessThan(4);
    expect(blocs(fin)).toBe(4);
    expect(fin).toContain("<line");
    expect(debut).not.toBe(milieu);
    expect(milieu).not.toBe(fin);
  });

  it("couleurs du HTML ⊆ charte (ivoire, gris, noir, terracotta, blanc) : ni vert, ni orange, ni dégradé", () => {
    const permises = new Set([...Object.values(CHARTE_AXION), PALETTE.blanc].map((c) => c.toUpperCase()));
    permises.delete(CHARTE_AXION.orange.toUpperCase());
    for (const image of [0, 112, 160]) {
      const h = rendre(image);
      for (const c of couleursDe(h)) expect(permises.has(c), c).toBe(true);
      expect(h).not.toMatch(/gradient|rgba?\(/i);
      expect(h).not.toContain("✓");
    }
    // La charte exclut le vert de réussite et l'orange hors fond noir.
    const fin = rendre(160);
    expect(fin.toUpperCase()).not.toContain(PALETTE.reussite.toUpperCase());
    expect(fin.toUpperCase()).not.toContain(CHARTE_AXION.orange.toUpperCase());
  });

  it("l'étape humaine est un bloc noir à texte ivoire ; l'étape en cours est bordée de terracotta", () => {
    const fin = rendre(Math.round(6.4 * 25));
    const bloc = (id: string) => fin.match(new RegExp(`<div data-bloc="${id}"[^>]*>`))![0].toUpperCase();
    const humain = bloc("validation");
    expect(humain).toContain(`BACKGROUND:${CHARTE_AXION.noir}`);
    expect(humain).toContain(`COLOR:${CHARTE_AXION.ivoire}`);
    expect(bloc("classement")).toContain(`BACKGROUND:${PALETTE.blanc}`);
    expect(bloc("classement")).toContain(`BORDER:5PX SOLID ${CHARTE_AXION.gris}`);
    expect(bloc("equipe")).toContain(CHARTE_AXION.terracotta);
  });

  it("aucun texte autre que les libellés du flux ; aucune étiquette « Douleur · Solution · Exemple · À vous »", () => {
    const libelles = flux().etapes.map((e) => e.libelleSchema);
    const textes = texteDe(rendre(Math.round(6.4 * 25)));
    expect(textes.sort()).toEqual([...libelles].sort());
    expect(textes.join(" ")).not.toMatch(/Douleur|Solution|Exemple|À vous/);
  });
});

describe.skipIf(!AVEC_RENDU)("échelle du schéma", () => {
  it("le dessin et le plan calculent la même échelle", () => {
    for (const f of [{ largeur: 1080, hauteur: 1920 }, { largeur: 1080, hauteur: 1350 }, { largeur: 1080, hauteur: 1080 }, { largeur: 1920, hauteur: 1080 }]) {
      expect(SCHEMA!.echelleEcran(f)).toBe(echelleSchema(f));
    }
  });
});

describe.skipIf(!AVEC_RENDU)("TutorielOutil sans schemaFlux (T-EXT-50)", () => {
  // Plan simple : la scène « légende » de la carte de fin (même pièce que le plan du tutoriel), au format 4:5.
  async function planTuto(): Promise<PlanValide> {
    const base = { version: 1, format: formatDuRatio("4:5"), habillage: HABILLAGE_TUTORIEL } as unknown as PlanValide;
    return planCarteFin({ plan: base, fin: { titre: "Une automatisation simple", sousTitre: "de bout en bout" }, finMs: 6000 });
  }
  const FIN = { titre: "Axion IA", sousTitre: "axion-ia.com" };

  it("même arbre qu'avant : instantané pris sur master avant la modification", async () => {
    etat.image = 5;
    const p = await planTuto();
    const sortie = html(createElement(TUTORIEL!.TutorielOutil, { plan: p, fin: FIN, finMs: 2500 }));
    expect(sortie).toBe(REFERENCE_MASTER);
  });

  it("avec schemaFlux : le schéma s'ajoute, le reste de l'arbre ne bouge pas", async () => {
    etat.image = 160;
    const p = await planTuto();
    const sans = html(createElement(TUTORIEL!.TutorielOutil, { plan: p, fin: FIN, finMs: 2500 }));
    const avec = html(createElement(TUTORIEL!.TutorielOutil, { plan: p, fin: FIN, finMs: 2500, schemaFlux: { debutImage: 0, dureeImages: 163, plan: plan() } }));
    expect(avec).toContain("data-bloc=");
    expect(sans).not.toContain("data-bloc=");
    // Le schéma est la seule différence : retiré, il ne reste que l'arbre d'avant.
    const schema = rendre(160);
    expect(avec).toContain(schema);
    expect(avec.replace(schema, "")).toBe(sans);
  });
});
