/**
 * Gabarit à copier pour un générateur neuf. Non inscrit : l'inscription (ids.ts, index.ts, formats) est un geste du guide
 * `docs/formats/AJOUTER-UN-FORMAT.md` (G1-04).
 *
 * `creerMoteurGabarit(def)` rend un `MoteurVideo` à partir de ce que la démo facecam et le tutoriel d'outil ont en commun :
 * estimation à 0 € ; PAUSE claire quand les dépendances (rendu, voix…) ne sont pas reliées (en file, sans échec, sans
 * coût, jamais une vidéo d'essai) ; état gardé dans le travail et reprise après redémarrage ; retouche partielle par
 * `retoucher({ operations })` (R-4) ; `origine` de la commande propagée au travail et au résultat ; entrées lues dans
 * `commande.entrees` (R-8, jamais `fabrication.ts`). Aucun appel à Claude, aucun fournisseur payant, aucun import de
 * `studio-rendu` (`src/moteurs/` n'est pas copié par l'image du rendu).
 * Limite (même comportement que la démo) : un travail mis en pause au lancement (`fabriquerPasEncoreBranche`, sans
 * `parametres.gabarit`) ne repart pas seul quand les dépendances sont reliées ; il faut le relancer.
 * Panne imprévue : 1re exception => étape en échec réessayable (`chaine.ts`), jamais « en cours » indéfiniment.
 */
import type { CommandeFabrication, LigneCout, Ratio, Travail } from "@/domaine/types";
import { ZERO } from "@/lib/montants";
import { fabriquerPasEncoreBranche, type DefinitionVitrine } from "../montage-vitrines/pause";
import type { ContexteLancement, DefinitionEtapeMoteur, Estimation, MoteurVideo, OperationMontage, ParentRetouche, ResultatFabrication } from "../types";
import { avancerChaine, etapesPretes, nouveauTravailGabarit, type ContexteAvance, type EtatGabarit } from "./chaine";

export type { ContexteAvance, EtatGabarit } from "./chaine";

/**
 * Propriétés de la composition commune (`studio-rendu/compositions/commune/CalquesCommuns.tsx`, G2-06), recopiées ici
 * parce que `src/moteurs/` ne doit rien importer de `studio-rendu/**`. Le plan de scènes est rendu sous la clé
 * `planScenes` (valeur : un plan déjà validé, JSON).
 */
export interface ProprietesRenduCommun {
  planScenes?: unknown;
  sousTitres?: unknown;
}

export interface DefinitionGabarit<Entrees, Etat extends EtatGabarit, Deps, Reprise> {
  /** Texte libre : n'est pas un `IdMoteur` (type fermé de `ids.ts`) tant que l'inscription n'est pas faite. */
  id: string;
  nom: string;
  etapesFabrication: DefinitionEtapeMoteur[];
  etapesRetouche: DefinitionEtapeMoteur[];
  ratios: Ratio[];
  dureeMaxSec: number;
  langues?: string[];
  /** Phrase de la pause, vouvoiement, sans jargon. */
  phrasePause: string;
  /** Entrées propres au générateur, lues dans `commande.entrees` (R-8). */
  lireEntrees(commande: CommandeFabrication): Entrees;
  /** Dépendances reliées (rendu, voix…), ou `null` : alors la fabrication reste en PAUSE. */
  dependances(commande: CommandeFabrication, travailId?: string): Deps | null;
  etatInitial(entrees: Entrees, commande: CommandeFabrication): Etat;
  /** Un pas : fait au plus une étape prête et rend le nouvel état (`faites`, `echec`, `fini`). */
  avancer(etat: Etat, ctx: ContexteAvance<Entrees>, deps: Deps): Promise<Etat>;
  /** Résultat à rendre quand `etat.fini` (sorties, note, sous-titres…). `projetMontage.reprise` sert à reprendre. */
  resultat(commande: CommandeFabrication, etat: Etat, entrees: Entrees): ResultatFabrication;
  reprise: {
    /** Lit la reprise dans le `projetMontage` de la version d'avant ; `undefined` : tout est refait (jamais un refus). */
    lire(projetMontage: Record<string, unknown> | undefined): Reprise | undefined;
    /** État de départ d'une retouche : ce qui est déjà fait reste fait, seules les opérations touchent des parties. */
    etatPourRetouche(reprise: Reprise, commande: CommandeFabrication, operations: OperationMontage[]): Etat;
  };
  /** Facultatif : propriétés de la composition commune, rendues dans `projetMontage.proprietesRendu`. */
  proprietesRendu?(etat: Etat, commande: CommandeFabrication): ProprietesRenduCommun;
}

const somme = (defs: DefinitionEtapeMoteur[]) => defs.reduce((t, e) => t + e.dureeEstimeeSec, 0);

export function creerMoteurGabarit<Entrees, Etat extends EtatGabarit, Deps, Reprise>(def: DefinitionGabarit<Entrees, Etat, Deps, Reprise>): MoteurVideo {
  const vitrine = (etapes: DefinitionEtapeMoteur[]): DefinitionVitrine => ({ id: def.id, nom: def.nom, phrasePause: def.phrasePause, etapes });
  const lignes = (nature: LigneCout["nature"]): LigneCout[] => [{ etape: def.nom, fournisseur: "studio", unite: "forfait", quantite: 1, prixUnitaire: ZERO, total: ZERO, nature }];
  /** Estimation à 0 € par défaut. */
  const estimation = (dureeFabricationSec: number): Estimation => ({ dureeFabricationSec: Math.max(1, dureeFabricationSec), lignes: lignes("estime"), total: ZERO });

  const lancerAvec = (defs: DefinitionEtapeMoteur[], etat: (c: CommandeFabrication) => Etat) => (commande: CommandeFabrication, contexte: ContexteLancement): Travail => {
    // Pas de dépendances : PAUSE claire (en file, sans échec, sans coût), jamais une vidéo d'essai.
    if (!def.dependances(commande)) return fabriquerPasEncoreBranche(vitrine(defs), commande, contexte);
    return nouveauTravailGabarit(def.id, defs, commande, contexte, etat(commande));
  };
  const toutRefaire = (defs: DefinitionEtapeMoteur[]) => lancerAvec(defs, (c) => def.etatInitial(def.lireEntrees(c), c));

  /** Reprise du `projetMontage` du parent ; absente : tout est refait. */
  const depuisReprise = (commande: CommandeFabrication, contexte: ContexteLancement, parent: ParentRetouche | undefined, operations: OperationMontage[]): Travail => {
    const reprise = def.reprise.lire(parent?.projetMontage);
    if (reprise === undefined) return toutRefaire(def.etapesFabrication)(commande, contexte);
    return lancerAvec(def.etapesRetouche, (c) => def.reprise.etatPourRetouche(reprise, c, operations))(commande, contexte);
  };

  async function avancer(travail: Travail, commande: CommandeFabrication, maintenant = Date.now()) {
    if (travail.statut === "termine" || travail.statut === "annule") return { travail };
    const precedent = travail.parametres?.gabarit as Etat | undefined;
    const deps = precedent ? def.dependances(commande, travail.id) : null;
    // Pause (aucune dépendance reliée, ou travail mis en pause au lancement) : rien ne bouge, rien n'échoue.
    if (!precedent || !deps) return { travail };
    const entrees = def.lireEntrees(commande);
    const etapes = travail.etapes.map((e) => ({ cle: e.cle, nom: e.nom, icone: e.icone, dependDe: e.dependDe, dureeEstimeeSec: 0 }));
    const ctx: ContexteAvance<Entrees> = { commande, entrees, travailId: travail.id, versionId: travail.versionId ?? commande.videoId, tentative: travail.tentatives, etapes };
    const { travail: suivant, etat, fini } = await avancerChaine(travail, precedent, (e) => def.avancer(e, ctx, deps), maintenant);
    if (!fini) return { travail: suivant };
    const resultat = def.resultat(commande, etat, entrees);
    const proprietes = def.proprietesRendu?.(etat, commande);
    return {
      travail: suivant,
      resultat: {
        ...resultat,
        projetMontage: {
          moteur: def.id,
          ...resultat.projetMontage,
          ...(commande.origine ? { origine: commande.origine } : {}),
          ...(proprietes ? { proprietesRendu: proprietes } : {}),
        },
      },
    };
  }

  return {
    id: def.id,
    nom: def.nom,
    capacites: { dureeMaxSec: def.dureeMaxSec, ratios: def.ratios, langues: def.langues ?? ["fr", "fr-FR"], retoucheParPlan: true, asynchrone: true, accordExige: false, maquette: false },
    estimer: async () => estimation(somme(def.etapesFabrication)),
    estimerRetouche: async () => estimation(somme(def.etapesRetouche)),
    estimerReexport: async () => estimation(somme(def.etapesRetouche)),
    etapes: () => def.etapesFabrication,
    // Rien n'est refusé : sans dépendances, la demande est reçue puis mise en pause.
    refusAuLancement: () => null,
    refusRetouche: () => null,
    async lancer(commande, contexte) {
      return toutRefaire(def.etapesFabrication)(commande, contexte);
    },
    avancer,
    async reessayer(travail, maintenant = Date.now()) {
      const etat = travail.parametres?.gabarit as Etat | undefined;
      if (!etat) return travail;
      // L'étape en échec repart ; tout ce qui est fait reste fait.
      return { ...travail, statut: "en_cours", erreur: undefined, tentatives: travail.tentatives + 1, modifieLe: new Date(maintenant).toISOString(), parametres: { ...travail.parametres, gabarit: { ...etat, echec: undefined } } };
    },
    async retoucher({ commande, contexte, parent, operations }) {
      return depuisReprise(commande, { ...contexte, type: "retouche" }, parent, operations ?? []);
    },
    async reexporter({ commande, contexte, cible, parent }) {
      // Un format de plus : même reprise, seul ce format est refait.
      const ratio = "ratio" in cible ? cible.ratio : commande.ratios[0];
      return depuisReprise({ ...commande, ratios: [ratio] }, { ...contexte, type: "reexport" }, parent, []);
    },
    maquette: async (commande) => ({ dureeSec: commande.dureeCibleSec }),
    async annuler(travail, maintenant = Date.now()) {
      if (travail.statut === "termine" || travail.statut === "annule") return travail;
      const iso = new Date(maintenant).toISOString();
      return { ...travail, statut: "annule", etapes: travail.etapes.map((e) => (e.statut === "terminee" ? e : { ...e, statut: "ignoree" as const, erreur: undefined })), erreur: undefined, modifieLe: iso, termineLe: iso };
    },
  };
}

/** Pour un `avancer` de moteur : la première étape prête (ou `undefined` : tout est fait). */
export function premiereEtapePrete(ctx: { etapes: DefinitionEtapeMoteur[] }, etat: EtatGabarit): DefinitionEtapeMoteur | undefined {
  return etapesPretes(ctx.etapes, etat.faites)[0];
}
