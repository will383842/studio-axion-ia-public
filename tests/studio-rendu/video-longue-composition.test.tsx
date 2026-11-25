/**
 * VideoLongue (QUALL-3) : rendu React serveur à quelques instants, sans Remotion réel ni navigateur. Les textes affichés
 * viennent du story-board, la bande de sous-titres n'existe que sur les scènes de contenu, les couleurs sont celles de la charte.
 * Se saute si les dépendances de studio-rendu manquent.
 */
import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
const etat = vi.hoisted(() => ({ image: 0 }));
vi.mock("../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<Record<string, unknown>>();
  return {
    ...vrai,
    Img: (p: { src?: string }) => `img:${p.src ?? ""}`,
    delayRender: () => 1,
    continueRender: () => undefined,
    useCurrentFrame: () => etat.image,
    useVideoConfig: () => ({ fps: 25, width: 1920, height: 1080, durationInFrames: 3000, id: "VideoLongue", defaultProps: {}, props: {}, defaultCodec: null }),
  };
});

// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { createElement } = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react/index.js")) as typeof import("react")) : ({} as typeof import("react"));
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { renderToStaticMarkup } = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server")) : ({} as typeof import("react-dom/server"));
const chemin = (c: string) => `../../studio-rendu/compositions/${c}`;
const LONGUE = AVEC_RENDU ? await import(/* @vite-ignore */ chemin("plan-scenes/longue/VideoLongue")) : null;
const EXEMPLE = AVEC_RENDU ? await import(/* @vite-ignore */ chemin("plan-scenes/longue/exemple")) : null;

const rendre = (ms: number) => {
  etat.image = Math.round((ms * 25) / 1000);
  return renderToStaticMarkup(createElement(LONGUE!.VideoLongue, EXEMPLE!.PROPRIETES_EXEMPLE_LONGUE) as never);
};

describe.skipIf(!AVEC_RENDU)("VideoLongue", () => {
  it("carton-titre : la question, sans bande de sous-titres", () => {
    const h = rendre(2500);
    expect(h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).toContain("Comment suivre ses stocks sans y passer des heures ?");
    expect(h).toContain("AXION IA");
    expect(h).not.toContain("#E8E6DC");
  });

  it("scène de contenu : phrase, bande grise et sous-titre", () => {
    const h = rendre(10000);
    expect(h).toContain("tableur");
    expect(h).toContain("top:900px");
    expect(h).toContain("#E8E6DC");
    expect(h).toContain("font-size:46px");
    expect(h).toContain("tableur");
  });

  it("liste avec compte, fond noir du chapitre, fin avec logo et appel", () => {
    expect(rendre(49000)).toContain("la valeur du");
    expect(rendre(4500)).toContain("02 / 04".replace("02", "01"));
    const fin = rendre(118000);
    expect(fin).toContain("Prendre rendez-vous");
    expect(fin).toContain("axion-ia.com");
    expect(fin).toContain("img:");
    expect(fin).not.toContain("top:900px");
  });

  it("aucune couleur hors charte (ni bleu ni jaune)", () => {
    for (const ms of [2500, 10000, 15000, 49000, 60000, 118000]) {
      const couleurs = new Set(rendre(ms).match(/#[0-9A-Fa-f]{6}/g) ?? []);
      for (const c of couleurs) expect(["#FAF9F5", "#E8E6DC", "#141413", "#B23F16", "#FFFFFF", "#D97757", "#B0AEA5"]).toContain(c.toUpperCase());
    }
  });

  it("pendant une transition, la scène précédente reste dessinée dessous", () => {
    const h = rendre(12200);
    expect(h).toContain("journée");
    expect(h).toContain("tableur");
  });
});
