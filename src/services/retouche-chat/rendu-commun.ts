/**
 * RENDU COMMUN (S-11-b-v21q) — fabrique les « ports » réels de `refaireParties` (S-11-a) sur le serveur de rendu : un morceau
 * muet rendu par la composition du générateur (`mode: "plage"`), puis l'opération de recollage par plages (fichier d'avant +
 * morceaux + voix d'avant, seulement NOMMÉE), puis le regard reçu tel quel. Écrit une seule fois pour tous les générateurs.
 *
 * ÉTEINT : aucun appelant. Aucun réglage lu, aucun prix, aucun appel à Claude, aucune écriture de dépôt (les adresses sont
 * signées par l'appelant). Ne lève jamais : toute panne ou tout refus rend `null` (la vidéo d'avant est alors gardée).
 */
import "server-only";
import type { PlageImages, ParametresRecollage } from "@/briques/rendu-par-plages";
import type { PortsRefaire } from "@/briques/refaire-parties";
import { suivreRendu } from "@/fournisseurs/rendu/client";
import type { DemandeRendu, ServiceRendu } from "@/fournisseurs/types";

export interface DepsPortsRefaire {
  service: () => ServiceRendu;
  /** Signe des adresses de lecture (nom → clé de stockage) et l'adresse de dépôt du résultat. */
  signer: (lectures: Record<string, string>, depot: { cle: string; mime: string }) => Promise<{ lectures: Record<string, string>; urlDepot: string }>;
  /** Clé de stockage d'un nom de fichier. */
  cle: (nom: string) => string;
  /** Préfixe des identifiants de rendu et des fichiers de sortie. */
  idBase: string;
  composition: string;
  /** Mêmes propriétés que le rendu d'origine. */
  proprietes: Record<string, unknown>;
  /** Adresses de lecture des morceaux (jamais d'entrée « audio » : le morceau est muet). */
  lecturesPlage?: Record<string, string>;
  regarder: PortsRefaire["regarder"];
  /** Attente entre deux suivis (défaut : 2 s). */
  attendre?: (ms: number) => Promise<void>;
  /** Nombre maximal de suivis avant d'abandonner (défaut : 300, soit environ 10 min). */
  suivisMax?: number;
}

const ATTENTE_MS = 2000;
const SUIVIS_PAR_DEFAUT = 300;

export function creerPortsRefaire(deps: DepsPortsRefaire): PortsRefaire {
  const attendre = deps.attendre ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const suivisMax = deps.suivisMax ?? SUIVIS_PAR_DEFAUT;

  /** Soumet puis suit jusqu'à `termine` (clé du résultat) ; `null` sur échec, abandon ou panne. */
  async function rendre(demande: DemandeRendu): Promise<{ fichier: string } | null> {
    try {
      const service = deps.service();
      await service.soumettre(demande);
      for (let i = 0; i < suivisMax; i++) {
        const etat = await suivreRendu(service, demande);
        if (etat.statut === "termine") return { fichier: etat.sortieCle };
        if (etat.statut === "echec") return null;
        await attendre(ATTENTE_MS);
      }
      return null;
    } catch {
      return null;
    }
  }

  return {
    async rendrePlage(plage: PlageImages, index: number) {
      try {
        const cle = deps.cle(`${deps.idBase}-plage${index}.mp4`);
        // Morceau MUET : jamais d'entrée « audio », même si l'appelant en a donné une.
        const lectures = { ...(deps.lecturesPlage ?? {}) };
        delete lectures.audio;
        const signe = await deps.signer(lectures, { cle, mime: "video/mp4" });
        return await rendre({
          idRendu: `${deps.idBase}-plage${index}-0`,
          operation: "composition",
          file: "longue",
          entrees: signe.lectures,
          sortie: { urlDepot: signe.urlDepot, cle },
          parametres: { composition: deps.composition, proprietes: { ...deps.proprietes }, mode: "plage", debut: plage.debut, fin: plage.fin, recollable: true },
        });
      } catch {
        return null;
      }
    },
    async recoller(parametres: ParametresRecollage, entrees: Record<string, string>) {
      try {
        const cle = deps.cle(`${deps.idBase}-recolle.mp4`);
        const signe = await deps.signer({ ...entrees }, { cle, mime: "video/mp4" });
        return await rendre({
          idRendu: `${deps.idBase}-recollage-0`,
          operation: "recollage-plages",
          file: "longue",
          entrees: signe.lectures,
          sortie: { urlDepot: signe.urlDepot, cle },
          parametres: { ...parametres },
        });
      } catch {
        return null;
      }
    },
    regarder: deps.regarder,
  };
}
