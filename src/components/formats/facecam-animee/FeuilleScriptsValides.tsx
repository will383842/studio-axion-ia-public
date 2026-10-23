"use client";

/**
 * FACE CAMÉRA ANIMÉE · « Reprendre un script validé ». Feuille qui liste les scripts validés du format ; au choix, le texte du script
 * est rendu à l'écran de dépôt (champ « Ce que vous dites »). Lecture seule : aucun script, aucun statut n'est modifié ici.
 */
import { useEffect, useState } from "react";
import { scriptsValidesFacecamAnimeeAction, texteDuScriptValideFAAction } from "@/app/(studio)/face-camera-animee/actions";
import { EtatVide } from "@/components/ui/EtatVide";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone } from "@/components/ui/Icone";
import { Squelette } from "@/components/ui/Squelette";
import type { ScriptValideFA } from "@/services/facecam-animee";
import { PHRASE_AUCUN_SCRIPT_VALIDE, phraseDureeScript } from "./scripts-valides";

export function FeuilleScriptsValides({ ouverte, onOuverteChange, onChoisir }: { ouverte: boolean; onOuverteChange: (v: boolean) => void; onChoisir: (texte: string, tronque: boolean) => void }) {
  const [scripts, setScripts] = useState<ScriptValideFA[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  // Relue à chaque ouverture : un script validé entre-temps apparaît tout de suite.
  useEffect(() => {
    if (!ouverte) return;
    let actif = true;
    void scriptsValidesFacecamAnimeeAction().then((r) => {
      if (!actif) return;
      setErreur(r.ok ? null : r.message);
      if (r.ok) setScripts(r.donnees);
    });
    return () => {
      actif = false;
    };
  }, [ouverte]);

  async function choisir(id: string) {
    setEnCours(id);
    setErreur(null);
    const r = await texteDuScriptValideFAAction(id);
    setEnCours(null);
    if (!r.ok) return setErreur(r.message);
    onChoisir(r.donnees.texte, r.donnees.tronque);
    onOuverteChange(false);
  }

  return (
    <FeuilleBas ouverte={ouverte} onOuverteChange={onOuverteChange} titre="Utiliser un script validé" description="Touchez un script : son texte arrive dans « Ce que vous dites ».">
      {erreur && (
        <p role="alert" className="mb-3 rounded-2xl bg-brique-doux px-4 py-3 text-[15px] font-semibold text-brique">
          {erreur}
        </p>
      )}
      {scripts === null && !erreur && (
        <div className="space-y-2" aria-busy="true">
          <Squelette className="h-16 w-full rounded-2xl" />
          <Squelette className="h-16 w-full rounded-2xl" />
        </div>
      )}
      {scripts?.length === 0 && <EtatVide compact icone="document" titre={PHRASE_AUCUN_SCRIPT_VALIDE} />}
      {scripts && scripts.length > 0 && (
        <ul className="space-y-2">
          {scripts.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                disabled={enCours !== null}
                onClick={() => void choisir(s.id)}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-trait bg-surface-2 px-4 py-3 text-left transition hover:border-orange-vif disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-texte">{s.sujet || "Script sans titre"}</span>
                  <span className="line-clamp-2 break-words text-sm text-texte-doux">{s.apercu}</span>
                  <span className="mt-0.5 block text-xs tabular-nums text-texte-doux">{phraseDureeScript(s.dureeEstimeeSec)}</span>
                </span>
                <Icone nom={enCours === s.id ? "chargement" : "chevron-droite"} size={18} className={enCours === s.id ? "shrink-0 animate-spin text-orange-vif" : "shrink-0 text-texte-doux"} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </FeuilleBas>
  );
}
