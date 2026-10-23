"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ajouterPageSuivieAction, relireSiteAction, reglerSiteAction, retirerPageSuivieAction } from "@/app/(studio)/reglages/actions";
import { Bouton, BoutonIcone } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { Interrupteur } from "@/components/ui/Interrupteur";
import { notifier } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { VueSite } from "@/services/source-axion";

/** « 2 min », « 3 h », « hier », « 4 j » : tient dans un petit bloc, même à 390 px. */
function depuisCourt(iso: string, maintenant = Date.now()): string {
  const min = Math.max(0, Math.round((maintenant - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "À l'instant";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const j = Math.round(h / 24);
  return j === 1 ? "Hier" : `${j} j`;
}

/** Un chiffre dans un bloc (lien facultatif). */
function Bloc({ icone, valeur, libelle, href }: { icone: NomIcone; valeur: string; libelle: string; href?: string }) {
  const contenu = (
    <>
      <Icone nom={icone} size={16} className="text-orange-vif" />
      <span className="mt-2 block truncate font-titre text-2xl leading-none text-texte tabular-nums" suppressHydrationWarning>
        {valeur}
      </span>
      <span className="mt-1 block text-xs font-semibold text-texte-faible">{libelle}</span>
    </>
  );
  const classes = "block min-h-11 rounded-2xl bg-surface-2 p-3";
  return href ? (
    <Link href={href} className={cn(classes, "transition-colors hover:bg-surface-3")}>
      {contenu}
    </Link>
  ) : (
    <div className={classes}>{contenu}</div>
  );
}

/**
 * VOTRE SITE (Source axion-ia.com, 03/10) : interrupteur, ce qui a été trouvé, pages suivies (ajout / retrait,
 * axion-ia.com seulement), « Relire maintenant ». Très peu de texte : des blocs, des chiffres.
 */
export function VotreSite({ vue }: { vue: VueSite }) {
  const router = useRouter();
  const [actif, setActif] = useState(vue.actif);
  const [adresse, setAdresse] = useState("");
  const [erreur, setErreur] = useState<string | undefined>();
  const [enCours, demarrer] = useTransition();
  const lecture = vue.enCours;

  // Lecture en cours : l'écran se met à jour seul toutes les 10 s.
  useEffect(() => {
    if (!lecture) return;
    const t = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(t);
  }, [lecture, router]);

  function agir(f: () => Promise<{ ok: true } | { ok: false; message: string }>, succes?: string, annuler?: () => void) {
    demarrer(async () => {
      const r = await f();
      if (!r.ok) {
        annuler?.();
        notifier.erreur(r.message);
        return;
      }
      if (succes) notifier.succes(succes);
      router.refresh();
    });
  }

  const b = vue.bilan;
  return (
    <div className="space-y-4">
      <Interrupteur
        icone="lien"
        libelle="Lire votre site chaque jour"
        detail="axion-ia.com"
        coche={actif}
        onChange={(v) => {
          setActif(v);
          agir(() => reglerSiteAction(v), undefined, () => setActif(!v));
        }}
      />

      <div className="grid grid-cols-3 gap-2">
        <Bloc icone="horloge" valeur={vue.derniereLecture ? depuisCourt(vue.derniereLecture) : "Jamais"} libelle="Dernière lecture" />
        <Bloc icone="citation" valeur={String(vue.totaux.aRelire)} libelle={vue.totaux.aRelire > 1 ? "Matières à relire" : "Matière à relire"} href="/ecrire/matieres" />
        <Bloc icone="images" valeur={String(vue.totaux.images)} libelle={vue.totaux.images > 1 ? "Images du site" : "Image du site"} href="/bibliotheque/mes-images" />
      </div>

      {b && !b.ok && b.erreur && (
        <p role="status" className="flex items-start gap-2 rounded-2xl bg-brique-doux p-3 text-sm font-semibold text-brique">
          <Icone nom="attention" size={16} className="mt-0.5 shrink-0" />
          {b.erreur}
        </p>
      )}
      {b?.ok && b.capturesImpossibles && (
        <p className="flex items-start gap-2 rounded-2xl bg-surface-2 p-3 text-sm text-texte-doux">
          <Icone nom="image" size={16} className="mt-0.5 shrink-0" />
          {b.capturesImpossibles}
        </p>
      )}

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-texte-faible">Pages suivies · {vue.pages.length}</p>
        <ul className="divide-y divide-trait rounded-2xl border border-trait">
          {vue.pages.map((p) => (
            <li key={p.id} className="flex min-h-14 items-center gap-3 py-1.5 pl-3 pr-1">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-texte-faible">
                <Icone nom={p.erreur ? "attention" : p.images ? "images" : "document"} size={15} className={cn(p.erreur && "text-ambre")} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-texte">{p.nom}</span>
                <span className="block truncate text-xs text-texte-faible">
                  {p.chemin}
                  {p.images ? ` · ${p.images} images` : ""}
                </span>
              </span>
              <BoutonIcone icone="fermer" libelle={`Retirer ${p.nom}`} disabled={enCours} onClick={() => agir(() => retirerPageSuivieAction(p.id), "Page retirée")} />
            </li>
          ))}
        </ul>
      </div>

      <form
        className="space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!adresse.trim()) return;
          setErreur(undefined);
          demarrer(async () => {
            const r = await ajouterPageSuivieAction(adresse);
            if (!r.ok) {
              setErreur(r.message);
              return;
            }
            setAdresse("");
            notifier.succes("Page ajoutée");
            router.refresh();
          });
        }}
      >
        <p aria-hidden className="text-sm font-semibold text-texte-doux">
          Ajouter une page
        </p>
        <div className="flex items-start gap-2">
          <Champ className="min-w-0 flex-1" libelle="Ajouter une page" libelleMasque placeholder="axion-ia.com/fr/…" inputMode="url" autoComplete="off" value={adresse} onChange={(e) => setAdresse(e.target.value)} erreur={erreur} />
          <Bouton type="submit" variante="secondaire" taille="lg" icone="plus" disabled={enCours || !adresse.trim()} className="shrink-0" aria-label="Ajouter la page">
            <span className="max-sm:sr-only">Ajouter</span>
          </Bouton>
        </div>
      </form>

      <Bouton
        variante="contour"
        taille="lg"
        pleineLargeur
        icone={lecture ? "chargement" : "actualiser"}
        disabled={enCours || lecture}
        className={cn(lecture && "[&>svg]:animate-spin")}
        onClick={() =>
          demarrer(async () => {
            const r = await relireSiteAction();
            if (!r.ok) notifier.erreur(r.message);
            else notifier.succes(r.donnees.message);
            router.refresh();
          })
        }
      >
        {lecture ? "Lecture en cours…" : "Relire maintenant"}
      </Bouton>
    </div>
  );
}
