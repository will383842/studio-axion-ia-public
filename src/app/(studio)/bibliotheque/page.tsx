import type { Metadata } from "next";
import { ApercuImageVideo } from "@/components/bibliotheque/ApercuImageVideo";
import { ChoixAjout } from "@/components/bibliotheque/ChoixAjout";
import { Apparition } from "@/components/ui/Apparition";
import { EnTetePage, EnTeteSection } from "@/components/ui/EnTetePage";
import { Tuile } from "@/components/ui/Tuile";
import { TYPES_BIBLIOTHEQUE } from "@/domaine/libelles";
import { compterRushs, donneesApercuImage } from "@/services/B-personnages-bibliotheque";
import { compterElementsParType, listerPrononciations } from "@/services/bibliotheque";
import { exigerSession } from "@/services/auth";
import { resumeMesImages } from "@/services/mes-images";
import { listerAnimations } from "@/services/monteur-facecam";
import { trouverFormat } from "@/formats";

export const metadata: Metadata = { title: "Bibliothèque" };
export const dynamic = "force-dynamic";

const GROUPES = [
  { id: "style", titre: "Le style" },
  { id: "medias", titre: "Les images" },
  { id: "son", titre: "Le son" },
] as const;

/** Tuile supplémentaire : mes images filmées (rushs), rangées avec « Les images ». */
const RUSHS = { type: "rushs", nom: "Mes rushs", icone: "camera", groupe: "medias" } as const;
/** Plan facecam v4 (lot D) : les animations sur mesure gardées (« Garder ce modèle »), rangées avec « Le style ». */
const ANIMATIONS = { type: "animations", nom: "Mes animations", icone: "etincelles", groupe: "style" } as const;

/**
 * BIBLIOTHÈQUE (B.8 #15 + AV2.1) : aperçu en direct + grille de tuiles par type (mobile d'abord).
 * Chaque type a sa page /bibliotheque/[type]. Niveau 2. Propriétaire : développeur B.
 */
export default async function PageBibliotheque() {
  await exigerSession();
  const [compte, prononciations, rushs, apercu, mesImages, animations] = await Promise.all([compterElementsParType(), listerPrononciations(), compterRushs(), donneesApercuImage(), resumeMesImages(), listerAnimations()]);
  // « Mes animations » : dès qu'une animation est gardée, ou une fois le face caméra ouvert (masqué pendant le chantier).
  const types = [...TYPES_BIBLIOTHEQUE, RUSHS, ...(animations.length || trouverFormat("facecam")?.statut === "actif" ? [ANIMATIONS] : [])];
  const compteur = (type: string) => (type === "prononciations" ? prononciations.length : type === "rushs" ? rushs : type === "mes-images" ? mesImages.total : type === "animations" ? animations.length : (compte[type as keyof typeof compte] ?? 0));
  return (
    <div>
      <EnTetePage titre="Bibliothèque" sousTitre="Tout ce qui donne le style à vos vidéos." />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <div className="space-y-8">
          {GROUPES.map((g, gi) => (
            <section key={g.id}>
              <EnTeteSection titre={g.titre} />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {types
                  .filter((t) => t.groupe === g.id)
                  .map((t, i) => (
                    <Apparition key={t.type} index={gi * 3 + i}>
                      <Tuile href={`/bibliotheque/${t.type}`} icone={t.icone} libelle={t.nom} compteur={compteur(t.type)} />
                    </Apparition>
                  ))}
              </div>
            </section>
          ))}
        </div>
        <Apparition index={4} className="lg:sticky lg:top-6">
          <EnTeteSection titre="Aperçu" className="lg:hidden" />
          <ApercuImageVideo donnees={apercu} />
        </Apparition>
      </div>
      <ChoixAjout types={types.filter((t) => t.type !== "animations").map((t) => ({ type: t.type, nom: t.nom, icone: t.icone }))} />
    </div>
  );
}
