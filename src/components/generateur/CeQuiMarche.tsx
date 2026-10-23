"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { importerMesuresAction } from "@/app/(studio)/mesures/ce-qui-marche/actions";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { Icone } from "@/components/ui/Icone";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { notifier } from "@/components/ui/Toast";
import { INDICATEURS, ordinal, type Axe, type RangVideo, type VideoProche } from "@/domaine/mesures-rangs";
import type { ReseauDeclinaison } from "@/domaine/types";
import { cn } from "@/lib/cn";
import type { CeQuiMarche as Donnees } from "@/services/mesures-completes";

const ORDRE_RESEAUX: ReseauDeclinaison[] = ["tiktok", "instagram", "youtube-shorts", "linkedin", "facebook"];
const AXES: { id: Exclude<Axe, "reseau">; libelle: string }[] = [
  { id: "structure", libelle: "Structure" },
  { id: "ouverture", libelle: "Ouverture" },
  { id: "format", libelle: "Format" },
];
const EN_COMMUN: Record<VideoProche["enCommun"][number], string> = { reseau: "réseau", format: "format", structure: "structure", ouverture: "ouverture" };

/** Nouveau sujet qui reprend la structure (et la famille d'accroche) d'une vidéo qui a marché. */
export function lienRefaire(structure: string, ouverture?: string): string {
  const q = new URLSearchParams({ structure, ...(ouverture ? { famille: ouverture } : {}) });
  return `/ecrire/atelier?${q.toString()}`;
}

/** « Refaire cette structure » : seulement réglage `generateur.apprentissage` allumé, et si la vidéo a une structure. */
export function peutRefaire(apprentissage: boolean, structure?: string): boolean {
  return apprentissage && !!structure;
}

/**
 * « CE QUI MARCHE » (lot G7b) : 390 px, très peu de texte. Trois blocs : le classement d'un réseau, ce qui revient devant,
 * et les vidéos semblables d'une version prête. Uniquement des rangs déjà mesurés : aucune prévision.
 */
export function CeQuiMarche({ donnees, essai, apprentissage }: { donnees: Donnees; essai: boolean; apprentissage: boolean }) {
  const reseaux = ORDRE_RESEAUX.filter((r) => donnees.rangs[r]?.length);
  const [reseau, setReseau] = useState<ReseauDeclinaison | undefined>(reseaux[0]);
  const [axe, setAxe] = useState<Exclude<Axe, "reseau">>("structure");

  return (
    <div className="space-y-7">
      <MettreAJour essai={essai} exemples={donnees.exemples} />

      {donnees.nombre === 0 ? (
        <Carte className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-surface-2 text-texte-doux">
            <Icone nom="tendance" size={26} />
          </span>
          <p className="font-titre text-xl text-texte">Pas encore de rangs</p>
          <p className="text-sm text-texte-doux">Ils arrivent avec les premières mesures.</p>
        </Carte>
      ) : (
        <>
          <section aria-labelledby="titre-classement">
            <Titre id="titre-classement">Classement</Titre>
            <div role="tablist" aria-label="Réseau" className="mb-3 flex gap-2">
              {reseaux.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="tab"
                  aria-selected={r === reseau}
                  onClick={() => setReseau(r)}
                  className={cn("grid min-h-11 min-w-11 place-items-center rounded-2xl border-2 p-0.5 transition-colors", r === reseau ? "border-orange" : "border-transparent opacity-60 hover:opacity-100")}
                >
                  <LogoReseau reseau={r} />
                </button>
              ))}
            </div>
            {reseau && <Classement rangs={donnees.rangs[reseau] ?? []} apprentissage={apprentissage} />}
          </section>

          <section aria-labelledby="titre-devant">
            <Titre id="titre-devant">Ce qui revient devant</Titre>
            <div role="tablist" aria-label="Regrouper par" className="mb-3 grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1">
              {AXES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={a.id === axe}
                  onClick={() => setAxe(a.id)}
                  className={cn("min-h-10 rounded-full text-sm font-semibold transition-colors", a.id === axe ? "bg-surface-1 text-texte shadow-carte" : "text-texte-doux")}
                >
                  {a.libelle}
                </button>
              ))}
            </div>
            <Carte sansMarge>
              <ul className="divide-y divide-trait">
                {donnees.groupes[axe].map((g) => (
                  <li key={g.valeur} className="p-3">
                    <div className="mb-1.5 flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-texte">{g.libelle}</span>
                      <span className="shrink-0 text-xs tabular-nums text-texte-faible">{g.nombre} vid.</span>
                    </div>
                    {g.tropTot ? (
                      <p className="text-xs text-texte-faible">Trop tôt pour dire</p>
                    ) : (
                      <Barre part={g.positionMediane ?? 0} />
                    )}
                  </li>
                ))}
              </ul>
            </Carte>
          </section>
        </>
      )}

      {donnees.avantPublication.length > 0 && (
        <section aria-labelledby="titre-avant">
          <Titre id="titre-avant">Avant de publier</Titre>
          <ul className="space-y-2">
            {donnees.avantPublication.map((v) => (
              <AvantPublication key={v.varianteId} version={v} />
            ))}
          </ul>
        </section>
      )}

      <p className="pb-4 text-center text-xs text-texte-faible">Rangs parmi les 20 dernières vidéos de chaque réseau. Aucune prévision.</p>
    </div>
  );
}

function Titre({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-2 font-texte text-xs font-bold uppercase tracking-wider text-texte-faible">
      {children}
    </h2>
  );
}

/** Position relative (0 = derrière, 1 = devant) en barre ; lisible sans couleur grâce à la longueur. */
function Barre({ part }: { part: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, part)) * 100);
  return (
    <span className="block h-2.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`Devant ${pct} % des vidéos`}>
      <span className={cn("block h-full rounded-full", pct >= 60 ? "bg-sauge" : pct >= 40 ? "bg-ambre" : "bg-brique")} style={{ width: `${Math.max(pct, 4)}%` }} />
    </span>
  );
}

function Classement({ rangs, apprentissage }: { rangs: RangVideo[]; apprentissage: boolean }) {
  const [tout, setTout] = useState(false);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const visibles = tout ? rangs : rangs.slice(0, 5);
  return (
    <Carte sansMarge>
      <ul className="divide-y divide-trait">
        {visibles.map((r) => {
          const id = r.video.publicationId;
          const deplie = ouverte === id;
          return (
            <li key={id}>
              <button type="button" aria-expanded={deplie} onClick={() => setOuverte(deplie ? null : id)} className="flex min-h-16 w-full items-center gap-3 p-3 text-left">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl font-titre text-lg tabular-nums", r.rang <= 3 ? "bg-sauge-doux text-sauge" : "bg-surface-2 text-texte")}>{r.rang}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-texte">{r.video.titre || r.video.code}</span>
                  <span className="block font-mono text-xs text-texte-faible">
                    {r.video.code}
                    {r.video.exemple ? " · exemple" : ""}
                  </span>
                </span>
                <Icone nom={deplie ? "chevron-bas" : "chevron-droite"} size={18} className="shrink-0 text-texte-faible" />
              </button>
              {deplie && (
                <dl className="grid grid-cols-2 gap-2 px-3 pb-3">
                  {INDICATEURS.filter((i) => r.parIndicateur[i.id]).map((i) => (
                    <div key={i.id} className="rounded-champ bg-surface-2 px-3 py-2" title={i.definition}>
                      <dt className="text-[11px] font-semibold text-texte-faible">{i.libelle}</dt>
                      <dd className="font-titre text-base tabular-nums text-texte">
                        {ordinal(r.parIndicateur[i.id]!.rang)}
                        <span className="text-xs text-texte-faible"> / {r.parIndicateur[i.id]!.sur}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {deplie && peutRefaire(apprentissage, r.video.structure) && (
                <div className="px-3 pb-3">
                  <Bouton asChild variante="secondaire" icone="actualiser" pleineLargeur>
                    <Link href={lienRefaire(r.video.structure!, r.video.ouverture)}>Recommencer cette structure sur un autre sujet</Link>
                  </Bouton>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {rangs.length > 5 && (
        <button type="button" onClick={() => setTout((x) => !x)} className="min-h-11 w-full border-t border-trait text-sm font-semibold text-texte-doux">
          {tout ? "Moins" : `Les ${rangs.length}`}
        </button>
      )}
    </Carte>
  );
}

function AvantPublication({ version }: { version: Donnees["avantPublication"][number] }) {
  const [ouvert, setOuvert] = useState(false);
  const { proches } = version.avis;
  return (
    <li>
      <Carte sansMarge>
        <button type="button" aria-expanded={ouvert} onClick={() => setOuvert((x) => !x)} className="flex min-h-16 w-full items-center gap-3 p-3 text-left">
          <LogoReseau reseau={version.reseau} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-texte">{version.titre || version.code}</span>
            <span className="block text-xs text-texte-faible">
              <span className="font-mono">{version.code}</span> · {proches.length ? `${proches.length} vidéos semblables` : "rien de semblable encore"}
            </span>
          </span>
          {proches.length > 0 && <Icone nom={ouvert ? "chevron-bas" : "chevron-droite"} size={18} className="shrink-0 text-texte-faible" />}
        </button>
        {ouvert && proches.length > 0 && (
          <ul className="space-y-1.5 border-t border-trait p-3">
            {proches.map((p) => (
              <li key={p.code} className="flex items-center gap-2.5">
                <LogoReseau reseau={p.reseau} taille="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-xs text-texte-doux">{p.code}</span>
                  <span className="block truncate text-[11px] text-texte-faible">même {p.enCommun.map((c) => EN_COMMUN[c]).join(", ") || "sujet"}</span>
                </span>
                <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 font-titre text-sm tabular-nums text-texte">
                  {ordinal(p.rang)}
                  <span className="text-[11px] text-texte-faible">/{p.sur}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </li>
  );
}

function MettreAJour({ essai, exemples }: { essai: boolean; exemples: boolean }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  function lancer() {
    demarrer(async () => {
      const r = await importerMesuresAction();
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      const { buffer, visites } = r.donnees;
      const n = buffer.ajoutees + visites.ajoutees;
      if (buffer.essai && visites.essai) notifier.essai("aucun chiffre n'a été lu");
      else if (buffer.message || visites.message) notifier.erreur(buffer.message ?? visites.message ?? "");
      else notifier.succes(n ? `${n} relevé${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""}` : "Rien de nouveau");
      router.refresh();
    });
  }
  return (
    <div className="flex items-center gap-2">
      <Bouton variante="secondaire" icone="actualiser" essai={essai} chargement={enCours} onClick={lancer} className="flex-1">
        Mettre à jour
      </Bouton>
      {exemples && <span className="shrink-0 rounded-full bg-ambre-doux px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ambre">Exemples</span>}
    </div>
  );
}
