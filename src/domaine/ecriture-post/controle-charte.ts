/**
 * Contrôle de la charte en sortie (L3-05, PUB-10) : un texte GÉNÉRÉ qui tutoie ou porte un interdit est rejeté ;
 * un texte SAISI ou IMPORTÉ est seulement signalé, jamais bloqué. PUR.
 */
import { analyserCharte } from "./charte-voix";

export type OrigineTexte = "genere" | "saisi" | "importe";
export type VerdictCharte = "passe" | "rejete" | "signale";

export interface ResultatCharte {
  verdict: VerdictCharte;
  motifs: string[];
}

export function controlerCharte(texte: string, origine: OrigineTexte): ResultatCharte {
  const a = analyserCharte(texte);
  const motifs = [...(a.tutoiement ? ["Le texte tutoie : la charte demande le vouvoiement."] : []), ...a.interdits.map((l) => `Interdit : ${l}.`)];
  if (motifs.length === 0) return { verdict: "passe", motifs };
  return { verdict: origine === "genere" ? "rejete" : "signale", motifs };
}
