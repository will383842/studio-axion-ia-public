import { LIMITES } from "../../briques/visuels/limites";
import { PAGES, TYPES_COUVERTURE } from "../../briques/visuels/registre-pages";
import { chiffresDe } from "../../domaine/image-video/chiffres";
import { empreinteCarrousel, premierSansRepetition } from "../../domaine/controles-visuel/memoire-carrousels";
import { contientJAide, expressionsBannieDans, tutoiementDans } from "../../domaine/controles-visuel/texte";
import { CarrouselSpec } from "../../domaine/visuels/schema";
import type { DemandeTexteCarrousel, EmpreinteCarrousel, FournisseurTexteCarrousel, ReponseTexteCarrousel } from "../../domaine/visuels/contrats";
import type { CarrouselSpecType } from "../../domaine/visuels/types";
import { FIXTURES_AXION } from "./fixtures";
import { FIXTURES_TRAMES } from "./fixtures-trames";
import { ErreurTexteCarrousel } from "./verrou-api";

const SUJET_MAX = 200;
const MOTS_NOMBRE = /(?<![\p{L}])(?:deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|vingt|trente|cent|mille|zéro|deuxième)(?![\p{L}])/iu;

function normaliser(sujet: string): string {
  return sujet.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/gu, " ").trim();
}

function contientChiffre(texte: string): boolean {
  return /\d/u.test(texte) || chiffresDe(texte).length > 0 || MOTS_NOMBRE.test(texte);
}

/** Hachage pur FNV-1a 32 bits. */
function fnv1a(texte: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * Choix déterministe : FNV-1a du sujet normalisé, décalé d'un cran à chaque « Refaire » (version), ramené au nombre de modèles du studio ;
 * puis, à partir de là, le premier modèle qui ne répète ni la suite ni la couverture des derniers carrousels (`eviter`, L7).
 */
function choisirFixture(sujet: string, version: number, eviter: readonly EmpreinteCarrousel[]) {
  const depart = (fnv1a(normaliser(sujet)) + Math.max(0, version - 1)) % FIXTURES_AXION.length;
  return premierSansRepetition(FIXTURES_AXION, depart, (f) => empreinteCarrousel(specAvecSujet(f.spec, sujet).spec), eviter);
}

/** Listes sans ordre imposé (points, questions, checklist) : « Refaire » les fait tourner d'un cran par version, la trame reste la même. */
const LISTES_LIBRES: Partial<Record<string, string>> = { T06: "points", T23: "questions", T27: "lignes" };

function specVariee(spec: CarrouselSpecType, version: number): CarrouselSpecType {
  const cran = Math.max(0, version - 1);
  if (cran === 0) return spec;
  const pages = spec.pages.map((page) => {
    const cle = LISTES_LIBRES[page.type];
    const liste = cle ? (page as Record<string, unknown>)[cle] : undefined;
    if (!cle || !Array.isArray(liste) || liste.length < 2) return page;
    const k = cran % liste.length;
    return { ...page, [cle]: [...liste.slice(k), ...liste.slice(0, k)] };
  });
  return { ...spec, pages } as CarrouselSpecType;
}

/** Un sujet que la porte refuserait (expression bannie, tutoiement, « J'aide ») ne devient jamais titre. */
function sujetRefuse(sujet: string): boolean {
  return expressionsBannieDans(sujet).length > 0 || tutoiementDans(sujet) !== undefined || contientJAide(sujet);
}

const NON_REPRIS = "votre sujet n'a pas été repris comme titre parce qu'";

/** Pourquoi le sujet ne devient pas le titre de couverture (undefined : il est repris). */
function raisonNonReprise(spec: CarrouselSpecType, sujet: string): string | undefined {
  const [couverture] = spec.pages;
  if (!(TYPES_COUVERTURE as readonly string[]).includes(couverture.type) || !("titre" in couverture)) return `${NON_REPRIS}il ne convient pas à ce modèle de couverture`;
  if (contientChiffre(sujet)) return `${NON_REPRIS}il contient un nombre`;
  if (sujetRefuse(sujet)) return `${NON_REPRIS}il contient un mot ou une formule à éviter`;
  if (sujet.length > Math.min(PAGES[couverture.type].titreMax, LIMITES.titreMax)) return `${NON_REPRIS}il est trop long pour la couverture`;
  return undefined;
}

/** Titre de couverture : le sujet seulement s'il tient dans le budget du type, sans chiffre, et que la spec reste valide. */
function specAvecSujet(spec: CarrouselSpecType, sujet: string): { spec: CarrouselSpecType; note?: string } {
  const raison = raisonNonReprise(spec, sujet);
  if (raison) return { spec, note: raison };
  const [couverture, ...suite] = spec.pages;
  const candidate = { ...spec, pages: [{ ...couverture, titre: sujet }, ...suite] } as CarrouselSpecType;
  return CarrouselSpec.safeParse(candidate).success ? { spec: candidate } : { spec, note: `${NON_REPRIS}il ne tient pas dans la couverture` };
}

/** Fournisseur de simulation : aucun réseau, aucun coût, résultat reproductible pour un même sujet. */
export function creerFournisseurSimulation(): FournisseurTexteCarrousel {
  return {
    mode: "simulation",
    async ecrire(demande: DemandeTexteCarrousel): Promise<ReponseTexteCarrousel> {
      if (demande.type !== "sujet") {
        throw new ErreurTexteCarrousel("SESSION_ATTENDUE", "La simulation n'accepte qu'un sujet ; un paquet de session passe par le fournisseur de session.");
      }
      const sujet = demande.sujet.trim();
      if (sujet.length === 0 || sujet.length > SUJET_MAX) {
        throw new ErreurTexteCarrousel("SUJET_INVALIDE", "Le sujet est vide ou trop long.");
      }
      // Une intention choisit la trame (L12) ; sans intention, le choix reste celui d'avant (modèle décalé par version, sans répéter les derniers : L7).
      const version = demande.version ?? 1;
      const fixture = demande.intention ? FIXTURES_TRAMES[demande.intention] : choisirFixture(sujet, version, demande.eviter ?? []);
      const { spec, note } = specAvecSujet(demande.intention ? specVariee(fixture.spec, version) : fixture.spec, sujet);
      const couverture = spec.pages[0];
      const titre = "titre" in couverture ? couverture.titre : sujet;
      return { titre, spec, pourquoi: [...fixture.pourquoi], mode: "simulation", ...(note ? { note } : {}) };
    },
  };
}
