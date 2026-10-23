"use client";

/**
 * ÉCRAN 3 · LE SCRIPT (lot L16, plan § 8, décisions B3 et B7). Une ligne par écran : ce qui est dit, ce qui est écrit
 * (le mot orange en orange), ce qui s'anime. Deux accroches au choix, la question de commentaire modifiable, les phrases
 * trop affirmatives surlignées avec « Garder » ou « Version prudente ». Modification en place (même logique que la
 * validation du cas concret : seules les différences partent). Le prix de la suite est sur le bouton : la voix n'est
 * payée qu'après « Valider et fabriquer » et la confirmation de ce prix. La recette de variété (lot F) est montrée
 * avant le bouton : Will peut en changer un axe, sauf le déroulé (déjà dans le script).
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { validerScriptImageVideoAction } from "@/app/(studio)/image-video/actions";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { confirmerPrix } from "@/components/ui/ConfirmationPrix";
import { Icone } from "@/components/ui/Icone";
import { Pastille } from "@/components/ui/Pastille";
import { notifier } from "@/components/ui/Toast";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import type { AxeVariete, RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { FicheImage } from "@/domaine/image-video/fiche";
import { cn } from "@/lib/cn";
import type { FormuleATrancherIV, PrixIV } from "@/moteurs/montage-image-video/fabrication";
import { RecetteVariete } from "./RecetteVariete";
import { jusquALaReprise } from "./reprise";
import { AUCUNE_MODIFICATION, changementsVarieteIV, euros, formulesNonTranchees, lignesDuScript, lignesVarieteIV, morceauxEcrit, phrasePrix, scriptValideParWill, type ModificationsScript } from "./vue";

function Ecrit({ t }: { t: string }) {
  return (
    <span className="font-titre uppercase">
      {morceauxEcrit(t).map((m, i) => (
        <span key={i} className={m.orange ? "text-orange-vif" : undefined}>
          {m.texte}
        </span>
      ))}
    </span>
  );
}

export function ScriptEcrans({
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
  /** Autres points que seul Will tranche (phrase-choc à reformuler…), en phrases. */
  aTrancher: string[];
  prix: PrixIV;
  avecQuestion: boolean;
  /** Recette tirée et variantes possibles sur cette image (absente : fabrication d'avant la variété). */
  variete?: { recette: RecetteVarieteIV; possibles: Record<AxeVariete, string[]> };
}) {
  const router = useRouter();
  const [m, setM] = useState<ModificationsScript>(AUCUNE_MODIFICATION);
  const [edition, setEdition] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [changes, setChanges] = useState<Partial<RecetteVarieteIV>>({});
  const lignes = lignesDuScript(fiche, formules);
  const ouvertes = formulesNonTranchees(formules, m);
  const decision = scriptValideParWill(fiche, formules, m);
  // Hors édition, Will lit le texte qui sera vraiment gardé : ses modifications ET la version prudente.
  const lues = lignesDuScript(decision.fiche ?? fiche, formules);
  const montant = Math.max(prix.auPlusCentimes, prix.habituelCentimes);

  const changerEcran = (id: string, x: { texteDit?: string; ecrits?: string[] }) => setM((v) => ({ ...v, ecrans: { ...v.ecrans, [id]: { ...v.ecrans[id], ...x } } }));

  async function valider() {
    if (occupe || ouvertes.length) return;
    setOccupe(true);
    setPhrase(null);
    try {
      const accord = await confirmerPrix({ message: `La suite coûte ${phrasePrix(prix)} : la voix, puis les vérifications.`, montant });
      if (typeof accord !== "number") return setPhrase("Rien n'a été payé.");
      const choixVariete = variete ? changementsVarieteIV(variete.recette, changes) : undefined;
      const r = await validerScriptImageVideoAction(videoId, { ...decision, ...(choixVariete ? { variete: choixVariete } : {}) }, accord);
      if (!r.ok) return setPhrase(r.message);
      const fin = await jusquALaReprise(videoId, r.donnees);
      if (fin) return setPhrase(fin);
      notifier.succes("Script validé : la vidéo se fabrique");
      router.refresh();
    } finally {
      setOccupe(false);
    }
  }

  const [a, b] = fiche.accroches;
  return (
    <section aria-label="Le script" className="space-y-6">
      <Carte lueur className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-texte-doux">La suite</p>
          <p className="font-titre text-3xl text-texte">{euros(prix.habituelCentimes)}</p>
        </div>
        <p className="text-sm text-texte-doux">au plus {euros(montant)} · rien n&apos;est payé avant votre accord</p>
      </Carte>

      <div>
        <p className="mb-2 text-sm font-semibold text-texte-doux">L&apos;accroche</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[a, b].map((x, i) => {
            const choisie = (i === 1) === !!m.autreAccroche;
            return (
              <button
                key={i}
                type="button"
                aria-pressed={choisie}
                onClick={() => setM((v) => ({ ...v, autreAccroche: i === 1 }))}
                className={cn("min-h-11 rounded-carte border-2 p-3 text-left", choisie ? "border-orange bg-orange-doux" : "border-trait bg-surface-1")}
              >
                <span className="block text-[15px] text-texte">« {x.texteDit} »</span>
                <span className="mt-1 block text-sm">
                  <Ecrit t={x.textesEcran.join(" · ")} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <ol className="space-y-3">
        {lignes.map((l, i) => {
          const x = m.ecrans[l.id];
          const lue = lues[i] ?? l;
          const affiches = edition ? l.ecrits.map((t, k) => x?.ecrits?.[k] ?? t) : lue.ecrits;
          return (
            <li key={l.id} className={cn("rounded-carte border p-3", l.aTrancher ? "border-ambre bg-ambre-doux" : "border-trait bg-surface-1")}>
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="w-6 text-right text-sm tabular-nums text-texte-faible">{l.rang}</span>
                <Pastille>{l.partie}</Pastille>
                <Pastille icone="baguette" ton="sauge">
                  {l.anime}
                </Pastille>
              </div>
              {edition ? (
                <div className="space-y-2">
                  <ZoneTexte libelle="Dit" value={x?.texteDit ?? l.texteDit} onChange={(e) => changerEcran(l.id, { texteDit: e.target.value })} rows={2} />
                  {l.ecrits.map((t, k) => (
                    <Champ
                      key={k}
                      libelle={`Écrit ${k + 1}`}
                      value={affiches[k]}
                      aide={k === 0 ? "Un mot entre deux * s'affiche en orange." : undefined}
                      onChange={(e) => changerEcran(l.id, { ecrits: affiches.map((v, j) => (j === k ? e.target.value : v)) })}
                    />
                  ))}
                </div>
              ) : (
                <>
                  <p className="text-[15px] text-texte">« {lue.texteDit} »</p>
                  {affiches.length > 0 && (
                    <p className="mt-1 text-sm text-texte-doux">
                      <Icone nom="texte" size={14} className="mr-1 inline" />
                      <Ecrit t={affiches.join(" · ")} />
                    </p>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>

      {avecQuestion && (
        <Champ
          libelle="La question pour faire commenter"
          aide="Dite après la phrase-choc, sauf sur LinkedIn (elle va dans le texte du post)."
          value={m.question ?? fiche.questionCommentaire.texteDit}
          onChange={(e) => setM((v) => ({ ...v, question: e.target.value }))}
        />
      )}

      {formules.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-texte-doux">Trop affirmatif ?</p>
          {formules.map((f) => {
            const choix = m.formules[f.cle];
            return (
              <Carte key={f.cle} className={cn(!choix && "border-ambre")}>
                <p className="text-[15px] text-texte">« {f.texte} »</p>
                <p className="mb-2 text-sm text-texte-doux">Version prudente : « {f.proposition} »</p>
                <div className="flex flex-wrap gap-2">
                  <Bouton variante={choix === "garder" ? "principal" : "secondaire"} aria-pressed={choix === "garder"} onClick={() => setM((v) => ({ ...v, formules: { ...v.formules, [f.cle]: "garder" } }))}>
                    Garder
                  </Bouton>
                  <Bouton variante={choix === "reformuler" ? "principal" : "secondaire"} aria-pressed={choix === "reformuler"} onClick={() => setM((v) => ({ ...v, formules: { ...v.formules, [f.cle]: "reformuler" } }))}>
                    Version prudente
                  </Bouton>
                </div>
              </Carte>
            );
          })}
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

      <div className="flex flex-wrap gap-2">
        <Bouton icone="film" taille="lg" chargement={occupe} disabled={ouvertes.length > 0} onClick={() => void valider()}>
          Valider et fabriquer (au plus {euros(montant)})
        </Bouton>
        <Bouton variante="secondaire" icone="ecrire" onClick={() => setEdition((v) => !v)}>
          {edition ? "Revoir le script" : "Modifier le script"}
        </Bouton>
        {decision.fiche && (
          <Bouton variante="fantome" onClick={() => setM(AUCUNE_MODIFICATION)}>
            Annuler mes modifications
          </Bouton>
        )}
      </div>
      {ouvertes.length > 0 && <p className="text-sm text-texte-doux">Tranchez d&apos;abord {ouvertes.length > 1 ? `les ${ouvertes.length} phrases trop affirmatives` : "la phrase trop affirmative"}.</p>}
      {phrase && (
        <p role="alert" className="text-sm text-brique">
          {phrase}
        </p>
      )}
    </section>
  );
}
