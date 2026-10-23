"use client";

/**
 * ÉCRAN 3 · LE SCRIPT, dans l'écran commun « Relire le script » (réglage `imageVideo.relireScript`, éteint par défaut :
 * l'ancien `ScriptEcrans` reste le parcours tant qu'il n'est pas allumé). Comme le tableau et le cas concret : une carte
 * par phrase, contrôles en direct GRATUITS (les mêmes que la validation), socle qualité commun en observation, prix sur
 * le bouton et confirmé avant toute dépense. Gardés d'à côté, inchangés : le choix de l'accroche, les formules trop
 * affirmatives (le bouton attend que chacune soit tranchée) et la recette de variété (`RecetteVariete`).
 */
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { controlerScriptImageVideoAction, validerScriptImageVideoAction } from "@/app/(studio)/image-video/actions";
import { RelireScript } from "@/components/script/RelireScript";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { notifier } from "@/components/ui/Toast";
import type { AxeVariete, RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { FicheImage } from "@/domaine/image-video/fiche";
import type { PastilleControle, ResultatLancement, ScriptRelu } from "@/domaine/relecture-script";
import { cn } from "@/lib/cn";
import type { FormuleATrancherIV, PrixIV } from "@/moteurs/montage-image-video/fabrication";
import { RecetteVariete } from "./RecetteVariete";
import { jusquALaReprise } from "./reprise";
import { lignesRelireIV, modificationsDesLignesIV, observerIV } from "./relire";
import { changementsVarieteIV, euros, formulesNonTranchees, lignesVarieteIV, scriptValideParWill } from "./vue";

const VERIFICATION_INDISPONIBLE: PastilleControle[] = [{ niveau: "alerte", texte: "Vérification indisponible. Elle sera refaite à la validation." }];

export function ScriptRelireIV({
  videoId,
  fiche,
  formules,
  aTrancher,
  prix,
  avecQuestion,
  variete,
}: {
  videoId: string;
  fiche: FicheImage;
  formules: FormuleATrancherIV[];
  aTrancher: string[];
  prix: PrixIV;
  avecQuestion: boolean;
  variete?: { recette: RecetteVarieteIV; possibles: Record<AxeVariete, string[]> };
}) {
  const router = useRouter();
  const [autreAccroche, setAutreAccroche] = useState(false);
  const [choix, setChoix] = useState<Record<string, "garder" | "reformuler">>({});
  const [changes, setChanges] = useState<Partial<RecetteVarieteIV>>({});
  const montant = Math.max(prix.auPlusCentimes, prix.habituelCentimes);
  // La fiche relue part de l'accroche choisie : changer d'accroche repart du texte proposé (l'écran se recrée).
  const base = useMemo(() => (autreAccroche ? (scriptValideParWill(fiche, [], { ecrans: {}, formules: {}, autreAccroche: true }).fiche ?? fiche) : fiche), [fiche, autreAccroche]);
  const depart = useMemo(() => lignesRelireIV(base, avecQuestion), [base, avecQuestion]);
  const ouvertes = formulesNonTranchees(formules, { formules: choix });
  const [a, b] = fiche.accroches;

  const decisionDe = useCallback(
    (s: ScriptRelu) => scriptValideParWill(fiche, formules, { ...modificationsDesLignesIV(depart, s.lignes), formules: choix, ...(autreAccroche ? { autreAccroche } : {}) }),
    [fiche, formules, depart, choix, autreAccroche],
  );

  const controler = useCallback(
    async (s: ScriptRelu): Promise<PastilleControle[]> => {
      const { fiche: modifiee, choixFormules, ajoutsWill } = decisionDe(s);
      const r = await controlerScriptImageVideoAction(videoId, { ...(modifiee ? { fiche: modifiee } : {}), choixFormules, ajoutsWill });
      return r.ok ? r.donnees : VERIFICATION_INDISPONIBLE;
    },
    [videoId, decisionDe],
  );

  const lancer = useCallback(
    async (s: ScriptRelu, accord: number | true): Promise<ResultatLancement> => {
      if (typeof accord !== "number") return { ok: false, message: "Le prix n'a pas été confirmé. Rien n'a été payé." };
      const choixVariete = variete ? changementsVarieteIV(variete.recette, changes) : undefined;
      const r = await validerScriptImageVideoAction(videoId, { ...decisionDe(s), ...(choixVariete ? { variete: choixVariete } : {}) }, accord);
      if (!r.ok) return { ok: false, message: r.message };
      const fin = await jusquALaReprise(videoId, r.donnees);
      if (fin) return { ok: false, message: fin };
      notifier.succes("Script validé : la vidéo se fabrique");
      return { ok: true };
    },
    [videoId, decisionDe, variete, changes],
  );

  return (
    <section aria-label="Le script" className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-semibold text-texte-doux">L&apos;accroche</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[a, b].map((x, i) => {
            const choisie = (i === 1) === autreAccroche;
            return (
              <button key={i} type="button" aria-pressed={choisie} onClick={() => setAutreAccroche(i === 1)} className={cn("min-h-11 rounded-carte border-2 p-3 text-left", choisie ? "border-orange bg-orange-doux" : "border-trait bg-surface-1")}>
                <span className="block text-[15px] text-texte">« {x.texteDit} »</span>
              </button>
            );
          })}
        </div>
      </div>

      <RelireScript
        key={autreAccroche ? "accroche-b" : "accroche-a"}
        lignes={depart}
        controler={controler}
        lancer={lancer}
        prixCentimes={montant}
        libelleLancer={`Valider et fabriquer (au plus ${euros(montant)})`}
        iconeLancer="film"
        bloque={ouvertes.length ? `Tranchez d'abord ${ouvertes.length > 1 ? `les ${ouvertes.length} phrases trop affirmatives` : "la phrase trop affirmative"}.` : null}
        observation={observerIV(base, avecQuestion)}
        apresLancement={() => router.refresh()}
      />

      {formules.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-texte-doux">Trop affirmatif ?</p>
          {formules.map((f) => (
            <Carte key={f.cle} className={cn(!choix[f.cle] && "border-ambre")}>
              <p className="text-[15px] text-texte">« {f.texte} »</p>
              <p className="mb-2 text-sm text-texte-doux">Version prudente : « {f.proposition} »</p>
              <div className="flex flex-wrap gap-2">
                <Bouton variante={choix[f.cle] === "garder" ? "principal" : "secondaire"} aria-pressed={choix[f.cle] === "garder"} onClick={() => setChoix((v) => ({ ...v, [f.cle]: "garder" }))}>
                  Garder
                </Bouton>
                <Bouton variante={choix[f.cle] === "reformuler" ? "principal" : "secondaire"} aria-pressed={choix[f.cle] === "reformuler"} onClick={() => setChoix((v) => ({ ...v, [f.cle]: "reformuler" }))}>
                  Version prudente
                </Bouton>
              </div>
              {choix[f.cle] === "reformuler" && <p className="mt-2 text-sm text-texte">Le script dira : « {f.proposition} »</p>}
            </Carte>
          ))}
        </div>
      )}

      {variete && <RecetteVariete lignes={lignesVarieteIV(variete.recette, variete.possibles, changes)} onChanger={(axe, code) => setChanges((v) => ({ ...v, [axe]: code }))} />}

      {aTrancher.length > 0 && (
        <ul className="space-y-1 rounded-carte bg-ambre-doux p-3 text-sm text-texte">
          {aTrancher.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
