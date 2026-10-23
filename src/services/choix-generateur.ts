/**
 * SERVICE DU CHOIX CONJOINT (étape 0, gratuit ; plan v5 B.3.9 points 9 et 12 ; lot G3).
 *
 * Lit le stock (matières, preuves), la série de chaque réseau coché (`historiqueSerie`, réservations comprises) et les
 * usages des matières, appelle `choisirCombinaison`, puis ÉCRIT le choix sur le sujet SOUS `sousVerrou` avant de rendre
 * la main : un sujet en écriture compte dans la série, deux lancements d'affilée ne tirent donc pas la même combinaison.
 * Un arrêt (ANCRAGE_MANQUANT, MATIERE_INSUFFISANTE, MATIERE_A_PRECISER) coûte 0 € et ne prend pas de numéro.
 * Branché sur la chaîne en G4 (`ecrireSujetSimule` garde son choix d'ancrage G1a d'ici là).
 */
import "server-only";
import { utilisationsMatiere, versionsCourantes } from "@/domaine/derivations-generateur";
import { matierePourSujet } from "@/domaine/matieres";
import type { ElementSerieEtendu } from "@/domaine/controles-script";
import type { Id, ModeDiction, ScriptMaitre } from "@/domaine/types";
import { historiqueSerie } from "@/domaine/variete";
import { parametresGenerateur } from "@/donnees/generateur/parametres-generateur";
import { formatGenerateur } from "@/formats";
import { choisirCombinaison, type ResultatChoix } from "@/generateur/choix-combinaison";
import { exigerSession } from "./auth";
import { depots, ErreurStudio, journaliser, maintenant, sousVerrou } from "./_commun";

export interface OptionsChoix {
  mode?: ModeDiction;
  modeRotation?: "demarrage" | "normal";
  stadeCompte?: "demarrage" | "etabli";
  passerTermesVagues?: boolean;
}

/** Choisit et RÉSERVE la combinaison d'un sujet (étape 0). */
export async function reserverCombinaison(scriptMaitreId: Id, options: OptionsChoix = {}): Promise<ResultatChoix> {
  await exigerSession();
  return sousVerrou(async () => {
    const d = depots();
    const m = await d.scriptsMaitres.obtenir(scriptMaitreId);
    if (!m) throw new ErreurStudio("INTROUVABLE", "Ce sujet n'existe plus.");
    if (m.archiveLe) throw new ErreurStudio("ARCHIVE", "Ce sujet est rangé : restaurez-le d'abord.");
    const params = parametresGenerateur(m.brief.formatId);
    const format = formatGenerateur(m.brief.formatId);
    const mode = options.mode ?? m.brief.modeParDefaut ?? format.recette.modeParDefaut;
    const [matieres, preuves, maitres, variantes, scripts, videos, publications, contexte] = await Promise.all([
      // E2E-1 n° 9 : la limite d'un autre sujet (proposée par la machine) ne sert qu'à son sujet.
      d.matieres.lister((x) => matierePourSujet(x, m.id)),
      d.preuves.lister(),
      d.scriptsMaitres.lister(),
      d.variantes.lister(),
      d.scripts.lister(),
      d.videos.lister(),
      d.publications.lister(),
      d.contexteAxion.lister(),
    ]);
    const autres = maitres.filter((x) => x.id !== m.id);
    const entrees = { maitres: autres, variantes, videos, publications };
    const series: Record<string, ElementSerieEtendu[]> = {};
    for (const r of m.brief.reseaux) series[r] = historiqueSerie(entrees, r, 10);
    const usagesMatieres: Record<Id, { reseau: string; le: string; numero?: number }[]> = {};
    for (const mat of matieres) {
      const u = utilisationsMatiere(mat.id, { maitres: autres, scripts, variantes });
      usagesMatieres[mat.id] = u.sujets.flatMap((s) => s.reseaux.map((reseau) => ({ reseau, le: s.le, numero: s.numero })));
    }
    const sujetsValides = autres.filter((x) => versionsCourantes(variantes.filter((v) => v.scriptMaitreId === x.id)).some((v) => v.etat === "validee")).length;
    const ctx = [...contexte].sort((a, b) => b.version - a.version).find((c) => c.valideeParWillLe) ?? contexte[0];
    const resultat = choisirCombinaison({
      maintenant: maintenant(),
      brief: { idee: m.brief.idee, pilier: m.brief.pilier, motsCles: m.brief.motCle ? [m.brief.motCle.forme] : [], reseaux: m.brief.reseaux, objectif: m.brief.objectif, matiereIdsImposees: m.brief.matiereIdsImposees },
      quiParleWill: mode === "teleprompteur" || mode === "trame",
      debit: format.recette.debitParMode[mode],
      matieres,
      preuves,
      structures: params.recette.structures,
      pointsDeVueParType: params.pointsDeVueParType,
      pointsDeVuePermis: params.recette.pointsDeVuePermis,
      emotionsPermises: params.recette.emotionsPermises,
      conditionsEmotions: params.conditionsEmotions,
      famillesAccroche: params.accroches.filter((a) => params.recette.famillesAccrochePermises.includes(a.id)).map((a) => ({ id: a.id, exige: a.exige, plafond: a.plafond })),
      famillesFavorisees: Object.fromEntries(m.brief.reseaux.map((r) => [r, params.famillesFavorisees(r)])),
      series,
      usagesMatieres,
      sujetsValides,
      modeRotation: options.modeRotation ?? (options.stadeCompte === "demarrage" ? "demarrage" : "normal"),
      stadeCompte: options.stadeCompte,
      termesVagues: ctx?.termesVagues ?? [],
      passerTermesVagues: options.passerTermesVagues,
    });
    if (resultat.ok) {
      await d.scriptsMaitres.modifier(m.id, { choix: resultat.retenue, combinaisonsTransmises: resultat.combinaisons, ancrages: resultat.retenue.ancrages, etat: "en-ecriture", manque: undefined } as Partial<ScriptMaitre>);
      await journaliser("generateur.choix-reserve", "Plan du sujet choisi.", { type: "scriptMaitre", id: m.id });
    } else {
      await d.scriptsMaitres.modifier(m.id, { manque: resultat.manque, etat: m.numero === undefined ? "brouillon" : m.etat } as Partial<ScriptMaitre>);
    }
    return resultat;
  });
}

/** Abandon d'un sujet avant écriture : la réservation est libérée (la matière n'est consommée qu'à la validation). */
export async function libererReservation(scriptMaitreId: Id): Promise<void> {
  await exigerSession();
  await sousVerrou(async () => {
    const d = depots();
    const m = await d.scriptsMaitres.obtenir(scriptMaitreId);
    if (!m || !m.choix) return;
    await d.scriptsMaitres.modifier(m.id, { choix: undefined, combinaisonsTransmises: undefined, etat: m.numero === undefined ? "brouillon" : "echec" } as Partial<ScriptMaitre>);
  });
}
