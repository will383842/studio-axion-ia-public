import type { Metadata } from "next";
import { MesAnimations } from "@/components/facecam/MesAnimations";
import { EnTetePage } from "@/components/ui/EnTetePage";
import type { CodeCarte } from "@/moteurs/montage-facecam/monteur";
import { exigerSession } from "@/services/auth";
import { lireJsonGz, listerAnimations } from "@/services/monteur-facecam";

export const metadata: Metadata = { title: "Mes animations" };
export const dynamic = "force-dynamic";

/**
 * BIBLIOTHÈQUE › MES ANIMATIONS (plan facecam v4, correctif du 09/10 « Garder ce modèle » ; lot D) : les cartes sur
 * mesure gardées, réutilisables dans toutes les vidéos et tous les formats. Voir, renommer, retirer.
 * L'index est léger (quelques Ko) ; le code HTML / CSS / GSAP est lu sur R2.
 */
export default async function PageMesAnimations() {
  await exigerSession();
  const animations = await listerAnimations();
  const codes = await Promise.all(animations.map((a) => lireJsonGz<CodeCarte>(a.contenuCle)));
  return (
    <div className="mx-auto max-w-3xl">
      <EnTetePage retour={{ href: "/bibliotheque", libelle: "Bibliothèque" }} titre="Mes animations" sousTitre="Les animations sur mesure que vous avez gardées." className="mb-6" />
      <MesAnimations animations={animations.map((a, i) => ({ ...a, code: codes[i] }))} />
    </div>
  );
}
