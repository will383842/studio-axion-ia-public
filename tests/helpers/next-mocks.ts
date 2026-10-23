/**
 * Doublures de next/headers et next/navigation pour tester les services hors de Next.
 * Le magasin de cookies et les en-têtes sont réinitialisables entre deux tests.
 */
export const etatRequete = {
  cookies: new Map<string, string>(),
  entetes: new Map<string, string>([["user-agent", "Mozilla/5.0 (iPhone)"], ["x-forwarded-for", "10.0.0.1"]]),
};

export function reinitialiserRequete(ip = "10.0.0.1") {
  etatRequete.cookies.clear();
  etatRequete.entetes.set("x-forwarded-for", ip);
}

export const mockHeaders = {
  cookies: async () => ({
    get: (nom: string) => (etatRequete.cookies.has(nom) ? { name: nom, value: etatRequete.cookies.get(nom)! } : undefined),
    set: (nom: string, valeur: string) => void etatRequete.cookies.set(nom, valeur),
    delete: (nom: string) => void etatRequete.cookies.delete(nom),
  }),
  headers: async () => ({ get: (nom: string) => etatRequete.entetes.get(nom.toLowerCase()) ?? null }),
};

export class Redirection extends Error {
  digest: string;
  constructor(public readonly vers: string) {
    super(`REDIRECT ${vers}`);
    this.digest = `NEXT_REDIRECT;${vers}`;
  }
}

export const mockNavigation = {
  redirect: (vers: string) => {
    throw new Redirection(vers);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
};
