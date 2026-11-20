/**
 * RACCORD DU PLAN DE SCÈNES DE LA DÉMO FACE CAMÉRA (G3-10-v20e) : branche `demo-facecam-claude.ts` sur le moteur
 * `montage-demo-facecam` (pur, il n'importe jamais un service). Chargé pour son effet par la boucle de fond.
 * ÉTEINT par défaut : `planClaudeActif` lit `demoFacecam.planClaude` ; sans `true` exact, la chaîne garde le plan simple.
 */
import "server-only";
import { brancherServicesDemoFacecam } from "@/moteurs/montage-demo-facecam/dependances";
import { appelClaudePlanDemo, planClaudeDemoActif } from "./demo-facecam-claude";

brancherServicesDemoFacecam({
  appelerPlan: (c) => appelClaudePlanDemo(c.videoId, c.origine),
  planClaudeActif: () => planClaudeDemoActif(),
});
