"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { declarerRechargeAction } from "@/app/(studio)/reglages/actions";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone } from "@/components/ui/Icone";
import { Pastille } from "@/components/ui/Pastille";
import { notifier } from "@/components/ui/Toast";
import { texteRestant, type TonJauge } from "@/domaine/credits";
import { dateCourte, heure } from "@/lib/dates";
import { cn } from "@/lib/cn";
import type { CarteCredit } from "@/services/credits";

const COULEURS: Record<TonJauge, { barre: string; texte: string }> = {
  vert: { barre: "bg-sauge", texte: "text-sauge" },
  orange: { barre: "bg-ambre", texte: "text-ambre" },
  rouge: { barre: "bg-brique", texte: "text-brique" },
  // Solde inconnu (audit 4.10) : ni vert ni alarme.
  neutre: { barre: "bg-trait-fort", texte: "text-texte" },
};

/** Jauge d'un crédit : verte, orange sous 25 %, rouge sous 10 % ou à moins d'une vidéo. */
export function JaugeCredit({ pourcentage, ton, className }: { pourcentage: number | null; ton: TonJauge; className?: string }) {
  const largeur = pourcentage === null ? 100 : Math.max(3, pourcentage);
  return (
    <div className={cn("h-2.5 overflow-hidden rounded-full bg-surface-3", className)} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pourcentage ?? undefined} aria-label="Crédit restant">
      <div className={cn("h-full rounded-full transition-[width] duration-700 ease-studio", COULEURS[ton].barre, pourcentage === null && "opacity-25")} style={{ width: `${largeur}%` }} />
    </div>
  );
}

/** « Lu chez HeyGen à 14 h 05 » / « Suivi par le studio ». */
export function etiquetteSolde(c: Pick<CarteCredit, "mode" | "nom" | "luLe">): string {
  if (c.nom === "Claude") return "Solde chez Anthropic";
  if (c.mode === "suivi") return "Suivi par le studio";
  return c.luLe ? `Lu chez ${c.nom} · ${heure(c.luLe)}` : `Lu chez ${c.nom}`;
}

/**
 * Réglages > CRÉDITS (lot « crédits », 02/10) : une carte par service payant. Solde étiqueté « lu » (avec l'heure) ou
 * « suivi », jauge, « ≈ N vidéos », consommé ce mois, Recharger (page du service) et « J'ai rechargé ».
 */
export function Credits({ cartes }: { cartes: CarteCredit[] }) {
  const router = useRouter();
  const [recharge, setRecharge] = useState<CarteCredit | null>(null);
  const [montant, setMontant] = useState("");
  const [enCours, demarrer] = useTransition();
  const actives = cartes.filter((c) => c.clePresente || c.soldeTexte !== null);
  const autres = cartes.filter((c) => !actives.includes(c));

  return (
    <div className="space-y-3">
      {actives.length === 0 && <p className="text-sm text-texte-faible">Aucun service payant relié pour l&apos;instant.</p>}
      <ul className="space-y-3">
        {actives.map((c) => (
          <li key={c.fournisseur} className="rounded-carte border border-trait bg-surface-2 p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-texte">{c.nom}</p>
                <p className="text-xs text-texte-faible">{etiquetteSolde(c)}</p>
              </div>
              {c.cleRefusee ? (
                <Pastille ton="brique" icone="attention">
                  Clé refusée
                </Pastille>
              ) : (
                <Pastille ton={c.mode === "reel" ? "sauge" : "neutre"}>{c.mode === "reel" ? "Réel" : "Suivi"}</Pastille>
              )}
            </div>

            <p className={cn("mt-3 font-titre text-3xl tabular-nums leading-none", c.disponibleTexte ? COULEURS[c.ton].texte : "text-texte-faible")}>{c.disponibleTexte ?? "—"}</p>
            {c.disponibleTexte === null && (
              <p className="mt-1 text-sm text-texte-faible">
                {c.nom === "Claude"
                  ? "Le solde se lit sur platform.claude.com : Anthropic ne le donne pas au studio. Le studio vous prévient dès qu'Anthropic refuse un appel faute de crédit."
                  : c.mode === "suivi"
                    ? "Indiquez votre dernière recharge."
                    : "Solde pas encore lu."}
              </p>
            )}
            <JaugeCredit pourcentage={c.pourcentage} ton={c.ton} className="mt-3" />

            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {c.nom !== "Claude" && (
                <div>
                  <dt className="text-xs text-texte-faible">Restant</dt>
                  <dd className="font-semibold tabular-nums text-texte">{c.videosRestantes === null ? "Après la 1ʳᵉ vidéo" : texteRestant(c.fournisseur, c.videosRestantes)}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-texte-faible">Ce mois</dt>
                <dd className="font-semibold tabular-nums text-texte">
                  {c.consommeMoisTexte} <span className="font-normal text-texte-faible">/ {c.plafondMoisTexte}</span>
                </dd>
              </div>
            </dl>
            {c.reserveTexte && <p className="mt-2 text-xs text-texte-faible">{c.reserveTexte} réservés pour les vidéos en cours.</p>}
            {c.enAttente > 0 && (
              <p className="mt-2 flex items-center gap-2 rounded-xl bg-brique-doux px-3 py-2 text-sm text-texte">
                <Icone nom="sablier" size={15} className="shrink-0 text-brique" />
                {c.enAttente} vidéo{c.enAttente > 1 ? "s attendent" : " attend"} ce crédit.
              </p>
            )}
            {c.expirations.map((e) => (
              <p key={e.expireLe} className="mt-2 flex items-center gap-2 rounded-xl bg-ambre-doux px-3 py-2 text-sm text-texte">
                <Icone nom="horloge" size={15} className="shrink-0 text-ambre" />
                {e.montantTexte} expirent le {dateCourte(e.expireLe)}.
              </p>
            ))}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Bouton asChild variante="secondaire" iconeDroite="lien">
                <a href={c.urlRecharge} target="_blank" rel="noreferrer noopener">
                  {c.nom === "Claude" && c.abonnements ? "Ouvrir la console" : "Recharger"}
                </a>
              </Bouton>
              {c.nom !== "Claude" && (
                <Bouton
                  variante="secondaire"
                  icone="coche"
                  className="whitespace-nowrap px-3"
                  onClick={() => {
                    setMontant("");
                    setRecharge(c);
                  }}
                >
                  J&apos;ai rechargé
                </Bouton>
              )}
            </div>
          </li>
        ))}
      </ul>

      {autres.length > 0 && (
        <p className="text-xs text-texte-faible">
          Pas encore reliés : {autres.map((c) => c.nom).join(", ")}.
        </p>
      )}

      <FeuilleBas
        ouverte={!!recharge}
        onOuverteChange={(o) => !o && setRecharge(null)}
        titre={recharge ? `Recharge ${recharge.nom}` : ""}
        description={recharge?.mode === "suivi" ? "Le montant que vous venez d'ajouter." : "Le solde sera relu chez le service."}
        pied={
          <Bouton
            taille="lg"
            pleineLargeur
            chargement={enCours}
            disabled={!(Number.parseFloat(montant.replace(",", ".")) > 0)}
            onClick={() =>
              recharge &&
              demarrer(async () => {
                const dollars = Number.parseFloat(montant.replace(",", ".").replace(/\s/g, ""));
                const r = await declarerRechargeAction(recharge.fournisseur, dollars);
                if (!r.ok) {
                  notifier.erreur(r.message);
                  return;
                }
                notifier.succes("Recharge notée", recharge.enAttente ? "Les vidéos en attente repartent." : undefined);
                setRecharge(null);
                router.refresh();
              })
            }
          >
            Enregistrer
          </Bouton>
        }
      >
        <Champ libelle="Montant ($)" inputMode="decimal" grand autoFocus value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="20" suffixe="$" />
      </FeuilleBas>
    </div>
  );
}
