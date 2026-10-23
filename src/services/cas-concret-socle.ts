/**
 * Le socle de Will pour l'écriture du cas concret, SANS les phrases de la v4 : le ton est décrit en mots, jamais
 * donné en exemples recopiables (décision de Will du 18/10 : les scripts du cas concret ne doivent pas copier la 1re vidéo).
 */
import type { EntreeRole } from "@/generateur/roles/types";
import { EXTRAITS_WILL } from "@/donnees/generateur/modeles-will";

/** Le ton de Will en mots : aucune phrase d'une vidéo existante. */
export const TON_WILL_EN_MOTS = [
  "Le ton de Will, décrit en mots (aucun exemple à recopier) :",
  "- phrases courtes, concrètes, au présent, qui parlent d'un geste précis plutôt que d'une idée ;",
  "- « vous » pour la personne qui regarde ; en posture « offre », jamais « on a » ni « nous » : c'est l'automatisation qui fait l'action dans la phrase ; en posture « chez-nous » (usage réel), « nous » est permis ;",
  "- un seul moment humain, posé court, jamais théâtral ;",
  "- pas de superlatif, aucune promesse au-delà de la promesse du cas et de ses faits ; des chiffres seulement s'ils sont dans les faits du cas ;",
  "- le rythme et les tournures changent d'une vidéo à l'autre : écrire chaque script comme s'il n'existait aucun autre, sans reprendre les tournures de <deja_dit>.",
].join("\n");

/** Le ton en mots d'Image → vidéo : la source est la carte de l'image, pas les faits d'un cas ; pas de postures. */
export const TON_IMAGE_VIDEO_EN_MOTS = [
  "Le ton de Will, décrit en mots (aucun exemple à recopier) :",
  "- on parle, on n'écrit pas : phrases courtes, concrètes, au présent, qui montrent une action plutôt qu'une idée ;",
  "- « vous » pour la personne qui regarde ; l'automatisation est le sujet des phrases ;",
  "- un seul moment humain, posé court, jamais théâtral ;",
  "- pas de superlatif ; aucune promesse au-delà de la carte de l'image ; des chiffres seulement s'ils figurent dans la carte ;",
  "- le rythme et les tournures changent d'une vidéo à l'autre : écrire chaque script comme s'il n'existait aucun autre.",
].join("\n");

const mots = (s: string): string[] => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter(Boolean);

/** Les suites de 4 mots des phrases de la v4 (extraits du ton de Will). */
const SUITES_V4: ReadonlySet<string> = new Set(
  EXTRAITS_WILL.flatMap((e) => {
    const m = mots(e.extrait);
    return Array.from({ length: Math.max(0, m.length - 3) }, (_, i) => m.slice(i, i + 4).join(" "));
  }),
);

const reprendLaV4 = (ligne: string): boolean => {
  const m = mots(ligne);
  return m.some((_, i) => i + 4 <= m.length && SUITES_V4.has(m.slice(i, i + 4).join(" ")));
};

/** Une ligne qui n'est QU'une balise (ouvrante ou fermante) : jamais retirée, pour ne pas casser le balisage. */
const estBalise = (l: string): boolean => /^\s*<\/?[\w-]+(\s[^>]*)?>\s*$/.test(l);

const MOT_INTERDICTION = /interdit|bannis|jamais|ne pas dire/i;

/** Retire les « » qui suivent un mot d'interdiction (jusqu'au prochain « | ») : ce qu'un garde-fou cite pour l'interdire. */
const sansCitationsInterdites = (l: string): string => l.replace(/(?:interdit|bannis|jamais|ne pas dire)[^|]*/gi, (s) => s.replace(/«[^»]*»/g, " "));

/** Un garde-fou garde sa ligne tant que la v4 n'y apparaît que dans ce qu'il cite pour l'interdire. */
const aGarder = (l: string): boolean => estBalise(l) || (MOT_INTERDICTION.test(l) && !reprendLaV4(sansCitationsInterdites(l)));

/** Retire d'un bloc de socle les lignes qui reprennent une phrase de la v4, sauf balises et garde-fous. */
export function sansPhrasesV4(bloc: string | undefined): string | undefined {
  if (bloc === undefined) return undefined;
  return bloc
    .split("\n")
    .filter((l) => aGarder(l) || !reprendLaV4(l))
    .join("\n");
}

/** Le socle de Will (charte, style, preuves) pour le cas concret, sans phrase de la v4 : `gagnants` devient le ton en mots. */
export async function socleCasConcretSansV4(ton: string = TON_WILL_EN_MOTS): Promise<EntreeRole["contexte"]> {
  const [{ blocsSocleWill }, { parametresGenerateur }] = await Promise.all([import("./socle-will"), import("@/donnees/generateur/parametres-generateur")]);
  const blocs = await blocsSocleWill({ ...parametresGenerateur("cas-concret"), modelesDeTon: [] });
  const contexteAxion = sansPhrasesV4(blocs.contexteAxion);
  const styleWill = sansPhrasesV4(blocs.styleWill);
  const preuves = sansPhrasesV4(blocs.preuves);
  return {
    ...blocs,
    ...(contexteAxion !== undefined ? { contexteAxion } : {}),
    ...(styleWill !== undefined ? { styleWill } : {}),
    ...(preuves !== undefined ? { preuves: preuves.trim() === "" ? "Aucune preuve validée." : preuves } : {}),
    gagnants: ton,
  };
}
