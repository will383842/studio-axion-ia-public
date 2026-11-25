// T-EXT-25a : description d'une maquette, schéma `description-maquette.v1` et lecteur strict.
// Pur : aucune lecture de disque, aucun navigateur, aucun appel, aucun réglage. Rien ne l'importe en production.
// Le maquettiste ne rend JAMAIS de code : il remplit cette description, et un constructeur sans IA fabrique la maquette.
// Tout texte venu de Claude est refusé s'il pourrait être JOUÉ par le navigateur de capture (balise, `on…=`, adresse).
import { PALETTE } from "../../briques/charte/axion-2026";
import { garderChiffres } from "../../briques/donnees-video/garde-chiffres";
import type { TableauDeBord } from "../../briques/donnees-video/types";
import { nombresAffirmes } from "../../domaine/nombres-fr";

export const VERSION_DESCRIPTION_MAQUETTE = "description-maquette.v1";
export const VERSION_DONNEES_EXEMPLE = "donnees-exemple.v1";

export const ENTREPRISE_EXEMPLE = "Entreprise exemple";
export const PREFIXE_NOM_MAQUETTE = "Espace démo · ";
export const MODELE_TABLEAU_DE_BORD = "tableau-de-bord";
export const TYPES_ZONE = ["kpi", "liste", "tableau", "graphique", "fiche", "message"] as const;
export type TypeZone = (typeof TYPES_ZONE)[number];
export const ETATS_MAQUETTE = ["avant", "maintenant"] as const;
export type EtatMaquette = (typeof ETATS_MAQUETTE)[number];

export const ECRANS_MAX = 6;
export const ZONES_MAX = 8;
export const DONNEES_MAX = 12;
export const TITRE_MAX = 40;
export const LIBELLE_MAX_ZONE = 40;
export const METIER_MAX = 40;
export const ETAT_LIBELLE_MAX = 60;

/** Mots que la marque Axion IA n'écrit jamais (skill `marque-axion`). */
const MOTS_MARQUE_INTERDITS = ["garanti", "garantie", "garantis", "certifié", "certifiée", "certifiés", "qualiopi", "intégrateur", "integrateur"] as const;

export interface DonneeExemple {
  id: string;
  libelle: string;
  valeur: string | number;
  /** Doit valoir `true` dès que la valeur porte un chiffre. */
  exemple?: boolean;
  /** Visible seulement dans cet état ; absent : dans les deux. */
  etat?: EtatMaquette;
}

export interface ZoneDecrite {
  id: string;
  type: TypeZone;
  libelle: string;
  donnees: DonneeExemple[];
}

export interface EcranDecrit {
  id: string;
  /** Id d'un écran neutre de T-EXT-49, ou « tableau-de-bord ». */
  modele: string;
  titre: string;
  zones: ZoneDecrite[];
}

export interface DescriptionMaquette {
  version: typeof VERSION_DESCRIPTION_MAQUETTE;
  nom: string;
  entreprise: typeof ENTREPRISE_EXEMPLE;
  metier: string;
  ecrans: EcranDecrit[];
  etats: { avant: string; maintenant: string };
}

export interface DonneesExempleZone {
  zone: string;
  donnees: DonneeExemple[];
}
export interface DonneesExemple {
  version: typeof VERSION_DONNEES_EXEMPLE;
  zones: DonneesExempleZone[];
}

export interface OptionsLecture {
  /** Noms interdits de `noms-neutres.json` (le lecteur n'ouvre aucun fichier). */
  interdits: readonly string[];
  /** Écrans neutres connus (T-EXT-49) ; absent : seule la forme de l'identifiant est contrôlée. */
  modelesConnus?: readonly string[];
}

export type LectureDescriptionMaquette = { ok: true; description: DescriptionMaquette } | { ok: false; erreurs: string[] };
export type LectureDonneesExemple = { ok: true; donnees: DonneesExemple } | { ok: false; erreurs: string[] };

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const IDENTIFIANT = /^[a-z][a-z0-9-]{0,39}$/;
/** Lettres, chiffres, espace et ponctuation courante : ni `<`, `>`, `{`, `}`, `=`, `@`, guillemets droits, accent grave. */
export const CARACTERES_AUTORISES = /^[\p{L}\p{N} '’\-–,.:;()%/!?«»·+&]+$/u;
const PALETTE_HEX = new Set(Object.values(PALETTE).map((c) => c.toLowerCase()));

const normaliser = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Mot entier, accents et casse ignorés. */
function contientMot(texte: string, mot: string): boolean {
  return new RegExp(`(?<![\\p{L}\\p{N}])${echapper(normaliser(mot))}(?![\\p{L}\\p{N}])`, "u").test(normaliser(texte));
}

function champsInconnus(o: Record<string, unknown>, permis: readonly string[], lieu: string, erreurs: string[]): void {
  for (const k of Object.keys(o)) if (!permis.includes(k)) erreurs.push(`${lieu} : champ inconnu « ${k} ».`);
}

/** Un texte affichable : un seul message d'erreur (le premier défaut), en français. */
export function controlerTexteVisible(t: string, interdits: readonly string[]): string | null {
  if (/<|>|&lt|&#|\bscript\b/i.test(t)) return "balise ou script refusé (<script>, <…>).";
  if (/\bon[a-z]+\s*=|javascript\s*:/i.test(t)) return "gestionnaire d'événement (on…=) refusé.";
  if (/https?\s*:|\/\/|\bwww\.|[\w.-]+@[\w-]+|\bftp:|\bdata:/i.test(t)) return "adresse refusée (lien, courriel).";
  if (/[€$£]|\beuros?\b|\bdollars?\b|\bEUR\b|\bUSD\b/i.test(t)) return "montant d'argent refusé (€, $, « euros »).";
  for (const m of MOTS_MARQUE_INTERDITS) if (contientMot(t, m)) return `mot interdit par la marque : « ${m} ».`;
  for (const m of interdits) if (m.trim() && contientMot(t, m)) return `nom non neutre : « ${m} ».`;
  if (/#[0-9a-f]{3,8}\b/i.test(t)) {
    for (const h of t.match(/#[0-9a-f]{3,8}\b/gi) ?? []) if (!PALETTE_HEX.has(h.toLowerCase())) return `couleur hors charte : « ${h} ».`;
  }
  if (/\b(?:rgba?|hsla?)\s*\(|gradient|dégradé|degrade|\bbleue?s?\b|\bjaunes?\b|\bblue\b|\byellow\b/i.test(t)) return "couleur hors charte (ni bleu, ni jaune, ni dégradé).";
  if (!CARACTERES_AUTORISES.test(t)) return "caractère non autorisé (lettres, chiffres et ponctuation courante seulement).";
  return null;
}

function lireTexte(v: unknown, lieu: string, max: number, interdits: readonly string[], erreurs: string[]): string | undefined {
  if (typeof v !== "string" || v.trim().length === 0) {
    erreurs.push(`${lieu} : texte attendu, non vide.`);
    return undefined;
  }
  const t = v.trim();
  if (t.length > max) {
    erreurs.push(`${lieu} : ${max} caractères au plus.`);
    return undefined;
  }
  const d = controlerTexteVisible(t, interdits);
  if (d) {
    erreurs.push(`${lieu} : ${d}`);
    return undefined;
  }
  return t;
}

function lireId(v: unknown, lieu: string, erreurs: string[]): string | undefined {
  if (typeof v !== "string" || !IDENTIFIANT.test(v)) {
    erreurs.push(`${lieu} : identifiant attendu (minuscules, chiffres et tirets, 40 caractères au plus).`);
    return undefined;
  }
  return v;
}

const aUnChiffre = (v: string | number) => typeof v === "number" || /\d/.test(v);

function lireDonnee(v: unknown, lieu: string, interdits: readonly string[], erreurs: string[]): DonneeExemple | undefined {
  if (!estObjet(v)) {
    erreurs.push(`${lieu} : doit être un objet.`);
    return undefined;
  }
  const avant = erreurs.length;
  champsInconnus(v, ["id", "libelle", "valeur", "exemple", "etat"], lieu, erreurs);
  const id = lireId(v.id, `${lieu} : id`, erreurs);
  const libelle = lireTexte(v.libelle, `${lieu} : libellé`, LIBELLE_MAX_ZONE, interdits, erreurs);
  let valeur: string | number | undefined;
  if (typeof v.valeur === "number") {
    if (Number.isFinite(v.valeur)) valeur = v.valeur;
    else erreurs.push(`${lieu} : la valeur doit être un nombre fini.`);
  } else valeur = lireTexte(v.valeur, `${lieu} : valeur`, LIBELLE_MAX_ZONE, interdits, erreurs);
  if (v.exemple !== undefined && typeof v.exemple !== "boolean") erreurs.push(`${lieu} : « exemple » doit valoir vrai ou faux.`);
  if (v.etat !== undefined && !ETATS_MAQUETTE.includes(v.etat as EtatMaquette)) erreurs.push(`${lieu} : état inconnu (attendu : avant ou maintenant).`);
  if (valeur !== undefined && aUnChiffre(valeur) && v.exemple !== true) {
    erreurs.push(`${lieu} : une donnée chiffrée doit porter « exemple: true » (garde des chiffres).`);
  }
  if (erreurs.length > avant || id === undefined || libelle === undefined || valeur === undefined) return undefined;
  const d: DonneeExemple = { id, libelle, valeur };
  if (v.exemple === true) d.exemple = true;
  if (v.etat !== undefined) d.etat = v.etat as EtatMaquette;
  return d;
}

function lireDonnees(v: unknown, lieu: string, interdits: readonly string[], erreurs: string[]): DonneeExemple[] | undefined {
  if (!Array.isArray(v)) {
    erreurs.push(`${lieu} : « donnees » doit être une liste.`);
    return undefined;
  }
  if (v.length > DONNEES_MAX) {
    erreurs.push(`${lieu} : ${DONNEES_MAX} données au plus.`);
    return undefined;
  }
  const avant = erreurs.length;
  const sortie: DonneeExemple[] = [];
  const ids = new Set<string>();
  v.forEach((x, i) => {
    const d = lireDonnee(x, `${lieu}, donnée ${i + 1}`, interdits, erreurs);
    if (!d) return;
    if (ids.has(d.id)) erreurs.push(`${lieu}, donnée ${i + 1} : id « ${d.id} » en double.`);
    ids.add(d.id);
    sortie.push(d);
  });
  return erreurs.length > avant ? undefined : sortie;
}

/** Nombre de données écrites dans les écrans bruts, lues ou non (0 si la forme est illisible). */
function compterDonneesBrutes(ecrans: unknown): number {
  if (!Array.isArray(ecrans)) return 0;
  let n = 0;
  for (const e of ecrans) {
    if (!estObjet(e) || !Array.isArray(e.zones)) continue;
    for (const z of e.zones) if (estObjet(z) && Array.isArray(z.donnees)) n += z.donnees.length;
  }
  return n;
}

/** Garde G4-03 : tout nombre écrit dans un texte doit venir d'une donnée « exemple » de la description. */
export function garderNombresDesTextes(textes: string[], donnees: DonneeExemple[], erreurs: string[]): void {
  const indicateurs = donnees
    .filter((d) => d.exemple === true)
    .flatMap((d) => (typeof d.valeur === "number" ? [d.valeur] : nombresAffirmes(d.valeur).map((n) => n.valeur)))
    .map((valeur, i) => ({ id: `d${i}`, libelle: "exemple", valeur, unite: "u", precision: 4, sens: "hausse-bonne" as const }));
  const donnee = {
    version: "tableau-de-bord.v1",
    titre: "exemple",
    periode: { debut: "2026-01-01", fin: "2026-01-02", libelle: "exemple" },
    source: "exemple",
    indicateurs,
    series: [],
    comparaisons: [],
    alertes: [],
    calculs: [],
  } as TableauDeBord;
  const verdict = garderChiffres(donnee, { textesEcran: textes });
  for (const h of verdict.horsDonnee) erreurs.push(`Le nombre « ${h.brut} » dans « ${h.texte} » ne vient d'aucune donnée exemple (garde des chiffres).`);
}

function lireZone(v: unknown, lieu: string, o: OptionsLecture, erreurs: string[], textes: string[], donnees: DonneeExemple[]): ZoneDecrite | undefined {
  if (!estObjet(v)) {
    erreurs.push(`${lieu} : doit être un objet.`);
    return undefined;
  }
  const avant = erreurs.length;
  champsInconnus(v, ["id", "type", "libelle", "donnees"], lieu, erreurs);
  const id = lireId(v.id, `${lieu} : id`, erreurs);
  if (!TYPES_ZONE.includes(v.type as TypeZone)) erreurs.push(`${lieu} : type de zone inconnu (attendu : ${TYPES_ZONE.join(", ")}).`);
  const libelle = lireTexte(v.libelle, `${lieu} : libellé`, LIBELLE_MAX_ZONE, o.interdits, erreurs);
  const liste = lireDonnees(v.donnees, lieu, o.interdits, erreurs);
  if (libelle) textes.push(libelle);
  if (liste) donnees.push(...liste);
  if (erreurs.length > avant || !id || !libelle || !liste) return undefined;
  return { id, type: v.type as TypeZone, libelle, donnees: liste };
}

function lireEcran(v: unknown, i: number, o: OptionsLecture, erreurs: string[], textes: string[], donnees: DonneeExemple[]): EcranDecrit | undefined {
  const lieu = `Écran ${i + 1}`;
  if (!estObjet(v)) {
    erreurs.push(`${lieu} : doit être un objet.`);
    return undefined;
  }
  const avant = erreurs.length;
  champsInconnus(v, ["id", "modele", "titre", "zones"], lieu, erreurs);
  const id = lireId(v.id, `${lieu} : id`, erreurs);
  const modele = lireId(v.modele, `${lieu} : modèle`, erreurs);
  if (modele && modele !== MODELE_TABLEAU_DE_BORD && o.modelesConnus && !o.modelesConnus.includes(modele)) {
    erreurs.push(`${lieu} : écran modèle inconnu « ${modele} ».`);
  }
  const titre = lireTexte(v.titre, `${lieu} : titre`, TITRE_MAX, o.interdits, erreurs);
  if (titre) textes.push(titre);
  const zones: ZoneDecrite[] = [];
  if (!Array.isArray(v.zones) || v.zones.length === 0) erreurs.push(`${lieu} : au moins une zone.`);
  else if (v.zones.length > ZONES_MAX) erreurs.push(`${lieu} : ${ZONES_MAX} zones au plus.`);
  else {
    const ids = new Set<string>();
    v.zones.forEach((z, j) => {
      const r = lireZone(z, `${lieu}, zone ${j + 1}`, o, erreurs, textes, donnees);
      if (!r) return;
      if (ids.has(r.id)) erreurs.push(`${lieu}, zone ${j + 1} : id « ${r.id} » en double.`);
      ids.add(r.id);
      zones.push(r);
    });
  }
  if (erreurs.length > avant || !id || !modele || !titre) return undefined;
  return { id, modele, titre, zones };
}

/** Lecture stricte : ne lève jamais, messages en français. */
export function lireDescriptionMaquette(brut: unknown, options: OptionsLecture): LectureDescriptionMaquette {
  const erreurs: string[] = [];
  try {
    if (!estObjet(brut)) return { ok: false, erreurs: ["La description doit être un objet."] };
    champsInconnus(brut, ["version", "nom", "entreprise", "metier", "ecrans", "etats"], "Description", erreurs);
    if (brut.version !== VERSION_DESCRIPTION_MAQUETTE) erreurs.push(`Version inconnue : attendu « ${VERSION_DESCRIPTION_MAQUETTE} ».`);
    const metier = lireTexte(brut.metier, "Métier", METIER_MAX, options.interdits, erreurs);
    const nom = lireTexte(brut.nom, "Nom", PREFIXE_NOM_MAQUETTE.length + METIER_MAX, options.interdits, erreurs);
    if (nom && metier && nom !== `${PREFIXE_NOM_MAQUETTE}${metier}`) erreurs.push(`Nom non neutre : attendu « ${PREFIXE_NOM_MAQUETTE}${metier} ».`);
    if (brut.entreprise !== ENTREPRISE_EXEMPLE) erreurs.push(`Entreprise non neutre : attendu « ${ENTREPRISE_EXEMPLE} ».`);
    const textes: string[] = [];
    const donnees: DonneeExemple[] = [];
    const ecrans: EcranDecrit[] = [];
    if (!Array.isArray(brut.ecrans) || brut.ecrans.length === 0) erreurs.push("Il faut au moins un écran.");
    else if (brut.ecrans.length > ECRANS_MAX) erreurs.push(`Trop d'écrans : ${ECRANS_MAX} au maximum.`);
    else {
      const ids = new Set<string>();
      brut.ecrans.forEach((e, i) => {
        const r = lireEcran(e, i, options, erreurs, textes, donnees);
        if (!r) return;
        if (ids.has(r.id)) erreurs.push(`Écran ${i + 1} : id « ${r.id} » en double.`);
        ids.add(r.id);
        ecrans.push(r);
      });
      // Unicité GLOBALE : un seul ensemble d'identifiants pour écrans et zones, sinon `aller` filme le mauvais endroit.
      const vus = new Set<string>(["avant", "maintenant"]);
      ecrans.forEach((e) => {
        if (e.id === "avant" || e.id === "maintenant") erreurs.push(`Écran « ${e.id} » : cet identifiant est réservé aux états « avant » et « maintenant ».`);
        else if (vus.has(e.id)) erreurs.push(`Écran « ${e.id} » : identifiant déjà utilisé par un autre écran ou une autre zone.`);
        vus.add(e.id);
        e.zones.forEach((z) => {
          if (z.id === "avant" || z.id === "maintenant") erreurs.push(`Zone « ${z.id} » : cet identifiant est réservé aux états « avant » et « maintenant ».`);
          else if (vus.has(z.id)) erreurs.push(`Zone « ${z.id} » (écran « ${e.id} ») : identifiant déjà utilisé par un autre écran ou une autre zone.`);
          vus.add(z.id);
        });
      });
    }
    let etats: DescriptionMaquette["etats"] | undefined;
    if (!estObjet(brut.etats)) erreurs.push("« etats » doit contenir « avant » et « maintenant ».");
    else {
      champsInconnus(brut.etats, ["avant", "maintenant"], "États", erreurs);
      const avant = lireTexte(brut.etats.avant, "État « avant »", ETAT_LIBELLE_MAX, options.interdits, erreurs);
      const maintenant = lireTexte(brut.etats.maintenant, "État « maintenant »", ETAT_LIBELLE_MAX, options.interdits, erreurs);
      if (avant && maintenant) {
        etats = { avant, maintenant };
        textes.push(avant, maintenant);
      }
    }
    // La garde des nombres tourne aussi quand une autre faute existe (ses remarques arrivent dès le 1er refus), mais seulement si TOUTES
    // les données ont été lues : sinon un nombre venu d'une donnée illisible serait signalé à tort. Ce qui est accepté ne change pas.
    if (erreurs.length === 0 || donnees.length === compterDonneesBrutes(brut.ecrans)) garderNombresDesTextes(textes, donnees, erreurs);
    if (erreurs.length > 0 || !nom || !metier || !etats) return { ok: false, erreurs };
    return { ok: true, description: { version: VERSION_DESCRIPTION_MAQUETTE, nom, entreprise: ENTREPRISE_EXEMPLE, metier, ecrans, etats } };
  } catch {
    return { ok: false, erreurs: ["Description illisible."] };
  }
}

/** Données « exemple » proposées pour des zones (manque « donnees-exemple ») : mêmes refus que la description. */
export function lireDonneesExemple(brut: unknown, options: OptionsLecture): LectureDonneesExemple {
  const erreurs: string[] = [];
  try {
    if (!estObjet(brut)) return { ok: false, erreurs: ["Les données exemple doivent être un objet."] };
    champsInconnus(brut, ["version", "zones"], "Données exemple", erreurs);
    if (brut.version !== VERSION_DONNEES_EXEMPLE) erreurs.push(`Version inconnue : attendu « ${VERSION_DONNEES_EXEMPLE} ».`);
    const zones: DonneesExempleZone[] = [];
    const toutes: DonneeExemple[] = [];
    if (!Array.isArray(brut.zones) || brut.zones.length === 0) erreurs.push("Il faut au moins une zone.");
    else if (brut.zones.length > ZONES_MAX * ECRANS_MAX) erreurs.push("Trop de zones.");
    else {
      const ids = new Set<string>();
      brut.zones.forEach((z, i) => {
        const lieu = `Zone ${i + 1}`;
        if (!estObjet(z)) {
          erreurs.push(`${lieu} : doit être un objet.`);
          return;
        }
        champsInconnus(z, ["zone", "donnees"], lieu, erreurs);
        const id = lireId(z.zone, `${lieu} : zone`, erreurs);
        const liste = lireDonnees(z.donnees, lieu, options.interdits, erreurs);
        if (id && ids.has(id)) erreurs.push(`${lieu} : zone « ${id} » en double.`);
        if (id) ids.add(id);
        if (id && liste) {
          zones.push({ zone: id, donnees: liste });
          toutes.push(...liste);
        }
      });
    }
    if (erreurs.length === 0) garderNombresDesTextes([], toutes, erreurs);
    if (erreurs.length > 0) return { ok: false, erreurs };
    return { ok: true, donnees: { version: VERSION_DONNEES_EXEMPLE, zones } };
  } catch {
    return { ok: false, erreurs: ["Données exemple illisibles."] };
  }
}
