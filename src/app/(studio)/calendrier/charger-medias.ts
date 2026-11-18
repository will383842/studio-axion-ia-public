import "server-only";
import { lireCleFiche } from "@/components/calendrier/FicheEntree";
import { entreeDepuisPublication, type EntreeApercu, type PublicationApercu } from "@/components/calendrier/apercu-reseau";
import { LIMITE_PAGES } from "@/services/pdf-pages";
import { DUREE_LECTURE_SEC } from "@/services/medias-deposes";
import { depots, fournisseur } from "@/services/_commun";

/** Seules les adresses https ou les chemins du Studio (jamais « // », jamais « javascript: ») sont gardées. */
const ADRESSE_SURE = /^(?:https:\/\/|\/(?!\/))/;

interface MediaVisuel {
  type: "carrousel" | "infographie";
  pages: string[];
}

/** Pages signées d'un visuel (20 au plus). Lève si le dépôt ou le stockage échoue : l'appelant rend l'entrée sans média. */
async function pagesDuVisuel(visuelId: string): Promise<MediaVisuel> {
  const visuel = await depots().visuels.obtenir(visuelId);
  const type = visuel?.famille === "infographie" ? "infographie" : "carrousel";
  const cles = (visuel?.rendu?.pages ?? []).slice(0, LIMITE_PAGES).map((p) => p.x1Cle);
  if (cles.length === 0) return { type, pages: [] };
  const stockage = await fournisseur("stockage");
  const signer = (cle: string) => (stockage.urlLectureDuree ? stockage.urlLectureDuree(cle, DUREE_LECTURE_SEC) : stockage.urlLecture(cle));
  // Une page illisible n'empêche pas les autres.
  const signees = await Promise.all(cles.map((cle) => signer(cle).catch(() => "")));
  return { type, pages: signees.filter((a) => typeof a === "string" && ADRESSE_SURE.test(a)) };
}

/**
 * Durée visée de la vidéo de l'entrée (celle de sa commande), pour l'alerte de durée du réseau. Inconnue ou dépôt en échec :
 * l'entrée est rendue telle quelle, sans alerte.
 */
async function avecDuree(base: EntreeApercu, videoId: string): Promise<EntreeApercu> {
  try {
    const dureeSec = (await depots().videos.obtenir(videoId))?.dureeCibleSec;
    if (!base.media || typeof dureeSec !== "number" || !(dureeSec > 0)) return base;
    return { ...base, media: { ...base.media, dureeSec } };
  } catch {
    return base;
  }
}

/**
 * Entrées de la semaine avec leur média. Une publication de visuel devient un carrousel ou une infographie avec ses pages
 * signées (infographie : la page 1 est l'image). Ne lève jamais : une entrée dont le média échoue est rendue sans média,
 * calculée seule, et les autres gardent le leur. Aucun lien signé n'est journalisé.
 */
export async function entreesAvecMedias(semaine: PublicationApercu[]): Promise<EntreeApercu[]> {
  const memo = new Map<string, Promise<MediaVisuel>>();
  // Pastille « Essai » : la seule entrée du créneau couvert par l'essai borné (lecture seule, ne lève jamais).
  // Import différé et protégé : lecture seule, jamais bloquant pour l'affichage.
  const essaiId = await import("@/services/essai-zernio").then((m) => m.lireEssai()).then((e) => e?.creneauId, () => undefined);
  const entree = async (p: PublicationApercu): Promise<EntreeApercu> => {
    const sansPastille = entreeDepuisPublication(p);
    const cleFiche = essaiId ? lireCleFiche(sansPastille.cle) : null;
    const base: EntreeApercu = cleFiche?.origine === "creneau" && cleFiche.id === essaiId ? { ...sansPastille, essai: true } : sansPastille;
    if (p.videoId) return avecDuree(base, p.videoId);
    if (!p.visuelId) return base;
    try {
      let attente = memo.get(p.visuelId);
      if (!attente) {
        attente = pagesDuVisuel(p.visuelId);
        memo.set(p.visuelId, attente);
      }
      const { type, pages } = await attente;
      const premiere = pages[0] ?? null;
      return {
        ...base,
        type,
        media: type === "infographie" ? { genre: "image", url: premiere, pages } : { genre: "image", url: null, pages },
      };
    } catch {
      return base;
    }
  };
  // En parallèle, mais l'ordre de sortie reste celui de la semaine (les index sont alignés pour filtrerParTexte).
  return Promise.all(
    semaine.map(async (p) => {
      try {
        return await entree(p);
      } catch {
        return entreeDepuisPublication(p);
      }
    }),
  );
}
