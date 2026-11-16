/**
 * SEO-03 · Contrôleur SEO et GEO sans IA : juge une fiche de page (SEO-02) et rend vert / orange / rouge.
 * PUR : aucune entrée-sortie, aucun réseau, aucune IA. Les champs, longueurs et listes fermées viennent de
 * src/domaine/fiche-de-page.ts (SEO-02, document SEO-01 « FICHE-DE-PAGE.md » qui fait loi) : ils ne sont pas réécrits ici.
 * Ce fichier ajoute : un seul H1, expressions bannies du contrôleur de texte existant (ville du fondateur, garantie), noms interdits
 * passés en option (mot entier), adresses publiques, chiffres sans source valide, superlatifs, témoignages, formules vagues
 * dans le résumé, doublons d'adresse ou de titre (comparés normalisés).
 * Aucun motif ne recopie le texte contrôlé.
 */
import { controlerFiche, dateValide, motInterdit, type ContenuFiche } from "./fiche-de-page";
import { classementDans, expressionsBannieDans, normaliser, premierChiffre } from "./controles-visuel/texte";

export type NiveauControle = "vert" | "orange" | "rouge";
export interface MotifControle { champ: string; niveau: "orange" | "rouge"; message: string }
export interface ResultatControle { niveau: NiveauControle; motifs: MotifControle[] }

export interface OptionsControle {
  /** Prénoms, noms ou villes à ne jamais publier (fournis par l'appelant : jamais écrits dans ce dépôt public). */
  nomsInterdits?: string[];
  /** Titres des autres pages du site (pas de doublon). */
  titresExistants?: string[];
  /** Adresses des autres pages du site (adresse unique). */
  adressesExistantes?: string[];
}

/** Défauts de SEO-02 qui bloquent (champ vide, mot interdit, liste fermée, signature) ; les autres se corrigent (orange). */
const BLOQUANT = /champ vide|mot interdit|hors liste fermée|signature|valeur en double/;

const TEMOIGNAGE = /t[eé]moignage|ils nous font confiance|avis (?:de nos )?clients?/i;
const FORMULE_VAGUE = /(?<![\p{L}])(?:ici|notre solution)(?![\p{L}])/iu;

/** Tous les textes visibles de la fiche, avec leur champ (pour les contrôles transversaux). */
function textesDe(c: ContenuFiche): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const add = (champ: string, v: string | undefined) => { if (v) out.push([champ, v]); };
  const addAll = (champ: string, v: string[] | undefined) => (v ?? []).forEach((x) => add(champ, x));
  add("titre", c.titre); add("metaDescription", c.metaDescription); add("h1", c.h1); add("resume", c.resume); add("gain", c.gain);
  addAll("pourQui", c.pourQui);
  addAll("avantApres", c.avantApres?.avant); addAll("avantApres", c.avantApres?.apres);
  add("commentCaMarche", c.commentCaMarche?.titre); addAll("commentCaMarche", c.commentCaMarche?.etapes);
  (c.sousTitres ?? []).forEach((s) => add("sousTitres", s.texte));
  (c.questions ?? []).forEach((q) => { add("questions", q.question); add("questions", q.reponse); });
  addAll("limites", c.limites);
  (c.pagesLiees ?? []).forEach((p) => add("pagesLiees", p.texte));
  add("appelAction", c.appelAction); add("transcription", c.transcription);
  add("video", c.video?.titre); add("video", c.video?.description);
  (c.images ?? []).forEach((i) => add("images", i.alt));
  (c.sources ?? []).forEach((s) => add("sources", s.intitule));
  return out;
}

/** Adresses publiques (slug et pages liées), tirets lus comme des espaces : contrôlées comme du texte, jamais pour les chiffres. */
function adressesDe(c: ContenuFiche): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (c.slug) out.push(["slug", c.slug.replace(/-/g, " ")]);
  for (const p of c.pagesLiees ?? []) if (p.adresse) out.push(["pagesLiees", p.adresse.replace(/-/g, " ")]);
  return out;
}

const sourceValide = (s: { adresse: string; dateConsultation: string; intitule: string }): boolean =>
  /^https:\/\/\S+$/.test(s.adresse) && s.intitule.trim() !== "" && dateValide(s.dateConsultation);

export function controlerSeo(contenu: ContenuFiche, options: OptionsControle = {}): ResultatControle {
  const motifs: MotifControle[] = [];
  const ajouter = (champ: string, niveau: "orange" | "rouge", message: string) => {
    if (!motifs.some((m) => m.champ === champ && m.message === message)) motifs.push({ champ, niveau, message });
  };

  // Longueurs, titres, listes fermées, limites, signature, mots interdits : lus dans SEO-02.
  for (const d of controlerFiche(contenu)) ajouter(d.champ, BLOQUANT.test(d.message) ? "rouge" : "orange", d.message);

  // Un seul H1 : le H1 est le champ « h1 » ; tout sous-titre de niveau 1 serait un second H1.
  if ((contenu.sousTitres ?? []).some((s) => (s.niveau as number) < 2)) {
    ajouter("h1", "rouge", "H1 : un seul H1 par page ; les sous-titres commencent au niveau 2.");
  }

  const textes = textesDe(contenu);
  const interdits = (options.nomsInterdits ?? []).map(normaliser).filter((n) => n !== "");
  for (const [champ, texte] of [...textes, ...adressesDe(contenu)]) {
    // Contrôleur de texte existant : ville du fondateur, formules de garantie… (le libellé de la règle, jamais le texte).
    for (const libelle of expressionsBannieDans(texte)) ajouter(champ, "rouge", `${champ} : expression interdite (${libelle}).`);
    const mots = ` ${normaliser(texte)} `;
    if (interdits.some((i) => mots.includes(` ${i} `))) ajouter(champ, "rouge", `${champ} : un nom ou une ville interdits figurent dans le texte.`);
  }
  // Les champs de texte sont déjà contrôlés par SEO-02 ; les adresses publiques le sont ici.
  for (const [champ, texte] of adressesDe(contenu)) {
    const interdit = motInterdit(texte);
    if (interdit) ajouter(champ, "rouge", `${champ} : mot interdit (${interdit}).`);
  }
  for (const [champ, texte] of textes) {
    if (TEMOIGNAGE.test(texte)) ajouter(champ, "rouge", `${champ} : pas de témoignage ni d'avis client sans accord écrit.`);
    if (classementDans(texte) !== undefined) ajouter(champ, "orange", `${champ} : pas de superlatif ni de classement (« meilleur », « leader »…) sans preuve.`);
  }

  // Un chiffre n'est permis que s'il existe au moins une source valide (adresse https, date AAAA-MM-JJ).
  if (!(contenu.sources ?? []).some(sourceValide)) {
    for (const [champ, texte] of textes) {
      if (premierChiffre(texte) !== undefined) ajouter(champ, "orange", `${champ} : chiffre sans source ; ajoutez une source datée ou retirez le chiffre.`);
    }
  }

  if (contenu.resume && FORMULE_VAGUE.test(contenu.resume)) {
    ajouter("resume", "orange", "Résumé citable : remplacez « ici » ou « notre solution » par le nom de l'automatisation.");
  }

  if (contenu.titre && (options.titresExistants ?? []).some((x) => normaliser(x) === normaliser(contenu.titre!))) ajouter("titre", "orange", "Titre de page : déjà utilisé par une autre page.");
  if (contenu.slug && (options.adressesExistantes ?? []).some((x) => normaliser(x) === normaliser(contenu.slug!))) ajouter("slug", "orange", "Adresse : déjà utilisée par une autre page.");

  const niveau: NiveauControle = motifs.some((m) => m.niveau === "rouge") ? "rouge" : motifs.length > 0 ? "orange" : "vert";
  return { niveau, motifs };
}
