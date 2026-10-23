import type { Metadata } from "next";
import { creationTableauVisible } from "@/services/tableau-creation";
import { lireTraceScriptTableau } from "@/services/tableau-scripts";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { EtatVide } from "@/components/ui/EtatVide";

export const metadata: Metadata = { title: "Trace du script · Tableau animé" };
export const dynamic = "force-dynamic";

/**
 * TRACE D'UN SCRIPT GÉNÉRÉ (tableau animé) : ce que le générateur a fait, en lecture seule. Lien posé dans l'historique
 * de la vidéo par la fabrication. Format masqué : un message simple, rien d'autre n'est lu.
 */
const ISSUES: Record<string, string> = { livre: "script livré", refuse: "script refusé", "en-cours": "écriture en cours", erreur: "arrêtée sur une erreur", interrompu: "interrompue" };

export default async function PageTraceScript({ params }: { params: Promise<{ id: string }> }) {
  if (!creationTableauVisible()) return <EtatVide icone="pinceau" titre="Pas encore ouvert" phrase="Le tableau animé arrive bientôt." />;
  const { id } = await params;
  const t = await lireTraceScriptTableau(decodeURIComponent(id));
  if (!t) return <EtatVide icone="pinceau" titre="Trace introuvable" phrase="Cette trace n'existe pas." />;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <EnTetePage titre="Trace du script" sousTitre={`${new Date(t.date).toLocaleString("fr-FR")} · ${ISSUES[t.issue] ?? t.issue}`} />
      <p className="text-[15px] text-texte">
        {t.note === null ? "Pas de note" : `Note : ${t.note} sur 10`} · {t.appels.length} appel{t.appels.length > 1 ? "s" : ""} · {t.coutUsd.toFixed(2).replace(".", ",")} ${t.simule ? " (essai)" : ""}
      </p>
      {t.erreur && t.motifs.join(" ") !== t.erreur && <p className="text-[15px] text-texte">{t.erreur}</p>}
      {t.motifs.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-[15px] text-texte">
          {t.motifs.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}
      {t.accroches.length > 0 && (
        <ul className="space-y-2">
          {t.accroches.map((a, i) => (
            <li key={i} className={i === t.retenue ? "rounded-2xl border-2 border-orange-vif px-4 py-3" : "rounded-2xl border border-trait px-4 py-3"}>
              <p className="text-[15px] text-texte">{a.dit}</p>
              {i === t.retenue && <p className="text-sm text-texte-doux">Retenue</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
