import { OngletsLiens } from "@/components/ui/Onglets";
import { listerFormats, listerFormatsNavigation, nomCourtFormat, statutNavigation } from "@/formats";

/**
 * Onglets de Mes vidéos (AV2.1) : Toutes · Brouillons · un onglet par format (générés du registre) · Archivées.
 * `actif` : « toutes », « brouillons », « autres », « archivees » ou l'id d'un format.
 */
export function OngletsMesVideos({
  actif,
  compteParFormat,
  nbToutes,
  nbBrouillons,
  nbArchivees,
  nbCorbeille = 0,
  nbAutres = 0,
  className,
}: {
  actif: string;
  compteParFormat: Record<string, number>;
  nbToutes: number;
  nbBrouillons: number;
  nbArchivees: number;
  /** Vidéos à la corbeille (supprimées 30 jours après leur mise de côté). */
  nbCorbeille?: number;
  /** Vidéos dont le format n'est plus dans le registre. */
  nbAutres?: number;
  className?: string;
}) {
  // Les formats de la navigation (actifs, ou en essai chez Will) ont leur onglet ; un format grisé « Bientôt » seulement s'il a des
  // vidéos ou s'il est l'onglet courant. Les autres formats (masqués : on n'enferme pas des vidéos existantes) seulement avec des vidéos.
  const navigation = listerFormatsNavigation();
  const dansNavigation = new Set(navigation.map((f) => f.id));
  const formats = [
    ...navigation.filter((f) => statutNavigation(f) === "actif" || (compteParFormat[f.id] ?? 0) > 0 || f.id === actif),
    ...listerFormats({ inclureMasques: true }).filter((f) => !dansNavigation.has(f.id) && ((compteParFormat[f.id] ?? 0) > 0 || f.id === actif)),
  ];
  return (
    <OngletsLiens
      libelle="Rangement de mes vidéos"
      className={className}
      onglets={[
        { href: "/videos", libelle: "Toutes", icone: "grille", compteur: nbToutes, actif: actif === "toutes" },
        ...(nbBrouillons || actif === "brouillons" ? [{ href: "/videos?vue=brouillons", libelle: "Brouillons", icone: "ecrire" as const, compteur: nbBrouillons, actif: actif === "brouillons" }] : []),
        ...formats.map((f) => ({
          href: `/formats/${f.id}`,
          libelle: nomCourtFormat(f),
          icone: f.icone,
          compteur: compteParFormat[f.id] ?? 0,
          actif: f.id === actif,
        })),
        ...(nbAutres || actif === "autres" ? [{ href: "/videos?vue=autres", libelle: "Autres", icone: "grille" as const, compteur: nbAutres, actif: actif === "autres" }] : []),
        ...(nbArchivees || actif === "archivees" ? [{ href: "/videos?vue=archivees", libelle: "Archivées", icone: "archive" as const, compteur: nbArchivees, actif: actif === "archivees" }] : []),
        ...(nbCorbeille || actif === "corbeille" ? [{ href: "/videos?vue=corbeille", libelle: "Corbeille", icone: "corbeille" as const, compteur: nbCorbeille, actif: actif === "corbeille" }] : []),
      ]}
    />
  );
}
