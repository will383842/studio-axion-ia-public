"use client";

/**
 * ÉCRAN DE DÉPART DE L'IPAD (plan facecam v4, § C.2 ; lot D). Le texte est déjà chargé ; avant de lire, 4 pictogrammes :
 * iPhone à l'horizontale, 3 s sans vous, lampe à 45°, « Monteur, … ». Un seul toucher : « C'est parti ».
 * Le téléprompteur (enfants) s'affiche ensuite ; en bas, le chemin de l'envoi depuis l'iPhone.
 */
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import { CONSEILS_DEPART_IPAD } from "@/domaine/facecam-parcours";

function Pictogramme({ cle }: { cle: (typeof CONSEILS_DEPART_IPAD)[number]["cle"] }) {
  const trait = "stroke-texte";
  const accent = "stroke-orange-vif";
  return (
    <svg viewBox="0 0 96 72" className="h-16 w-20" fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {cle === "horizontal" && (
        <>
          <rect x="14" y="20" width="68" height="34" rx="7" className={trait} />
          <circle cx="72" cy="37" r="4" className={accent} />
          <path d="M30 12h36" className={accent} strokeDasharray="4 6" />
        </>
      )}
      {cle === "piece-vide" && (
        <>
          <rect x="12" y="12" width="72" height="48" rx="6" className={trait} />
          <path d="M28 46h40M36 34h24" className="stroke-texte-faible" />
          <text x="48" y="32" textAnchor="middle" className="fill-orange-vif" stroke="none" fontSize="16" fontWeight="700">3 s</text>
        </>
      )}
      {cle === "lampe" && (
        <>
          <circle cx="62" cy="44" r="10" className={trait} />
          <path d="M18 12l14 14M26 8l12 14" className={accent} />
          <path d="M32 26l18 10" className={accent} strokeDasharray="3 5" />
          <path d="M14 24l22-16" className={trait} />
        </>
      )}
      {cle === "monteur" && (
        <>
          <path d="M18 18h52a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8H42l-12 10v-10H18a8 8 0 0 1-8-8V26a8 8 0 0 1 8-8z" className={trait} />
          <path d="M26 33h28" className={accent} />
          <path d="M60 33h4" className={accent} />
        </>
      )}
    </svg>
  );
}

export function DepartIpad({ varianteId, children }: { varianteId: string; children: ReactNode }) {
  const [parti, setParti] = useState(false);
  if (!parti) {
    return (
      <section aria-label="Avant de filmer" className="mx-auto max-w-3xl">
        <h2 className="mb-1 font-titre text-3xl text-texte">Avant de filmer</h2>
        <p className="mb-6 text-[17px] text-texte-doux">Le texte est prêt. Vérifiez ces 4 points, puis lancez-vous.</p>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CONSEILS_DEPART_IPAD.map((c) => (
            <li key={c.cle} className="flex items-center gap-4 rounded-carte border border-trait bg-surface-1 p-4">
              <span className="grid shrink-0 place-items-center rounded-2xl bg-surface-2 p-2">
                <Pictogramme cle={c.cle} />
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-semibold text-texte">{c.titre}</span>
                <span className="block text-[15px] text-texte-doux">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
        <Bouton taille="xl" pleineLargeur icone="camera" className="mt-6" onClick={() => setParti(true)}>
          C&apos;est parti
        </Bouton>
      </section>
    );
  }
  return (
    <>
      {children}
      <div className="mx-auto mt-8 flex max-w-3xl items-center gap-3 rounded-carte border border-trait bg-surface-1 p-4">
        <Icone nom="telephone" size={20} className="shrink-0 text-orange-vif" />
        <p className="min-w-0 flex-1 text-[15px] text-texte-doux">
          Fini ? Sur l&apos;iPhone, ouvrez le studio et touchez <span className="font-semibold text-texte">Envoyer ma vidéo</span>.
        </p>
        <Link href={`/envoyer/${varianteId}`} className="min-h-11 shrink-0 content-center rounded-full px-2 text-sm font-semibold text-orange-vif hover:underline">
          Ouvrir
        </Link>
      </div>
    </>
  );
}
