/**
 * Extraits maison v4 (C4-U4.5a) : de l'archive au candidat choisi. Service pur de lecture, que rien n'appelle encore
 * (le branchement est C4-U4.5b). Aucun réglage lu, aucune écriture, aucun réseau, aucune dépense.
 * Le droit (licence, tiers, famille, état, déjà-pris) est appliqué par `plagesDisponibles` : rien n'est recopié ici.
 * P-4 : une plage au texte incrusté est écartée. Ne lève jamais : une erreur rend `null` et journalise une ligne.
 */
import "server-only";
import { plagesDisponibles } from "@/briques/archive-extraits/choix";
import { etatLicence } from "@/domaine/derivations";
import type { ElementBibliotheque, IdReseau } from "@/domaine/types";
import { choisirExtraitV4, type CandidatChoixV4 } from "@/moteurs/montage-facecam-animee/extraits-maison/choisir";
import { lireRechercheAxion } from "@/moteurs/montage-facecam-animee/extraits-maison/recherche";
import { DUREE_MIN_EXTRAIT_V4_SEC } from "@/moteurs/montage-facecam-animee/extraits-maison/types";
import type { PortsArchive } from "./archive-extraits";
import { depots, journaliser } from "./_commun";

export interface EntreeExtraitMaisonV4 {
  recherche: string;
  dureeFenetreSec: number;
  videoId: string;
  dejaPris: readonly string[];
  recents: readonly string[];
}

/** Capacité de l'extrait et réseaux demandés : tous les réseaux, la licence doit donc les couvrir (le plus prudent). */
const CAPACITE_EXTRAIT = "ecran.telephone-extrait" as const;
const TOUS_RESEAUX: IdReseau[] = ["linkedin", "instagram", "facebook", "tiktok", "youtube", "youtube-shorts"];

export async function extraitMaisonPourRecherche(
  entree: EntreeExtraitMaisonV4,
  ports?: PortsArchive,
): Promise<ReturnType<typeof choisirExtraitV4>> {
  try {
    const recherche = lireRechercheAxion(entree.recherche);
    if (!recherche) return null;
    const lesDepots = (ports?.depots ?? depots)();
    const elements: ElementBibliotheque[] = await lesDepots.elements.lister((e) => e.type === "source-extraits" && !e.archiveLe);
    if (elements.length === 0) return null;
    const maintenant = new Date((ports?.maintenant ?? (() => new Date().toISOString()))());
    const parId = new Map(elements.map((e) => [e.id, e]));
    const plages = plagesDisponibles(elements, {
      videoId: entree.videoId, capacite: CAPACITE_EXTRAIT, reseaux: TOUS_RESEAUX,
      dejaUtilisees: [...entree.dejaPris], maintenant,
    });
    const candidats: CandidatChoixV4[] = [];
    for (const d of plages) {
      if (d.plage.texteIncruste === true) continue; // P-4 : refusé partout
      if (d.plage.finSec - d.plage.debutSec < DUREE_MIN_EXTRAIT_V4_SEC) continue;
      const el = parId.get(d.elementId);
      const fiche = el && el.valeur.type === "source-extraits" ? el.valeur.fiche : null;
      candidats.push({
        id: d.cle, cle: d.cle, capacite: CAPACITE_EXTRAIT, elementId: d.elementId, plageId: d.plage.id,
        debutSec: d.plage.debutSec, finSec: d.plage.finSec, ratio: d.ratio,
        visage: d.plage.avecVisage ? "williams" : "aucun", texteIncruste: false, famille: d.famille,
        licenceOk: !!fiche && etatLicence(fiche.licence, maintenant) === "ok" && fiche.licence.usageCommercial,
        parentes: d.famille, texte: d.plage.texte, motsCles: d.plage.motsCles,
      });
    }
    return choisirExtraitV4({
      recherche, dureeFenetreSec: entree.dureeFenetreSec, videoId: entree.videoId,
      candidats, dejaPris: entree.dejaPris, recents: entree.recents,
    });
  } catch (e) {
    await journaliser("extraits-maison-v4", `Extrait maison : lecture impossible (${e instanceof Error ? e.name : "erreur"})`).catch(() => undefined);
    return null;
  }
}
