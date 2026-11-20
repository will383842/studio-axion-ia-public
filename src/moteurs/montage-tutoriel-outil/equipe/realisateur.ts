/**
 * RÉALISATEUR du tutoriel (T-EXT-22) — PUR, règles seules, 0 €, aucun appel ; rien ne l'appelle (le branchement est
 * la fiche d'intégration des rôles).
 *
 * Il remplit un gabarit éprouvé (G-Journée, G-Décision, G-Réponse) avec le script choisi : UNE phrase = UN geste, servie
 * par une étape de la maquette ou par un plan dessiné. Aucune durée (elle vient de la voix mesurée, T-EXT-02), aucune
 * annotation (le Studio n'écrit jamais une phrase non choisie : tout texte à l'écran passe par le registre validé).
 * La caméra (facteur de zoom, curseur) est celle de T-EXT-38 ; le contrôle d'image fixe sur durées réelles, T-EXT-23.
 */
import { ZOOM_NAVIGATION_MAX } from "@/briques/plan-scenes/tutoriel/navigation-filmee";
import { fnv1a64, jsonCanonique } from "@/briques/plan-scenes/empreinte";
import type { ZonePct } from "../artefacts-retouche";
import { ETAPES_MAX } from "../etapes-tutoriel";
import { lireScenarioMaquette, VERSION_SCENARIO_MAQUETTE, type EtapeScenario, type ScenarioMaquette } from "../scenario-maquette";
import type { CarteZones, ZoneCarte } from "./analyste";
import type { CahierVideo, IdGabarit } from "./chef-de-projet";
import { gabaritParId } from "./gabarits";
import type { Gabarit, GesteParcours, SegmentGabarit, Temps } from "./gabarits/types";
import type { PhraseChoisie, ScriptChoisi } from "./scenariste";
import type { FicheValeur } from "./strategie-valeur";

export const VERSION_PARCOURS = "parcours-tutoriel.v1" as const;

export type MontrePlanDessine = "avant-dessine" | "conversation" | "schema-flux";

export interface PlanDessine {
  phraseIndex: number;
  montre: MontrePlanDessine;
  zoneId?: string;
}

export interface GesteDePhrase {
  /** Id de l'étape de maquette, ou `dessin-<n>` pour un plan dessiné. */
  etapeId: string;
  phraseIndex: number;
  geste: GesteParcours;
  zoom?: { zone: ZonePct; facteur: number };
}

export interface ParcoursTutoriel {
  version: typeof VERSION_PARCOURS;
  gabarits: IdGabarit[];
  scenario: ScenarioMaquette;
  plansDessines: PlanDessine[];
  gestes: GesteDePhrase[];
  empreinte: string;
}

export interface EntreeRealisateur {
  cahier: CahierVideo;
  carte: CarteZones;
  fiche: FicheValeur;
  script: ScriptChoisi;
  largeur: number;
  hauteur: number;
}

export type ResultatRealisateur = { ok: true; parcours: ParcoursTutoriel; remarques: string[] } | { ok: false; erreurs: string[] };

const MOT_PLEIN_MIN = 4;

/**
 * Copie locale de `normaliser` de `calage-scenario.ts` (non exportée, fichier en import seulement) : minuscules, sans
 * accents, sans ponctuation de bord. Les mots du script se découpent sur les espaces, comme ceux de la voix : « L'équipe »
 * reste « l'equipe ». À garder identique à l'original.
 */
function normaliser(t: string): string {
  return t
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

const motsDe = (t: string): string[] => t.split(/\s+/).map(normaliser).filter((m) => m.length > 0);

/** Zone dans le champ (0-100), de largeur et de hauteur non nulles. */
function dansLeChamp(z: ZonePct): boolean {
  const n = [z.x, z.y, z.largeur, z.hauteur];
  if (n.some((v) => typeof v !== "number" || !Number.isFinite(v))) return false;
  return z.x >= 0 && z.y >= 0 && z.largeur > 0 && z.hauteur > 0 && z.x + z.largeur <= 100 && z.y + z.hauteur <= 100;
}

/** Refus nommé si la zone est hors champ ou illisible même zoomée ; sinon `null`. */
function refusZone(z: ZonePct | undefined, id: string, g: Gabarit): string | null {
  if (!z) return null;
  if (!dansLeChamp(z)) return `Zone ${id} hors champ : elle doit rester dans l'image (0 à 100 %, largeur et hauteur non nulles).`;
  if (z.largeur * ZOOM_NAVIGATION_MAX < g.lisibilite.largeurZoomeeMinPct) {
    return `Zone ${id} : zone trop petite pour être lisible, même zoomée.`;
  }
  return null;
}

function facteurZoom(z: ZonePct): number {
  return Math.max(1, Math.min(ZOOM_NAVIGATION_MAX, 100 / z.largeur, 100 / z.hauteur));
}

/** Premier mot plein de chaque phrase et son rang d'apparition dans TOUT le script. */
function ancresDuScript(phrases: readonly PhraseChoisie[]): ({ surMot: string; occurrence: number } | null)[] {
  const vus = new Map<string, number>();
  return phrases.map((p) => {
    let ancre: { surMot: string; occurrence: number } | null = null;
    for (const m of motsDe(p.texte)) {
      const n = (vus.get(m) ?? 0) + 1;
      vus.set(m, n);
      if (!ancre && [...m].length >= MOT_PLEIN_MIN) ancre = { surMot: m, occurrence: n };
    }
    return ancre;
  });
}

function segmentDe(sequence: readonly SegmentGabarit[], temps: Temps): SegmentGabarit | undefined {
  return sequence.find((s) => s.temps === temps);
}

function premierGeste(permis: readonly GesteParcours[], voulu?: readonly GesteParcours[]): GesteParcours | undefined {
  return permis.find((g) => !voulu || voulu.includes(g));
}

export function realiser(e: EntreeRealisateur): ResultatRealisateur {
  try {
    return realiserSansGarde(e);
  } catch {
    return { ok: false, erreurs: ["Parcours impossible à établir : entrée illisible."] };
  }
}

function realiserSansGarde(e: EntreeRealisateur): ResultatRealisateur {
  const erreurs: string[] = [];
  const remarques: string[] = [];

  // Gabarits : tous présents au registre (G-Flux : T-EXT-50), cas compatible.
  const gabarits: Gabarit[] = [];
  for (const id of e.cahier.gabarits) {
    const g = gabaritParId(id);
    if (!g) erreurs.push(`Gabarit ${id} pas encore disponible (T-EXT-50) : rien n'a échoué.`);
    else {
      if (!g.cas.includes(e.cahier.cas)) erreurs.push(`Gabarit ${id} : il ne sert pas le cas ${e.cahier.cas}.`);
      gabarits.push(g);
    }
  }
  if (e.cahier.gabarits.length === 0) erreurs.push("Le cahier ne désigne aucun gabarit.");
  if (erreurs.length > 0) return { ok: false, erreurs };
  const sequence = gabarits.flatMap((g) => [...g.sequence]);
  const gabaritLisible = gabarits[gabarits.length - 1]!;

  const phrases = e.script.phrases;
  if (phrases.length === 0) return { ok: false, erreurs: ["Le script choisi ne contient aucune phrase."] };
  const ancres = ancresDuScript(phrases);
  const zones = new Map<string, ZoneCarte>(e.carte.zones.map((z) => [z.id, z]));
  const zonesAvant = e.carte.zones.filter((z) => z.etat === "avant" || z.etat === "les-deux");

  const etapes: EtapeScenario[] = [];
  const plansDessines: PlanDessine[] = [];
  const gestes: GesteDePhrase[] = [];
  let temps: Temps = "situation";
  let situations = 0;
  let derniereZone: ZoneCarte | undefined;

  const ajouterEtape = (i: number, role: EtapeScenario["role"], z: ZoneCarte | undefined, aller: string, avecZone: boolean): EtapeScenario | null => {
    const ancre = ancres[i];
    if (!ancre) {
      erreurs.push(`Phrase ${i + 1} : aucun mot de ${MOT_PLEIN_MIN} lettres ou plus pour ancrer le geste sur la voix.`);
      return null;
    }
    const et: EtapeScenario = { id: `e${etapes.length + 1}`, role, aller, ancre: { surMot: ancre.surMot, occurrence: ancre.occurrence } };
    if (z && avecZone) {
      et.cible = z.cible;
      if (z.zone) et.zone = { ...z.zone };
    }
    // Même étape que la précédente (même rôle, même aller, même cible, même zone) : la phrase la réutilise.
    const prec = etapes[etapes.length - 1];
    if (prec && prec.role === et.role && prec.aller === et.aller && prec.cible === et.cible && JSON.stringify(prec.zone) === JSON.stringify(et.zone)) return prec;
    etapes.push(et);
    return et;
  };

  phrases.forEach((p, i) => {
    const n = i + 1;
    if (p.temps) temps = p.temps;
    else if (i > 0) remarques.push(`Phrase ${n} : temps non indiqué, repris de la phrase précédente (${temps}).`);
    const seg = segmentDe(sequence, temps);
    if (!seg) {
      erreurs.push(`Phrase ${n} : le gabarit n'a pas de segment « ${temps} ».`);
      return;
    }

    if (temps === "situation") {
      const aMaquette = seg.montre.includes("avant-maquette") && zonesAvant.length > 0;
      const geste = premierGeste(seg.gestes);
      if (!geste) return void erreurs.push(`Phrase ${n} : aucun geste permis pour la situation.`);
      if (aMaquette) {
        const z = zonesAvant[Math.min(situations, zonesAvant.length - 1)]!;
        const r = refusZone(z.zone, z.id, gabaritLisible);
        if (r) return void erreurs.push(`Phrase ${n} : ${r}`);
        const et = ajouterEtape(i, situations === 0 ? "accroche" : "probleme", z, z.aller, true);
        if (et) gestes.push({ etapeId: et.id, phraseIndex: i, geste });
      } else {
        plansDessines.push({ phraseIndex: i, montre: "avant-dessine" });
        gestes.push({ etapeId: `dessin-${n}`, phraseIndex: i, geste });
      }
      situations += 1;
      return;
    }

    if (temps === "changement") {
      const zoneId = p.zoneId ?? (p.momentId ? e.fiche.moments.find((m) => m.id === p.momentId)?.zoneId : undefined);
      if (!zoneId) return void erreurs.push(`Phrase ${n} : aucune zone indiquée pour ce geste.`);
      const z = zones.get(zoneId);
      if (!z) return void erreurs.push(`Phrase ${n} : la zone ${zoneId} n'existe pas dans la carte.`);
      if (z.message && seg.montre.includes("conversation")) {
        const geste = premierGeste(seg.gestes);
        if (!geste) return void erreurs.push(`Phrase ${n} : aucun geste permis pour la conversation.`);
        plansDessines.push({ phraseIndex: i, montre: "conversation", zoneId: z.id });
        gestes.push({ etapeId: `dessin-${n}`, phraseIndex: i, geste });
        return;
      }
      const r = refusZone(z.zone, z.id, gabaritLisible);
      if (r) return void erreurs.push(`Phrase ${n} : ${r}`);
      const geste = premierGeste(seg.gestes, z.gestes);
      if (!geste) return void erreurs.push(`Phrase ${n} : aucun geste permis sur la zone ${z.id}.`);
      const et = ajouterEtape(i, "parcours", z, z.aller, true);
      if (!et) return;
      derniereZone = z;
      gestes.push({ etapeId: et.id, phraseIndex: i, geste, ...(geste === "zoom" && z.zone ? { zoom: { zone: { ...z.zone }, facteur: facteurZoom(z.zone) } } : {}) });
      return;
    }

    // gain : vue d'ensemble de la maquette (zoom arrière). Le rôle « appel » est imposé par le scénario ; il ne fait rien dire.
    const geste = premierGeste(seg.gestes);
    if (!geste) return void erreurs.push(`Phrase ${n} : aucun geste permis pour le gain.`);
    const base = derniereZone ?? e.carte.zones[0];
    if (!base) return void erreurs.push(`Phrase ${n} : la carte n'a aucune zone.`);
    const et = ajouterEtape(i, "appel", base, base.aller, false);
    if (et) gestes.push({ etapeId: et.id, phraseIndex: i, geste, ...(geste === "zoom" ? { zoom: { zone: { x: 0, y: 0, largeur: 100, hauteur: 100 }, facteur: 1 } } : {}) });
  });

  if (erreurs.length > 0) return { ok: false, erreurs };
  if (etapes.length > ETAPES_MAX) return { ok: false, erreurs: [`Parcours trop long : ${ETAPES_MAX} étapes filmées au plus.`] };
  if (gestes.length !== phrases.length) return { ok: false, erreurs: ["Une phrase doit avoir exactement un geste."] };

  const lu = lireScenarioMaquette({ version: VERSION_SCENARIO_MAQUETTE, maquette: e.carte.maquette, largeur: e.largeur, hauteur: e.hauteur, etapes });
  if (!lu.ok) return { ok: false, erreurs: lu.erreurs };

  const sansEmpreinte = { version: VERSION_PARCOURS, gabarits: [...e.cahier.gabarits], scenario: lu.scenario, plansDessines, gestes };
  const parcours: ParcoursTutoriel = { ...sansEmpreinte, empreinte: fnv1a64(jsonCanonique(sansEmpreinte)) };
  return { ok: true, parcours, remarques };
}
