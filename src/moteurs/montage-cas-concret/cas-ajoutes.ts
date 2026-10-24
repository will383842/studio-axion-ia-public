/**
 * CAS AJOUTÉ À LA MAIN (« Ajouter un cas », décision de Will du 24/10/2026). PUR : aucun accès au serveur, aucun appel payant.
 *
 * Le formulaire de Will (titre, offre, sujet, scène, étapes en quelques phrases…) devient un CAS que le CODE construit, comme
 * `casDuBrouillon` (porte B) construit celui de Claude : posture « offre », aucun fait chiffré, visuels « objet », document
 * promis et fin cadeau de l'offre, mot de l'offre. Il est ensuite contrôlé avec les mêmes garde-fous que le stock de 96 cas
 * (`gardes-textes-cas.ts`), le schéma strict de `cas.ts`, les règles du cas (`problemesDuCas`) et le refus avant le prix en
 * contexte neutre (`refusAvantPrix`), comme `scripts/importer-stock-cas.ts`. Un cas ajouté n'est JAMAIS « validé » par le code
 * (`valideParWill` n'est jamais posé) : sa validation est un réglage de Will (`casConcret.validations`, par empreinte).
 */
import { z } from "zod";
import { NATURES, OBJETS, OFFRES, PREFIXE_CAS_AJOUTE, verifierCas, type CasConcret, type ObjetCas } from "@/formats/cas-concret/cas";
import { refusAvantPrix } from "./avant-prix";
import { DOCUMENT_PAR_SORTE, sorteDe } from "./description";
import { couper } from "./ecriture";
import { motsClesParDefaut, refusTextesCas, type ChampTexte } from "./gardes-textes-cas";
import { cadeauDeLOffre, problemesDuCas } from "./regles";

/* ------------------------------------------------------------------ */
/* Bornes                                                                */
/* ------------------------------------------------------------------ */

export { PREFIXE_CAS_AJOUTE };
/** Taille maximale du formulaire entier, une fois en texte (anti-abus). */
export const FORMULAIRE_MAX_CARACTERES = 20_000;
export const SECTEURS_AJOUT = ["IN", "LT", "NB", "BT", "AS", "DG"] as const;
export const TAILLES_AJOUT = ["TPE", "PME", "ETI"] as const;

export const estIdCasAjoute = (id: unknown): id is string => typeof id === "string" && id.startsWith(PREFIXE_CAS_AJOUTE);

const nombreMots = (t: string): number => t.split(/\s+/).filter(Boolean).length;
const sansAccent = (t: string): string => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const texte = (max: number) => z.string().trim().min(1, "texte vide").max(max, `texte trop long (${max} caractères au plus)`);

/* ------------------------------------------------------------------ */
/* Le formulaire                                                         */
/* ------------------------------------------------------------------ */

const etapeFormulaire = z
  .object({
    ligne: texte(120),
    titre: texte(60).optional(),
    detail: texte(300).optional(),
    objet: z.enum(OBJETS).optional(),
  })
  .strict();

export const schemaFormulaireCas = z
  .object({
    titre: texte(100),
    theme: texte(30),
    offre: z.enum(OFFRES),
    nature: z.enum(NATURES).optional(),
    secteur: z.enum(SECTEURS_AJOUT).optional(),
    taille: z.enum(TAILLES_AJOUT).optional(),
    cible: texte(160),
    promesse: texte(100),
    sujet: texte(100),
    scene: texte(260),
    exemple: texte(80),
    motsCles: z.array(z.string().regex(/^[\p{L}-]{3,30}$/u, "mot clé de 3 à 30 lettres")).min(2).max(3).optional(),
    taches: z.array(texte(80)).min(2).max(6),
    etapes: z.array(etapeFormulaire).min(3, "au moins 3 étapes").max(7, "pas plus de 7 étapes"),
    resteHumain: texte(200),
    resteHumainApresEtape: z.number().int().min(1).max(7),
    resultat: texte(200),
    mot: z.string().trim().min(2).max(24),
  })
  .strict();

export type FormulaireCas = z.infer<typeof schemaFormulaireCas>;

/* ------------------------------------------------------------------ */
/* Valeurs par défaut                                                    */
/* ------------------------------------------------------------------ */

/** Les mots d'un texte, sans accent ni casse, pour reconnaître un objet à montrer. */
const motsDe = (t: string): string => ` ${sansAccent(t).replace(/[^a-z0-9]+/g, " ")} `;
const contient = (mots: string, ...racines: string[]): boolean => racines.some((r) => mots.includes(` ${r}`));

/** L'objet dessiné proposé pour une étape, d'après ce qu'elle dit (Will peut le changer). */
export function objetParDefaut(ligne: string): ObjetCas {
  const m = motsDe(ligne);
  if (contient(m, "mail", "courriel")) return "e-mail";
  if (contient(m, "rappel", "relanc", "notification", "sms", "message")) return "telephone-notification";
  if (contient(m, "rendez", "agenda", "creneau", "planning", "calendrier")) return "calendrier";
  if (contient(m, "rapport", "tableau", "synthese", "bilan")) return "rapport";
  if (contient(m, "dossier", "classe", "range", "archive")) return "dossier-classe";
  if (contient(m, "signature", "signe", "contrat", "devis")) return "contrat-signature";
  if (contient(m, "delai", "attente", "attend", "minute")) return "chrono";
  if (contient(m, "formation", "module", "programme", "parcours")) return "programme";
  if (contient(m, "outil", "logiciel", "crm", "relie", "connect")) return "outils-relies";
  if (contient(m, "controle", "verifie", "conforme", "valide")) return "bouclier-coche";
  return "carte-taches";
}

/** Le nom court d'une étape quand Will n'en donne pas : les 3 premiers mots de sa phrase. */
export const titreParDefaut = (ligne: string): string => couper(ligne.replace(/[.!?]+$/, ""), 3);

/** Le mot à commenter : majuscules, sans accent ni espace. */
export const motNormaliseAjout = (mot: string): string => sansAccent(mot).replace(/[^a-z0-9]/g, "").toUpperCase();

/** Le formulaire est-il lisible (schéma strict) ? Refus en phrases, un par champ. */
export function lireFormulaireCas(brut: unknown): { ok: true; formulaire: FormulaireCas } | { ok: false; raisons: string[] } {
  const lu = schemaFormulaireCas.safeParse(brut);
  if (lu.success) return { ok: true, formulaire: lu.data };
  return {
    ok: false,
    raisons: lu.error.issues.map((i) => {
      const lieu = i.path.length ? `${i.path.join(".")} : ` : "";
      if (i.code === "invalid_type") return `${lieu}valeur absente ou de mauvais type`;
      if (i.code === "unrecognized_keys") return `${lieu}champ inconnu`;
      if (i.code === "invalid_value") return `${lieu}valeur non permise`;
      return `${lieu}${i.message}`;
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Construction                                                          */
/* ------------------------------------------------------------------ */

/**
 * Le cas complet : le formulaire, plus ce que le code fixe seul (comme `casDuBrouillon`). Jamais `valideParWill`, jamais de fait.
 * `f.mot` est mis en majuscules sans accent.
 */
export function construireCasAjoute(f: FormulaireCas, { id, version }: { id: string; version: number }): unknown {
  const sorte = sorteDe({ offre: f.offre, nature: f.offre === "integration" ? (f.nature ?? "automatisation") : undefined });
  const nature = f.offre === "integration" ? (f.nature ?? "automatisation") : undefined;
  return {
    id,
    version,
    offre: f.offre,
    ...(nature ? { nature } : {}),
    posture: "offre",
    titre: f.titre,
    theme: f.theme,
    promesse: f.promesse,
    recit: { sujet: f.sujet, scene: f.scene, exemple: f.exemple, motsCles: f.motsCles ?? motsClesParDefaut(f.sujet) },
    cible: f.cible,
    avant: { taches: f.taches },
    etapes: f.etapes.map((e) => ({
      titre: e.titre ?? titreParDefaut(e.ligne),
      ligne: e.ligne,
      detail: e.detail ?? e.ligne,
      visuel: { sorte: "objet", objet: e.objet ?? objetParDefaut(e.ligne) },
    })),
    resteHumain: f.resteHumain,
    resteHumainApresEtape: f.resteHumainApresEtape,
    resultat: f.resultat,
    faits: [],
    documentPromis: { nom: DOCUMENT_PAR_SORTE[sorte], finCadeauId: cadeauDeLOffre(f.offre, nature) ?? "fin-if-cadeau-coaching" },
    mot: motNormaliseAjout(f.mot),
    vigilance: [],
  };
}

/** Les cas déjà connus que celui-ci ne doit pas répéter (catalogue et cas ajoutés). */
export type AutresCas = readonly Pick<CasConcret, "id" | "mot" | "theme" | "recit">[];

/** Contexte neutre du refus avant le prix : tous les réseaux, essai (ni validation ni voix), sans mot : comme l'import du stock. */
const RESEAUX_NEUTRES = ["facebook", "instagram", "tiktok", "linkedin"] as const;

const SIGLE = /(?<![\p{L}\p{N}])\p{Lu}{2,}(?![\p{L}\p{N}])/u;

const NOMS_CHAMPS: Record<string, string> = { titre: "Titre", theme: "Thème", promesse: "Promesse", cible: "Pour qui", resultat: "Résultat", resteHumain: "Ce qui reste humain", resteHumainApresEtape: "Partie humaine (étape)", mot: "Mot à commenter", offre: "Offre", nature: "Nature", "recit.sujet": "Sujet", "recit.scene": "Scène", "recit.exemple": "Exemple", "recit.motsCles": "Mots clés" };

/** « etapes.1.ligne : … » devient « Étape 2 : … » : les refus du schéma parlent comme le formulaire. */
function nomEnClair(raison: string): string {
  const m = /^([A-Za-z0-9_.]+) : ([\s\S]*)$/.exec(raison);
  if (!m) return raison;
  const chemin = m[1];
  const etape = /^etapes\.(\d+)(?:\.|$)/.exec(chemin);
  if (etape) return `Étape ${Number(etape[1]) + 1} : ${m[2]}`;
  const tache = /^avant\.taches\.(\d+)$/.exec(chemin);
  if (tache) return `Tâche ${Number(tache[1]) + 1} : ${m[2]}`;
  if (chemin === "etapes") return `Étapes : ${m[2]}`;
  if (chemin === "avant.taches") return `Tâches : ${m[2]}`;
  const nom = NOMS_CHAMPS[chemin] ?? NOMS_CHAMPS[chemin.split(".").slice(0, 2).join(".")];
  return nom ? `${nom} : ${m[2]}` : raison;
}

export type ResultatCasAjoute = { ok: true; cas: CasConcret } | { ok: false; raisons: string[] };

/**
 * Contrôle un cas construit par `construireCasAjoute` : schéma strict, garde des textes du stock, limites de mots que la
 * fabrication exige, unicité (id, mot, thème, sujet), règles du cas, refus avant le prix en contexte neutre. Rien n'est corrigé en
 * silence : chaque refus est une phrase qui dit quoi changer.
 */
export function verifierCasAjoute(brut: unknown, autres: AutresCas): ResultatCasAjoute {
  const lu = verifierCas(brut);
  if (!lu.ok) return { ok: false, raisons: lu.raisons.map(nomEnClair) };
  const cas = lu.cas;
  const raisons: string[] = [];
  if (!estIdCasAjoute(cas.id)) raisons.push(`Identifiant : un cas ajouté commence par « ${PREFIXE_CAS_AJOUTE} ».`);

  // Limites de mots que la fabrication exige (les mêmes que le stock de 96 cas).
  const limite = (nom: string, t: string, max: number) => {
    if (nombreMots(t) > max) raisons.push(`${nom} : ${nombreMots(t)} mots, ${max} au plus.`);
  };
  if (!cas.theme || nombreMots(cas.theme) > 2) raisons.push(`Thème : 1 ou 2 mots (« ${cas.theme ?? ""} »).`);
  limite("Promesse", cas.promesse, 8);
  if (cas.promesse.includes("?")) raisons.push("Promesse : sans point d'interrogation.");
  if (!/\.$/.test(cas.promesse.trim())) raisons.push("Promesse : finissez-la par un point.");
  if (cas.recit) limite("Sujet", cas.recit.sujet, 8);
  cas.avant.taches.forEach((t, i) => limite(`Tâche ${i + 1}`, t, 6));
  cas.etapes.forEach((e, i) => limite(`Étape ${i + 1}`, e.ligne, 12));
  limite("Ce qui reste humain", cas.resteHumain, 11);
  if (SIGLE.test(cas.resteHumain)) raisons.push("Ce qui reste humain : sans sigle (la voix le lirait lettre à lettre).");
  limite("Résultat", cas.resultat, 13);

  // Garde des textes : aucun nombre, nom propre, usage réel, je/nous/notre, mot interdit.
  const champs: ChampTexte[] = [
    { nom: "Titre", texte: cas.titre },
    { nom: "Thème", texte: cas.theme ?? "" },
    { nom: "Promesse", texte: cas.promesse },
    { nom: "Pour qui", texte: cas.cible },
    ...(cas.recit ? [{ nom: "Sujet", texte: cas.recit.sujet }, { nom: "Scène", texte: cas.recit.scene }, { nom: "Exemple", texte: cas.recit.exemple }] : []),
    ...cas.avant.taches.map((t, i) => ({ nom: `Tâche ${i + 1}`, texte: t })),
    ...cas.etapes.flatMap((e, i) => [{ nom: `Étape ${i + 1}`, texte: e.ligne }, { nom: `Étape ${i + 1} (nom court)`, texte: e.titre }, { nom: `Étape ${i + 1} (précision)`, texte: e.detail }]),
    { nom: "Ce qui reste humain", texte: cas.resteHumain },
    { nom: "Résultat", texte: cas.resultat },
  ];
  raisons.push(...refusTextesCas(champs, { Scène: { scene: true } }));

  // Unicité : identifiant, mot, thème, sujet.
  for (const a of autres) {
    if (a.id === cas.id) raisons.push("Identifiant : déjà pris, recommencez.");
    if (a.mot.toUpperCase() === cas.mot.toUpperCase()) raisons.push(`Mot à commenter : « ${cas.mot} » est déjà celui d'un autre cas.`);
    if (cas.theme && a.theme && a.theme.trim().toLowerCase() === cas.theme.trim().toLowerCase()) raisons.push(`Thème : « ${cas.theme} » est déjà celui d'un autre cas.`);
    if (cas.recit && a.recit && sansAccent(a.recit.sujet) === sansAccent(cas.recit.sujet)) raisons.push("Sujet : un autre cas a déjà ce sujet.");
  }

  if (!raisons.length) {
    for (const p of problemesDuCas(cas)) raisons.push(p.message);
    const refus = refusAvantPrix({ cas, reseaux: RESEAUX_NEUTRES, mot: cas.mot, avecMot: false, motSur: [], essai: true });
    if (refus) raisons.push(`Refus avant le prix : ${refus}`);
  }
  return raisons.length ? { ok: false, raisons: [...new Set(raisons)] } : { ok: true, cas };
}

/** Du formulaire (brut) au cas contrôlé : lecture stricte, construction, contrôle. Un seul appel pour les services et les tests. */
export function preparerCasAjoute(brut: unknown, { id, version = 1, autres }: { id: string; version?: number; autres: AutresCas }): ResultatCasAjoute & { formulaire?: FormulaireCas } {
  const f = lireFormulaireCas(brut);
  if (!f.ok) return { ok: false, raisons: f.raisons };
  const r = verifierCasAjoute(construireCasAjoute(f.formulaire, { id, version }), autres);
  return { ...r, formulaire: f.formulaire };
}

/* ------------------------------------------------------------------ */
/* Identifiant                                                           */
/* ------------------------------------------------------------------ */

const slug = (t: string): string =>
  sansAccent(t)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");

/** « ajout- » + thème en tirets + 4 caractères en base 36, changés tant que l'identifiant est pris. */
export function idCasAjoute(theme: string, existants: ReadonlySet<string> | readonly string[], aleatoire: () => number = Math.random): string {
  const pris = new Set(existants);
  const base = `${PREFIXE_CAS_AJOUTE}${slug(theme) || "cas"}`;
  for (let essai = 0; essai < 200; essai++) {
    const suffixe = Math.floor(aleatoire() * 36 ** 4).toString(36).padStart(4, "0").slice(0, 4);
    const id = `${base}-${suffixe}`;
    if (!pris.has(id)) return id;
  }
  throw new Error("Aucun identifiant libre pour ce cas.");
}

/* ------------------------------------------------------------------ */
/* Anti-doublon (avertissement, jamais un blocage)                       */
/* ------------------------------------------------------------------ */

const MOTS_SANS_POIDS = new Set(["pour", "dans", "avec", "sans", "vous", "vos", "votre", "leur", "leurs", "cette", "chaque", "tout", "tous", "plus", "mais", "elle", "elles", "sont", "etre", "fait", "faire", "dont", "aussi"]);
const motsUtilesAjout = (t: string): Set<string> => new Set(sansAccent(t).split(/[^a-z0-9]+/).filter((m) => m.length >= 4 && !MOTS_SANS_POIDS.has(m)));
export const MOTS_COMMUNS_DOUBLON = 3;

/**
 * Les cas qui RESSEMBLENT à celui qu'on ajoute : au moins 3 mots utiles en commun sur le titre, la promesse et le sujet.
 * Un avertissement montré à Will (« Ce cas ressemble à : … ») : l'ajout reste permis.
 */
export function ressemblances(f: Pick<FormulaireCas, "titre" | "promesse" | "sujet">, cas: readonly Pick<CasConcret, "id" | "titre" | "promesse" | "recit">[]): { id: string; titre: string }[] {
  const voulus = motsUtilesAjout(`${f.titre} ${f.promesse} ${f.sujet}`);
  return cas
    .filter((c) => {
      const deux = motsUtilesAjout(`${c.titre} ${c.promesse} ${c.recit?.sujet ?? ""}`);
      return [...voulus].filter((m) => deux.has(m)).length >= MOTS_COMMUNS_DOUBLON;
    })
    .map((c) => ({ id: c.id, titre: c.titre }));
}
