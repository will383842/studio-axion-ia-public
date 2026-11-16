/**
 * Moteur d'exemple « bonjour » construit par le gabarit (G1-03, reprend l'exemple de G2-09). Il sert au test
 * (`tests/generateurs/gabarit.test.ts`) et de modèle à copier ; il n'est JAMAIS inscrit (`id` hors de `IDS_MOTEURS`).
 * Doubles seulement : le « rendu » est une fonction injectée, aucun fournisseur, aucun son, aucun visage, 0 €.
 */
import type { CommandeFabrication, Ratio } from "@/domaine/types";
import { ZERO } from "@/lib/montants";
import type { DefinitionEtapeMoteur, SortieProduite } from "../types";
import { creerMoteurGabarit, premiereEtapePrete, type DefinitionGabarit, type EtatGabarit } from "./index";

export const ID_MOTEUR_GABARIT_EXEMPLE = "gabarit-exemple";
export const PHRASE_PAUSE_EXEMPLE = "Le rendu de l'exemple « bonjour » n'est pas relié : votre demande est gardée, rien n'a échoué.";

export interface EntreesBonjour {
  prenom: string;
}

export interface EtatBonjour extends EtatGabarit {
  texte?: string;
  plan?: { scenes: { id: string; texte: string }[] };
  sorties: Partial<Record<Ratio, string>>;
}

/** Ce que l'exemple garde pour reprendre sans tout refaire. */
export interface RepriseBonjour {
  texte: string;
  plan: { scenes: { id: string; texte: string }[] };
}

/** Dépendances reliées (ici des doubles). `null` à la place : le moteur reste en pause. */
export interface DependancesBonjour {
  ecrireTexte(prenom: string): Promise<string>;
  rendre(ratio: Ratio, texte: string): Promise<{ fichierCle: string }>;
}

const ETAPES_FABRICATION: DefinitionEtapeMoteur[] = [
  { cle: "reception", nom: "Votre demande reçue", icone: "camera", dependDe: [], dureeEstimeeSec: 1 },
  { cle: "texte", nom: "Le mot de bienvenue", icone: "texte", dependDe: ["reception"], dureeEstimeeSec: 2 },
  { cle: "plan", nom: "Les scènes", icone: "image", dependDe: ["texte"], dureeEstimeeSec: 2 },
  { cle: "montage", nom: "Le montage", icone: "ecran-partage", dependDe: ["plan"], dureeEstimeeSec: 10 },
  { cle: "controle", nom: "La vérification", icone: "bouclier", dependDe: ["montage"], dureeEstimeeSec: 1 },
];

const ETAPES_RETOUCHE: DefinitionEtapeMoteur[] = [
  { cle: "plan", nom: "Les scènes touchées", icone: "image", dependDe: [], dureeEstimeeSec: 1 },
  { cle: "montage", nom: "Le montage", icone: "ecran-partage", dependDe: ["plan"], dureeEstimeeSec: 10 },
  { cle: "controle", nom: "La vérification", icone: "bouclier", dependDe: ["montage"], dureeEstimeeSec: 1 },
];

const TAILLES: Record<Ratio, string> = { "4:5": "1080x1350", "9:16": "1080x1920", "1:1": "1080x1080", "16:9": "1920x1080" } as Record<Ratio, string>;
const DUREE_SEC = 5;

const planDe = (texte: string) => ({ scenes: [{ id: "s1", texte }] });

export function definitionBonjour(dependances: (commande: CommandeFabrication) => DependancesBonjour | null): DefinitionGabarit<EntreesBonjour, EtatBonjour, DependancesBonjour, RepriseBonjour> {
  return {
    id: ID_MOTEUR_GABARIT_EXEMPLE,
    nom: "Exemple bonjour (gabarit)",
    etapesFabrication: ETAPES_FABRICATION,
    etapesRetouche: ETAPES_RETOUCHE,
    ratios: ["4:5", "9:16", "1:1", "16:9"],
    dureeMaxSec: 60,
    phrasePause: PHRASE_PAUSE_EXEMPLE,
    // R-8 : les entrées viennent de `commande.entrees`, jamais de `fabrication.ts`.
    lireEntrees: (commande) => ({ prenom: String((commande.entrees.bonjour as { prenom?: unknown } | undefined)?.prenom ?? "vous") }),
    dependances: (commande) => dependances(commande),
    etatInitial: () => ({ faites: [], sorties: {} }),
    async avancer(etat, ctx, deps) {
      const etape = premiereEtapePrete(ctx, etat)?.cle;
      if (!etape) return { ...etat, fini: true };
      const faite = (e: EtatBonjour): EtatBonjour => ({ ...e, faites: [...e.faites, etape] });
      switch (etape) {
        case "reception":
          return faite(etat);
        case "texte":
          return faite({ ...etat, texte: await deps.ecrireTexte(ctx.entrees.prenom) });
        case "plan":
          return faite({ ...etat, plan: planDe(etat.texte ?? "") });
        case "montage": {
          // Échec simulé du contrat commun : une seule fois (au premier passage), « Réessayer » repart.
          if (ctx.commande.simulerEchecEtape === "montage" && ctx.tentative === 1) return { ...etat, echec: { etape, message: "Le montage a eu un souci, vous pouvez réessayer.", reessayable: true } };
          const sorties: EtatBonjour["sorties"] = {};
          for (const ratio of ctx.commande.ratios) sorties[ratio] = (await deps.rendre(ratio, etat.texte ?? "")).fichierCle;
          return faite({ ...etat, sorties });
        }
        default:
          return { ...faite(etat), fini: true };
      }
    },
    resultat(commande, etat) {
      const sorties: SortieProduite[] = commande.ratios
        .filter((r) => etat.sorties[r])
        .map((ratio) => ({
          ratio,
          fichierCle: etat.sorties[ratio]!,
          vignetteCle: "",
          resolution: TAILLES[ratio],
          dureeSec: DUREE_SEC,
          taille: 0,
          rapportQualite: { note: 80, verifie: { image: true, son: false, sousTitres: false, mentionIA: false, droits: false }, alertes: [], niveauSonoreLufs: -14 },
        }));
      const reprise: RepriseBonjour = { texte: etat.texte ?? "", plan: etat.plan ?? planDe("") };
      return { sorties, noteQualite: { globale: 80, alertes: [] }, lignesReelles: [{ etape: "Exemple bonjour (gabarit)", fournisseur: "studio", unite: "forfait", quantite: 1, prixUnitaire: ZERO, total: ZERO, nature: "reel" }], projetMontage: { version: "gabarit-exemple-1", reprise } };
    },
    reprise: {
      lire: (projet) => {
        const r = projet?.reprise as Partial<RepriseBonjour> | undefined;
        return r && typeof r.texte === "string" && r.plan ? { texte: r.texte, plan: r.plan } : undefined;
      },
      // Retouche partielle (R-4) : le texte gardé est repris sans être réécrit ; `modifierTitre` change seulement le texte.
      etatPourRetouche: (reprise, _commande, operations) => {
        const titre = operations.find((o) => o.type === "modifierTitre");
        const texte = titre && titre.type === "modifierTitre" ? titre.texte : reprise.texte;
        return { faites: [], texte, plan: reprise.plan, sorties: {} };
      },
    },
    proprietesRendu: (etat) => ({ planScenes: etat.plan }),
  };
}

export const creerMoteurGabaritExemple = (dependances: (commande: CommandeFabrication) => DependancesBonjour | null) => creerMoteurGabarit(definitionBonjour(dependances));
