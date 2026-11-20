/**
 * GARDE DES VALEURS D'UN PLAN DE SCÈNES (G4-12) — les pièces de données (graphique, tableau de bord,
 * carte KPI, compteur, jauge, barres, avant/après, courbe à plusieurs séries (G4-11, pas encore inscrite)) ne montrent que des nombres de la donnée jointe.
 * Pure : aucun accès disque ou réseau. Ne retire ni ne remplace rien : elle rend le verdict, le moteur (G4-09) décide.
 * Rien dans `src/` ne l'importe encore. Donnée absente = ok, sans rien lire (comportement d'aujourd'hui).
 * N'ajoute aucun `case` à `plan-scenes/controles.ts` : ce fichier ne change donc le sort d'aucun plan existant.
 */
import { memeValeur, nombresAffirmes } from "../../domaine/nombres-fr";
import type { PlanDeScenes } from "../plan-scenes/schema";
import { nombresPermis } from "./garde-chiffres";
import type { TableauDeBord } from "./types";

export interface FautePlanScenes {
  sceneId: string;
  piece: string;
  valeur: number | string;
}

export interface VerdictPlanScenes {
  ok: boolean;
  fautes: FautePlanScenes[];
}

const estObjet = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const liste = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(estObjet) : []);

/** Valeurs numériques et textes à contrôler dans une pièce de données ; `null` pour les autres pièces. */
function aControler(piece: string, p: Record<string, unknown>): { nombres: unknown[]; textes: unknown[] } | null {
  switch (piece) {
    case "graphique":
      return { nombres: liste(p.valeurs).map((v) => v.valeur), textes: [p.titre, ...liste(p.valeurs).map((v) => v.libelle)] };
    case "tableau-de-bord":
      return {
        nombres: Array.isArray(p.serie) ? p.serie : [],
        textes: [p.titre, ...liste(p.kpis).flatMap((k) => [k.libelle, k.valeur])],
      };
    case "carte-kpi":
      return { nombres: [p.valeur], textes: [p.libelle, p.variation] };
    case "compteur":
    case "jauge":
      return { nombres: [p.valeur], textes: [p.libelle] };
    case "barres":
      return { nombres: liste(p.barres).map((b) => b.valeur), textes: liste(p.barres).map((b) => b.libelle) };
    case "avant-apres":
      return { nombres: [estObjet(p.avant) ? p.avant.valeur : undefined, estObjet(p.apres) ? p.apres.valeur : undefined], textes: [p.titre] };
    case "courbe-series":
      return {
        nombres: liste(p.series).flatMap((s) => (Array.isArray(s.valeurs) ? s.valeurs : [])),
        textes: [p.titre, ...(Array.isArray(p.abscisses) ? p.abscisses : []), ...liste(p.series).map((s) => s.nom)],
      };
    default:
      return null;
  }
}

export function garderPlanScenes(plan: Pick<PlanDeScenes, "scenes">, donnee?: TableauDeBord): VerdictPlanScenes {
  if (!donnee) return { ok: true, fautes: [] };
  const permis = nombresPermis(donnee);
  const autorise = (n: number) => permis.some((p) => memeValeur(p, n));
  const fautes: FautePlanScenes[] = [];

  const verifier = (sceneId: string, piece: string, parametres: unknown) => {
    const c = aControler(piece, estObjet(parametres) ? parametres : {});
    if (!c) return;
    for (const v of c.nombres) {
      if (typeof v === "number" && Number.isFinite(v) && !autorise(v)) fautes.push({ sceneId, piece, valeur: v });
    }
    for (const t of c.textes) {
      if (typeof t !== "string") continue;
      for (const n of nombresAffirmes(t)) if (!autorise(n.valeur)) fautes.push({ sceneId, piece, valeur: n.valeur });
    }
  };

  for (const scene of plan.scenes) {
    verifier(scene.id, scene.piece, scene.parametres);
    for (const calque of scene.calques ?? []) verifier(scene.id, calque.piece, calque.parametres);
  }
  return { ok: fautes.length === 0, fautes };
}
