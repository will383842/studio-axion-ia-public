/**
 * SOCLE DE WILL, COMMUN À TOUS LES ÉCRITS DU STUDIO : sa charte de marque (contexte versionné : interdits, promesses
 * interdites, jargon, carnet de voix, positions…), sa fiche de style validée, ses textes retenus et ses preuves.
 *
 * UNE seule lecture pour tous : le générateur 14 étapes (`boucle-generation.ts`) en tire ses données, le tableau animé
 * (`tableau-scripts/client-studio.ts`) ses blocs en cache. Quand Will change « Ma voix » ou ses preuves, les deux le
 * voient. Les blocs sont rendus par `blocsEnCache` (anonymisation et filtrage des preuves utilisables : là, inchangés).
 * Aucune session exigée : lu aussi par les tâches de fond.
 */
import "server-only";
import type { ContexteAxion, ExempleStyle, FicheStyle, Matiere, Preuve } from "@/domaine/types";
import type { CadreDuFormat } from "@/donnees/generateur/parametres-generateur";
import { blocsEnCache, nomsSensiblesDu, type DonneesSocle } from "@/generateur/contexte";
import type { EntreeRole } from "@/generateur/roles/types";
import { depots, maintenant } from "./_commun";

export interface SocleWill {
  /** La plus haute version du contexte de marque. */
  contexteAxion?: ContexteAxion;
  /** La plus haute version de la fiche de style VALIDÉE par Will. */
  ficheStyle?: FicheStyle;
  /** Ses textes retenus (non archivés). */
  exemplesStyle: ExempleStyle[];
  preuves: Preuve[];
  matieres: Matiere[];
  /**
   * Noms sensibles de TOUT le stock (toutes les matières et preuves, quel que soit le filtre), triés : le socle est
   * anonymisé sur cette liste globale, donc identique pour tous les sujets et tous les formats (cache partagé).
   */
  nomsSensibles: string[];
}

export interface FiltresSocle {
  /** Données de démonstration ou réelles (jamais mélangées). */
  estDemo: boolean;
  /** Matières lues en plus du filtre démo (le générateur : celles du sujet ; le tableau : les avis, d'où les positions). */
  matieres: (m: Matiere) => boolean;
}

/** Lit le socle de Will (mêmes garde-fous qu'en production, même en mémoire : règles semées au besoin). */
export async function chargerSocleWill(f: FiltresSocle): Promise<SocleWill> {
  const d = depots();
  // E2E-2 données n° 3 : mêmes garde-fous qu'en production, même en mémoire (tournures, règles, interdits de marque).
  const { assurerReglesGenerateur } = await import("./contexte-axion");
  await assurerReglesGenerateur();
  const [stock, preuves, contextes, fiches, exemplesStyle] = await Promise.all([
    d.matieres.lister((x) => !!x.estDemo === f.estDemo),
    d.preuves.lister((x) => !!x.estDemo === f.estDemo),
    d.contexteAxion.lister(),
    d.fichesStyle.lister(),
    d.exemplesStyle.lister((x) => x.retenu && !x.archiveLe),
  ]);
  const matieres = stock.filter((x) => f.matieres(x));
  return {
    nomsSensibles: [...new Set(nomsSensiblesDu({ matieres: stock, preuves }))].sort(),
    contexteAxion: [...contextes].sort((a, b) => b.version - a.version)[0],
    ficheStyle: [...fiches].sort((a, b) => b.version - a.version).find((x) => x.valideeParWillLe),
    exemplesStyle,
    preuves,
    matieres,
  };
}

/**
 * Les blocs du socle réel de Will (charte, style, preuves ; puis les modèles de ton du format), pour un écrit HORS du
 * générateur (aucun sujet : seules les matières « avis » sont lues, d'où les positions de marque citées dans la charte ;
 * les noms sont masqués sur la liste globale, la même que reçoit le générateur dans `boucle-generation.ts`).
 */
export async function blocsSocleWill(format: CadreDuFormat): Promise<EntreeRole["contexte"]> {
  const s = await chargerSocleWill({ estDemo: false, matieres: (m) => m.type === "avis-will" });
  const donnees: DonneesSocle = { maintenant: maintenant(), ...s };
  return blocsEnCache(donnees, format);
}
