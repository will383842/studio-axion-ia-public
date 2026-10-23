"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, useTransition } from "react";
import { BarreActionCollee, Bouton, BoutonIcone, Champ, EtatVide, Icone, notifier, SelecteurPastilles } from "@/components/ui";
import { cleMot } from "@/domaine/prononciations";
import type { Prononciation } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { ecouterPrononciationAction, rangerPrononciationAction, remettrePrononciationAction, validerEcouteAction } from "./actions";
import { CollerListe } from "./CollerListe";
import { FeuilleAjoutPrononciation, type VoixPortee } from "./FeuilleAjoutPrononciation";
import { useEcoute } from "./useEcoute";

type Tri = "alpha" | "recent" | "usage";

/**
 * PRONONCIATIONS (Bibliothèque) — n° 1 à 10 de `PRONONCIATIONS-SYSTEME.md` : recherche, tri (A → Z, récents, plus
 * utilisés), « utilisé dans N vidéos », ▶ écouter chaque mot, « À écouter » pour la liste de départ, ajout avec
 * écoute avant / après, collage d'une liste, modification (l'ancienne est archivée), archivage, restauration.
 */
export function GestionPrononciations({ liste, ranges, voix, ajouterAuDepart }: { liste: Prononciation[]; ranges: Prononciation[]; voix: VoixPortee[]; ajouterAuDepart?: boolean }) {
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState<Tri>("alpha");
  const [aEcouterSeulement, setAEcouterSeulement] = useState(false);
  const [ajout, setAjout] = useState(!!ajouterAuDepart);
  const [collage, setCollage] = useState(false);
  const [edition, setEdition] = useState<Prononciation | null>(null);
  const [retraitId, setRetraitId] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const ecoute = useEcoute();
  const nomsVoix = useMemo(() => new Map(voix.map((v) => [v.id, v.nom])), [voix]);
  const nomsPersonnages = useMemo(() => new Map(voix.map((v) => [v.personnageId, v.personnage])), [voix]);

  const aEcouter = liste.filter((p) => p.source === "depart" && !p.ecouteeLe);
  const affiches = useMemo(() => {
    const q = cleMot(recherche);
    const filtres = liste.filter((p) => (!aEcouterSeulement || (p.source === "depart" && !p.ecouteeLe)) && (!q || cleMot(p.mot).includes(q) || cleMot(p.prononciation).includes(q) || cleMot(p.ecriture ?? "").includes(q)));
    return [...filtres].sort((a, b) =>
      tri === "recent" ? b.creeLe.localeCompare(a.creeLe) : tri === "usage" ? (b.utilisations ?? 0) - (a.utilisations ?? 0) || a.mot.localeCompare(b.mot, "fr") : a.mot.localeCompare(b.mot, "fr"),
    );
  }, [liste, recherche, tri, aEcouterSeulement]);

  function ranger(p: Prononciation) {
    setRetraitId(p.id);
    demarrer(async () => {
      const r = await rangerPrononciationAction(p.id);
      setRetraitId(null);
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.succes(`« ${p.mot} » archivé`, "La voix ne l'applique plus. Retrouvez-le dans « Archivés ».");
    });
  }

  function remettre(p: Prononciation) {
    demarrer(async () => {
      const r = await remettrePrononciationAction(p.id);
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.succes(`« ${p.mot} » remis`);
    });
  }

  function valider(p: Prononciation) {
    demarrer(async () => {
      const r = await validerEcouteAction(p.id);
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.succes(`« ${p.mot} » validé`);
    });
  }

  function portee(p: Prononciation): string | null {
    if (p.portee?.voixId) return nomsVoix.get(p.portee.voixId) ?? "Une voix";
    if (p.portee?.personnageId) return nomsPersonnages.get(p.portee.personnageId) ?? "Un personnage";
    return null;
  }

  return (
    <div>
      {liste.length > 0 && (
        <div className="mb-4 grid gap-3">
          <Champ libelle="Chercher un mot" libelleMasque icone="loupe" type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Chercher un mot" />
          <div className="flex flex-wrap items-center gap-2">
            <SelecteurPastilles<Tri>
              libelle="Trier"
              libelleMasque
              options={[
                { valeur: "alpha", libelle: "A → Z" },
                { valeur: "recent", libelle: "Récents" },
                { valeur: "usage", libelle: "Plus utilisés" },
              ]}
              valeur={tri}
              onChange={setTri}
            />
            {aEcouter.length > 0 && (
              <button
                type="button"
                aria-pressed={aEcouterSeulement}
                onClick={() => setAEcouterSeulement((x) => !x)}
                className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors", aEcouterSeulement ? "border-ambre bg-ambre text-fond" : "border-ambre/30 bg-ambre-doux text-ambre")}
              >
                <Icone nom="casque" size={14} />À écouter · {aEcouter.length}
              </button>
            )}
          </div>
        </div>
      )}

      {affiches.length ? (
        <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          <AnimatePresence initial={false}>
            {affiches.map((p) => {
              const cle = `liste|${p.id}`;
              const nonEcoutee = p.source === "depart" && !p.ecouteeLe;
              const pour = portee(p);
              return (
                <motion.li
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: retraitId === p.id ? 0.4 : 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={cn("flex min-h-16 items-center gap-2 rounded-carte border bg-surface-1 py-2 pl-2 pr-1", nonEcoutee ? "border-ambre/40" : "border-trait")}
                >
                  <button
                    type="button"
                    aria-label={`Écouter « ${p.mot} »`}
                    onClick={() => void ecoute.jouer(cle, () => ecouterPrononciationAction(p.mot, p.prononciation, "apres", p.portee?.voixId))}
                    className="grid size-11 shrink-0 place-items-center rounded-full bg-orange-doux text-orange-vif transition-transform active:scale-95"
                  >
                    <Icone nom={ecoute.enCours === cle ? "chargement" : ecoute.joue === cle ? "volume" : "lecture"} size={17} className={cn(ecoute.enCours === cle && "animate-spin")} />
                  </button>
                  <button type="button" onClick={() => setEdition(p)} className="min-w-0 flex-1 rounded-lg px-1 py-1 text-left">
                    <span className="block truncate font-titre text-lg leading-tight text-texte">{p.mot}</span>
                    <span className="block truncate text-sm text-orange-vif">« {p.prononciation} »</span>
                    <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-texte-faible">
                      {p.ecriture && <span>écrit « {p.ecriture} »</span>}
                      {pour && <span>pour {pour}</span>}
                      <span>{p.utilisations ? `dans ${p.utilisations} vidéo${p.utilisations > 1 ? "s" : ""}` : "pas encore utilisé"}</span>
                    </span>
                  </button>
                  {nonEcoutee ? (
                    <Bouton variante="contour" icone="coche" onClick={() => valider(p)} disabled={enCours} className="shrink-0 px-3">
                      C&apos;est bon
                    </Bouton>
                  ) : (
                    <BoutonIcone icone="archive" libelle={`Archiver « ${p.mot} »`} onClick={() => ranger(p)} disabled={retraitId === p.id} />
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      ) : liste.length ? (
        <EtatVide compact icone="loupe" titre="Aucun mot trouvé" phrase="Essayez une autre orthographe, ou ajoutez-le." />
      ) : (
        <EtatVide icone="micro" titre="Aucune prononciation" phrase="Apprenez à la voix à dire « Axion-IA » comme vous." />
      )}

      {ranges.length > 0 && (
        <details className="group mt-6 rounded-carte border border-trait bg-surface-1">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold text-texte-doux">
            <Icone nom="archive" size={16} />
            Archivés ({ranges.length})
            <Icone nom="chevron-bas" size={16} className="ml-auto transition-transform group-open:rotate-180" />
          </summary>
          <ul className="grid gap-1 px-2 pb-2">
            {ranges.map((p) => (
              <li key={p.id} className="flex min-h-12 items-center gap-3 rounded-xl px-2">
                <span className="min-w-0 flex-1 truncate text-sm text-texte">
                  {p.mot} <span className="text-texte-faible">« {p.prononciation} »</span>
                </span>
                <Bouton variante="fantome" icone="actualiser" onClick={() => remettre(p)} disabled={enCours}>
                  Restaurer
                </Bouton>
              </li>
            ))}
          </ul>
        </details>
      )}

      <BarreActionCollee>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Bouton taille="lg" icone="plus" onClick={() => setAjout(true)}>
            Ajouter un mot
          </Bouton>
          <Bouton taille="lg" variante="secondaire" icone="copier" aria-label="Coller une liste" onClick={() => setCollage(true)}>
            Coller
          </Bouton>
        </div>
      </BarreActionCollee>

      <FeuilleAjoutPrononciation ouverte={ajout} onOuverteChange={setAjout} source="manuel" voix={voix} />
      <FeuilleAjoutPrononciation ouverte={!!edition} onOuverteChange={(o) => !o && setEdition(null)} existante={edition ?? undefined} source={edition?.source ?? "manuel"} voix={voix} />
      <CollerListe ouverte={collage} onOuverteChange={setCollage} />
    </div>
  );
}
