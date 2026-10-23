import { NextResponse } from "next/server";
import { lireSession } from "@/services/auth";
import { ficheExiste, type TypeFiche } from "@/services/recherche";

export const dynamic = "force-dynamic";

const TYPES: TypeFiche[] = ["videos", "personnages", "scripts", "formats", "bibliotheque", "sujets", "nouvelle", "seances", "lectures"];

/**
 * Une fiche existe-t-elle ? (E2E-1 n° 23) Demandé par src/proxy.ts avant d'afficher /videos/[id], /personnages/[id],
 * /scripts/[id], /formats/[id], /bibliotheque/[type], /ecrire/sujets/[id], /nouvelle/[format], /ecrire/tournage/[id] et
 * /ecrire/sujets/[id]/lire/[variante] : une adresse inconnue reçoit alors un vrai 404.
 * Session exigée ; en cas de doute, « existe » (la page elle-même affiche « Cette page n'existe pas »).
 */
export async function GET(_requete: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;
  if (!(await lireSession())) return NextResponse.json({ existe: true }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!TYPES.includes(type as TypeFiche)) return NextResponse.json({ existe: true }, { headers: { "Cache-Control": "no-store" } });
  const existe = await ficheExiste(type as TypeFiche, decodeURIComponent(id));
  return NextResponse.json({ existe }, { headers: { "Cache-Control": "no-store" } });
}
