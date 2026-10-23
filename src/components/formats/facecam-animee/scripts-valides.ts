/** FACE CAMÉRA ANIMÉE · « Reprendre un script validé » : phrases de l'écran, PUR. */

export const PHRASE_AUCUN_SCRIPT_VALIDE = "Aucun script validé pour ce format pour l'instant";
export const PHRASE_TEXTE_RACCOURCI = "Ce script est très long : son texte a été raccourci pour tenir dans le champ.";

/** Longueur au plus du texte dit (même borne que `entreesDuDepotFA` et le champ de l'écran). */
export const TEXTE_DIT_MAX_FA = 20_000;

/** Texte à poser dans « Ce que vous dites » : coupé à la borne du champ, à la fin d'un mot. PUR. */
export function texteDitDuScript(texte: string): { texte: string; tronque: boolean } {
  const propre = texte.replace(/\s+/g, " ").trim();
  if (propre.length <= TEXTE_DIT_MAX_FA) return { texte: propre, tronque: false };
  const coupe = propre.slice(0, TEXTE_DIT_MAX_FA);
  const dernierEspace = coupe.lastIndexOf(" ");
  return { texte: (dernierEspace > TEXTE_DIT_MAX_FA * 0.9 ? coupe.slice(0, dernierEspace) : coupe).trim(), tronque: true };
}

/** « environ 45 s » / « environ 1 min 20 » ; rien sous 1 s. */
export function phraseDureeScript(sec: number): string {
  const s = Math.round(Number(sec));
  if (!(s >= 1)) return "";
  return s < 60 ? `environ ${s} s` : `environ ${Math.floor(s / 60)} min${s % 60 ? ` ${String(s % 60).padStart(2, "0")}` : ""}`;
}
