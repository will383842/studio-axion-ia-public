/**
 * R4-03-b3 : la liste des « téléphones qui jouent un extrait » d'une version gardée, lisible par Will (« Téléphone à 12,4 s (3,0 s) : « devis client » »).
 * PUR : aucun service, aucune lecture en base, aucun réglage, aucune horloge. Rien ne l'importe encore. Ne lève jamais.
 * Le projet est lu par un type structurel local (`ProjetGardeV4` y entre tel quel) : ce fichier n'importe que le préfixe `axion:`.
 */
import type { ElementV4Plan } from "@/domaine/facecam-animee/plan";
import { estRechercheAxion, PREFIXE_AXION } from "./extraits-maison/recherche";

/** Même type d'élément que le téléphone du lot 6 : recopié, rien d'éteint n'est importé. */
const ID_TELEPHONE = "telephone-video";

/** Partie du projet gardé que cette liste lit. */
export interface ProjetPourTelephonesV4 {
  plan: { elementsV4?: readonly ElementV4Plan[] };
  videos?: { choix?: readonly unknown[] };
}

export interface TelephoneRetouchableV4 {
  rang: number;
  debut: number;
  fin: number;
  dureeSec: number;
  /** Première recherche sans le préfixe `axion:`, nettoyée ; `null` si absente. */
  recherche: string | null;
  depuisArchive: boolean;
  /** Nom du clip (sans `broll/`), ou `null`. */
  fichier: string | null;
  /** Clé de l'extrait (`extrait:…`) du choix « archive-axion » de ce clip, ou `null`. */
  extraitCle: string | null;
}

const secondes = (x: number) => `${x.toFixed(1).replace(".", ",")} s`;

function nettoyer(r: unknown): string | null {
  if (typeof r !== "string") return null;
  const t = r.trim();
  const corps = (estRechercheAxion(t) ? t.slice(PREFIXE_AXION.length) : t).trim().replace(/\s+/g, " ");
  return corps === "" ? null : corps;
}

/** Un objet par élément `telephone-video`, dans l'ordre des rangs. `null` ou plan sans `elementsV4` : `[]`. */
export function telephonesRetouchablesV4(projet: ProjetPourTelephonesV4 | null): TelephoneRetouchableV4[] {
  try {
    const elements = projet?.plan?.elementsV4;
    if (!Array.isArray(elements)) return [];
    const choix = Array.isArray(projet?.videos?.choix) ? (projet!.videos!.choix as unknown[]) : [];
    const sortie: TelephoneRetouchableV4[] = [];
    elements.forEach((e: ElementV4Plan | null, rang: number) => {
      if (!e || typeof e !== "object" || e.id !== ID_TELEPHONE) return;
      const premiere = e.recherches?.[0];
      const media = e.medias?.[0];
      const fichier = typeof media === "string" && media.replace(/^broll\//, "") !== "" ? media.replace(/^broll\//, "") : null;
      const trouve = fichier === null ? undefined : choix.find((c) => {
        const x = c as { source?: unknown; fichier?: unknown } | null;
        return !!x && x.source === "archive-axion" && x.fichier === fichier;
      }) as { id?: unknown } | undefined;
      sortie.push({
        rang, debut: e.debut, fin: e.fin, dureeSec: Math.max(0, e.fin - e.debut),
        recherche: nettoyer(premiere),
        depuisArchive: estRechercheAxion(premiere),
        fichier,
        extraitCle: trouve && typeof trouve.id === "string" ? trouve.id : null,
      });
    });
    return sortie;
  } catch {
    return [];
  }
}

/** « Téléphone à 12,4 s (3,0 s) : « devis client » » ; sans recherche : « Téléphone à 12,4 s (3,0 s) ». */
export function libelleTelephoneV4(t: TelephoneRetouchableV4): string {
  const base = `Téléphone à ${secondes(t.debut)} (${secondes(t.dureeSec)})`;
  return t.recherche ? `${base} : « ${t.recherche} »` : base;
}
