/**
 * SEO-02 · Fiche de page « une automatisation = une page ». PUR : aucune entrée-sortie, aucun appel réel.
 * Transcrit les 27 champs du document SEO-01 (usine/seo/FICHE-DE-PAGE.md, qui fait loi) :
 * - 1 identifiant, 2 adresse, 3 titre, 4 méta-description, 5 H1, 6 résumé citable, 7 gain, 8 pour qui,
 *   9 avant/après, 10 comment ça marche, 11 sous-titres, 12 questions fréquentes (3 à 6), 13 limites honnêtes,
 *   14 type, 15 besoins, 16 pages liées, 17 appel à l'action, 18 transcription, 19 vidéo, 20 images (alt),
 *   21 image de partage, 22 auteur, 23 dates, 24 sources, 27 statut ;
 * - 25 données structurées et 26 canonique/langue/robots sont GÉNÉRÉS (jamais saisis).
 * Le hub est un classement (types / besoins), pas un champ. Pas de mots-clés ni de chapitres.
 */

export const TYPES_AUTOMATISATION = [
  "contenus-et-reseaux-sociaux",
  "relances-et-suivi",
  "tri-et-classement",
  "comptes-rendus-et-rapports",
  "reponses-aux-demandes",
] as const;
export type TypeAutomatisation = (typeof TYPES_AUTOMATISATION)[number];

export const BESOINS_ENTREPRISE = ["gagner-du-temps", "ne-rien-oublier", "repondre-plus-vite", "mieux-se-faire-connaitre"] as const;
export type BesoinEntreprise = (typeof BESOINS_ENTREPRISE)[number];

export const STATUTS = ["brouillon", "a_valider", "valide", "publie"] as const;
export type StatutFiche = (typeof STATUTS)[number];

export const AUTEUR_PAR_DEFAUT = "Équipe Axion-IA";
export const RELECTEUR_PAR_DEFAUT = "Équipe Axion-IA";
export const CHEMIN_PAGES = "/automatisations";

/** Champs que remplit le fondateur (document SEO-01, colonne « Remplit ») : jamais exposés avant validation. */
export const CHAMPS_REMPLIS_PAR_LE_FONDATEUR = ["pourQui", "avantApres", "limites", "auteur", "relecteur", "sources"] as const;

export interface QuestionReponse { question: string; reponse: string }
export interface SousTitre { niveau: 2 | 3; texte: string }
export interface PageLiee { texte: string; adresse: string }
export interface ImageFiche { alt: string; decorative: boolean }
export interface SourceFiche { intitule: string; adresse: string; dateConsultation: string }

/** Contenu éditable à la main (champs 2 à 24, sauf ce qui est généré). Tout est optionnel : un brouillon est incomplet. */
export interface ContenuFiche {
  slug?: string;
  titre?: string;
  metaDescription?: string;
  h1?: string;
  resume?: string;
  gain?: string;
  pourQui?: string[];
  avantApres?: { avant: string[]; apres: string[] };
  commentCaMarche?: { titre: string; etapes: string[] };
  sousTitres?: SousTitre[];
  questions?: QuestionReponse[];
  limites?: string[];
  type?: TypeAutomatisation;
  besoins?: BesoinEntreprise[];
  pagesLiees?: PageLiee[];
  appelAction?: string;
  transcription?: string;
  video?: { titre: string; description: string; dureeSec: number };
  images?: ImageFiche[];
  imagePartage?: { largeur: number; hauteur: number };
  auteur?: string;
  relecteur?: string;
  sources?: SourceFiche[];
}

export const CLES_CONTENU: readonly (keyof ContenuFiche)[] = [
  "slug", "titre", "metaDescription", "h1", "resume", "gain", "pourQui", "avantApres", "commentCaMarche", "sousTitres",
  "questions", "limites", "type", "besoins", "pagesLiees", "appelAction", "transcription", "video", "images",
  "imagePartage", "auteur", "relecteur", "sources",
];

/** Fiche stockée : identifiant (1), contenu, dates (23), statut (27). */
export interface FicheDePage extends ContenuFiche {
  id: string;
  statut: StatutFiche;
  /** Vrai dès que la page a été publiée une fois : l'adresse ne change alors plus jamais (champ 2). */
  dejaPublie?: boolean;
  /** Vide tant que la page n'est pas publiée (la publication est hors périmètre de SEO-02). */
  datePublication?: string;
  dateMiseAJour: string;
}

export interface Defaut { champ: string; message: string }

const ID_RE = /^AUTO-\d{3,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function dateValide(d: string): boolean {
  if (!DATE_RE.test(d)) return false;
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}
export const identifiantValide = (id: string): boolean => ID_RE.test(id);

/** Adresse : 3 à 6 mots, minuscules, chiffres, tirets, sans date (aucun nombre de 4 chiffres). */
export function slugValide(slug: string): boolean {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return false;
  const mots = slug.split("-");
  return mots.length >= 3 && mots.length <= 6 && !/\d{4}/.test(slug) && motInterdit(mots.join(" ")) === undefined;
}

const MOTS_INTERDITS: Array<[RegExp, string]> = [
  [/certifi/i, "« certifié »"],
  [/qualiopi/i, "« Qualiopi »"],
  [/garanti/i, "formule de garantie"],
  [/\d\s?(?:€|euros?\b|eur\b|\$|dollars?\b)|[€$]\s?\d/i, "un prix"],
  [/(?<![\p{L}'’-])(?:tu|toi|te|tes|ta|ton|tien(?:ne)?s?)(?![\p{L}'’-])|(?<![\p{L}])t['’]/iu, "le tutoiement"],
];

const FAUX_AMIS_TON = /(?<![\p{L}'’])(?:le|un|du|au|ce|votre|notre|leur|mon|son|quel|même|bon|bas|haut)\s+ton(?![\p{L}'’-])/giu;

/** Mot interdit repéré dans un texte (ou undefined). Le message ne cite jamais le texte. */
export function motInterdit(texte: string): string | undefined {
  // « le ton », « votre ton » : un nom, pas un tutoiement.
  const net = texte.replace(FAUX_AMIS_TON, " ");
  for (const [re, nom] of MOTS_INTERDITS) if (re.test(net)) return nom;
  return undefined;
}

const nbPhrases = (t: string): number => t.trim().split(/(?<=[.!?…])\s+/).filter(Boolean).length;
const dans = (n: number, min: number, max: number): boolean => n >= min && n <= max;

/** Contrôle des champs : longueurs, listes fermées, mots interdits. Aucun défaut ne reproduit le contenu contrôlé. */
export function controlerFiche(f: ContenuFiche): Defaut[] {
  const d: Defaut[] = [];
  const ko = (champ: string, message: string) => d.push({ champ, message });
  const texte = (champ: string, v: string | undefined, min: number, max: number, nom: string) => {
    if (v === undefined || v.trim() === "") return ko(champ, `${nom} : champ vide.`);
    if (!dans(v.length, min, max)) ko(champ, `${nom} : ${min} à ${max} caractères attendus.`);
    const m = motInterdit(v);
    if (m) ko(champ, `${nom} : mot interdit (${m}).`);
  };
  const liste = <T>(champ: string, v: T[] | undefined, min: number, max: number, nom: string): v is T[] => {
    if (!v || v.length === 0) {
      if (min > 0) ko(champ, `${nom} : champ vide.`);
      return false;
    }
    if (!dans(v.length, min, max)) ko(champ, `${nom} : ${min} à ${max} éléments attendus.`);
    return true;
  };
  const lignes = (champ: string, v: string[], max: number, nom: string) => {
    for (const l of v) {
      if (l.trim() === "" || l.length > max) ko(champ, `${nom} : chaque ligne doit être non vide et de ${max} caractères au plus.`);
      const m = motInterdit(l);
      if (m) ko(champ, `${nom} : mot interdit (${m}).`);
    }
  };

  // 2
  if (f.slug === undefined || f.slug === "") ko("slug", "Adresse : champ vide.");
  else if (!slugValide(f.slug)) ko("slug", "Adresse : 3 à 6 mots, minuscules, tirets, sans date.");
  // 3, 4, 5
  texte("titre", f.titre, 50, 60, "Titre de page");
  texte("metaDescription", f.metaDescription, 140, 160, "Méta-description");
  texte("h1", f.h1, 40, 70, "H1");
  if (f.h1 !== undefined && f.titre !== undefined && f.h1 === f.titre) ko("h1", "H1 : proche du titre mais pas identique.");
  // 6
  texte("resume", f.resume, 200, 320, "Résumé citable");
  if (f.resume && !dans(nbPhrases(f.resume), 2, 3)) ko("resume", "Résumé citable : 2 à 3 phrases attendues.");
  // 7
  texte("gain", f.gain, 80, 140, "Gain en une phrase");
  // 8
  if (liste("pourQui", f.pourQui, 2, 4, "Pour qui")) lignes("pourQui", f.pourQui, 60, "Pour qui");
  // 9
  if (!f.avantApres) ko("avantApres", "Avant / après : champ vide.");
  else {
    const { avant, apres } = f.avantApres;
    if (!dans(avant.length, 1, 3) || avant.length !== apres.length) ko("avantApres", "Avant / après : 2 colonnes de 1 à 3 lignes, de même longueur.");
    lignes("avantApres", [...avant, ...apres], 120, "Avant / après");
  }
  // 10
  if (!f.commentCaMarche) ko("commentCaMarche", "Comment ça marche : champ vide.");
  else {
    texte("commentCaMarche", f.commentCaMarche.titre, 30, 70, "Comment ça marche (titre H2)");
    if (!dans(f.commentCaMarche.etapes.length, 3, 5)) ko("commentCaMarche", "Comment ça marche : 3 à 5 étapes.");
    lignes("commentCaMarche", f.commentCaMarche.etapes, 120, "Comment ça marche");
  }
  // 11
  if (liste("sousTitres", f.sousTitres, 1, 50, "Sous-titres")) {
    let courant = 1;
    for (const s of f.sousTitres) {
      if (s.texte.length < 30 || s.texte.length > 70) ko("sousTitres", "Sous-titres : 30 à 70 caractères.");
      if (s.niveau > courant + 1 || (courant === 1 && s.niveau !== 2)) ko("sousTitres", "Sous-titres : hiérarchie sans saut (H2 puis H3).");
      courant = s.niveau;
      const m = motInterdit(s.texte);
      if (m) ko("sousTitres", `Sous-titres : mot interdit (${m}).`);
    }
  }
  // 12
  if (liste("questions", f.questions, 3, 6, "Questions fréquentes")) {
    for (const q of f.questions) {
      if (!dans(q.question.length, 60, 110)) ko("questions", "Questions fréquentes : question de 60 à 110 caractères.");
      if (!dans(q.reponse.length, 200, 400) || !dans(nbPhrases(q.reponse), 2, 3)) ko("questions", "Questions fréquentes : réponse de 200 à 400 caractères, en 2 à 3 phrases.");
      const m = motInterdit(`${q.question} ${q.reponse}`);
      if (m) ko("questions", `Questions fréquentes : mot interdit (${m}).`);
    }
  }
  // 13 : obligatoire
  if (liste("limites", f.limites, 1, 3, "Limites honnêtes")) lignes("limites", f.limites, 120, "Limites honnêtes");
  // 14, 15 : listes fermées
  if (f.type === undefined) ko("type", "Type d'automatisation : champ vide.");
  else if (!(TYPES_AUTOMATISATION as readonly string[]).includes(f.type)) ko("type", "Type d'automatisation : valeur hors liste fermée.");
  if (liste("besoins", f.besoins, 1, 2, "Besoin d'entreprise")) {
    if (f.besoins.some((b) => !(BESOINS_ENTREPRISE as readonly string[]).includes(b))) ko("besoins", "Besoin d'entreprise : valeur hors liste fermée.");
    if (new Set(f.besoins).size !== f.besoins.length) ko("besoins", "Besoin d'entreprise : valeur en double.");
  }
  // 16
  if (liste("pagesLiees", f.pagesLiees, 2, 4, "Pages liées")) {
    for (const p of f.pagesLiees) {
      if (p.texte.trim() === "" || /cliquez ici|en savoir plus|ici$/i.test(p.texte.trim())) ko("pagesLiees", "Pages liées : texte de lien descriptif attendu.");
      const mp = motInterdit(p.texte);
      if (mp) ko("pagesLiees", `Pages liées : mot interdit (${mp}).`);
      if (!slugValide(p.adresse)) ko("pagesLiees", "Pages liées : adresse de page invalide.");
      if (f.slug && p.adresse === f.slug) ko("pagesLiees", "Pages liées : une page ne se lie pas à elle-même.");
    }
  }
  // 17, 18
  texte("appelAction", f.appelAction, 30, 60, "Appel à l'action");
  if (f.transcription === undefined || f.transcription.trim() === "") ko("transcription", "Transcription : champ vide.");
  else {
    const m = motInterdit(f.transcription);
    if (m) ko("transcription", `Transcription : mot interdit (${m}).`);
  }
  // 19
  if (!f.video) ko("video", "Vidéo : champ vide.");
  else {
    if (f.video.titre.length === 0 || f.video.titre.length > 60) ko("video", "Vidéo : titre de 1 à 60 caractères.");
    if (f.video.description.length === 0 || f.video.description.length > 160) ko("video", "Vidéo : description de 1 à 160 caractères.");
    const mv = motInterdit(`${f.video.titre} ${f.video.description}`);
    if (mv) ko("video", `Vidéo : mot interdit (${mv}).`);
    if (!Number.isInteger(f.video.dureeSec) || f.video.dureeSec <= 0) ko("video", "Vidéo : durée en secondes, entier positif.");
  }
  // 20
  if (!f.images) ko("images", "Images : champ vide.");
  else {
    for (const i of f.images) {
      if (i.decorative ? i.alt !== "" : !dans(i.alt.length, 80, 125)) ko("images", "Images : alt de 80 à 125 caractères, vide si l'image est décorative.");
      const mi = motInterdit(i.alt);
      if (mi) ko("images", `Images : mot interdit (${mi}).`);
    }
  }
  // 21
  if (!f.imagePartage) ko("imagePartage", "Image de partage : champ vide.");
  else if (f.imagePartage.largeur !== 1200 || f.imagePartage.hauteur !== 630) ko("imagePartage", "Image de partage : 1200×630 px.");
  // 22
  if (f.auteur !== AUTEUR_PAR_DEFAUT) ko("auteur", `Auteur : la signature est « ${AUTEUR_PAR_DEFAUT} » (nom de rôle, jamais un nom de personne).`);
  if (f.relecteur !== RELECTEUR_PAR_DEFAUT) ko("relecteur", `Relecteur : la signature est « ${RELECTEUR_PAR_DEFAUT} » (nom de rôle, jamais un nom de personne).`);
  // 24
  if (!f.sources) ko("sources", "Sources : champ vide (liste vide permise).");
  else {
    if (f.sources.length > 5) ko("sources", "Sources : 5 au plus.");
    for (const s of f.sources) {
      if (!/^https:\/\/\S+$/.test(s.adresse) || s.intitule.trim() === "") ko("sources", "Sources : intitulé et adresse https attendus.");
      const ms = motInterdit(s.intitule);
      if (ms) ko("sources", `Sources : mot interdit (${ms}).`);
      if (!dateValide(s.dateConsultation)) ko("sources", "Sources : date de consultation AAAA-MM-JJ attendue.");
    }
  }
  return d;
}

/** Robots (26) : indexable seulement après validation. */
export const robotsDe = (statut: StatutFiche): "index,follow" | "noindex,nofollow" =>
  statut === "valide" || statut === "publie" ? "index,follow" : "noindex,nofollow";

/** Données structurées (25) : page, fil d'Ariane, questions fréquentes, vidéo, tirées exactement du texte de la fiche. */
export function genererDonneesStructurees(
  c: ContenuFiche,
  canonique: string,
  dates: { datePublication?: string; dateMiseAJour?: string } = {},
): Array<Record<string, unknown>> {
  const ctx = "https://schema.org";
  const out: Array<Record<string, unknown>> = [
    { "@context": ctx, "@type": "WebPage", name: c.titre, description: c.metaDescription, url: canonique, inLanguage: "fr", ...(dates.datePublication ? { datePublished: dates.datePublication } : {}), ...(dates.dateMiseAJour ? { dateModified: dates.dateMiseAJour } : {}), author: { "@type": "Organization", name: c.auteur } },
    {
      "@context": ctx, "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Automatisations", item: CHEMIN_PAGES },
        { "@type": "ListItem", position: 2, name: c.h1, item: canonique },
      ],
    },
    {
      "@context": ctx, "@type": "FAQPage",
      mainEntity: (c.questions ?? []).map((q) => ({ "@type": "Question", name: q.question, acceptedAnswer: { "@type": "Answer", text: q.reponse } })),
    },
  ];
  if (c.video) {
    out.push({ "@context": ctx, "@type": "VideoObject", name: c.video.titre, description: c.video.description, duration: `PT${Math.floor(c.video.dureeSec / 60)}M${c.video.dureeSec % 60}S`, transcript: c.transcription });
  }
  return out;
}

/** Hub : classement des fiches validées par type et par besoin (liste fermée, dans l'ordre de la liste). */
export interface Classement {
  parType: Record<TypeAutomatisation, string[]>;
  parBesoin: Record<BesoinEntreprise, string[]>;
}
export function classerParHub(fiches: Array<Pick<FicheDePage, "id" | "statut" | "type" | "besoins">>): Classement {
  const parType = Object.fromEntries(TYPES_AUTOMATISATION.map((t) => [t, [] as string[]])) as Classement["parType"];
  const parBesoin = Object.fromEntries(BESOINS_ENTREPRISE.map((b) => [b, [] as string[]])) as Classement["parBesoin"];
  for (const f of fiches) {
    if (f.statut !== "valide" && f.statut !== "publie") continue;
    if (f.type) parType[f.type].push(f.id);
    for (const b of f.besoins ?? []) parBesoin[b].push(f.id);
  }
  return { parType, parBesoin };
}
