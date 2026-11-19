/**
 * BR-TELEPHONE-b : le téléphone qui joue un extrait (élément v4 `telephone-video`) reçoit un VRAI extrait des vidéos de Will (archive).
 * Pour chaque élément dont `recherches[0]` commence par `axion:` : `extraitMaisonPourRecherche` (C4-U4.5a) → vidéo source signée
 * (dépôts : fiche → sortie → fichier, puis `signerLecture`) → `preparerExtraitV4` (C4-U4.3, clip 4:5 MUET) → `FichierVideoV4`.
 * Aucune banque, aucun fournisseur, aucun Claude : 0 €. Pas d'extrait (ou préparation en échec) : son nom va dans `sansExtrait`, avec une phrase
 * claire dans `manques` ; l'élément RESTE à son rang dans `plan`, sans `medias` (les clips des banques se nomment au rang : aucun décalage, aucune collision).
 * Le retrait d'un téléphone sans extrait est fait par la chaîne (`retirerSansVideoOuvertV4`, repli C4-U4.9b-b : contrôles H1/H2, puis Opus une fois), jamais ici.
 * Ports injectables : dépôts (archive), outils ffmpeg, signature, choix. Ne lève jamais pour un extrait raté.
 */
import "server-only";
import type { ElementV4Plan, PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import type { ChoixVideoV4, FichierVideoV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import type { OutilsPreparation } from "@/moteurs/montage-facecam-animee/images/preparation";
import { preparerExtraitV4 } from "@/moteurs/montage-facecam-animee/extraits-maison/preparer";
import { estRechercheAxion } from "@/moteurs/montage-facecam-animee/extraits-maison/recherche";
import { cleUsageExtrait } from "@/briques/bibliotheque-video/types";
import type { PortsArchive } from "./archive-extraits";
import { extraitMaisonPourRecherche } from "./extraits-maison-v4";
import { depots } from "./_commun";

/** Même type d'élément que celui de la fiche du téléphone (lot 6) : recopié, ce fichier n'importe rien d'éteint. */
const ID_TELEPHONE = "telephone-video";

export interface PortsTelephoneV4 {
  videoId: string;
  /** Adresse de lecture signée d'une clé de stockage. */
  signerLecture(cle: string): Promise<string>;
  /** Outils de préparation (ffmpeg, téléchargement, dépôt) ; leur `deposer` reçoit la clé FINALE (`cleClip`). */
  outils: OutilsPreparation;
  /** Clé de stockage finale d'un clip (`nom` = « v4-<rang>-0.mp4 »). */
  cleClip(nom: string): string;
  /** Défaut : `telecharger` (copie locale puis ffmpeg ; la lecture directe n'est pas vérifiée). */
  mode?: "direct" | "telecharger";
  /** Clés d'usage des extraits des dernières vidéos (défaut : aucune). */
  recents?: readonly string[];
  /** Dépôts de l'archive et horloge (tests). */
  archive?: PortsArchive;
  /** Remplace le choix de l'extrait (tests). */
  extraitPour?: typeof extraitMaisonPourRecherche;
}

export interface ResultatTelephoneV4 {
  /** Plan avec `medias` posés sur les téléphones servis ; mêmes rangs qu'à l'entrée (rien n'est retiré ici). */
  plan: PlanFacecamAnimee;
  fichiers: FichierVideoV4[];
  /** Noms (« v4-<rang>-0.mp4 ») des téléphones sans extrait. */
  sansExtrait: string[];
  manques: string[];
  choix: ChoixVideoV4[];
}

export const nomClipTelephoneV4 = (rang: number) => `v4-${rang}-0.mp4`;
const secondes = (x: number) => `${x.toFixed(1).replace(".", ",")} s`;

/** Vrai pour un élément `telephone-video` dont la première recherche commence par `axion:`. */
export const estTelephoneAxionV4 = (e: ElementV4Plan): boolean => e.id === ID_TELEPHONE && estRechercheAxion(e.recherches?.[0]);

/** Adresse signée de la vidéo publiée qui porte l'extrait : fiche de l'archive → sortie → fichier. `null` si un maillon manque. */
export async function sourceSignee(elementId: string, ports: PortsTelephoneV4): Promise<string | null> {
  const d = (ports.archive?.depots ?? depots)();
  const element = await d.elements.obtenir(elementId);
  const fiche = element && element.valeur.type === "source-extraits" ? element.valeur.fiche : null;
  if (!fiche) return null;
  const sortie = await d.sorties.obtenir(fiche.sortieId);
  const fichier = sortie ? await d.fichiers.obtenir(sortie.fichierId) : null;
  return fichier?.cleStockage ? ports.signerLecture(fichier.cleStockage) : null;
}

export async function fichiersTelephoneV4(plan: PlanFacecamAnimee, ports: PortsTelephoneV4): Promise<ResultatTelephoneV4> {
  const elements = [...(plan.elementsV4 ?? [])];
  const fichiers: FichierVideoV4[] = [];
  const choix: ChoixVideoV4[] = [];
  const manques: string[] = [];
  const sansExtrait: string[] = [];
  const dejaPris: string[] = [];
  const chercher = ports.extraitPour ?? extraitMaisonPourRecherche;

  for (const [rang, e] of elements.entries()) {
    if (!estTelephoneAxionV4(e)) continue;
    const nom = nomClipTelephoneV4(rang);
    const quoi = `« ${e.id} » à ${secondes(e.debut)}`;
    let pret: FichierVideoV4 | null = null;
    try {
      const trouve = await chercher({ recherche: e.recherches![0], dureeFenetreSec: Math.max(0, e.fin - e.debut), videoId: ports.videoId, dejaPris, recents: ports.recents ?? [] }, ports.archive);
      const adresse = trouve ? await sourceSignee(trouve.extrait.elementId, ports) : null;
      if (trouve && adresse) {
        const cle = ports.cleClip(nom);
        const prepare = await preparerExtraitV4({ debutSec: trouve.debutSec, finSec: trouve.extrait.finSec }, { cle, dureeFenetreSec: Math.max(0, e.fin - e.debut) }, ports.outils, { adresse, mode: ports.mode ?? "telecharger" });
        pret = { nom, cle: prepare.cle };
        dejaPris.push(cleUsageExtrait(trouve.extrait.elementId, trouve.extrait.plageId));
        choix.push({ fichier: nom, source: "archive-axion", id: trouve.extrait.cle, scene: e.recherches![0], licence: "vidéo de Will (archive)" });
      }
    } catch {
      pret = null;
    }
    if (pret) {
      fichiers.push(pret);
      elements[rang] = { ...e, medias: [`broll/${nom}`] };
    } else {
      sansExtrait.push(nom);
      manques.push(`${quoi} : aucun extrait de vos vidéos n'a été trouvé ; le téléphone n'est pas montré.`);
    }
  }
  return { plan: { ...plan, elementsV4: elements }, fichiers, sansExtrait, manques, choix };
}
