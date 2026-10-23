"use client";

import { useState } from "react";
import { rappelHebdoAction } from "@/app/(studio)/ecrire/matieres/actions";
import type { TypeMatiere } from "@/domaine/types";
import { LIBELLES_MATIERE, TYPES_MATIERE, type Jauge } from "@/domaine/matieres";
import type { VueMatiere } from "@/services/matieres";
import type { VuePreuve } from "@/services/preuves";
import { Bouton, Carte, EtatVide, Icone, Interrupteur, LogoReseau, notifier, Pastille } from "@/components/ui";
import { cn } from "@/lib/cn";
import { DepuisVotreSite } from "./DepuisVotreSite";
import { FeuilleEnVrac } from "./FeuilleEnVrac";
import { FeuilleMatiere } from "./FeuilleMatiere";
import { FeuilleNouvelleMatiere } from "./FeuilleNouvelleMatiere";
import { FeuilleNouvellePreuve, FeuillePreuve } from "./FeuillePreuve";
import { cite, ICONE_MATIERE, PastilleType } from "./visuels";

type Filtre = "tout" | TypeMatiere | "preuves";

/** Jauge du carburant : « ≈ N sujets variés · il manque surtout … » (+ dicter ce type d'un toucher). */
function CarteJauge({ jauge, onAjouter }: { jauge: Jauge; onAjouter: (t: TypeMatiere) => void }) {
  return (
    <Carte lueur className="!p-4">
      <div className="flex items-end gap-3">
        <p className="font-titre text-5xl leading-none text-texte tabular-nums">≈ {jauge.sujets}</p>
        <p className="pb-1 text-sm font-semibold text-texte-doux">sujets variés</p>
        {jauge.expirentBientot > 0 && (
          <Pastille ton="ambre" icone="horloge" className="mb-1 ml-auto">
            {jauge.expirentBientot} expire{jauge.expirentBientot > 1 ? "nt" : ""}
          </Pastille>
        )}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3" aria-hidden>
        <div className="h-full rounded-full bg-orange transition-[width] duration-500" style={{ width: `${Math.max(4, Math.round(jauge.remplissage * 100))}%` }} />
      </div>
      {jauge.manqueSurtout && (
        <button type="button" onClick={() => onAjouter(jauge.manqueSurtout!)} className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-2xl bg-surface-2 px-3 text-left text-sm text-texte-doux hover:bg-surface-3">
          <Icone nom={ICONE_MATIERE[jauge.manqueSurtout]} size={16} className="text-ambre" />
          <span>
            Il manque surtout <span className="font-semibold text-texte">{LIBELLES_MATIERE[jauge.manqueSurtout].manque}</span>
          </span>
          <Icone nom="micro" size={16} className="ml-auto text-orange-vif" />
        </button>
      )}
    </Carte>
  );
}

function CarteMatiere({ vue, onOuvrir }: { vue: VueMatiere; onOuvrir: () => void }) {
  const { matiere: m, etat, utilisations: u } = vue;
  const servie = u.sujets[0];
  return (
    <li>
      <button type="button" onClick={onOuvrir} className={cn("w-full rounded-carte border border-trait bg-surface-1 p-4 text-left transition-colors hover:bg-surface-2", etat.retiree && "opacity-55")}>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <PastilleType type={m.type} />
          {etat.retiree && <Pastille ton="brique">Retirée</Pastille>}
          {etat.aConfirmer && !etat.retiree && <Pastille ton="ambre">À confirmer</Pastille>}
          {etat.accordManquant && !etat.retiree && (
            <Pastille ton="ambre" icone="bouclier">
              Sans accord
            </Pastille>
          )}
          {etat.perimee && !etat.retiree && <Pastille ton="neutre">Périmée</Pastille>}
          {etat.expireBientot && <Pastille ton="ambre" icone="horloge">Expire bientôt</Pastille>}
          {etat.faible && !etat.retiree && <Pastille ton="neutre">Sans détail</Pastille>}
        </div>
        <p className="line-clamp-3 text-[15px] font-semibold leading-snug text-texte">{cite(m.texte)}</p>
        <div className="mt-3 flex min-h-6 items-center gap-1.5 text-xs text-texte-faible">
          {servie ? (
            <>
              <span>
                A servi dans n° {servie.numero}
                {u.nombre > 1 ? ` (+${u.nombre - 1})` : ""}
              </span>
              <span className="ml-1 flex gap-1">
                {servie.reseaux.map((r) => (
                  <LogoReseau key={r} reseau={r} taille="sm" />
                ))}
              </span>
            </>
          ) : (
            <span>Jamais servie</span>
          )}
        </div>
      </button>
    </li>
  );
}

function CartePreuve({ vue, onOuvrir }: { vue: VuePreuve; onOuvrir: () => void }) {
  const p = vue.preuve;
  return (
    <li>
      <button type="button" onClick={onOuvrir} className={cn("w-full rounded-carte border border-trait bg-surface-1 p-4 text-left hover:bg-surface-2", p.retrait && "opacity-55")}>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-texte-doux">
            <Icone nom="resultats" size={12} />
            {p.type === "cas-client" ? "Cas client" : p.type === "etude" ? "Étude" : p.type === "regle-loi" ? "Règle" : "Chiffre"}
          </span>
          {p.retrait && <Pastille ton="brique">Retirée</Pastille>}
          {p.type === "cas-client" && !p.client?.accordEcrit && !p.retrait && (
            <Pastille ton="ambre" icone="bouclier">
              Sans accord
            </Pastille>
          )}
          {p.formulationsInterdites.length > 0 && (
            <Pastille ton="neutre" icone="oeil-barre">
              {p.formulationsInterdites.length}
            </Pastille>
          )}
        </div>
        <p className="line-clamp-3 text-[15px] font-semibold leading-snug text-texte">{cite(p.enonce)}</p>
        <p className="mt-3 text-xs text-texte-faible">{vue.utilisations.sujets[0] ? `A servi dans n° ${vue.utilisations.sujets[0].numero}` : "Jamais servie"}</p>
      </button>
    </li>
  );
}

/**
 * ONGLET « MATIÈRES » (plan v5 B.6.1, B.2.9) : une liste unique, des pastilles par type (les 11, plus « Chiffres et
 * preuves »), « + Matière » au micro, la dictée en vrac, la jauge, et sur chaque carte « A servi dans n° 42 ».
 */
export function OngletMatieres({
  vues,
  preuves,
  jauge,
  rappelHebdo,
  filtreInitial = "tout",
  ajoutInitial,
  rangementEssai = false,
}: {
  vues: VueMatiere[];
  preuves: VuePreuve[];
  jauge: Jauge;
  rappelHebdo: boolean;
  filtreInitial?: Filtre;
  ajoutInitial?: "matiere" | "vrac" | "preuve";
  /** « Ranger pour moi » (essai) : seulement quand Claude n'est pas relié (B14). */
  rangementEssai?: boolean;
}) {
  const [filtre, setFiltre] = useState<Filtre>(filtreInitial);
  const [ajout, setAjout] = useState<"matiere" | "vrac" | "preuve" | null>(ajoutInitial ?? null);
  const [typeAjout, setTypeAjout] = useState<TypeMatiere | undefined>();
  const [ouverteId, setOuverteId] = useState<string | null>(null);
  const [preuveId, setPreuveId] = useState<string | null>(null);
  const [rappel, setRappel] = useState(rappelHebdo);

  // Les matières de votre site encore à relire vivent dans leur bloc (pas deux fois à l'écran).
  const aRelireSite = (v: VueMatiere) => v.matiere.source.origine === "site" && v.etat.aConfirmer && !v.etat.retiree;
  const liste = vues.filter((v) => !aRelireSite(v));
  const compte = (t: TypeMatiere) => liste.filter((v) => v.matiere.type === t && !v.etat.retiree).length;
  const visibles = filtre === "tout" ? liste : filtre === "preuves" ? [] : liste.filter((v) => v.matiere.type === filtre);
  const options: { valeur: Filtre; libelle: string; compteur: number }[] = [
    { valeur: "tout", libelle: "Tout", compteur: liste.filter((v) => !v.etat.retiree).length },
    ...TYPES_MATIERE.map((t) => ({ valeur: t as Filtre, libelle: LIBELLES_MATIERE[t].pluriel, compteur: compte(t) })),
    { valeur: "preuves", libelle: "Chiffres et preuves", compteur: preuves.filter((p) => !p.preuve.retrait).length },
  ];

  // Source axion-ia.com (03/10) : proposées depuis votre site, encore à relire.
  const depuisSite = vues.filter(aRelireSite);

  return (
    <div className="space-y-4">
      <DepuisVotreSite vues={depuisSite} />

      <CarteJauge
        jauge={jauge}
        onAjouter={(t) => {
          setTypeAjout(t);
          setAjout("matiere");
        }}
      />

      <div className="grid grid-cols-2 gap-2">
        <Bouton
          taille="lg"
          icone="micro"
          onClick={() => {
            setTypeAjout(filtre !== "tout" && filtre !== "preuves" ? filtre : undefined);
            setAjout(filtre === "preuves" ? "preuve" : "matiere");
          }}
        >
          {filtre === "preuves" ? "Preuve" : "Matière"}
        </Bouton>
        <Bouton taille="lg" variante="secondaire" icone="calques" onClick={() => setAjout("vrac")}>
          Plusieurs
        </Bouton>
      </div>

      <div role="radiogroup" aria-label="Type de matière" className="sans-barre -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {options.map((o) => {
          const actif = filtre === o.valeur;
          return (
            <button
              key={o.valeur}
              type="button"
              role="radio"
              aria-checked={actif}
              onClick={() => setFiltre(o.valeur)}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
                actif ? "border-texte bg-texte text-fond" : "border-trait bg-surface-1 text-texte hover:bg-surface-2",
                !actif && o.compteur === 0 && o.valeur !== "tout" && "text-texte-faible",
              )}
            >
              {o.valeur !== "tout" && <Icone nom={o.valeur === "preuves" ? "resultats" : ICONE_MATIERE[o.valeur]} size={14} />}
              {o.libelle}
              <span className={cn("tabular-nums", actif ? "text-fond/70" : "text-texte-faible")}>{o.compteur}</span>
            </button>
          );
        })}
      </div>

      {filtre === "preuves" ? (
        preuves.length ? (
          <ul className="space-y-3">
            {preuves.map((p) => (
              <CartePreuve key={p.preuve.id} vue={p} onOuvrir={() => setPreuveId(p.preuve.id)} />
            ))}
          </ul>
        ) : (
          <EtatVide compact icone="resultats" titre="Aucune preuve" phrase="Dictez un chiffre vrai, avec sa source." action={<Bouton icone="micro" onClick={() => setAjout("preuve")}>Preuve</Bouton>} />
        )
      ) : visibles.length ? (
        <ul className="space-y-3">
          {visibles.map((v) => (
            <CarteMatiere key={v.matiere.id} vue={v} onOuvrir={() => setOuverteId(v.matiere.id)} />
          ))}
        </ul>
      ) : (
        <EtatVide
          compact
          icone="micro"
          titre={filtre === "tout" ? "Aucune matière" : `Aucune ${LIBELLES_MATIERE[filtre].court.toLowerCase()}`}
          phrase="Ce qu'on vous demande, ce que vous voyez souvent, ce que vous pensez."
          action={
            <Bouton
              icone="micro"
              onClick={() => {
                setTypeAjout(filtre === "tout" ? undefined : filtre);
                setAjout("matiere");
              }}
            >
              Dicter
            </Bouton>
          }
        />
      )}

      <div className="rounded-carte border border-trait bg-surface-1 px-4">
        <Interrupteur
          icone="cloche"
          libelle="Rappel chaque semaine"
          detail="« 2 phrases entendues ? »"
          coche={rappel}
          onChange={async (v) => {
            setRappel(v);
            const r = await rappelHebdoAction(v);
            if (!r.ok) {
              setRappel(!v);
              notifier.erreur(r.message);
            }
          }}
        />
      </div>

      <FeuilleNouvelleMatiere key={typeAjout ?? "auto"} ouverte={ajout === "matiere"} onOuverteChange={(o) => !o && setAjout(null)} typeInitial={typeAjout} />
      <FeuilleEnVrac ouverte={ajout === "vrac"} onOuverteChange={(o) => !o && setAjout(null)} rangementEssai={rangementEssai} />
      <FeuilleNouvellePreuve ouverte={ajout === "preuve"} onOuverteChange={(o) => !o && setAjout(null)} />
      <FeuilleMatiere vue={vues.find((v) => v.matiere.id === ouverteId) ?? null} onFermer={() => setOuverteId(null)} />
      <FeuillePreuve vue={preuves.find((p) => p.preuve.id === preuveId) ?? null} onFermer={() => setPreuveId(null)} />
    </div>
  );
}
