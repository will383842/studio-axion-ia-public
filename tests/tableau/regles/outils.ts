/** Outils des tests des règles du tableau animé (TB-01). */
import { expect } from "vitest";
import type { ProblemeFiche } from "../../../src/briques/fiche-scenes";
import { validerFicheTableau, type ElementTableau, type FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import type { ContexteTableau } from "../../../src/moteurs/montage-tableau/regles";
import { contexteExemple } from "./exemples";

/** Valide avec le contexte des exemples (script recalculé sur la fiche donnée), `extra` en plus. */
export function valider(fiche: unknown, extra: Partial<ContexteTableau> = {}) {
  return validerFicheTableau(fiche, contexteExemple(fiche as FicheTableau, extra));
}

export function accepte(fiche: unknown, extra: Partial<ContexteTableau> = {}): void {
  const r = valider(fiche, extra);
  expect(r.ok ? [] : r.problemes.map((p) => p.message)).toEqual([]);
}

/** Refus : renvoie les problèmes de la règle `nom` ; vérifie qu'il y en a, et (par défaut) qu'aucune autre règle ne refuse. */
export function refuse(fiche: unknown, nom: string, extra: Partial<ContexteTableau> = {}, seule = true): ProblemeFiche[] {
  const r = valider(fiche, extra);
  expect(r.ok).toBe(false);
  const problemes = r.ok ? [] : r.problemes;
  if (seule) expect(problemes.map((p) => p.regle)).toEqual(problemes.map(() => nom));
  const deLaRegle = problemes.filter((p) => p.regle === nom);
  expect(deLaRegle.length).toBeGreaterThan(0);
  for (const p of deLaRegle) {
    expect(p.message).toContain(`règle « ${nom} »`);
    if (p.sceneId) expect(p.message.startsWith(`Scène ${p.sceneId} · `)).toBe(true);
  }
  return deLaRegle;
}

/** Scène `id` de la fiche. */
export function scene(fiche: FicheTableau, id: string) {
  const s = fiche.scenes.find((x) => x.id === id);
  if (!s) throw new Error(`scène ${id} absente`);
  return s;
}

/** Élément `id` de la fiche. */
export function element<T extends ElementTableau["type"]>(fiche: FicheTableau, id: string, type: T): Extract<ElementTableau, { type: T }> {
  const e = fiche.scenes.flatMap((s) => s.elements).find((x) => x.id === id);
  if (!e || e.type !== type) throw new Error(`élément ${id} de type ${type} absent`);
  return e as Extract<ElementTableau, { type: T }>;
}

/** Mesure et mise en page qui font tout tenir : isolent une règle de la place à l'écran. */
export const toutTient = { mesurerLargeur: () => 0, mettreEnPage: () => undefined } satisfies Partial<ContexteTableau>;
