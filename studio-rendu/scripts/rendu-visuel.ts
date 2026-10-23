/**
 * Rendu réel (Remotion, `renderStill`) des pages de carrousel, partagé par les scripts d'essai et par les tests de rendu.
 * Sans Docker, sans réseau extérieur, sans appel payant. Navigateur : `STUDIO_RENDU_NAVIGATEUR` (chemin d'un Chromium local).
 * Le spec passe par le schéma Zod avant le rendu ; un texte qui déborderait fait ÉCHOUER le rendu (`Zone`, `Carte`).
 */
import { existsSync } from "node:fs";
import { validerProprietesPage } from "../../src/visuels/proprietes-page.js";
import { ID_COMPOSITION_DECORS, ID_COMPOSITION_PAGE } from "../compositions/visuels/commun/constantes.js";

/** Chemin d'un Chromium local utilisable (variable d'environnement, sinon l'installation de Playwright), ou `undefined`. */
export function navigateurLocal(): string | undefined {
  const impose = process.env.STUDIO_RENDU_NAVIGATEUR;
  if (impose) return impose;
  return ["/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"].find((c) => existsSync(c));
}

export interface Rendeur {
  /** Rend la page `index` du spec dans `sortie` (JPEG ou PNG selon `format`). Lève une erreur si le texte déborde. */
  page(spec: unknown, index: number, sortie: string, format?: "jpeg" | "png"): Promise<void>;
  /** Comme `page`, SANS le schéma : réservé à la recherche de capacité (`essai-capacite-pages.ts`), qui sonde au-delà des bornes actuelles. */
  pageSansSchema(spec: unknown, index: number, sortie: string): Promise<void>;
  /** Rend la planche des éléments décoratifs. */
  decors(sortie: string): Promise<void>;
}

/**
 * Chargement à la demande par un nom calculé : le typage (`tsc -p tsconfig.visuels.json`, CI ciblée sans les dépendances de
 * `studio-rendu`) ne suit pas ces modules, et rien n'est chargé tant qu'on ne rend pas.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (specificateur: string): Promise<any> => import(/* @vite-ignore */ specificateur);

export async function ouvrirRendeur(): Promise<Rendeur> {
  process.env.STUDIO_RENDU_ESSAI ??= "1";
  const { renderStill, selectComposition } = await charger("@remotion/renderer");
  const { paquetCompositions, REGLAGES_RENDU } = await charger(new URL("../src/remotion.ts", import.meta.url).href);
  const serveUrl = await paquetCompositions();
  const navigateur = navigateurLocal();
  const options = navigateur ? { browserExecutable: navigateur } : {};
  const rendre = async (id: string, inputProps: Record<string, unknown>, output: string, format: "jpeg" | "png") => {
    const composition = await selectComposition({ serveUrl, id, inputProps, ...options });
    await renderStill({ ...REGLAGES_RENDU, composition, serveUrl, output, frame: 0, imageFormat: format, ...(format === "jpeg" ? { jpegQuality: 88 } : {}), inputProps, ...options } as never);
  };
  return {
    page: (spec, index, sortie, format = "jpeg") => rendre(ID_COMPOSITION_PAGE, validerProprietesPage({ spec, index }) as unknown as Record<string, unknown>, sortie, format),
    pageSansSchema: (spec, index, sortie) => rendre(ID_COMPOSITION_PAGE, { spec, index }, sortie, "jpeg"),
    decors: (sortie) => rendre(ID_COMPOSITION_DECORS, {}, sortie, "jpeg"),
  };
}
