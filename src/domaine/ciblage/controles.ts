/** Contrôles purs du ciblage (aucune entrée-sortie). */
import { LONGUEUR_MAX_LIBELLE, TYPES_AUTOMATISATION, type Ciblage, type NiveauCible, type TailleId, type TypeAutomatisation } from "./types";

export function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'`]/g, " ")
    .replace(/-/g, " ")
    .replace(/[^a-z0-9€%\s]/g, " ")
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
  return trouvees.length === 1 ? trouvees[0] : null;
}

/** Racine commune au masculin et au féminin (électricienne → électricien), pour comparer deux mots. */
function racineGenre(mot: string): string {
  const m = racine(mot);
  if (m.endsWith("ienne")) return m.slice(0, -2);
  if (m.endsWith("euse")) return `${m.slice(0, -4)}eur`;
  if (m.endsWith("trice")) return `${m.slice(0, -5)}teur`;
  return m.length > 4 && m.endsWith("e") ? m.slice(0, -1) : m;
}

function motsUtiles(texte: string): string[] {
  return normaliser(texte).split(" ").filter((x) => x && !MOTS_VIDES.has(x)).map(racineGenre);
}

/** Vrai si la cible est nommée dans le texte (sans accents ni casse, singulier ou pluriel, féminin, élisions), mots dans l'ordre et côte à côte. */
export function cibleNommee(texteDebut: string, ciblage: Ciblage): boolean {
  if (ciblage.niveau === "taille") {
    const id = tailleDansTexte(ciblage.libelle);
    const m = mots(texteDebut);
    return id ? SYNONYMES_TAILLE[id].some((s) => contientSuite(m, mots(s))) : false;
  }
  return contientSuite(motsUtiles(texteDebut), motsUtiles(ciblage.libelle));
}

/** Libellé de cible acceptable : non vide après trim, une seule ligne, 80 caractères au plus. */
export function libelleCibleValide(texte: string): boolean {
  const t = texte.trim();
  return t.length > 0 && t.length <= LONGUEUR_MAX_LIBELLE && !/[\r\n]/.test(t);
}

export interface EtatChoixCible {
  niveau?: NiveauCible;
  valeur: string;
}

/** Transition pure de l'écran de choix de cible : changer de niveau ouvre l'étape 2 et vide la valeur. */
export function appliquerChoix(etat: EtatChoixCible, evenement: { type: "niveau"; niveau: NiveauCible } | { type: "valeur"; valeur: string }): EtatChoixCible {
  if (evenement.type === "valeur") return { ...etat, valeur: evenement.valeur };
  return evenement.niveau === etat.niveau ? etat : { niveau: evenement.niveau, valeur: "" };
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
  const trouvees = [
    ...trouverDans(METIERS, texteLibre).map((brut) => ({ niveau: "metier" as const, brut })),
    ...trouverDans(SECTEURS, texteLibre).map((brut) => ({ niveau: "secteur" as const, brut })),
  ];
  // Une cible incluse dans une autre plus longue (comptable / expert comptable) n'est pas une seconde cible.
  const retenues = trouvees.filter((c) => !trouvees.some((d) => d !== c && mots(d.brut).length > mots(c.brut).length && contientSuite(mots(d.brut), mots(c.brut))));
  if ((taille ? 1 : 0) + retenues.length !== 1) return null;
  if (taille) return { niveau: "taille", libelle: taille, origine: "deduite" };
  const { niveau, brut } = retenues[0];
  return { niveau, libelle: (AFFICHAGE[brut] ?? brut).slice(0, LONGUEUR_MAX_LIBELLE), origine: "deduite" };
}
