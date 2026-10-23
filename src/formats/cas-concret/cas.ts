/**
 * CAS CONCRET : le contrat d'un cas (plan § 8). PUR, sans accès au serveur. Un cas = un fichier de données du catalogue :
 * promesse, tâches « avant », étapes et leurs visuels, faits dicibles avec leur source. Aucun nombre ne se dit sans fait.
 */
import { z } from "zod";
import { jsonCanonique } from "../../briques/fiche-scenes/empreinte";

/**
 * Les services d'Axion-IA, pour l'Usine comme pour le studio (X5). Automatisation et intégration sont une seule offre,
 * `integration`.
 */
export const OFFRES = ["formation", "audit", "integration", "coaching"] as const;
export type Offre = (typeof OFFRES)[number];

/**
 * Nature d'un cas d'intégration, en clair sur sa carte. Simple texte d'affichage, sans valeur de classement ; elle choisit
 * seulement le cadeau annoncé (« toute la structure de cette automatisation » pour une automatisation).
 */
export const NATURES = ["automatisation", "outils-relies"] as const;
export type NatureCas = (typeof NATURES)[number];
export const NATURES_EN_CLAIR: Record<NatureCas, string> = { automatisation: "Automatisation", "outils-relies": "Outils reliés" };

export const POSTURES = ["chez-nous", "offre"] as const;
export type Posture = (typeof POSTURES)[number];

export const SOURCES_FAIT = ["code", "site", "will", "estimation"] as const;
export type SourceFait = (typeof SOURCES_FAIT)[number];

/** Banque fermée d'objets redessinés (plan § 6.2) : un objet inconnu fait refuser le cas. */
export const OBJETS = [
  "telephone-capture", "telephone-notification", "pile-notifications", "chrono", "contrat-signature", "dossier-classe",
  "bouclier-coche", "champ-commentaire", "bulle-lien", "liste-taches", "barres-avant-apres",
  "calendrier", "programme", "rapport", "carte-taches", "outils-relies", "e-mail",
] as const;
export type ObjetCas = (typeof OBJETS)[number];

export const MOUVEMENTS_CAPTURE = ["image", "defilement", "survol", "frappe", "page-entiere"] as const;
export const ADRESSE_SITE = "https://axion-ia.com/";

const texte = (max = 200) => z.string().trim().min(1, "texte vide").max(max, `texte trop long (${max} caractères au plus)`);
const nombreMots = (t: string): number => t.split(/\s+/).filter(Boolean).length;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date attendue au format AAAA-MM-JJ");

/**
 * Image montrée par un objet `telephone-capture` (l'annonce de la v4) : un fichier du stockage du studio, déposé à la main
 * (`docs/formats/v4-reference/LISEZ-MOI-IMAGES.md`). Absente ou pas déposée : l'étape prend un objet de repli dessiné.
 */
const imageVisuel = z
  .object({
    cle: z.string().regex(/^visuels-cas-concret\/[a-z0-9-]+\/[a-z0-9-]+\.(png|jpg)$/, "clé d'image hors de visuels-cas-concret/<cas>/<nom>.png|jpg"),
    largeur: z.number().int().min(100).max(4000),
    hauteur: z.number().int().min(100).max(8000),
  })
  .strict();
const visuelObjet = z
  .object({ sorte: z.literal("objet"), objet: z.enum(OBJETS), image: imageVisuel.optional() })
  .strict()
  .refine((v) => !v.image || v.objet === "telephone-capture", { message: "une image ne se montre que dans l'objet telephone-capture", path: ["image"] });
const visuelEcran = z
  .object({
    sorte: z.literal("ecran"),
    adresse: z.string().refine((a) => a.startsWith(ADRESSE_SITE) && !/\s/.test(a), `adresse hors de ${ADRESSE_SITE}`),
    mouvement: z.enum(MOUVEMENTS_CAPTURE),
    saisies: z.array(z.object({ champ: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/, "identifiant de champ mal formé"), texte: texte(60) }).strict()).min(1).max(4).optional(),
    cocher: z.array(texte(64)).max(3).optional(),
    survoler: texte(64).optional(),
    repli: z.enum(OBJETS).optional(),
  })
  .strict();

const etape = z
  .object({
    titre: texte(60),
    ligne: texte(120),
    detail: texte(300),
    visuel: z.discriminatedUnion("sorte", [visuelObjet, visuelEcran]),
    humaine: z.boolean().optional(),
  })
  .strict();

const fait = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]{0,47}$/, "identifiant de fait mal formé"),
    enonce: texte(200),
    valeurs: z.array(z.number().finite()),
    source: z.enum(SOURCES_FAIT),
    preuve: texte(300),
  })
  .strict();

export const schemaCas = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]{1,47}$/, "identifiant de cas mal formé"),
    version: z.number().int().min(1),
    offre: z.enum(OFFRES),
    nature: z.enum(NATURES).optional(),
    posture: z.enum(POSTURES),
    titre: texte(100),
    /**
     * Thème court du cas (« Recrutement », « Blog ») : le sur-titre des écrans qui n'ont pas d'étiquette propre (le lien
     * de la fin, l'appel au mot, la preuve) le porte, suivi de la posture (« RECRUTEMENT · CAS RÉEL »). Un mot ou deux.
     */
    theme: texte(30).optional(),
    promesse: texte(100).refine((p) => nombreMots(p) <= 8, "promesse de plus de 8 mots"),
    cible: texte(160),
    avant: z.object({ taches: z.array(texte(80)).min(2).max(6), total: texte(40).optional() }).strict(),
    etapes: z.array(etape).min(3, "au moins 3 étapes").max(7, "pas plus de 7 étapes"),
    resteHumain: texte(200),
    /**
     * V4-3 · place de la partie humaine DANS la suite des étapes : le rang de l'étape après laquelle elle vient (le vrai
     * fonctionnement : pour le recrutement, la visio a lieu après le rappel, avant le contrat). Contrôlée par R23.
     */
    resteHumainApresEtape: z.number().int().min(1).max(7).optional(),
    resultat: texte(200),
    faits: z.array(fait),
    conformite: z.object({ rgpd: z.object({ phrase: texte(200), source: z.literal("will"), le: date }).strict().optional() }).strict().optional(),
    documentPromis: z.object({ nom: texte(80), finCadeauId: texte(64) }).strict(),
    mot: z.string().regex(/^[\p{L}\p{N}]{2,24}$/u, "mot de 2 à 24 lettres ou chiffres, sans espace"),
    motDit: z.string().min(1).max(12, "forme lue du mot de 12 caractères au plus").optional(),
    vigilance: z.array(texte(200)),
    enServiceVerifie: z.object({ le: date, source: texte(200) }).strict().optional(),
    valideParWill: z.object({ le: date, source: texte(200) }).strict().optional(),
  })
  .strict()
  .superRefine((cas, ctx) => {
    cas.etapes.forEach((e, i) => {
      if (e.visuel.sorte === "ecran" && !e.visuel.repli) ctx.addIssue({ code: "custom", path: ["etapes", i, "visuel", "repli"], message: "une étape à écran réel doit déclarer un objet de repli" });
      if (e.visuel.sorte === "ecran" && e.visuel.mouvement === "frappe" && !e.visuel.saisies) ctx.addIssue({ code: "custom", path: ["etapes", i, "visuel", "saisies"], message: "une frappe demande ses saisies" });
    });
    if (cas.resteHumainApresEtape !== undefined && cas.resteHumainApresEtape > cas.etapes.length) ctx.addIssue({ code: "custom", path: ["resteHumainApresEtape"], message: `la partie humaine vient après l'étape ${cas.resteHumainApresEtape} ; le cas n'en a que ${cas.etapes.length}` });
    if (cas.posture === "chez-nous" && !cas.enServiceVerifie) ctx.addIssue({ code: "custom", path: ["enServiceVerifie"], message: "un cas « chez nous » exige la vérification qu'il est en service" });
    if (cas.nature && cas.offre !== "integration") ctx.addIssue({ code: "custom", path: ["nature"], message: "seule une intégration porte une nature" });
    if (new Set(cas.faits.map((f) => f.id)).size !== cas.faits.length) ctx.addIssue({ code: "custom", path: ["faits"], message: "deux faits portent le même identifiant" });
  });

export type CasConcret = z.infer<typeof schemaCas>;
export type EtapeCas = CasConcret["etapes"][number];
export type FaitCas = CasConcret["faits"][number];
export type VisuelCas = EtapeCas["visuel"];

/** Ce qui dit qu'une étape se passe derrière une connexion (la console, un espace client) : le site public ne la montre pas. */
const DERRIERE_CONNEXION = /(?<!\p{L})(console|espace (client|membre|personnel)|tableau de bord|connexion|connectée?s?)(?!\p{L})/iu;

/**
 * P2C · L'étape à écran réel dont l'écran est derrière une connexion : sa capture ne filmerait que la page publique, la
 * feuille propose alors « Fournir cet écran ». Le cas n'a pas de champ pour le dire : on le lit dans ce que l'étape dit.
 */
export function ecranDerriereConnexion(etape: Pick<EtapeCas, "titre" | "ligne" | "detail" | "visuel">): boolean {
  return etape.visuel.sorte === "ecran" && DERRIERE_CONNEXION.test(`${etape.titre} ${etape.ligne} ${etape.detail}`);
}

export type ResultatCas = { ok: true; cas: CasConcret } | { ok: false; raisons: string[] };

/** Valide un cas brut. Refus en français, un message par défaut, chacun précédé de son emplacement. */
export function verifierCas(brut: unknown): ResultatCas {
  const lu = schemaCas.safeParse(brut);
  if (lu.success) return { ok: true, cas: lu.data };
  const raisons = lu.error.issues.map((i) => {
    const lieu = i.path.length ? `${i.path.join(".")} : ` : "";
    if (i.code === "invalid_type") return `${lieu}valeur absente ou de mauvais type`;
    if (i.code === "unrecognized_keys") return `${lieu}champ inconnu`;
    if (i.code === "invalid_value") return `${lieu}valeur non permise`;
    return `${lieu}${i.message}`;
  });
  return { ok: false, raisons };
}

/** Empreinte d'un cas : même contenu, même empreinte, quel que soit l'ordre des clés (FNV-1a deux passes + longueur). */
export function empreinteCas(cas: CasConcret): string {
  const t = jsonCanonique(cas);
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x0100019d) >>> 0;
  }
  return `cas-${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}-${t.length.toString(36)}`;
}
