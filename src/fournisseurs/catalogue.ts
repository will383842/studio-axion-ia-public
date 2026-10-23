/**
 * CATALOGUE DES SERVICES RÉELS PRÉVUS (lot R0, plan « outils réels » du 03/10, constats C1 et C2). PUR : aucun appel
 * réseau, aucune lecture de valeur secrète (seulement la PRÉSENCE d'une variable, et le début d'une ADRESSE).
 *
 * Pour chaque type de fournisseur : les implémentations réelles prévues, avec leur identifiant EXACT (celui du registre
 * `fournisseurs/index.ts` et du réglage « fournisseur.<type> »), un nom lisible par Will, le coût en mots simples et
 * les NOMS des réglages du serveur qu'il leur faut. Réglages > Connexions s'en sert pour proposer les vrais choix et
 * dire, en mots simples, qu'un réglage manque (les NOMS ne sont jamais affichés : données, journal et relevé seulement).
 *
 * Une implémentation cataloguée n'est UTILISABLE que si elle est aussi INSCRITE au registre (code livré + réglages
 * présents) : le catalogue décrit, le registre décide. Chaque lot qui livre un service ajoute sa ligne au registre ;
 * il n'a rien à changer ici tant que l'identifiant et les variables restent ceux-ci.
 */
import { VARIABLES_REMOTION_LAMBDA } from "./rendu/montage";
import type { TypeFournisseur } from "./types";

export interface ImplementationPrevue {
  /** Identifiant exact dans le registre et dans le réglage « fournisseur.<type> ». */
  id: string;
  /** Nom affiché à Will (mots simples ; les services qu'il paie gardent leur nom). */
  nom: string;
  /** Coût à l'usage, en mots simples (« Gratuit, sur le serveur », « Environ 0,05 $ par vidéo »). */
  cout: string;
  /**
   * Réglages du serveur nécessaires. Il suffit qu'UN des ensembles soit complet (le plus souvent il n'y en a qu'un ;
   * notifications : téléphone OU e-mail ; images : une banque OU la fabrication).
   */
  ensembles: readonly (readonly string[])[];
  /** Réglages qui doivent porter une valeur précise (service « écrit et éteint » : il faut l'allumer exprès). */
  valeurs?: Readonly<Record<string, string>>;
  /**
   * Réglages qui sont des ADRESSES : présents mais sans « http:// » ou « https:// », l'inscription les refuse
   * (`aligneurReel`) ; ils comptent donc comme manquants. Une adresse n'est pas un secret.
   */
  adresses?: readonly string[];
  /** Lot du plan qui livre (ou a livré) le code. Indicatif, jamais affiché. */
  lot: string;
}

const SERVEUR_RENDU = ["STUDIO_RENDU_URL"] as const;
/** Claude est proposé dès qu'AU MOINS une clé de compte d'abonnement est posée (jamais la seule clé payante). */
const CLES_COMPTES_CLAUDE = [["ANTHROPIC_API_KEY"], ["ANTHROPIC_API_KEY_2"], ["ANTHROPIC_API_KEY_3"]] as const;
const R2 = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const;

/** Les outils de calcul du serveur du studio (montage, miniatures, étalonnage, son) : gratuits, une même adresse. */
const studioRendu = (lot: string): ImplementationPrevue => ({ id: "studio-rendu", nom: "Serveur du studio", cout: "Gratuit, sur le serveur", ensembles: [SERVEUR_RENDU], lot });

export const CATALOGUE: { readonly [K in TypeFournisseur]: readonly ImplementationPrevue[] } = {
  script: [{ id: "claude", nom: "Claude", cout: "1,50 $ au plus par sujet", ensembles: CLES_COMPTES_CLAUDE, lot: "G0" }],
  visage: [
    {
      id: "heygen",
      nom: "HeyGen",
      cout: "Environ 0,07 $ par seconde de vidéo",
      ensembles: [["HEYGEN_API_KEY"]],
      // Lot B1 : les Looks HeyGen sont écrits et éteints ; ils ne s'inscrivent qu'avec FOURNISSEUR_VISAGE=heygen.
      valeurs: { FOURNISSEUR_VISAGE: "heygen" },
      lot: "B1 puis R7",
    },
  ],
  voix: [{ id: "heygen", nom: "HeyGen", cout: "Environ 0,30 $ pour 1 000 caractères lus", ensembles: [["HEYGEN_API_KEY"]], lot: "A1" }],
  montage: [
    { ...studioRendu("M4"), nom: "Montage sur le serveur du studio" },
    {
      id: "remotion-lambda",
      nom: "Montage en ligne (plus rapide)",
      cout: "Environ 4 centimes de dollar par minute de calcul",
      ensembles: [[...SERVEUR_RENDU, ...VARIABLES_REMOTION_LAMBDA]],
      valeurs: { REMOTION_LAMBDA_ACTIVE: "true" },
      lot: "M4b",
    },
  ],
  illustration: [
    {
      id: "reel",
      nom: "Banques d'images et images fabriquées",
      cout: "Banques gratuites ; image fabriquée : quelques centimes",
      ensembles: [["PEXELS_API_KEY"], ["PIXABAY_API_KEY"], ["FAL_KEY"]],
      lot: "A2",
    },
  ],
  etalonnage: [studioRendu("R5")],
  son: [studioRendu("R5")],
  miniature: [studioRendu("R4")],
  publication: [{ id: "buffer", nom: "Buffer", cout: "Gratuit (votre abonnement Buffer)", ensembles: [["BUFFER_API_KEY"]], lot: "R1" }],
  "texte-reseaux": [{ id: "claude", nom: "Claude", cout: "Environ 0,05 $ par vidéo", ensembles: CLES_COMPTES_CLAUDE, lot: "R2" }],
  notification: [
    {
      id: "web-push-email",
      nom: "Téléphone et e-mail",
      cout: "Gratuit",
      ensembles: [
        ["VAPID_PUBLIQUE", "VAPID_PRIVEE", "VAPID_SUJET"],
        ["EMAIL_SECOURS_CLE", "EMAIL_SECOURS_EXPEDITEUR", "EMAIL_SECOURS_DESTINATAIRE"],
      ],
      lot: "R3",
    },
  ],
  stockage: [{ id: "r2", nom: "Stockage en ligne", cout: "Quelques centimes par mois", ensembles: [R2], lot: "M1b" }],
  alignement: [{ id: "studio-aligneur", nom: "Calage sur le serveur du studio", cout: "Gratuit, sur le serveur", ensembles: [["STUDIO_ALIGNEUR_URL"]], adresses: ["STUDIO_ALIGNEUR_URL"], lot: "D3 puis R6" }],
  // Vidéos sur le site (lots S3-S4) : le vrai client est PRÉVU, jamais choisi par défaut ; seul le site factice fonctionne.
  site: [{ id: "http", nom: "Le site de l'entreprise", cout: "Gratuit", ensembles: [["SITE_VIDEOS_URL", "SITE_VIDEOS_SECRET"]], lot: "S4" }],
};

/** Implémentation prévue pour ce type sous cet identifiant (ou rien). */
export function implementationPrevue(type: TypeFournisseur, id: string): ImplementationPrevue | undefined {
  return CATALOGUE[type].find((i) => i.id === id);
}

/** Tous les noms de réglages du serveur cités par le catalogue (sans doublon). */
export function variablesDuCatalogue(): string[] {
  const noms = new Set<string>();
  for (const liste of Object.values(CATALOGUE)) {
    for (const i of liste) {
      for (const e of i.ensembles) for (const n of e) noms.add(n);
      for (const n of Object.keys(i.valeurs ?? {})) noms.add(n);
    }
  }
  return [...noms];
}

/**
 * NOMS des réglages qui manquent sur le serveur pour cette implémentation (vide : tout y est). Seule la PRÉSENCE est
 * lue, jamais la valeur (sauf l'égalité exacte d'un interrupteur déclaré dans `valeurs`, et le début d'une adresse
 * déclarée dans `adresses`, jugé comme à l'inscription). Plusieurs ensembles : on nomme celui à qui il manque le moins
 * (le premier à égalité).
 */
export function reglagesManquants(implementation: ImplementationPrevue, env: Record<string, string | undefined>): string[] {
  const present = (n: string) => {
    const v = env[n]?.trim();
    if (!v) return false;
    return !implementation.adresses?.includes(n) || /^https?:\/\//.test(v);
  };
  let meilleur: string[] | null = null;
  for (const e of implementation.ensembles) {
    const manque = e.filter((n) => !present(n));
    if (!meilleur || manque.length < meilleur.length) meilleur = manque;
  }
  const interrupteurs = Object.entries(implementation.valeurs ?? {})
    .filter(([n, v]) => env[n]?.trim() !== v)
    .map(([n]) => n);
  return [...new Set([...(meilleur ?? []), ...interrupteurs])];
}
