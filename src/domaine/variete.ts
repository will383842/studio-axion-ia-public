/**
 * VARIÉTÉ : historique d'une série (générateur, plan v5 B.0 n° 40, B.2.5). PUR : importable côté client.
 *
 * La série d'un réseau X = les sujets ayant une version courante non archivée sur X, validée, en vidéo, programmée ou
 * publiée, ou RÉSERVÉE (sujet en écriture qui a fait son choix conjoint). Ordre : date de publication programmée, sinon
 * de validation, sinon de lancement. Une seule fonction, `historiqueSerie`, alimente les contrôles de série (G3).
 * Un sujet archivé ou en échec libère sa réservation (B.2.7, n° 44).
 */
import { etatReseau, versionsCourantes } from "./derivations-generateur";
import type { DateIso, Emotion, Id, PointDeVue, Publication, ReseauDeclinaison, ScriptMaitre, TypeAccroche, TypeMatiere, VarianteReseau, Video } from "./types";

export interface EntreesSerie {
  maitres: Pick<ScriptMaitre, "id" | "numero" | "etat" | "choix" | "brief" | "ancrages" | "pointDeVue" | "emotion" | "archiveLe" | "creeLe">[];
  variantes: Pick<VarianteReseau, "id" | "code" | "version" | "archiveLe" | "scriptMaitreId" | "formatId" | "etat" | "reseau" | "caracteristiques" | "avisWill" | "modifieLe" | "creeLe">[];
  videos?: Pick<Video, "id" | "statut" | "varianteId">[];
  publications?: Pick<Publication, "videoId" | "varianteId" | "reseau" | "statut" | "via" | "date">[];
}

export interface ElementSerie {
  scriptMaitreId: Id;
  numero?: number;
  /** Réservé : sujet en écriture, pas encore validé (compte dans la série, B.3.9). */
  reserve: boolean;
  date: DateIso;
  origineDate: "programmation" | "validation" | "lancement";
  formatIds: string[];
  structure?: string;
  typesAncrage: TypeMatiere[];
  matiereIds: Id[];
  /** Compte comme anecdote de Will (C52). */
  anecdote: boolean;
  pointDeVue?: PointDeVue;
  emotion?: Emotion;
  pilier?: string;
  familleAccroche?: TypeAccroche;
  expressionsApaisementRelance: string[];
  formuleException?: string;
  texteAppel?: string;
  finSurLeFait?: boolean;
}

const ETATS_DE_SERIE = new Set(["validee", "en-video", "programmee", "publiee"]);

/** Les `n` derniers sujets de la série d'un réseau, du plus ancien au plus récent. */
export function historiqueSerie(entrees: EntreesSerie, reseau: ReseauDeclinaison, n: number): ElementSerie[] {
  const elements: ElementSerie[] = [];
  const courantes = versionsCourantes(entrees.variantes).filter((v) => v.reseau === reseau);
  for (const m of entrees.maitres) {
    if (m.archiveLe || m.etat === "echec") continue;
    const siennes = courantes.filter((v) => v.scriptMaitreId === m.id);
    const dansSerie = siennes.filter((v) => ETATS_DE_SERIE.has(etatReseau(v, entrees.videos?.find((x) => x.varianteId === v.id) ?? null, entrees.publications ?? [])));
    const reserve = !dansSerie.length && m.etat === "en-ecriture" && !!m.choix && m.brief.reseaux.includes(reseau);
    if (!dansSerie.length && !reserve) continue;
    const pubs = (entrees.publications ?? []).filter(
      (p) => p.via !== "simulation" && p.reseau === reseau && (p.statut === "programmee" || p.statut === "publiee") && dansSerie.some((v) => p.varianteId === v.id || entrees.videos?.some((x) => x.varianteId === v.id && x.id === p.videoId)),
    );
    const validations = dansSerie.map((v) => v.avisWill?.le ?? v.caracteristiques?.figeeLe ?? v.modifieLe).sort();
    const [date, origineDate]: [DateIso, ElementSerie["origineDate"]] = pubs.length
      ? [pubs.map((p) => p.date).sort()[0], "programmation"]
      : validations.length
        ? [validations[0], "validation"]
        : [m.creeLe, "lancement"];
    const fiche = dansSerie.find((v) => v.caracteristiques)?.caracteristiques;
    const ancrages = m.choix?.ancrages ?? m.ancrages;
    elements.push({
      scriptMaitreId: m.id,
      numero: m.numero,
      reserve,
      date,
      origineDate,
      formatIds: [...new Set(dansSerie.map((v) => v.formatId))],
      structure: fiche?.structure ?? m.choix?.structure,
      typesAncrage: ancrages.map((a) => a.type),
      matiereIds: ancrages.map((a) => a.matiereId),
      anecdote: fiche?.anecdoteWill ?? ancrages.some((a) => a.type === "anecdote-will"),
      pointDeVue: fiche?.pointDeVue ?? m.pointDeVue ?? m.choix?.pointDeVue,
      emotion: fiche?.emotion ?? m.emotion ?? m.choix?.emotion,
      pilier: fiche?.pilier ?? m.choix?.pilier ?? m.brief.pilier,
      familleAccroche: fiche?.familleAccroche,
      expressionsApaisementRelance: fiche?.expressionsApaisementRelance ?? [],
      formuleException: fiche?.formuleException,
      texteAppel: fiche?.texteAppel,
      finSurLeFait: fiche?.finSurLeFait,
    });
  }
  elements.sort((a, b) => a.date.localeCompare(b.date));
  return elements.slice(-n);
}

/** Part d'anecdotes de Will sur une série (C52, plafond `variete.partAnecdoteMax`). */
export function partAnecdote(serie: Pick<ElementSerie, "anecdote">[]): number {
  return serie.length ? serie.filter((e) => e.anecdote).length / serie.length : 0;
}
