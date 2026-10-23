/**
 * GARDE D'HONNÊTETÉ DE LA PORTE B (tâche P2-01, plan cas concret § 4-i). PUR, sans accès au serveur.
 *
 * Un texte libre de Will devient un cas « offre » : ce que le site vend, jamais ce qu'Axion-IA ferait « chez nous ». La garde
 * refuse, sans rien corriger :
 *  - la description elle-même quand elle est trop courte ou raconte un usage réel ou un client (`verifierDescription`) ;
 *  - le cas rendu (`reglesHonnetete`) : posture autre qu'« offre », vrai écran, phrase de conformité, vérification « en
 *    service » ou validation de Will ; nombre absent du texte de Will ou des faits du cas ; récit de client ; tournure
 *    d'usage réel ; nom propre hors liste blanche ; avis ou témoignage ; mot interdit ; tutoiement ; promesse qui ne
 *    s'adresse pas au public ; document promis différent du cadeau de l'offre.
 *  - la fiche d'écrans d'un cas de la porte B (`honneteteDeLaFiche`) : étiquette « Exemple » sur l'accroche, aucun vrai
 *    écran, aucune preuve de conformité.
 *
 * Les listes et les lectures (nombres, noms propres, tournures) sont celles des règles de la fiche (`regles.ts`) : la porte
 * B est jugée comme R12, R14 et R15, plus sévèrement (aucun fait n'est validé par Will).
 */
import { raconteUnClient } from "@/domaine/controles-script";
import { contientExpression, texteCompare } from "@/domaine/controles-script/texte";
import type { CasConcret, FaitCas } from "@/formats/cas-concret/cas";
import type { FicheEcrans } from "./fiche";
import { LISTE_BLANCHE_NOMS, MOTS_INTERDITS_FORMAT, MOTS_TEMOIGNAGE, TOURNURES_USAGE_REEL, nomsPropres, nombresDe, problemesDuCas, sansPointsDeSigle, tutoie } from "./regles";

/** Étiquette montrée sur l'accroche d'une vidéo de la porte B (plan § 4-i). */
export const ETIQUETTE_EXEMPLE = "Exemple";

/**
 * Longueur minimale d'une description, en caractères. Le plan dit 80, mais l'exemple de la fiche de tâche (le cabinet
 * comptable, 77 caractères) doit passer : 60 garde le refus d'un texte d'une ligne (40 caractères) sans refuser l'exemple.
 */
export const DESCRIPTION_CARACTERES_MIN = 60;
export const DESCRIPTION_CARACTERES_MAX = 1500;
export const MESSAGE_DESCRIPTION_COURTE = "Décrivez le cas en deux phrases.";
/** Phrase d'aide d'une description hors sujet (aucune tâche de travail reconnue) : aucun appel n'est fait. */
export const MESSAGE_DESCRIPTION_HORS_SUJET = "Décrivez une tâche de votre métier : qui la fait aujourd'hui, et comment.";
/** Mots distincts (3 lettres au moins) qu'une description doit compter. */
export const DESCRIPTION_MOTS_MIN = 6;

/**
 * Racines d'un texte qui parle de travail (une tâche, un document, un outil, un geste du métier). Une description qui
 * n'en contient aucune est hors sujet : une phrase d'aide, aucun appel payant.
 */
const RACINES_TRAVAIL = [
  "tach", "travail", "metier", "equipe", "salarie", "collabor", "client", "prospect", "fournisseur", "patient", "eleve", "candidat",
  "devis", "factur", "commande", "contrat", "dossier", "fichier", "document", "courrier", "mail", "message", "formulaire", "tableau",
  "rapport", "compte rendu", "planning", "agenda", "rendez", "reunion", "appel", "telephone", "stock", "inventaire", "paie", "note de frais",
  "logiciel", "outil", "crm", "erp", "excel", "site", "application", "base", "donnee",
  "saisi", "recopi", "relanc", "gestion", "envoi", "envoy", "verifi", "class", "tri", "repond", "prepar", "rempli", "trait", "ger", "suiv", "calcul",
  "redig", "cherch", "noter", "valid", "form", "automatis", "reli", "plan", "organis", "factur", "compt", "recrut", "vend", "achet",
  "entreprise", "cabinet", "agence", "boutique", "magasin", "atelier", "service", "bureau", "societe", "artisan", "commerc",
];

const motsDuTexte = (t: string): string[] => texteCompare(t).replace(/'/g, " ").split(" ").filter((m) => m.length >= 3);

/** Vrai quand la description ne parle d'aucune tâche de travail (trop peu de mots, ou aucune racine du métier). */
export function descriptionHorsSujet(texteDeWill: string): boolean {
  const mots = [...new Set(motsDuTexte(texteDeWill))];
  if (mots.length < DESCRIPTION_MOTS_MIN) return true;
  const t = ` ${texteCompare(texteDeWill).replace(/'/g, " ")}`;
  return !RACINES_TRAVAIL.some((r) => t.includes(` ${r}`));
}

/** Tournures d'usage réel refusées en porte B : celles de R15, plus celles du plan § 4-i. */
export const TOURNURES_PORTE_B: readonly string[] = [
  ...TOURNURES_USAGE_REEL,
  "nos clients", "nos clientes", "notre client", "notre cliente", "notre outil", "nos outils", "notre logiciel",
  "on a mis en place", "nous avons mis en place", "on a installé", "nous avons installé", "chez Axion-IA",
];

/** Une raison de refus, en français, avec l'endroit du cas qu'elle vise. */
export interface RefusHonnetete {
  lieu: string;
  message: string;
}

/* ------------------------------------------------------------------ */
/* Lectures                                                              */
/* ------------------------------------------------------------------ */

/** Nombres d'un texte (en chiffres ou en lettres, « une heure » compte), comme R12. */
export const nombresDuTexte = (t: string): number[] => nombresDe(sansPointsDeSigle(t));

/** Phrases d'un texte (coupées après « . », « ! », « ? », « … »). */
export function phrases(t: string): string[] {
  return t
    .split(/(?<=[.!?…])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Tous les textes libres d'un cas, avec leur endroit lisible (la source d'un fait, note interne, n'en est pas). */
export function textesDuCas(cas: CasConcret): { lieu: string; texte: string }[] {
  const res: { lieu: string; texte: string }[] = [
    { lieu: "le titre", texte: cas.titre },
    { lieu: "la promesse", texte: cas.promesse },
    { lieu: "la cible", texte: cas.cible },
    ...cas.avant.taches.map((t, i) => ({ lieu: `la tâche « avant » ${i + 1}`, texte: t })),
    ...(cas.avant.total ? [{ lieu: "le total « avant »", texte: cas.avant.total }] : []),
    ...cas.etapes.flatMap((e, i) => [
      { lieu: `le titre de l'étape ${i + 1}`, texte: e.titre },
      { lieu: `la ligne de l'étape ${i + 1}`, texte: e.ligne },
      { lieu: `le détail de l'étape ${i + 1}`, texte: e.detail },
    ]),
    { lieu: "ce qui reste humain", texte: cas.resteHumain },
    { lieu: "le résultat", texte: cas.resultat },
    ...cas.faits.map((f, i) => ({ lieu: `le fait ${i + 1}`, texte: f.enonce })),
    { lieu: "le document promis", texte: cas.documentPromis.nom },
    ...cas.vigilance.map((v, i) => ({ lieu: `le point de vigilance ${i + 1}`, texte: v })),
  ];
  if (cas.conformite?.rgpd) res.push({ lieu: "la conformité", texte: cas.conformite.rgpd.phrase });
  return res;
}

/** Textes qui ne disent pas un nombre au public : l'énoncé d'un fait (il le porte), la vigilance, le document promis. */
const LIEUX_SANS_FAIT = /^(le fait |le point de vigilance |le document promis)/;

const DEUXIEME_PERSONNE = ["vous", "votre", "vos"];
const sAdresseAuPublic = (t: string): boolean => DEUXIEME_PERSONNE.some((m) => contientExpression(t, m));
const cite = (xs: readonly (string | number)[]) => xs.map((x) => `« ${String(x).replace(".", ",")} »`).join(", ");

/* ------------------------------------------------------------------ */
/* La description de Will                                                */
/* ------------------------------------------------------------------ */

/** Juge la description AVANT tout appel : longueur, usage réel, récit de client. Liste vide : la description passe. */
export function verifierDescription(texteDeWill: string): string[] {
  const t = texteDeWill.trim();
  if (t.length < DESCRIPTION_CARACTERES_MIN) return [MESSAGE_DESCRIPTION_COURTE];
  if (descriptionHorsSujet(t)) return [MESSAGE_DESCRIPTION_HORS_SUJET];
  const refus: string[] = [];
  if (t.length > DESCRIPTION_CARACTERES_MAX) refus.push(`Description trop longue : ${DESCRIPTION_CARACTERES_MAX} caractères au plus.`);
  const tournure = TOURNURES_PORTE_B.find((x) => contientExpression(t, x));
  if (tournure) refus.push(`« ${tournure} » décrit un usage réel. Décrivez ce que l'offre ferait pour une entreprise ; un usage réel passe par le catalogue.`);
  if (phrases(t).some(raconteUnClient)) refus.push("La description raconte un client. Décrivez une situation type, sans client réel.");
  return refus;
}

/* ------------------------------------------------------------------ */
/* Le cas rendu                                                          */
/* ------------------------------------------------------------------ */

/**
 * Règles d'honnêteté d'un cas de la porte B, toutes bloquantes. Le seul matériau permis est le texte de Will : aucun
 * nombre qui n'y figure pas. Liste vide : le cas passe.
 */
export function reglesHonnetete(cas: CasConcret, texteDeWill: string): RefusHonnetete[] {
  const refus: RefusHonnetete[] = [];
  const ajouter = (lieu: string, message: string) => refus.push({ lieu, message });

  // Ce que la porte B ne porte jamais.
  if (cas.posture !== "offre") ajouter("la posture", "Un cas décrit librement est une offre, jamais un usage « chez nous ».");
  if (cas.conformite) ajouter("la conformité", "Aucune phrase de conformité en porte B : seule une phrase validée par Will peut en tenir lieu.");
  if (cas.enServiceVerifie) ajouter("la vérification", "Un cas décrit librement n'est jamais dit « en service ».");
  if (cas.valideParWill) ajouter("la validation", "Un cas décrit librement n'arrive jamais validé : la validation se fait à l'écran.");
  cas.etapes.forEach((e, i) => {
    if (e.visuel.sorte !== "objet") ajouter(`le visuel de l'étape ${i + 1}`, "Aucun vrai écran en porte B : chaque étape est montrée par un objet dessiné.");
  });

  // Aucun nombre absent du texte de Will.
  const permis = new Set(nombresDuTexte(texteDeWill));
  const textes = textesDuCas(cas);
  for (const { lieu, texte } of textes) {
    const libres = [...new Set(nombresDuTexte(texte))].filter((n) => !permis.has(n));
    if (libres.length) ajouter(lieu, `${cite(libres)} ne figure${libres.length > 1 ? "nt" : ""} pas dans la description : aucun nombre inventé.`);
  }
  cas.faits.forEach((f, i) => {
    const libres = f.valeurs.filter((v) => !permis.has(v));
    if (libres.length) ajouter(`les valeurs du fait ${i + 1}`, `${cite(libres)} ne figure${libres.length > 1 ? "nt" : ""} pas dans la description : aucun nombre inventé.`);
  });

  // P2R (catalogue durci) : un nombre dit par le cas est la valeur d'un de ses faits.
  const valeurs = new Set(cas.faits.flatMap((f) => f.valeurs));
  for (const { lieu, texte } of textes.filter((x) => !LIEUX_SANS_FAIT.test(x.lieu))) {
    const sansFait = [...new Set(nombresDuTexte(texte))].filter((n) => permis.has(n) && !valeurs.has(n));
    if (sansFait.length) ajouter(lieu, `${cite(sansFait)} n'est la valeur d'aucun fait du cas : reprenez la phrase de la description en fait.`);
  }

  // Ni client, ni usage réel, ni nom propre, ni avis, ni mot interdit, ni tutoiement.
  for (const { lieu, texte } of textes) {
    if (phrases(texte).some(raconteUnClient)) ajouter(lieu, `« ${texte} » raconte un client : un cas décrit librement n'en raconte jamais.`);
    const tournure = TOURNURES_PORTE_B.find((x) => contientExpression(texte, x));
    if (tournure) ajouter(lieu, `« ${texte} » dit « ${tournure} » : un cas décrit librement est une offre, pas un usage réel.`);
    const noms = nomsPropres(texte);
    if (noms.length) ajouter(lieu, `« ${texte} » cite ${cite(noms)} : aucun nom propre hors ${LISTE_BLANCHE_NOMS.join(", ")}.`);
    const avis = MOTS_TEMOIGNAGE.find((m) => contientExpression(texte, m));
    if (avis) ajouter(lieu, `« ${texte} » contient « ${avis} » : aucun avis ni témoignage.`);
    const interdit = MOTS_INTERDITS_FORMAT.find((m) => contientExpression(texte, m));
    if (interdit) ajouter(lieu, `« ${texte} » contient le mot interdit « ${interdit} ».`);
    if (tutoie(texte)) ajouter(lieu, `« ${texte} » tutoie : vouvoiement seulement.`);
  }

  // L'accroche dit la promesse : elle s'adresse au public.
  if (!sAdresseAuPublic(cas.promesse)) ajouter("la promesse", `« ${cas.promesse} » ne s'adresse pas au public : écrivez-la à la deuxième personne (vous, votre, vos).`);

  // Le document promis est le cadeau annoncé par la fin de l'offre.
  for (const p of problemesDuCas(cas)) ajouter("le document promis", p.message);

  return refus;
}

/* ------------------------------------------------------------------ */
/* Les faits à confirmer (P2S)                                           */
/* ------------------------------------------------------------------ */

/** Texte comparé d'un énoncé : sans accent, sans ponctuation, l'apostrophe en espace. */
const compare = (t: string): string => texteCompare(t).replace(/'/g, " ").replace(/\s+/g, " ").trim();

/**
 * Faits d'un cas de la porte B que Will n'a pas donnés tels quels : l'énoncé ne se retrouve pas, mot pour mot, dans sa
 * description (un nombre réécrit en chiffres, une phrase reformulée) et ne vient pas du site. Chacun est montré « à
 * confirmer » et bloque la fabrication (`refusAvantPrix`) tant que Will ne l'a ni confirmé ni retiré.
 */
export function faitsAConfirmer(cas: Pick<CasConcret, "faits">, texteDeWill: string): FaitCas[] {
  const description = ` ${compare(texteDeWill)} `;
  return cas.faits.filter((f) => f.source !== "site" && !description.includes(` ${compare(f.enonce)} `));
}

/** Une raison de refus en une ligne : « endroit : message ». */
export const texteRefus = (r: RefusHonnetete): string => `${r.lieu.charAt(0).toUpperCase()}${r.lieu.slice(1)} : ${r.message}`;

/* ------------------------------------------------------------------ */
/* La fiche d'écrans d'un cas de la porte B                              */
/* ------------------------------------------------------------------ */

/**
 * Ce que la fiche d'un cas de la porte B doit montrer : l'étiquette « Exemple » sur l'accroche, aucun vrai écran, aucune
 * preuve de conformité. Fiche de la porte A : rien à dire.
 */
export function honneteteDeLaFiche(fiche: Pick<FicheEcrans, "origine" | "ecrans">): RefusHonnetete[] {
  if (fiche.origine !== "porte-b") return [];
  const refus: RefusHonnetete[] = [];
  for (const e of fiche.ecrans) {
    const lieu = `l'écran ${e.id}`;
    if (e.type === "accroche" && e.etiquette !== ETIQUETTE_EXEMPLE) refus.push({ lieu, message: `l'accroche porte « ${e.etiquette} » ; un cas décrit librement porte l'étiquette « ${ETIQUETTE_EXEMPLE} ».` });
    if ((e.type === "etape" || e.type === "objet") && e.visuel.sorte !== "objet") refus.push({ lieu, message: "aucun vrai écran en porte B." });
    if (e.type === "preuve") refus.push({ lieu, message: "aucune preuve de conformité en porte B." });
  }
  if (!fiche.ecrans.some((e) => e.type === "accroche")) refus.push({ lieu: "la fiche", message: `aucune accroche ne porte l'étiquette « ${ETIQUETTE_EXEMPLE} ».` });
  return refus;
}
