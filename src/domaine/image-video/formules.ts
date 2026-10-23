/**
 * IMAGE → VIDÉO · Formules absolues (plan § 2 et § 4, I7). PUR.
 *
 * Une image d'Axion-IA promet parfois plus qu'une vidéo ne peut tenir (« Zéro erreur », « 0 demande perdue », « dès le
 * premier jour »). Le code les REPÈRE et propose une version prudente ; rien n'est remplacé en silence : Will choisit
 * « garder » ou « reformuler » à la validation du script (bloquant tant que ce n'est pas tranché).
 */

export interface FormuleTrouvee {
  /** La formule telle qu'écrite (« Zéro erreur », « 0 demande perdue »). */
  texte: string;
  /** Champ de la carte qui la porte (« phraseChoc », « noeuds.n12.detail »…). */
  ou: string;
  /** Le texte entier du champ, avec la formule remplacée par sa version prudente. */
  proposition: string;
}

interface RegleFormule {
  re: RegExp;
  /** Version prudente de la formule trouvée. */
  prudente: (trouve: string, m: RegExpExecArray) => string;
}

/** Garde la majuscule initiale de la formule remplacée. */
function memeCasse(modele: string, s: string): string {
  return /^\p{Lu}/u.test(modele) ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const L = "[\\p{L}'’-]";

/** Noms féminins fréquents sur les images d'Axion-IA que les terminaisons ne trahissent pas. */
const FEMININS = new Set(["demande", "question", "commande", "réponse", "erreur", "tâche", "facture", "relance", "personne", "minute", "heure", "seconde", "semaine", "plainte", "offre", "vente", "donnée", "saisie", "alerte", "urgence", "fiche", "candidature", "opportunité", "piste", "ligne", "note", "page", "case", "étape", "date", "visite", "perte", "panne", "faute", "requête", "enquête"]);
/** Noms masculins dont la terminaison ressemble à un féminin. */
const MASCULINS = new Set(["message", "e-mail", "mail", "appel", "client", "dossier", "ticket", "devis", "rendez-vous", "prospect", "contrat", "document", "lead", "retard", "oubli", "problème", "système", "groupe", "modèle", "silence", "échange", "courriel", "avis", "colis", "paiement", "rappel", "doublon", "incident", "litige", "patient", "élève", "stagiaire", "salarié", "collaborateur", "fournisseur", "partenaire", "membre", "compte", "rapport", "logiciel", "outil", "projet", "service", "produit", "article", "lien", "fichier", "formulaire", "café", "génie", "lycée", "musée", "trophée"]);
/** Terminaisons presque toujours féminines (« -tion », « -té », « -ure »…). */
const TERMINAISONS_FEMININES = /(?:tion|sion|xion|té|ure|ance|ence|ette|elle|esse|ise|ade|ude|ée|ie|ière|ine|aine)$/u;

/**
 * « presque aucun » / « presque aucune » accordé au nom écrit (« 0 question sans réponse », « 0 message sans réponse ») ;
 * un nom au pluriel (« 0 clients … ») prend « presque plus de », qui ne s'accorde pas.
 */
function quantiteNulle(nom: string): string {
  const n = nom.toLowerCase();
  if (/[sx]$/u.test(n) && !MASCULINS.has(n) && !FEMININS.has(n)) return "presque plus de";
  const feminin = FEMININS.has(n) || (!MASCULINS.has(n) && TERMINAISONS_FEMININES.test(n));
  return feminin ? "presque aucune" : "presque aucun";
}
/** « perdu », « perdue », « perdus », « perdues ». */
const PERDU = "perdu(?:e|s|es)?";

/** Liste des formules absolues (plan § 2), de la plus précise à la plus large : une position n'est prise qu'une fois. */
export const REGLES_FORMULES: readonly RegleFormule[] = [
  { re: /(?<![\p{L}\p{N}])(?:z[ée]ro|0)\s+erreurs?(?![\p{L}])/giu, prudente: (t) => memeCasse(t, "presque plus d'erreurs") },
  { re: /(?<![\p{L}])risque\s+(?:d['’]\s*)?erreurs?\s*:\s*z[ée]ro(?![\p{L}])/giu, prudente: (t) => memeCasse(t, "risque d'erreur : très faible") },
  {
    re: new RegExp(`(?<![\\p{L}\\p{N}])(?:z[ée]ro|0)\\s+(${L}+)\\s+(${PERDU})(?![\\p{L}])`, "giu"),
    // Le genre se lit sur « perdu » / « perdue » écrit sur l'image.
    prudente: (t, m) => memeCasse(t, `presque ${/e/.test(m[2].slice(5)) ? "aucune" : "aucun"} ${m[1]} ${m[2]}`),
  },
  {
    re: new RegExp(`(?<![\\p{L}\\p{N}])(?:z[ée]ro|0)\\s+(${L}+)\\s+sans\\s+(${L}+)`, "giu"),
    prudente: (t, m) => memeCasse(t, `${quantiteNulle(m[1])} ${m[1]} sans ${m[2]}`),
  },
  { re: /d[èe]s\s+le\s+(?:premier|1er)\s+jour(?![\p{L}])/giu, prudente: (t) => memeCasse(t, "dès les premiers jours") },
  { re: /(?<![\p{L}\p{N}])100\s?%/giu, prudente: () => "presque tout" },
  { re: /(?<![\p{L}])aucun\s+risque(?![\p{L}])/giu, prudente: (t) => memeCasse(t, "un risque réduit") },
  { re: /(?<![\p{L}])garanti(?:e|s|es)?(?![\p{L}])/giu, prudente: (t) => memeCasse(t, "visé") },
  { re: /(?<![\p{L}])(?<!presque\s+)toujours(?![\p{L}])/giu, prudente: (t) => memeCasse(t, "presque toujours") },
  { re: /(?<![\p{L}])(?<!presque\s+)jamais(?![\p{L}])/giu, prudente: (t) => memeCasse(t, "presque jamais") },
];

interface PriseFormule {
  debut: number;
  fin: number;
  texte: string;
  remplace: string;
}

/** Repérage commun : les formules d'un texte, sans chevauchement, dans l'ordre où elles apparaissent. */
function prisesDe(texte: string): PriseFormule[] {
  const prises: PriseFormule[] = [];
  for (const regle of REGLES_FORMULES) {
    const re = new RegExp(regle.re.source, regle.re.flags);
    for (let m = re.exec(texte); m; m = re.exec(texte)) {
      const debut = m.index;
      const fin = debut + m[0].length;
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      if (prises.some((p) => debut < p.fin && fin > p.debut)) continue;
      prises.push({ debut, fin, texte: m[0], remplace: regle.prudente(m[0], m) });
    }
  }
  return prises.sort((a, b) => a.debut - b.debut);
}

/**
 * UN SEUL passage : chaque formule repérée dont `veut(texte de la formule)` est vrai est remplacée par sa version
 * prudente, d'un coup (jamais de second repérage sur le texte déjà adouci). PUR.
 */
export function remplacerFormules(texte: string, veut: (formule: string) => boolean): string {
  let r = texte;
  for (const p of prisesDe(texte).reverse()) if (veut(p.texte)) r = r.slice(0, p.debut) + p.remplace + r.slice(p.fin);
  return r;
}

/** Formules absolues d'un texte, dans l'ordre où elles apparaissent. */
export function formulesAbsoluesDe(texte: string, ou: string): FormuleTrouvee[] {
  return prisesDe(texte)
    .map((p) => ({ texte: p.texte, ou, proposition: texte.slice(0, p.debut) + p.remplace + texte.slice(p.fin) }));
}
