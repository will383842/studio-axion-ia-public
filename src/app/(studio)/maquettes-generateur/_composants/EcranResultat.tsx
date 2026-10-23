"use client";

import { useState } from "react";
import { BarreActionCollee, Bouton, Carte, Icone, LogoReseau, notifier } from "@/components/ui";
import type { IdReseau } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { RESULTAT_DEMO } from "../_demo";
import { FeuilleFabrication } from "./FeuilleFabrication";

type Etape = "limite" | "a-valider" | "valide";

/**
 * Écran Résultat (B.6.7) : une ligne par version (logo, accroche, durée, voyant),
 * chaque point ambre est une action d'un toucher avec son prix, la carte « Limite proposée »,
 * et « Détails » replié. L'étiquette IA n'apparaît jamais parmi les points ambre.
 */
export function EcranResultat({ etapeInitiale, feuilleOuverte }: { etapeInitiale: Etape; feuilleOuverte: boolean }) {
  const [etape, setEtape] = useState<Etape>(etapeInitiale);
  const [regles, setRegles] = useState<IdReseau[]>([]);
  const [feuille, setFeuille] = useState(feuilleOuverte);
  const r = RESULTAT_DEMO;
  const nb = r.versions.length;

  return (
    <div className="space-y-4">
      {etape === "limite" ? (
        <Carte className="border-ambre/50">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ambre">
            <Icone nom="attention" size={14} />
            Limite proposée
          </p>
          <p className="mb-4 text-[17px] font-semibold leading-snug text-texte">
            <span className="text-ambre">Sauf si</span> {r.limite}
          </p>
          <div className="flex gap-2 [&>*:last-child]:flex-1">
            <Bouton variante="secondaire" icone="coche" onClick={() => setEtape("a-valider")}>
              C&apos;est juste
            </Bouton>
            <Bouton variante="contour" icone="micro" onClick={() => notifier.info("Dictez la limite : elle sera reprise mot pour mot.")}>
              Corriger au micro
            </Bouton>
          </div>
        </Carte>
      ) : (
        <div className="flex min-h-11 items-center gap-2 rounded-full bg-sauge-doux px-4 text-sm font-semibold text-sauge">
          <Icone nom="coche" size={16} />
          Limite validée
        </div>
      )}

      <Carte sansMarge as="section" aria-label="Versions">
        <ul className="divide-y divide-trait">
          {r.versions.map((v) => {
            const ambre = v.voyant === "ambre" && !regles.includes(v.reseau);
            return (
              <li key={v.reseau} className="p-4">
                <div className="flex items-start gap-3">
                  <LogoReseau reseau={v.reseau} />
                  <p className="line-clamp-2 min-w-0 flex-1 text-[15px] font-semibold leading-snug text-texte">{v.accroche}</p>
                  <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
                    <span className="text-sm tabular-nums text-texte-doux">{v.duree}</span>
                    <span
                      role="img"
                      aria-label={ambre ? "à regarder" : "prête"}
                      className={cn("size-2.5 rounded-full", ambre ? "bg-ambre shadow-[0_0_0_4px_var(--ambre-doux)]" : "bg-sauge")}
                    />
                  </div>
                </div>
                {ambre && v.action && (
                  <div className="mt-3 pl-12">
                    <p className="mb-2 text-[13px] text-ambre">{v.souci}</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setRegles((x) => [...x, v.reseau])}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ambre/40 bg-ambre-doux px-4 text-sm font-bold text-ambre hover:bg-ambre hover:text-fond"
                      >
                        {v.action.libelle} · {v.action.prix}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRegles((x) => [...x, v.reseau])}
                        className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-texte-doux hover:text-texte"
                      >
                        Laisser
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Carte>

      {/* Ajouter une déclinaison : chaque bouton payant porte son prix */}
      <section aria-labelledby="titre-ajouter">
        <h2 id="titre-ajouter" className="mb-2 flex items-center gap-1.5 font-texte text-xs font-bold uppercase tracking-wider text-texte-faible">
          <Icone nom="plus" size={12} />
          Ajouter
        </h2>
        <div className="flex flex-wrap gap-2">
          {r.ajouts.map((a) => (
            <button
              key={a.libelle}
              type="button"
              onClick={() => notifier.info(`${a.libelle} : ${a.prix}`)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-trait bg-surface-1 px-4 text-sm font-semibold text-texte hover:border-trait-fort hover:bg-surface-2"
            >
              <Icone nom={a.icone} size={16} className="text-orange-vif" />
              {a.libelle}
              <span className="font-medium tabular-nums text-texte-faible">· {a.prix}</span>
            </button>
          ))}
        </div>
      </section>

      <details className="group rounded-carte border border-trait bg-surface-1 px-4">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm font-semibold text-texte-doux">
          Détails
          <Icone nom="chevron-bas" size={16} className="transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-5 pb-4">
          <ul className="space-y-2">
            {r.details.gardeFous.map((g) => (
              <li key={g} className="flex items-center gap-2 text-sm text-texte">
                <Icone nom="coche" size={14} className="text-sauge" />
                {g}
              </li>
            ))}
          </ul>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {r.details.notes.map((n) => (
              <li key={n.code} className="flex items-baseline justify-between text-sm">
                <span className="font-mono text-xs text-texte-faible">{n.code}</span>
                <span className="font-titre tabular-nums text-texte">{n.note}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-texte-doux">
            <span className="font-semibold text-texte">Avis des juges</span> (indicatif) : {r.details.juges}
          </p>
          <p className="text-sm text-texte-doux">{r.details.autreMilieu}</p>
        </div>
      </details>

      <BarreActionCollee
        secondaire={
          etape === "valide" ? (
            <Bouton variante="secondaire" taille="lg" onClick={() => notifier.info("Rangé dans « Prêts à fabriquer ».")}>
              Plus tard
            </Bouton>
          ) : undefined
        }
      >
        {etape === "valide" ? (
          <Bouton taille="lg" icone="film" onClick={() => setFeuille(true)}>
            Fabriquer
          </Bouton>
        ) : (
          <Bouton taille="lg" icone={etape === "limite" ? "cadenas" : "coche"} disabled={etape === "limite"} onClick={() => setEtape("valide")}>
            Valider les {nb}
          </Bouton>
        )}
      </BarreActionCollee>

      <FeuilleFabrication ouverte={feuille} onOuverteChange={setFeuille} />
    </div>
  );
}
