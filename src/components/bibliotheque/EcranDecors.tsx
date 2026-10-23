"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { garderPropositionAction } from "@/components/decors/actions";
import { FeuilleDecor } from "@/components/decors/FeuilleDecor";
import { FeuilleDemandeDecor } from "@/components/decors/FeuilleDemandeDecor";
import { VignetteDecor } from "@/components/decors/VignetteDecor";
import { Bouton, EnTeteSection, Icone, notifier, Pastille } from "@/components/ui";
import { RECURRENTS_MAX } from "@/domaine/decors";
import { cn } from "@/lib/cn";
import type { EcranDecors as DonneesEcran, VueDecor } from "@/services/decors";

/**
 * « MES DÉCORS » (lot B1, `decors/CATALOGUE-DECORS.md`) : décors récurrents (3 à 5), vos demandes (3 propositions sur
 * le double, on en garde une), décors réalistes (fabriqués avec votre double au premier usage), réserve, rangés.
 * Chaque décor est montré SUR le double, jamais sur un décor vide.
 */
export function EcranDecors({ donnees, ajouterAuDepart }: { donnees: DonneesEcran; ajouterAuDepart?: boolean }) {
  const router = useRouter();
  const [demande, setDemande] = useState(!!ajouterAuDepart);
  const [ouvert, setOuvert] = useState<VueDecor | null>(null);
  const [voirReserve, setVoirReserve] = useState(false);
  const [enCours, demarrer] = useTransition();

  // Propositions groupées par demande ; un groupe sans choix est présenté en premier.
  const groupes = new Map<string, VueDecor[]>();
  for (const d of donnees.demandes) {
    const cle = d.demande?.groupe.slice().sort().join("|") || d.id;
    groupes.set(cle, [...(groupes.get(cle) ?? []), d]);
  }
  // Dans un groupe, l'ordre de la demande (dorée, jour, soir).
  const rang = (d: VueDecor) => d.demande?.groupe.indexOf(d.id) ?? 0;
  const aChoisir = [...groupes.values()].filter((g) => g.every((d) => !d.demande?.retenu)).map((g) => [...g].sort((a, b) => rang(a) - rang(b)));
  const gardes = donnees.demandes.filter((d) => d.demande?.retenu);

  function garder(id: string) {
    demarrer(async () => {
      const r = await garderPropositionAction(id);
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.succes("Décor gardé", r.donnees.ranges.length ? "Les autres propositions sont rangées." : undefined);
      router.refresh();
    });
  }

  const carte = (d: VueDecor) => (
    <li key={d.id}>
      <button type="button" onClick={() => setOuvert(d)} className="block w-full text-left" aria-label={`${d.nom}, ${d.libelleEtat}`}>
        <div className="relative">
          <VignetteDecor surDouble={d.surDouble} image={d.image} silhouette={d.surDouble ? undefined : donnees.silhouette} alt={d.nom} />
          <span className="absolute left-1.5 top-1.5 flex flex-wrap gap-1">
            {d.code && <Pastille>{d.code}</Pastille>}
            {d.etat !== "fond-neutre" && d.etat !== "photo" && <Pastille ton={d.ton}>{d.libelleEtat}</Pastille>}
          </span>
          {d.defautAvocat && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">Défaut</span>}
        </div>
        <p className="mt-1.5 truncate text-xs font-semibold text-texte">{d.nom}</p>
      </button>
    </li>
  );

  return (
    <div className="space-y-7 pb-24">
      <button type="button" onClick={() => setDemande(true)} className="flex min-h-14 w-full items-center gap-3 rounded-carte border border-orange/40 bg-orange-doux px-4 text-left">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-orange/20 text-orange-vif">
          <Icone nom="etincelles" size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-texte">Demander un décor</span>
          <span className="block text-xs text-texte-faible">Une phrase, 3 propositions sur votre double</span>
        </span>
        <Icone nom="chevron-droite" size={16} className="text-orange-vif" />
      </button>

      {aChoisir.map((g) => (
        <section key={g.map((d) => d.id).join("|")}>
          <EnTeteSection titre="Choisissez-en un" />
          <p className="-mt-2 mb-3 text-sm text-texte-faible">« {g[0].demande?.texte} »</p>
          <ul className="grid grid-cols-3 gap-2">
            {g.map((d) => (
              <li key={d.id} className="space-y-1.5">
                <button type="button" onClick={() => setOuvert(d)} className="block w-full" aria-label={d.nom}>
                  <VignetteDecor surDouble={d.surDouble} image={d.image} silhouette={d.surDouble ? undefined : donnees.silhouette} alt={d.nom} />
                </button>
                <p className="truncate text-[11px] text-texte-faible">{d.ambiance}</p>
                <Bouton pleineLargeur variante="contour" chargement={enCours} onClick={() => garder(d.id)}>
                  Garder
                </Bouton>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section>
        <EnTeteSection titre="Récurrents" compteur={donnees.recurrents.length} />
        <p className="-mt-2 mb-3 text-sm text-texte-faible">{`3 à ${RECURRENTS_MAX} décors : votre chaîne se reconnaît.`}</p>
        <ul className="grid grid-cols-3 gap-2">{donnees.recurrents.map(carte)}</ul>
      </section>

      {gardes.length > 0 && (
        <section>
          <EnTeteSection titre="Vos décors" compteur={gardes.length} />
          <ul className="grid grid-cols-3 gap-2">{gardes.map(carte)}</ul>
        </section>
      )}

      <section>
        <EnTeteSection titre="Réalistes" compteur={donnees.realistes.length} />
        <p className="-mt-2 mb-3 text-sm text-texte-faible">Fabriqués avec votre double au premier usage.</p>
        <ul className="grid grid-cols-3 gap-2">{donnees.realistes.map(carte)}</ul>
      </section>

      {donnees.autres.length > 0 && (
        <section>
          <EnTeteSection titre="Autres" compteur={donnees.autres.length} />
          <ul className="grid grid-cols-3 gap-2">{donnees.autres.map(carte)}</ul>
        </section>
      )}

      {(donnees.reserve.length > 0 || donnees.ranges.length > 0) && (
        <section>
          <button type="button" onClick={() => setVoirReserve((v) => !v)} className="flex min-h-11 w-full items-center justify-between text-sm font-semibold text-texte-doux" aria-expanded={voirReserve}>
            Réserve et rangés ({donnees.reserve.length + donnees.ranges.length})
            <Icone nom="chevron-bas" size={16} className={cn("transition-transform", voirReserve && "rotate-180")} />
          </button>
          {voirReserve && <ul className="mt-3 grid grid-cols-3 gap-2">{[...donnees.reserve, ...donnees.ranges].map(carte)}</ul>}
        </section>
      )}

      <FeuilleDemandeDecor ouverte={demande} onOuverteChange={setDemande} />
      <FeuilleDecor decor={ouvert} silhouette={donnees.silhouette} onFermer={() => setOuvert(null)} />
    </div>
  );
}
