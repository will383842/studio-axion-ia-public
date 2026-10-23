"use client";

/**
 * VALIDATION DU SCRIPT (tâche V4-3, point 5 ; modification sur place demandée par Will le 14/10 ; brique 3 : l'écran
 * COMMUN `RelireScript`). Un cas sans script validé : Claude écrit, la fiche est relue, puis la fabrication s'arrête AVANT
 * la voix (aucune dépense de voix ; l'étape s'affiche « À relire »). Will lit le texte dit et l'ordre des écrans, puis :
 *   - touche une phrase pour la modifier, avec ses textes affichés (sauf le chiffre tiré d'un fait du cas, verrouillé) ;
 *     les modifications sont contrôlées en direct (gratuit), puis repassent TOUS les contrôles avant d'être gardées ;
 *   - « Valider ce script » : il devient le script validé du cas (rejoué mot pour mot ensuite), et la fabrication
 *     reprend tout de suite (relance de l'étape, sans nouvel appel d'écriture) ;
 *   - « Faire réécrire » : reprendre le cas (un nouveau script sera écrit).
 * Seules les différences partent (`modificationsDesDifferences`).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { controlerScriptAValiderAction, validerScriptAction } from "@/app/(studio)/cas-concret/actions";
import { RelireScript } from "@/components/script/RelireScript";
import { Bouton } from "@/components/ui/Bouton";
import { notifier } from "@/components/ui/Toast";
import type { PastilleControle, ResultatLancement, ScriptRelu } from "@/domaine/relecture-script";
import { lignesDesEcrans, modificationsDesDifferences } from "@/moteurs/montage-cas-concret/relecture";
import type { EcranApercu } from "@/moteurs/montage-cas-concret/script-valide";
import { ADRESSE_RELANCE, lireIssue, PHRASES_ECRAN_RELANCE } from "./relance";

const VERIFICATION_INDISPONIBLE: PastilleControle[] = [{ niveau: "alerte", texte: "Vérification indisponible. Elle sera refaite à la validation." }];

export function ValidationScript({ videoId, travailId, ecrans, avertissements = [] }: { videoId: string; travailId: string; ecrans: readonly EcranApercu[]; avertissements?: readonly { rang: number; detail: string }[] }) {
  const router = useRouter();
  const lignes = useMemo(() => lignesDesEcrans(ecrans), [ecrans]);

  const controler = useCallback(
    async (s: ScriptRelu): Promise<PastilleControle[]> => {
      const r = await controlerScriptAValiderAction(videoId, modificationsDesDifferences(s.modifications));
      return r.ok ? r.donnees : VERIFICATION_INDISPONIBLE;
    },
    [videoId],
  );

  const lancer = useCallback(
    async (s: ScriptRelu): Promise<ResultatLancement> => {
      const modifications = modificationsDesDifferences(s.modifications);
      const r = await validerScriptAction(videoId, modifications);
      if (!r.ok) return { ok: false, message: r.message };
      try {
        const reponse = await fetch(ADRESSE_RELANCE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ travailId }), cache: "no-store" });
        const issue = lireIssue(await reponse.json().catch(() => null));
        if (issue.statut !== "relancee") return { ok: false, message: `Script validé. ${issue.statut === "refusee" ? issue.phrase : "Relancez l'étape pour fabriquer la vidéo."}` };
      } catch {
        return { ok: false, message: PHRASES_ECRAN_RELANCE.injoignable };
      }
      notifier.succes(modifications.length ? "Script modifié et validé : la vidéo se fabrique" : "Script validé : la vidéo se fabrique");
      return { ok: true };
    },
    [videoId, travailId],
  );

  return (
    <section aria-label="Le script à valider" className="mt-4 space-y-3">
      <h3 className="text-sm font-semibold text-texte-doux">Le script à valider : texte dit et ordre des écrans</h3>
      <p className="text-sm text-texte-faible">Aucune voix n&apos;est payée tant que vous n&apos;avez pas validé ce script.</p>
      <p className="text-sm text-texte-doux">Modifier le script : touchez une phrase.</p>
      {avertissements.length > 0 && (
        <div role="note" aria-label="L'image ne suit pas toujours la parole" className="space-y-1 rounded-carte border border-trait bg-surface-2 p-3 text-sm">
          <p className="font-semibold text-texte">À regarder avant de valider : l&apos;image ne suit pas toujours la parole</p>
          <ul className="list-disc space-y-1 pl-5 text-texte-doux">
            {avertissements.map((a, i) => (
              <li key={i}>
                Écran {a.rang} : {a.detail}
              </li>
            ))}
          </ul>
          <p className="text-texte-faible">Vous pouvez valider quand même, ou modifier le script.</p>
        </div>
      )}
      <RelireScript lignes={lignes} controler={controler} lancer={lancer} libelleLancer={(n) => (n ? "Valider le script modifié" : "Valider ce script")} apresLancement={() => router.refresh()} />
      <Bouton asChild variante="fantome" icone="ecrire">
        <Link href="/cas-concret">Faire réécrire</Link>
      </Bouton>
    </section>
  );
}
