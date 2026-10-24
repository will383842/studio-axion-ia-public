import "server-only";
import { normaliser } from "@/domaine/controles-script/texte";
import { controlerCarrousel } from "@/domaine/controles-visuel/porte";
import { interditsDans as interditsDansPartage, interditsTousEcrivains } from "@/domaine/qualite-script/regles/interdits";
import type { ContextePorte } from "@/domaine/visuels/contrats";
import { obtenirServiceRendu } from "@/fournisseurs/rendu/client";
import { ecrireParametre, fournisseur, depots, lireParametre, maintenant, sousVerrou } from "@/services/_commun";
import { generateurAllume } from "../interrupteur";
import { fournisseurTexte } from "../texte/choisir";
import { ErreurVisuel, type DependancesCarrousels } from "./carrousels";
import { rendreCarrousel, type DependancesRenduVisuels, type RegistreRendus, type ResultatRendu } from "./rendu";
import { rendreVersionsReseaux, type RegistreVersionsReseaux, type VersionRendue } from "./rendu-reseaux";

/**
 * SEUL endroit qui relie les services des carrousels au reste du studio (dépôt, texte, porte, rendu, stockage, paramètres).
 * Le texte vient de `fournisseurTexte` (simulation ou session) : jamais le fournisseur API payant.
 * Les adresses signées ne sont jamais journalisées.
 * NB : l'écrivain `visuel` de la liste d'interdits viendra avec M5-04 ; en attendant, le vérificateur partagé de l'écrivain « ecrire » fait foi.
 */

const VALIDITE_SEC = 3600;
const PREFIXE_REGISTRE = "visuels.rendu.";

/**
 * UNE seule liste d'interdits pour tous les générateurs : le vérificateur partagé (`qualite-script/regles/interdits`).
 * La colonne `expression` de la base 8 contient des DESCRIPTIONS (« Villeexemple, ou toute ville ou région »), elle ne sert pas de test.
 * Le fichier partagé n'est pas modifié : les compléments propres aux visuels (promesses de gain, financement CPF) sont combinés ici.
 */
const COMPLEMENTS_VISUELS: readonly { libelle: string; motif: RegExp }[] = [
  { libelle: "« garanti »", motif: /(?:^|[^a-z])garanti(?:e|s|es)?(?=$|[^a-z])/ },
  { libelle: "« vous allez gagner »", motif: /(?:^|[^a-z])vous[\s-]+allez[\s-]+gagner(?=$|[^a-z])/ },
  { libelle: "« CPF »", motif: /(?:^|[^a-z])cpf(?=$|[^a-z])/ },
];

export function interditsDans(texte: string): string[] {
  const n = normaliser(texte);
  return [
    ...new Set([
      ...interditsDansPartage(texte, "ecrire").map((i) => i.libelle),
      ...interditsTousEcrivains(texte),
      ...COMPLEMENTS_VISUELS.filter((c) => c.motif.test(n)).map((c) => c.libelle),
    ]),
  ];
}

const contextePorte = async (): Promise<ContextePorte> => ({ faitsDisponibles: false, interditsDans });

const mimeDe = (cle: string) => (cle.endsWith(".pdf") ? "application/pdf" : "image/jpeg");

const stockage: DependancesRenduVisuels["stockage"] = {
  async urlDepot(cle) {
    const s = await fournisseur("stockage");
    if (!s.urlDepotDuree) throw new Error("Le stockage des fichiers n'est pas relié");
    return s.urlDepotDuree(cle, VALIDITE_SEC, mimeDe(cle));
  },
  urlLecture: lireUrl,
};

async function lireUrl(cle: string): Promise<string> {
  const s = await fournisseur("stockage");
  return s.urlLectureDuree ? s.urlLectureDuree(cle, VALIDITE_SEC) : s.urlLecture(cle);
}

async function lireUrlTelechargement(cle: string, nom: string): Promise<string> {
  const s = await fournisseur("stockage");
  return s.urlLectureDuree ? s.urlLectureDuree(cle, VALIDITE_SEC, { telechargerSous: nom }) : lireUrl(cle);
}

/** Registre des rendus gardé dans les paramètres : un même contenu n'est jamais rendu deux fois. */
const registre: RegistreRendus = {
  lire: (empreinte) => lireParametre<ResultatRendu | null>(PREFIXE_REGISTRE + empreinte, null),
  ecrire: (empreinte, resultat) => ecrireParametre(PREFIXE_REGISTRE + empreinte, resultat),
};

/** Registre des versions par réseau : l'empreinte par cadre diffère de l'empreinte sans cadre, le préfixe partagé ne crée aucune collision. */
const registreReseaux: RegistreVersionsReseaux = {
  lire: (empreinte) => lireParametre<VersionRendue | null>(PREFIXE_REGISTRE + empreinte, null),
  ecrire: (empreinte, version) => ecrireParametre(PREFIXE_REGISTRE + empreinte, version),
};

export function dependancesCarrousels(): DependancesCarrousels {
  const allume = () => generateurAllume("carrousels");
  return {
    depot: depots().visuels,
    texte: fournisseurTexte,
    porte: controlerCarrousel,
    contextePorte,
    allume,
    rendre: (spec) => rendreCarrousel(spec, { rendu: () => obtenirServiceRendu(), stockage, registre, allume }),
    rendreReseaux: (spec, reseaux) => rendreVersionsReseaux(spec, reseaux, { rendu: () => obtenirServiceRendu(), stockage, registre: registreReseaux, allume }),
    urlLecture: lireUrl,
    urlTelechargement: lireUrlTelechargement,
    verrou: sousVerrou,
    maintenant,
    lireParametre,
    ecrireParametre,
  };
}

const GENERIQUE = "Un souci est survenu. Réessayez dans un instant.";

const PHRASES_CODES: Record<string, string> = {
  GENERATEUR_ETEINT: "Le générateur est éteint (Réglages › Carrousels)",
  API_PAYANTE_VERROUILLEE: "Le texte par API payante est verrouillé",
  SESSION_ATTENDUE: "Ce carrousel vient d'une session : déposez un nouveau fichier",
  PAQUET_INVALIDE: "Le texte déposé est vide, trop long ou illisible",
  SUJET_INVALIDE: "Le sujet fait de 3 à 200 signes, sans lien",
  TRANSITION_REFUSEE: "Cette action n'est pas possible pour ce carrousel dans son état actuel",
  CORBEILLE_REFUSEE: "Ce carrousel ne peut pas aller à la corbeille maintenant",
  INTROUVABLE: "Ce carrousel est introuvable",
  INCONNUE: GENERIQUE,
};

/** Code d'erreur passé dans l'adresse de retour (`?erreur=`) : jamais le texte lui-même. */
export function codeErreur(e: unknown): string {
  return e instanceof ErreurVisuel ? e.code : "INCONNUE";
}

/** Phrase française d'un code d'erreur lu dans l'adresse ; un code inconnu donne la phrase générique. */
export function phraseDuCode(code: string | undefined): string | undefined {
  if (code === undefined) return undefined;
  return Object.hasOwn(PHRASES_CODES, code) ? PHRASES_CODES[code] : GENERIQUE;
}

/** Identifiant de carrousel lu dans un formulaire (valeur inconnue ou mal formée : null). */
export function lireIdFormulaire(donnees: FormData): string | null {
  const id = donnees.get("id");
  return typeof id === "string" && /^vis_[\w-]{1,80}$/.test(id) ? id : null;
}
