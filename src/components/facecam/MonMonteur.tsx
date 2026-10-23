"use client";

/**
 * RÉGLAGES › MON MONTEUR (plan facecam v4, B.11 et B.26 ; lot D). Le SEUL endroit où un montant apparaît pour le face
 * caméra : le total du mois et le plafond de sécurité (« Relever »). Puis « Mes habitudes » (les demandes « Appliquer
 * aux prochaines vidéos ») et le look gardé.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ajouterHabitudeAction, releverPlafondAction, retirerHabitudeAction } from "@/app/(studio)/videos/actions-facecam";
import { Bouton } from "@/components/ui/Bouton";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone } from "@/components/ui/Icone";
import { notifier } from "@/components/ui/Toast";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import { cn } from "@/lib/cn";
import { formaterMontant } from "@/lib/montants";
import type { VueReglagesMonteur } from "@/services/monteur-facecam";

const CRANS: Record<string, string> = { moins: "Moins", juste: "Juste", plus: "Plus" };
const NOMS: Record<string, string> = { lumiere: "Lumière", couleurs: "Couleurs", mine: "Bonne mine", dents: "Dents" };

export function MonMonteur({ vue }: { vue: VueReglagesMonteur }) {
  const router = useRouter();
  const [envoi, demarrer] = useTransition();
  const [relever, setRelever] = useState(false);
  const [habitude, setHabitude] = useState("");
  const part = vue.plafond.centimes ? Math.min(1, vue.totalMois.centimes / vue.plafond.centimes) : 0;
  const tauxEur = vue.plafondUsd ? vue.plafond.centimes / (vue.plafondUsd * 100) : 1;
  const choix = [1.5, 2, 3].map((k) => Math.round(vue.plafondUsd * k));

  function lancer(f: () => Promise<{ ok: true } | { ok: false; message: string }>, succes: string, apres?: () => void) {
    demarrer(async () => {
      const r = await f();
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      notifier.succes(succes);
      apres?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-texte-doux">Ce mois-ci</p>
          <p className="tabular-nums text-texte">
            <span className="font-titre text-xl">{formaterMontant(vue.totalMois)}</span>
            <span className="text-sm text-texte-faible"> / {formaterMontant(vue.plafond, { court: true })}</span>
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuenow={Math.round(part * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Part du plafond utilisée">
          <div className={cn("h-full rounded-full", vue.atteint ? "bg-ambre" : "bg-sauge")} style={{ width: `${Math.max(2, part * 100)}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-sm text-texte-faible">{vue.atteint ? "Plafond atteint : les vidéos sortent en version simple." : "Plafond de sécurité : au-delà, les vidéos sortent en version simple."}</p>
          <Bouton variante={vue.atteint ? "principal" : "contour"} onClick={() => setRelever(true)} className="shrink-0">
            Relever
          </Bouton>
        </div>
      </div>

      <div className="h-px bg-trait" />

      <div>
        <p className="mb-1 text-sm font-semibold text-texte-doux">Mes habitudes</p>
        <p className="mb-3 text-sm text-texte-faible">Ce que le monteur fait à chaque vidéo, sans que vous le redemandiez.</p>
        {vue.habitudes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-trait px-4 py-4 text-[15px] text-texte-doux">
            Aucune pour l&apos;instant. Cochez « Appliquer aux prochaines vidéos » en parlant au monteur, ou ajoutez-en une ici.
          </p>
        ) : (
          <ul className="divide-y divide-trait">
            {vue.habitudes.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-2">
                <Icone nom="repeter" size={15} className="shrink-0 text-orange-vif" />
                <span className="min-w-0 flex-1 text-[15px] text-texte">{h.texte}</span>
                <Bouton variante="fantome" disabled={envoi} onClick={() => lancer(() => retirerHabitudeAction(h.id), "Habitude retirée")} className="shrink-0">
                  Retirer
                </Bouton>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (habitude.trim()) lancer(() => ajouterHabitudeAction(habitude), "Habitude ajoutée", () => setHabitude(""));
          }}
        >
          <ZoneTexte libelle="Nouvelle habitude" libelleMasque rows={1} value={habitude} onChange={(e) => setHabitude(e.target.value)} placeholder="Ex. : logo Certifexemple quand je dis Certifexemple" longueurMax={300} className="flex-1" />
          <Bouton type="submit" icone="plus" disabled={!habitude.trim()} chargement={envoi} className="shrink-0">
            Ajouter
          </Bouton>
        </form>
      </div>

      {vue.look && (
        <>
          <div className="h-px bg-trait" />
          <div>
            <p className="mb-2 text-sm font-semibold text-texte-doux">Mon look gardé</p>
            <ul className="flex flex-wrap gap-2">
              {Object.entries(vue.look.image).map(([k, v]) => (
                <li key={k} className="rounded-full border border-trait bg-surface-2 px-3 py-1 text-sm text-texte-doux">
                  {NOMS[k] ?? k} · <span className="font-semibold text-texte">{CRANS[v] ?? v}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-texte-faible">Se change depuis « Retoucher l&apos;image » sur une vidéo.</p>
          </div>
        </>
      )}

      <FeuilleBas ouverte={relever} onOuverteChange={setRelever} titre="Relever le plafond du mois" description="Il évite seulement une dépense qui s'emballe.">
        <ul className="space-y-2 pb-2">
          {choix.map((usd) => (
            <li key={usd}>
              <Bouton variante="contour" taille="lg" pleineLargeur chargement={envoi} onClick={() => lancer(() => releverPlafondAction(usd), "Plafond relevé", () => setRelever(false))}>
                {formaterMontant({ centimes: Math.round(usd * 100 * tauxEur), devise: "EUR" }, { court: true })} par mois
              </Bouton>
            </li>
          ))}
        </ul>
      </FeuilleBas>
    </div>
  );
}
