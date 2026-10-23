"use client";

import { useEffect, useState, useTransition } from "react";
import { Bouton, Champ, FeuilleBas, Icone, notifier, PastilleEssai, SelecteurPastilles } from "@/components/ui";
import { variantesMot } from "@/domaine/prononciations";
import type { Prononciation, SourcePrononciation } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { formaterMontant } from "@/lib/montants";
import { ajouterPrononciationAction, ecouterPrononciationAction, modifierPrononciationAction } from "./actions";
import { useEcoute } from "./useEcoute";

/** Une voix proposée pour la portée (« réservé à… »). */
export interface VoixPortee {
  id: string;
  nom: string;
  personnageId: string;
  personnage: string;
}

export interface ProprietesFeuilleAjout {
  ouverte: boolean;
  onOuverteChange: (v: boolean) => void;
  /** Valeurs de départ (pastille du script, « Mal prononcé ? »). */
  initial?: { mot?: string; prononciation?: string; suggestion?: string };
  /** Modification d'une entrée existante (l'ancienne est archivée, jamais effacée). */
  existante?: Prononciation;
  source: SourcePrononciation;
  voix?: VoixPortee[];
  onEnregistree?: (r: { id: string; mot: string; prononciation: string }) => void;
}

/**
 * Feuille « Nouveau mot » (n° 1, 6, 7, 8) : le mot, comment le dire, ▶ AVANT et ▶ APRÈS dans une phrase type lue par
 * votre voix (coût affiché), les variantes reconnues, la façon d'écrire dans les sous-titres et la portée.
 */
export function FeuilleAjoutPrononciation({ ouverte, onOuverteChange, initial, existante, source, voix = [], onEnregistree }: ProprietesFeuilleAjout) {
  const [mot, setMot] = useState("");
  const [dit, setDit] = useState("");
  const [ecriture, setEcriture] = useState("");
  const [portee, setPortee] = useState<string>("toutes");
  const [ecouteApres, setEcouteApres] = useState("");
  const [enCours, demarrer] = useTransition();
  const ecoute = useEcoute();
  const { arreter } = ecoute;

  // Remplissage à l'ouverture (nouvelle pastille, autre mot de la vidéo, modification).
  useEffect(() => {
    if (!ouverte) return void arreter();
    const t = setTimeout(() => {
      setMot(existante?.mot ?? initial?.mot ?? "");
      setDit(existante?.prononciation ?? initial?.prononciation ?? "");
      setEcriture(existante?.ecriture ?? "");
      setPortee(existante?.portee?.voixId ? `voix:${existante.portee.voixId}` : existante?.portee?.personnageId ? `perso:${existante.portee.personnageId}` : "toutes");
      setEcouteApres("");
    }, 0);
    return () => clearTimeout(t);
  }, [ouverte, existante, initial?.mot, initial?.prononciation, arreter]);

  const m = mot.trim();
  const p = dit.trim();
  const voixEcoute = portee.startsWith("voix:") ? portee.slice(5) : undefined;
  const cleApres = `apres|${m}|${p}|${voixEcoute ?? ""}`;
  const variantes = variantesMot(m).filter((v) => v !== m).slice(0, 4);
  const suggestion = initial?.suggestion && !p ? initial.suggestion : null;

  async function ecouter(moment: "avant" | "apres") {
    const cle = moment === "avant" ? `avant|${m}|${voixEcoute ?? ""}` : cleApres;
    const r = await ecoute.jouer(cle, () => ecouterPrononciationAction(m, p, moment, voixEcoute));
    if (r && moment === "apres") setEcouteApres(cleApres);
  }

  function enregistrer() {
    const valeurPortee = portee.startsWith("voix:") ? { voixId: portee.slice(5) } : portee.startsWith("perso:") ? { personnageId: portee.slice(6) } : undefined;
    const donnees = { mot: m, prononciation: p, ecriture: ecriture.trim() || undefined, portee: valeurPortee, source, ecoutee: ecouteApres === cleApres };
    demarrer(async () => {
      const r = existante ? await modifierPrononciationAction(existante.id, donnees) : await ajouterPrononciationAction(donnees);
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.succes(existante ? `« ${m} » modifié` : `« ${m} » ajouté`, existante && (existante.mot !== m || existante.prononciation !== p) ? "L'ancienne façon de dire est dans « Archivés »." : "La voix le dira ainsi dans vos prochaines vidéos.");
      onEnregistree?.({ id: r.donnees.id, mot: m, prononciation: p });
      onOuverteChange(false);
    });
  }

  const personnages = [...new Map(voix.map((v) => [v.personnageId, v.personnage])).entries()];
  const optionsPortee = [
    { valeur: "toutes", libelle: "Toutes les voix" },
    ...voix.map((v) => ({ valeur: `voix:${v.id}`, libelle: v.nom, detail: personnages.length > 1 ? v.personnage : undefined })),
    ...(personnages.length > 1 ? personnages.map(([id, nom]) => ({ valeur: `perso:${id}`, libelle: nom, detail: "personnage" })) : []),
  ];
  const resultat = ecoute.dernier;

  return (
    <FeuilleBas
      ouverte={ouverte}
      onOuverteChange={onOuverteChange}
      titre={existante ? "Modifier le mot" : "Nouveau mot"}
      pied={
        <Bouton taille="lg" pleineLargeur icone="coche" chargement={enCours} disabled={!m || !p} onClick={enregistrer}>
          {existante ? "Enregistrer" : "Ajouter"}
        </Bouton>
      }
    >
      <div className="grid gap-4">
        <Champ libelle="Le mot, tel qu'il s'écrit" value={mot} onChange={(e) => setMot(e.target.value)} placeholder="Teleos" maxLength={60} grand autoFocus={!initial?.mot && !existante} />
        <div>
          <Champ libelle="Comment le dire" value={dit} onChange={(e) => setDit(e.target.value)} placeholder="té-lé-osse" maxLength={120} icone="son" />
          {suggestion && (
            <button type="button" onClick={() => setDit(suggestion)} className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-orange/30 bg-orange-doux px-3 text-sm font-semibold text-orange-vif">
              <Icone nom="etincelles" size={14} />« {suggestion} »
            </button>
          )}
        </div>

        {/* ▶ avant / après : la même phrase type, lue par votre voix. */}
        <div className="grid grid-cols-2 gap-2">
          <BoutonEcoute libelle="Avant" detail="comme aujourd'hui" actif={ecoute.joue?.startsWith("avant|") ?? false} chargement={ecoute.enCours?.startsWith("avant|") ?? false} disabled={!m} onClick={() => void ecouter("avant")} />
          <BoutonEcoute libelle="Après" detail="avec votre façon" principal actif={ecoute.joue === cleApres} chargement={ecoute.enCours === cleApres} disabled={!m || !p} onClick={() => void ecouter("apres")} />
        </div>
        <p className="-mt-2 flex min-h-5 items-center gap-2 text-xs text-texte-faible">
          {resultat ? (
            resultat.simulee ? (
              <>
                <PastilleEssai /> son de démonstration, rien n&apos;a été payé
              </>
            ) : (
              <>
                <Icone nom="euro" size={12} />
                {formaterMontant(resultat.cout)} · {resultat.voix}
              </>
            )
          ) : (
            <>« Chez {m || "…"}, nous vous expliquons tout simplement. » · quelques centimes</>
          )}
        </p>

        {variantes.length > 0 && (
          <p className="text-xs text-texte-faible">
            Reconnu aussi : <span className="text-texte-doux">{variantes.join(" · ")}</span>
          </p>
        )}

        <details className="group rounded-carte border border-trait bg-surface-1" open={!!existante?.ecriture || !!existante?.portee}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold text-texte-doux">
            <Icone nom="curseurs" size={15} />
            Sous-titres et voix
            <Icone nom="chevron-bas" size={16} className="ml-auto transition-transform group-open:rotate-180" />
          </summary>
          <div className="grid gap-4 px-4 pb-4">
            <Champ libelle="Dans les sous-titres, écrire" aide="Laissez vide pour garder le mot tel quel." value={ecriture} onChange={(e) => setEcriture(e.target.value)} placeholder={m || "35 h"} maxLength={60} icone="sous-titres" />
            {optionsPortee.length > 1 && <SelecteurPastilles libelle="Pour quelle voix" options={optionsPortee} valeur={portee} onChange={setPortee} />}
          </div>
        </details>
      </div>
    </FeuilleBas>
  );
}

/** Gros bouton ▶ d'écoute (cible ≥ 44 px). */
export function BoutonEcoute({
  libelle,
  detail,
  actif,
  chargement,
  principal,
  disabled,
  onClick,
  className,
}: {
  libelle: string;
  detail?: string;
  actif: boolean;
  chargement: boolean;
  principal?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || chargement}
      aria-pressed={actif}
      className={cn(
        "flex min-h-14 items-center gap-2.5 rounded-carte border px-3 text-left transition-colors disabled:opacity-50",
        principal ? "border-orange/40 bg-orange-doux text-texte hover:border-orange" : "border-trait bg-surface-2 text-texte hover:border-trait-fort",
        actif && "border-orange",
        className,
      )}
    >
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", principal ? "bg-orange text-sur-orange" : "bg-surface-3 text-orange-vif")}>
        <Icone nom={chargement ? "chargement" : actif ? "volume" : "lecture"} size={16} className={cn(chargement && "animate-spin")} />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold leading-tight">{libelle}</span>
        {detail && <span className="block truncate text-xs text-texte-faible">{detail}</span>}
      </span>
    </button>
  );
}
