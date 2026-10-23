import type { CarrouselSpecType } from "../visuels/types";
import { transformerTextes } from "./textes-de";

const FINE = " ";
const INSECABLE = " ";

/** Typographie française d'un texte : pure et idempotente. */
export function typographieFrancaise(texte: string): string {
  return (
    texte
      // Apostrophe droite entre deux lettres -> apostrophe typographique.
      .replace(/(?<=\p{L})'(?=\p{L})/gu, "’")
      // Guillemets droits ou anglais appariés -> guillemets français.
      .replace(/"([^"]*)"/g, "«$1»")
      .replace(/[“”]([^“”]*)[“”]/g, "«$1»")
      // Espace insécable à l'intérieur des guillemets français.
      .replace(/«\s*/g, `«${INSECABLE}`)
      .replace(/\s*»/g, `${INSECABLE}»`)
      // Espace fine insécable avant ; ! ? (sauf après une autre ponctuation double : « ?! »).
      .replace(/(?<=[^\s;!?])\s*([;!?])/g, `${FINE}$1`)
      // Espace insécable avant « : » quand il termine un mot (pas dans « 10:30 »).
      .replace(/(?<=[\p{L}\p{N})»’])[ \t  ]*:(?=\s|$)/gu, `${INSECABLE}:`)
  );
}

export interface ResultatTypographie {
  specCorrige: CarrouselSpecType;
  corrections: string[];
}

/** Corrige la typographie de tous les textes ; ne change aucun niveau de contrôle. */
export function corrigerTypographie(spec: CarrouselSpecType): ResultatTypographie {
  const corrections: string[] = [];
  const specCorrige = transformerTextes(spec, (texte, chemin) => {
    const neuf = typographieFrancaise(texte);
    if (neuf !== texte) {
      const page = /^pages\.(\d+)/.exec(chemin);
      const lieu = page ? `Page ${Number(page[1]) + 1}` : "Le texte alternatif";
      const phrase = `${lieu} : la typographie française est corrigée (espaces insécables, guillemets, apostrophes).`;
      if (!corrections.includes(phrase)) corrections.push(phrase);
    }
    return neuf;
  });
  return { specCorrige, corrections };
}
