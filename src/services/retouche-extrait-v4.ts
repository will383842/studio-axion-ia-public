/**
 * R4-03-b2 : retouche gratuite v4, préparer le clip d'un extrait de l'archive pour un téléphone (« telephone-video »), ou dire pourquoi c'est impossible.
 * Service que rien n'importe encore. Chemin : lecture de l'archive → la recherche d'extrait (INJECTÉE : `extraitPour`) → source signée (PORT injecté)
 * → `preparerExtraitV4` (clip 4:5 muet, ffmpeg du studio). 0 € : aucune banque, aucun Claude, aucun réglage lu, aucune écriture en base
 * (seul `outils.deposer`, injecté, range le clip). Ne lève jamais : tout échec devient un refus clair, et rien n'est changé.
 */
import "server-only";
import type { ElementV4Plan } from "@/domaine/facecam-animee/plan";
import type { ElementBibliotheque } from "@/domaine/types";
import type { ChoixVideoV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import type { OutilsPreparation } from "@/moteurs/montage-facecam-animee/images/preparation";
import { preparerExtraitV4 } from "@/moteurs/montage-facecam-animee/extraits-maison/preparer";
import { ecrireRechercheAxion, estRechercheAxion } from "@/moteurs/montage-facecam-animee/extraits-maison/recherche";
import type { PortsArchive } from "./archive-extraits";
import { depots } from "./_commun";

/** Même type d'élément que le téléphone du lot 6 : recopié, rien d'éteint n'est importé. */
const ID_TELEPHONE = "telephone-video";

/**
 * Partie du projet gardé (`ProjetGardeV4`) que ce service lit : type structurel local, `ProjetGardeV4` y entre tel quel
 * (un garde voisin limite les citations du fichier du projet gardé).
 */
export interface ProjetClipV4 {
  plan: { elementsV4?: ElementV4Plan[] };
  videos?: { fichiers: readonly { nom: string }[]; choix?: readonly unknown[] };
}

/** Forme de la variante `remplacer` de R4-03-b1, recopiée (aucun import de b1). */
export interface DemandeClipExtraitV4 {
  rang: number;
  recherche: string;
  sourceVideoId?: string;
}

export interface PortsClipExtraitV4 {
  videoId: string;
  /** Adresse de lecture signée de la vidéo publiée qui porte l'extrait (`null` si un maillon manque). */
  sourceSignee(elementId: string): Promise<string | null>;
  outils: OutilsPreparation;
  /** Clé de stockage finale d'un clip (`nom` = « v4-<rang>-r<n>.mp4 »). */
  cleClip(nom: string): string;
  mode?: "direct" | "telecharger";
  recents?: readonly string[];
  archive?: PortsArchive;
  /**
   * Recherche d'un extrait dans l'archive (OBLIGATOIRE, type local : ce fichier n'importe pas le service de recherche, la garde de
   * du test d'archive reste intacte ; R4-03-c y injectera la fonction réelle).
   */
  extraitPour(
    entree: { recherche: string; dureeFenetreSec: number; videoId: string; dejaPris: readonly string[]; recents: readonly string[] },
    archive?: PortsArchive,
  ): Promise<{ extrait: { elementId: string; cle: string; finSec: number }; debutSec: number } | null>;
}

export type CodeRefusClipExtraitV4 = "ARCHIVE_VIDE" | "AUCUN_EXTRAIT" | "ELEMENT_INTROUVABLE";

export type ResultatClipExtraitV4 =
  | { nom: string; cle: string; choix: ChoixVideoV4 }
  | { refus: { code: CodeRefusClipExtraitV4; message: string } };

const refuser = (code: CodeRefusClipExtraitV4, message: string): ResultatClipExtraitV4 => ({ refus: { code, message } });

const estSource = (e: ElementBibliotheque) => e.type === "source-extraits" && !e.archiveLe;

/** Dépôts dont `elements.lister` ne garde que les fiches de la vidéo `videoId` ; tout le reste passe tel quel. */
function depotsRestreints(base: typeof depots, videoId: string): typeof depots {
  return () => {
    const d = base();
    const elements = new Proxy(d.elements, {
      get(cible, propriete) {
        if (propriete === "lister") {
          return async (filtre?: (e: ElementBibliotheque) => boolean) =>
            (await cible.lister(filtre)).filter((e) => e.valeur.type === "source-extraits" && e.valeur.fiche.videoId === videoId);
        }
        const v = Reflect.get(cible, propriete, cible);
        return typeof v === "function" ? v.bind(cible) : v;
      },
    });
    return { ...d, elements };
  };
}

/** Plus petit n ≥ 1 tel que `v4-<rang>-r<n>.mp4` n'est pas déjà un fichier du projet. */
function nomLibre(rang: number, fichiers: readonly { nom: string }[]): string {
  const pris = new Set(fichiers.map((f) => f.nom));
  let n = 1;
  while (pris.has(`v4-${rang}-r${n}.mp4`)) n++;
  return `v4-${rang}-r${n}.mp4`;
}

export async function clipPourDemandeExtraitV4(projet: ProjetClipV4, demande: DemandeClipExtraitV4, ports: PortsClipExtraitV4): Promise<ResultatClipExtraitV4> {
  try {
    const element = projet.plan.elementsV4?.[demande.rang];
    if (!element || element.id !== ID_TELEPHONE) {
      return refuser("ELEMENT_INTROUVABLE", "Ce téléphone n'existe plus dans cette version : rien n'a changé.");
    }
    const base = ports.archive?.depots ?? depots;
    const sources = await base().elements.lister(estSource);
    if (sources.length === 0) {
      return refuser("ARCHIVE_VIDE", "Votre archive n'a encore aucune vidéo utilisable : rien n'a changé.");
    }
    const recherche = estRechercheAxion(demande.recherche) ? demande.recherche.trim() : ecrireRechercheAxion([demande.recherche]);
    const archive: PortsArchive = { ...ports.archive, depots: demande.sourceVideoId ? depotsRestreints(base, demande.sourceVideoId) : base };
    const actuel = element.medias?.[0]?.replace(/^broll\//, "");
    const dejaPris = (projet.videos?.choix ?? []).flatMap((c) => {
      const x = c as Partial<ChoixVideoV4> | null;
      return x && x.source === "archive-axion" && typeof x.id === "string" && x.fichier !== actuel ? [x.id] : [];
    });
    const dureeFenetreSec = Math.max(0, element.fin - element.debut);
    const aucun = () => refuser("AUCUN_EXTRAIT", `Aucun extrait de vos vidéos ne correspond à « ${demande.recherche} » : rien n'a changé.`);

    const trouve = await ports.extraitPour(
      { recherche, dureeFenetreSec, videoId: ports.videoId, dejaPris, recents: ports.recents ?? [] },
      archive,
    );
    if (!trouve) return aucun();
    const adresse = await ports.sourceSignee(trouve.extrait.elementId);
    if (!adresse) return aucun();
    const nom = nomLibre(demande.rang, projet.videos?.fichiers ?? []);
    const prepare = await preparerExtraitV4(
      { debutSec: trouve.debutSec, finSec: trouve.extrait.finSec },
      { cle: ports.cleClip(nom), dureeFenetreSec },
      ports.outils,
      { adresse, mode: ports.mode ?? "telecharger" },
    );
    return { nom, cle: prepare.cle, choix: { fichier: nom, source: "archive-axion", id: trouve.extrait.cle, scene: recherche, licence: "vidéo de Will (archive)" } };
  } catch {
    return refuser("AUCUN_EXTRAIT", `Aucun extrait de vos vidéos ne correspond à « ${demande?.recherche ?? ""} » : rien n'a changé.`);
  }
}
