"use client";

import { useState } from "react";
import { basculerAccordAction, changerTypeAction, confirmerMatiereAction, frequenteAction, nomsSensiblesAction, positionAction, retirerMatiereAction, versionsToucheesAction } from "@/app/(studio)/ecrire/matieres/actions";
import type { ImpactRetrait, VueMatiere } from "@/services/matieres";
import { accordRequis, proposerNomsSensibles } from "@/domaine/matieres";
import { Bouton, FeuilleBas, Icone, Interrupteur, notifier } from "@/components/ui";
import { ChoixMotif, VersionsTouchees } from "./Retrait";
import { ChoixType, cite, NomsAMasquer, PastilleType } from "./visuels";

/**
 * Fiche d'une matière (un toucher par réglage) : type, accord, noms à masquer, question fréquente, position de marque,
 * et « Retirer » avec la liste des versions touchées. Le texte ne se modifie jamais : il est cité mot pour mot.
 */
export function FeuilleMatiere({ vue, onFermer }: { vue: VueMatiere | null; onFermer: () => void }) {
  const [etape, setEtape] = useState<"fiche" | "retrait" | "impact">("fiche");
  const [impact, setImpact] = useState<ImpactRetrait | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const m = vue?.matiere;

  function fermer() {
    setEtape("fiche");
    setImpact(null);
    onFermer();
  }

  async function lancer<T>(f: () => Promise<{ ok: true; donnees: T } | { ok: false; message: string }>, ok?: string) {
    setEnvoi(true);
    const r = await f();
    setEnvoi(false);
    if (!r.ok) {
      notifier.erreur(r.message);
      return null;
    }
    if (ok) notifier.succes(ok);
    return r.donnees;
  }

  const titre = etape === "fiche" ? "Matière" : etape === "retrait" ? "Retirer ?" : "Versions concernées";

  return (
    <FeuilleBas ouverte={!!vue} onOuverteChange={(o) => !o && fermer()} titre={titre}>
      {m && etape === "fiche" && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-surface-2 p-4">
            <PastilleType type={m.type} className="mb-2 bg-surface-1" />
            <p className="text-[17px] font-semibold leading-snug text-texte">{cite(m.texte)}</p>
            {m.retrait && <p className="mt-2 text-sm font-semibold text-brique">Retirée</p>}
          </div>
          {m.statut === "a-confirmer" && !m.retrait && (
            <Bouton pleineLargeur icone="coche" chargement={envoi} onClick={() => lancer(() => confirmerMatiereAction(m.id), "Confirmée").then((x) => x && fermer())}>
              Confirmer
            </Bouton>
          )}
          {!m.retrait && (
            <>
              <ChoixType compact valeur={m.type} onChange={(t) => lancer(() => changerTypeAction(m.id, t)).then((x) => x && fermer())} />
              {accordRequis(m.type) && (
                <Interrupteur icone="bouclier" libelle="J'ai son accord" detail={m.accord?.obtenu ? undefined : "Sans accord, elle n'est pas citée"} coche={!!m.accord?.obtenu} onChange={(v) => lancer(() => basculerAccordAction(m.id, v)).then((x) => x && fermer())} />
              )}
              {m.type === "question-recue" && <Interrupteur icone="repeter" libelle="On me la pose souvent" coche={!!m.frequente} onChange={(v) => lancer(() => frequenteAction(m.id, v)).then((x) => x && fermer())} />}
              {m.type === "avis-will" && <Interrupteur icone="etoile" libelle="Position de marque" coche={!!m.positionDeMarque} onChange={(v) => lancer(() => positionAction(m.id, v)).then((x) => x !== null && fermer())} />}
              <NomsAMasquer
                noms={[...new Set([...(m.nomsSensibles ?? []), ...proposerNomsSensibles(m.texte)])]}
                masques={m.nomsSensibles ?? []}
                onChange={(n) => lancer(() => nomsSensiblesAction(m.id, n)).then((x) => x && fermer())}
              />
              <Bouton variante="fantome" pleineLargeur icone="archive" className="text-brique" onClick={() => setEtape("retrait")}>
                Retirer
              </Bouton>
            </>
          )}
          {m.retrait && (
            <Bouton
              variante="secondaire"
              pleineLargeur
              icone="document"
              onClick={async () => {
                const d = await lancer(() => versionsToucheesAction({ matiereIds: [m.id], preuveIds: m.preuveId ? [m.preuveId] : [] }));
                if (d) {
                  setImpact(d);
                  setEtape("impact");
                }
              }}
            >
              Versions concernées
            </Bouton>
          )}
        </div>
      )}
      {m && etape === "retrait" && (
        <div className="space-y-4">
          <p className="flex items-start gap-2 text-sm text-texte-doux">
            <Icone nom="info" size={16} className="mt-0.5 shrink-0" />
            Elle ne servira plus. Rien n&apos;est effacé.
          </p>
          <ChoixMotif
            envoi={envoi}
            onRetirer={async (motif) => {
              const d = await lancer(() => retirerMatiereAction(m.id, motif), "Matière retirée");
              if (d) {
                setImpact(d);
                setEtape("impact");
              }
            }}
          />
        </div>
      )}
      {etape === "impact" && impact && <VersionsTouchees impact={impact} />}
    </FeuilleBas>
  );
}
