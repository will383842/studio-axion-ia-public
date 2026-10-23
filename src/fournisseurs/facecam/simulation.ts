/**
 * DOUBLE DE SIMULATION des travaux face caméra (plan facecam v4, lot A) — utilisé PAR DÉFAUT.
 * Aucun réseau : chaque travail est « terminé » au premier suivi, avec des clés R2 fictives et stables (même
 * `idTravail` → même résultat). `routesEnPanne` fait échouer des routes pour les essais (brique ratée → livraison quand même).
 */
import type { DemandeFacecam, EtatTravailFacecam, FournisseurFacecam, ResultatsFacecam, RouteFacecam } from "./client";

function resultatSimule<R extends RouteFacecam>(route: R, demande: DemandeFacecam): ResultatsFacecam[R] {
  const cle = (nom: string) => `simulation/facecam/${demande.idTravail}/${nom}`;
  const texte = typeof demande.parametres?.texte === "string" ? demande.parametres.texte : "";
  const mots = texte.split(/\s+/).filter(Boolean).map((mot, i) => ({ mot, debutSec: i * 0.4, finSec: i * 0.4 + 0.35 }));
  const parRoute: ResultatsFacecam = {
    transcrire: { transcriptionCle: cle("transcription.json.gz"), dureeSec: Math.max(1, mots.length * 0.4), mots },
    visages: { pisteVisageCle: cle("visage.json.gz"), visageTrouvePct: 100, luminanceMoyenne: 110 },
    // Lot G : étape « images » (contrôles de la relecture) : une clé fictive par instant demandé.
    image: demande.parametres?.etape === "images"
      ? ({ fichierCle: "", hdr: false, images: ((demande.parametres.instants as { nom: string; instantSec: number }[] | undefined) ?? []).map((i) => ({ nom: i.nom, cle: cle(`${i.nom}.jpg`), instantSec: i.instantSec })) } as ResultatsFacecam["image"])
      : demande.parametres?.etape === "cadrage"
        ? // Contrôles machine sans défaut, à la version courante du studio-aligneur (10/10 : `VERSION_CONTROLES`).
          ({ fichierCle: cle("image-10bits.mp4"), hdr: false, controles: { version: 2, noirs: [], figes: [], imagesIsolees: [], niveauLufs: -14, decalageSynchroImages: 0 } } as ResultatsFacecam["image"])
        : ({ fichierCle: cle("image-10bits.mp4"), hdr: false, ...(demande.parametres?.bande ? { bande: demande.parametres.bande } : {}) } as ResultatsFacecam["image"]),
    son: { fichierCle: cle("son.wav"), niveauLufs: -14 },
    segmenter: { masquesCle: cle("masques.json.gz") },
  };
  return parRoute[route];
}

export function creerFacecamSimule(options: { routesEnPanne?: RouteFacecam[] } = {}): FournisseurFacecam & { soumises: { route: RouteFacecam; demande: DemandeFacecam }[] } {
  const demandes = new Map<string, DemandeFacecam>();
  const soumises: { route: RouteFacecam; demande: DemandeFacecam }[] = [];
  return {
    id: "simulation",
    mode: "simulation",
    soumises,
    async soumettre(route, demande) {
      if (!demandes.has(`${route}:${demande.idTravail}`)) soumises.push({ route, demande });
      demandes.set(`${route}:${demande.idTravail}`, demande);
      return { statut: "en_file" };
    },
    async suivre<R extends RouteFacecam>(route: R, idTravail: string): Promise<EtatTravailFacecam<R>> {
      const demande = demandes.get(`${route}:${idTravail}`);
      if (!demande) return { statut: "echec", erreur: { code: "fichier-inaccessible", reessayable: true, message: "Travail inconnu : à soumettre à nouveau.", travailInconnu: true } };
      if (options.routesEnPanne?.includes(route)) return { statut: "echec", erreur: { code: "indisponible", reessayable: true, message: `Panne simulée (${route}).` } };
      return { statut: "termine", resultat: resultatSimule(route, demande) };
    },
  };
}
