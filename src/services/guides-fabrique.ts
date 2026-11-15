/**
 * GUIDES PDF (lot G5) · les cinq gestes du fondateur pour fabriquer un guide : lire l'état, rédiger avec l'IA, valider après
 * relecture, fabriquer le PDF, rattacher au mot. INERTE : tant que `GUIDES_FABRIQUE_ECRAN` n'est pas exactement « true »,
 * chaque geste refuse (rien n'est lu, écrit ni envoyé). Aucun envoi vers un réseau social ; la liaison mot → guide est créée
 * INACTIVE (l'allumage reste un geste séparé).
 *
 * Le texte qui part au site est TOUJOURS relu dans l'enregistrement du Studio (version validée), jamais pris d'un client ;
 * l'empreinte est recalculée avec `guide-contenu.ts`. Une version n'est « fabriquée » que sur un 201 du site.
 * Dépendances injectables (essais sans base ni réseau). La session est exigée par les actions serveur avant d'arriver ici.
 * Reste avant tout allumage (voir TODO de guides-redaction.ts) : plafond mensuel Claude et suivi des dépenses.
 */
import "server-only";
import {
  PREFIXE_PARAM_FABRIQUE,
  codeGuideDuMot,
  controlerRelecture,
  corpsContenuGuide,
  guidesFabriqueActif,
} from "@/domaine/guides-pdf/guide-fabrique";
import { empreinteGuide, type ContenuGuide } from "@/domaine/guides-pdf/guide-contenu";
import { PREFIXE_PARAM_REDACTION, STATUT_A_VALIDER, STATUT_VALIDE, identifiantMot, redigerBrouillonGuide, type ResultatRedaction, type VersionBrouillon } from "./guides-redaction";
import { envoyerContenuGuide, type ResultatEnvoiContenu } from "./guides-fabrique-site";
import { creerElementCatalogue, delierMot, type ResultatCreation, type ResultatEcriture } from "./cibles-site";
import type { CorpsContenuGuide } from "@/domaine/guides-pdf/guide-fabrique";

type Env = Record<string, string | undefined>;

export interface DepsFabrique {
  env?: Env;
  lireParametre: (id: string) => Promise<unknown>;
  ecrireParametre: (id: string, valeur: unknown) => Promise<void>;
  journaliser: (type: string, message: string) => Promise<void>;
  maintenant: () => string;
  rediger: (mot: string) => Promise<ResultatRedaction>;
  envoyer: (corps: CorpsContenuGuide) => Promise<ResultatEnvoiContenu>;
  creerElement: (o: { titre: string; cheminPdf: string; code: string }) => Promise<ResultatCreation>;
  /** Écrit la ligne mot → guide avec `actif: false`. */
  lierInactif: (o: { mot: string; codeCible: string }) => Promise<ResultatEcriture>;
}

async function depsReelles(): Promise<DepsFabrique> {
  const commun = await import("./_commun");
  return {
    lireParametre: async (id) => (await commun.depots().parametres.obtenir(id))?.valeur ?? null,
    ecrireParametre: commun.ecrireParametre,
    journaliser: (type, message) => commun.journaliser(type, message),
    maintenant: commun.maintenant,
    rediger: (mot) => redigerBrouillonGuide(mot),
    envoyer: (corps) => envoyerContenuGuide({ corps }),
    creerElement: (o) => creerElementCatalogue({ type: "guide", ...o }),
    // « delierMot » écrit la ligne avec actif=false : c'est exactement une liaison inactive.
    lierInactif: (o) => delierMot({ mot: o.mot, reseau: "tous", codeCible: o.codeCible }),
  };
}

export type RaisonRefus =
  | "ecran_eteint" | "mot_invalide" | "indisponible" | "aucun_brouillon" | "version_inconnue" | "pas_la_derniere" | "deja_valide"
  | "relecture_requise" | "texte_invalide" | "texte_refuse" | "pas_valide" | "texte_modifie" | "deja_fabrique" | "en_cours"
  | "pas_fabrique" | "pas_de_pdf" | "titre_trop_court" | "deja_rattache" | "site" | "redaction";

export type ResultatGeste<T = object> = ({ ok: true; phrase: string } & T) | { ok: false; raison: RaisonRefus; phrase: string; regle?: string };

const PHRASES: Record<Exclude<RaisonRefus, "site" | "redaction">, string> = {
  ecran_eteint: "Cette fonction n'est pas allumée pour le moment.",
  mot_invalide: "Ce mot n'est pas accepté : de 1 à 60 caractères, sans caractère spécial.",
  indisponible: "Le Studio n'a pas pu lire ou enregistrer le guide. Rien n'a été fait : réessayez.",
  aucun_brouillon: "Il n'y a pas encore de brouillon pour ce mot : cliquez d'abord sur « Rédiger avec l'IA ».",
  version_inconnue: "Cette version du guide n'existe pas.",
  pas_la_derniere: "Une version plus récente existe : relisez celle-là.",
  deja_valide: "Cette version est déjà validée.",
  relecture_requise: "Cochez « J'ai tout lu » après avoir relu le guide en entier : rien n'a été validé.",
  texte_invalide: "Le texte n'a pas la bonne forme (titre, sections, paragraphes) ou contient un caractère interdit : rien n'a été validé.",
  texte_refuse: "Le texte contient un mot ou une promesse que nous n'employons jamais : rien n'a été validé. Corrigez-le.",
  pas_valide: "Validez d'abord le guide après relecture.",
  texte_modifie: "Le texte enregistré ne correspond plus à son empreinte : validez-le de nouveau.",
  deja_fabrique: "Cette version est déjà fabriquée.",
  en_cours: "Un geste est déjà en cours pour ce mot : patientez.",
  pas_fabrique: "Fabriquez d'abord le PDF.",
  pas_de_pdf: "Le site n'a pas indiqué où se trouve le PDF : il ne peut pas être rattaché. Fabriquez-le de nouveau.",
  titre_trop_court: "Le titre du guide est trop court pour le catalogue (3 caractères au moins).",
  deja_rattache: "Ce guide est déjà rattaché au mot.",
};
const refus = (raison: Exclude<RaisonRefus, "site" | "redaction">, regle?: string): ResultatGeste<never> => ({ ok: false, raison, phrase: PHRASES[raison], ...(regle ? { regle } : {}) });

const PHRASES_REDACTION: Record<string, string> = {
  interrupteur_eteint: "La rédaction avec l'IA n'est pas allumée pour le moment. Rien n'a été fait.",
  mot_invalide: PHRASES.mot_invalide,
  cle_absente: "Aucune clé Claude n'est disponible : rien n'a été rédigé.",
  panne_claude: "Claude n'a pas répondu. Rien n'a été enregistré : réessayez.",
  reponse_illisible: "La réponse de Claude n'était pas utilisable. Rien n'a été enregistré : réessayez.",
  texte_refuse: "Le brouillon contenait un mot ou une promesse interdits : il a été écarté. Réessayez.",
  enregistrement_echec: "Le brouillon n'a pas pu être enregistré : réessayez.",
  dependances_indisponibles: "Le Studio n'est pas prêt pour cela : réessayez plus tard.",
  trop_de_versions: "Il y a déjà trop de versions pour ce mot.",
};

// Un geste à la fois par mot (en mémoire : un redémarrage repart libre). Évite deux appels payés ou deux rendus simultanés.
const enCours = new Set<string>();
const OCCUPE = Symbol("occupe");
async function exclusif<T>(id: string, f: () => Promise<T>): Promise<T | typeof OCCUPE> {
  if (enCours.has(id)) return OCCUPE;
  enCours.add(id);
  try {
    return await f();
  } finally {
    enCours.delete(id);
  }
}

interface EtatFabrique {
  version: number;
  sha256Texte: string;
  code: string;
  cheminPdf: string | null;
  pages: number | null;
  fabriqueLe: string;
  rattacheLe?: string;
}

const lireVersions = (v: unknown): VersionBrouillon[] => (Array.isArray((v as { versions?: unknown } | null)?.versions) ? (v as { versions: VersionBrouillon[] }).versions : []);
function lireEtat(v: unknown): EtatFabrique | null {
  const o = v as Partial<EtatFabrique> | null;
  return o && typeof o === "object" && typeof o.version === "number" && typeof o.sha256Texte === "string" && typeof o.code === "string" ? (o as EtatFabrique) : null;
}
const derniereValidee = (vs: VersionBrouillon[]) => vs.filter((v) => v.statut === STATUT_VALIDE).sort((a, b) => b.version - a.version)[0] ?? null;

async function journaliser(d: DepsFabrique, type: string, message: string): Promise<void> {
  try {
    await d.journaliser(type, message);
  } catch {
    /* le journal ne fait jamais échouer un geste */
  }
}

/** Charge les dépendances et l'identifiant du mot, après avoir vérifié l'interrupteur. */
async function preparer(mot: string, deps?: DepsFabrique): Promise<{ d: DepsFabrique; id: string } | ResultatGeste<never>> {
  if (!guidesFabriqueActif(deps?.env ?? process.env)) return refus("ecran_eteint");
  let d: DepsFabrique;
  try {
    d = deps ?? (await depsReelles());
  } catch {
    return refus("indisponible");
  }
  const id = identifiantMot(mot);
  return id ? { d, id } : refus("mot_invalide");
}
const estRefus = (x: unknown): x is ResultatGeste<never> => typeof x === "object" && x !== null && "ok" in x && (x as { ok: unknown }).ok === false && "raison" in x;

export interface VueGuideMot {
  derniere: { version: number; statut: string; contenu: ContenuGuide } | null;
  nbVersions: number;
  fabrique: { version: number; cheminPdf: string | null; pages: number | null; rattache: boolean } | null;
}

/** Geste 1 : l'état du guide d'un mot (dernière version, PDF fabriqué, rattachement). Lecture seule. */
export async function lireGuideDuMot(mot: string, deps?: DepsFabrique): Promise<ResultatGeste<{ vue: VueGuideMot }>> {
  const p = await preparer(mot, deps);
  if (estRefus(p)) return p;
  try {
    const vs = lireVersions(await p.d.lireParametre(PREFIXE_PARAM_REDACTION + p.id)).sort((a, b) => a.version - b.version);
    const etat = lireEtat(await p.d.lireParametre(PREFIXE_PARAM_FABRIQUE + p.id));
    const der = vs[vs.length - 1];
    return {
      ok: true,
      phrase: "",
      vue: {
        derniere: der ? { version: der.version, statut: der.statut, contenu: der.contenu } : null,
        nbVersions: vs.length,
        fabrique: etat ? { version: etat.version, cheminPdf: etat.cheminPdf, pages: etat.pages, rattache: !!etat.rattacheLe } : null,
      },
    };
  } catch {
    return refus("indisponible");
  }
}

/** Geste 2 : « Rédiger avec l'IA » → brouillon « À valider ». Un appel par geste, un geste à la fois par mot. */
export async function redigerGuide(mot: string, deps?: DepsFabrique): Promise<ResultatGeste<{ version: number }>> {
  const p = await preparer(mot, deps);
  if (estRefus(p)) return p;
  const r = await exclusif(p.id, () => p.d.rediger(mot));
  if (r === OCCUPE) return refus("en_cours");
  if (!r.ok) return { ok: false, raison: "redaction", phrase: PHRASES_REDACTION[r.raison] ?? PHRASES.indisponible, ...(r.regle ? { regle: r.regle } : {}) };
  return { ok: true, version: r.version, phrase: `Brouillon n° ${r.version} prêt. Relisez-le en entier avant de le valider.` };
}

/** Geste 3 : « Valider » le texte relu (éventuellement corrigé). Exige « j'ai tout lu » et la dernière version « À valider ». */
export async function validerGuide(o: { mot: string; version: number; contenu: unknown; toutLu: boolean }, deps?: DepsFabrique): Promise<ResultatGeste<{ empreinte: string }>> {
  const p = await preparer(o.mot, deps);
  if (estRefus(p)) return p;
  if (o.toutLu !== true) return refus("relecture_requise");
  const c = controlerRelecture(o.contenu);
  if (!c.ok) return refus(c.raison, c.regle);
  const r = await exclusif(p.id, async (): Promise<ResultatGeste<{ empreinte: string }>> => {
    try {
      const cle = PREFIXE_PARAM_REDACTION + p.id;
      const vs = lireVersions(await p.d.lireParametre(cle)).map((v) => ({ ...v }));
      if (!vs.length) return refus("aucun_brouillon");
      const cible = vs.find((v) => v.version === o.version);
      if (!cible) return refus("version_inconnue");
      if (cible.version !== Math.max(...vs.map((v) => v.version))) return refus("pas_la_derniere");
      if (cible.statut !== STATUT_A_VALIDER) return refus("deja_valide");
      cible.contenu = c.contenu;
      cible.empreinte = c.empreinte;
      cible.statut = STATUT_VALIDE;
      (cible as VersionBrouillon & { valideLe?: string }).valideLe = p.d.maintenant();
      await p.d.ecrireParametre(cle, { versions: vs });
      await journaliser(p.d, "guide_valide", `version=${cible.version} empreinte=${c.empreinte.slice(0, 12)}`);
      return { ok: true, empreinte: c.empreinte, phrase: "Guide validé. Rien n'est encore fabriqué ni envoyé." };
    } catch {
      return refus("indisponible");
    }
  });
  return r === OCCUPE ? refus("en_cours") : r;
}

/** Geste 4 : « Fabriquer le PDF » = envoi du texte validé à la route signée du site. « Fabriqué » seulement sur un 201. */
export async function fabriquerPdf(o: { mot: string }, deps?: DepsFabrique): Promise<ResultatGeste<{ cheminPdf: string | null; pages: number | null }>> {
  const p = await preparer(o.mot, deps);
  if (estRefus(p)) return p;
  const r = await exclusif(p.id, async (): Promise<ResultatGeste<{ cheminPdf: string | null; pages: number | null }>> => {
    let valide: VersionBrouillon | null;
    let etat: EtatFabrique | null;
    try {
      valide = derniereValidee(lireVersions(await p.d.lireParametre(PREFIXE_PARAM_REDACTION + p.id)));
      etat = lireEtat(await p.d.lireParametre(PREFIXE_PARAM_FABRIQUE + p.id));
    } catch {
      return refus("indisponible");
    }
    if (!valide) return refus("pas_valide");
    // Le texte vient de l'enregistrement du Studio ; l'empreinte est recalculée, jamais crue sur parole.
    const c = controlerRelecture(valide.contenu);
    if (!c.ok || empreinteGuide(c.contenu) !== valide.empreinte) return refus("texte_modifie");
    if (etat && etat.version === valide.version && etat.sha256Texte === valide.empreinte) return refus("deja_fabrique");
    const code = codeGuideDuMot(p.id);
    const r = await p.d.envoyer(corpsContenuGuide(code, valide.version, c.contenu));
    if (r.issue !== "fabrique") {
      await journaliser(p.d, "guide_fabrication_refusee", `issue=${r.issue} version=${valide.version}`);
      return { ok: false, raison: "site", phrase: r.phrase };
    }
    try {
      await p.d.ecrireParametre(PREFIXE_PARAM_FABRIQUE + p.id, { version: valide.version, sha256Texte: valide.empreinte, code, cheminPdf: r.cheminPdf, pages: r.pages, fabriqueLe: p.d.maintenant() } satisfies EtatFabrique);
    } catch {
      return { ok: false, raison: "indisponible", phrase: "Le PDF a été fabriqué par le site, mais le Studio n'a pas pu le noter : refaites « Fabriquer le PDF » (il ne sera pas fabriqué deux fois)." };
    }
    await journaliser(p.d, "guide_fabrique", `version=${valide.version} empreinte=${valide.empreinte.slice(0, 12)}`);
    return { ok: true, cheminPdf: r.cheminPdf, pages: r.pages, phrase: "PDF fabriqué. Vérifiez l'aperçu avant de le rattacher au mot." };
  });
  return r === OCCUPE ? refus("en_cours") : r;
}

/** Geste 5 : « Rattacher au mot » = ajout au catalogue du site + liaison mot → guide INACTIVE. N'allume rien. */
export async function rattacherGuide(o: { mot: string }, deps?: DepsFabrique): Promise<ResultatGeste<object>> {
  const p = await preparer(o.mot, deps);
  if (estRefus(p)) return p;
  const r = await exclusif(p.id, async (): Promise<ResultatGeste<object>> => {
    let etat: EtatFabrique | null;
    let valide: VersionBrouillon | null;
    try {
      etat = lireEtat(await p.d.lireParametre(PREFIXE_PARAM_FABRIQUE + p.id));
      valide = derniereValidee(lireVersions(await p.d.lireParametre(PREFIXE_PARAM_REDACTION + p.id)));
    } catch {
      return refus("indisponible");
    }
    if (!etat || !valide || etat.version !== valide.version) return refus("pas_fabrique");
    if (!etat.cheminPdf) return refus("pas_de_pdf");
    if (etat.rattacheLe) return refus("deja_rattache");
    if (valide.contenu.titre.length < 3) return refus("titre_trop_court");
    // Même code qu'à la fabrication : rejouer ne crée jamais un second élément.
    const cree = await p.d.creerElement({ titre: valide.contenu.titre, cheminPdf: etat.cheminPdf, code: etat.code });
    if (!cree.ok) return { ok: false, raison: "site", phrase: cree.phrase };
    const lie = await p.d.lierInactif({ mot: o.mot.trim(), codeCible: etat.code });
    if (!lie.ok) return { ok: false, raison: "site", phrase: `Le guide est au catalogue, mais la liaison avec le mot n'a pas été faite. ${lie.phrase}` };
    try {
      await p.d.ecrireParametre(PREFIXE_PARAM_FABRIQUE + p.id, { ...etat, rattacheLe: p.d.maintenant() });
    } catch {
      return refus("indisponible");
    }
    await journaliser(p.d, "guide_rattache", `version=${etat.version} inactif`);
    return { ok: true, phrase: "Guide rattaché au mot, sans l'allumer. L'allumage reste un geste séparé." };
  });
  return r === OCCUPE ? refus("en_cours") : r;
}
