// R4 — vue PURE de l'écran « mots et cibles » : types échangés avec les composants, états d'un mot, construction du tableau.
// Aucun import serveur, aucun réseau, aucune horloge : tout arrive en paramètres.
import {
  cibleDuMot,
  type ElementCatalogue,
  type Fenetres,
  type LiaisonMot,
  type LigneTableauMot,
  type ReseauSite,
  type TypeElement,
  type VueTableauMots,
} from "./cibles-contrat";

export type ReseauAutoVue = "facebook" | "instagram";
export type ReseauCompte = ReseauAutoVue | "linkedin" | "tiktok";
export type EtatValidationVue = "valide" | "perimee" | "absente";
export type EtatMotVue = "actif" | "pause" | "brouillon";

export interface CompteDuMot {
  readonly compte: string;
  readonly nom: string | null;
  readonly reseau: ReseauCompte | null;
  readonly etat: "actif" | "pause" | "pause_auto" | "non_pose";
  readonly surZernio: boolean;
  readonly activable: boolean;
  readonly raison: string | null;
}

/** Chiffres d'un mot, par fenêtre (7 jours, 30 jours, au total). Jamais un nom de personne. */
export interface ChiffresMot {
  readonly ecrits: Fenetres;
  readonly envoyes: Fenetres;
  readonly incertains: Fenetres;
  readonly suivent: Fenetres;
  readonly commentairesBloques: Fenetres;
  readonly envoisRefuses: Fenetres;
}

export interface ResumeMot {
  readonly mot: string;
  readonly etat: EtatMotVue;
  readonly validations: Record<ReseauAutoVue, EtatValidationVue>;
  readonly comptes: readonly CompteDuMot[];
  /** Vrai si le mot n'a pas la même cible sur tous les réseaux. */
  readonly cibleDiffere: boolean;
  readonly chiffres: ChiffresMot | null;
}

export interface VueMotsCibles {
  readonly tableau: VueTableauMots;
  readonly catalogue: readonly ElementCatalogue[];
  readonly mots: readonly ResumeMot[];
  readonly plusieursMotsAllume: boolean;
  /** Vrai si le site ne répond pas et que la dernière copie du catalogue est affichée. */
  readonly depuisCopie: boolean;
}

export type ApercuReseauVue =
  | {
      readonly reseau: ReseauAutoVue;
      readonly ok: true;
      readonly cible: {
        readonly titre: string;
        readonly type: TypeElement;
        readonly test: boolean;
      };
      readonly textes: readonly {
        readonly groupe: string;
        readonly version: string;
        readonly texte: string;
      }[];
      readonly empreinte: string;
      readonly etat: EtatValidationVue;
    }
  | {
      readonly reseau: ReseauAutoVue;
      readonly ok: false;
      readonly phrase: string;
    };

export type ApercuTextesVue =
  | { readonly ok: true; readonly reseaux: readonly ApercuReseauVue[] }
  | { readonly ok: false; readonly phrase: string };

export interface ResultatSimpleVue {
  readonly ok: boolean;
  readonly phrase: string;
}
export interface ResultatGesteVue {
  readonly issue: "execute" | "simule" | "refuse";
  readonly phrase: string;
}

/** Ce que l'écran appelle : en production des gestes serveur, dans les tests un faux. */
export interface ServicesMotsCibles {
  creerMot(mot: string, code: string): Promise<ResultatSimpleVue>;
  changerCible(mot: string, code: string): Promise<ResultatSimpleVue>;
  apercuTextes(mot: string): Promise<ApercuTextesVue>;
  validerTextes(
    mot: string,
    reseau: ReseauAutoVue,
    empreinteVue: string,
  ): Promise<ResultatSimpleVue>;
  activer(mot: string, compte: string): Promise<ResultatGesteVue>;
  mettreEnPause(mot: string, compte: string): Promise<ResultatGesteVue>;
}

/** Actif si au moins un compte est actif, en pause si au moins un l'est, brouillon sinon. */
export function etatDuMot(
  comptes: readonly Pick<CompteDuMot, "etat">[],
): EtatMotVue {
  if (comptes.some((c) => c.etat === "actif")) return "actif";
  if (comptes.some((c) => c.etat === "pause")) return "pause";
  return "brouillon";
}

const ORDRE_RESEAUX: readonly ReseauSite[] = [
  "tous",
  "facebook",
  "instagram",
  "linkedin",
  "tiktok",
];

/** Construit le tableau : les mots viennent des liaisons actives, une ligne par mot et par réseau lié. */
export function construireTableau(entree: {
  catalogue: readonly ElementCatalogue[];
  liaisons: readonly LiaisonMot[];
  ignores?: number;
  chiffresParMot?: Readonly<Record<string, ChiffresMot | null | undefined>>;
  indisponible?: boolean;
}): VueTableauMots {
  const { catalogue, liaisons, chiffresParMot = {} } = entree;
  const actives = liaisons.filter((l) => l.actif);
  const mots = [...new Set(actives.map((l) => l.mot))].sort();
  const lignes: LigneTableauMot[] = [];
  for (const mot of mots) {
    const c = chiffresParMot[mot] ?? null;
    const stats = c
      ? { mot, ecrits: c.ecrits, envoyes: c.envoyes, suivent: c.suivent }
      : null;
    for (const reseau of ORDRE_RESEAUX) {
      if (!actives.some((l) => l.mot === mot && l.reseau === reseau)) continue;
      const cible = cibleDuMot(mot, reseau, liaisons, catalogue);
      lignes.push({
        mot,
        reseau,
        cible: cible.element,
        source: cible.source,
        cibleIntrouvable: cible.cibleIntrouvable,
        divergent: cible.divergent,
        actif: true,
        stats,
      });
    }
  }
  return {
    lignes,
    ignores: entree.ignores ?? 0,
    indisponible: entree.indisponible ?? false,
  };
}
