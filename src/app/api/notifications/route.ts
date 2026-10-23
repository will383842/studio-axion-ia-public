import { NextResponse } from "next/server";
import { sessionApi } from "@/services/auth";
import { compterNonLues, listerNotifications } from "@/services/notifications";

export const dynamic = "force-dynamic";

/** Cloche de l'en-tête : dernières notifications + nombre de non lues. */
export async function GET() {
  if (!(await sessionApi())) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  const [notifications, nonLues] = await Promise.all([listerNotifications(20), compterNonLues()]);
  return NextResponse.json({ notifications, nonLues }, { headers: { "Cache-Control": "no-store" } });
}
