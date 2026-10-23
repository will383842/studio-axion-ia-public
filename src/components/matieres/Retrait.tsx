"use client";

import { useState } from "react";
import { deprogrammeeAction } from "@/app/(studio)/ecrire/matieres/actions";
import type { ImpactRetrait, MotifRetrait } from "@/services/matieres";
import { QUE_FAIRE_PUBLIEE, type CategorieTouchee } from "@/domaine/matieres";
import { Bouton, Icone, LogoReseau, notifier, type NomIcone } from "@/components/ui";
import { cn } from "@/lib/cn";

export const MOTIFS: { valeur: MotifRetrait; libelle: string; icone: NomIcone }[] = [
  { valeur: "accord-retire", libelle: "Accord retiré", icone: "bouclier" },
  { valeur: "faux", libelle: "C'est faux", icone: "attention" },
  { valeur: "dementi", libelle: "Démenti", icone: "alerte" },
  { valeur: "autre", libelle: "Autre", icone: "info" },
];

/** Motif en un toucher, puis « Retirer » (rien n'est effacé). */
export function ChoixMotif({ envoi, onRetirer }: { envoi: boolean; onRetirer: (m: MotifRetrait) => void }) {
  const [motif, setMotif] = useState<MotifRetrait | null>(null);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {MOTIFS.map((m) => (
          <button
            key={m.valeur}
            type="button"
            aria-pressed={motif === m.valeur}
            onClick={() => setMotif(m.valeur)}
            className={cn(
              "flex min-h-12 items-center gap-2 rounded-2xl border px-3 text-sm font-semibold",
              motif === m.valeur ? "border-brique bg-brique-doux text-brique" : "border-trait bg-surface-1 text-texte",
            )}
          >
            <Icone nom={m.icone} size={16} />
            {m.libelle}
          </button>
        ))}
      </div>
      <Bouton variante="danger" pleineLargeur icone="archive" chargement={envoi} disabled={!motif} onClick={() => motif && onRetirer(motif)}>
        Retirer
      </Bouton>
    </div>
  );
}

const GROUPES: { categorie: CategorieTouchee; titre: string; icone: NomIcone; ton: string }[] = [
  { categorie: "a-completer", titre: "À compléter", icone: "ecrire", ton: "text-ambre" },
  { categorie: "a-revoir", titre: "À revoir", icone: "oeil", ton: "text-ambre" },
  { categorie: "programmee", titre: "Programmées", icone: "calendrier", ton: "text-orange-vif" },
  { categorie: "publiee", titre: "Publiées", icone: "envoyer", ton: "text-brique" },
];

/** Les versions touchées par un retrait, rangées par geste à faire. Déprogrammer : un toucher par publication. */
export function VersionsTouchees({ impact }: { impact: ImpactRetrait }) {
  const [faites, setFaites] = useState<string[]>([]);
  if (!impact.versions.length)
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-sauge-doux p-4 text-sm font-semibold text-sauge">
        <Icone nom="valide" size={18} />
        Aucune version ne l&apos;utilise.
      </p>
    );
  async function deprogrammer(id: string) {
    const r = await deprogrammeeAction(id);
    if (!r.ok) return notifier.erreur(r.message);
    setFaites((f) => [...f, id]);
  }
  return (
    <div className="space-y-4">
      {GROUPES.map((g) => {
        const liste = impact.versions.filter((v) => v.categorie === g.categorie);
        if (!liste.length) return null;
        return (
          <section key={g.categorie}>
            <h3 className={cn("mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider", g.ton)}>
              <Icone nom={g.icone} size={14} />
              {g.titre} · {liste.length}
            </h3>
            <ul className="space-y-2">
              {liste.map((v) => (
                <li key={v.varianteId} className="rounded-2xl border border-trait bg-surface-1 p-3">
                  <div className="flex items-center gap-2.5">
                    <LogoReseau reseau={v.reseau} taille="sm" />
                    <span className="font-mono text-sm font-semibold text-texte">{v.code}</span>
                  </div>
                  {v.categorie === "programmee" &&
                    v.publications.map((p) =>
                      faites.includes(p.id) ? (
                        <p key={p.id} className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-sauge">
                          <Icone nom="coche" size={15} />
                          Déprogrammée
                        </p>
                      ) : (
                        <Bouton key={p.id} variante="secondaire" taille="md" pleineLargeur className="mt-2" icone="calendrier" onClick={() => deprogrammer(p.id)}>
                          Déprogrammée dans Buffer
                        </Bouton>
                      ),
                    )}
                </li>
              ))}
            </ul>
            {g.categorie === "publiee" && (
              <ol className="mt-2 space-y-1.5 rounded-2xl bg-surface-2 p-3 text-sm text-texte">
                {QUE_FAIRE_PUBLIEE.map((q, i) => (
                  <li key={q} className="flex gap-2">
                    <span className="font-bold text-texte-faible">{i + 1}.</span>
                    {q}
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}
