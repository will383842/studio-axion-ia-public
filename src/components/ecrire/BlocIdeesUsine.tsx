"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ecrireSujetUsineAction, ideesDuComiteAction, listerMetiersUsineAction, proposerIdeesUsineAction } from "@/app/(studio)/ecrire/usine/actions";
import { notifier } from "@/components/ui/Toast";
import type { IdeesDuComite, IdeeUsine, MetierUsine } from "@/domaine/usine";
import { RESEAUX_DECLINAISON } from "@/reseaux/codes";
import { VueIdeesUsine, type EtatFiltresUsine } from "./VueIdeesUsine";

/** « Idées de l'usine » : le serveur parle à l'usine ; ici, seulement des actions serveur (aucun secret côté navigateur). */
export function BlocIdeesUsine() {
  const router = useRouter();
  const [filtres, setFiltres] = useState<EtatFiltresUsine>({ metiers: [], tailles: [], reseaux: [...RESEAUX_DECLINAISON] });
  const [metiers, setMetiers] = useState<MetierUsine[]>([]);
  const [idees, setIdees] = useState<IdeeUsine[]>([]);
  // Lecture seule de ce que le comité a déjà jugé (tâche quotidienne) : jamais de jugement lancé d'ici.
  const [comite, setComite] = useState<IdeesDuComite | undefined>(undefined);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ecritureEn, setEcritureEn] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  useEffect(() => {
    let vivant = true;
    void listerMetiersUsineAction().then((r) => vivant && r.ok && setMetiers(r.donnees));
    void ideesDuComiteAction().then((r) => vivant && r.ok && setComite(r.donnees));
    return () => {
      vivant = false;
    };
  }, []);

  function proposer() {
    setErreur(null);
    demarrer(async () => {
      const r = await proposerIdeesUsineAction({ type: "video", ...filtres });
      if (r.ok) setIdees(r.donnees);
      else setErreur(r.message);
    });
  }

  async function ecrire(i: IdeeUsine) {
    setEcritureEn(i.signature);
    const r = await ecrireSujetUsineAction(i, filtres.reseaux);
    setEcritureEn(null);
    if (!r.ok) return notifier.erreur(r.message);
    if (r.donnees.rappelUsine) notifier.info("Sujet créé", "L'usine n'a pas été prévenue : à refaire plus tard.");
    router.push(`/ecrire/sujets/${r.donnees.id}`);
  }

  return <VueIdeesUsine filtres={filtres} onFiltres={setFiltres} metiers={metiers} idees={idees} enCours={enCours} ecritureEn={ecritureEn} erreur={erreur} onProposer={proposer} onEcrire={(i) => void ecrire(i)} comite={comite} />;
}
