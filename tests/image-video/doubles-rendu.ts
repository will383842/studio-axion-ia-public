/**
 * Double du SERVEUR DE RENDU (aucun réseau) et outils de fabrication dont le rendu est le VRAI branchement
 * (`rendreVersionIV`) posé sur ce double. Partagé par `rendu-reel.test.ts` et `fabriquer-script.test.ts`.
 */
import type { DemandeRendu, EtatRendu, ServiceRendu } from "@/fournisseurs/types";
import { BRUITAGES_V4_IV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { rendreVersionIV, type OutilsRenduIV } from "@/services/image-video-rendu";
import { carteFixe, outilsSimules, type Monde } from "./doubles-fabrication";

/* ------------------------------------------------------------------ */
/* Double du serveur de rendu                                            */
/* ------------------------------------------------------------------ */

export const MESURES_SERVEUR = { lufs: -14.1, creteVraieDbtp: -1.6, largeur: 1080, hauteur: 1920, fps: 25, dureeSec: 0 };

export class ServeurDouble implements ServiceRendu {
  readonly soumises: DemandeRendu[] = [];
  readonly deposes = new Set<string>();
  private readonly lectures = new Map<string, number>();
  constructor(
    private readonly o: {
      /** Lectures « en cours » avant la fin, pour chaque demande. */
      enCours?: number;
      /** Cette demande échoue (définitivement, comme le serveur la garde). */
      echoue?: (d: DemandeRendu) => boolean;
    } = {},
  ) {}
  async soumettre(d: DemandeRendu) {
    this.soumises.push(d);
    return { idRendu: d.idRendu };
  }
  async etat(id: string): Promise<EtatRendu> {
    const d = this.soumises.find((x) => x.idRendu === id);
    if (!d) return { statut: "inconnu" };
    const n = (this.lectures.get(id) ?? 0) + 1;
    this.lectures.set(id, n);
    if (this.o.echoue?.(d)) return { statut: "echec", erreur: { code: "refuse", reessayable: false, message: "chrome-headless-shell a quitté (code 139) idRendu=xyz" } };
    if (n <= (this.o.enCours ?? 0)) return { statut: "en_cours", progression: 50 };
    this.deposes.add(d.sortie.cle);
    const p = d.parametres as { mode?: string; dureeSec?: number; ratio?: string };
    // Le fichier final a la hauteur du format demandé (24/10/2026 : LinkedIn en 4:5 = 1080 × 1350).
    const hauteur = p.ratio === "4:5" ? 1350 : MESURES_SERVEUR.hauteur;
    return { statut: "termine", sortieCle: d.sortie.cle, mesures: p.mode === "complet" ? { ...MESURES_SERVEUR, hauteur, dureeSec: p.dureeSec ?? 0 } : {} };
  }
  scenes() {
    return this.soumises.filter((d) => !(d.parametres as { mode?: string }).mode);
  }
  montages() {
    return this.soumises.filter((d) => (d.parametres as { mode?: string }).mode === "complet");
  }
}

/** Outils de la fabrication dont le RENDU est le vrai branchement, sur le serveur double. */
export function outilsAvecRendu(m: Monde, serveur: ServeurDouble, base: OutilsFabricationIV = outilsSimules(carteFixe("C"), m)): OutilsFabricationIV {
  const outils: OutilsRenduIV = {
    rendu: serveur,
    env: "dev",
    signerLecture: async (cle) => `https://stockage.test/${cle}`,
    signerDepot: async (cle) => `https://depot.test/${cle}`,
    existe: async (cle) => serveur.deposes.has(cle),
    sons: BRUITAGES_V4_IV,
    mesurer: async (cle) => ({ empreinte: `final-${cle.length}`, noirMaxSec: 0, figeMaxSec: 0.2, figes: [{ debutSec: 1, dureeSec: 0.2 }] }),
  };
  return {
    ...base,
    rendre: async (d) => {
      const r = await rendreVersionIV(d, outils);
      // Le double de l'écoute retrouve la piste par les rendus faits.
      m.rendus.push(d);
      return r;
    },
  };
}

