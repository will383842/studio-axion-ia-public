"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { creerPartageAction, revoquerPartageAction } from "@/app/(studio)/videos/actions";
import type { PartageVue } from "@/components/publication/ContexteVideo";
import { Bouton } from "@/components/ui/Bouton";
import { BoutonCopier } from "@/components/ui/BoutonCopier";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone } from "@/components/ui/Icone";
import { Interrupteur } from "@/components/ui/Interrupteur";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { notifier } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { ilYA } from "@/lib/dates";

const DUREES = [
  { valeur: 1, libelle: "24 h" },
  { valeur: 7, libelle: "7 jours" },
  { valeur: 30, libelle: "30 jours" },
  { valeur: 0, libelle: "Sans fin" },
];

function urlComplete(chemin: string, origine: string) {
  return `${origine}${chemin}`;
}

/**
 * Contenu de la feuille « Partager » (B.8 #9) : durée du lien, téléchargement autorisé, création + copie,
 * partage natif du téléphone, liens actifs avec leurs vues, Révoquer. Indépendant de la fiche vidéo : la fiche
 * (`FeuillePartager`) et les écrans « Vos vidéos » / « Vos fichiers » (`BoutonLienPrive`) l'utilisent.
 */
export function PartagerVideo({ videoId, titre, partages, ouverte, onOuverteChange }: { videoId: string; titre: string; partages: PartageVue[]; ouverte: boolean; onOuverteChange: (ouverte: boolean) => void }) {
  const router = useRouter();
  const [duree, setDuree] = useState(7);
  const [telechargement, setTelechargement] = useState(false);
  const [dernier, setDernier] = useState<string | null>(null);
  const [origine, setOrigine] = useState("");
  const [peutPartager, setPeutPartager] = useState(false);
  const [creation, demarrerCreation] = useTransition();
  const [revocation, setRevocation] = useState<string | null>(null);

  // window n'existe qu'au navigateur : origine du lien et partage natif lus après le montage.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique d'API du navigateur
    setOrigine(window.location.origin);
    setPeutPartager(typeof navigator.share === "function");
  }, []);

  const actifs = partages.filter((p) => p.actif);
  const inactifs = partages.filter((p) => !p.actif);

  function creer() {
    demarrerCreation(async () => {
      const r = await creerPartageAction(videoId, { dureeJours: duree || null, telechargementAutorise: telechargement });
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      const url = urlComplete(r.donnees.chemin, window.location.origin);
      setDernier(url);
      try {
        await navigator.clipboard.writeText(url);
        notifier.succes("Lien copié");
      } catch {
        notifier.succes("Lien créé");
      }
      router.refresh();
    });
  }

  async function partagerNatif(url: string) {
    try {
      await navigator.share({ title: titre, url });
    } catch {
      /* partage annulé */
    }
  }

  async function revoquer(p: PartageVue) {
    setRevocation(p.id);
    const r = await revoquerPartageAction(videoId, p.id);
    setRevocation(null);
    if (!r.ok) {
      notifier.erreur(r.message);
      return;
    }
    if (dernier?.endsWith(p.chemin)) setDernier(null);
    notifier.succes("Lien révoqué", "Il ne fonctionne plus.");
    router.refresh();
  }

  return (
    <FeuilleBas
      ouverte={ouverte}
      onOuverteChange={(o) => {
        onOuverteChange(o);
        if (!o) setDernier(null);
      }}
      titre="Lien privé"
      pied={
        dernier ? (
          <div className="flex gap-2">
            {peutPartager && (
              <Bouton variante="secondaire" taille="lg" icone="partager" onClick={() => partagerNatif(dernier)}>
                Envoyer
              </Bouton>
            )}
            <BoutonCopier texte={dernier} libelle="Copier le lien" className="min-h-12 flex-1" />
          </div>
        ) : (
          <Bouton taille="lg" pleineLargeur icone="lien" chargement={creation} onClick={creer}>
            Créer et copier le lien
          </Bouton>
        )
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {dernier ? (
          <motion.div key="cree" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="relative isolate overflow-hidden rounded-carte border border-orange/40 bg-surface-2 p-5 text-center">
            <div aria-hidden className="absolute inset-0 -z-10 lueur-forte" />
            <span className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-orange text-sur-orange shadow-orange">
              <Icone nom="coche" size={26} strokeWidth={3} />
            </span>
            <p className="font-titre text-lg text-texte">Lien prêt</p>
            <p className="mt-2 break-all rounded-xl bg-fond/60 px-3 py-2 font-mono text-sm text-texte-doux">{dernier}</p>
          </motion.div>
        ) : (
          <motion.div key="reglages" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
            <SelecteurPastilles<number> libelle="Valable" valeur={duree} onChange={setDuree} options={DUREES} />
            <Interrupteur libelle="Autoriser le téléchargement" icone="telecharger" coche={telechargement} onChange={setTelechargement} />
          </motion.div>
        )}
      </AnimatePresence>

      {actifs.length > 0 && (
        <section className="mt-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-texte-faible">Liens actifs</p>
          <ul className="space-y-2">
            {actifs.map((p) => (
              <LigneLien key={p.id} p={p} url={urlComplete(p.chemin, origine)} onRevoquer={() => revoquer(p)} enCours={revocation === p.id} />
            ))}
          </ul>
        </section>
      )}
      {inactifs.length > 0 && (
        <details className="group mt-5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-texte-faible">
            <Icone nom="chevron-droite" size={16} className="transition-transform group-open:rotate-90" />
            Anciens liens ({inactifs.length})
          </summary>
          <ul className="mt-2 space-y-2 opacity-70">
            {inactifs.map((p) => (
              <LigneLien key={p.id} p={p} url={urlComplete(p.chemin, origine)} />
            ))}
          </ul>
        </details>
      )}
    </FeuilleBas>
  );
}

function LigneLien({ p, url, onRevoquer, enCours }: { p: PartageVue; url: string; onRevoquer?: () => void; enCours?: boolean }) {
  // Couper un lien est définitif : une confirmation courte d'abord (E2E-1 n° 29).
  const [confirmer, setConfirmer] = useState(false);
  const etat = p.revoqueLe ? "Révoqué" : p.expireLe && !p.actif ? "Expiré" : p.expireLe ? `Expire ${ilYA(p.expireLe)}` : "Sans fin";
  return (
    <li className="flex min-h-16 items-center gap-3 rounded-2xl border border-trait bg-surface-2 p-2 pl-3">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", p.actif ? "bg-orange-doux text-orange-vif" : "bg-surface-3 text-texte-faible")}>
        <Icone nom={p.actif ? "lien" : "cadenas"} size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-sm text-texte">{p.chemin}</span>
        <span className="flex items-center gap-2 text-xs text-texte-faible">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Icone nom="oeil" size={12} />
            {p.vues}
          </span>
          {p.telechargementAutorise && <Icone nom="telecharger" size={12} aria-label="Téléchargement autorisé" />}
          <span>{etat}</span>
        </span>
      </span>
      {p.actif && !confirmer && (
        <>
          <BoutonCopier compact texte={url} libelle={`Copier ${p.chemin}`} />
          <Bouton variante="fantome" onClick={() => setConfirmer(true)} className="px-3 text-brique hover:bg-brique-doux hover:text-brique">
            Révoquer
          </Bouton>
        </>
      )}
      {p.actif && confirmer && (
        <span role="group" aria-label="Couper ce lien pour toujours ?" className="flex shrink-0 items-center gap-1">
          <Bouton variante="fantome" className="px-3" onClick={() => setConfirmer(false)}>
            Garder
          </Bouton>
          <Bouton variante="danger" chargement={enCours} onClick={onRevoquer} className="px-3">
            Couper
          </Bouton>
        </span>
      )}
    </li>
  );
}
