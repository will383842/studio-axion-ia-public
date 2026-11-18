// T-EXT-01 : scénario de parcours d'une maquette, schéma `scenario-maquette.v1` et lecteur strict.
// Pur : aucune lecture de disque, aucun navigateur, aucun appel, aucun réglage. Rien ne l'importe en production.
// Le scénario dit ce que la maquette doit faire à chaque étape ; il ne porte AUCUNE durée (elle vient de la voix mesurée).
import type { ZonePct } from "./artefacts-retouche";
import { ETAPES_MAX, LIBELLE_MAX } from "./etapes-tutoriel";

export const VERSION_SCENARIO_MAQUETTE = "scenario-maquette.v1";

export const ROLES_ETAPE_SCENARIO = ["accroche", "probleme", "parcours", "bonne-pratique", "mise-en-garde", "appel"] as const;
export type RoleEtapeScenario = (typeof ROLES_ETAPE_SCENARIO)[number];

export type AncreEtape = { surMot: string; occurrence?: number } | { apresEtape: string; delaiMs: number };

export interface EtapeScenario {
  id: string;
  role: RoleEtapeScenario;
  /** Argument de `window.demoMaquette.aller`. */
  aller: string;
  /** Sélecteur CSS de l'élément montré. */
  cible?: string;
  zone?: ZonePct;
  ancre: AncreEtape;
  /** ≤ LIBELLE_MAX caractères. */
  annotation?: string;
  masques?: ZonePct[];
  /** Textes portés par la maquette à cette étape (pour la garde des chiffres G4-03). */
  textesEcran?: string[];
}

export interface ScenarioMaquette {
  version: typeof VERSION_SCENARIO_MAQUETTE;
  /** Ex. « 05-stocks ». */
  maquette: string;
  largeur: number;
  hauteur: number;
  etapes: EtapeScenario[];
}

export type LectureScenarioMaquette = { ok: true; scenario: ScenarioMaquette } | { ok: false; erreurs: string[] };

const DIM_MIN = 320;
const DIM_MAX = 4096;

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const texte = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const nombre = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function champsInconnus(o: Record<string, unknown>, permis: readonly string[], lieu: string, erreurs: string[]): void {
  for (const k of Object.keys(o)) if (!permis.includes(k)) erreurs.push(`${lieu} : champ inconnu « ${k} ».`);
}

function lireZone(v: unknown, lieu: string, erreurs: string[]): ZonePct | undefined {
  if (!estObjet(v)) {
    erreurs.push(`${lieu} : doit être un objet { x, y, largeur, hauteur }.`);
    return undefined;
  }
  const avant = erreurs.length;
  champsInconnus(v, ["x", "y", "largeur", "hauteur"], lieu, erreurs);
  for (const k of ["x", "y", "largeur", "hauteur"] as const) {
    if (!nombre(v[k]) || v[k] < 0 || v[k] > 100) erreurs.push(`${lieu} : « ${k} » doit être un nombre entre 0 et 100.`);
  }
  if (erreurs.length > avant) return undefined;
  const z = v as unknown as ZonePct;
  if (z.x + z.largeur > 100 || z.y + z.hauteur > 100) {
    erreurs.push(`${lieu} : la zone dépasse 100 %.`);
    return undefined;
  }
  return { x: z.x, y: z.y, largeur: z.largeur, hauteur: z.hauteur };
}

function lireAncre(v: unknown, lieu: string, erreurs: string[]): AncreEtape | undefined {
  if (!estObjet(v)) {
    erreurs.push(`${lieu} : l'ancre est obligatoire (surMot ou apresEtape).`);
    return undefined;
  }
  if ("surMot" in v) {
    champsInconnus(v, ["surMot", "occurrence"], `${lieu} (ancre)`, erreurs);
    if (!texte(v.surMot)) {
      erreurs.push(`${lieu} : « surMot » doit être un texte non vide.`);
      return undefined;
    }
    if (v.occurrence !== undefined && (!Number.isInteger(v.occurrence) || (v.occurrence as number) < 1)) {
      erreurs.push(`${lieu} : « occurrence » doit être un entier ≥ 1.`);
      return undefined;
    }
    return v.occurrence === undefined ? { surMot: v.surMot } : { surMot: v.surMot, occurrence: v.occurrence as number };
  }
  if ("apresEtape" in v) {
    champsInconnus(v, ["apresEtape", "delaiMs"], `${lieu} (ancre)`, erreurs);
    if (!texte(v.apresEtape)) {
      erreurs.push(`${lieu} : « apresEtape » doit être un identifiant non vide.`);
      return undefined;
    }
    if (!nombre(v.delaiMs) || v.delaiMs < 0) {
      erreurs.push(`${lieu} : « delaiMs » doit être un nombre ≥ 0.`);
      return undefined;
    }
    return { apresEtape: v.apresEtape, delaiMs: v.delaiMs };
  }
  erreurs.push(`${lieu} : l'ancre doit contenir « surMot » ou « apresEtape ».`);
  return undefined;
}

const CHAMPS_ETAPE = ["id", "role", "aller", "cible", "zone", "ancre", "annotation", "masques", "textesEcran"] as const;

function lireEtape(v: unknown, i: number, erreurs: string[]): EtapeScenario | undefined {
  const lieu = `Étape ${i + 1}`;
  if (!estObjet(v)) {
    erreurs.push(`${lieu} : doit être un objet.`);
    return undefined;
  }
  const avant = erreurs.length;
  champsInconnus(v, CHAMPS_ETAPE, lieu, erreurs);
  if (!texte(v.id)) erreurs.push(`${lieu} : « id » doit être un texte non vide.`);
  if (!ROLES_ETAPE_SCENARIO.includes(v.role as RoleEtapeScenario)) {
    erreurs.push(`${lieu} : rôle inconnu (attendu : ${ROLES_ETAPE_SCENARIO.join(", ")}).`);
  }
  if (!texte(v.aller)) erreurs.push(`${lieu} : « aller » doit être un texte non vide.`);
  if (v.cible !== undefined && !texte(v.cible)) erreurs.push(`${lieu} : la cible ne doit pas être vide.`);
  if (v.annotation !== undefined) {
    if (typeof v.annotation !== "string") erreurs.push(`${lieu} : l'annotation doit être un texte.`);
    else if (v.annotation.length > LIBELLE_MAX) erreurs.push(`${lieu} : l'annotation dépasse ${LIBELLE_MAX} caractères.`);
  }
  const zone = v.zone === undefined ? undefined : lireZone(v.zone, `${lieu} : zone`, erreurs);
  let masques: ZonePct[] | undefined;
  if (v.masques !== undefined) {
    if (!Array.isArray(v.masques)) erreurs.push(`${lieu} : « masques » doit être une liste.`);
    else {
      masques = [];
      v.masques.forEach((m, j) => {
        const z = lireZone(m, `${lieu} : masque ${j + 1}`, erreurs);
        if (z) masques!.push(z);
      });
    }
  }
  if (v.textesEcran !== undefined && (!Array.isArray(v.textesEcran) || v.textesEcran.some((t) => typeof t !== "string"))) {
    erreurs.push(`${lieu} : « textesEcran » doit être une liste de textes.`);
  }
  const ancre = lireAncre(v.ancre, lieu, erreurs);
  if (erreurs.length > avant || !ancre) return undefined;
  const e: EtapeScenario = { id: v.id as string, role: v.role as RoleEtapeScenario, aller: v.aller as string, ancre };
  if (v.cible !== undefined) e.cible = v.cible as string;
  if (zone) e.zone = zone;
  if (v.annotation !== undefined) e.annotation = v.annotation as string;
  if (masques) e.masques = masques;
  if (v.textesEcran !== undefined) e.textesEcran = [...(v.textesEcran as string[])];
  return e;
}

/** Lecture stricte : ne lève jamais, messages en français. */
export function lireScenarioMaquette(brut: unknown): LectureScenarioMaquette {
  const erreurs: string[] = [];
  try {
    if (!estObjet(brut)) return { ok: false, erreurs: ["Le scénario doit être un objet."] };
    champsInconnus(brut, ["version", "maquette", "largeur", "hauteur", "etapes"], "Scénario", erreurs);
    if (brut.version !== VERSION_SCENARIO_MAQUETTE) {
      erreurs.push(`Version inconnue : attendu « ${VERSION_SCENARIO_MAQUETTE} ».`);
    }
    if (!texte(brut.maquette)) erreurs.push("« maquette » doit être un texte non vide.");
    for (const k of ["largeur", "hauteur"] as const) {
      const d = brut[k];
      if (!nombre(d) || !Number.isInteger(d) || d < DIM_MIN || d > DIM_MAX) {
        erreurs.push(`« ${k} » doit être un entier entre ${DIM_MIN} et ${DIM_MAX}.`);
      }
    }
    const liste = brut.etapes;
    const etapes: EtapeScenario[] = [];
    if (!Array.isArray(liste) || liste.length === 0) erreurs.push("Il faut au moins une étape.");
    else if (liste.length > ETAPES_MAX) erreurs.push(`Trop d'étapes : ${ETAPES_MAX} au maximum.`);
    else {
      liste.forEach((v, i) => {
        const e = lireEtape(v, i, erreurs);
        if (e) etapes.push(e);
      });
      if (etapes.length === liste.length) {
        const rang = new Map<string, number>();
        etapes.forEach((e, i) => {
          if (rang.has(e.id)) erreurs.push(`Étape ${i + 1} : id « ${e.id} » en double.`);
          else rang.set(e.id, i);
        });
        etapes.forEach((e, i) => {
          if (!("apresEtape" in e.ancre)) return;
          const cible = rang.get(e.ancre.apresEtape);
          if (cible === undefined) erreurs.push(`Étape ${i + 1} : l'étape « ${e.ancre.apresEtape} » est absente.`);
          else if (cible >= i) erreurs.push(`Étape ${i + 1} : l'étape « ${e.ancre.apresEtape} » est postérieure ou identique.`);
        });
        if (!("surMot" in etapes[0]!.ancre)) erreurs.push("La première étape doit avoir une ancre « surMot ».");
        if (etapes[etapes.length - 1]!.role !== "appel") erreurs.push("La dernière étape doit avoir le rôle « appel ».");
      }
    }
    if (erreurs.length > 0) return { ok: false, erreurs };
    return {
      ok: true,
      scenario: {
        version: VERSION_SCENARIO_MAQUETTE,
        maquette: brut.maquette as string,
        largeur: brut.largeur as number,
        hauteur: brut.hauteur as number,
        etapes,
      },
    };
  } catch {
    return { ok: false, erreurs: ["Scénario illisible."] };
  }
}
