// T-EXT-V2-02 : une maquette CRÉÉE (description `description-maquette.v1`) → les pièces dont le reste de la chaîne a besoin.
// Pur, sans IA, 0 € : aucun appel, aucun réglage lu ni écrit, aucun navigateur. Rien ne l'importe en production
// (le branchement est la fiche V2-08). Tout se déduit par règles de la description déjà relue par `lireDescriptionMaquette`.
// Les textes d'une maquette créée sont des PROPOSITIONS : Williams les voit mot pour mot et les garde avant toute fabrication.
import { empreinteCourte } from "../../domaine/sujets-traites";
import { nombresAffirmes } from "../../domaine/nombres-fr";
import { lireTableauDeBord, VERSION_TABLEAU_DE_BORD, type LectureTableauDeBord } from "../../briques/donnees-video/types";
import {
  controlerTexteVisible,
  ENTREPRISE_EXEMPLE,
  PREFIXE_NOM_MAQUETTE,
  type DescriptionMaquette,
  type DonneeExemple,
  type TypeZone,
  type ZoneDecrite,
} from "./description-maquette";
import { schemaCarteZones, VERSION_CARTE_ZONES, ZONES_MAX, ZONES_MIN, type CarteZones, type GesteZone, type ZoneCarte } from "./equipe/analyste";
import { lireScenarioMaquette, VERSION_SCENARIO_MAQUETTE, type EtapeScenario, type ScenarioMaquette } from "./scenario-maquette";

/* ------------------------------------------------------------------ */
/* Réglages et bornes                                                  */
/* ------------------------------------------------------------------ */

/** Même clé que T-EXT-33 (une seule constante dans tout le Studio : à importer de 33 dès qu'elle y est exportée). */
export const PARAM_ENTREE_PHRASE = "tutoriel.entreePhrase";
/** Création de la maquette ou du flux par Claude (payante, éteinte). */
export const PARAM_PIECE_CLAUDE = "tutoriel.pieceCreeeClaude";
/** Une proposition + une seule « autre proposition » par vidéo (décision de Williams, 18/11). */
export const PROPOSITIONS_PIECE_MAX = 2;
export const VERSION_APERCU = "apercu-piece.v1";
export const IMAGES_APERCU_MAX = 14;

type LecteurReglage = <T>(id: string, defaut: T) => Promise<T>;

async function reglageVrai(cle: string, lire?: LecteurReglage): Promise<boolean> {
  if (!lire) return false;
  try {
    return (await lire<unknown>(cle, false)) === true;
  } catch {
    return false;
  }
}

/** Vrai SEULEMENT si la valeur lue est exactement `true`. Sans lecteur, absente, `"true"`, `1` : éteint. Rien n'est écrit. */
export const entreePhraseActive = (lire?: LecteurReglage) => reglageVrai(PARAM_ENTREE_PHRASE, lire);
export const pieceCreeeClaudeActive = (lire?: LecteurReglage) => reglageVrai(PARAM_PIECE_CLAUDE, lire);

/* ------------------------------------------------------------------ */
/* Outils                                                              */
/* ------------------------------------------------------------------ */

const normaliser = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mots = (t: string) => t.trim().split(/\s+/).filter(Boolean);

function contientMot(texte: string, mot: string): boolean {
  return new RegExp(`(?<![\\p{L}\\p{N}])${echapper(normaliser(mot))}(?![\\p{L}\\p{N}])`, "u").test(normaliser(texte));
}

const toutesZones = (d: DescriptionMaquette): ZoneDecrite[] => d.ecrans.flatMap((e) => e.zones);
const estChiffree = (x: DonneeExemple) => x.exemple === true && (typeof x.valeur === "number" || nombresAffirmes(x.valeur).length > 0);

/** Nombre de données chiffrées de toute la maquette (un chiffre « avant » et un chiffre « maintenant » comptent pour 2). */
export const compterDonneesChiffrees = (d: DescriptionMaquette): number => toutesZones(d).reduce((n, z) => n + z.donnees.filter(estChiffree).length, 0);

/* ------------------------------------------------------------------ */
/* 2. Contrôle des textes créés                                        */
/* ------------------------------------------------------------------ */

export const MOTS_PAR_LIBELLE_MAX = 6;
export const CARACTERES_ETAT_MAX = 60;
/** Au plus 12 données chiffrées dans toute la maquette : chacune devient un indicateur, et `schemaTableauDeBord` en refuse plus de 12. */
export const DONNEES_CHIFFREES_MAX = 12;

type GenreTexte = "metier" | "titre" | "libelle" | "valeur" | "etat";

/** Tous les textes écrits par Claude, avec leur genre (nom et entreprise sont imposés, donc non listés ici). */
function textesAControler(d: DescriptionMaquette): { genre: GenreTexte; texte: string }[] {
  const sortie: { genre: GenreTexte; texte: string }[] = [{ genre: "metier", texte: d.metier }];
  for (const e of d.ecrans) {
    sortie.push({ genre: "titre", texte: e.titre });
    for (const z of e.zones) {
      sortie.push({ genre: "libelle", texte: z.libelle });
      for (const x of z.donnees) {
        sortie.push({ genre: "libelle", texte: x.libelle });
        if (typeof x.valeur === "string") sortie.push({ genre: "valeur", texte: x.valeur });
      }
    }
  }
  sortie.push({ genre: "etat", texte: d.etats.avant }, { genre: "etat", texte: d.etats.maintenant });
  return sortie;
}

function premierDefaut(genre: GenreTexte, brut: string, nomsPermis: readonly string[]): string | null {
  const t = brut.trim();
  const n = normaliser(t).replace(/[\s.!?:;]+$/u, "");
  if (["douleur", "solution", "a vous"].some((m) => contientMot(t, m))) return "étiquette interdite (« Douleur », « Solution », « À vous »).";
  if (n === "exemple" || /^exemple\s*:/.test(normaliser(t))) return "étiquette interdite (« Exemple » seul).";
  const nn = normaliser(t);
  if (/(?<![\p{L}\p{N}])(tu|toi|ton|ta|tes)(?![\p{L}\p{N}])/u.test(nn) || /(?<![\p{L}\p{N}])t['’]\p{L}/u.test(nn)) return "tutoiement refusé : la marque vouvoie.";
  if (genre === "etat") {
    if (t.length > CARACTERES_ETAT_MAX) return `un état fait ${CARACTERES_ETAT_MAX} caractères au plus.`;
  } else if (/[.!?]$/.test(t) || mots(t).length > MOTS_PAR_LIBELLE_MAX) return "un libellé court, pas une phrase (6 mots au plus, sans point final).";
  // Noms propres : le prefixe neutre, « Entreprise exemple » et les noms permis sont retirés avant la recherche.
  let reste = t.split(PREFIXE_NOM_MAQUETTE.trim()).join(" ").split(ENTREPRISE_EXEMPLE).join(" ");
  for (const nom of [...nomsPermis].sort((a, b) => b.length - a.length)) if (nom.trim()) reste = reste.split(nom).join(" ");
  const jetons = mots(reste);
  for (let i = 0; i < jetons.length; i++) {
    const m = jetons[i]!.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (!m || i === 0) continue;
    if (/^\p{Lu}/u.test(m)) return `nom propre non choisi : « ${m} ».`;
  }
  return null;
}

/**
 * Défauts propres aux textes CRÉÉS (s'ajoute à `lireDescriptionMaquette`, ne la remplace pas). Une erreur par texte fautif.
 * `nomsPermis` : noms de `ecrans-outils/noms.json` et `charte/noms-neutres.json`, lus par l'appelant.
 */
export function controlerTextesCrees(d: DescriptionMaquette, nomsPermis: readonly string[] = []): string[] {
  const erreurs: string[] = [];
  try {
    const vus = new Set<string>();
    for (const { genre, texte } of textesAControler(d)) {
      const cle = `${genre}|${texte}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      const visible = controlerTexteVisible(texte, []);
      const defaut = visible ?? premierDefaut(genre, texte, nomsPermis);
      if (defaut) erreurs.push(`« ${texte} » : ${defaut}`);
    }
  } catch {
    erreurs.push("Textes illisibles.");
  }
  return erreurs;
}

/* ------------------------------------------------------------------ */
/* 3. Textes visibles, dans l'ordre d'affichage                        */
/* ------------------------------------------------------------------ */

/** Ce que Williams voit mot pour mot (V2-09) et ce que reçoit le registre (`textesMaquette`, `creee: true`). */
export function textesDeLaMaquette(d: DescriptionMaquette): { ecranId: string; textes: string[] }[] {
  const dernier = d.ecrans.length - 1;
  return d.ecrans.map((e, i) => {
    const liste: string[] = [];
    if (i === 0) liste.push(d.nom, d.entreprise);
    liste.push(e.titre);
    for (const z of e.zones) {
      liste.push(z.libelle);
      for (const x of z.donnees) liste.push(x.libelle, String(x.valeur));
    }
    if (i === dernier) liste.push(d.etats.avant, d.etats.maintenant);
    return { ecranId: e.id, textes: [...new Set(liste)] };
  });
}

/* ------------------------------------------------------------------ */
/* 4. Carte des zones                                                  */
/* ------------------------------------------------------------------ */

const GESTES_PAR_TYPE: Record<TypeZone, GesteZone[]> = {
  kpi: ["zoom", "apparition"],
  liste: ["defilement"],
  tableau: ["defilement", "zoom"],
  graphique: ["apparition", "zoom"],
  fiche: ["clic"],
  message: ["apparition"],
};

function etatDeZone(z: ZoneDecrite): ZoneCarte["etat"] {
  const etats = new Set(z.donnees.map((x) => x.etat ?? "les-deux"));
  if (etats.size === 1) {
    const [seul] = [...etats];
    if (seul === "avant" || seul === "maintenant") return seul;
  }
  return "les-deux";
}

/** Le chiffre tel que l'écran le montre (valeur « exemple », jamais le libellé) : la garde du scénariste ne connaît que lui. */
const chiffreAffiche = (x: DonneeExemple): string => (typeof x.valeur === "number" ? String(x.valeur).replace(".", ",") : x.valeur).slice(0, 60);

export function carteDepuisDescription(d: DescriptionMaquette): { ok: true; carte: CarteZones } | { ok: false; erreurs: string[] } {
  try {
    const zones = toutesZones(d);
    if (zones.length < ZONES_MIN || zones.length > ZONES_MAX) return { ok: false, erreurs: [`La maquette doit montrer ${ZONES_MIN} à ${ZONES_MAX} zones (elle en montre ${zones.length}).`] };
    const carte: CarteZones = {
      version: VERSION_CARTE_ZONES,
      maquette: d.nom,
      zones: zones.map((z) => ({
        id: z.id,
        nom: z.libelle,
        aller: z.id,
        cible: `[data-zone="${z.id}"]`,
        etat: etatDeZone(z),
        gestes: [...GESTES_PAR_TYPE[z.type]],
        prouve: `Montre : ${z.libelle}`,
        chiffres: [...new Set(z.donnees.filter(estChiffree).map(chiffreAffiche))].slice(0, 12),
      })),
      manques: [],
    };
    const r = schemaCarteZones.safeParse(carte);
    if (!r.success) return { ok: false, erreurs: r.error.issues.map((i) => `${i.path.map(String).join(".")} : ${i.message}`) };
    return { ok: true, carte };
  } catch {
    return { ok: false, erreurs: ["Description illisible."] };
  }
}

/* ------------------------------------------------------------------ */
/* 5. Données au format G4                                             */
/* ------------------------------------------------------------------ */

function decimales(s: string): number {
  return Math.min(4, s.match(/[.,](\d+)/)?.[1]?.length ?? 0);
}

function nombreDe(x: DonneeExemple): { valeur: number; precision: number } | null {
  if (typeof x.valeur === "number") {
    const s = String(x.valeur);
    return { valeur: x.valeur, precision: s.includes("e") ? 0 : decimales(s) };
  }
  const premier = nombresAffirmes(x.valeur)[0];
  return premier ? { valeur: premier.valeur, precision: decimales(premier.brut) } : null;
}

/** `tableau-de-bord.v1` : `garderChiffres` (G4-03) refuse alors tout nombre dit qui n'est pas à l'écran. Données « exemple », jamais un montant. */
export function tableauDepuisDescription(d: DescriptionMaquette, aujourdHui: string): LectureTableauDeBord {
  try {
    const ids = new Set<string>();
    const indicateurs: Record<string, unknown>[] = [];
    const parEtat = { avant: new Map<string, string>(), maintenant: new Map<string, string>() };
    const series: Record<string, unknown>[] = [];
    for (const z of toutesZones(d)) {
      const points: { x: string; valeur: number }[] = [];
      for (const x of z.donnees.filter(estChiffree)) {
        const n = nombreDe(x);
        if (!n) continue;
        let id = x.id;
        for (let k = 2; ids.has(id); k++) id = `${x.id.slice(0, 36)}-${k}`;
        ids.add(id);
        indicateurs.push({ id, libelle: x.libelle, valeur: n.valeur, unite: "unités", precision: n.precision, sens: "hausse-bonne" });
        if (x.etat) {
          const cle = normaliser(x.libelle);
          if (!parEtat[x.etat].has(cle)) parEtat[x.etat].set(cle, id);
        }
        points.push({ x: x.libelle.slice(0, 30), valeur: n.valeur });
      }
      if (z.type === "graphique" && points.length >= 2 && series.length < 6) {
        series.push({ id: z.id, libelle: z.libelle, unite: "unités", points: points.slice(0, 12) });
      }
    }
    const comparaisons = [...parEtat.avant].flatMap(([cle, avant]) => {
      const apres = parEtat.maintenant.get(cle);
      return apres ? [{ avant, apres }] : [];
    });
    return lireTableauDeBord({
      version: VERSION_TABLEAU_DE_BORD,
      titre: d.nom,
      periode: { debut: aujourdHui, fin: aujourdHui, libelle: "Exemple" },
      source: "Données exemple",
      indicateurs,
      series,
      comparaisons,
      alertes: [],
      calculs: [],
    });
  } catch {
    return { ok: false, erreurs: ["Description illisible."] };
  }
}

/* ------------------------------------------------------------------ */
/* 6. Scénario d'aperçu                                                */
/* ------------------------------------------------------------------ */

/** Images d'aperçu du poste (V2-04) SEULEMENT : le parcours de la vidéo reste celui du réalisateur (T-EXT-22). Aucune durée. */
export function scenarioApercu(d: DescriptionMaquette, maquette: string): ScenarioMaquette {
  const nom = maquette.trim() || "maquette";
  const textes = textesDeLaMaquette(d);
  const etapes: EtapeScenario[] = d.ecrans.map((e, i) => ({
    id: `ecran-${e.id}`.slice(0, 60),
    role: i === 0 ? "accroche" : "parcours",
    aller: e.id,
    ancre: i === 0 ? { surMot: "aperçu" } : { apresEtape: `ecran-${d.ecrans[i - 1]!.id}`.slice(0, 60), delaiMs: 0 },
    textesEcran: textes[i]?.textes ?? [],
  }));
  const precedente = etapes[etapes.length - 1];
  etapes.push({
    id: "maintenant",
    role: "appel",
    aller: "maintenant",
    ancre: precedente ? { apresEtape: precedente.id, delaiMs: 0 } : { surMot: "aperçu" },
  });
  const brut: ScenarioMaquette = { version: VERSION_SCENARIO_MAQUETTE, maquette: nom, largeur: 1280, hauteur: 720, etapes };
  const r = lireScenarioMaquette(brut);
  return r.ok ? r.scenario : brut;
}

/* ------------------------------------------------------------------ */
/* 7. Empreinte                                                        */
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

/** Ce que Williams a validé = ce qui sera filmé : même description (clés dans un autre ordre comprises) = même empreinte. */
export function empreinteDescription(d: DescriptionMaquette): string {
  return empreinteCourte(jsonTrie(d));
}

/* ------------------------------------------------------------------ */
/* 8. Aperçu déposé                                                    */
/* ------------------------------------------------------------------ */

export interface ApercuPiece {
  version: typeof VERSION_APERCU;
  empreinteDescription: string;
  images: { ecranId: string; etat: "avant" | "maintenant"; cle: string }[];
  controle: { ok: boolean; defauts: string[] };
}

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const inconnus = (o: Record<string, unknown>, permis: readonly string[], lieu: string, e: string[]) => {
  for (const k of Object.keys(o)) if (!permis.includes(k)) e.push(`${lieu} : champ inconnu « ${k} ».`);
};
const cleSure = (c: string) => c.length > 0 && c.length <= 200 && !c.startsWith("/") && !c.includes("..") && !c.includes("\\") && !c.includes("\0") && !/^[a-z]+:/i.test(c);

export function lireApercu(brut: unknown): { ok: true; apercu: ApercuPiece } | { ok: false; erreurs: string[] } {
  const erreurs: string[] = [];
  try {
    if (!estObjet(brut)) return { ok: false, erreurs: ["L'aperçu doit être un objet."] };
    inconnus(brut, ["version", "empreinteDescription", "images", "controle"], "Aperçu", erreurs);
    if (brut.version !== VERSION_APERCU) erreurs.push(`Version inconnue : attendu « ${VERSION_APERCU} ».`);
    if (typeof brut.empreinteDescription !== "string" || brut.empreinteDescription.trim() === "") erreurs.push("« empreinteDescription » : texte non vide attendu.");
    const images: ApercuPiece["images"] = [];
    if (!Array.isArray(brut.images) || brut.images.length === 0) erreurs.push("Il faut au moins une image.");
    else if (brut.images.length > IMAGES_APERCU_MAX) erreurs.push(`Trop d'images : ${IMAGES_APERCU_MAX} au plus.`);
    else {
      brut.images.forEach((im, i) => {
        const lieu = `Image ${i + 1}`;
        if (!estObjet(im)) return void erreurs.push(`${lieu} : doit être un objet.`);
        inconnus(im, ["ecranId", "etat", "cle"], lieu, erreurs);
        const ok = typeof im.ecranId === "string" && im.ecranId.trim() !== "";
        if (!ok) erreurs.push(`${lieu} : « ecranId » attendu.`);
        if (im.etat !== "avant" && im.etat !== "maintenant") erreurs.push(`${lieu} : état inconnu (avant ou maintenant).`);
        if (typeof im.cle !== "string" || !cleSure(im.cle)) erreurs.push(`${lieu} : clé de stockage refusée (ni « .. », ni « / » en tête).`);
        else if (ok && (im.etat === "avant" || im.etat === "maintenant")) images.push({ ecranId: im.ecranId as string, etat: im.etat, cle: im.cle });
      });
    }
    let controle: ApercuPiece["controle"] | undefined;
    if (!estObjet(brut.controle)) erreurs.push("« controle » attendu.");
    else {
      inconnus(brut.controle, ["ok", "defauts"], "Contrôle", erreurs);
      const d = brut.controle.defauts;
      if (typeof brut.controle.ok !== "boolean" || !Array.isArray(d) || d.some((x) => typeof x !== "string")) erreurs.push("Contrôle : « ok » (vrai ou faux) et « defauts » (liste de textes) attendus.");
      else controle = { ok: brut.controle.ok, defauts: [...(d as string[])] };
    }
    if (erreurs.length > 0 || !controle) return { ok: false, erreurs };
    return { ok: true, apercu: { version: VERSION_APERCU, empreinteDescription: brut.empreinteDescription as string, images, controle } };
  } catch {
    return { ok: false, erreurs: ["Aperçu illisible."] };
  }
}
