/**
 * DOUBLES du moteur `montage-cas-concret` (M9) : la chaîne reçoit les doubles de M8 (écriture simulée, voix simulée
 * comptée, rendu qui répond « terminé » tout de suite, stockage en mémoire). Aucun appel réseau.
 */
import type { CommandeFabrication } from "@/domaine/types";
import type { ReseauCas } from "@/formats/cas-concret";
import { creerMoteurMontageCasConcret, type OutilsCasConcret } from "@/moteurs/montage-cas-concret";
import { doubles, type Doubles, type OptionsDoubles } from "../fabriquer/doubles";

export interface Banc {
  moteur: ReturnType<typeof creerMoteurMontageCasConcret>;
  /** Doubles de la chaîne (partagés par tous les travaux du banc). */
  d: Doubles;
  commande: (extra?: Partial<CommandeFabrication>) => CommandeFabrication;
  /** Fiches d'écrans fournies, par clé (l'écriture est alors sautée). */
  fiches: Map<string, unknown>;
}

/** Les outils de la chaîne, sans ce que pose le moteur (journal, réseaux cochés). */
/**
 * V4-3 : par défaut, les doubles du moteur disent « aucun script validé » (l'écriture simulée est exercée, comme avant) ;
 * `"catalogue"` : le moteur prend lui-même le script validé du catalogue (comme les services en production).
 */
export type ScriptDuBanc = OutilsCasConcret["scriptValide"] | "catalogue";

export function versOutils(d: Doubles, fiches: ReadonlyMap<string, unknown> = new Map(), script: ScriptDuBanc = async () => null): OutilsCasConcret {
  const { journal, contexte, ...reste } = d.options.outils;
  void journal;
  const { reseaux, ...sansReseaux } = contexte;
  void reseaux;
  return {
    ...reste,
    env: "dev",
    contexte: sansReseaux,
    numeroVersion: async () => 42,
    ...(script === "catalogue" ? {} : { scriptValide: script }),
    lireFiche: async (cle) => {
      if (!fiches.has(cle)) throw new Error(`Aucune fiche sous ${cle}.`);
      return structuredClone(fiches.get(cle));
    },
  };
}

/** Commande d'une vidéo « Cas concret MD » pour le cas des doubles. */
export function commandeCasConcret(d: Doubles, reseaux: ReseauCas[] = ["facebook", "instagram", "tiktok", "linkedin"], extra: Partial<CommandeFabrication> = {}): CommandeFabrication {
  const e = d.options.entrees;
  return {
    versionContrat: 2,
    moteurId: "montage-cas-concret",
    videoId: d.options.videoId,
    formatId: "cas-concret",
    versionFormat: 1,
    profilRenduVersion: 1,
    dureeCibleSec: 50,
    ratios: ["9:16"],
    script: { blocs: [], texteComplet: "" },
    distribution: [{ role: "voix", source: "double", personnageId: "williams", fournisseurVoix: "heygen" }],
    styles: { sousTitres: null, decor: null, lut: null, musique: null },
    briques: { "sous-titres": true, etalonnage: false, illustrations: true, son: true, habillage: false, "texte-ecran": false, "mention-ia": false },
    entrees: { casConcret: { ...e, reseaux } },
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
    budgetMax: { centimes: 0, devise: "EUR" },
    construiteLe: "2026-10-12T09:00:00.000Z",
    ...extra,
  } as CommandeFabrication;
}

/** Banc d'essai : un moteur dont les outils sont les doubles de la chaîne. `relie: false` : aucun outil. `retouches: true` : le réglage `casConcret.retouches` est allumé (dans le double seulement ; éteint par défaut). */
export function banc(opt: OptionsDoubles & { relie?: boolean; scriptValide?: ScriptDuBanc; retouches?: boolean } = {}): Banc {
  const d = doubles(opt);
  const fiches = new Map<string, unknown>();
  const moteur = creerMoteurMontageCasConcret({ outils: async () => (opt.relie === false ? null : versOutils(d, fiches, opt.scriptValide)), retouchesAllumees: () => opt.retouches === true });
  return { moteur, d, fiches, commande: (extra = {}) => commandeCasConcret(d, opt.reseaux, extra) };
}
