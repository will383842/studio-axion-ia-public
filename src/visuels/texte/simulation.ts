import { LIMITES } from "../../briques/visuels/limites";
import { PAGES, TYPES_COUVERTURE } from "../../briques/visuels/registre-pages";
import { chiffresDe } from "../../domaine/image-video/chiffres";
import { CarrouselSpec } from "../../domaine/visuels/schema";
import type { DemandeTexteCarrousel, FournisseurTexteCarrousel, ReponseTexteCarrousel } from "../../domaine/visuels/contrats";
import type { CarrouselSpecType } from "../../domaine/visuels/types";
import { FIXTURES } from "./fixtures";
import { ErreurTexteCarrousel } from "./verrou-api";

const SUJET_MAX = 200;
const MOTS_NOMBRE = /(?<![\p{L}])(?:deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|vingt|trente|cent|mille|zéro|premier|première|deuxième|seconde|second)(?![\p{L}])/iu;

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

/** Choix déterministe : FNV-1a du sujet normalisé, ramené au nombre de fixtures. */
function choisirFixture(sujet: string) {
  return FIXTURES[fnv1a(normaliser(sujet)) % FIXTURES.length];
}

/** Titre de couverture : le sujet seulement s'il tient dans le budget du type, sans chiffre, et que la spec reste valide. */
function specAvecSujet(spec: CarrouselSpecType, sujet: string): CarrouselSpecType {
  const [couverture, ...suite] = spec.pages;
  if (!(TYPES_COUVERTURE as readonly string[]).includes(couverture.type) || !("titre" in couverture)) return spec;
  const max = Math.min(PAGES[couverture.type].titreMax, LIMITES.titreMax);
  if (sujet.length === 0 || sujet.length > max || contientChiffre(sujet)) return spec;
  const candidate = { ...spec, pages: [{ ...couverture, titre: sujet }, ...suite] } as CarrouselSpecType;
  return CarrouselSpec.safeParse(candidate).success ? candidate : spec;
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
      const fixture = choisirFixture(sujet);
      const spec = specAvecSujet(fixture.spec, sujet);
      const couverture = spec.pages[0];
      const titre = "titre" in couverture ? couverture.titre : sujet;
      return { titre, spec, pourquoi: [...fixture.pourquoi], mode: "simulation" };
    },
  };
}
