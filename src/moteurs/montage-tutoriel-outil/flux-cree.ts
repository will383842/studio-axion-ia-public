// T-EXT-V2-06 : un flux d'automatisation CRÉÉ (`flux-automatisation.v1`, cas 3 « depuis une phrase ») → les pièces dont le reste
// de la chaîne a besoin. Pur, sans IA, 0 € : aucun appel, aucun réglage lu ni écrit, aucun navigateur, aucun disque.
// Rien ne l'importe en production (le branchement est la fiche V2-08). Ne lève jamais, messages en français.
// Les textes d'un flux créé sont des PROPOSITIONS : Williams les voit mot pour mot et les garde avant toute fabrication.
// Réutilisé par import, jamais recopié : lecteur du flux (T-EXT-50), contrôle des textes créés et constantes (V2-02),
// empreinte courte, schéma de la carte des zones, lecteur du scénario.
import { empreinteCourte } from "../../domaine/sujets-traites";
import { ENTREPRISE_EXEMPLE, VERSION_DESCRIPTION_MAQUETTE, type DescriptionMaquette } from "./description-maquette";
import { schemaCarteZones, VERSION_CARTE_ZONES, ZONES_MAX, ZONES_MIN, type CarteZones, type ZoneCarte } from "./equipe/analyste";
import { lireFluxAutomatisation, MAQUETTE_FLUX, VUES_ECRANS, type FluxAutomatisation } from "./gabarit-flux";
import { controlerTextesCrees } from "./maquette-creee";
import { lireScenarioMaquette, VERSION_SCENARIO_MAQUETTE, type EtapeScenario, type ScenarioMaquette } from "./scenario-maquette";

/** Domaine des adresses d'exemple : tout courriel visible doit y finir. */
export const DOMAINE_COURRIEL_EXEMPLE = "@exemple.invalid";
/** Un texte créé fait 60 caractères au plus (même borne que les états de V2-02) ; un texte plus long est découpé à la ponctuation. */
const TEXTE_MAX = 60;

/* ------------------------------------------------------------------ */
/* Outils                                                              */
/* ------------------------------------------------------------------ */

/** Clés de `contenus` qui portent un identifiant technique, jamais un texte affiché. */
const CLES_TECHNIQUES = new Set(["id", "jour", "nouveau", "dossier", "exemple", "etapeDepart"]);
const COURRIEL = /[^\s@<>"'(),;:]+@[^\s@<>"'(),;]+/g;
/** Heures (`9 h 30`, `9 h`, `09:00`) et dates courtes (`12/11`, `12.11.2026`) : seuls nombres admis. */
const HEURE = /\b\d{1,2}\s?h(?:\s?\d{2})?\b|\b\d{1,2}:\d{2}\b/gi;
const DATE_COURTE = /\b\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?\b/g;

interface Texte {
  /** Où le texte se trouve (pour le message d'erreur). */
  lieu: string;
  etapeId: string;
  genre: "libelle" | "contenu";
  valeur: string;
}

function collecter(v: unknown, cle: string, sortie: string[], profondeur = 0): void {
  if (profondeur > 12) return;
  if (typeof v === "string") {
    if (!CLES_TECHNIQUES.has(cle) && v.trim() !== "") sortie.push(v.trim());
  } else if (Array.isArray(v)) for (const x of v) collecter(x, cle, sortie, profondeur + 1);
  else if (typeof v === "object" && v !== null) for (const [k, x] of Object.entries(v)) collecter(x, k, sortie, profondeur + 1);
}

/** Textes visibles d'une vue du bureau exemple (`contenus[vue]`), dans l'ordre du JSON. */
function textesDeVue(flux: FluxAutomatisation, vue: string): string[] {
  const sortie: string[] = [];
  collecter(flux.contenus[vue], "", sortie);
  return sortie;
}

/** Libellé du schéma, puis textes de la vue de l'étape, par étape ; chaque texte une seule fois dans tout le flux. */
function tousLesTextes(flux: FluxAutomatisation): Texte[] {
  const vus = new Set<string>();
  const sortie: Texte[] = [];
  const ajoute = (t: Texte) => {
    const cle = `${t.genre}|${t.valeur}`;
    if (vus.has(cle)) return;
    vus.add(cle);
    sortie.push(t);
  };
  for (const e of flux.etapes) {
    ajoute({ lieu: `Étape « ${e.id} » (libellé du schéma)`, etapeId: e.id, genre: "libelle", valeur: e.libelleSchema.trim() });
    for (const v of textesDeVue(flux, e.vue)) ajoute({ lieu: `Étape « ${e.id} » (vue ${e.vue})`, etapeId: e.id, genre: "contenu", valeur: v });
  }
  // Les écrans filmés « avant », « declencheur » et « resultat » : leurs vues sont lues aussi (un texte déjà vu dans une étape n'est pas repris).
  for (const [id, ecran] of [["avant", flux.avant], ["declencheur", flux.declencheur], ["resultat", flux.resultat]] as const) {
    const vue = (ecran as { vue?: unknown } | undefined)?.vue;
    if (typeof vue !== "string") continue;
    for (const v of textesDeVue(flux, vue)) ajoute({ lieu: `Écran « ${id} » (vue ${vue})`, etapeId: id, genre: "contenu", valeur: v });
  }
  return sortie;
}

const sansCourriel = (t: string) => t.replace(COURRIEL, " ").replace(/\s+/g, " ").trim();
const sansHeureNiDate = (t: string) => t.replace(HEURE, " ").replace(DATE_COURTE, " ");

/** Découpe un texte long à la ponctuation, puis par groupes de mots, pour que chaque morceau tienne dans la borne des textes créés. */
function morceaux(t: string): string[] {
  if (t.length <= TEXTE_MAX) return [t];
  const sortie: string[] = [];
  const phrases = t
    .split(/(?<=[.!?;:,])\s+/u)
    .map((m) => m.trim().replace(/[.!?;:,]+$/u, "").trim())
    .filter((m) => m !== "");
  for (const p of phrases) {
    let courant = "";
    for (const mot of p.split(/\s+/u)) {
      if (courant !== "" && courant.length + 1 + mot.length > TEXTE_MAX) {
        sortie.push(courant);
        courant = mot;
      } else courant = courant === "" ? mot : `${courant} ${mot}`;
    }
    if (courant !== "") sortie.push(courant);
  }
  return sortie;
}

/**
 * Défauts d'un texte au regard des règles de V2-02 (`controlerTextesCrees`, par import) : on lui présente le texte dans une
 * description minimale, comme libellé de zone (court, sans phrase) ou comme « état » (une phrase courte admise).
 */
function defautsMaquette(t: string, genre: Texte["genre"], nomsPermis: readonly string[]): string[] {
  const neutre = "Flux";
  const zone = (libelle: string) => ({ id: "z", type: "liste" as const, libelle, donnees: [] });
  const description: DescriptionMaquette = {
    version: VERSION_DESCRIPTION_MAQUETTE,
    nom: neutre,
    entreprise: ENTREPRISE_EXEMPLE,
    metier: neutre,
    ecrans: [{ id: "flux", modele: "tableau-de-bord", titre: neutre, zones: [zone(genre === "libelle" ? t : neutre)] }],
    etats: { avant: genre === "contenu" ? t : neutre, maintenant: genre === "contenu" ? t : neutre },
  };
  return controlerTextesCrees(description, nomsPermis);
}

/* ------------------------------------------------------------------ */
/* 1. Contrôle                                                         */
/* ------------------------------------------------------------------ */

/**
 * Défauts d'un flux créé (liste vide : rien à signaler). S'ajoute à `lireFluxAutomatisation` (appelé d'abord, jamais recopié).
 * `nomsPermis` : noms de personnes de `ecrans-outils/noms.json` et `charte/noms-neutres.json`, lus par l'appelant.
 */
export function controlerFluxCree(f: FluxAutomatisation, nomsPermis: readonly string[] = []): string[] {
  try {
    const lu = lireLeFlux(f);
    if (!lu.ok) return lu.erreurs;
    const flux = lu.flux;
    const erreurs: string[] = [];
    const ajoute = (m: string) => {
      if (!erreurs.includes(m)) erreurs.push(m);
    };

    for (const e of flux.etapes) {
      if (!(VUES_ECRANS as readonly string[]).includes(e.vue)) ajoute(`Étape « ${e.id} » : la vue « ${e.vue} » n'est pas dans le bureau exemple.`);
    }

    // Courriels : tout ce qui ressemble à une adresse, où qu'elle soit dans le flux, finit par @exemple.invalid.
    const toutes: string[] = [];
    collecter({ avant: flux.avant, declencheur: flux.declencheur, etapes: flux.etapes, resultat: flux.resultat, contenus: flux.contenus }, "", toutes);
    for (const s of toutes) {
      for (const adresse of s.match(COURRIEL) ?? []) {
        if (!adresse.toLowerCase().endsWith(DOMAINE_COURRIEL_EXEMPLE)) ajoute(`« ${adresse} » : adresse réelle possible (une adresse d'exemple finit par ${DOMAINE_COURRIEL_EXEMPLE}).`);
      }
    }

    // Chiffres : aucun nombre dit ou écrit qui n'ait pas été choisi (sauf heure et date courte).
    for (const t of tousLesTextes(flux)) {
      const nu = sansHeureNiDate(sansCourriel(t.valeur));
      const nombre = nu.match(/\d+(?:[.,]\d+)?/)?.[0];
      if (nombre) ajoute(`« ${t.valeur} » : nombre non choisi (« ${nombre} ») ; un flux ne montre aucun chiffre, sauf une heure ou une date.`);
    }

    // Étiquettes, tutoiement, phrases, noms propres, marque : règles de V2-02.
    for (const t of tousLesTextes(flux)) {
      for (const m of morceaux(sansCourriel(t.valeur))) {
        if (m === "") continue;
        for (const defaut of defautsMaquette(sansHeureNiDate(m).trim() || m, t.genre, nomsPermis)) ajoute(`${t.lieu} — ${defaut}`);
      }
    }
    return erreurs;
  } catch {
    return ["Flux illisible."];
  }
}

function lireLeFlux(f: unknown): ReturnType<typeof lireFluxAutomatisation> {
  try {
    return lireFluxAutomatisation(f);
  } catch {
    return { ok: false, erreurs: ["Flux illisible."] };
  }
}

/* ------------------------------------------------------------------ */
/* 2. Textes visibles                                                  */
/* ------------------------------------------------------------------ */

/** Ce que Williams voit mot pour mot (V2-09) : par étape, dans l'ordre, libellé du schéma puis textes de la vue, sans doublon dans le flux. */
export function textesDuFlux(f: FluxAutomatisation): { etapeId: string; textes: string[] }[] {
  try {
    const lu = lireLeFlux(f);
    if (!lu.ok) return [];
    const parEtape = new Map<string, string[]>(lu.flux.etapes.map((e) => [e.id, []]));
    const parEcran = new Map<string, string[]>([["avant", []], ["declencheur", []], ["resultat", []]]);
    for (const t of tousLesTextes(lu.flux)) (parEtape.get(t.etapeId) ?? parEcran.get(t.etapeId))?.push(t.valeur);
    // Les écrans filmés hors étapes ne s'ajoutent que s'ils portent un texte propre : le résultat d'avant reste identique sinon.
    const hors = ["avant", "declencheur", "resultat"].flatMap((id) => ((parEcran.get(id) ?? []).length > 0 ? [{ etapeId: id, textes: parEcran.get(id) ?? [] }] : []));
    return [...lu.flux.etapes.map((e) => ({ etapeId: e.id, textes: parEtape.get(e.id) ?? [] })), ...hors];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* 3. Carte des zones                                                  */
/* ------------------------------------------------------------------ */

/**
 * Une zone par étape. `aller` = l'identifiant de l'étape : c'est l'argument de `window.demoMaquette.aller(id)` du bureau exemple
 * (`app.js`), qui retrouve la vue et l'état dans `DONNEES_ECRANS.etapes` (écrit par `donneesEcransDepuisFlux`).
 */
export function carteDepuisFlux(f: FluxAutomatisation): { ok: true; carte: CarteZones } | { ok: false; erreurs: string[] } {
  try {
    const lu = lireLeFlux(f);
    if (!lu.ok) return { ok: false, erreurs: lu.erreurs };
    const etapes = lu.flux.etapes;
    if (etapes.length < ZONES_MIN || etapes.length > ZONES_MAX) return { ok: false, erreurs: [`Le flux doit montrer ${ZONES_MIN} à ${ZONES_MAX} étapes (il en montre ${etapes.length}).`] };
    const zones: ZoneCarte[] = etapes.map((e, i) => ({
      id: e.id,
      nom: e.libelleSchema,
      aller: e.id,
      cible: `body[data-vue="${e.vue}"][data-etat="${e.etat}"]`,
      etat: "maintenant",
      gestes: e.acteur === "humain" ? ["clic"] : ["apparition"],
      prouve: `Étape : ${e.libelleSchema}`.slice(0, 140),
      chiffres: [],
      flux: { ordre: i, evenement: e.libelleSchema },
    }));
    const carte: CarteZones = { version: VERSION_CARTE_ZONES, maquette: MAQUETTE_FLUX, zones, manques: [] };
    const r = schemaCarteZones.safeParse(carte);
    if (!r.success) return { ok: false, erreurs: r.error.issues.map((i) => `${i.path.map(String).join(".")} : ${i.message}`) };
    return { ok: true, carte };
  } catch {
    return { ok: false, erreurs: ["Flux illisible."] };
  }
}

/* ------------------------------------------------------------------ */
/* 4. Empreinte                                                        */
/* ------------------------------------------------------------------ */

function jsonTrie(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(jsonTrie).join(",")}]`;
  if (typeof v === "object" && v !== null) {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${jsonTrie(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

/** Ce que Williams a validé = ce qui sera filmé : même flux (clés dans un autre ordre comprises) = même empreinte. */
export function empreinteFlux(f: FluxAutomatisation): string {
  return empreinteCourte(jsonTrie(f));
}

/* ------------------------------------------------------------------ */
/* 5. Scénario d'aperçu                                                */
/* ------------------------------------------------------------------ */

/**
 * Images d'aperçu du poste SEULEMENT (le parcours de la vidéo reste celui du réalisateur) : déclencheur, chaque étape, résultat.
 * Les `aller` sont ceux de `donneesEcransDepuisFlux` (« declencheur », id d'étape, « resultat »). Aucune durée.
 */
export function scenarioApercuFlux(f: FluxAutomatisation, maquette: typeof MAQUETTE_FLUX = MAQUETTE_FLUX): ScenarioMaquette {
  const lu = lireLeFlux(f);
  const ecrans: { id: string; vue: string }[] = lu.ok
    ? [{ id: "declencheur", vue: lu.flux.declencheur.vue }, ...lu.flux.etapes.map((e) => ({ id: e.id, vue: e.vue })), { id: "resultat", vue: lu.flux.resultat.vue }]
    : [{ id: "declencheur", vue: "boite" }, { id: "resultat", vue: "boite" }];
  const dernier = ecrans.length - 1;
  const etapes: EtapeScenario[] = ecrans.map((e, i) => {
    const id = `ecran-${e.id}`.slice(0, 60);
    const base = { id, aller: e.id };
    const ancre = i === 0 ? { surMot: "aperçu" } : { apresEtape: `ecran-${ecrans[i - 1]!.id}`.slice(0, 60), delaiMs: 0 };
    const textes = lu.ok && i > 0 && i < dernier ? (textesDuFlux(lu.flux).find((t) => t.etapeId === e.id)?.textes ?? []) : [];
    return { ...base, role: i === 0 ? "accroche" : i === dernier ? "appel" : "parcours", ancre, ...(textes.length > 0 ? { textesEcran: textes } : {}) };
  });
  const brut: ScenarioMaquette = { version: VERSION_SCENARIO_MAQUETTE, maquette, largeur: 1080, hauteur: 1350, etapes };
  const r = lireScenarioMaquette(brut);
  return r.ok ? r.scenario : brut;
}
