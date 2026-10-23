/**
 * « vous » → « tu » d'une phrase déjà validée par Will (vérification E2E n° 2, parcours n° 8), PUR.
 *
 * Sert à UN cas : la limite validée au « vous » qui doit entrer dans un corps au « tu » (« + Tu »). Le sens et les mots
 * de Will sont gardés ; seules les formes d'adresse changent : sujet « vous » + verbe, impératif, « votre / vos »,
 * « vous » complément. Le genre du possessif est déduit du nom (petit lexique et terminaisons ; « ton » devant une
 * voyelle). Une phrase déjà au « tu » ressort inchangée.
 */

/** Verbes irréguliers : forme « vous » → [forme « tu » (indicatif), impératif]. */
const IRREGULIERS: Record<string, [string, string]> = {
  avez: ["as", "aie"],
  êtes: ["es", "sois"],
  faites: ["fais", "fais"],
  dites: ["dis", "dis"],
  allez: ["vas", "va"],
  pouvez: ["peux", "peux"],
  voulez: ["veux", "veux"],
  devez: ["dois", "dois"],
  savez: ["sais", "sache"],
  prenez: ["prends", "prends"],
  apprenez: ["apprends", "apprends"],
  comprenez: ["comprends", "comprends"],
  mettez: ["mets", "mets"],
  permettez: ["permets", "permets"],
  venez: ["viens", "viens"],
  devenez: ["deviens", "deviens"],
  revenez: ["reviens", "reviens"],
  tenez: ["tiens", "tiens"],
  obtenez: ["obtiens", "obtiens"],
  voyez: ["vois", "vois"],
  croyez: ["crois", "crois"],
  lisez: ["lis", "lis"],
  écrivez: ["écris", "écris"],
  attendez: ["attends", "attends"],
  répondez: ["réponds", "réponds"],
  vendez: ["vends", "vends"],
  perdez: ["perds", "perds"],
  entendez: ["entends", "entends"],
  rendez: ["rends", "rends"],
  recevez: ["reçois", "reçois"],
  connaissez: ["connais", "connais"],
  reconnaissez: ["reconnais", "reconnais"],
  partez: ["pars", "pars"],
  sortez: ["sors", "sors"],
  dormez: ["dors", "dors"],
  sentez: ["sens", "sens"],
  suivez: ["suis", "suis"],
  vivez: ["vis", "vis"],
  ayez: ["aies", "aie"],
  soyez: ["sois", "sois"],
  sachez: ["saches", "sache"],
};

/** Mots en « -ez » qui ne sont pas des verbes. */
const PAS_VERBES = new Set(["chez", "assez", "nez", "rez", "lez"]);

const FEMININS = new Set(
  "relance facture équipe entreprise boîte tâche erreur formule donnée saisie journée semaine question réponse vidéo idée méthode solution priorité offre prospection comptabilité trésorerie ia intelligence pme société clientèle base liste réunion décision marge perte charge mission procédure démarche organisation page fiche note messagerie banque activité affaire agence assistante boutique carrière cible commande concurrence conférence croissance demande dépense direction échéance énergie entreprise étape évolution facturation formation gestion habitude image information journée limite main matière mesure mise note opportunité partie pause personne place présentation preuve production promesse qualité raison recette règle relation rentabilité ressource retraite semaine signature situation stratégie structure tête vente visibilité voix équipe heure année minute fois vie santé famille cliente salariée stagiaire".split(" "),
);
const MASCULINS_EN_E = new Set("tableur outil logiciel client fichier temps chiffre devis mail courriel responsable patron collègue métier problème rôle budget système modèle service projet poste salarié dossier contrat compte groupe secteur marché travail planning agenda document rapport calcul résultat processus délai stock site réseau message bilan ordinateur téléphone".split(" "));

function estFeminin(nom: string): boolean {
  const n = nom.toLowerCase().replace(/s$/, "");
  if (FEMININS.has(n)) return true;
  if (MASCULINS_EN_E.has(n)) return false;
  return /(tion|sion|ure|ance|ence|ette|esse|ise|ie|ude|ade|ée|té|ière|euse|elle|ine|ité)$/.test(n);
}

const commenceParVoyelle = (mot: string) => /^[aeiouyhâàéèêëîïôöûùœ]/i.test(mot);

function avecCasse(modele: string, mot: string): string {
  return /^[A-ZÀ-Ý]/.test(modele) ? mot.charAt(0).toUpperCase() + mot.slice(1) : mot;
}

/** Radical d'un verbe du 1er groupe, avec l'accent ou le doublement du singulier (achetez → achèt, appelez → appell). */
function radicalSingulier(r: string): string {
  if (/(app|ren?ouv)el$/.test(r) || /j[e]t$/.test(r)) return r + r.at(-1);
  if (/[oua]y$/.test(r)) return r.slice(0, -1) + "i";
  // « achet » → « achèt », « préfér » → « préfèr », « intégr » → « intègr » ; jamais « pens », « regard ».
  return r.replace(/[eé]([^aeiouyéèêëàâîïôûù]|br|tr|gl|gr|cr|pl|vr|fl|bl)$/, "è$1");
}

/** Forme « tu » d'un verbe conjugué au « vous » (indicatif) ou à l'impératif. */
function conjuguer(vous: string, imperatif: boolean): string | null {
  const bas = vous.toLowerCase();
  if (PAS_VERBES.has(bas)) return null;
  const irr = IRREGULIERS[bas];
  if (irr) return avecCasse(vous, irr[imperatif ? 1 : 0]);
  if (/issez$/.test(bas)) return avecCasse(vous, bas.replace(/issez$/, "is"));
  if (!/ez$/.test(bas)) return null;
  const radical = bas.slice(0, -2);
  // « créez », « vérifiez » : le radical finit par une voyelle, on n'y touche pas.
  const r = /[aeiouyéè]$/.test(radical) && !/[oua]y$/.test(radical) ? radical : radicalSingulier(radical);
  return avecCasse(vous, imperatif ? `${r}e` : `${r}es`);
}

/** Convertit une phrase au « vous » en phrase au « tu ». */
export function vousVersTu(texte: string): string {
  let t = texte;
  // Formes figées.
  t = t.replace(/\bs'il vous plaît\b/gi, (m) => avecCasse(m, "s'il te plaît")).replace(/\bvous-mêmes?\b/gi, (m) => avecCasse(m, "toi-même"));
  // Question inversée : « pensez-vous » → « penses-tu ».
  t = t.replace(/\b([\wÀ-ÿ]+)-vous\b/g, (m, v: string) => {
    const c = conjuguer(v, false);
    return c ? `${c}-tu` : `${v}-toi`;
  });
  // Pronominal : « vous vous demandez » → « tu te demandes ».
  t = t.replace(/\b(vous) vous ([\wÀ-ÿ]+)\b/gi, (m, s: string, v: string) => {
    const c = conjuguer(v, false);
    return c ? `${avecCasse(s, "tu")} ${commenceParVoyelle(c) ? "t'" : "te "}${c}` : m;
  });
  // Sujet + verbe : « vous pensez » → « tu penses ».
  t = t.replace(/\b(vous) ([\wÀ-ÿ]+)\b/gi, (m, s: string, v: string) => {
    const c = conjuguer(v, false);
    return c ? `${avecCasse(s, "tu")} ${c}` : m;
  });
  // Complément après une préposition : « pour vous » → « pour toi ».
  t = t.replace(/\b(pour|chez|avec|sans|à|de|que|comme|sur|entre|derrière|devant|vers|selon) vous\b/gi, (m, p: string) => `${p} toi`);
  // Complément devant le verbe : « vous coûte » → « te coûte », « vous explique » → « t'explique ».
  t = t.replace(/\b(vous) ([\wÀ-ÿ]+)/gi, (m, s: string, mot: string) => (commenceParVoyelle(mot) ? `${avecCasse(s, "t'")}${mot}` : `${avecCasse(s, "te")} ${mot}`));
  // Verbes restants (« gardez-la », « et vérifiez-le ») : à l'indicatif si la proposition a déjà son « tu »
  // (« tu gardes et vérifies »), sinon à l'impératif.
  t = t.replace(/(?<![\wÀ-ÿ'-])([\wÀ-ÿ]+ez|faites|dites)(?=[\s,.!?:;-]|$)/gi, (m, v: string, i: number, tout: string) => {
    const proposition = tout.slice(0, i).split(/[.!?:;]/).at(-1) ?? "";
    const c = conjuguer(v, !/\btu\b/i.test(proposition));
    return c ?? m;
  });
  // Possessifs.
  t = t.replace(/\b(vos)\b/gi, (m) => avecCasse(m, "tes"));
  t = t.replace(/\b(votre) ([\wÀ-ÿ'-]+)/gi, (m, p: string, nom: string) => `${avecCasse(p, commenceParVoyelle(nom) || !estFeminin(nom) ? "ton" : "ta")} ${nom}`);
  t = t.replace(/\b(votre)\b/gi, (m) => avecCasse(m, "ton"));
  return t;
}

/** Vrai si la phrase porte encore une forme d'adresse au « vous ». */
export function porteLeVous(texte: string): boolean {
  return /\b(vous|votre|vos)\b/i.test(texte);
}
