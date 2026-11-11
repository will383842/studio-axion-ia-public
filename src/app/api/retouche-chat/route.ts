import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sessionApi } from "@/services/auth";
import { apercevoirRetouche, appliquerRetouche, revenirAVersion } from "@/services/retouche-chat/service";
import { estGenerateurRetouche } from "@/services/retouche-chat/generateurs";
import { portsGenerateurStudio, retoucheChatActifServeur } from "@/services/retouche-chat/generateurs-studio";
import { portsStudio } from "@/services/retouche-chat/studio";

/**
 * CHAT DE RETOUCHE (lot R1) : `apercu` (comprend la phrase, dit l'impact, n'écrit rien), `appliquer` (re-rend les seules
 * scènes touchées, nouvelle version), `revenir` (retour à une version d'avant). Session exigée. Ports du studio NON
 * branchés par défaut (lecture simple, aucun appel réel, rendu à brancher par chaque générateur) : voir `studio.ts`.
 */
export const dynamic = "force-dynamic";

const schemaCorps = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("apercu"), generateur: z.string().max(40).optional(), videoId: z.string().min(1).max(80), demande: z.string().max(1000) }),
  z.strictObject({ action: z.literal("appliquer"), generateur: z.string().max(40).optional(), videoId: z.string().min(1).max(80), demande: z.string().max(1000), operations: z.array(z.unknown()).max(40) }),
  z.strictObject({ action: z.literal("revenir"), generateur: z.string().max(40).optional(), videoId: z.string().min(1).max(80), versionId: z.string().min(1).max(80) }),
]);

export async function POST(requete: NextRequest) {
  if (!(await sessionApi())) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  const corps = schemaCorps.safeParse(await requete.json().catch(() => null));
  if (!corps.success) return NextResponse.json({ erreur: "Demande illisible." }, { status: 400 });
  const c = corps.data;
  // Lot R3 : un générateur nommé n'est servi que si son réglage `retoucheChat.*` est allumé (éteint par défaut).
  if (c.generateur !== undefined && !estGenerateurRetouche(c.generateur)) return NextResponse.json({ erreur: "Générateur inconnu." }, { status: 400 });
  if (c.generateur !== undefined && !(await retoucheChatActifServeur(c.generateur))) return NextResponse.json({ erreur: "La retouche par chat n'est pas activée pour ce générateur." }, { status: 403 });
  const ports = c.generateur !== undefined ? portsGenerateurStudio(c.generateur) : portsStudio();
  if (c.action === "apercu") return NextResponse.json(await apercevoirRetouche(c.videoId, c.demande, ports));
  if (c.action === "appliquer") return NextResponse.json(await appliquerRetouche(c.videoId, { demande: c.demande, operations: c.operations }, ports));
  await revenirAVersion(c.videoId, c.versionId, ports);
  return NextResponse.json({ statut: "revenue", versionId: c.versionId });
}
