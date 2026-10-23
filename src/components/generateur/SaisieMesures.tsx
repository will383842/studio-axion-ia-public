"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enregistrerMesuresAction } from "@/app/(studio)/mesures/actions";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone } from "@/components/ui/Icone";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { notifier } from "@/components/ui/Toast";
import { controlerSaisie, lireNombreFr, partagesParPortee, type SaisieMesures } from "@/domaine/mesures";
import type { ReseauDeclinaison } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { formateurDate, formateurNombre } from "@/lib/intl";

export interface MesureAffichee {
  publicationId: string;
  code: string;
  reseau: ReseauDeclinaison;
  titre: string;
  jour: 3 | 7;
  datePublication: string;
}

export interface MesureDejaSaisie {
  cle: string;
  code: string;
  reseau: ReseauDeclinaison;
  jour: number;
  tauxAbandon3s?: number;
  dureeMoyenneVueSec?: number;
  partagesParPortee?: number;
}

const fmtDate = (iso: string) => formateurDate("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" }).format(new Date(iso));
const fmtNombre = (n: number | undefined, suffixe = "") => (n === undefined ? "—" : `${formateurNombre("fr-FR", { maximumFractionDigits: 2 }).format(n)}${suffixe}`);

/**
 * MESURES À SAISIR (plan v5 B.8 §2, lot G7a) : une carte par vidéo à J+3 ou J+7 ; un toucher ouvre la saisie (4 champs
 * au clavier numérique, 30 s). Les chiffres sont gardés tels quels : aucune estimation, aucune prédiction.
 */
export function SaisieMesures({ aSaisir, saisies }: { aSaisir: MesureAffichee[]; saisies: MesureDejaSaisie[] }) {
  const [ouverte, setOuverte] = useState<MesureAffichee | null>(null);
  return (
    <div className="space-y-6">
      {aSaisir.length === 0 ? (
        <Carte className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-sauge-doux text-sauge">
            <Icone nom="coche" size={26} />
          </span>
          <p className="font-titre text-xl text-texte">Rien à saisir</p>
          <p className="text-sm text-texte-doux">Les vidéos publiées reviennent ici à J+3 et J+7.</p>
          {/* Vérification E2E n° 1, n° 29 : une vidéo déjà publiée à la main se mesure tout de suite, à sa vraie date. */}
          <p className="text-sm text-texte-doux">Une vidéo publiée à la main il y a quelques jours ? Sur la vidéo : « Publier », « Choisir » le jour de publication, puis « Je l&apos;ai publiée moi-même ».</p>
        </Carte>
      ) : (
        <ul className="space-y-2">
          {aSaisir.map((m) => (
            <li key={m.publicationId}>
              <button
                type="button"
                onClick={() => setOuverte(m)}
                className="flex min-h-[72px] w-full items-center gap-3 rounded-carte border border-trait bg-surface-1 p-3 text-left transition-colors hover:border-trait-fort"
              >
                <LogoReseau reseau={m.reseau} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-texte">{m.titre}</span>
                  <span className="block font-mono text-xs text-texte-faible">
                    {m.code} · {fmtDate(m.datePublication)}
                  </span>
                </span>
                <span className={cn("shrink-0 rounded-full px-3 py-1 font-titre text-sm tabular-nums", m.jour === 7 ? "bg-orange-doux text-orange-vif" : "bg-surface-2 text-texte")}>J+{m.jour}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {saisies.length > 0 && (
        <section aria-labelledby="titre-saisies">
          <div className="mb-2 flex items-end gap-3 pr-3">
            <h2 id="titre-saisies" className="flex-1 font-texte text-xs font-bold uppercase tracking-wider text-texte-faible">
              Déjà saisies
            </h2>
            {/* En-têtes visuels seulement : chaque chiffre porte son propre nom pour les lecteurs d'écran. */}
            <span aria-hidden className="grid grid-cols-3 gap-3 text-right text-[11px] font-semibold text-texte-faible">
              <span>3 s</span>
              <span>Durée</span>
              <span>Partages</span>
            </span>
          </div>
          <Carte sansMarge>
            <ul className="divide-y divide-trait">
              {saisies.map((s) => (
                <li key={s.cle} className="flex items-center gap-3 p-3">
                  <LogoReseau reseau={s.reseau} taille="sm" />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-texte-doux">
                    {s.code} · J+{s.jour}
                  </span>
                  <span className="grid grid-cols-3 gap-3 text-right text-sm tabular-nums text-texte">
                    <span title="Partis avant 3 s"><span className="sr-only">Partis avant 3 s : </span>{fmtNombre(s.tauxAbandon3s, " %")}</span>
                    <span title="Durée moyenne"><span className="sr-only">Durée moyenne : </span>{fmtNombre(s.dureeMoyenneVueSec, " s")}</span>
                    <span title="Partages ÷ portée"><span className="sr-only">Partages : </span>{fmtNombre(s.partagesParPortee, " %")}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Carte>
        </section>
      )}

      {ouverte && <FeuilleSaisie key={ouverte.publicationId} mesure={ouverte} onFermer={() => setOuverte(null)} />}
    </div>
  );
}

type Champs = Record<keyof SaisieMesures, string>;

const CHAMPS: { cle: keyof SaisieMesures; libelle: string; unite: string; mode: "decimal" | "numeric" }[] = [
  { cle: "abandon3s", libelle: "Partis avant 3 s", unite: "%", mode: "decimal" },
  { cle: "dureeMoyenneSec", libelle: "Durée moyenne regardée", unite: "s", mode: "decimal" },
  { cle: "partages", libelle: "Partages", unite: "", mode: "numeric" },
  { cle: "portee", libelle: "Personnes atteintes", unite: "", mode: "numeric" },
];

function FeuilleSaisie({ mesure, onFermer }: { mesure: MesureAffichee; onFermer: () => void }) {
  const router = useRouter();
  const [champs, setChamps] = useState<Champs>({ abandon3s: "", dureeMoyenneSec: "", partages: "", portee: "" });
  const [erreur, setErreur] = useState<{ champ: keyof SaisieMesures; message: string } | null>(null);
  const [enCours, demarrer] = useTransition();
  const saisie: SaisieMesures = { abandon3s: lireNombreFr(champs.abandon3s), dureeMoyenneSec: lireNombreFr(champs.dureeMoyenneSec), partages: lireNombreFr(champs.partages), portee: lireNombreFr(champs.portee) };
  const complet = Object.values(champs).every((v) => v.trim() !== "");
  const ratio = saisie.portee > 0 && Number.isFinite(saisie.partages) ? partagesParPortee(saisie.partages, saisie.portee) : null;

  function enregistrer() {
    const c = controlerSaisie(saisie);
    if (!c.ok) {
      setErreur({ champ: c.champ, message: c.message });
      return;
    }
    demarrer(async () => {
      const r = await enregistrerMesuresAction(mesure.publicationId, saisie);
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      notifier.succes(`Mesures J+${mesure.jour} enregistrées`);
      onFermer();
      router.refresh();
    });
  }

  return (
    <FeuilleBas
      ouverte
      onOuverteChange={(o) => !o && onFermer()}
      titre={`Mesures J+${mesure.jour}`}
      description={mesure.code}
      pied={
        <Bouton pleineLargeur taille="lg" icone="coche" disabled={!complet} chargement={enCours} onClick={enregistrer}>
          Enregistrer
        </Bouton>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <LogoReseau reseau={mesure.reseau} taille="sm" />
        <span className="truncate text-sm font-semibold text-texte">{mesure.titre}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {CHAMPS.map((c) => (
          <label key={c.cle} className="block">
            <span className="mb-1.5 block text-[13px] font-semibold leading-tight text-texte-doux">{c.libelle}</span>
            <span className={cn("flex min-h-14 items-center gap-1 rounded-champ border bg-surface-2 px-3 focus-within:border-orange", erreur?.champ === c.cle ? "border-brique" : "border-trait")}>
              <input
                inputMode={c.mode}
                enterKeyHint="next"
                autoComplete="off"
                aria-label={c.libelle}
                aria-invalid={erreur?.champ === c.cle || undefined}
                value={champs[c.cle]}
                onChange={(e) => {
                  setChamps((x) => ({ ...x, [c.cle]: e.target.value }));
                  setErreur(null);
                }}
                className="min-w-0 flex-1 bg-transparent font-titre text-2xl tabular-nums text-texte outline-none"
              />
              {c.unite && <span className="text-sm font-semibold text-texte-faible">{c.unite}</span>}
            </span>
          </label>
        ))}
      </div>
      {erreur && <p className="mt-3 text-sm text-brique">{erreur.message}</p>}
      <p className="mt-4 flex min-h-11 items-center justify-between rounded-champ bg-surface-2 px-3 text-sm text-texte-doux">
        Partages ÷ portée
        <span className="font-titre text-lg tabular-nums text-texte">{ratio === null ? "—" : `${fmtNombre(ratio)} %`}</span>
      </p>
    </FeuilleBas>
  );
}
