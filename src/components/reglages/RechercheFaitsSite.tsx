"use client";

import { useState, useTransition } from "react";
import { chercherFaitsSiteAction, proposerPreuveSiteAction } from "@/app/(studio)/reglages/base-connaissances/actions";
import { Bouton } from "@/components/ui/Bouton";
import type { FaitSite } from "@/domaine/kb-site";

/**
 * Réglages › Base de connaissances : recherche dans la base du site (lecture seule). Chaque résultat se propose comme
 * preuve « à valider » ; rien n'est utilisé avant votre validation. Les extraits arrivent déjà sans montant.
 */
export function RechercheFaitsSite({ allumee }: { allumee: boolean }) {
  const [q, setQ] = useState("");
  const [faits, setFaits] = useState<FaitSite[]>([]);
  const [message, setMessage] = useState("");
  const [proposes, setProposes] = useState<Record<string, boolean>>({});
  const [recherche, demarrerRecherche] = useTransition();
  const [envoi, demarrerEnvoi] = useTransition();

  function chercher() {
    demarrerRecherche(async () => {
      const r = await chercherFaitsSiteAction(q);
      setFaits(r.ok ? r.donnees.faits : []);
      setMessage(r.ok ? r.donnees.message : r.message);
    });
  }

  function proposer(f: FaitSite) {
    demarrerEnvoi(async () => {
      const r = await proposerPreuveSiteAction(f);
      if (r.ok) setProposes((p) => ({ ...p, [f.translationId]: true }));
      else setMessage(r.message);
    });
  }

  if (!allumee) return <p className="rounded-2xl border border-trait p-4 text-sm text-texte-doux">Lecture du site éteinte. Allumez « Lire la base du site » pour chercher.</p>;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-trait p-4" aria-label="Chercher dans la base du site">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          chercher();
        }}
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={200}
          placeholder="Que cherchez-vous sur le site ?"
          aria-label="Recherche dans la base du site"
          className="min-h-11 min-w-0 flex-1 rounded-full border border-trait-fort bg-surface-1 px-4 text-texte"
        />
        <Bouton type="submit" chargement={recherche} disabled={!q.trim()}>
          Chercher
        </Bouton>
      </form>
      {message ? <p className="text-sm text-texte-doux">{message}</p> : null}
      <ul className="flex flex-col gap-2">
        {faits.map((f) => (
          <li key={f.translationId} className="flex flex-col gap-2 rounded-xl border border-trait p-3">
            <span className="font-semibold">{f.title}</span>
            {f.excerpt ? <p className="text-sm text-texte-doux">{f.excerpt}</p> : null}
            {proposes[f.translationId] ? (
              <span className="text-sm">Proposé : à valider dans les preuves.</span>
            ) : (
              <Bouton type="button" variante="secondaire" disabled={envoi} onClick={() => proposer(f)}>
                Proposer comme preuve
              </Bouton>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
