/**
 * S-13-e : « prête, avec remarques » pour l'image vers vidéo (module PUR, SANS importeur : éteint, 0 €).
 *
 * `assouplirVerdictIV(brut, entree)` lit le verdict de la porte unique APRÈS coup. Si TOUS les blocages restants sont
 * reclassables en remarques (décision n° 8 de Williams : seule la liste fermée `RESTE_BLOQUANT` reste bloquante), il rend un
 * verdict « prête » dont les remarques sont des mentions préfixées par `PREFIXE_REMARQUE_LIVRAISON`. Sinon il rend `brut`
 * TEL QUEL (même référence) : un verdict qui ne change pas ne doit jamais faire tourner la reprise en rond.
 *
 * Restent TOUJOURS bloquants : les défauts généraux, tout contrôle « non-fait » (une version refusée AVANT l'écoute n'a ni
 * été écoutée ni relue : ses lignes sortent « non-fait »), tout contrôle absent, et toute ligne que la table ci-dessous
 * rattache à un code de `RESTE_BLOQUANT`. Aucune dépense : ce module ne fait qu'interpréter un verdict déjà rendu.
 */
import { PREFIXE_REMARQUE_LIVRAISON, type CodeResteBloquant } from "@/domaine/livraison-avec-remarques";
import type { CodeControleIV, LigneControleIV } from "./controles";
import type { EntreePorteIV, VerdictPorteIV, VerdictReseauPorteIV, VersionJugeeIV } from "./porte";

/**
 * TABLE FERMÉE (choix de fond, à faire relire) : code de contrôle IV → code de `RESTE_BLOQUANT` qu'il porte, ou `null` :
 * reclassable en remarque. Au moindre doute, le contrôle est rattaché à un code (il reste bloquant). Les contrôles qui
 * sont DÉJÀ des remarques aujourd'hui (règle du 25/10 : `adaptation-scene.ts`, `controles.ts`) valent `null` : la table ne
 * les re-bloque JAMAIS. Évalués APRÈS écoute et relecture (donc le vrai gain) : Q06, Q16 à Q18, Q24, Q26, CHIFFRES. Q08bis reste bloquant (règle de fer du texte).
 * Exceptions de texte : Q24 reste bloquant pour « image noire » (image-noire-au-debut) ; Q26 pour une fin ou une phrase non
 * choisie vue à l'image (`fin-absente`, `phrase-non-choisie`), une image noire ou un chiffre faux (« faux : »).
 */
export const TABLE_RECLASSEMENT_IV: Readonly<Record<CodeControleIV, CodeResteBloquant | null>> = Object.freeze({
  Q01: "chiffre-faux", // écarts de lecture de l'image non tranchés : chiffres incertains
  Q02: null,
  Q03: "voix-ou-accord", // carte non validée : l'accord manque
  Q04: "regles-h1-h2",
  Q05: "regles-h1-h2",
  Q05bis: "regles-h1-h2",
  Q06: "mot-dit-faux",
  Q07: "regles-h1-h2",
  Q08: "mot-interdit",
  Q08bis: "regles-h1-h2", // bloquant pour une règle du TEXTE (regles.ts:480-485, CODES_REGLES_JAMAIS_FAUX) : jamais reclassé
  Q09: "regles-h1-h2",
  Q10: "regles-h1-h2",
  Q11: "duree-plus-180-s",
  Q11bis: null,
  Q12: null,
  Q13: null,
  CHIFFRES: "chiffre-faux",
  Q14: null,
  Q15: null,
  Q16: "voix-ou-accord",
  Q17: "voix-ou-accord",
  Q18: "mot-dit-faux",
  Q19: null,
  Q20: null,
  Q21: null,
  Q22: null,
  Q23: null,
  Q24: null,
  Q25: null,
  Q26: null,
  Q27: null,
  Q28: null,
  FOND: null,
  ORANGE: null,
  FIN: "fin-absente",
  SCENE: null,
  C100: null,
});

const bloque = (l: Pick<LigneControleIV, "etat" | "bloquant">) => l.bloquant && l.etat !== "reussi";

const TEXTE_RESTE_BLOQUANT: Readonly<Partial<Record<CodeControleIV, RegExp>>> = Object.freeze({
  Q24: /image noire|noire/i,
  Q26: /\bfin\b|phrase non choisie|non choisie|noire|noir\b|\bfaux\s*:|rendu est suspect|sans relecture/i, // « faux : » = chiffre faux vu à l'image (relecture-finale.ts) ; « rendu suspect / sans relecture » = rien n'a été vu (nonRelue, relecture-finale.ts:553)
});

/** Une ligne bloquante qui ne peut PAS devenir une remarque. */
function resteBloquante(l: LigneControleIV): boolean {
  if (l.etat === "non-fait") return true;
  if (!Object.hasOwn(TABLE_RECLASSEMENT_IV, l.code)) return true; // contrôle inconnu : jamais sauté en silence
  if (TABLE_RECLASSEMENT_IV[l.code] !== null) return true;
  const motif = TEXTE_RESTE_BLOQUANT[l.code];
  return !!motif && [l.phrase, ...l.details].some((t) => motif.test(t));
}

export function assouplirVerdictIV(brut: VerdictPorteIV, entree: Pick<EntreePorteIV, "reseaux" | "versions">): VerdictPorteIV {
  if (brut.ok || brut.generaux.length > 0) return brut;
  const bloquantes = brut.versions.flatMap((v) => v.lignes.filter(bloque));
  if (!bloquantes.length || bloquantes.some(resteBloquante)) return brut;

  // `brut.phrases` = une phrase par ligne bloquante (défauts généraux exclus : il n'y en a pas), dans l'ordre des versions.
  const remarques = brut.phrases.map((p) => `${PREFIXE_REMARQUE_LIVRAISON}${p}`);
  if (remarques.length !== bloquantes.length) return brut;

  const versions: VersionJugeeIV[] = brut.versions.map((v) => ({ ...v, ok: true, phrases: [], lignes: v.lignes.map((l) => (bloque(l) ? { ...l, bloquant: false } : l)) }));
  // Même règle que `porte.ts` : un réseau est livrable si toutes les versions de son fichier principal sont bonnes ; il en faut une.
  const parReseau: VerdictReseauPorteIV[] = brut.parReseau.map((x) => ({ reseau: x.reseau, ok: entree.versions.some((v) => v.reseaux.includes(x.reseau)), phrases: [], versionsRefusees: [] }));
  if (parReseau.some((x) => !x.ok)) return brut;
  const mentions = [...brut.mentions, ...remarques];
  const { nature, ...reste } = brut;
  void nature;
  const noms = brut.reseaux.map((x) => x.nom).join(", ");
  return {
    ...reste,
    ok: true,
    statut: "prete",
    phrase: `La vidéo est prête pour ${noms} (${mentions.length} remarque${mentions.length > 1 ? "s" : ""} à lire).`,
    phrases: [],
    mentions,
    versions,
    parReseau,
    partielle: false,
  };
}
