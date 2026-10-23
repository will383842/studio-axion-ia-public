"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { enregistrerFaconAction } from "@/app/(studio)/ecrire/actions";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { Interrupteur } from "@/components/ui/Interrupteur";
import { notifier } from "@/components/ui/Toast";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import type { FaconDeParler as Facon } from "@/services/scripts";
import { cn } from "@/lib/cn";

/** Pastilles modifiables : un mot par pastille, ajout par Entrée, retrait d'un toucher. */
function Pastilles({ titre, icone, ton, mots, onChange, placeholder }: { titre: string; icone: NomIcone; ton: "sauge" | "brique"; mots: string[]; onChange: (m: string[]) => void; placeholder: string }) {
  const id = useId();
  const [saisie, setSaisie] = useState("");
  const ajouter = () => {
    const m = saisie.trim();
    if (m && !mots.some((x) => x.toLowerCase() === m.toLowerCase())) onChange([...mots, m]);
    setSaisie("");
  };
  return (
    <section className="rounded-carte border border-trait bg-surface-1 p-4">
      <h3 className="mb-3 flex items-center gap-2 font-texte text-sm font-semibold text-texte-doux">
        <Icone nom={icone} size={16} className={ton === "sauge" ? "text-sauge" : "text-brique"} />
        {titre}
        <span className="ml-auto tabular-nums text-texte-faible">{mots.length}</span>
      </h3>
      <ul className="flex flex-wrap gap-1.5">
        <AnimatePresence initial={false}>
          {mots.map((m) => (
            <motion.li key={m} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
              <button
                type="button"
                onClick={() => onChange(mots.filter((x) => x !== m))}
                aria-label={`Retirer « ${m} »`}
                className={cn(
                  "flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors",
                  ton === "sauge" ? "border-sauge/30 bg-sauge-doux text-sauge hover:border-sauge" : "border-brique/30 bg-brique-doux text-brique hover:border-brique",
                )}
              >
                {m}
                <Icone nom="fermer" size={13} className="opacity-60" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
        <li className="min-w-40 flex-1">
          <label htmlFor={id} className="sr-only">
            {placeholder}
          </label>
          <input
            id={id}
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                ajouter();
              }
            }}
            onBlur={ajouter}
            placeholder={placeholder}
            enterKeyHint="done"
            className="min-h-11 w-full rounded-full border border-dashed border-trait-fort bg-transparent px-3.5 text-[16px] text-texte outline-none placeholder:text-texte-faible focus:border-orange"
          />
        </li>
      </ul>
    </section>
  );
}

/**
 * « Ma façon de parler » : expressions, mots interdits, tutoiement, notes.
 * Enregistrement automatique (le futur générateur s'en servira).
 */
export function FaconDeParler({ initiale }: { initiale: Facon }) {
  const [facon, setFacon] = useState(initiale);
  const [etat, setEtat] = useState<"enregistre" | "attente" | "erreur">("enregistre");
  const premier = useRef(true);

  useEffect(() => {
    if (premier.current) {
      premier.current = false;
      return;
    }
    const t = setTimeout(async () => {
      const r = await enregistrerFaconAction(facon);
      setEtat(r.ok ? "enregistre" : "erreur");
      if (!r.ok) notifier.erreur(r.message);
    }, 700);
    return () => clearTimeout(t);
  }, [facon]);

  const changer = (patch: Partial<Facon>) => {
    setEtat("attente");
    setFacon((f) => ({ ...f, ...patch }));
  };

  return (
    <div className="space-y-3">
      <p aria-live="polite" className="flex min-h-5 items-center justify-end gap-1.5 text-xs text-texte-faible">
        {etat === "attente" ? (
          <>
            <Icone nom="chargement" size={12} className="animate-spin" /> Enregistrement…
          </>
        ) : etat === "enregistre" ? (
          <>
            <Icone nom="valide" size={12} className="text-sauge" /> Enregistré
          </>
        ) : (
          <span className="text-brique">Pas enregistré</span>
        )}
      </p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Pastilles titre="Mes expressions" icone="citation" ton="sauge" mots={facon.expressions} onChange={(m) => changer({ expressions: m })} placeholder="Ajouter une expression" />
        <Pastilles titre="Mots interdits" icone="bouclier" ton="brique" mots={facon.motsInterdits} onChange={(m) => changer({ motsInterdits: m })} placeholder="Ajouter un mot" />
      </div>
      <section className="rounded-carte border border-trait bg-surface-1 px-4 py-1">
        <Interrupteur icone="personne" libelle="Tutoyer le spectateur" coche={facon.tutoiement} onChange={(v) => changer({ tutoiement: v })} />
      </section>
      <ZoneTexte libelle="Notes pour le générateur" placeholder="Phrases courtes. Un exemple concret par vidéo." value={facon.notes} longueurMax={600} onChange={(e) => changer({ notes: e.target.value })} />
    </div>
  );
}
