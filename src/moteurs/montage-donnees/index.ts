/**
 * MOTEUR « TABLEAU DE BORD » (fiche G4-09b) — moteur MINCE copié de `src/moteurs/gabarit/`, MASQUÉ, sur le modèle de VL-04.
 * Estimation à 0 € ; tant que rien n'est relié (`dependances` rend `null`), la fabrication reste en PAUSE claire : en file,
 * sans échec, sans dépense, jamais une vidéo d'essai. AUCUN appel à Claude, à la voix ou à un fournisseur ici : la chaîne
 * (`chaine.ts`) reçoit ses ports par les dépendances, et la narration de l'IA, la voix et le rendu réels sont la fiche G4-09c.
 */
import type { CommandeFabrication, Ratio } from "@/domaine/types";
import { ZERO } from "@/lib/montants";
import { creerMoteurGabarit, premiereEtapePrete, type ContexteAvance, type DefinitionGabarit, type EtatGabarit } from "../gabarit";
import type { DefinitionEtapeMoteur, SortieProduite } from "../types";
import { chaineMontageDonnees, type PortCalage, type PortVoix, type ReprisePlanDonnees } from "./chaine";
import { lireEntreesDonnees, type EntreesDonnees } from "./entrees";
import type { ProprietesMontageDonnees } from "./proprietes";

export { COMPOSITION_DONNEES } from "./proprietes";

export const ID_MOTEUR_DONNEES = "montage-donnees";
export const PHRASE_PAUSE_DONNEES = "La vidéo du tableau de bord n'est pas reliée : vos chiffres sont gardés, rien n'a échoué et rien n'est payé.";

const ETAPES_FABRICATION: DefinitionEtapeMoteur[] = [
  { cle: "reception", nom: "Vos chiffres reçus", icone: "camera", dependDe: [], dureeEstimeeSec: 1 },
  { cle: "plan", nom: "Le plan des chiffres", icone: "texte", dependDe: ["reception"], dureeEstimeeSec: 60 },
  { cle: "montage", nom: "L'assemblage", icone: "ecran-partage", dependDe: ["plan"], dureeEstimeeSec: 600 },
];
const ETAPES_RETOUCHE: DefinitionEtapeMoteur[] = ETAPES_FABRICATION.slice(2);

/** Dépendances reliées (ou `null` : pause). Voix, calage et narration sont facultatifs : absents, la vidéo est muette et gratuite. */
export interface DependancesDonnees {
  voix?: PortVoix;
  calage?: PortCalage;
  narration?: NonNullable<Parameters<typeof chaineMontageDonnees>[1]>["narration"]; // G4-06-c : injecté, jamais importé
  monter(ratio: Ratio, proprietes: ProprietesMontageDonnees): Promise<{ fichierCle: string }>;
}

/** Ce qui est gardé pour une retouche : le plan et les propriétés de rendu (voix comprise, jamais relue ni repayée). */
export interface RepriseDonnees {
  plan: ReprisePlanDonnees;
  proprietes: ProprietesMontageDonnees;
}

export interface EtatDonnees extends EtatGabarit {
  plan?: ReprisePlanDonnees;
  proprietes?: ProprietesMontageDonnees;
  sorties: Partial<Record<Ratio, string>>;
}

async function avancerDonnees(etat: EtatDonnees, ctx: ContexteAvance<EntreesDonnees | null>, deps: DependancesDonnees): Promise<EtatDonnees> {
  const etape = premiereEtapePrete(ctx, etat)?.cle;
  if (!etape) return { ...etat, fini: true };
  const faite = (e: EtatDonnees): EtatDonnees => ({ ...e, faites: [...e.faites, etape] });
  switch (etape) {
    case "reception": {
      const lecture = lireEntreesDonnees(ctx.commande.entrees as Record<string, unknown> | undefined);
      if (!lecture.ok) return { ...etat, echec: { etape, message: lecture.erreurs.join(" "), reessayable: false } };
      return faite(etat);
    }
    case "plan": {
      const r = await chaineMontageDonnees(ctx.commande.entrees as Record<string, unknown> | undefined, { ...(deps.voix ? { voix: deps.voix } : {}), ...(deps.calage ? { calage: deps.calage } : {}), ...(deps.narration ? { narration: deps.narration } : {}) });
      if (!r.ok) return { ...etat, echec: { etape, message: r.erreurs.join(" "), reessayable: false } };
      return faite({ ...etat, plan: r.projetMontage.reprise.plan, proprietes: r.proprietes });
    }
    case "montage": {
      if (ctx.commande.simulerEchecEtape === "montage" && ctx.tentative === 1) return { ...etat, echec: { etape, message: "L'assemblage a eu un souci, vous pouvez réessayer.", reessayable: true } };
      const sorties: EtatDonnees["sorties"] = {};
      for (const ratio of ctx.commande.ratios) sorties[ratio] = (await deps.monter(ratio, etat.proprietes!)).fichierCle;
      return faite({ ...etat, sorties });
    }
    default:
      return { ...faite(etat), fini: true };
  }
}

export function definitionDonnees(dependances: (commande: CommandeFabrication) => DependancesDonnees | null): DefinitionGabarit<EntreesDonnees | null, EtatDonnees, DependancesDonnees, RepriseDonnees> {
  return {
    id: ID_MOTEUR_DONNEES,
    nom: "Montage tableau de bord",
    etapesFabrication: ETAPES_FABRICATION,
    etapesRetouche: ETAPES_RETOUCHE,
    ratios: ["9:16", "1:1", "4:5", "16:9"],
    dureeMaxSec: 90,
    phrasePause: PHRASE_PAUSE_DONNEES,
    lireEntrees: (commande) => {
      const l = lireEntreesDonnees(commande.entrees as Record<string, unknown> | undefined);
      return l.ok ? l.entrees : null;
    },
    dependances: (commande) => dependances(commande),
    etatInitial: () => ({ faites: [], sorties: {} }),
    avancer: (etat, ctx, deps) => avancerDonnees(etat, ctx, deps),
    resultat(commande, etat) {
      const sorties: SortieProduite[] = commande.ratios
        .filter((r) => etat.sorties[r])
        .map((ratio) => ({
          ratio,
          fichierCle: etat.sorties[ratio]!,
          vignetteCle: "",
          resolution: ratio === "16:9" ? "1920x1080" : ratio === "9:16" ? "1080x1920" : ratio === "1:1" ? "1080x1080" : "1080x1350",
          dureeSec: Math.round((etat.plan?.plan.dureeMs ?? 0) / 100) / 10,
          taille: 0,
          rapportQualite: { note: 80, verifie: { image: true, son: Boolean(etat.proprietes?.audio), sousTitres: true, mentionIA: false, droits: false }, alertes: [], niveauSonoreLufs: etat.proprietes?.audio ? -14 : -70 },
        }));
      const alertes = (etat.plan?.remarques ?? []).map((message) => ({ code: "export" as const, gravite: "info" as const, message }));
      return {
        sorties,
        noteQualite: { globale: 80, alertes },
        lignesReelles: [{ etape: "Montage tableau de bord", fournisseur: "studio", unite: "forfait", quantite: 1, prixUnitaire: ZERO, total: ZERO, nature: "reel" }],
        projetMontage: { version: "donnees-1", reprise: { plan: etat.plan, proprietes: etat.proprietes } },
      };
    },
    reprise: {
      lire: (projet) => {
        const r = projet?.reprise as Partial<RepriseDonnees> | undefined;
        return r?.plan?.plan && r.proprietes ? { plan: r.plan, proprietes: r.proprietes } : undefined;
      },
      // Retouche : le plan et la voix déjà faits sont gardés ; seul l'assemblage est refait.
      etatPourRetouche: (reprise) => ({ faites: ["reception", "plan"], plan: reprise.plan, proprietes: reprise.proprietes, sorties: {} }),
    },
    proprietesRendu: () => ({}),
  };
}

export const creerMoteurDonnees = (dependances: (commande: CommandeFabrication) => DependancesDonnees | null) => creerMoteurGabarit(definitionDonnees(dependances));

/** Moteur inscrit : AUCUNE dépendance reliée (G4-09c les reliera derrière un réglage éteint) = pause sans dépense. */
export const moteurMontageDonnees = creerMoteurDonnees(() => null);
