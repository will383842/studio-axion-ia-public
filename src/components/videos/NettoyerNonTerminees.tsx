"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { listerANettoyerAction, nettoyerVideosAction } from "@/app/(studio)/videos/actions";
import { Bouton } from "@/components/ui/Bouton";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { notifier } from "@/components/ui/Toast";
import { messageCorbeille } from "@/domaine/corbeille";
import { STATUTS_VIDEO } from "@/domaine/libelles";

type Ligne = { id: string; titre: string; statut: string; formatId: string; modifieLe: string };

/**
 * « Nettoyer les vidéos non terminées » : brouillons, échecs et annulées de plus de 24 h (jamais une prête ni une en
 * fabrication). Rien ne part tout seul : la feuille LISTE d'abord (cases cochées par défaut, compteur), puis un clic
 * confirmé met TOUTES les vidéos cochées à la corbeille (restaurable 30 jours). `formatId` : la page d'un générateur
 * ne propose que les vidéos de son format.
 */
export function NettoyerNonTerminees({ formatId }: { formatId?: string }) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState(false);
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [cochees, setCochees] = useState<Set<string>>(new Set());
  const [enCours, demarrer] = useTransition();

  async function ouvrir() {
    setOuverte(true);
    setLignes(null);
    const r = await listerANettoyerAction();
    if (!r.ok) {
      notifier.erreur(r.message);
      setOuverte(false);
      return;
    }
    const liste = formatId ? r.donnees.filter((l) => l.formatId === formatId) : r.donnees;
    setLignes(liste);
    setCochees(new Set(liste.map((l) => l.id)));
  }

  function basculer(id: string) {
    setCochees((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const n = cochees.size;
  return (
    <>
      <Bouton variante="secondaire" icone="corbeille" onClick={() => void ouvrir()}>
        Nettoyer les vidéos non terminées
      </Bouton>
      <FeuilleBas
        ouverte={ouverte}
        onOuverteChange={setOuverte}
        titre="Nettoyer les vidéos non terminées"
        description="Elles iront à la corbeille, restaurables 30 jours. Aucune vidéo prête n'est concernée."
        pied={
          <div className="flex flex-col gap-2">
            <Bouton
              variante="danger"
              taille="lg"
              pleineLargeur
              disabled={!n}
              chargement={enCours}
              onClick={() =>
                demarrer(async () => {
                  const r = await nettoyerVideosAction([...cochees]);
                  if (!r.ok) {
                    notifier.erreur(r.message);
                    return;
                  }
                  setOuverte(false);
                  const { mises, refusees, brouillonsBuffer, pagesRetirees, messages } = r.donnees;
                  // Le message de CHAQUE refus (publication programmée, versions en attente…), pas une phrase en dur.
                  const reste = refusees ? ` ${refusees} vidéo${refusees > 1 ? "s sont restées" : " est restée"} : ${messages.join(" ")}` : "";
                  if (!mises) notifier.erreur(reste.trim() || "Rien n'a été mis à la corbeille.");
                  else notifier.succes("Nettoyage fait", `${messageCorbeille(mises, brouillonsBuffer, pagesRetirees)}${reste}`);
                  router.refresh();
                })
              }
            >
              {n ? `Mettre ${n} vidéo${n > 1 ? "s" : ""} à la corbeille` : "Rien de coché"}
            </Bouton>
            <Bouton variante="fantome" taille="lg" pleineLargeur onClick={() => setOuverte(false)}>
              Ne rien faire
            </Bouton>
          </div>
        }
      >
        {lignes === null ? (
          <p className="text-sm text-texte-doux" aria-busy="true">
            Je cherche les vidéos non terminées…
          </p>
        ) : lignes.length === 0 ? (
          <p className="text-sm text-texte-doux">Rien à nettoyer : aucune vidéo non terminée de plus de 24 h.</p>
        ) : (
          <>
            <p className="mb-2 text-sm font-semibold text-texte" aria-live="polite">
              {n} sur {lignes.length} cochée{n > 1 ? "s" : ""}
            </p>
            <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
              {lignes.map((l) => (
                <li key={l.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-carte px-2 py-1.5 hover:bg-surface-2">
                    <input type="checkbox" className="size-5 accent-orange" checked={cochees.has(l.id)} onChange={() => basculer(l.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] text-texte">{l.titre}</span>
                      <span className="text-xs text-texte-faible">{(STATUTS_VIDEO as Record<string, { libelle: string }>)[l.statut]?.libelle ?? l.statut}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </FeuilleBas>
    </>
  );
}
