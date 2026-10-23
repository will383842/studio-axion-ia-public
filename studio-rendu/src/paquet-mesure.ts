/** Paquet Remotion de MESURE des pages VisuelPage (opération `visuel-page`), construit à la première demande puis gardé. */
import { resolve } from "node:path";
import { racinePaquet } from "./remotion.js";

let paquet: Promise<string> | null = null;

export function paquetMesure(): Promise<string> {
  if (!paquet) {
    paquet = import("@remotion/bundler").then(({ bundle }) => bundle({ entryPoint: resolve(racinePaquet(), "compositions", "visuels", "mesure", "index.ts") }));
    // Un échec de construction ne reste pas en cache : la demande suivante réessaie.
    paquet.catch(() => {
      paquet = null;
    });
  }
  return paquet;
}
