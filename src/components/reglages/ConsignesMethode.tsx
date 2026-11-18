"use client";

import { useState, useTransition } from "react";
import { lireMethodeSiteAction } from "@/app/(studio)/reglages/base-connaissances/actions";
import { Bouton } from "@/components/ui/Bouton";
import type { ConsigneMethode } from "@/domaine/kb-site";

/**
 * Réglages › Base de connaissances : lecture de la Méthode du site (lecture seule). Chaque passage est une consigne
 * interne, montrée avec son identifiant : aucun bouton d'utilisation, de reprise ou de proposition.
 * Les textes arrivent déjà sans montant.
 */
export function ConsignesMethode({ allumee, branchee }: { allumee: boolean; branchee: boolean }) {
  const [sujet, setSujet] = useState("");
  const [consignes, setConsignes] = useState<ConsigneMethode[]>([]);
  const [message, setMessage] = useState("");
  const [lecture, demarrerLecture] = useTransition();

  function lire() {
    demarrerLecture(async () => {
      const r = await lireMethodeSiteAction(sujet);
      setConsignes(r.ok ? r.donnees.consignes : []);
      setMessage(r.ok ? r.donnees.message : r.message);
    });
  }

  if (!allumee) return <p className="rounded-2xl border border-trait p-4 text-sm text-texte-doux">Méthode éteinte. Allumez « Lire la Méthode du site » pour la consulter.</p>;
  if (!branchee) return <p className="rounded-2xl border border-trait p-4 text-sm text-texte-doux">La Méthode n&apos;est pas consultée pour l&apos;instant.</p>;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-trait p-4" aria-label="Lire la Méthode du site">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          lire();
        }}
      >
        <input
          type="text"
          value={sujet}
          onChange={(e) => setSujet(e.target.value)}
          maxLength={300}
          placeholder="Sujet"
          aria-label="Sujet"
          className="min-h-11 min-w-0 flex-1 rounded-full border border-trait-fort bg-surface-1 px-4 text-texte"
        />
        <Bouton type="submit" variante="secondaire" chargement={lecture} disabled={sujet.trim().length < 2}>
          Lire la Méthode
        </Bouton>
      </form>
      {message ? <p className="text-sm text-texte-doux">{message}</p> : null}
      <ul className="flex flex-col gap-2">
        {consignes.map((c) => (
          <li key={c.slug} className="flex flex-col gap-2 rounded-xl border border-trait p-3">
            <span className="text-sm font-semibold">Consigne interne, à ne pas publier</span>
            <span className="break-all text-xs text-texte-doux">{c.slug}</span>
            <span className="font-semibold">{c.titre}</span>
            <p className="whitespace-pre-line break-words text-sm text-texte-doux">{c.texte}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
