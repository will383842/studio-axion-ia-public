"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { controlerScriptFourniAction, enregistrerScriptFourniAction, revenirAuScriptDeLIAAction } from "@/app/(studio)/cas-concret/actions";
import { Bouton } from "@/components/ui/Bouton";
import { notifier } from "@/components/ui/Toast";
import type { ApercuScriptFourni } from "@/services/cas-concret-script-fourni";

/** Le rang (à partir de 1) d'une ligne de Will → sa position dans le texte (les lignes vides ne comptent pas). Vide : null. PUR. */
export function positionDeLaLigne(texte: string, rang: number): { debut: number; fin: number } | null {
  let n = 0;
  let debut = 0;
  for (const ligne of texte.split("\n")) {
    if (ligne.trim()) {
      n++;
      if (n === rang) return { debut, fin: debut + ligne.length };
    }
    debut += ligne.length + 1;
  }
  return null;
}

const AIDE = "Une ligne = un écran. Étiquettes facultatives en début de ligne : [accroche] [avant] [bascule] [étape] [détail] [humain] [résultat] [question]. La fin (lien, mot à commenter) est ajoutée toute seule selon le réseau.";

/**
 * « Mon script » : Will tape ou colle son script (une ligne = un écran), le vérifie (gratuit, aperçu écran par écran ou refus
 * « Ligne N : … »), puis l'enregistre. « Enregistrer » n'est actif qu'après une vérification conforme du texte AFFICHÉ (toute
 * frappe le désactive ; le serveur revérifie). Rien n'est dépensé ; l'IA n'écrit rien.
 */
export function FormulaireScriptFourni({ casId, titre, texteDepart, origine, perime, courantFourni }: { casId: string; titre: string; texteDepart: string; origine: "fourni" | "valide" | "gabarit"; perime: boolean; courantFourni: boolean }) {
  const routeur = useRouter();
  const idAide = useId();
  const zone = useRef<HTMLTextAreaElement>(null);
  const liste = useRef<HTMLDivElement>(null);
  const [texte, setTexte] = useState(texteDepart);
  const [verif, setVerif] = useState<{ texte: string; apercu: ApercuScriptFourni } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmerRetour, setConfirmerRetour] = useState(false);
  const [attente, demarrer] = useTransition();
  const conforme = !!verif && verif.apercu.ok && verif.texte === texte;

  // Après une vérification, le focus va sur le résultat (aperçu ou refus) : le lecteur d'écran le lit.
  useEffect(() => {
    if (verif) liste.current?.focus();
  }, [verif]);

  function verifier() {
    setErreur(null);
    demarrer(async () => {
      const envoye = texte;
      const r = await controlerScriptFourniAction(casId, envoye);
      if (!r.ok) return void setErreur(r.message);
      setVerif({ texte: envoye, apercu: r.donnees });
    });
  }
  function enregistrer() {
    setErreur(null);
    demarrer(async () => {
      const r = await enregistrerScriptFourniAction(casId, texte);
      if (!r.ok) return void setErreur(r.message);
      notifier.succes("Script enregistré", "Il sera dit mot pour mot, sans écriture par l'IA.");
      routeur.push("/cas-concret");
    });
  }
  function revenir() {
    setErreur(null);
    demarrer(async () => {
      const r = await revenirAuScriptDeLIAAction(casId);
      if (!r.ok) return void setErreur(r.message);
      notifier.succes("Script de l'IA rétabli", "Votre script reste dans l'historique.");
      routeur.push("/cas-concret");
    });
  }
  function allerALaLigne(rang: number) {
    const p = positionDeLaLigne(texte, rang);
    const el = zone.current;
    if (!p || !el) return;
    el.focus();
    el.setSelectionRange(p.debut, p.fin);
  }

  return (
    <div className="space-y-4">
      {perime && <p role="status" className="rounded-2xl border border-ambre/40 bg-ambre-doux px-4 py-3 text-[15px] text-texte">Ce script a été écrit pour une version précédente du cas : vérifiez-le de nouveau.</p>}
      {origine === "gabarit" && <p className="text-[15px] text-texte-doux">Ce texte de départ est tiré du cas (gratuit). Modifiez-le comme vous voulez.</p>}
      {origine === "valide" && <p className="text-[15px] text-texte-doux">Ce texte de départ est le script validé de ce cas. Modifiez-le comme vous voulez.</p>}
      <div>
        <label htmlFor={`${idAide}-texte`} className="mb-1.5 block text-sm font-semibold text-texte-doux">
          Mon script pour « {titre} »
        </label>
        <textarea
          id={`${idAide}-texte`}
          ref={zone}
          value={texte}
          rows={14}
          maxLength={4000}
          spellCheck
          aria-describedby={idAide}
          onChange={(e) => setTexte(e.target.value)}
          className="block w-full resize-y rounded-champ border border-trait bg-surface-1 px-3.5 py-3 text-base leading-relaxed text-texte hover:border-trait-fort focus:border-orange focus:outline-none"
        />
        <p id={idAide} className="mt-1.5 text-[13px] text-texte-doux">
          {AIDE} <span aria-live="polite">{texte.length} / 4000 caractères.</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Bouton variante="secondaire" chargement={attente} disabled={attente || !texte.trim()} onClick={verifier}>
          Vérifier
        </Bouton>
        <Bouton chargement={attente} disabled={attente || !conforme} onClick={enregistrer}>
          Enregistrer mon script
        </Bouton>
        <Link href="/cas-concret" className="inline-flex min-h-11 items-center rounded-sm px-3 text-[15px] font-semibold text-texte-doux underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-vif">
          Annuler
        </Link>
      </div>
      {!conforme && verif?.apercu.ok && <p role="status" className="text-[13px] text-texte-doux">Vous avez modifié le texte : vérifiez-le de nouveau avant d&apos;enregistrer.</p>}
      {erreur && <p role="alert" className="text-sm text-brique">{erreur}</p>}

      <div ref={liste} tabIndex={-1} className="space-y-3 outline-none">
        {verif && !verif.apercu.ok && (
          <div role="alert" className="space-y-2 rounded-2xl border border-brique/40 bg-brique-doux px-4 py-3">
            <p className="text-[15px] font-semibold text-texte">Ce script ne passe pas encore :</p>
            <ul className="space-y-2 p-0">
              {verif.apercu.refus.map((r, i) => (
                <li key={`${r.ligne ?? "t"}-${i}`} className="list-none text-[15px] text-texte">
                  {r.message}
                  {r.ligne && (
                    <>
                      {" "}
                      <button type="button" onClick={() => allerALaLigne(r.ligne!)} className="inline-flex min-h-11 items-center rounded-sm font-semibold text-orange-vif underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-vif">
                        Aller à la ligne {r.ligne}
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {verif?.apercu.ok && (
          <section aria-label="Aperçu du script" className="space-y-2">
            <h2 className="text-[15px] font-semibold text-texte">
              Aperçu{verif.apercu.dureeSec ? ` · environ ${verif.apercu.dureeSec.min} à ${verif.apercu.dureeSec.max} s selon la fin` : ""}
            </h2>
            <ol className="space-y-2 p-0">
              {verif.apercu.apercu.map((e) => (
                <li key={e.rang} className="list-none rounded-2xl border border-trait bg-surface-2 px-4 py-3">
                  <p className="text-[13px] font-semibold text-texte-doux">
                    Ligne {e.rang} · {e.nomForme}
                  </p>
                  <p className="text-[15px] text-texte">{e.texteDit}</p>
                  {e.affiches.length > 0 && <p className="mt-1 text-[13px] text-texte-doux">À l&apos;écran : {e.affiches.join(" · ")}</p>}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      {courantFourni && (
        <div className="space-y-2 border-t border-trait pt-4">
          {!confirmerRetour ? (
            <Bouton variante="fantome" disabled={attente} onClick={() => setConfirmerRetour(true)}>
              Revenir au script écrit par l&apos;IA
            </Bouton>
          ) : (
            <div role="group" aria-label="Confirmer le retour au script de l'IA" className="space-y-2">
              <p className="text-[13px] text-texte-doux">Votre script reste dans l&apos;historique. Au lancement, l&apos;IA écrira un script que vous relirez avant la voix.</p>
              <div className="flex flex-wrap gap-2">
                <Bouton chargement={attente} onClick={revenir}>
                  Oui, revenir
                </Bouton>
                <Bouton variante="fantome" disabled={attente} onClick={() => setConfirmerRetour(false)}>
                  Annuler
                </Bouton>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
