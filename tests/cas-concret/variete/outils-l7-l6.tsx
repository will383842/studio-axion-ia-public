/**
 * L7 × L6 · un objet animé rendu DANS une mise en page L6 : l'écran `etape` ou `objet` complet (`Ecran`), rendu en HTML
 * à chaque image (horloge de Remotion remplacée), avec sa mise en page tirée et son animation d'objet. Aucun appel.
 */
import { describe, expect, it, vi } from "vitest";
import type { ProprietesEcran } from "@/briques/ecrans-motion";
import { MISES_EN_PAGE_L6 } from "@/briques/ecrans-motion/mises-en-page";
import { FIXTURES_L7, TOUTES_IMAGES, type ObjetL7 } from "./outils-l7";

const horloge = vi.hoisted(() => ({ image: 0 }));
vi.mock("../../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<typeof import("../../../studio-rendu/node_modules/remotion")>();
  // @ts-expect-error -- studio-rendu n'installe pas les types de React (ce sont ceux de la racine).
  const { createElement: element } = (await import("../../../studio-rendu/node_modules/react/index.js")) as typeof import("react");
  // `Img` lit l'horloge interne de Remotion (préchargement) : une simple balise suffit au HTML.
  return { ...vrai, Img: (p: Record<string, unknown>) => element("img", p), useCurrentFrame: () => horloge.image, useVideoConfig: () => ({ fps: 25, width: 1080, height: 1920, durationInFrames: 75, id: "essai", defaultProps: {}, props: {}, defaultCodec: null }) };
});

// Le React de studio-rendu (celui de Remotion et des compositions), pas celui de la racine (mêmes types).
// @ts-expect-error -- studio-rendu n'installe pas les types de React (ce sont ceux de la racine).
const { createElement } = (await import("../../../studio-rendu/node_modules/react/index.js")) as typeof import("react");
// @ts-expect-error -- idem pour react-dom.
const { renderToStaticMarkup } = (await import("../../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server");
const { Ecran } = await import("../../../studio-rendu/compositions/cas-concret/Ecran");
const { codeL6 } = await import("../../../studio-rendu/compositions/cas-concret/mises-en-page/MiseEnPage");
const { exempleEcran } = await import("../../../studio-rendu/compositions/cas-concret/exemples");

type TypeAnime = "etape" | "objet";

/** Mises en page L6 qui ne dessinent PAS l'objet du visuel (maquettes validées : schéma au feutre, fantôme) : l'animation n'y change rien. */
const SANS_OBJET: readonly string[] = ["eta-schema-feutre", "eta-fantome"];

/**
 * L'écran d'exemple du type, dont le visuel est l'objet donné (textes de sa fixture), avec le `jeu` donné. Un objet à
 * capture (téléphone) reçoit la capture de sa fixture, comme en production (visuel `capture`).
 */
function ecran(type: TypeAnime, objet: ObjetL7, jeu?: Record<string, string | number>): ProprietesEcran {
  const base = exempleEcran(type) as Extract<ProprietesEcran, { type: TypeAnime }>;
  const f = FIXTURES_L7[objet];
  const visuel = f.capture ? { capture: { ...f.capture, cle: "essai-l7" } } : { objet, ...(f.textes ? { textes: [...f.textes] } : {}) };
  return { ...base, visuel, ...(jeu ? { jeu } : {}) } as ProprietesEcran;
}

/** HTML de l'écran à une image. */
function rendu(p: ProprietesEcran, image: number): string {
  horloge.image = image;
  return renderToStaticMarkup(createElement(Ecran, p));
}

/**
 * Pour chaque objet du lot et chaque mise en page L6 des écrans `etape` et `objet` qu'il peut porter : l'anim 0 dans la
 * mise en page est exactement la mise en page sans animation ; les anims 1 et 2 s'y rendent à toutes les images (aucune
 * valeur illisible) et bougent l'objet (rendu ≠ anim 0) ; dans une mise en page qui ne dessine pas l'objet, rien ne change.
 */
export function verifierDansMisesEnPage(lot: string, objets: readonly ObjetL7[]) {
  describe(`${lot} · objets animés dans les mises en page L6`, () => {
    for (const objet of objets)
      for (const type of ["etape", "objet"] as const)
        for (const code of MISES_EN_PAGE_L6[type]) {
          it(`${objet} · ${type} · ${code}`, () => {
            const sansAnim = ecran(type, objet, { miseEnPage: code });
            if (codeL6(sansAnim) !== code) return; // mise en page non éligible pour cet écran : l'écran reste la v4 (testé en L6)
            const v4 = ecran(type, objet);
            const zero = ecran(type, objet, { miseEnPage: code, animObjet: 0 });
            const images = TOUTES_IMAGES.filter((i) => i % 3 === 0 || i === 74);
            const ref = new Map(images.map((i) => [i, rendu(sansAnim, i)]));
            // La mise en page est bien appliquée (≠ v4) et l'anim 0 n'y change rien.
            expect(images.some((i) => rendu(v4, i) !== ref.get(i))).toBe(true);
            for (const i of images) expect(rendu(zero, i), `anim 0, image ${i}`).toBe(ref.get(i));
            for (const anim of [1, 2]) {
              const p = ecran(type, objet, { miseEnPage: code, animObjet: anim });
              let bouge = false;
              for (const i of images) {
                const html = rendu(p, i);
                expect(html, `anim ${anim}, image ${i}`).not.toMatch(/NaN|undefined|Infinity/);
                if (html !== ref.get(i)) bouge = true;
              }
              expect(bouge, `anim ${anim} : l'objet ${SANS_OBJET.includes(code) ? "absent ne change rien" : "bouge dans la mise en page"}`).toBe(!SANS_OBJET.includes(code));
            }
          });
        }
    it(`${lot} · au moins une mise en page L6 dessine chaque objet du lot`, () => {
      for (const objet of objets) {
        const portees = (["etape", "objet"] as const).flatMap((type) => MISES_EN_PAGE_L6[type].filter((code) => !SANS_OBJET.includes(code) && codeL6(ecran(type, objet, { miseEnPage: code })) === code));
        expect(portees.length, objet).toBeGreaterThan(0);
      }
    });
  });
}
