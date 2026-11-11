import { ChatRetouche } from "@/components/retouche-chat/ChatRetouche";
import { estGenerateurRetouche } from "@/services/retouche-chat/generateurs";
import { retoucheChatActifServeur } from "@/services/retouche-chat/generateurs-studio";

/**
 * CHAT DE RETOUCHE D'UN GÉNÉRATEUR (lot R3) — posé sur l'écran résultat d'Avocat, d'Image → vidéo et de Facecam animée.
 * Réglage `retoucheChat.*` ÉTEINT par défaut : éteint (ou format inconnu), rien n'est rendu et la page ne change pas.
 */
export async function RetoucheChatGenerateur({ videoId, formatId, versionId }: { videoId: string; formatId: string; versionId?: string }) {
  if (!estGenerateurRetouche(formatId) || !(await retoucheChatActifServeur(formatId))) return null;
  return (
    <section aria-labelledby={`retoucher-${videoId}`} className="space-y-3">
      <h2 id={`retoucher-${videoId}`} className="text-xs font-bold uppercase tracking-wider text-texte-faible">
        Retoucher par message
      </h2>
      <ChatRetouche videoId={videoId} generateur={formatId} {...(versionId ? { versionInitialeId: versionId } : {})} />
    </section>
  );
}
