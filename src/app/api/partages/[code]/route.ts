import { NextResponse } from "next/server";
import { resoudrePartage } from "@/services/partages";

export const dynamic = "force-dynamic";

/**
 * PUBLIC : état d'un lien privé (« ok » ou non), sans compter de vue ni rien révéler d'autre.
 * Utilisé par src/proxy.ts pour répondre 410 sur un lien expiré, révoqué ou inconnu (B.8 #10).
 */
export async function GET(_requete: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const p = await resoudrePartage(code, { compterVue: false });
  return NextResponse.json({ actif: p.etat === "ok", introuvable: p.etat === "introuvable" }, { headers: { "Cache-Control": "no-store" } });
}
