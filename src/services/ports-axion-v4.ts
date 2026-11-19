/**
 * C4-U4.4 (v19b) : prises archive → approvisionnement `axion:`. Rien ne l'importe ; BR-EXTRAITS-MAISON-c le passera en
 * `dep.approvisionner` derrière `facecamAnimee.extraitsMaison`. 0 € : aucune banque, aucun Claude, aucun contrôle visuel.
 * Aucun réglage lu. Ne lève jamais : tout raté rend `null` (l'approvisionnement retombe alors sur le défaut).
 */
import "server-only";
import { cleUsageExtrait } from "@/briques/bibliotheque-video/types";
import { preparerExtraitV4 } from "@/moteurs/montage-facecam-animee/extraits-maison/preparer";
import type { OutilsPreparation } from "@/moteurs/montage-facecam-animee/images/preparation";
import type { PortsArchive } from "./archive-extraits";
import { extraitMaisonPourRecherche } from "./extraits-maison-v4";
import { sourceSignee } from "./telephone-extrait-v4";

export interface ParamsPortsAxionV4 {
  videoId: string;
  /** Adresse de lecture signée d'une clé de stockage. */
  signerLecture(cle: string): Promise<string>;
  outils: OutilsPreparation;
  /** Défaut : `telecharger` (la lecture directe n'est pas vérifiée). */
  mode?: "direct" | "telecharger";
  recents?: readonly string[];
  archive?: PortsArchive;
  /** Remplace le choix de l'extrait (tests). */
  extraitPour?: typeof extraitMaisonPourRecherche;
}

/** Mêmes formes que `ExtraitAxionV4` / `PortsAxionV4` (approvisionner.ts), recopiées : ce fichier n'importe pas l'approvisionnement (garde de C4-U4.4a). */
interface ExtraitAxionV4 { cle: string; debutSec: number; longueurSec: number }
interface PortsAxionV4 {
  trouver(recherche: string, dureeFenetreSec: number): Promise<ExtraitAxionV4 | null>;
  preparer(extrait: ExtraitAxionV4, cleCible: string): Promise<string | null>;
}

interface Garde { elementId: string; plageId: string; finSec: number }

export function portsAxionV4(p: ParamsPortsAxionV4): PortsAxionV4 {
  const chercher = p.extraitPour ?? extraitMaisonPourRecherche;
  const dejaPris: string[] = [];
  const gardes = new Map<string, Garde>();
  return {
    async trouver(recherche, dureeFenetreSec) {
      try {
        const r = /^\s*axion:/i.test(recherche) ? recherche : `axion:${recherche}`;
        const t = await chercher({ recherche: r, dureeFenetreSec, videoId: p.videoId, dejaPris: [...dejaPris], recents: p.recents ?? [] }, p.archive);
        if (!t) return null;
        gardes.set(t.extrait.cle, { elementId: t.extrait.elementId, plageId: t.extrait.plageId, finSec: t.extrait.finSec });
        return { cle: t.extrait.cle, debutSec: t.debutSec, longueurSec: t.longueurSec };
      } catch {
        return null;
      }
    },
    async preparer(extrait: ExtraitAxionV4, cleCible: string) {
      try {
        const g = gardes.get(extrait.cle);
        if (!g) return null;
        const adresse = await sourceSignee(g.elementId, { signerLecture: p.signerLecture, archive: p.archive } as never);
        if (!adresse) return null;
        const prepare = await preparerExtraitV4(
          { debutSec: extrait.debutSec, finSec: g.finSec },
          { cle: cleCible, dureeFenetreSec: extrait.longueurSec },
          p.outils,
          { adresse, mode: p.mode ?? "telecharger" },
        );
        dejaPris.push(cleUsageExtrait(g.elementId, g.plageId));
        return prepare.cle;
      } catch {
        return null;
      }
    },
  };
}
