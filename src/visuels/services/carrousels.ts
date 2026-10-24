import { createHash } from "node:crypto";
import { LIMITES } from "@/briques/visuels/limites";
import type { Intention } from "@/briques/visuels/trames";
import { LIBELLES_STATUT, transitionPermise, type StatutVisuel } from "@/domaine/visuels/statuts";
import { CODES_ERREUR_VISUELS, type DemandeTexteCarrousel, type ContextePorte, type FournisseurTexteCarrousel, type Porte } from "@/domaine/visuels/contrats";
import { CarrouselSpec } from "@/domaine/visuels/schema";
import type { CarrouselSpecType } from "@/domaine/visuels/types";
import type { MotifRefus, Visuel } from "@/domaine/visuels/visuel";
import type { Depot } from "@/domaine/depots";
import { phrasesPaquetSession } from "../texte/phrases-paquet";
import type { ResultatRendu } from "./rendu";

/**
 * Service des carrousels (V3-C) : cycle de vie d'un visuel, de la demande à la validation. TOUT est injecté (dépôt, texte,
 * porte, rendu, interrupteur, verrou, horloge, paramètres) : aucun état global, aucun fournisseur, aucun appel payant.
 * Chaque changement de statut passe par `transiter`, qui suit la table TRANSITIONS à la lettre.
 */

export type CodeErreurVisuel = (typeof CODES_ERREUR_VISUELS)[number];

export class ErreurVisuel extends Error {
  constructor(
    public readonly code: CodeErreurVisuel,
    message: string,
    /** Phrases précises à montrer à l'écran (p. ex. les champs fautifs d'un texte déposé). */
    public readonly details?: string[],
  ) {
    super(message);
    this.name = "ErreurVisuel";
  }
}

export interface DependancesCarrousels {
  depot: Depot<Visuel>;
  texte: (d: DemandeTexteCarrousel) => FournisseurTexteCarrousel;
  porte: Porte;
  contextePorte: () => Promise<ContextePorte>;
  allume: () => Promise<boolean>;
  rendre: (spec: CarrouselSpecType) => Promise<ResultatRendu>;
  urlLecture: (cle: string) => Promise<string>;
  /** Adresse qui TÉLÉCHARGE le fichier sous ce nom (absente : l'adresse de lecture sert). */
  urlTelechargement?: (cle: string, nom: string) => Promise<string>;
  verrou: <T>(f: () => Promise<T>) => Promise<T>;
  maintenant: () => string;
  lireParametre: <T>(id: string, defaut: T) => Promise<T>;
  ecrireParametre: (id: string, v: unknown) => Promise<void>;
}

export const PHRASE_GENERATEUR_ETEINT = "Le générateur est éteint (Réglages › Carrousels)";
export const PHRASE_SERVEUR_NON_RELIE = "Le serveur de rendu n'est pas relié : aucun aperçu";
const DOUBLE_CLIC_MS = 60_000;
/** Un rendu « en cours » de plus de 10 minutes est considéré bloqué : il peut être relancé ou mis à la corbeille. */
export const RENDU_PERIME_MS = 10 * 60_000;
const MOTIFS_REFUS: readonly MotifRefus[] = ["texte", "mise_en_page", "sujet", "ton", "autre"];
const CLE_SESSION = "carrousels.session.";
const COMMENTAIRE_MAX = 500;
const TITRE_MAX = 120;
const SUJET_MIN = 3;
const SUJET_MAX = 200;
const SESSION_MAX = 100_000;
/** Schémas (http, mailto…), « www. », « // » et tout domaine nu : un sujet ne porte aucun lien. */
const LIEN = /(?:https?|ftp|mailto|file):|www\.|\/\/|[\p{L}\p{N}][\p{L}\p{N}-]*\.\p{L}{2,}/iu;

const refus = (code: CodeErreurVisuel, message: string, details?: string[]) => new ErreurVisuel(code, message, details);
const normaliser = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

async function exigerAllume(deps: DependancesCarrousels): Promise<void> {
  if (!(await deps.allume())) throw refus("GENERATEUR_ETEINT", PHRASE_GENERATEUR_ETEINT);
}

export async function lireVisuel(id: string, deps: Pick<DependancesCarrousels, "depot">): Promise<Visuel> {
  const v = await deps.depot.obtenir(id);
  if (!v) throw refus("INTROUVABLE", "Ce carrousel est introuvable");
  return v;
}

/** Seul point de changement de statut. À appeler SOUS le verrou. Un visuel à la corbeille ne bouge plus. */
async function transiter(id: string, vers: StatutVisuel, patch: Partial<Visuel>, deps: DependancesCarrousels): Promise<Visuel> {
  const v = await lireVisuel(id, deps);
  if (v.corbeilleLe) throw refus("TRANSITION_REFUSEE", "Ce carrousel est à la corbeille : restaurez-le d'abord");
  if (!transitionPermise(v.statut, vers)) throw refus("TRANSITION_REFUSEE", `Un carrousel « ${LIBELLES_STATUT[v.statut]} » ne peut pas passer à « ${LIBELLES_STATUT[vers]} »`);
  return deps.depot.modifier(id, { ...patch, statut: vers, modifieLe: deps.maintenant() });
}

function fournisseurPermis(demande: DemandeTexteCarrousel, deps: DependancesCarrousels): FournisseurTexteCarrousel {
  const f = deps.texte(demande);
  if (f.mode === "api") throw refus("API_PAYANTE_VERROUILLEE", "Le texte par API payante est verrouillé");
  return f;
}

/** Écrit le texte, passe la porte, puis range le brouillon `id` en « ecrit » ou « bloque ». Un brouillon mis à la corbeille entre-temps est laissé tel quel. */
async function rediger(id: string, fournisseur: FournisseurTexteCarrousel, demande: DemandeTexteCarrousel, deps: DependancesCarrousels): Promise<void> {
  const ranger = (vers: StatutVisuel, patch: Partial<Visuel>) =>
    deps.verrou(async () => {
      const v = await deps.depot.obtenir(id);
      if (!v || v.corbeilleLe) return;
      await transiter(id, vers, patch, deps);
    });
  const bloquer = (erreur: string, patch: Partial<Visuel> = {}) => ranger("bloque", { ...patch, erreur });
  let reponse;
  try {
    reponse = await fournisseur.ecrire(demande);
  } catch {
    await bloquer(demande.type === "sujet" ? "L'écriture du texte a échoué : réessayez avec « Refaire »" : "La lecture du texte déposé a échoué : déposez un texte corrigé");
    return;
  }
  if (!reponse) {
    await bloquer("La réponse du texte est incomplète");
    return;
  }
  let controle;
  try {
    controle = deps.porte(reponse.spec, await deps.contextePorte());
  } catch {
    await bloquer("Le texte n'a pas pu être contrôlé par la porte");
    return;
  }
  // La porte ne rend de texte corrigé que s'il y a eu des corrections : sans correction, le texte validé est repris tel quel.
  const { rapport } = controle;
  // Sans correction, le texte est repris tel que le schéma l'a lu (espaces rognés), pas la saisie brute.
  const specLue = rapport.verdict === "rouge" ? undefined : CarrouselSpec.safeParse(reponse.spec);
  const specCorrige = controle.specCorrige ?? (specLue?.success ? specLue.data : undefined);
  let patch: Partial<Visuel>;
  try {
    const pagesEcrites = (reponse.spec as { pages?: unknown } | null)?.pages;
    patch = {
      titre: reponse.titre.trim().slice(0, TITRE_MAX) || "Carrousel",
      pourquoi: [...reponse.pourquoi],
      modeTexte: reponse.mode,
      rapport,
      spec: specCorrige,
      noteTexte: reponse.note,
      // Borné au maximum du schéma : un texte refusé peut annoncer n'importe quel nombre de pages.
      pagesTexte: Array.isArray(pagesEcrites) ? Math.min(pagesEcrites.length, LIMITES.pagesMax) : undefined,
    };
  } catch {
    await bloquer("La réponse du texte est incomplète");
    return;
  }
  if (rapport.verdict === "rouge") await ranger("bloque", patch);
  else if (!specCorrige) await bloquer("La porte n'a rendu aucun texte corrigé", patch);
  else await ranger("ecrit", patch);
}

async function demarrer(entree: Visuel["entree"], demande: DemandeTexteCarrousel, titre: string, empreinteSession: string | null, deps: DependancesCarrousels): Promise<{ id: string }> {
  await exigerAllume(deps);
  const fournisseur = fournisseurPermis(demande, deps);
  const cle = entree.type === "sujet" ? normaliser(entree.sujet) : null;
  const { id, neuf } = await deps.verrou(async () => {
    const maintenant = deps.maintenant();
    if (cle !== null) {
      const recent = await deps.depot.trouver(
        (v) =>
          v.entree.type === "sujet" &&
          normaliser(v.entree.sujet) === cle &&
          !v.corbeilleLe &&
          (v.statut === "brouillon" || v.statut === "ecrit" || v.statut === "rendu_en_cours") &&
          Date.parse(maintenant) - Date.parse(v.creeLe) < DOUBLE_CLIC_MS,
      );
      if (recent) return { id: recent.id, neuf: false };
    }
    if (empreinteSession !== null) {
      // L'entrée « session » du contrat ne porte pas d'empreinte : elle est gardée dans un paramètre, sous la clé du contenu.
      const vu = await deps.lireParametre<{ id: string; le: string } | null>(CLE_SESSION + empreinteSession, null);
      if (vu && Date.parse(maintenant) - Date.parse(vu.le) < DOUBLE_CLIC_MS) {
        const existant = await deps.depot.obtenir(vu.id);
        if (existant && !existant.corbeilleLe) return { id: existant.id, neuf: false };
      }
    }
    const nouveau: Visuel = {
      id: `vis_${crypto.randomUUID()}`,
      famille: "carrousel",
      titre: titre.slice(0, TITRE_MAX),
      entree,
      statut: "brouillon",
      modeTexte: entree.type === "session" ? "session" : "simulation",
      versionSpec: 1,
      coutCentimes: 0,
      creeLe: maintenant,
      modifieLe: maintenant,
    };
    await deps.depot.enregistrer(nouveau);
    if (empreinteSession !== null) await deps.ecrireParametre(CLE_SESSION + empreinteSession, { id: nouveau.id, le: maintenant });
    return { id: nouveau.id, neuf: true };
  });
  if (neuf) await rediger(id, fournisseur, demande, deps);
  return { id };
}

/** `intention` (L12, facultative) : choisit la trame ; elle est gardée pour « Refaire ». */
export async function creerDepuisSujet(sujet: string, deps: DependancesCarrousels, intention?: Intention): Promise<{ id: string }> {
  await exigerAllume(deps);
  const net = sujet.trim();
  if (net.length < SUJET_MIN || net.length > SUJET_MAX || LIEN.test(net)) {
    throw refus("SUJET_INVALIDE", `Le sujet fait de ${SUJET_MIN} à ${SUJET_MAX} signes, sans lien`);
  }
  const avecIntention = intention ? { intention } : {};
  return demarrer({ type: "sujet", sujet: net, ...avecIntention }, { type: "sujet", sujet: net, ...avecIntention }, net, null, deps);
}

export async function deposerSession(contenu: string, deps: DependancesCarrousels): Promise<{ id: string }> {
  await exigerAllume(deps);
  if (!contenu.trim() || contenu.length > SESSION_MAX) throw refus("PAQUET_INVALIDE", "Le fichier de session est vide ou trop long", ["Le texte déposé est vide ou trop long."]);
  // Lu et validé AVANT la création de la fiche : un paquet invalide ne laisse aucune fiche vide.
  const phrases = phrasesPaquetSession(contenu);
  if (phrases.length > 0) throw refus("PAQUET_INVALIDE", phrases.join(" "), phrases);
  return demarrer({ type: "session" }, { type: "paquet-session", contenu }, "Carrousel depuis une session", createHash("sha256").update(contenu).digest("hex"), deps);
}

const PHRASE_ECHEC_FIXE = "Le rendu a échoué : réessayez avec « Relancer le rendu »";
/** Phrases écrites par le rendu pour l'équipe ; tout autre message (adresse, chemin, pile) n'est jamais recopié. */
const PHRASES_CONNUES = [/^Le serveur du studio n'a pas fini à temps\.$/];
/** Contrôles de mise en page du rendu (débordement, zone réservée, texte sous 26 px, chevauchement, jambage) : un nouvel essai échouera pareil. */
const CONTROLE_MISE_EN_PAGE = /^La page (\d+)(?: (déborde)\b| a un texte (sous) \d+ px \(\d|\s*:\s*un texte (?:(entre) dans une zone réservée|(en) chevauche)|\s*:[^:]*\b(jambage))/i;
/** Une cause, une phrase : seule la zone réservée parle de LinkedIn. */
const CAUSES_MISE_EN_PAGE = ["le texte dépasse de son cadre", "le texte devient trop petit pour être lu", "zone réservée de LinkedIn", "deux textes se touchent", "une lettre est coupée"] as const;
/** Phrase gardée quand la mise en page refuse le texte : la fiche ne propose alors pas « Relancer le rendu ». */
export const ERREUR_MISE_EN_PAGE = /ne tient pas dans la mise en page/;

function phraseEchec(e: unknown): string {
  const message = e instanceof Error ? e.message : "";
  const controle = CONTROLE_MISE_EN_PAGE.exec(message);
  if (controle) {
    const cause = CAUSES_MISE_EN_PAGE[controle.slice(2, 7).findIndex((g) => g !== undefined)] ?? CAUSES_MISE_EN_PAGE[0];
    return `La page ${controle[1]} ne tient pas dans la mise en page (${cause}) : raccourcissez ce texte ou changez de type de page.`;
  }
  if (PHRASES_CONNUES.some((r) => r.test(message))) return message.slice(0, 300);
  return /mesure/i.test(message) ? PHRASE_SERVEUR_NON_RELIE : PHRASE_ECHEC_FIXE;
}

/** Masque tout ce qui ressemble à une clé, un jeton, un en-tête d'autorisation ou une URL signée avant d'écrire dans le journal. */
export function masquerSecrets(texte: string): string {
  // Bornée avant tout : les expressions d'URL sont quadratiques sur un long texte de `http://` répétés.
  return texte
    .slice(0, 4000)
    .replace(/(Bearer|Basic)\s+[\w.~+/=-]+/gi, "$1 [masqué]")
    .replace(/https?:\/\/[^\s"')]*[?&](?:X-Amz-|Signature|token|key|sig|access_token)[^\s"')]*/gi, "[url signée masquée]")
    .replace(/\b(?:sk|pk|rk|ghp|gho|xox[a-z]?|AKIA|AIza)[-_A-Za-z0-9]{12,}/g, "[clé masquée]")
    .replace(/((?:^|[^A-Za-z0-9])(?:[\w-]*(?:token|key|secret|password|signature|authorization))["']?\s*[=:]\s*["']?)[^\s&"',)]+/gi, "$1[masqué]")
    .replace(/([a-z][a-z0-9+.-]*:\/\/[^\s:@/]*:)[^\s@/]+@/gi, "$1[masqué]@")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[masqué]");
}

function journaliserEchec(id: string, e: unknown): void {
  try {
    const err = e instanceof Error ? e : new Error(String(e));
    const cause = err.cause === undefined ? "" : ` | cause : ${err.cause instanceof Error ? `${err.cause.name}: ${err.cause.message}` : typeof err.cause === "string" ? err.cause : (JSON.stringify(err.cause) ?? "")}`;
    console.error(`[carrousels] rendu échoué | visuel ${id} | ${masquerSecrets(`${err.stack ?? `${err.name}: ${err.message}`}${cause}`)}`);
  } catch {
    // Le journal ne doit jamais empêcher de conclure le rendu.
  }
}

export async function lancerRendu(id: string, deps: DependancesCarrousels): Promise<void> {
  await exigerAllume(deps);
  // `jeton` = la `renduDemandeLe` posée sous verrou par CE lancement : seul le dernier rendu lancé conclut.
  const jeton = deps.maintenant();
  const spec = await deps.verrou(async () => {
    const v = await lireVisuel(id, deps);
    if (v.statut === "rendu_en_cours" && !v.corbeilleLe) {
      if (v.renduDemandeLe && Date.parse(jeton) - Date.parse(v.renduDemandeLe) < RENDU_PERIME_MS) return null;
      await deps.depot.modifier(id, { renduDemandeLe: jeton, modifieLe: jeton });
      return v.spec ?? undefined;
    }
    await transiter(id, "rendu_en_cours", { renduDemandeLe: jeton, erreur: undefined }, deps);
    return v.spec ?? undefined;
  });
  if (spec === null) return;
  // Un autre rendu a pu conclure entre-temps (relance) : la transition refusée n'est alors pas une erreur.
  const conclure = async (vers: StatutVisuel, patch: Partial<Visuel>) => {
    try {
      await deps.verrou(async () => {
        const v = await lireVisuel(id, deps);
        // Comparaison par instant : le dépôt peut renormaliser la date (Z / +00:00, millisecondes).
        if (v.renduDemandeLe === undefined || Date.parse(v.renduDemandeLe) !== Date.parse(jeton)) return;
        await transiter(id, vers, patch, deps);
      });
    } catch (e) {
      if (!(e instanceof ErreurVisuel && e.code === "TRANSITION_REFUSEE")) throw e;
    }
  };
  let rendu: NonNullable<Visuel["rendu"]>;
  try {
    if (!spec) throw new Error("Ce carrousel n'a pas de texte à rendre");
    const r = await deps.rendre(spec);
    rendu = {
      empreinte: r.empreinte,
      pdfCle: r.pdfCle,
      vignetteCle: r.vignetteCle,
      pages: r.pages.map((p) => ({ index: p.index, x1Cle: p.x1.cle, x2Cle: p.x2.cle })),
      renduLe: deps.maintenant(),
    };
  } catch (e) {
    journaliserEchec(id, e);
    await conclure("echec_rendu", { erreur: phraseEchec(e) });
    return;
  }
  await conclure("a_valider", { rendu, erreur: undefined });
}

export async function valider(id: string, deps: DependancesCarrousels): Promise<void> {
  await deps.verrou(() => transiter(id, "valide", { valideLe: deps.maintenant() }, deps));
}

/** `page` est en base 0, comme `pages[].index` de la fiche : un entier de 0 à nombre de pages - 1. */
export async function refuser(id: string, motif: MotifRefus, page: number | undefined, commentaire: string | undefined, deps: DependancesCarrousels): Promise<void> {
  await deps.verrou(async () => {
    const v = await lireVisuel(id, deps);
    if (!MOTIFS_REFUS.includes(motif)) throw refus("TRANSITION_REFUSEE", "Ce motif de refus n'existe pas");
    if (page !== undefined && !(Number.isInteger(page) && page >= 0 && page < (v.spec?.pages.length ?? 0))) throw refus("TRANSITION_REFUSEE", "Cette page n'existe pas dans ce carrousel");
    const entree = { motif, ...(page !== undefined ? { page } : {}), ...(commentaire ? { commentaire: commentaire.slice(0, COMMENTAIRE_MAX) } : {}), le: deps.maintenant() };
    await transiter(id, "refuse", { refus: [...(v.refus ?? []), entree] }, deps);
  });
}

/** bloque|refuse|echec_rendu → brouillon → réécriture (sujet seulement). Depuis « à valider » : refus « autre » d'abord, la table reste intacte. */
export async function refaire(id: string, deps: DependancesCarrousels): Promise<void> {
  await exigerAllume(deps);
  const v = await lireVisuel(id, deps);
  if (v.entree.type === "session") throw refus("SESSION_ATTENDUE", "Ce carrousel vient d'une session : déposez un nouveau fichier");
  if (v.corbeilleLe) throw refus("TRANSITION_REFUSEE", "Ce carrousel est à la corbeille : restaurez-le d'abord");
  const demande: DemandeTexteCarrousel = { type: "sujet", sujet: v.entree.sujet, ...(v.entree.intention ? { intention: v.entree.intention } : {}) };
  const fournisseur = fournisseurPermis(demande, deps);
  if (v.statut === "a_valider") await refuser(id, "autre", undefined, undefined, deps);
  else if (!transitionPermise(v.statut, "brouillon")) throw refus("TRANSITION_REFUSEE", `Un carrousel « ${LIBELLES_STATUT[v.statut]} » ne se refait pas`);
  let version = 1;
  await deps.verrou(async () => {
    const frais = await lireVisuel(id, deps);
    version = frais.versionSpec + 1;
    await transiter(
      id,
      "brouillon",
      { versionSpec: frais.versionSpec + 1, spec: undefined, rapport: undefined, rendu: undefined, renduDemandeLe: undefined, erreur: undefined, valideLe: undefined, pourquoi: undefined, noteTexte: undefined, pagesTexte: undefined },
      deps,
    );
  });
  // La version suivante décale le choix du modèle de simulation : « Refaire » ne redonne pas le même texte.
  await rediger(id, fournisseur, { ...demande, version }, deps);
}
