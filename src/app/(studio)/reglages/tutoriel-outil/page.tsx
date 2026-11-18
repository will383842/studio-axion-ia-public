import type { Metadata } from "next";
import { PanneauConsole } from "@/components/tutoriel-outil/PanneauConsole";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { depots } from "@/donnees/memoire";
import { exigerSession } from "@/services/auth";
import { coutsDeLaVideo } from "@/services/cout-video";
import { ligneSimulee, moisParis } from "@/services/couts";
import { lireConsommation, lireReglagesTutoriel, lireTexteMention, phraseDevis, phraseDuTravail, videosEnCours } from "@/services/tutoriel-console";
import { lireSuivi } from "@/services/tutoriel-suivi";
import { basculerReglageFormulaire, enregistrerTexteFormulaire } from "./actions";

export const metadata: Metadata = { title: "Tutoriel d'outil" };
export const dynamic = "force-dynamic";

/** Réglages › Tutoriel d'outil : interrupteurs (éteints par défaut), vidéos en cours, consommation en quantités. */
export default async function PageReglagesTutorielOutil() {
  await exigerSession();
  const videos = await videosEnCours({
    videos: () => depots().videos.lister(),
    // Vue de suivi de T-EXT-34 : la dernière fabrication de la vidéo, en une phrase (sinon le statut de la vidéo).
    etat: async (v) => {
      const travail = (await lireSuivi(v.id))?.travail;
      return travail ? phraseDuTravail(travail.statut) : null;
    },
  });
  const [reglages, texteMention, consommation] = await Promise.all([
    lireReglagesTutoriel(),
    lireTexteMention(),
    lireConsommation(videos, {
      depensesDe: (id) => depots().depenses.lister((d) => d.videoId === id),
      nbDepenses: async (id) => (await coutsDeLaVideo(id)).nbDepenses,
      // Devis de T-EXT-42 (`texteDevis`, via `phraseDevis`). Il n'est stocké nulle part : il est calculé à la fabrication
      // (`montage-tutoriel-outil/index.ts`, `garderDevis`), avec les voix et le script lu. Le recalculer ici sortirait du
      // périmètre : le port renvoie `null` (« Ligne à demander » dans la description de la PR).
      devis: async () => phraseDevis(null),
      payee: (l) => !ligneSimulee(l),
      moisDe: (date) => moisParis(date),
      moisCourant: moisParis(),
    }),
  ]);
  return (
    <div className="mx-auto w-full max-w-xl">
      <EnTetePage retour={{ href: "/reglages", libelle: "Réglages" }} titre="Tutoriel d'outil" sousTitre="Allumez un réglage seulement quand vous voulez l'utiliser." />
      <PanneauConsole vue={{ reglages, texteMention, videos, consommation }} basculer={basculerReglageFormulaire} enregistrerTexte={enregistrerTexteFormulaire} />
    </div>
  );
}
