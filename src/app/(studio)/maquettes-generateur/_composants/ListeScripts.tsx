"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BoutonIcone, Carte, Champ, FeuilleBas, Icone, LogoReseau, notifier } from "@/components/ui";
import type { IdReseau } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { contient } from "@/lib/textes";
import { BROUILLON_DEMO, FAMILLES_FORMATS_DEMO, RESEAUX_GENERATEUR, SANS_SUJET_DEMO, SUJETS_DEMO, type FormatDemo } from "../_demo";
import { LegendeGrille, MiniGrille } from "./MiniGrille";

/** Liste « Scripts » : rangée de 5 logos, bouton Format, une carte par sujet avec sa mini-grille. */
export function ListeScripts({ formatOuvert = false }: { formatOuvert?: boolean }) {
  const [reseau, setReseau] = useState<IdReseau | null>(null);
  const [format, setFormat] = useState<string | null>(null);
  const [feuilleFormat, setFeuilleFormat] = useState(formatOuvert);

  const sujets = SUJETS_DEMO.filter(
    (s) =>
      (!format || s.lignes.some((l) => l.libelle.startsWith(format))) &&
      (!reseau || s.lignes.some((l) => (l.cases[reseau] ?? "vide") !== "vide")),
  );

  return (
    <div className="space-y-4">
      {/* Rangée fixe : 5 logos + Format */}
      <div className="sticky top-16 z-20 -mx-4 border-b border-trait/60 bg-fond/90 px-4 py-2 backdrop-blur-lg">
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Réseau" className="flex flex-1 items-center justify-between gap-1">
            {RESEAUX_GENERATEUR.map((r) => {
              const actif = reseau === r;
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => setReseau(actif ? null : r)}
                  className={cn("grid size-11 place-items-center rounded-xl transition-colors", actif ? "bg-orange-doux ring-2 ring-orange" : "hover:bg-surface-2")}
                >
                  <LogoReseau reseau={r} taille="md" className={cn(actif && "border-orange text-orange-vif")} />
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setFeuilleFormat(true)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold",
              format ? "border-orange bg-orange-doux text-orange-vif" : "border-trait bg-surface-1 text-texte",
            )}
          >
            <Icone nom="grille" size={16} />
            {format ?? "Format"}
          </button>
        </div>
      </div>

      {(reseau || format) && (
        <div className="flex items-center justify-between text-sm text-texte-doux">
          <span>
            {sujets.length} sujet{sujets.length > 1 ? "s" : ""}
          </span>
          <button type="button" onClick={() => {
              setReseau(null);
              setFormat(null);
            }} className="min-h-11 rounded-full px-2 font-semibold hover:text-texte">
            Tout afficher
          </button>
        </div>
      )}

      {/* Brouillon sans numéro, en tête */}
      {!reseau && !format && (
        <Link href="/maquettes-generateur/il-manque" className="block">
          <Carte interactive className="border-ambre/40">
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ambre-doux text-ambre">
                <Icone nom="micro" size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-texte">{BROUILLON_DEMO.idee}</p>
                <p className="text-sm text-ambre">Il manque {BROUILLON_DEMO.manque}</p>
              </div>
              <Icone nom="chevron-droite" size={18} className="text-texte-faible" />
            </div>
          </Carte>
        </Link>
      )}

      <ul className="space-y-3">
        {sujets.map((s) => (
          <li key={s.numero}>
            <Link href="/maquettes-generateur/resultat" className="block">
              <Carte interactive>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="font-titre text-2xl leading-none text-texte">
                    n° {s.numero}
                    {s.version && <span className="ml-1.5 align-middle font-texte text-xs font-bold text-texte-faible">v{s.version}</span>}
                  </span>
                  <span className="text-xs text-texte-faible">{s.quand}</span>
                </div>
                <p className="mb-4 line-clamp-2 text-[15px] leading-snug text-texte-doux">{s.angle}</p>
                <MiniGrille lignes={s.lignes} reseauActif={reseau} />
              </Carte>
            </Link>
          </li>
        ))}
      </ul>

      <LegendeGrille />

      <details className="group rounded-carte border border-trait bg-surface-1 px-4">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm font-semibold text-texte-doux">
          Sans sujet · {SANS_SUJET_DEMO.length}
          <Icone nom="chevron-bas" size={16} className="transition-transform group-open:rotate-180" />
        </summary>
        <ul className="space-y-2 pb-4">
          {SANS_SUJET_DEMO.map((t) => (
            <li key={t} className="text-sm text-texte">
              {t}
            </li>
          ))}
        </ul>
      </details>

      <FeuilleFormat
        ouverte={feuilleFormat}
        onOuverteChange={setFeuilleFormat}
        actif={format}
        onChoisir={(f) => {
          setFormat(f);
          setFeuilleFormat(false);
        }}
      />
    </div>
  );
}

/** Feuille « Format » : favoris en premier, rangés par type de vidéo, recherche, compteurs, formats vides masqués. */
function FeuilleFormat({
  ouverte,
  onOuverteChange,
  actif,
  onChoisir,
}: {
  ouverte: boolean;
  onOuverteChange: (v: boolean) => void;
  actif: string | null;
  onChoisir: (nom: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const [tout, setTout] = useState(false);
  const groupes = useMemo(() => {
    const garder = (f: FormatDemo) => (tout || f.nbVideos > 0) && (!q || contient(f.nom, q) || contient(f.code, q));
    const favoris = FAMILLES_FORMATS_DEMO.flatMap((g) => g.formats).filter((f) => f.favori && garder(f));
    const familles = FAMILLES_FORMATS_DEMO.map((g) => ({ famille: g.famille, formats: g.formats.filter((f) => !f.favori && garder(f)) })).filter((g) => g.formats.length);
    return [...(favoris.length ? [{ famille: "Favoris", formats: favoris }] : []), ...familles];
  }, [q, tout]);
  const masques = FAMILLES_FORMATS_DEMO.flatMap((g) => g.formats).filter((f) => f.nbVideos === 0).length;

  return (
    <FeuilleBas ouverte={ouverte} onOuverteChange={onOuverteChange} titre="Format">
      <Champ libelle="Chercher un format" libelleMasque icone="loupe" placeholder="Chercher" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-4 space-y-5">
        {groupes.map((g) => (
          <section key={g.famille}>
            <h3 className="mb-2 flex items-center gap-1.5 font-texte text-xs font-bold uppercase tracking-wider text-texte-faible">
              {g.famille === "Favoris" && <Icone nom="etoile" size={12} />}
              {g.famille}
            </h3>
            <ul className="grid grid-cols-2 gap-2">
              {g.formats.map((f) => (
                <li key={f.code}>
                  <button
                    type="button"
                    onClick={() => onChoisir(actif === f.nom ? null : f.nom)}
                    aria-pressed={actif === f.nom}
                    className={cn(
                      "flex min-h-16 w-full flex-col items-start justify-between rounded-champ border p-3 text-left transition-colors",
                      actif === f.nom ? "border-orange bg-orange-doux" : "border-trait bg-surface-2 hover:border-trait-fort",
                    )}
                  >
                    <span className="font-titre text-xs text-orange-vif">{f.code}</span>
                    <span className="flex w-full items-baseline justify-between gap-1">
                      <span className="truncate text-sm font-semibold text-texte">{f.nom}</span>
                      <span className="text-xs tabular-nums text-texte-faible">{f.nbVideos}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {!tout && masques > 0 && (
        <button type="button" onClick={() => setTout(true)} className="mt-4 min-h-11 w-full rounded-full text-sm font-semibold text-texte-doux hover:text-texte">
          Tout afficher (+{masques} sans vidéo)
        </button>
      )}
    </FeuilleBas>
  );
}

/** Bouton « Plus de filtres » (maquette : la feuille arrive au lot G1b). */
export function BoutonPlusDeFiltres() {
  return <BoutonIcone icone="filtre" libelle="Plus de filtres" variante="secondaire" onClick={() => notifier.info("Plus de filtres : état, qui parle, thème…")} />;
}
