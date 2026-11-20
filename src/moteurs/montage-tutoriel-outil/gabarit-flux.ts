// T-EXT-50 · Gabarit G-Flux : une automatisation sans tableau de bord, filmée de bout en bout.
// PUR : aucune lecture de disque, aucun navigateur, aucun appel, aucun réglage. Ne lève jamais, messages en français.
// Le gabarit ne contient AUCUNE phrase : voix, libellés du schéma et contenus des écrans viennent du flux validé.
// Un libellé manquant est un refus, jamais une invention.
import { trouverNombres } from "../../domaine/nombres-fr";
import { ETAPES_MAX } from "./etapes-tutoriel";
import { VERSION_SCENARIO_MAQUETTE, type EtapeScenario, type RoleEtapeScenario, type ScenarioMaquette } from "./scenario-maquette";

export const VERSION_FLUX = "flux-automatisation.v1";
export const MOMENTS_MAX = 3;
export const LIBELLE_SCHEMA_MAX = 28;
export const MAQUETTE_FLUX = "ecrans-outils";
/** Format maître du tutoriel (4:5). */
export const DIMENSIONS_FLUX = Object.freeze({ largeur: 1080, hauteur: 1350 });

export const VUES_ECRANS = ["boite", "agenda", "tableur", "crm", "messagerie"] as const;
export type VueEcran = (typeof VUES_ECRANS)[number];

/** Copie de `outils/maquettes-tableaux-de-bord/ecrans-outils/etats.js` (T-EXT-49) ; un test d'égalité la garde. */
export const ETATS_PAR_VUE: Readonly<Record<VueEcran, readonly string[]>> = Object.freeze({
  boite: Object.freeze(["avant", "liste", "nouveau", "ouvert", "etiquete", "brouillon"]),
  agenda: Object.freeze(["semaine", "creneau-propose", "confirme"]),
  tableur: Object.freeze(["lignes", "ligne-ajoutee", "colonne-a-jour"]),
  crm: Object.freeze(["fiche-vide", "fiche-remplie", "etape-suivante"]),
  messagerie: Object.freeze(["fil", "notification", "tache-creee"]),
});

export const ACTEURS_FLUX = ["automatisation", "ia", "humain"] as const;
export type ActeurFlux = (typeof ACTEURS_FLUX)[number];

/** Écran filmé non numéroté du flux (avant, déclencheur, résultat) ; `surMot` : mot de la voix qui le déclenche. */
export interface EcranFlux {
  vue: VueEcran;
  etat: string;
  surMot: string;
}

export interface EtapeFlux {
  id: string;
  vue: VueEcran;
  etat: string;
  acteur: ActeurFlux;
  /** ≤ LIBELLE_SCHEMA_MAX caractères, écrit dans le dossier. */
  libelleSchema: string;
  surMot: string;
}

export interface FluxAutomatisation {
  version: typeof VERSION_FLUX;
  declencheur: EcranFlux;
  avant: EcranFlux;
  etapes: EtapeFlux[];
  /** Ids d'étapes, 3 au plus. */
  moments: string[];
  resultat: EcranFlux;
  /** Au format `DONNEES_ECRANS.contenus` de T-EXT-49, repris tel quel. */
  contenus: Record<string, unknown>;
}

export type LectureFlux = { ok: true; flux: FluxAutomatisation } | { ok: false; erreurs: string[] };

const IDS_RESERVES = ["avant", "declencheur", "resultat"] as const;
const FORME_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ARGENT = /[€$£]|\b(?:euros?|dollars?|livres?\s+sterling|eur|usd)\b/i;

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const texte = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

function champsInconnus(o: Record<string, unknown>, permis: readonly string[], lieu: string, erreurs: string[]): void {
  for (const k of Object.keys(o)) {
    if (k === "couleur" || k === "couleurs") erreurs.push(`${lieu} : les couleurs sont fixées par la charte, le flux n'en porte aucune.`);
    else if (!permis.includes(k)) erreurs.push(`${lieu} : champ inconnu « ${k} ».`);
  }
}

/** Vrai si le texte porte un montant d'argent (symbole, mot, ou nombre d'unité « € »). */
export function contientMontant(t: string): boolean {
  if (ARGENT.test(t)) return true;
  return trouverNombres(t).some((n) => n.unite === "€");
}

function textesDe(v: unknown, sortie: string[], profondeur = 0): void {
  if (profondeur > 12) return;
  if (typeof v === "string") sortie.push(v);
  else if (Array.isArray(v)) for (const x of v) textesDe(x, sortie, profondeur + 1);
  else if (estObjet(v)) for (const x of Object.values(v)) textesDe(x, sortie, profondeur + 1);
}

function jsonPur(v: unknown, profondeur = 0): boolean {
  if (profondeur > 12) return false;
  if (v === null || typeof v === "string" || typeof v === "boolean") return true;
  if (typeof v === "number") return Number.isFinite(v);
  if (Array.isArray(v)) return v.every((x) => jsonPur(x, profondeur + 1));
  if (estObjet(v)) return Object.values(v).every((x) => jsonPur(x, profondeur + 1));
  return false;
}

function lireVueEtat(v: Record<string, unknown>, lieu: string, erreurs: string[]): boolean {
  const vue = v.vue;
  if (typeof vue !== "string" || !(VUES_ECRANS as readonly string[]).includes(vue)) {
    erreurs.push(`${lieu} : vue inconnue (attendu : ${VUES_ECRANS.join(", ")}).`);
    return false;
  }
  const etats = ETATS_PAR_VUE[vue as VueEcran];
  if (typeof v.etat !== "string" || !etats.includes(v.etat)) {
    erreurs.push(`${lieu} : état « ${String(v.etat)} » non permis pour la vue « ${vue} » (attendu : ${etats.join(", ")}).`);
    return false;
  }
  return true;
}

function lireEcran(v: unknown, lieu: string, erreurs: string[]): EcranFlux | undefined {
  if (!estObjet(v)) {
    erreurs.push(`${lieu} : doit être un objet { vue, etat, surMot }.`);
    return undefined;
  }
  const avant = erreurs.length;
  champsInconnus(v, ["vue", "etat", "surMot"], lieu, erreurs);
  lireVueEtat(v, lieu, erreurs);
  if (!texte(v.surMot)) erreurs.push(`${lieu} : « surMot » doit être un texte non vide.`);
  if (erreurs.length > avant) return undefined;
  return { vue: v.vue as VueEcran, etat: v.etat as string, surMot: v.surMot as string };
}

function lireEtapeFlux(v: unknown, i: number, erreurs: string[]): EtapeFlux | undefined {
  const lieu = `Étape ${i + 1}`;
  if (!estObjet(v)) {
    erreurs.push(`${lieu} : doit être un objet.`);
    return undefined;
  }
  const avant = erreurs.length;
  champsInconnus(v, ["id", "vue", "etat", "acteur", "libelleSchema", "surMot"], lieu, erreurs);
  if (!texte(v.id) || !FORME_ID.test(v.id)) erreurs.push(`${lieu} : « id » en minuscules sans accent (lettres, chiffres, tirets).`);
  else if ((IDS_RESERVES as readonly string[]).includes(v.id)) erreurs.push(`${lieu} : l'id « ${v.id} » est réservé.`);
  lireVueEtat(v, lieu, erreurs);
  if (!(ACTEURS_FLUX as readonly string[]).includes(v.acteur as string)) erreurs.push(`${lieu} : acteur inconnu (attendu : ${ACTEURS_FLUX.join(", ")}).`);
  if (!texte(v.libelleSchema)) erreurs.push(`${lieu} : le libellé du schéma est obligatoire (écrit dans le dossier, jamais inventé).`);
  else if (v.libelleSchema.length > LIBELLE_SCHEMA_MAX) erreurs.push(`${lieu} : le libellé du schéma dépasse ${LIBELLE_SCHEMA_MAX} caractères.`);
  if (!texte(v.surMot)) erreurs.push(`${lieu} : « surMot » doit être un texte non vide.`);
  if (erreurs.length > avant) return undefined;
  return { id: v.id as string, vue: v.vue as VueEcran, etat: v.etat as string, acteur: v.acteur as ActeurFlux, libelleSchema: v.libelleSchema as string, surMot: v.surMot as string };
}

const estListe = (v: unknown): v is unknown[] => Array.isArray(v);
const estListeDe = (v: unknown, champs: readonly string[]): boolean =>
  estListe(v) && v.every((x) => estObjet(x) && champs.every((c) => texte(x[c])));
const estListeDeListes = (v: unknown): boolean => estListe(v) && v.every((x) => estObjet(x) && estListe(x.cellules));

/**
 * Champs que `app.js` du bureau exemple (T-EXT-49) lit pour une vue et un état : une vue utilisée sans eux
 * ferait planter la capture. Renvoie les chemins manquants ou mal formés (vide si tout y est).
 */
export function champsContenusManquants(vue: VueEcran, etat: string, c: unknown): string[] {
  if (!estObjet(c)) return ["entrée absente"];
  const m: string[] = [];
  const exige = (chemin: string, ok: boolean) => {
    if (!ok) m.push(chemin);
  };
  if (vue === "boite") {
    exige("messages", estListeDe(c.messages, ["id", "de", "objet"]));
    exige("nouveau", texte(c.nouveau));
    const msgs = estListe(c.messages) ? (c.messages as Record<string, unknown>[]) : [];
    const nouveau = msgs.find((x) => estObjet(x) && x.id === c.nouveau);
    if (texte(c.nouveau) && estListe(c.messages)) exige("messages (le message « nouveau » est introuvable)", nouveau !== undefined);
    if (etat === "ouvert" || etat === "brouillon") exige("messages[nouveau] : adresse et corps", !!nouveau && texte(nouveau.adresse) && texte(nouveau.corps));
    if (etat !== "avant" && etat !== "ouvert" && etat !== "brouillon") exige("dossiers", estListeDe(c.dossiers, ["id", "nom"]));
    if (etat === "etiquete") exige("messages[nouveau].dossier", !!nouveau && texte(nouveau.dossier));
    if (etat === "brouillon") exige("brouillon.texte", estObjet(c.brouillon) && texte(c.brouillon.texte));
  } else if (vue === "agenda") {
    exige("jours", estListeDe(c.jours, ["id", "nom"]));
    exige("evenements", estListeDe(c.evenements, ["jour", "heure", "titre"]));
    if (etat !== "semaine") exige("creneau", estObjet(c.creneau) && ["jour", "heure", "titre"].every((k) => texte((c.creneau as Record<string, unknown>)[k])));
  } else if (vue === "tableur") {
    exige("colonnes", estListe(c.colonnes));
    exige("lignes", estListeDeListes(c.lignes));
    if (etat !== "lignes") exige("nouvelleLigne.cellules", estObjet(c.nouvelleLigne) && estListe(c.nouvelleLigne.cellules));
    if (etat === "colonne-a-jour") exige("statut", estObjet(c.statut) && typeof c.statut.ligne === "number" && typeof c.statut.colonne === "number" && texte(c.statut.apres));
  } else if (vue === "crm") {
    exige("etapes", estListeDe(c.etapes, ["nom"]));
    exige("fiche", estObjet(c.fiche) && texte(c.fiche.titre) && estListeDe(c.fiche.champs, ["libelle", "valeur"]));
    const rang = (typeof c.etapeDepart === "number" ? c.etapeDepart : -1) + (etat === "etape-suivante" ? 1 : 0);
    exige("etapeDepart (doit désigner une étape existante)", estListe(c.etapes) && Number.isInteger(rang) && rang >= 0 && rang < c.etapes.length);
  } else {
    exige("fil", estListeDe(c.fil, ["de", "texte"]));
    if (etat === "notification") exige("notification", estObjet(c.notification) && texte(c.notification.de) && texte(c.notification.texte));
    if (etat === "tache-creee") exige("tache", estObjet(c.tache) && texte(c.tache.titre) && texte(c.tache.responsable));
  }
  return m;
}

/** Lecture stricte du flux d'automatisation : ne lève jamais. */
export function lireFluxAutomatisation(brut: unknown): LectureFlux {
  const erreurs: string[] = [];
  try {
    if (!estObjet(brut)) return { ok: false, erreurs: ["Le flux doit être un objet."] };
    champsInconnus(brut, ["version", "declencheur", "avant", "etapes", "moments", "resultat", "contenus"], "Flux", erreurs);
    if (brut.version !== VERSION_FLUX) erreurs.push(`Version inconnue : attendu « ${VERSION_FLUX} ».`);
    const avant = lireEcran(brut.avant, "Avant", erreurs);
    const declencheur = lireEcran(brut.declencheur, "Déclencheur", erreurs);
    const resultat = lireEcran(brut.resultat, "Résultat", erreurs);

    const etapes: EtapeFlux[] = [];
    if (!Array.isArray(brut.etapes) || brut.etapes.length < 2) erreurs.push("Le flux a besoin d'au moins 2 étapes.");
    else {
      // L'avant, le déclencheur et le résultat sont aussi filmés : ils comptent dans le plafond de la maquette.
      if (brut.etapes.length + 3 > ETAPES_MAX) erreurs.push(`Trop d'étapes : ${ETAPES_MAX} écrans filmés au plus, avant, déclencheur et résultat compris.`);
      else {
        brut.etapes.forEach((v, i) => {
          const e = lireEtapeFlux(v, i, erreurs);
          if (e) etapes.push(e);
        });
      }
    }
    const ids = new Set<string>();
    for (const e of etapes) {
      if (ids.has(e.id)) erreurs.push(`Id d'étape « ${e.id} » en double.`);
      ids.add(e.id);
    }

    let moments: string[] = [];
    if (!Array.isArray(brut.moments) || brut.moments.some((m) => typeof m !== "string")) erreurs.push("« moments » doit être une liste d'identifiants d'étapes.");
    else {
      moments = [...(brut.moments as string[])];
      if (moments.length > MOMENTS_MAX) erreurs.push(`Trop de moments « ça change tout » : ${MOMENTS_MAX} au plus.`);
      for (const m of moments) if (!ids.has(m) && etapes.length === (brut.etapes as unknown[]).length) erreurs.push(`Le moment « ${m} » ne désigne aucune étape.`);
    }

    if (!estObjet(brut.contenus) || !jsonPur(brut.contenus)) erreurs.push("« contenus » doit être un objet de données simples (format de `DONNEES_ECRANS.contenus`).");
    else {
      // Chaque écran filmé doit pouvoir être dessiné : la vue utilisée a son entrée `contenus[vue]` complète pour l'état voulu.
      const utilises: { lieu: string; vue: VueEcran; etat: string }[] = [
        ...(avant ? [{ lieu: "Avant", ...avant }] : []),
        ...(declencheur ? [{ lieu: "Déclencheur", ...declencheur }] : []),
        ...etapes.map((e) => ({ lieu: `Étape « ${e.id} »`, vue: e.vue, etat: e.etat })),
        ...(resultat ? [{ lieu: "Résultat", ...resultat }] : []),
      ];
      const vusSansEntree = new Set<string>();
      for (const u of utilises) {
        if (!estObjet(brut.contenus[u.vue])) {
          if (!vusSansEntree.has(u.vue)) erreurs.push(`« contenus » : la vue « ${u.vue} » est utilisée (${u.lieu}) mais son entrée « contenus.${u.vue} » est absente.`);
          vusSansEntree.add(u.vue);
          continue;
        }
        const manque = champsContenusManquants(u.vue, u.etat, brut.contenus[u.vue]);
        if (manque.length > 0) erreurs.push(`« contenus.${u.vue} » incomplet pour l'état « ${u.etat} » (${u.lieu}) : ${manque.join(", ")}.`);
      }
    }

    if (etapes.length > 0 && etapes.length === (brut.etapes as unknown[]).length) {
      const aUnHumain = etapes.some((e) => e.acteur === "humain");
      if (!aUnHumain) erreurs.push("Le flux doit montrer où une personne contrôle et décide.");
      // Un envoi au client : une étape automatique de la boîte après un brouillon, sans étape humaine entre les deux.
      let brouillonSansHumain = false;
      for (const e of aUnHumain ? etapes : []) {
        if (e.acteur === "humain") brouillonSansHumain = false;
        else if (brouillonSansHumain && e.vue === "boite") {
          erreurs.push(`Étape « ${e.id} » : un envoi au client doit passer par une étape humaine après le brouillon.`);
          break;
        }
        if (e.vue === "boite" && e.etat === "brouillon" && e.acteur !== "humain") brouillonSansHumain = true;
      }
    }

    const tous: string[] = [];
    textesDe({ avant: brut.avant, declencheur: brut.declencheur, etapes: brut.etapes, resultat: brut.resultat, contenus: brut.contenus }, tous);
    if (tous.some(contientMontant)) erreurs.push("Aucun montant d'argent à l'écran : retirez-le du flux (écrivez « selon votre grille »).");

    if (erreurs.length > 0 || !avant || !declencheur || !resultat) return { ok: false, erreurs: erreurs.length > 0 ? erreurs : ["Flux illisible."] };
    return { ok: true, flux: { version: VERSION_FLUX, declencheur, avant, etapes, moments, resultat, contenus: brut.contenus as Record<string, unknown> } };
  } catch {
    return { ok: false, erreurs: ["Flux illisible."] };
  }
}

/** Écrans filmés dans l'ordre : avant, déclencheur, étapes, résultat (identifiants fixes pour les trois premiers et le dernier). */
function ecransFilmes(flux: FluxAutomatisation): { id: string; vue: VueEcran; etat: string; surMot: string }[] {
  return [
    { id: "avant", ...flux.avant },
    { id: "declencheur", ...flux.declencheur },
    ...flux.etapes.map((e) => ({ id: e.id, vue: e.vue, etat: e.etat, surMot: e.surMot })),
    { id: "resultat", ...flux.resultat },
  ];
}

/** Scénario de maquette (T-EXT-01) : une étape par écran filmé, ancres `surMot` reprises telles quelles. */
export function scenarioDepuisFlux(flux: FluxAutomatisation): ScenarioMaquette {
  const ecrans = ecransFilmes(flux);
  const dernier = ecrans.length - 1;
  const etapes: EtapeScenario[] = ecrans.map((e, i) => {
    // Le lecteur de T-EXT-01 exige « appel » en dernière étape : le résultat la porte (il n'y a pas de rôle « bonne-pratique » à la fin).
    const role: RoleEtapeScenario = i === 0 ? "accroche" : i === 1 ? "probleme" : i === dernier ? "appel" : "parcours";
    return { id: e.id, role, aller: e.id, ancre: { surMot: e.surMot } };
  });
  return { version: VERSION_SCENARIO_MAQUETTE, maquette: MAQUETTE_FLUX, largeur: DIMENSIONS_FLUX.largeur, hauteur: DIMENSIONS_FLUX.hauteur, etapes };
}

/** Texte exact du `demo-data.js` de la copie par vidéo : aucun mot ajouté, contenus repris tels quels. */
export function donneesEcransDepuisFlux(flux: FluxAutomatisation): string {
  const etapes = ecransFilmes(flux).map((e) => ({ id: e.id, vue: e.vue, etat: e.etat }));
  const donnees = { version: 1, etapes, contenus: flux.contenus };
  return `window.DONNEES_ECRANS = ${JSON.stringify(donnees, null, 2)};\n`;
}

/* ------------------------------------------------------------------ */
/* Trame : parts de la durée de la voix                                */
/* ------------------------------------------------------------------ */

export const VOIX_MIN_MS = 40_000;
export const VOIX_MAX_MS = 55_000;
export const SCHEMA_MS = 6_500;
const PART_AVANT = 0.12;
const PART_FLUX = 0.55;

export interface TrameGFlux {
  avantMs: number;
  fluxMs: number;
  schemaMs: number;
  gainFinMs: number;
  /** Instants de début (ms) : avant, flux filmé, schéma, gain et fin. */
  debuts: { avant: number; flux: number; schema: number; gainFin: number };
}

export type LectureTrame = { ok: true; trame: TrameGFlux; remarques: string[] } | { ok: false; erreurs: string[] };

/**
 * Avant ≤ 15 %, flux filmé ≥ 50 %, schéma de 5 à 8 s (≤ 20 %), gain et fin le reste.
 * Une durée hors de 40 à 55 s n'est JAMAIS un refus (décision de Williams du 18/11) : la trame est calculée avec les mêmes parts
 * et une remarque l'accompagne. Seule une durée illisible (NaN, ≤ 0) est refusée.
 */
export function trameGFlux(dureeVoixMs: number): LectureTrame {
  if (typeof dureeVoixMs !== "number" || !Number.isFinite(dureeVoixMs) || dureeVoixMs <= 0) return { ok: false, erreurs: ["La durée de la voix est inconnue."] };
  const remarques: string[] = [];
  if (dureeVoixMs < VOIX_MIN_MS) remarques.push(`La voix fait moins de ${VOIX_MIN_MS / 1000} s : le flux a peu de place pour se montrer.`);
  if (dureeVoixMs > VOIX_MAX_MS) remarques.push(`La voix fait plus de ${VOIX_MAX_MS / 1000} s : vous pouvez raccourcir le script.`);
  const avantMs = Math.round(dureeVoixMs * PART_AVANT);
  const fluxMs = Math.round(dureeVoixMs * PART_FLUX);
  const schemaMs = SCHEMA_MS;
  const gainFinMs = dureeVoixMs - avantMs - fluxMs - schemaMs;
  if (schemaMs < 5000 || schemaMs > 0.2 * dureeVoixMs) remarques.push("Le schéma ne tient pas dans cette durée : il dure plus de 20 % de la voix.");
  if (gainFinMs <= 0) remarques.push("Il ne reste pas de place pour le gain et la fin : allongez la voix.");
  return {
    ok: true,
    trame: { avantMs, fluxMs, schemaMs, gainFinMs, debuts: { avant: 0, flux: avantMs, schema: avantMs + fluxMs, gainFin: avantMs + fluxMs + schemaMs } },
    remarques,
  };
}
