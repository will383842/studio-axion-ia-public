"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { Popover } from "radix-ui";
import { useCallback, useEffect, useState } from "react";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { Squelette } from "@/components/ui/Squelette";
import type { Notification, TypeNotification } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { marquerLuesAction } from "./actions";
import { IlYA } from "@/components/ui/IlYA";
import { useRetourFerme } from "@/components/ui/useRetourFerme";

const STYLES: Record<TypeNotification, { icone: NomIcone; ton: string }> = {
  "video-prete": { icone: "valide", ton: "bg-sauge-doux text-sauge" },
  echec: { icone: "attention", ton: "bg-brique-doux text-brique" },
  "plan-a-verifier": { icone: "oeil", ton: "bg-ambre-doux text-ambre" },
  "visage-pret": { icone: "visage", ton: "bg-sauge-doux text-sauge" },
  "voix-prete": { icone: "micro", ton: "bg-sauge-doux text-sauge" },
  budget: { icone: "euro", ton: "bg-ambre-doux text-ambre" },
  publication: { icone: "calendrier", ton: "bg-orange-doux text-orange-vif" },
  info: { icone: "info", ton: "bg-surface-2 text-texte-doux" },
  // Veille des outils (lot B) : une nouveauté d'un outil (HeyGen, Remotion…).
  veille: { icone: "eclair", ton: "bg-orange-doux text-orange-vif" },
  // Lot « crédits » (02/10) : crédit d'un fournisseur bas ou épuisé, clé refusée, dépense inexpliquée.
  credit: { icone: "euro", ton: "bg-brique-doux text-brique" },
};

type Etat = "chargement" | "pret" | "erreur";

/**
 * Cloche de notifications (en-tête) et son panneau : nouvelles d'abord, « Tout lire »,
 * une notification touchée est marquée lue. Se met à jour toutes les 20 s (onglet visible).
 */
export function ClocheNotifications({ nonLuesInitial }: { nonLuesInitial: number }) {
  const [ouverte, setOuverte] = useState(false);
  const [liste, setListe] = useState<Notification[]>([]);
  const [nonLues, setNonLues] = useState(nonLuesInitial);
  const [etat, setEtat] = useState<Etat>("chargement");

  const charger = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { notifications: Notification[]; nonLues: number };
      setListe(d.notifications);
      setNonLues(d.nonLues);
      setEtat("pret");
    } catch {
      setEtat((e) => (e === "pret" ? e : "erreur"));
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && void charger(), 20000);
    return () => clearInterval(t);
  }, [charger]);

  function toutLire() {
    setListe((l) => l.map((n) => ({ ...n, lue: true })));
    setNonLues(0);
    void marquerLuesAction();
  }

  function lire(n: Notification) {
    setOuverte(false);
    if (n.lue) return;
    setListe((l) => l.map((x) => (x.id === n.id ? { ...x, lue: true } : x)));
    setNonLues((c) => Math.max(0, c - 1));
    void marquerLuesAction([n.id]);
  }

  // Le retour du navigateur ferme le panneau au lieu de quitter la page.
  useRetourFerme(ouverte, () => setOuverte(false));

  const nouvelles = liste.filter((n) => !n.lue);
  const anciennes = liste.filter((n) => n.lue);

  return (
    <Popover.Root
      open={ouverte}
      onOpenChange={(o) => {
        setOuverte(o);
        if (o) void charger();
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={nonLues ? `Notifications, ${nonLues} nouvelle${nonLues > 1 ? "s" : ""}` : "Notifications"}
          className="relative grid size-11 place-items-center rounded-full text-texte-doux hover:bg-surface-2 hover:text-texte"
        >
          <Icone nom="cloche" size={21} />
          <AnimatePresence>
            {nonLues > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute right-1 top-1 grid min-w-[18px] place-items-center rounded-full bg-orange px-1 text-[10px] font-bold leading-[18px] text-sur-orange ring-2 ring-fond"
              >
                {nonLues > 9 ? "9+" : nonLues}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          aria-labelledby="titre-notifications"
          className="z-50 flex max-h-[min(70vh,560px)] w-[min(calc(100vw-24px),400px)] flex-col overflow-hidden rounded-[20px] border border-trait bg-surface-1 shadow-carte outline-none data-[state=open]:animate-[apparition_.15s_ease-out]"
        >
          <div className="flex items-center gap-2 border-b border-trait px-4 py-3">
            <h2 id="titre-notifications" className="flex-1 text-base text-texte">
              Notifications
            </h2>
            {nouvelles.length > 0 && (
              <button type="button" onClick={toutLire} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-orange-vif hover:bg-orange-doux">
                <Icone nom="coche" size={14} />
                Tout lire
              </button>
            )}
            <Link href="/reglages#notifications" onClick={() => setOuverte(false)} aria-label="Réglages des notifications" className="grid size-11 place-items-center rounded-full text-texte-faible hover:bg-surface-2 hover:text-texte">
              <Icone nom="reglages" size={17} />
            </Link>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {etat === "chargement" && !liste.length ? (
              <ul aria-label="Chargement" className="space-y-1">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-2">
                    <Squelette rond className="size-10 shrink-0" />
                    <span className="flex-1 space-y-1.5">
                      <Squelette className="h-3.5 w-3/4" />
                      <Squelette className="h-3 w-1/2" />
                    </span>
                  </li>
                ))}
              </ul>
            ) : etat === "erreur" && !liste.length ? (
              <div className="flex flex-col items-center px-4 py-10 text-center">
                <Icone nom="hors-ligne" size={28} className="text-texte-faible" />
                <p className="mt-3 text-sm text-texte-doux">Impossible de charger.</p>
                <button type="button" onClick={() => void charger()} className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-trait px-4 text-sm font-semibold text-texte hover:bg-surface-2">
                  <Icone nom="reessayer" size={15} />
                  Réessayer
                </button>
              </div>
            ) : !liste.length ? (
              <div className="relative isolate flex flex-col items-center px-4 py-10 text-center">
                <div aria-hidden className="absolute inset-x-10 top-4 -z-10 h-28 lueur-forte" />
                <span className="grid size-14 place-items-center rounded-full bg-surface-2 text-texte-doux">
                  <Icone nom="cloche" size={24} />
                </span>
                <p className="mt-3 font-titre text-lg text-texte">Rien de neuf</p>
                <p className="text-sm text-texte-faible">Je vous préviens ici.</p>
              </div>
            ) : (
              <>
                {nouvelles.length > 0 && <Groupe titre="Nouvelles" notifications={nouvelles} onLire={lire} />}
                {anciennes.length > 0 && <Groupe titre="Plus tôt" notifications={anciennes} onLire={lire} />}
              </>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Groupe({ titre, notifications, onLire }: { titre: string; notifications: Notification[]; onLire: (n: Notification) => void }) {
  return (
    <section className="mb-1">
      <h3 className="px-3 pb-1 pt-2 font-texte text-[11px] font-bold uppercase tracking-wider text-texte-faible">{titre}</h3>
      <ul>
        {notifications.map((n) => {
          const s = STYLES[n.type];
          const contenu = (
            <>
              <span className={cn("relative grid size-10 shrink-0 place-items-center rounded-full", s.ton)}>
                <Icone nom={s.icone} size={18} />
                {!n.lue && (
                  <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-orange ring-2 ring-surface-1">
                    <span className="sr-only">Nouvelle</span>
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm leading-snug", n.lue ? "text-texte-doux" : "font-semibold text-texte")}>{n.titre}</span>
                {n.message && <span className="line-clamp-2 text-xs text-texte-faible">{n.message}</span>}
              </span>
              <span className="shrink-0 self-start pt-0.5 text-[11px] text-texte-faible"><IlYA iso={n.creeLe} /></span>
            </>
          );
          return (
            <li key={n.id}>
              {n.lien ? (
                <Link href={n.lien} onClick={() => onLire(n)} className="flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-surface-2">
                  {contenu}
                </Link>
              ) : (
                <button type="button" onClick={() => onLire(n)} className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-surface-2">
                  {contenu}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
