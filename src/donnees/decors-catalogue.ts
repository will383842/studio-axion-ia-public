/**
 * CATALOGUE DE DÉPART DES DÉCORS (lot M3 ; `<dossier-de-plan-prive>/decors/CATALOGUE-DECORS.md`, décision de Will).
 *
 * Méthode hybride :
 * - FONDS NEUTRES AXION (N1 à N6) : posés par le studio derrière le double rendu sans fond (`neutre-incruste`),
 *   avec un liseré de lumière et le même grain. Validés par Will et mis en avant : N1 Halo orange (DÉFAUT de l'avocat),
 *   N5 Crème chaud (la variante claire), N3 Lumière dorée. N2, N4, N6 sont construits mais EN RÉSERVE : jamais
 *   proposés en premier.
 * - DÉCORS RÉALISTES (R1 à R8) : Looks HeyGen (Will généré DANS la pièce), statut `a_verifier` tant que Will ne les a pas
 *   validés sur une capture ; simulés tant qu'aucune clé n'existe.
 *
 * Une seule source pour la migration au démarrage (étape 9) et pour les tests. PUR.
 */
import { DECOR_DEFAUT_AVOCAT } from "@/domaine/decors";
import type { ElementBibliotheque, Fichier, Licence, ValeurDecor } from "@/domaine/types";

/** Décor par défaut du format avocat (N1 Halo orange). */
export { DECOR_DEFAUT_AVOCAT };

const PROPRIETE: Licence = { type: "propriete", usageCommercial: true, reseaux: [] };

/** Identifiant de fichier d'une image du catalogue (même règle que la démonstration). */
function idFichier(cle: string): string {
  return "f-" + cle.replace(/^\/demo\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "");
}

interface EntreeNeutre {
  code: string;
  id: string;
  nom: string;
  fichier: string;
  ordre: number;
  misEnAvant?: boolean;
  reserve?: boolean;
  clair?: boolean;
  teinte: string;
  teinteLumiere?: string;
  directionLumiere: ValeurDecor["directionLumiere"];
  ambiance: string;
  motsCles: string[];
  lutsConseillees?: string[];
}

/** Ordre d'affichage : les trois validés d'abord (N1, N5, N3), la réserve à la fin. */
const NEUTRES: EntreeNeutre[] = [
  { code: "N1", id: DECOR_DEFAUT_AVOCAT, nom: "Halo orange", fichier: "fond-1-halo-orange", ordre: 1, misEnAvant: true, teinte: "#110A05", teinteLumiere: "#C65A2E", directionLumiere: "face", ambiance: "noir brun, lueur orange douce derrière la tête", motsCles: ["halo", "orange", "noir", "sombre", "axion"] },
  {
    code: "N5",
    id: "decor-n5-creme-chaud",
    nom: "Crème chaud",
    fichier: "fond-5-creme-chaud",
    ordre: 2,
    misEnAvant: true,
    clair: true,
    teinte: "#F2E9DA",
    teinteLumiere: "#FFCCA8",
    directionLumiere: "face",
    ambiance: "dégradé crème vers sable, halo pêche très léger",
    motsCles: ["crème", "clair", "lumineux", "jour", "linkedin"],
    lutsConseillees: ["Doux", "Naturel"],
  },
  { code: "N3", id: "decor-n3-lumiere-doree", nom: "Lumière dorée", fichier: "fond-3-bois-dore", ordre: 3, misEnAvant: true, teinte: "#110A05", teinteLumiere: "#D69650", directionLumiere: "droite", ambiance: "brun profond, raie de lumière dorée rasante, flous lumineux", motsCles: ["doré", "lumière", "bois", "chaleureux", "buffer"] },
  { code: "N2", id: "decor-n2-tube-led", nom: "Tube LED orange", fichier: "fond-2-tube-led-orange", ordre: 20, reserve: true, teinte: "#110A05", teinteLumiere: "#FF9E5C", directionLumiere: "droite", ambiance: "studio sombre, tube LED orange vertical flou sur le côté", motsCles: ["led", "studio", "orange", "série"] },
  { code: "N4", id: "decor-n4-noir-uni", nom: "Noir uni", fichier: "fond-4-noir-uni", ordre: 21, reserve: true, teinte: "#110A05", directionLumiere: "face", ambiance: "noir brun sans effet", motsCles: ["noir", "uni", "sobre"] },
  {
    code: "N6",
    id: "decor-n6-mur-creme",
    nom: "Mur crème et lumière",
    fichier: "fond-6-mur-creme-lumiere",
    ordre: 22,
    reserve: true,
    clair: true,
    teinte: "#F2E9DA",
    teinteLumiere: "#E6B464",
    directionLumiere: "droite",
    ambiance: "mur crème, raies de lumière de fenêtre dorées et floues",
    motsCles: ["mur", "crème", "clair", "fenêtre", "témoignage"],
    lutsConseillees: ["Doux", "Naturel"],
  },
];

interface EntreeRealiste {
  code: string;
  id: string;
  nom: string;
  ordre: number;
  description: string;
  /** Description donnée au générateur (Look HeyGen, ou photo de repli sans personne), en anglais. */
  descriptionEn: string;
  motsCles: string[];
}

/** Même ambiance que les visuels Buffer : bois, lumière dorée rasante, clair-obscur. */
const REALISTES: EntreeRealiste[] = [
  { code: "R1", id: "decor-r1-bureau-bois", nom: "Bureau bois clair-obscur", ordre: 10, description: "bureau en bois sombre, lampe, carnet, lumière de fin de journée, fond flou", descriptionEn: "a dark wooden desk with a brass desk lamp and a leather notebook, end-of-day light, softly blurred background", motsCles: ["bureau", "bois", "avocat", "cabinet"] },
  { code: "R2", id: "decor-r2-bibliotheque", nom: "Bibliothèque", ordre: 11, description: "rayonnages de livres flous, lumière chaude", descriptionEn: "tall shelves of law books softly out of focus, warm light", motsCles: ["bibliothèque", "livres", "juridique"] },
  { code: "R3", id: "decor-r3-direction", nom: "Bureau de direction", ordre: 12, description: "grande baie vitrée sur la ville au coucher du soleil, floue", descriptionEn: "an executive office with a large window overlooking the city at sunset, background softly blurred", motsCles: ["direction", "baie", "ville", "dirigeant"] },
  { code: "R4", id: "decor-r4-reunion", nom: "Salle de réunion", ordre: 13, description: "table, chaises, écran éteint, tons bois et noir", descriptionEn: "a meeting room with a wooden table, chairs and a switched-off screen, wood and black tones", motsCles: ["réunion", "table", "équipe"] },
  { code: "R5", id: "decor-r5-atelier", nom: "Atelier", ordre: 14, description: "atelier ou entrepôt flou, lumières chaudes (industrie, PME)", descriptionEn: "a softly blurred workshop or warehouse with warm hanging lights, small business atmosphere", motsCles: ["atelier", "entrepôt", "industrie", "pme", "production"] },
  { code: "R6", id: "decor-r6-studio-podcast", nom: "Studio podcast", ordre: 15, description: "micro, panneaux acoustiques sombres, petite lumière orange", descriptionEn: "a podcast studio with a microphone, dark acoustic panels and a small orange light", motsCles: ["podcast", "studio", "micro"] },
  { code: "R7", id: "decor-r7-salon", nom: "Salon café", ordre: 16, description: "fauteuil cuir, plante, lumière tamisée", descriptionEn: "a lounge with a leather armchair, a green plant and dim warm light", motsCles: ["salon", "café", "fauteuil", "détente"] },
  { code: "R8", id: "decor-r8-open-space", nom: "Open space", ordre: 17, description: "espace de travail moderne flou, tons chauds", descriptionEn: "a modern open-plan workspace softly out of focus, warm tones", motsCles: ["open space", "bureau moderne", "startup", "équipe"] },
];

/**
 * Lot B1 : vignette de chaque fond neutre SUR le double (jamais sur un décor vide), calculée gratuitement par la brique
 * `composition` (`outils/decors-b1/vignettes-sur-double.mts`, opération `image-fixe`), sous `public/demo/decors/sur-double/`.
 * Tant qu'aucun double réel de Will n'existe, le double est la silhouette simulée de la démonstration M4.
 */
export const cleVignetteSurDouble = (fichier: string) => `/demo/decors/sur-double/${fichier}.jpg`;

/** Identifiant du fichier « vignette sur le double » d'un fond neutre du catalogue (par son code, N1…N6). */
export function vignetteSurDoubleId(code: string): string | undefined {
  const n = NEUTRES.find((x) => x.code === code);
  return n ? idFichier(cleVignetteSurDouble(n.fichier)) : undefined;
}

/** Description anglaise d'un décor réaliste du catalogue (R1…R8), donnée au générateur. */
export function descriptionEnCatalogue(code: string | undefined): string | undefined {
  return REALISTES.find((r) => r.code === code)?.descriptionEn;
}

/** Codes des décors du catalogue de départ (N1…N6, R1…R8). */
export const CODES_CATALOGUE = (): string[] => [...NEUTRES.map((n) => n.code), ...REALISTES.map((r) => r.code)];

/** Fichiers (image pleine, vignette, vignette sur le double) des fonds neutres, sous `public/demo/decors/`. */
export function fichiersDecorsCatalogue(maintenant: string): Fichier[] {
  return NEUTRES.flatMap((n) =>
    [
      { cle: `/demo/decors/${n.fichier}.jpg`, l: 1080, h: 1920 },
      { cle: `/demo/decors/${n.fichier}-vignette.jpg`, l: 270, h: 480 },
      { cle: cleVignetteSurDouble(n.fichier), l: 540, h: 960 },
    ].map(({ cle, l, h }) => ({
      id: idFichier(cle),
      cleStockage: cle,
      nom: cle.split("/").pop() ?? cle,
      mime: "image/jpeg",
      taille: l > 500 ? 60_000 : 3_000,
      largeur: l,
      hauteur: h,
      origine: "demo" as const,
      statut: "pret" as const,
      creeLe: maintenant,
      modifieLe: maintenant,
    })),
  );
}

/** Les 14 décors du catalogue de départ (6 fonds neutres, 8 décors réalistes à vérifier). */
export function decorsCatalogue(maintenant: string): ElementBibliotheque[] {
  const base = { marqueId: "marque-axion", licence: PROPRIETE, creeLe: maintenant, modifieLe: maintenant, formatsParDefaut: [] as string[] };
  const neutres: ElementBibliotheque[] = NEUTRES.map((n) => ({
    ...base,
    id: n.id,
    type: "decor",
    nom: n.nom,
    motsCles: n.motsCles,
    fichierId: idFichier(`/demo/decors/${n.fichier}.jpg`),
    vignetteFichierId: idFichier(`/demo/decors/${n.fichier}-vignette.jpg`),
    favori: !!n.misEnAvant,
    valeur: {
      type: "decor",
      mode: "image",
      imageFichierId: idFichier(`/demo/decors/${n.fichier}.jpg`),
      teinte: n.teinte,
      ambiance: n.ambiance,
      // Fond déjà flou par construction : aucun flou ajouté.
      profondeurFlou: 0,
      teinteLumiere: n.teinteLumiere,
      directionLumiere: n.directionLumiere,
      positionSujet: 0.5,
      methode: "neutre-incruste",
      catalogue: { code: n.code, ordre: n.ordre, misEnAvant: n.misEnAvant, reserve: n.reserve },
      clair: n.clair,
      statut: "valide",
      lutsConseillees: n.lutsConseillees,
      vignetteDoubleFichierId: idFichier(cleVignetteSurDouble(n.fichier)),
    },
  }));
  const realistes: ElementBibliotheque[] = REALISTES.map((r) => ({
    ...base,
    id: r.id,
    type: "decor",
    nom: r.nom,
    motsCles: r.motsCles,
    valeur: {
      type: "decor",
      mode: "image",
      ambiance: r.description,
      description: r.description,
      profondeurFlou: 0,
      teinteLumiere: "#D69650",
      directionLumiere: "gauche",
      positionSujet: 0.5,
      methode: "look-heygen",
      catalogue: { code: r.code, ordre: r.ordre },
      statut: "a_verifier",
    },
  }));
  return [...neutres, ...realistes];
}
