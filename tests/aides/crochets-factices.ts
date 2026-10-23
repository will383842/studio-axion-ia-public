/**
 * Mini-moteur de crochets React SANS DOM (le dépôt n'a ni jsdom ni testing-library) : un composant client est appelé
 * comme une fonction, ses `useState` sont gardés d'un rendu à l'autre, les effets ne tournent pas. Le test lit l'arbre
 * rendu (éléments, props) et appelle lui-même un `onClick` / `onChange`, puis rend à nouveau.
 * Emploi : `vi.mock("react", async (o) => ({ ...(await o<typeof import("react")>()), ...(await import("../aides/crochets-factices")).crochets }))`.
 */
import type { ReactElement, ReactNode } from "react";

let etats: unknown[] = [];
let curseur = 0;

export const crochets = {
  useState<T>(init: T | (() => T)) {
    const i = curseur++;
    if (!(i in etats)) etats[i] = typeof init === "function" ? (init as () => T)() : init;
    const changer = (v: T | ((x: T) => T)) => {
      etats[i] = typeof v === "function" ? (v as (x: T) => T)(etats[i] as T) : v;
    };
    return [etats[i] as T, changer] as const;
  },
  useRef<T>(v: T) {
    const i = curseur++;
    if (!(i in etats)) etats[i] = { current: v };
    return etats[i] as { current: T };
  },
  useMemo: <T>(f: () => T) => f(),
  useCallback: <T>(f: T) => f,
  useEffect: () => undefined,
  useTransition: () => [false, (f: () => unknown) => void f()] as const,
};

/** Monte un composant : `rendre()` le rend avec l'état gardé (premier appel : état neuf). */
export function monter<P>(Composant: (p: P) => ReactNode, props: P) {
  etats = [];
  return { rendre: () => ((curseur = 0), Composant(props)) };
}

const estElement = (n: unknown): n is ReactElement<Record<string, unknown>> => !!n && typeof n === "object" && "props" in n && "type" in n;

/** Les éléments de l'arbre (sans rendre les composants enfants) qui passent le test. */
export function trouver(n: ReactNode, test: (e: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(n)) return n.flatMap((x) => trouver(x as ReactNode, test));
  if (!estElement(n)) return [];
  return [...(test(n) ? [n] : []), ...trouver(n.props.children as ReactNode, test)];
}

/** Le texte écrit d'un élément (ses enfants texte, mis bout à bout). */
export function texteDe(n: ReactNode): string {
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map((x) => texteDe(x as ReactNode)).join("");
  return estElement(n) ? texteDe(n.props.children as ReactNode) : "";
}

/** Laisse finir les promesses en cours (clic asynchrone). */
export const attendre = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};
