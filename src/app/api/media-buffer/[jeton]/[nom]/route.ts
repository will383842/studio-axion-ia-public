import { servirRelaisBuffer } from "@/services/relais-buffer";

export const dynamic = "force-dynamic";

/**
 * PUBLIC (exempté de la session dans src/proxy.ts) mais protégé par un jeton signé dans l'adresse : c'est Buffer qui l'appelle.
 * Jeton faux, expiré ou illisible, fichier inconnu ou de démonstration : 404 identique.
 */
type Contexte = { params: Promise<{ jeton: string; nom: string }> };

export async function GET(requete: Request, { params }: Contexte) {
  const { jeton, nom } = await params;
  return servirRelaisBuffer("GET", jeton, nom, requete.headers.get("range"), requete.signal);
}

export async function HEAD(requete: Request, { params }: Contexte) {
  const { jeton, nom } = await params;
  return servirRelaisBuffer("HEAD", jeton, nom, null, requete.signal);
}
