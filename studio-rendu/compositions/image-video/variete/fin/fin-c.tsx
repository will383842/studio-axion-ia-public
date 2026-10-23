import React from "react";
/**
 * FIN-C · Boucle (maquettes FIN-C-1/3) : la dernière image reprend la première, celle de l'ouverture de la version,
 * dans son état final (même objet, même place) : la vidéo peut se relancer sans coupure visible. Avec l'horloge (OUV-C),
 * les aiguilles marquent l'heure de la phrase-choc et l'écran montre un chiffre déjà dit (jamais avant son mot).
 */
import type { FormatIV } from "../../../../../src/briques/schema-motion/variete";
import { DessinOuverture } from "../ouverture/ecran";
import type { DonneesFin } from "./donnees";

type D = Extract<DonneesFin, { code: "FIN-C" }>;

export function FinC({ d, t, format }: { d: D; t: number; format: FormatIV }) {
  return <DessinOuverture d={d.boucle} t={t} format={format} boucle={{ heure: d.heure, deja: d.deja }} />;
}
