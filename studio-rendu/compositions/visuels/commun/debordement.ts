/** Détection du texte coupé : fonction PURE (le DOM réel est lu par `controle-debordement.tsx`). */

export interface BoiteMesuree {
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
}

/** Écart toléré (px) : l'arrondi des dimensions fractionnaires. */
const TOLERANCE_PX = 1;

/** Message d'erreur si le contenu de la boîte dépasse son cadre (texte coupé par `overflow: hidden`), sinon `null`. `objet` nomme la zone (« la carte », « la page »…). */
export function messageDebordement(boite: BoiteMesuree, libelle: string, objet = "la carte"): string | null {
  const trop: string[] = [];
  if (boite.scrollHeight > boite.clientHeight + TOLERANCE_PX) trop.push(`hauteur ${boite.scrollHeight} px pour ${boite.clientHeight} px disponibles`);
  if (boite.scrollWidth > boite.clientWidth + TOLERANCE_PX) trop.push(`largeur ${boite.scrollWidth} px pour ${boite.clientWidth} px disponibles`);
  if (trop.length === 0) return null;
  return `Le texte de ${objet} « ${libelle.slice(0, 40)} » déborde de son cadre (${trop.join(" ; ")}) : il serait coupé`;
}
