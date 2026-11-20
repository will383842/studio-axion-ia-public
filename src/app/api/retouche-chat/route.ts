import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sessionApi } from "@/services/auth";
import { apercevoirRetouche, appliquerRetouche, revenirAVersion } from "@/services/retouche-chat/service";
import { estGenerateurRetouche } from "@/services/retouche-chat/generateurs";
import { FABRIQUER_PAR_GENERATEUR, STATUT_REFUS_FABRIQUER } from "@/services/retouche-chat/tutoriel-fabriquer";
import { portsGenerateurStudio, retoucheChatActifServeur } from "@/services/retouche-chat/generateurs-studio";
import { portsStudio } from "@/services/retouche-chat/studio";
import { sansGenerateurActif, versionDeLaVideo, videoEnDiffusion } from "@/services/retouche-chat/garde-acces";
import { historiqueVersions, versionARetablir } from "@/services/retouche-chat/historique";
import { depots, lireParametre } from "@/services/_commun";

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
  // G14-04 : liste des versions lue en base (lecture seule) et « rétablir » (refaire) ; rien n'est écrit ni effacé.
  z.strictObject({ action: z.literal("historique"), generateur: z.string().max(40).optional(), videoId: z.string().min(1).max(80) }),
  z.strictObject({ action: z.literal("retablir"), generateur: z.string().max(40).optional(), videoId: z.string().min(1).max(80) }),
  // T-EXT-46b : « fabriquer » la version du plan retouché ; `generateur` OBLIGATOIRE, aucun accord de prix ni autre champ.
  z.strictObject({ action: z.literal("fabriquer"), generateur: z.string().max(40), videoId: z.string().min(1).max(80), demande: z.string().max(1000), plan: z.unknown() }),
]);

export async function POST(requete: NextRequest) {
  if (!(await sessionApi())) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  const corps = schemaCorps.safeParse(await requete.json().catch(() => null));
  if (!corps.success) return NextResponse.json({ erreur: "Demande illisible." }, { status: 400 });
  const c = corps.data;
  // Lot R3 : un générateur nommé n'est servi que si son réglage `retoucheChat.*` est allumé (éteint par défaut).
  if (c.generateur !== undefined && !estGenerateurRetouche(c.generateur)) return NextResponse.json({ erreur: "Générateur inconnu." }, { status: 400 });
  if (c.generateur !== undefined && !(await retoucheChatActifServeur(c.generateur))) return NextResponse.json({ erreur: "La retouche par chat n'est pas activée pour ce générateur." }, { status: 403 });
  // C7-02 : sans générateur nommé, la voie reste fermée (403) tant que `retoucheChat.sansGenerateur` n'est pas `true`.
  if (c.generateur === undefined && !(await sansGenerateurActif((id, defaut) => lireParametre<unknown>(id, defaut)))) return NextResponse.json({ erreur: "La retouche par chat n'est pas activée." }, { status: 403 });
  // C7-02 : `revenir` ne vise qu'une version de la même vidéo (avant tout port).
  if (c.action === "revenir" && !(await versionDeLaVideo(c.videoId, c.versionId, (id) => depots().versions.obtenir(id)))) return NextResponse.json({ erreur: "Cette version n'appartient pas à cette vidéo." }, { status: 404 });
  // N-22 : une vidéo programmée ou publiée ne se retouche pas (`appliquer`, `revenir`, `retablir`) ; `apercu` et `historique` n'écrivent rien.
  if ((c.action === "revenir" || c.action === "appliquer" || c.action === "retablir" || c.action === "fabriquer") && (await videoEnDiffusion(c.videoId, (id) => depots().videos.obtenir(id)))) return NextResponse.json({ erreur: "Cette vidéo est programmée ou publiée : elle ne se retouche pas ici." }, { status: 409 });
  // T-EXT-46b (SENSIBLE ARGENT) : action COMMUNE, table FERMÉE par générateur (le tutoriel seul) ; mêmes gardes que `appliquer`
  // ci-dessus (session, réglage du générateur, N-22). Les refus du fabricant tombent avant toute réservation.
  if (c.action === "fabriquer") {
    const fabricant = Object.hasOwn(FABRIQUER_PAR_GENERATEUR, c.generateur) ? FABRIQUER_PAR_GENERATEUR[c.generateur] : undefined;
    if (!fabricant) return NextResponse.json({ erreur: "La fabrication depuis le chat n'est pas encore branchée pour ce générateur." }, { status: 409 });
    const issue = await fabricant(c.videoId, c.plan, c.demande);
    if (issue.statut === "refusee") return NextResponse.json({ erreur: issue.raison }, { status: STATUT_REFUS_FABRIQUER[issue.motif] });
    return NextResponse.json({ statut: "lancee", travailId: issue.travailId });
  }
  // G14-04 : `historique` lit les seules versions de cette vidéo ; `retablir` en calcule la cible sur ces mêmes versions (C7-02 tenu).
  let cible: string | null = null;
  if (c.action === "historique" || c.action === "retablir") {
    const versions = await depots().versions.lister((x) => x.videoId === c.videoId);
    if (c.action === "historique") return NextResponse.json({ versions: historiqueVersions(versions, c.videoId) });
    const choisie = versions.find((v) => v.choisie);
    cible = choisie ? versionARetablir(versions, choisie.id) : null;
    if (cible === null) return NextResponse.json({ erreur: "Rien à rétablir." }, { status: 409 });
  }
  const ports = c.generateur !== undefined ? portsGenerateurStudio(c.generateur) : portsStudio();
  if (c.action === "apercu") return NextResponse.json(await apercevoirRetouche(c.videoId, c.demande, ports));
  if (c.action === "appliquer") return NextResponse.json(await appliquerRetouche(c.videoId, { demande: c.demande, operations: c.operations }, ports));
  if (c.action === "retablir" && cible !== null) {
    await revenirAVersion(c.videoId, cible, ports);
    return NextResponse.json({ statut: "retablie", versionId: cible });
  }
  if (c.action !== "revenir") return NextResponse.json({ erreur: "Demande illisible." }, { status: 400 });
  await revenirAVersion(c.videoId, c.versionId, ports);
  return NextResponse.json({ statut: "revenue", versionId: c.versionId });
}
