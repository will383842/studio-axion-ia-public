// Versions du 1er message que le FAUX site de ces tests accepte (les tests du parcours avec lien en ont besoin : le vrai fichier
// `versions-acceptees-site.ts` n'y met que ce que le vrai site connaît). Utilisé par un `vi.mock` dans chaque fichier concerné.
// Ensemble gardé sur `globalThis` : le `vi.mock` et le test partagent ainsi la même instance, même si le module est rechargé.
const g = globalThis as unknown as { __versionsSiteTest?: Set<string> };
export const VERSIONS_SITE_TEST: Set<string> = (g.__versionsSiteTest ??= new Set<string>(["mp-m1-v3", "mp-m1-v4-1", "mp-m1-v4-2", "mp-m1-v4-3", "mp-m1-v4-4"]));
