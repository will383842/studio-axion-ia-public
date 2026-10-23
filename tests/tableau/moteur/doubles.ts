/**
 * DOUBLES du moteur `montage-tableau` (TB-11) : la chaîne reçoit les doubles de TB-06a (voix simulée comptée, rendu qui
 * répond « terminé » tout de suite, stockage en mémoire), plus un stockage des fiches par clé. Aucun appel réseau.
 */
import type { CommandeFabrication } from "../../../src/domaine/types";
import { commandeTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { creerMoteurMontageTableau, type OutilsTableau } from "../../../src/moteurs/montage-tableau";
import { doubles, type Doubles } from "../fabriquer/doubles";
import { texteScriptDe } from "../regles/exemples";

export interface Banc {
  moteur: ReturnType<typeof creerMoteurMontageTableau>;
  /** Doubles de la chaîne (partagés par tous les travaux du banc : stockage, rendu, voix). */
  d: Doubles;
  /** Fiches rangées dans le « stockage », par clé. */
  fiches: Map<string, FicheTableau>;
  /** Fabriques d'outils appelées (une par `avancer`). */
  appelsOutils: () => number;
  /** Range une fiche et rend la commande qui la désigne. */
  commande: (fiche: FicheTableau, extra?: Partial<CommandeFabrication>) => CommandeFabrication;
}

/** Les outils de la chaîne, sans ce que pose le moteur (vidéo, fiche, journal, attente, script). */
export function versOutils(d: Doubles, fiches: Map<string, FicheTableau>, extra: Partial<OutilsTableau> = {}): OutilsTableau {
  const { videoId, lireFiche, journal, attendre, contexte, ...reste } = d.outils;
  void videoId;
  void lireFiche;
  void journal;
  void attendre;
  const { texteScript, ...sansScript } = contexte;
  void texteScript;
  return {
    ...reste,
    contexte: sansScript,
    lireFiche: async (cle) => {
      const f = fiches.get(cle);
      if (!f) throw new Error(`Aucune fiche sous ${cle}.`);
      return structuredClone(f);
    },
    ...extra,
  };
}

/** Banc d'essai : un moteur dont les outils sont les doubles (`outils` : ce qui change par rapport à eux). */
export function banc(fiche: FicheTableau, extra: Partial<OutilsTableau> | null = {}): Banc {
  const d = doubles(fiche);
  const fiches = new Map<string, FicheTableau>();
  let appels = 0;
  const moteur = creerMoteurMontageTableau({
    outils: async () => {
      appels++;
      return extra === null ? null : versOutils(d, fiches, extra);
    },
  });
  let n = 0;
  return {
    moteur,
    d,
    fiches,
    appelsOutils: () => appels,
    commande: (f, plus = {}) => {
      const cle = `studio/dev/fiches/${f.videoId}/${++n}.json`;
      fiches.set(cle, structuredClone(f));
      const base = commandeTableau({ videoId: f.videoId, fiche: f, texteScript: texteScriptDe(f), dureeSec: 30, centreSousTitresPct: 80, scenes: [], personnageId: "williams" });
      return { ...base, entrees: { tableau: { ficheScenesCle: cle, empreinte: `e${n}`, version: 1 } }, ...plus };
    },
  };
}
