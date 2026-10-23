import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import { chargerPoliceArchivoBlack, chargerPoliceInter, policeArchivoBlackPrete, policeInterPrete, policeKalamPrete } from "../polices";
import { avecDelai, DELAI_DELAYRENDER_MS, DELAI_POLICE_MS, DELAI_TITRES_MS, etatPolices } from "./attente-police";
import { messageDebordement } from "./debordement";
import { ATTRIBUT_ZONE_CORPS } from "./zones";

/** Attend que les polices (Archivo Black, Inter et, si la page l'emploie, Kalam) soient réellement chargées : jamais de mesure avec une police de secours. */
export function attendrePolices(): Promise<void> {
  return avecDelai(
    Promise.all([policeArchivoBlackPrete(), policeInterPrete(), policeKalamPrete()]).then(() => undefined),
    DELAI_POLICE_MS,
    () => `Polices de la page non chargées après ${DELAI_POLICE_MS / 1000} s : texte non mesurable (${etatPolices()})`,
  );
}

/** Attend que les titres ajustés (`Titre.tsx`) contenus dans la boîte aient pris leur corps définitif. */
async function attendreTitres(boite: HTMLElement): Promise<void> {
  for (let i = 0; i < DELAI_TITRES_MS / 25 && boite.querySelector("[data-titre-attente]"); i++) await new Promise((r) => setTimeout(r, 25));
  await new Promise((r) => setTimeout(r, 40));
}

/**
 * Le cadre coupe ce qui dépasse (`overflow: hidden`) : on mesure donc le texte réel et on fait ÉCHOUER le rendu s'il serait coupé
 * (même mesure pour les cartes et pour les zones des pages : `debordement.ts`).
 */
export function useControleDebordement(cadre: RefObject<HTMLElement | null>, libelle: string, objet: string, dependances: readonly unknown[]): void {
  chargerPoliceArchivoBlack();
  chargerPoliceInter();
  useEffect(() => {
    const attente = delayRender(`Contrôle du débordement de ${objet} « ${libelle.slice(0, 24)} »`, { timeoutInMilliseconds: DELAI_DELAYRENDER_MS });
    attendrePolices()
      .then(async () => {
        if (cadre.current) await attendreTitres(cadre.current);
        const message = cadre.current ? messageDebordement(cadre.current, libelle, objet) : null;
        if (message) throw new Error(message);
        continueRender(attente);
      })
      .catch((e: unknown) => cancelRender(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependances);
}

interface ProprietesZone {
  /** Nom de la zone dans le message d'échec. */
  libelle: string;
  style?: CSSProperties;
  children: ReactNode;
  /** Corps de page : marqué `ATTRIBUT_ZONE_CORPS`, la mesure du vide y rapporte la place occupée. */
  corps?: boolean;
}

/** Marge basse (px) d'une zone : le dessin d'une lettre (jambages) peut dépasser de quelques pixels la boîte de sa ligne, sans être coupé. */
export const JAMBAGE = 8;

/** Marge haute (px) du titre en capitales : l'accent d'une capitale (É, À, È) dépasse de la boîte de la première ligne, la zone qui coupe ce qui dépasse le raboterait (dépassement mesuré : 6 px à 120 px de corps, soit 0,05 em, 9 px au corps maximal de 170 px). */
export const JAMBAGE_HAUT = 14;

/** Zone de page à cadre fixe : coupe ce qui dépasse, et le rendu échoue plutôt que de couper un texte en silence. */
export function Zone({ libelle, style, children, corps = false }: ProprietesZone) {
  const cadre = useRef<HTMLDivElement>(null);
  useControleDebordement(cadre, libelle, "la zone", [libelle]);
  return (
    <div ref={cadre} {...(corps ? { [ATTRIBUT_ZONE_CORPS]: "" } : {})} style={{ boxSizing: "border-box", overflow: "hidden", paddingBottom: JAMBAGE, ...style }}>
      {children}
    </div>
  );
}
