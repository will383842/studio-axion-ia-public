/**
 * G6-07-a (20/11) : écritures COMPLÈTES d'une version née du chat de retouche, comptée comme une vidéo normale
 * (lien de suivi, sorties par format, sorties gardées du parent, dépense pour le budget). Module PUR : calcule la
 * liste, n'écrit rien, n'est importé par personne. Recopié sur `creerRetouche` (fabrication.ts) et `appliquerResultat`
 * (travaux.ts:168-215). Aucun montant en dur : les lignes viennent du port de rendu.
 */
import type { DepenseEnregistree, LigneCout, Sortie, Video, VersionVideo } from "@/domaine/types";
import { additionner } from "@/lib/montants";
import type { SortieRenduPartiel } from "./service";
import type { SortieRenduExports } from "./rendu-generateurs";

export interface EntreeEcrituresVersionChat {
  versionId: string;
  numero: number;
  numeroSuivi: number;
  parent: VersionVideo;
  video: Pick<Video, "id" | "estDemo">;
  sortiesParent: Sortie[];
  plan: unknown;
  demande: string;
  operations: unknown[];
  impact: { scenes: string[]; voixTouchee: boolean };
  rendu: SortieRenduPartiel & Partial<Pick<SortieRenduExports, "exports">>;
  lignesReelles: LigneCout[];
  nouvelId: (prefixe: string) => string;
  maintenant: string;
}

export interface EcrituresVersionChat {
  version: VersionVideo;
  sortiesGardees: Sortie[];
  fichiersARegistrer: { ratio: string; fichierCle: string; dureeSec: number }[];
  depense: Omit<DepenseEnregistree, "creeLe" | "modifieLe">;
  surveillerBudget: boolean;
}

export function ecrituresVersionChat(e: EntreeEcrituresVersionChat): EcrituresVersionChat {
  if (e.numeroSuivi === e.parent.numeroSuivi) throw new Error("Le lien de suivi d'une version est le sien, jamais celui du parent.");
  const total = additionner(...e.lignesReelles.map((l) => l.total));
  const horo = { creeLe: e.maintenant, modifieLe: e.maintenant };
  const version: VersionVideo = {
    id: e.versionId,
    videoId: e.video.id,
    numero: e.numero,
    numeroSuivi: e.numeroSuivi,
    parentVersionId: e.parent.id,
    commande: e.parent.commande,
    statut: "prete",
    choisie: false,
    coutReel: total,
    noteRetouche: e.demande.slice(0, 500),
    projetMontage: { ...(e.parent.projetMontage ?? {}), retoucheChat: { plan: e.plan, demande: e.demande, operations: e.operations, scenesRefaites: e.impact.scenes, voixRefaite: e.impact.voixTouchee, rendu: e.rendu } },
    ...horo,
    ...(e.parent.estDemo ? { estDemo: true } : {}),
  };
  const fichiersARegistrer: EcrituresVersionChat["fichiersARegistrer"] = [];
  const sortiesGardees: Sortie[] = [];
  const x = e.rendu.exports;
  if (!x) {
    const ratio = e.parent.commande.ratios?.[0];
    if (!ratio) throw new Error("Aucun format dans la commande : version sans fichier refusée.");
    fichiersARegistrer.push({ ratio, fichierCle: e.rendu.fichierCle, dureeSec: e.rendu.dureeSec });
  } else {
    for (const ratio of x.refaits) {
      const fichierCle = x.fichiers[ratio];
      if (fichierCle) fichiersARegistrer.push({ ratio, fichierCle, dureeSec: e.rendu.dureeSec });
    }
    for (const ratio of x.gardes) {
      const avant = e.sortiesParent.find((s) => s.ratio === ratio);
      if (avant) sortiesGardees.push({ ...avant, id: e.nouvelId("sortie"), versionId: e.versionId, ...horo });
      else if (x.fichiers[ratio]) fichiersARegistrer.push({ ratio, fichierCle: x.fichiers[ratio], dureeSec: e.rendu.dureeSec });
      else throw new Error(`Format ${ratio} gardé sans fichier : version sans fichier refusée.`);
    }
  }
  if (!fichiersARegistrer.length && !sortiesGardees.length) throw new Error("Version sans aucun fichier refusée.");
  const depense = { id: e.nouvelId("dep"), videoId: e.video.id, lignes: e.lignesReelles, total, date: e.maintenant, estDemo: e.video.estDemo };
  return { version, sortiesGardees, fichiersARegistrer, depense, surveillerBudget: !e.video.estDemo };
}
