/**
 * Cache des scènes rendues : taille par vidéo et clés encore référencées. LECTURE SEULE.
 * Ports injectés (aucun appel réel). Ne lève jamais. L'effacement relève d'une autre fiche, après confirmation.
 */
export type VersionLue = { id: string; projetMontage?: unknown };
export type ObjetStocke = { cle: string; octets: number };
export type PortsCacheScenes = {
  lireVersions: (videoId: string) => Promise<VersionLue[]>;
  listerObjets: (prefixe: string) => Promise<ObjetStocke[]>;
};
export type ObjetCache = { cle: string; octets: number; referencee: boolean; versions: string[] };
export type EtatCacheScenes = { octetsTotal: number; objets: ObjetCache[]; octetsLiberables: number };
export type ResultatCacheScenes = EtatCacheScenes | { etat: null; raison: string };

function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Toutes les clés lues sous `rendu` et `scenes` de retoucheChat (champs `fichierCle`/`*Cle`, listes `cles`). */
function clesDe(valeur: unknown, sortie: Set<string>, profondeur = 0): void {
  if (profondeur > 8) return;
  if (Array.isArray(valeur)) {
    for (const x of valeur) clesDe(x, sortie, profondeur + 1);
    return;
  }
  if (!estObjet(valeur)) return;
  for (const [k, v] of Object.entries(valeur)) {
    if (typeof v === "string" && /cle$/i.test(k) && v) sortie.add(v);
    else if (Array.isArray(v) && /^cles$/i.test(k)) v.forEach((x) => typeof x === "string" && x && sortie.add(x));
    else clesDe(v, sortie, profondeur + 1);
  }
}

export function clesReferencees(projetMontage: unknown): string[] {
  const rc = estObjet(projetMontage) && estObjet(projetMontage.retoucheChat) ? projetMontage.retoucheChat : null;
  if (!rc) return [];
  const s = new Set<string>();
  clesDe(rc.rendu, s);
  clesDe(rc.scenes, s);
  return [...s];
}

export async function etatCacheScenes(videoId: string, ports: PortsCacheScenes, prefixe: string): Promise<ResultatCacheScenes> {
  try {
    const [versions, stockes] = await Promise.all([ports.lireVersions(videoId), ports.listerObjets(prefixe)]);
    const parCle = new Map<string, string[]>();
    for (const v of versions) for (const c of clesReferencees(v.projetMontage)) parCle.set(c, [...(parCle.get(c) ?? []), v.id]);
    const objets = stockes.map((o) => {
      const vs = parCle.get(o.cle) ?? [];
      return { cle: o.cle, octets: o.octets, referencee: vs.length > 0, versions: vs };
    });
    return {
      octetsTotal: objets.reduce((t, o) => t + o.octets, 0),
      objets,
      octetsLiberables: objets.filter((o) => !o.referencee).reduce((t, o) => t + o.octets, 0),
    };
  } catch (e) {
    return { etat: null, raison: e instanceof Error ? e.message : String(e) };
  }
}
