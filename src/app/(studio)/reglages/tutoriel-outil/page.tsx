import type { Metadata } from "next";
import { PanneauConsole } from "@/components/tutoriel-outil/PanneauConsole";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { depots } from "@/donnees/memoire";
import { exigerSession } from "@/services/auth";
import { coutsDeLaVideo } from "@/services/cout-video";
import { ligneSimulee, moisParis } from "@/services/couts";
import { lireConsommation, lireReglagesTutoriel, lireTexteMention, videosEnCours } from "@/services/tutoriel-console";
import { basculerReglageFormulaire, enregistrerTexteFormulaire } from "./actions";

export const metadata: Metadata = { title: "Tutoriel d'outil" };
export const dynamic = "force-dynamic";

/** Réglages › Tutoriel d'outil : interrupteurs (éteints par défaut), vidéos en cours, consommation en quantités. */
export default async function PageReglagesTutorielOutil() {
  await exigerSession();
  const videos = await videosEnCours({ videos: () => depots().videos.lister() });
  const [reglages, texteMention, consommation] = await Promise.all([
    lireReglagesTutoriel(),
    lireTexteMention(),
    lireConsommation(videos, {
      depensesDe: (id) => depots().depenses.lister((d) => d.videoId === id),
      nbDepenses: async (id) => (await coutsDeLaVideo(id)).nbDepenses,
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
