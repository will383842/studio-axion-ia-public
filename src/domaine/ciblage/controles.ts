/** Contrôles purs du ciblage (aucune entrée-sortie). */
import { LONGUEUR_MAX_LIBELLE, TYPES_AUTOMATISATION, type Ciblage, type TailleId, type TypeAutomatisation } from "./types";

export function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'`]/g, " ")
    .replace(/[^a-z0-9€%\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MOTS_VIDES = new Set(["de", "du", "des", "d", "la", "le", "les", "l", "un", "une", "en", "et", "a", "au", "aux", "pour", "sur", "vos", "votre", "mes", "mon", "ma", "ce", "ces", "dans", "par", "avec", "sans", "vous", "je", "tu", "il", "on"]);

function racine(mot: string): string {
  return mot.length > 3 && /[sx]$/.test(mot) ? mot.slice(0, -1) : mot;
}

function mots(texte: string): string[] {
  return normaliser(texte).split(" ").filter(Boolean).map(racine);
}

function contientSuite(haystack: string[], aiguille: string[]): boolean {
  if (aiguille.length === 0) return false;
  for (let i = 0; i + aiguille.length <= haystack.length; i++) {
    if (aiguille.every((m, j) => haystack[i + j] === m)) return true;
  }
  return false;
}

const SYNONYMES_TAILLE: Record<TailleId, string[]> = {
  TPE: ["tpe", "petite entreprise", "tres petite entreprise", "micro entreprise", "microentreprise", "tout petite entreprise"],
  PME: ["pme", "moyenne entreprise", "petite et moyenne entreprise", "petites et moyennes entreprises"],
  ETI: ["eti", "entreprise de taille intermediaire", "grosse entreprise"],
};

function tailleDansTexte(texte: string): TailleId | null {
  const m = mots(texte);
  const trouvees = (Object.keys(SYNONYMES_TAILLE) as TailleId[]).filter((t) => SYNONYMES_TAILLE[t].some((s) => contientSuite(m, mots(s))));
  // « petite et moyenne entreprise » contient aussi « moyenne entreprise » : même taille (PME).
  return trouvees.length === 1 ? trouvees[0] : trouvees.includes("PME") && !trouvees.includes("ETI") ? "PME" : null;
}

/** Vrai si la cible est nommée dans le texte (sans accents ni casse, singulier ou pluriel, élisions). */
export function cibleNommee(texteDebut: string, ciblage: Ciblage): boolean {
  const m = mots(texteDebut);
  if (ciblage.niveau === "taille") {
    const id = (["TPE", "PME", "ETI"] as TailleId[]).find((t) => mots(ciblage.libelle).includes(racine(t.toLowerCase())));
    return id ? SYNONYMES_TAILLE[id].some((s) => contientSuite(m, mots(s))) : false;
  }
  const utiles = mots(ciblage.libelle).filter((x) => !MOTS_VIDES.has(x));
  return utiles.length > 0 && utiles.every((x) => m.includes(x));
}

/** Les 5 premières secondes parlées (~13 mots à 2,6 mots par seconde). */
export function debutParle(texte: string, motsParSeconde = 2.6): string {
  const n = Math.max(1, Math.round(5 * motsParSeconde));
  return texte.trim().split(/\s+/).filter(Boolean).slice(0, n).join(" ");
}

/** Un gain concret en temps, argent, erreurs, clients ou délais. */
export function beneficeClair(texte: string): boolean {
  const t = normaliser(texte);
  if (!t) return false;
  const chiffreUnite = /\d+\s*(h|heures?|minutes?|min|jours?|semaines?|mois|euros?|€|%|clients?)\b|\d+\s*(€|%)/.test(t);
  const gain = /\b(gagn\w*|econom\w*|evit\w*|divis\w*|reduis\w*|reduit\w*|fini|finis|plus jamais|plus vite|plus rapide\w*|zero|moins de)\b/.test(t);
  const domaine = /\b(temps|heures?|minutes?|jours?|semaines?|euros?|argent|couts?|erreurs?|oublis?|clients?|delais?|impayes?|retards?|factures?|devis|prospects?|ventes?)\b/.test(t);
  return chiffreUnite || (gain && domaine);
}

const MOTS_CLES_TYPE: Record<TypeAutomatisation, RegExp> = {
  "devis-factures": /\b(devis|factur\w*)\b/,
  "relances-impayes": /\b(relanc\w*|impaye\w*|retards? de paiement)\b/,
  "emails-messages": /\b(e ?mails?|mails?|courriels?|messages?|messagerie|boite de reception)\b/,
  "comptes-rendus": /\b(comptes? rendus?|notes? de reunion|reunions?|transcri\w*)\b/,
  "rendez-vous-planning": /\b(rendez vous|rdv|planning|agenda|calendrier)\b/,
  recrutement: /\b(recrut\w*|candidat\w*|cv|embauch\w*)\b/,
  "suivi-commercial": /\b(prospect\w*|suivi commercial|crm|leads?|pipeline)\b/,
  "documents-signatures": /\b(signature\w*|signer|contrats?|documents? administratifs?|paperasse)\b/,
  "publication-contenu": /\b(publi\w*|reseaux sociaux|linkedin|contenus?|posts?)\b/,
  "donnees-ia-sure": /\b(donnees (protegees|sensibles|confidentielles)|rgpd|confidentialite|ia sure|fuite de donnees)\b/,
  "former-equipes": /\b(former|formation|equipes?|collaborateurs?|salaries?)\b/,
  "trouver-quoi-automatiser": /\b(quoi automatiser|que automatiser|taches? a automatiser|par ou commencer)\b/,
};

/** Renvoie un type seulement si un seul correspond, sinon null (« À classer »). */
export function deduireTypeAutomatisation(texte: string): TypeAutomatisation | null {
  const t = normaliser(texte);
  const trouves = TYPES_AUTOMATISATION.map((x) => x.id).filter((id) => MOTS_CLES_TYPE[id].test(t));
  return trouves.length === 1 ? trouves[0] : null;
}

const METIERS = ["plombier", "electricien", "comptable", "avocat", "coiffeur", "boulanger", "macon", "menuisier", "artisan", "architecte", "notaire", "medecin", "dentiste", "kinesitherapeute", "infirmier", "agent immobilier", "courtier", "consultant", "photographe", "restaurateur", "garagiste", "paysagiste", "peintre", "couvreur", "chauffagiste", "expert comptable", "formateur", "coach"];
const SECTEURS = ["batiment", "btp", "immobilier", "restauration", "sante", "commerce", "transport", "logistique", "industrie", "artisanat", "hotellerie", "agriculture", "assurance", "juridique", "education", "services"];
const AFFICHAGE: Record<string, string> = { electricien: "électricien", macon: "maçon", medecin: "médecin", kinesitherapeute: "kinésithérapeute", batiment: "bâtiment", sante: "santé", "expert comptable": "expert-comptable", hotellerie: "hôtellerie", education: "éducation" };

function trouverDans(liste: string[], texte: string): string[] {
  const m = mots(texte);
  return liste.filter((x) => contientSuite(m, mots(x)));
}

/** Déduit un ciblage d'un texte libre ; null si rien (ou plusieurs cibles) de reconnu. */
export function deduireCiblage(texteLibre: string): Ciblage | null {
  const taille = tailleDansTexte(texteLibre);
  const metiers = trouverDans(METIERS, texteLibre);
  const secteurs = trouverDans(SECTEURS, texteLibre);
  const total = (taille ? 1 : 0) + metiers.length + secteurs.length;
  if (total !== 1) return null;
  const faire = (niveau: Ciblage["niveau"], brut: string): Ciblage => ({ niveau, libelle: (AFFICHAGE[brut] ?? brut).slice(0, LONGUEUR_MAX_LIBELLE), origine: "deduite" });
  if (taille) return { niveau: "taille", libelle: taille, origine: "deduite" };
  if (metiers.length) return faire("metier", metiers[0]);
  return faire("secteur", secteurs[0]);
}
