/**
 * ÉTAPE 0, GRATUITE (plan v5 B.3.5 et B.3.9 ; addendum §2 quater et §2 sexies ; lot G4). PUR.
 *
 * Avant toute dépense : (1) le sujet se rattache à un pilier d'Axion-IA, sinon arrêt « Hors du domaine d'Axion-IA »
 * avec le pilier le plus proche ; (2) le choix conjoint (structure, matière, point de vue, ressenti, 2-3 combinaisons,
 * réservation faite par le service) ; (3) les consignes de diversité de la série (ouvertures, fins, récit, ruptures).
 * Renvoie les DONNÉES de la chaîne, ou le manque (0 €, aucun numéro).
 */
import type { ElementDiversite, TournureControle } from "@/domaine/controles-script";
import type { ContexteAxion, ExempleStyle, Matiere, ModeDiction, Preuve, ScriptMaitre } from "@/domaine/types";
import { phraseHorsDomaine, rattacherAuDomaine } from "@/donnees/generateur/domaine-axion";
import { parametresGenerateur } from "@/donnees/generateur/parametres-generateur";
import { formatGenerateur } from "@/formats";
import { choisirCombinaison, type EntreeChoix, type ResultatChoix } from "./choix-combinaison";
import type { DonneesGeneration } from "./contexte";

export interface EntreeEtapeZero {
  maintenant: string;
  brief: ScriptMaitre["brief"];
  mode: ModeDiction;
  matieres: Matiere[];
  preuves: Preuve[];
  contexteAxion?: DonneesGeneration["contexteAxion"] & Pick<ContexteAxion, "piliersProposes">;
  ficheStyle?: DonneesGeneration["ficheStyle"];
  exemplesStyle?: Pick<ExempleStyle, "id" | "texte">[];
  /** Série de chaque réseau coché (règles de rotation C43-C53). */
  series?: EntreeChoix["series"];
  usagesMatieres?: EntreeChoix["usagesMatieres"];
  sujetsValides?: number;
  /** Série vue par la diversité (10 dernières vidéos). */
  serieDiversite?: ElementDiversite[];
  intensitesRecentes?: DonneesGeneration["intensitesRecentes"];
  stadeCompte?: "demarrage" | "etabli";
  passerTermesVagues?: boolean;
  tournures?: TournureControle[];
  /** Apprentissage (éteint par défaut) : poids tirés de « ce qui marche », ×1,5 au plus. */
  poidsCorrection?: EntreeChoix["poidsCorrection"];
}

export type ResultatEtapeZero =
  | { ok: true; donnees: DonneesGeneration; choix: Extract<ResultatChoix, { ok: true }> }
  | { ok: false; manque: NonNullable<ScriptMaitre["manque"]>; plusProche?: { id: string; nom: string } };

export function etapeZero(e: EntreeEtapeZero): ResultatEtapeZero {
  const ctx = e.contexteAxion;
  // 1. Domaine d'Axion-IA (§2 quater) : pilier obligatoire.
  const r = rattacherAuDomaine(`${e.brief.idee} ${e.brief.phraseWill ?? ""} ${e.brief.motCle?.forme ?? ""}`, { valides: ctx?.piliers ?? [], proposes: ctx?.piliersProposes }, e.brief.pilier);
  if (!r.ok) {
    return { ok: false, manque: { type: "HORS_DOMAINE", etape: 0, ceQuIlFaudrait: phraseHorsDomaine(r.plusProche), reemploiPossible: [] }, plusProche: r.plusProche };
  }
  const format = formatGenerateur(e.brief.formatId);
  const p = parametresGenerateur(e.brief.formatId);
  const debit = (e.mode === "avatar" ? p.debitParMode?.avatar : undefined) ?? format.recette.debitParMode[e.mode];
  // 2. Choix conjoint (le pilier rattaché devient celui du brief).
  const choix = choisirCombinaison({
    maintenant: e.maintenant,
    brief: { idee: e.brief.idee, pilier: r.pilierId, motsCles: e.brief.motCle ? [e.brief.motCle.forme] : [], reseaux: e.brief.reseaux, objectif: e.brief.objectif, matiereIdsImposees: e.brief.matiereIdsImposees, structureImposee: e.brief.structureImposee, familleAccroche: e.brief.familleAccroche },
    poidsCorrection: e.poidsCorrection,
    quiParleWill: e.mode === "teleprompteur" || e.mode === "trame",
    debit,
    matieres: e.matieres,
    preuves: e.preuves,
    structures: p.recette.structures,
    pointsDeVueParType: p.pointsDeVueParType,
    pointsDeVuePermis: p.recette.pointsDeVuePermis,
    emotionsPermises: p.recette.emotionsPermises,
    conditionsEmotions: p.conditionsEmotions,
    famillesAccroche: p.accroches.filter((a) => p.recette.famillesAccrochePermises.includes(a.id)).map((a) => ({ id: a.id, exige: a.exige, plafond: a.plafond })),
    famillesFavorisees: Object.fromEntries(e.brief.reseaux.map((x) => [x, p.famillesFavorisees(x)])),
    series: e.series ?? {},
    usagesMatieres: e.usagesMatieres ?? {},
    sujetsValides: e.sujetsValides ?? 0,
    modeRotation: e.stadeCompte === "demarrage" ? "demarrage" : "normal",
    stadeCompte: e.stadeCompte,
    termesVagues: ctx?.termesVagues ?? [],
    passerTermesVagues: e.passerTermesVagues,
    diversite: e.serieDiversite ? { serie: e.serieDiversite } : undefined,
  });
  if (!choix.ok) return { ok: false, manque: choix.manque };
  return {
    ok: true,
    choix,
    donnees: {
      maintenant: e.maintenant,
      sujet: {
        idee: e.brief.idee,
        phraseWill: e.brief.phraseWill,
        objectif: e.brief.objectif,
        niveauConscience: e.brief.niveauConscience,
        cible: e.brief.cible,
        motCle: e.brief.motCle?.forme,
        adresse: e.brief.adresseParDefaut,
        mode: e.mode,
        reseaux: e.brief.reseaux,
        formatId: e.brief.formatId,
        sujetSensible: e.brief.sujetSensible,
        stadeCompte: e.stadeCompte,
        pilier: { id: r.pilierId, nom: r.nom },
      },
      choix: choix.retenue,
      combinaisons: choix.combinaisons,
      matieres: e.matieres,
      preuves: e.preuves,
      contexteAxion: ctx,
      ficheStyle: e.ficheStyle,
      exemplesStyle: e.exemplesStyle,
      intensitesRecentes: e.intensitesRecentes,
      diversite: choix.diversite,
    },
  };
}

/** Aide : le brief minimal d'un sujet (banc, tests). */
export function briefMinimal(o: { idee: string; phraseWill?: string; reseaux: ScriptMaitre["brief"]["reseaux"]; formatId: string; objectif?: ScriptMaitre["brief"]["objectif"]; pilier?: string; adresse?: "tu" | "vous"; mode?: ModeDiction; matiereIdsImposees?: string[] }): ScriptMaitre["brief"] {
  return { idee: o.idee, phraseWill: o.phraseWill, objectif: o.objectif ?? "notoriete", niveauConscience: "connait-le-probleme", reseaux: o.reseaux, formatId: o.formatId, formatsDemandes: [o.formatId], adresseParDefaut: o.adresse ?? "vous", modeParDefaut: o.mode, pilier: o.pilier, matiereIdsImposees: o.matiereIdsImposees, modeChoix: "rapide", mentionIA: false };
}
