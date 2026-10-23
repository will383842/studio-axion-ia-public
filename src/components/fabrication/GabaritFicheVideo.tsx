import type { ReactNode } from "react";

/** Les zones de la fiche d'une vidéo, dans l'ordre de l'écran. Toutes facultatives sauf l'en-tête, le lecteur, les chiffres et la zone du format. */
const ZONES = ["retour", "bandeau", "entete", "etapes", "lecteur", "essai", "chiffres", "suivi", "specifique", "onglets", "action"] as const;
export type ZoneFicheVideo = (typeof ZONES)[number];

export type ProprietesGabaritFicheVideo = { entete: ReactNode; deuxColonnes?: boolean } & Partial<Record<Exclude<ZoneFicheVideo, "entete">, ReactNode>>;

/**
 * Squelette commun de la fiche vidéo (serveur, sans état) : chaque zone est posée à sa place, une zone absente n'est pas rendue.
 * `deuxColonnes` : retour + bandeau au-dessus sur toute la largeur, puis le lecteur (collé à gauche en `lg`) et les autres zones empilées à droite.
 * En une colonne (mobile) : le lecteur d'abord, puis le reste, dans l'ordre de l'écran.
 */
export function GabaritFicheVideo({ deuxColonnes, ...zones }: ProprietesGabaritFicheVideo) {
  const presentes = ZONES.filter((z) => zones[z]);
  const zone = (z: ZoneFicheVideo, className?: string) => <div key={z} data-zone={z} className={className}>{zones[z]}</div>;
  if (!deuxColonnes) return <div data-gabarit="fiche-video" className="space-y-4">{presentes.map((z) => zone(z))}</div>;
  const haut = presentes.filter((z) => z === "retour" || z === "bandeau");
  const droite = presentes.filter((z) => z !== "retour" && z !== "bandeau" && z !== "lecteur");
  return (
    <div data-gabarit="fiche-video">
      {haut.length > 0 && <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3">{haut.map((z) => zone(z))}</div>}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-10">
        {zones.lecteur && zone("lecteur", "lg:sticky lg:top-24 lg:self-start")}
        <div className="min-w-0 space-y-4">{droite.map((z) => zone(z))}</div>
      </div>
    </div>
  );
}
