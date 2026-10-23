"use client";

/**
 * ÉCOUTE ET VALIDATION DES BRUITAGES (lot du 02/10, D1). La banque est rangée par ce que le son accompagne à l'image ;
 * chaque son s'écoute d'une touche, puis Will le valide (il pourra être posé, toujours 18 à 24 dB sous la voix) ou le
 * laisse de côté. Tant qu'un son n'est pas validé, il n'est JAMAIS posé dans une vidéo. Rien n'est effacé.
 */
import { useRef, useState, useTransition } from "react";
import { ecouteBruitageAction } from "@/app/(studio)/bibliotheque/actions-bruitages";
import { Icone } from "@/components/ui/Icone";
import { Pastille } from "@/components/ui/Pastille";
import { notifier } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { VueBruitage } from "@/services/bruitages";

type Banque = { groupes: { declencheur: string; nom: string; quand: string; sons: VueBruitage[] }[]; valides: number; total: number };

export function EcranBruitages({ banque }: { banque: Banque }) {
  const [etat, setEtat] = useState(() => Object.fromEntries(banque.groupes.flatMap((g) => g.sons.map((s) => [s.id, s.ecoute]))) as Record<string, VueBruitage["ecoute"]>);
  const [enLecture, setEnLecture] = useState<string | null>(null);
  const [, demarrer] = useTransition();
  const audio = useRef<HTMLAudioElement | null>(null);
  const valides = Object.values(etat).filter((e) => e === "validee").length;

  function ecouter(s: VueBruitage) {
    if (!s.url) return;
    audio.current?.pause();
    const a = new Audio(s.url);
    audio.current = a;
    setEnLecture(s.id);
    a.onended = () => setEnLecture((x) => (x === s.id ? null : x));
    void a.play().catch(() => setEnLecture(null));
  }

  function changer(s: VueBruitage, ecoute: VueBruitage["ecoute"]) {
    const avant = etat[s.id];
    setEtat((e) => ({ ...e, [s.id]: ecoute }));
    demarrer(async () => {
      const r = await ecouteBruitageAction(s.id, ecoute);
      if (!r.ok) {
        setEtat((e) => ({ ...e, [s.id]: avant }));
        notifier.erreur(r.message);
      }
    });
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center gap-3 rounded-carte border border-trait bg-surface-1 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-doux text-orange-vif">
          <Icone nom="casque" size={20} />
        </span>
        <p className="min-w-0 flex-1 text-sm text-texte-doux">
          <span className="block font-semibold text-texte">
            {valides} / {banque.total} sons validés
          </span>
          Écoutez, puis validez ceux que vous aimez.
        </p>
      </div>

      {banque.groupes.map((g) => (
        <section key={g.declencheur} aria-labelledby={`groupe-${g.declencheur}`}>
          <h2 id={`groupe-${g.declencheur}`} className="mb-2 flex items-baseline justify-between gap-2 font-texte text-sm font-semibold text-texte-doux">
            <span>{g.nom}</span>
            <span className="text-xs font-normal text-texte-faible">{g.quand}</span>
          </h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {g.sons.map((s) => {
              const valide = etat[s.id] === "validee";
              const joue = enLecture === s.id;
              return (
                <li key={s.id} className={cn("rounded-2xl border bg-surface-1 p-2.5 transition-colors", valide ? "border-sauge/60" : "border-trait")}>
                  <button type="button" onClick={() => ecouter(s)} disabled={!s.url} aria-label={`Écouter ${s.nom}`} className="flex min-h-11 w-full items-center gap-2 rounded-xl text-left">
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", joue ? "bg-orange text-sur-orange" : "bg-surface-2 text-texte")}>
                      <Icone nom={joue ? "volume" : "lecture"} size={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-texte">{s.nom}</span>
                      <span className="block text-xs tabular-nums text-texte-faible">{s.dureeMs} ms</span>
                    </span>
                  </button>
                  <div className="mt-2 flex items-center justify-between gap-1">
                    {valide ? (
                      <Pastille ton="sauge" icone="coche">
                        Validé
                      </Pastille>
                    ) : (
                      <Pastille ton="ambre">À écouter</Pastille>
                    )}
                    <button
                      type="button"
                      onClick={() => changer(s, valide ? "a_verifier" : "validee")}
                      className={cn("min-h-11 rounded-full px-3 text-xs font-semibold", valide ? "text-texte-faible hover:text-texte" : "bg-orange text-sur-orange")}
                    >
                      {valide ? "Retirer" : "Valider"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="flex items-start gap-2 text-xs text-texte-faible">
        <Icone nom="certifie" size={13} className="mt-0.5 shrink-0" />
        Sons créés par le studio : libres de droits, usage commercial permis.
      </p>
    </div>
  );
}
