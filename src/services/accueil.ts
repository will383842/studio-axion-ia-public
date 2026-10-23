/** ACCUEIL (B.8 #2 + AV2.4-3) : tout ce que l'écran d'accueil affiche, en un appel. */
import "server-only";
import type { ElementBibliotheque, Publication, Video } from "@/domaine/types";
import { cleJour } from "@/lib/dates";
import { obtenirReseau } from "@/reseaux";
import { depots, filtreExemples } from "./_commun";
import { resumeBudget } from "./couts";
import { listerPersonnages } from "./personnages";
import { listerTravaux } from "./travaux";
import { listerVideos } from "./videos";
import type { VueBudget, VueTravail, VueVideoCarte } from "./vues";
import { choisirMoi } from "@/domaine/moi";

export interface AlerteAccueil {
  id: string;
  ton: "ambre" | "brique";
  message: string;
  lien: string;
}

export interface ResumeAccueil {
  aujourdhui: {
    /** Nombres exacts (sans limite) pour les tuiles ; les listes ci-dessous sont limitées aux cartes affichées. */
    nbARelire: number;
    nbAProgrammer: number;
    aRelire: VueVideoCarte[];
    aProgrammer: VueVideoCarte[];
    publicationsDuJour: (Publication & { reseauNom: string; videoTitre: string })[];
  };
  brouillons: VueVideoCarte[];
  enCours: VueTravail[];
  dernieres: VueVideoCarte[];
  alertes: AlerteAccueil[];
  budget: VueBudget;
  /** Carte « Prêt pour une vraie vidéo ? » (visage, voix, LUT, logo). */
  pret: { visage: boolean; voix: boolean; lut: boolean; logo: boolean };
}

export async function resumeAccueil(): Promise<ResumeAccueil> {
  const enCours = await listerTravaux();
  const [aRelire, aProgrammer, brouillons, dernieres, budget, personnages] = await Promise.all([
    listerVideos({ statut: "prete", etapeEditoriale: "a_relire", limite: 6 }),
    listerVideos({ statut: "prete", etapeEditoriale: "validee", limite: 6 }),
    listerVideos({ statut: "brouillon", limite: 8 }),
    listerVideos({ statut: "prete", limite: 8 }),
    resumeBudget(),
    listerPersonnages(),
  ]);
  const d = depots();
  const ex = await filtreExemples<Publication>();
  const exVideo = await filtreExemples<Video>();
  const [nbARelire, nbAProgrammer] = await Promise.all([
    d.videos.compter((v) => exVideo(v) && v.statut === "prete" && v.etapeEditoriale === "a_relire"),
    d.videos.compter((v) => exVideo(v) && v.statut === "prete" && v.etapeEditoriale === "validee"),
  ]);
  const aujourdhui = cleJour(new Date());
  const archivees = new Set((await d.videos.lister((v) => v.statut === "archivee")).map((v) => v.id));
  const pubs = await d.publications.lister((p) => ex(p) && !archivees.has(p.videoId) && cleJour(p.date) === aujourdhui && p.via !== "simulation");
  const publicationsDuJour = await Promise.all(
    pubs.map(async (p) => ({ ...p, reseauNom: obtenirReseau(p.reseau).nom, videoTitre: (await d.videos.obtenir(p.videoId))?.titre ?? "" })),
  );

  // TEST-UI-REEL U1 : le vrai « Moi » d'abord (la liste ne contient celui d'exemple que si les exemples sont affichés).
  const moi = choisirMoi(personnages, (p) => p.personnage, true);
  const alertes: AlerteAccueil[] = [];
  for (const p of personnages) {
    if (!p.accordValide) alertes.push({ id: `accord-${p.personnage.id}`, ton: "ambre", message: `Accord manquant : ${p.personnage.nom}`, lien: `/personnages/${p.personnage.id}` });
  }
  if (moi && !moi.voix.some((v) => v.statut === "pret")) alertes.push({ id: "voix", ton: "ambre", message: "Votre voix n'est pas encore enregistrée", lien: `/personnages/${moi.personnage.id}` });
  if (budget.pourcentage >= 80) alertes.push({ id: "budget", ton: budget.pourcentage >= 100 ? "brique" : "ambre", message: `Budget du mois utilisé à ${budget.pourcentage} %`, lien: "/reglages" });

  // Même filtre que la Bibliothèque : exemples masqués → la LUT et le logo d'exemple ne comptent pas.
  const exElement = await filtreExemples<ElementBibliotheque>();
  const elements = await d.elements.lister((e) => exElement(e) && !e.archiveLe && (e.type === "lut" || e.type === "logo"));
  return {
    aujourdhui: { nbARelire, nbAProgrammer, aRelire, aProgrammer, publicationsDuJour },
    brouillons,
    enCours,
    dernieres,
    alertes,
    budget,
    pret: {
      visage: !!moi?.visages.some((v) => v.statut === "pret"),
      voix: !!moi?.voix.some((v) => v.statut === "pret"),
      lut: elements.some((e) => e.type === "lut"),
      logo: elements.some((e) => e.type === "logo"),
    },
  };
}
