"use client";

/**
 * « ÉCRIRE LE SCRIPT POUR MOI » (tableau animé) : la demande en quelques champs, le coût annoncé avant le clic et
 * confirmé (le serveur refuse sans lui), puis le résultat en clair : les cinq accroches (la retenue mise en avant, une
 * autre peut être choisie et l'écriture relancée), le script moment par moment, la note, ce qu'il faut préparer avant
 * de publier ; en cas de refus, les raisons. « Utiliser ce script » remplit le texte, relu avant le découpage.
 * L'écriture est une TÂCHE DE FOND (environ 3 minutes, annoncé avant le clic) : l'action rend la main tout de suite,
 * `SuiviTacheTableau` dit l'avancement. Une écriture payée sans résultat gardé (avant les tâches de fond) est dite
 * « interrompue » : la demande est reprise, à compléter, et « Reprendre l'écriture » la relance.
 * Script refusé : il reste AFFICHÉ en entier (sa meilleure version), avec ses motifs et « Utiliser quand même » (s'il
 * passe tous les contrôles en code), « Corriger à la main » et « Réécrire ». Une écriture non livrée dont la trace
 * garde des versions propose « Reprendre la meilleure version », sans aucun nouvel appel payant.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ecrireScriptTableauAction, reprendreMeilleureVersionTableauAction } from "@/app/(studio)/tableau/nouvelle/actions";
import { Bouton } from "@/components/ui/Bouton";
import { CaseACocher } from "@/components/ui/CaseACocher";
import { Champ } from "@/components/ui/Champ";
import { confirmerPrix } from "@/components/ui/ConfirmationPrix";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { notifier } from "@/components/ui/Toast";
import { dureeDiteSec } from "@/domaine/duree-tableau";
import { MOMENTS_SCRIPT, normaliserScript, phrasesDites, phrasesEtape, type DemandeScriptTableau, type ScriptTableau } from "@/domaine/scripts-tableau";
import { formaterMontant } from "@/lib/montants";
import type { ChoixConfirmation } from "@/domaine/sujets-traites";
import type { DonneesScriptTableau, EcranCreationTableau, RefusSujetTraite } from "@/services/tableau-creation";
import { DUREE_ECRITURE_TEXTE } from "./durees";
import { accordApresRefus, controleServeurAvantPrix, PHRASE_PRIX_CHANGE, prixRedemandable } from "./sujet-deja-traite";

const euros = (centimes: number) => formaterMontant({ centimes: Math.max(0, Math.ceil(centimes)), devise: "EUR" });

interface Saisie {
  serie: string;
  sujet: string;
  public: string;
  avecVraiCas: boolean;
  vraiCas: { metier: string; tache: string; avant: string; apres: string; date: string };
  reseau: string;
  fin: "commentaire" | "diagnostic" | "";
  mot: string;
  envoi: string;
}

function saisieDe(d: Partial<DemandeScriptTableau> | null | undefined): Saisie {
  return {
    serie: d?.serie ?? "",
    sujet: d?.sujet ?? "",
    public: d?.public ?? "",
    avecVraiCas: !!d?.vraiCas,
    vraiCas: d?.vraiCas ?? { metier: "", tache: "", avant: "", apres: "", date: "" },
    reseau: d?.reseau ?? "",
    fin: d?.fin?.type ?? "",
    mot: d?.fin?.type === "commentaire" ? d.fin.mot : "",
    envoi: d?.envoi ?? "",
  };
}

/** Phrases d'un moment du script (un script d'avant la v3 est d'abord remis en forme). */
function phrasesDu(brut: ScriptTableau, moment: (typeof MOMENTS_SCRIPT)[number][0]) {
  const script = normaliserScript(brut);
  if (moment === "etapes") return script.etapes.flatMap(phrasesEtape);
  if (moment === "exemple") return script.exemple.phrases;
  return script[moment];
}

/** Le script, moment par moment (livré, ou meilleure version d'un refus). */
function ScriptParMoments({ script }: { script: ScriptTableau }) {
  return (
    <div className="space-y-3">
      {MOMENTS_SCRIPT.map(([moment, libelle]) => {
        const phrases = phrasesDu(script, moment);
        if (!phrases.length) return null;
        return (
          <div key={moment} className="rounded-2xl border border-trait bg-surface-1 px-4 py-3">
            <p className="text-sm font-semibold text-texte-doux">{libelle}</p>
            {phrases.map((p, i) => (
              <p key={i} className="mt-1 text-[15px] text-texte">
                {p.dit}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function EcrireScriptTableau({ ecran, onUtiliser, onCorriger, occupe = false }: { ecran: EcranCreationTableau; onUtiliser: (d: DonneesScriptTableau) => void; onCorriger?: (d: DonneesScriptTableau) => void; occupe?: boolean }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const b = ecran.brouillon;
  const g = b?.generation ?? null;
  const [saisie, setSaisie] = useState<Saisie>(() => saisieDe(b?.demandeConnue ?? g?.demande));
  const interrompue = b?.ecritureInterrompue ?? null;
  const [phrase, setPhrase] = useState<string | null>(null);
  /** Sujet déjà traité : le refus du serveur et le prix déjà confirmé (les trois choix ne le redemandent pas). */
  const [refusSujet, setRefusSujet] = useState<{ refus: RefusSujetTraite; accord?: number; accroche?: number } | null>(null);
  const changer = (p: Partial<Saisie>) => {
    // Un autre sujet : le jeton ne vaut plus, le panneau se ferme.
    if (p.sujet !== undefined) setRefusSujet(null);
    setSaisie((s) => ({ ...s, ...p }));
  };
  const cout = ecran.ecriture.coutCentimes;

  function demande() {
    return {
      serie: saisie.serie,
      sujet: saisie.sujet,
      public: saisie.public,
      vraiCas: saisie.avecVraiCas ? saisie.vraiCas : null,
      reseau: saisie.reseau,
      fin: saisie.fin === "commentaire" ? { type: "commentaire", mot: saisie.mot } : { type: saisie.fin },
      envoi: saisie.envoi,
    };
  }

  type Confirmation = { choix: ChoixConfirmation; jeton: string };

  /** Nouvelle vidéo : le serveur contrôle le sujet AVANT le prix (il répond, au besoin, « accord requis »). Sinon : le prix d'abord, comme avant. */
  async function ecrire(accroche?: number, sujet?: Confirmation) {
    if (controleServeurAvantPrix({ videoId: b?.videoId, accroche })) return lancer(undefined, accroche, sujet);
    await payerPuisLancer(cout, accroche, sujet, 0);
  }

  async function payerPuisLancer(montant: number, accroche: number | undefined, sujet: Confirmation | undefined, essai: number) {
    const accord = await confirmerPrix({ message: accroche === undefined ? "L'écriture du script par Claude." : "L'écriture du script avec cette accroche.", montant });
    if (typeof accord !== "number") return;
    lancer(accord, accroche, sujet, essai);
  }

  /** Envoie l'écriture. `sujet` : la confirmation d'un sujet déjà traité, renvoyée avec EXACTEMENT le même texte, gardée si le prix change. */
  function lancer(accord: number | undefined, accroche?: number, sujet?: Confirmation, essai = 0) {
    setPhrase(null);
    demarrer(async () => {
      // Une action qui ne répond pas (réseau) : une phrase, jamais l'écran d'erreur générique.
      const r = await ecrireScriptTableauAction(demande(), { videoId: b?.videoId, accord, ...(accroche !== undefined ? { accroche } : {}), ...(sujet ? { sujet } : {}) }).catch(() => null);
      if (!r) return setPhrase("Le studio ne répond pas pour l'instant. Rien n'est perdu : réessayez dans un instant.");
      if (!r.ok) return setPhrase(r.message);
      const d = r.donnees;
      if (d.statut === "accord-requis") {
        // Le prix à confirmer (ou qui a changé) : on le demande, avec la confirmation du sujet gardée. Jamais plus de deux fois de suite.
        if (!prixRedemandable(essai)) return setPhrase(PHRASE_PRIX_CHANGE);
        return void payerPuisLancer(d.centimes, accroche, sujet, essai + 1);
      }
      if (d.statut === "refusee") return setPhrase(d.phrase);
      if (d.statut === "sujet-deja-traite") {
        const garde = accordApresRefus(d, accord);
        return setRefusSujet({ refus: d, ...(garde !== undefined ? { accord: garde } : {}), ...(accroche !== undefined ? { accroche } : {}) });
      }
      setRefusSujet(null);
      if (d.avertissement) {
        const titres = d.avertissement.precedents.slice(0, 3).map((p) => p.titre).join(" · ");
        notifier.info("Ce sujet existe déjà ailleurs", `Déjà fait dans un autre type de vidéo : ${titres}. L'écriture continue.`);
      }
      notifier.succes("Écriture lancée", `${DUREE_ECRITURE_TEXTE} : vous pouvez fermer la page, le travail continue.`);
      if (d.videoId !== b?.videoId) router.replace(`/tableau/nouvelle?brouillon=${d.videoId}`);
      router.refresh();
    });
  }

  const resultat = g?.issue.ok ? g.issue.resultat : null;
  const meilleure = g && !g.issue.ok ? (g.issue.meilleure ?? null) : null;
  const proposition = g?.proposition ?? null;

  /** « Reprendre la meilleure version » : relit la trace de l'écriture, aucun appel payant. */
  function reprendreTrace() {
    if (!b) return;
    setPhrase(null);
    demarrer(async () => {
      const r = await reprendreMeilleureVersionTableauAction(b.videoId).catch(() => null);
      if (!r) return setPhrase("Le studio ne répond pas pour l'instant. Rien n'est perdu : réessayez dans un instant.");
      if (!r.ok) return setPhrase(r.message);
      if (r.donnees.statut === "refusee") return setPhrase(r.donnees.phrase);
      notifier.succes(r.donnees.livre ? "Script repris" : "Meilleure version reprise", "Aucun nouvel appel : rien n'a été payé.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <section aria-label="Votre demande" className="space-y-4">
        <SelecteurPastilles libelle="La série" options={ecran.ecriture.series} valeur={saisie.serie || undefined} onChange={(v) => changer({ serie: v })} />
        <Champ libelle="Le sujet, en une ligne" value={saisie.sujet} onChange={(e) => changer({ sujet: e.target.value })} maxLength={160} />
        <Champ libelle="À qui parle la vidéo" value={saisie.public} onChange={(e) => changer({ public: e.target.value })} maxLength={200} />
        <CaseACocher libelle="J'ai un vrai cas à raconter" coche={saisie.avecVraiCas} onChange={(v) => changer({ avecVraiCas: v })} />
        {saisie.avecVraiCas && (
          <div className="space-y-3 rounded-2xl border border-trait bg-surface-1 px-4 py-3">
            <Champ libelle="Le métier" value={saisie.vraiCas.metier} onChange={(e) => changer({ vraiCas: { ...saisie.vraiCas, metier: e.target.value } })} maxLength={120} />
            <Champ libelle="La tâche" value={saisie.vraiCas.tache} onChange={(e) => changer({ vraiCas: { ...saisie.vraiCas, tache: e.target.value } })} maxLength={200} />
            <Champ libelle="Avant" value={saisie.vraiCas.avant} onChange={(e) => changer({ vraiCas: { ...saisie.vraiCas, avant: e.target.value } })} maxLength={400} />
            <Champ libelle="Après" value={saisie.vraiCas.apres} onChange={(e) => changer({ vraiCas: { ...saisie.vraiCas, apres: e.target.value } })} maxLength={400} />
            <Champ libelle="Quand" value={saisie.vraiCas.date} onChange={(e) => changer({ vraiCas: { ...saisie.vraiCas, date: e.target.value } })} maxLength={40} />
          </div>
        )}
        <SelecteurPastilles libelle="Le réseau principal" options={ecran.ecriture.reseaux} valeur={saisie.reseau || undefined} onChange={(v) => changer({ reseau: v })} />
        <SelecteurPastilles
          libelle="La fin"
          options={[
            { valeur: "commentaire", libelle: "Un mot à commenter" },
            { valeur: "diagnostic", libelle: "Un appel de diagnostic" },
          ]}
          valeur={saisie.fin || undefined}
          onChange={(v) => changer({ fin: v as Saisie["fin"] })}
        />
        {saisie.fin === "commentaire" && <Champ libelle="Le mot à commenter" value={saisie.mot} onChange={(e) => changer({ mot: e.target.value })} maxLength={20} />}
        {saisie.fin && (
          <Champ libelle={saisie.fin === "commentaire" ? "Ce que vous envoyez" : "Ce que l'appel apporte"} value={saisie.envoi} onChange={(e) => changer({ envoi: e.target.value })} maxLength={300} />
        )}
        <Bouton icone="ecrire" variante={resultat ? "secondaire" : "principal"} chargement={enCours} disabled={occupe} onClick={() => void ecrire()} pleineLargeur>
          {interrompue ? "Reprendre l'écriture" : resultat || g ? "Réécrire le script" : "Écrire le script"} (≈ {euros(cout)} au plus)
        </Bouton>
        <p className="text-sm text-texte-doux">Durée : {DUREE_ECRITURE_TEXTE}. Vous pourrez fermer la page : le travail continue.</p>
        {phrase && (
          <p role="alert" className="rounded-2xl border border-brique/40 bg-brique-doux px-4 py-3 text-[15px] text-texte">
            {phrase}
          </p>
        )}
        {refusSujet && (
          <section aria-label="Sujet déjà traité" role="alert" className="space-y-3 rounded-2xl border border-brique/40 bg-brique-doux px-4 py-3 text-[15px] text-texte">
            <p className="font-semibold">{refusSujet.refus.jetonPerime ? "Les vidéos ont changé. Choisissez de nouveau." : refusSujet.refus.phrase}</p>
            <ul className="space-y-1 text-sm">
              {refusSujet.refus.precedents.slice(0, 5).map((p) => (
                <li key={p.videoId ?? p.sujetId ?? p.lien}>
                  <Link href={p.lien} className="underline">
                    {p.titre}
                  </Link>{" "}
                  <span className="text-texte-doux">le {new Date(p.le).toLocaleDateString("fr-FR")}</span>
                </li>
              ))}
            </ul>
            {refusSujet.refus.suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-texte-doux">Choisir un autre sujet</p>
                <div className="flex flex-wrap gap-2">
                  {refusSujet.refus.suggestions.map((sg) => (
                    <Bouton key={sg.code ?? sg.casId ?? sg.titre} variante="secondaire" onClick={() => changer({ sujet: sg.titre.slice(0, 160) })}>
                      {sg.titre}
                    </Bouton>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Bouton variante="secondaire" chargement={enCours} disabled={occupe} onClick={() => lancer(refusSujet.accord, refusSujet.accroche, { choix: "refaire", jeton: refusSujet.refus.jeton })}>
                Refaire quand même
              </Bouton>
            </div>
          </section>
        )}
      </section>

      {interrompue && (
        <section aria-label="Écriture interrompue" role="alert" className="rounded-2xl border border-brique/40 bg-brique-doux px-4 py-3 text-[15px] text-texte">
          <p className="font-semibold">Écriture interrompue</p>
          <p className="mt-1 text-sm text-texte-doux">
            {interrompue.appels} appel{interrompue.appels > 1 ? "s" : ""} à Claude ({euros(interrompue.centimes)}) n&apos;{interrompue.appels > 1 ? "ont" : "a"} pas laissé de résultat gardé. Complétez la demande ci-dessus, puis « Reprendre l&apos;écriture ».
          </p>
        </section>
      )}

      {b?.repriseTrace && !g?.reprise && (
        <section aria-label="Garder une version écrite" className="space-y-2 rounded-2xl border border-trait bg-surface-1 px-4 py-3">
          <p className="text-[15px] text-texte">L&apos;écriture précédente a laissé des versions du script. Reprenez la meilleure, revérifiée avec les règles actuelles.</p>
          <Bouton variante="secondaire" icone="reessayer" chargement={enCours} disabled={occupe} onClick={reprendreTrace}>
            Garder la meilleure version (sans nouvel appel)
          </Bouton>
        </section>
      )}

      {g && !g.issue.ok && (
        <section aria-label="Script refusé" className="space-y-4">
          <div role="alert" className="rounded-2xl border border-brique/40 bg-brique-doux px-4 py-3 text-[15px] text-texte">
            <p className="font-semibold">{meilleure ? "Ce script n'a pas passé tous les contrôles. Sa meilleure version est gardée ci-dessous." : "Ce script n'est pas assez bon : rien n'est proposé."}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-texte-doux">
              {g.issue.motifs.slice(0, 8).map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
            {meilleure && meilleure.defauts.some((d) => !d.eliminatoire) && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-texte-doux">
                {meilleure.defauts
                  .filter((d) => !d.eliminatoire)
                  .slice(0, 4)
                  .map((d, i) => (
                    <li key={i}>Remarque : {d.message}</li>
                  ))}
              </ul>
            )}
          </div>
          {meilleure && <ScriptParMoments script={meilleure.ecriture.script} />}
          <div className="flex flex-wrap gap-2">
            {meilleure?.valide && proposition && (
              <Bouton icone="ciseaux" chargement={enCours} disabled={occupe} onClick={() => onUtiliser(proposition)}>
                Utiliser quand même
              </Bouton>
            )}
            {proposition && onCorriger && (
              <Bouton variante="secondaire" icone="ecrire" disabled={occupe} onClick={() => onCorriger(proposition)}>
                Corriger à la main
              </Bouton>
            )}
            <Bouton variante="secondaire" icone="reessayer" chargement={enCours} disabled={occupe} onClick={() => void ecrire()}>
              Réécrire (≈ {euros(cout)} au plus)
            </Bouton>
          </div>
        </section>
      )}

      {resultat && (
        <section aria-label="Le script écrit" className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-texte-doux">Les accroches</h2>
            <ul className="space-y-2">
              {resultat.accroches.map((a, i) => (
                <li key={i} className={i === resultat.retenue ? "rounded-2xl border-2 border-orange-vif bg-surface-1 px-4 py-3" : "rounded-2xl border border-trait px-4 py-3"}>
                  <p className="text-[15px] text-texte">{a.dit}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-sm text-texte-doux">{i === resultat.retenue ? "Retenue" : a.ecran}</span>
                    {i !== resultat.retenue && (
                      <Bouton variante="fantome" chargement={enCours} disabled={occupe} onClick={() => void ecrire(i)}>
                        Choisir et réécrire
                      </Bouton>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-texte-doux">Le script</h2>
            <ScriptParMoments script={resultat.script} />
          </div>

          <p className="text-[15px] font-semibold text-texte">
            Note : {resultat.note} sur 10 · environ {Math.round(dureeDiteSec(phrasesDites(resultat.script).map((p) => p.dit).join(" ")))} s dites
          </p>
          {(resultat.motsDouleur ?? []).length > 0 && <p className="text-sm text-texte-doux">Mots de la douleur, écrits et entourés au début : {resultat.motsDouleur.join(", ")}</p>}

          {resultat.aPreparer.length > 0 && (
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-texte-doux">À préparer avant de publier</h2>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-texte">
                {resultat.aPreparer.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          )}

          {b?.generation?.proposition && (
            <Bouton icone="ciseaux" taille="lg" pleineLargeur chargement={enCours} disabled={occupe} onClick={() => onUtiliser(b.generation!.proposition!)}>
              Utiliser ce script
            </Bouton>
          )}
        </section>
      )}
    </div>
  );
}
