/**
 * G3-04 — OPÉRATIONS DE RETOUCHE des artefacts de la démo facecam (zoom, surlignage, légende, style des sous-titres).
 * Pur, sans effet : rend de nouveaux artefacts + des remarques. Une opération illisible ou impossible est écartée avec
 * une remarque, jamais un refus. Le résultat est revalidé (lireArtefactsDemo, zooms sans chevauchement, facteur borné).
 * Non branché au rendu. L'opération « passage » n'est pas ici (son type vient de G3-02).
 */
import { lireArtefactsDemo, type ArtefactsDemo } from "./artefacts";
import { FACTEUR_ZOOM_MAX, type ZoomEcran } from "./mise-en-page";
import { lireConsignes, type PistesEcran } from "./pistes";
import type { StyleSousTitresDemo } from "./chaine";

export type OperationDemo =
  | { type: "zoom"; debutMs: number; finMs: number; x: number; y: number; facteur?: number }
  | { type: "surligne"; debutMs: number; finMs: number; x: number; y: number; largeur: number; hauteur: number }
  | { type: "legende"; debutMs: number; finMs: number; texte: string }
  | { type: "retirer"; piste: keyof PistesEcran; index: number }
  | { type: "style"; style?: StyleSousTitresDemo["style"]; base?: StyleSousTitresDemo["base"]; intensite?: StyleSousTitresDemo["intensite"] };

export interface ResultatOperationsDemo {
  artefacts: ArtefactsDemo;
  remarques: string[];
}

const PISTES = ["zooms", "clics", "surlignages", "legendes"] as const;
const objet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const copie = <T>(v: T): T => JSON.parse(JSON.stringify(v ?? null)) as T;

const pistesVides = (): PistesEcran => ({ zooms: [], clics: [], surlignages: [], legendes: [] });
const chevauche = (a: ZoomEcran, b: ZoomEcran) => a.debutMs < b.finMs && b.debutMs < a.finMs;

/** Applique les opérations dans l'ordre sur une copie ; l'entrée n'est jamais modifiée. */
export function appliquerOperationsDemo(artefacts: ArtefactsDemo | undefined, operations: readonly OperationDemo[]): ResultatOperationsDemo {
  const remarques: string[] = [];
  const depart = lireArtefactsDemo(copie(artefacts));
  const pistes: PistesEcran = { ...pistesVides(), ...copie(depart.pistes ?? {}) };
  let style = depart.styleSousTitres ? copie(depart.styleSousTitres) : undefined;
  let pistesTouchees = Boolean(depart.pistes);

  for (const [i, op] of (Array.isArray(operations) ? operations : []).entries()) {
    const n = `Opération n° ${i + 1}`;
    if (!objet(op)) {
      remarques.push(`${n} illisible : ignorée.`);
    } else if (op.type === "zoom" || op.type === "surligne" || op.type === "legende") {
      const c = lireConsignes([op]).consignes[0];
      if (!c) remarques.push(`${n} (${op.type}) illisible : ignorée.`);
      else if (c.type === "zoom") {
        const z: ZoomEcran = { debutMs: c.debutMs, finMs: c.finMs, x: c.x, y: c.y, facteur: Math.min(FACTEUR_ZOOM_MAX, Math.max(1, c.facteur ?? 1.6)) };
        if (pistes.zooms.some((a) => chevauche(a, z))) remarques.push(`${n} : ce zoom en chevauche un autre, il est écarté.`);
        else {
          pistes.zooms = [...pistes.zooms, z].sort((a, b) => a.debutMs - b.debutMs);
          pistesTouchees = true;
        }
      } else if (c.type === "surligne") {
        pistes.surlignages = [...pistes.surlignages, { debutMs: c.debutMs, finMs: c.finMs, x: c.x, y: c.y, largeur: c.largeur, hauteur: c.hauteur }];
        pistesTouchees = true;
      } else if (c.type === "legende") {
        pistes.legendes = [...pistes.legendes, { debutMs: c.debutMs, finMs: c.finMs, texte: c.texte }];
        pistesTouchees = true;
      }
    } else if (op.type === "retirer") {
      const liste = PISTES.find((p) => p === op.piste);
      const index = op.index;
      if (!liste || typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= pistes[liste].length) remarques.push(`${n} : rien à retirer à cet endroit.`);
      else (pistes[liste] as unknown[]).splice(index, 1);
    } else if (op.type === "style") {
      const texte = (v: unknown) => typeof v === "string" && v.length > 0;
      const champs: Partial<StyleSousTitresDemo> = {};
      for (const k of ["style", "base", "intensite"] as const) {
        const v = op[k];
        if (v === undefined) continue;
        if (texte(v) || (k === "style" && objet(v))) (champs as Record<string, unknown>)[k] = v;
        else remarques.push(`${n} : « ${k} » illisible, ignoré.`);
      }
      style = { prononciations: [], ...style, ...champs };
    } else {
      remarques.push(`${n} inconnue : ignorée.`);
    }
  }

  // Revalidation : le résultat repasse par la lecture tolérante des artefacts.
  const sortie = lireArtefactsDemo(copie({ ...(depart.motsEcran ? { motsEcran: depart.motsEcran } : {}), ...(pistesTouchees ? { pistes } : {}), ...(style ? { styleSousTitres: style } : {}) }));
  return { artefacts: sortie, remarques };
}
