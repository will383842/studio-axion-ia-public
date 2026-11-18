/**
 * FIX-CC-SIGLE-SOUS-TITRES : le texte DIT épelle le sigle pour la voix (« C.R.M. »), le texte ÉCRIT dit « CRM » (R22,
 * `regles.ts`). Les sous-titres sont tirés du texte dit : cette fonction PURE leur rend la forme écrite.
 */
const SIGLE_EPELE = /(?<!\p{L})((?:\p{Lu}\.){2,})/gu;

/** Retire les points d'un sigle épelé (au moins 2 « Majuscule. » de suite). Si le sigle finit la phrase, le point final est gardé une fois. */
export function siglesEcrits(texte: string): string {
  return texte.replace(SIGLE_EPELE, (sigle: string, _g: string, position: number) => {
    const lettres = sigle.replace(/\./gu, "");
    const suite = texte.slice(position + sigle.length);
    const finDePhrase = /^\s*$/u.test(suite) || /^\s+\p{Lu}/u.test(suite);
    return finDePhrase ? `${lettres}.` : lettres;
  });
}
