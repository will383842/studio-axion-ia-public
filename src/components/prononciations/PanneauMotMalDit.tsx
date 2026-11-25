"use client";

import { messageSansMontant } from "@/components/ui/ConfirmationPrix";
import { useEffect, useState, useTransition } from "react";
import { Bouton, Champ, Icone, notifier } from "@/components/ui";
import type { Id } from "@/domaine/types";
import { enregistrerMotMalDitAction, previsualiserMotMalDitAction, type ApercuMotMalDit } from "./actions-mot-mal-dit";
import { ecouterPrononciationAction } from "./actions";
import { BoutonEcoute } from "./FeuilleAjoutPrononciation";
import { useEcoute } from "./useEcoute";

export interface ProprietesPanneauMotMalDit {
  /** Phrases de la vidéo (texte lu), une par plan. */
  plans: { id: string; texte: string }[];
  /** Le mot mal dit, tel qu'il s'écrit. */
  mot: string;
  /** Réservé à une voix ou à un personnage (sinon : toutes les voix). */
  portee?: { voixId?: Id; personnageId?: Id };
  /** Après l'enregistrement : de quoi proposer « Refaire la phrase » plus loin. */
  onEnregistree?: (r: { id?: Id; mot: string; prononciation: string }) => void;
}

/**
 * « Ce mot est mal dit » (PRONONCIATION-b) : on écrit comment le mot se dit, on l'écoute AVANT / APRÈS, on voit les
 * phrases touchées (le texte écrit ne change pas) et on enregistre dans la liste des prononciations : ajouté, ou remplacé
 * (l'ancienne façon de dire reste dans « Archivés »). Monté nulle part pour l'instant.
 */
export function PanneauMotMalDit({ plans, mot, portee, onEnregistree }: ProprietesPanneauMotMalDit) {
  const [dit, setDit] = useState("");
  const [apercu, setApercu] = useState<ApercuMotMalDit | null>(null);
  const [enCours, demarrer] = useTransition();
  const ecoute = useEcoute();
  const m = mot.trim();
  const p = dit.trim();
  const voixEcoute = portee?.voixId;
  const cleApres = `apres|${m}|${p}|${voixEcoute ?? ""}`;

  // L'aperçu des phrases suit ce qui est écrit (un court délai, une seule demande à la fois).
  useEffect(() => {
    if (!m || !p) {
      const t = setTimeout(() => setApercu(null), 0);
      return () => clearTimeout(t);
    }
    let vivant = true;
    const t = setTimeout(async () => {
      const r = await previsualiserMotMalDitAction({ plans, mot: m, prononciation: p, ...(portee ? { portee } : {}) });
      if (vivant) setApercu(r.ok ? r.donnees : null);
    }, 350);
    return () => {
      vivant = false;
      clearTimeout(t);
    };
  }, [plans, m, p, portee]);

  async function ecouter(moment: "avant" | "apres") {
    const cle = moment === "avant" ? `avant|${m}|${voixEcoute ?? ""}` : cleApres;
    await ecoute.jouer(cle, () => ecouterPrononciationAction(m, p, moment, voixEcoute));
  }

  function enregistrer() {
    demarrer(async () => {
      const r = await enregistrerMotMalDitAction({ plans, mot: m, prononciation: p, ...(portee ? { portee } : {}) });
      if (!r.ok) return void notifier.erreur(messageSansMontant(r.message));
      if (r.donnees.action === "rien") return void notifier.erreur(messageSansMontant(r.donnees.message));
      notifier.succes(
        r.donnees.action === "modifier" ? `« ${m} » modifié` : `« ${m} » ajouté`,
        r.donnees.action === "modifier" ? "L'ancienne façon de dire est dans « Archivés »." : "La voix le dira ainsi dans vos prochaines vidéos.",
      );
      onEnregistree?.({ id: r.donnees.id, mot: m, prononciation: p });
      setDit("");
    });
  }

  const peutEnregistrer = !!m && !!p && apercu !== null && apercu.action !== "rien";

  return (
    <section className="grid gap-4" aria-label="Ce mot est mal dit">
      <h2 className="text-lg font-semibold">Ce mot est mal dit</h2>
      <p className="text-sm text-texte-doux">
        Le mot : <span className="font-semibold text-texte">{mot}</span>
      </p>
      <Champ libelle="Comment le dire" value={dit} onChange={(e) => setDit(e.target.value)} placeholder="té-lé-osse" maxLength={120} icone="son" />

      <div className="grid grid-cols-2 gap-2">
        <BoutonEcoute libelle="Avant" detail="comme aujourd'hui" actif={ecoute.joue?.startsWith("avant|") ?? false} chargement={ecoute.enCours?.startsWith("avant|") ?? false} disabled={!m} onClick={() => void ecouter("avant")} />
        <BoutonEcoute libelle="Après" detail="avec votre façon" principal actif={ecoute.joue === cleApres} chargement={ecoute.enCours === cleApres} disabled={!m || !p} onClick={() => void ecouter("apres")} />
      </div>

      {apercu && (
        <div className="grid gap-2 rounded-carte border border-trait bg-surface-1 p-4">
          <p className="text-sm font-semibold text-texte-doux">{apercu.message}</p>
          <ul className="grid gap-3">
            {apercu.phrases.map((ph) => (
              <li key={ph.planId} className="grid gap-1 text-sm">
                <span className="text-texte-faible">Écrit (ne change pas) : {ph.ecrit}</span>
                <span className="text-texte-faible">Lu aujourd&apos;hui : {ph.luAvant}</span>
                <span className="font-semibold text-texte">Lu ensuite : {ph.luApres}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Bouton taille="lg" pleineLargeur icone="coche" chargement={enCours} disabled={!peutEnregistrer} onClick={enregistrer}>
        {apercu?.action === "modifier" ? "Remplacer" : "Enregistrer"}
      </Bouton>
      <p className="flex items-center gap-2 text-xs text-texte-faible">
        <Icone nom="coche" size={14} />
        Le texte écrit et les sous-titres ne changent pas. Rien n&apos;est effacé.
      </p>
    </section>
  );
}
