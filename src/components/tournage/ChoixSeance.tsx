"use client";

/**
 * Préparer une séance de tournage (lot G4c, B.6 n° 16) : cocher les versions « je lis » ou « j'improvise » à filmer,
 * puis « Filmer les N ». L'ordre de passage (groupé par format) est calculé par le studio.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { creerSeanceAction } from "@/app/(studio)/ecrire/tournage/actions";
import type { VersionTournable } from "@/domaine/tournage";
import { Bouton } from "@/components/ui/Bouton";
import { BarreActionCollee } from "@/components/ui/BarreActionCollee";
import { EtatVide } from "@/components/ui/EtatVide";
import { Icone } from "@/components/ui/Icone";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { notifier } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

export interface SeanceResumee {
  id: string;
  rangees: number;
  total: number;
}

export function ChoixSeance({ versions, preselection, seances }: { versions: VersionTournable[]; preselection: string[]; seances: SeanceResumee[] }) {
  const router = useRouter();
  const [choisies, setChoisies] = useState<string[]>(() => preselection.filter((id) => versions.some((v) => v.id === id)));
  const [enCours, demarrer] = useTransition();

  // Une carte par sujet, ses versions en pastilles de réseau.
  const sujets = versions.reduce<{ id: string; titre: string; numero?: number; versions: VersionTournable[] }[]>((acc, v) => {
    const g = acc.find((x) => x.id === v.scriptMaitreId);
    if (g) g.versions.push(v);
    else acc.push({ id: v.scriptMaitreId, titre: v.titre, numero: v.numero, versions: [v] });
    return acc;
  }, []);
  const basculer = (id: string) => setChoisies((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const lancer = () =>
    demarrer(async () => {
      const r = await creerSeanceAction(choisies);
      if (!r.ok) return void notifier.erreur(r.message);
      router.push(`/ecrire/tournage/${r.donnees.id}`);
    });

  return (
    <div className="space-y-6">
      {seances.length > 0 && (
        <section aria-label="Séances en cours" className="flex gap-3 overflow-x-auto pb-1">
          {seances.map((s) => (
            <Link key={s.id} href={`/ecrire/tournage/${s.id}`} className="flex min-w-[160px] flex-col gap-2 rounded-carte border border-trait bg-surface-1 p-4 hover:border-orange">
              <span className="flex items-center gap-2 text-sm font-semibold text-texte">
                <Icone nom="clap" size={16} className="text-orange-vif" />
                Reprendre
              </span>
              <span className="font-titre text-2xl font-bold text-texte">
                {s.rangees}/{s.total}
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                <span className="block h-full rounded-full bg-sauge" style={{ width: `${(100 * s.rangees) / Math.max(1, s.total)}%` }} />
              </span>
            </Link>
          ))}
        </section>
      )}

      {versions.length === 0 ? (
        <EtatVide
          icone="camera"
          titre="Rien à filmer"
          phrase="Validez une version « Je lis » pour la filmer ici."
          action={
            <Bouton asChild variante="secondaire" icone="ecrire">
              <Link href="/ecrire">Mes scripts</Link>
            </Bouton>
          }
        />
      ) : (
        <ul className="space-y-3">
          {sujets.map((g) => (
            <li key={g.id} className={cn("rounded-carte border bg-surface-1 p-4", g.versions.some((v) => choisies.includes(v.id)) ? "border-orange" : "border-trait")}>
              <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-texte">{g.titre}</p>
              <p className="mt-1 text-xs text-texte-faible">
                {g.numero !== undefined && <span className="font-mono">n° {g.numero} · </span>}
                {g.versions[0].mode === "teleprompteur" ? "Je lis" : "J'improvise"} · ≈ {g.versions[0].dureeSec} s
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {g.versions.map((v) => {
                  const coche = choisies.includes(v.id);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={coche}
                      aria-label={`${v.code}${coche ? " (choisie)" : ""}`}
                      onClick={() => basculer(v.id)}
                      className={cn("relative rounded-2xl p-1 transition-colors", coche ? "bg-orange" : "bg-transparent hover:bg-surface-2")}
                    >
                      <LogoReseau reseau={v.reseau} taille="lg" className={cn(coche && "border-transparent")} />
                      {coche && (
                        <span aria-hidden className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-sur-orange text-orange">
                          <Icone nom="coche" size={12} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}

      {versions.length > 0 && (
        <BarreActionCollee>
          <Bouton taille="lg" icone="camera" disabled={!choisies.length} chargement={enCours} onClick={lancer}>
            {choisies.length ? `Filmer ${choisies.length > 1 ? `les ${choisies.length}` : "celle-ci"}` : "Choisissez"}
          </Bouton>
        </BarreActionCollee>
      )}
    </div>
  );
}
