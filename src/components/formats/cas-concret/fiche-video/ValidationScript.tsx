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
import { useCallback, useMemo, useState } from "react";
import { controlerScriptAValiderAction, validerScriptAction } from "@/app/(studio)/cas-concret/actions";
import { RelireScript } from "@/components/script/RelireScript";
import { Bouton } from "@/components/ui/Bouton";
import { notifier } from "@/components/ui/Toast";
import { ACTIONS_FABRICATION } from "@/domaine/libelles";
import type { PastilleControle, ResultatLancement, ScriptRelu } from "@/domaine/relecture-script";
import { lignesDesEcrans, modificationsDesDifferences } from "@/moteurs/montage-cas-concret/relecture";
import type { EcranApercu } from "@/moteurs/montage-cas-concret/script-valide";
import { ADRESSE_RELANCE, lireIssue, PHRASES_ECRAN_RELANCE, type IssueRelanceEcran } from "./relance";

/** GV2-20 : « Utiliser mon script » (action serveur branchée par la page) : pose le script fourni puis relance. */
export type UtiliserMonScript = (videoId: string) => Promise<{ ok: true; issue: IssueRelanceEcran } | { ok: false; message: string }>;

const VERIFICATION_INDISPONIBLE: PastilleControle[] = [{ niveau: "alerte", texte: "Vérification indisponible. Elle sera refaite à la validation." }];

export function ValidationScript({ videoId, travailId, ecrans, avertissements = [], scriptFourniPlusRecent = false, utiliserMonScript }: { videoId: string; travailId: string; ecrans: readonly EcranApercu[]; avertissements?: readonly { rang: number; detail: string }[]; scriptFourniPlusRecent?: boolean; utiliserMonScript?: UtiliserMonScript }) {
  const router = useRouter();
  /** GV2-20 : le script est validé mais la relance a été refusée : la raison, et le bouton « Reprendre cette étape ». */
  const [refusRelance, setRefusRelance] = useState<string | null>(null);
  const [enAttente, setEnAttente] = useState(false);
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
        if (issue.statut !== "relancee") {
          const raison = issue.statut === "refusee" ? issue.phrase : "Relancez l'étape pour fabriquer la vidéo.";
          setRefusRelance(raison);
          return { ok: false, message: `Script validé. ${raison}` };
        }
      } catch {
        return { ok: false, message: PHRASES_ECRAN_RELANCE.injoignable };
      }
      notifier.succes(modifications.length ? "Script modifié et validé : la vidéo se fabrique" : "Script validé : la vidéo se fabrique");
      return { ok: true };
    },
    [videoId, travailId],
  );

  /** « Relancer » : rappelle la relance existante (même adresse), sans rien revalider. */
  const relancer = useCallback(async () => {
    if (enAttente) return;
    setEnAttente(true);
    try {
      const reponse = await fetch(ADRESSE_RELANCE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ travailId }), cache: "no-store" });
      const issue = lireIssue(await reponse.json().catch(() => null));
      if (issue.statut === "relancee") {
        setRefusRelance(null);
        notifier.succes("Relance envoyée : la vidéo se fabrique");
        router.refresh();
      } else setRefusRelance(issue.phrase);
    } catch {
      setRefusRelance(PHRASES_ECRAN_RELANCE.injoignable);
    } finally {
      setEnAttente(false);
    }
  }, [enAttente, router, travailId]);

  /** « Utiliser mon script » : le script fourni plus récent devient celui de la vidéo, puis la relance part. */
  const utiliser = useCallback(async () => {
    if (!utiliserMonScript || enAttente) return;
    setEnAttente(true);
    try {
      const r = await utiliserMonScript(videoId);
      if (!r.ok) return setRefusRelance(r.message);
      if (r.issue.statut === "relancee") {
        setRefusRelance(null);
        notifier.succes("Votre script est validé : la vidéo se fabrique");
        router.refresh();
      } else setRefusRelance(`Votre script est validé. ${r.issue.phrase}`);
    } catch {
      setRefusRelance(PHRASES_ECRAN_RELANCE.injoignable);
    } finally {
      setEnAttente(false);
    }
  }, [enAttente, router, utiliserMonScript, videoId]);

  return (
    <section id="valider-script" aria-label="Le script à valider" className="mt-4 space-y-3">
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
      {scriptFourniPlusRecent && utiliserMonScript && (
        <Bouton variante="secondaire" icone="ecrire" onClick={() => void utiliser()} chargement={enAttente}>
          Utiliser mon script
        </Bouton>
      )}
      {refusRelance && (
        <div role="alert" className="space-y-2 text-sm text-brique">
          <p>{refusRelance}</p>
          <Bouton variante="secondaire" icone="reessayer" onClick={() => void relancer()} chargement={enAttente}>
            {ACTIONS_FABRICATION.reprendreEtape}
          </Bouton>
        </div>
      )}
      <Bouton asChild variante="fantome" icone="ecrire">
        <Link href="/cas-concret">Faire réécrire</Link>
      </Bouton>
    </section>
  );
}
