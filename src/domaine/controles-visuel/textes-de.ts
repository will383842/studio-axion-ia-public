/** Toutes les chaînes d'un spec avec leur chemin. PUR : parcours générique, utilisable aussi sur une spec non validée. */

export interface TexteDuSpec {
  /** Chemin pointé, ex. « pages.2.cartes.0.titre ». */
  chemin: string;
  texte: string;
  /** Numéro de page (à partir de 1) quand la chaîne est dans une page. */
  page?: number;
}

/** Champs qui désignent un identifiant et non un texte lu : jamais contrôlés ni corrigés. */
const CLES_TECHNIQUES = new Set(["type", "version", "mini", "deco"]);

function pageDuChemin(chemin: string): number | undefined {
  const m = /^pages\.(\d+)(?:\.|$)/.exec(chemin);
  return m ? Number(m[1]) + 1 : undefined;
}

/** Bornes d'un parcours d'entrée non fiable (spec refusée par le schéma) : nombre de chaînes, longueur de chaque chaîne, profondeur. */
export interface BornesTextes {
  chaines: number;
  longueur: number;
  profondeur: number;
}

export function textesDe(spec: unknown, bornes?: BornesTextes): TexteDuSpec[] {
  const res: TexteDuSpec[] = [];
  const marcher = (v: unknown, chemin: string, profondeur: number): void => {
    if (bornes && (res.length >= bornes.chaines || profondeur > bornes.profondeur)) return;
    if (typeof v === "string") {
      res.push({ chemin, texte: bornes ? v.slice(0, bornes.longueur) : v, page: pageDuChemin(chemin) });
    } else if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) {
        if (bornes && res.length >= bornes.chaines) break;
        marcher(v[i], chemin ? `${chemin}.${i}` : String(i), profondeur + 1);
      }
    } else if (v !== null && typeof v === "object") {
      for (const k of Object.keys(v)) {
        if (bornes && res.length >= bornes.chaines) break;
        if (!CLES_TECHNIQUES.has(k)) marcher((v as Record<string, unknown>)[k], chemin ? `${chemin}.${k}` : k, profondeur + 1);
      }
    }
  };
  marcher(spec, "", 0);
  return res;
}

/** Copie de `spec` dont chaque chaîne de `textesDe` est remplacée par `f(texte, chemin)`. */
export function transformerTextes<T>(spec: T, f: (texte: string, chemin: string) => string): T {
  const marcher = (v: unknown, chemin: string): unknown => {
    if (typeof v === "string") return f(v, chemin);
    if (Array.isArray(v)) return v.map((x, i) => marcher(x, chemin ? `${chemin}.${i}` : String(i)));
    if (v !== null && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, CLES_TECHNIQUES.has(k) ? x : marcher(x, chemin ? `${chemin}.${k}` : k)]));
    }
    return v;
  };
  return marcher(spec, "") as T;
}
