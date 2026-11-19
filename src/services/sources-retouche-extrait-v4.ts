/**
 * Retouche gratuite v4 (R4-03-b4) : la liste des vidéos de l'archive où l'on peut prendre un extrait (« ma vidéo de mardi »).
 * Lecture seule, branchée nulle part : aucun réglage lu, aucune écriture, aucun réseau, aucune dépense.
 * Même droit que le choix réel (le service des extraits maison) : licence, réseaux, vidéo elle-même et famille exclues,
 * texte incrusté écarté (P-4), durée minimale. Ne lève jamais : une erreur rend `[]`.
 */
import "server-only";
import { plagesDisponibles } from "@/briques/archive-extraits/choix";
import type { ElementBibliotheque, IdReseau } from "@/domaine/types";
import { DUREE_MIN_EXTRAIT_V4_SEC } from "@/moteurs/montage-facecam-animee/extraits-maison/types";
import type { PortsArchive } from "./archive-extraits";
import { depots } from "./_commun";

export interface SourceRetoucheV4 {
  videoId: string;
  titre: string;
  plages: number;
}

/** Capacité de l'extrait et réseaux demandés : recopiés de le service des extraits maison (le test compare au texte du fichier). */
const CAPACITE_EXTRAIT = "ecran.telephone-extrait" as const;
const TOUS_RESEAUX: IdReseau[] = ["linkedin", "instagram", "facebook", "tiktok", "youtube", "youtube-shorts"];

const SANS_TITRE = "Vidéo sans titre";

export async function sourcesPourRetoucheExtraitV4(videoId: string, ports?: PortsArchive): Promise<SourceRetoucheV4[]> {
  try {
    const lesDepots = (ports?.depots ?? depots)();
    const elements: ElementBibliotheque[] = await lesDepots.elements.lister((e) => e.type === "source-extraits" && !e.archiveLe);
    if (elements.length === 0) return [];
    const maintenant = new Date((ports?.maintenant ?? (() => new Date().toISOString()))());
    const plages = plagesDisponibles(elements, {
      videoId, capacite: CAPACITE_EXTRAIT, reseaux: TOUS_RESEAUX, dejaUtilisees: [], maintenant,
    });
    const nombre = new Map<string, number>();
    for (const d of plages) {
      if (d.plage.texteIncruste === true) continue; // P-4 : refusé partout
      if (d.plage.finSec - d.plage.debutSec < DUREE_MIN_EXTRAIT_V4_SEC) continue;
      nombre.set(d.videoId, (nombre.get(d.videoId) ?? 0) + 1);
    }
    const sources: SourceRetoucheV4[] = [];
    for (const [id, plagesUtiles] of nombre) {
      const titre = ((await lesDepots.videos.obtenir(id))?.titre ?? "").trim();
      sources.push({ videoId: id, titre: titre || SANS_TITRE, plages: plagesUtiles });
    }
    return sources.sort((a, b) => a.titre.localeCompare(b.titre, "fr") || a.videoId.localeCompare(b.videoId));
  } catch {
    return [];
  }
}
