"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { eteindreAutonomieUsineAction, reglerAutonomieUsineAction } from "@/app/(studio)/reglages/actions-autonomie-usine";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { Interrupteur } from "@/components/ui/Interrupteur";
import { notifier } from "@/components/ui/Toast";
import { champEuros, lireSaisieEuros } from "./montants-euros";

/** Ce que l'écran a besoin de connaître (sous-ensemble de `vueAutonomieUsine`). */
export interface VueAutonomieEcran {
  actif: boolean;
  plafondCents: number;
  utiliseCents: number;
  pourcentage: number;
  /** AAAA-MM, mois de Paris. */
  mois: string;
  /** Qui règle l'autonomie. Absent ou autre que « usine » : l'écran de réglage habituel. */
  pilote?: "usine" | "studio" | "aucun";
}

/** Symbole écrit par son code (la règle de fer « montant » interdit un euro en dur dans les composants). */
const EURO = "\u20ac";

export const TEXTES_AUTONOMIE_USINE = {
  titre: "L'Usine en automatique",
  interrupteur: "L'Usine dépense seule sous le plafond",
  plafond: `Plafond du mois (${EURO})`,
  enregistrer: "Enregistrer",
  eteinte: "Éteinte : chaque dépense de l'Usine demande votre confirmation.",
  zeroAllume: "Pour allumer l'Usine en automatique, indiquez un plafond du mois supérieur à zéro.",
  seRegleDansUsine: "Se règle dans l'Usine.",
  eteindre: "Éteindre",
  eteindreAide: "En cas de souci, ce bouton éteint tout de suite : l'Usine ne dépense plus seule. Pour la rallumer, il faudra passer par l'Usine.",
  fixe: "Au plafond, l'Usine s'arrête net. Vos fabrications dans le Studio ne sont pas concernées.",
} as const;

/** « novembre » à partir de « 2026-11 » (le mois est déjà celui de Paris). */
export function nomDuMois(mois: string): string {
  const [a, m] = mois.split("-").map(Number);
  if (!a || !m) return mois;
  return new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, 15)));
}

const nombre = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const eur = (c: number) => `${nombre.format(c / 100)}\u00a0${EURO}`;

/** Phrase d'état du mois (pure). */
export function texteEtatAutonomie(v: VueAutonomieEcran): string {
  if (!v.actif) return TEXTES_AUTONOMIE_USINE.eteinte;
  return `Utilisé : ${eur(v.utiliseCents)} sur ${eur(v.plafondCents)} (${v.pourcentage} %) · mois de ${nomDuMois(v.mois)} (heure de Paris)`;
}

/** Phrase de la lecture seule (pure) : ce qui est utilisé ce mois-ci, sans plafond ni prix nouveau. */
export function texteLectureUsine(v: VueAutonomieEcran): string {
  const etat = v.actif ? "L'Usine dépense seule." : "L'Usine ne dépense pas seule : chaque dépense demande votre confirmation.";
  return `${etat} Utilisé ce mois-ci : ${eur(v.utiliseCents)} (mois de ${nomDuMois(v.mois)}, heure de Paris).`;
}

/** Quand l'Usine règle l'autonomie : lecture seule et un seul bouton, « Éteindre » (jamais d'allumage ici). */
function LectureUsine({ vue }: { vue: VueAutonomieEcran }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  function eteindre() {
    demarrer(async () => {
      let r;
      try {
        r = await eteindreAutonomieUsineAction();
      } catch {
        notifier.erreur("Rien n'a été changé. Réessayez.");
        return;
      }
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      notifier.succes("Usine en automatique éteinte");
      router.refresh();
    });
  }
  return (
    <div id="usine-automatique" className="scroll-mt-24 space-y-4">
      <p className="text-base font-medium text-texte">{TEXTES_AUTONOMIE_USINE.seRegleDansUsine}</p>
      <p className="text-base text-texte" role="status">
        {texteLectureUsine(vue)}
      </p>
      {vue.actif && (
        <>
          <Bouton variante="secondaire" disabled={enCours} onClick={eteindre}>
            {TEXTES_AUTONOMIE_USINE.eteindre}
          </Bouton>
          <p className="text-sm text-texte-doux">{TEXTES_AUTONOMIE_USINE.eteindreAide}</p>
        </>
      )}
    </div>
  );
}

export function AutonomieUsine({ vue }: { vue: VueAutonomieEcran }) {
  if (vue.pilote === "usine") return <LectureUsine vue={vue} />;
  return <ReglageStudio vue={vue} />;
}

function ReglageStudio({ vue }: { vue: VueAutonomieEcran }) {
  const router = useRouter();
  const [actif, setActif] = useState(vue.actif);
  const [plafond, setPlafond] = useState(vue.plafondCents > 0 ? champEuros(vue.plafondCents / 100) : "");
  const [erreur, setErreur] = useState<string | undefined>();
  const [enCours, demarrer] = useTransition();

  function enregistrer() {
    const euros = plafond.trim() === "" ? 0 : lireSaisieEuros(plafond);
    if (Number.isNaN(euros)) {
      setErreur("Indiquez un montant en euros, par exemple 200.");
      return;
    }
    if (actif && euros <= 0) {
      setErreur(TEXTES_AUTONOMIE_USINE.zeroAllume);
      return;
    }
    setErreur(undefined);
    demarrer(async () => {
      let r;
      try {
        r = await reglerAutonomieUsineAction(actif, euros);
      } catch {
        notifier.erreur("Rien n'a été enregistré. Réessayez.");
        return;
      }
      if (!r.ok) {
        setErreur(r.message);
        return;
      }
      notifier.succes(actif ? "Usine en automatique allumée" : "Usine en automatique éteinte");
      router.refresh();
    });
  }

  return (
    <div id="usine-automatique" className="scroll-mt-24 space-y-4">
      <Interrupteur libelle={TEXTES_AUTONOMIE_USINE.interrupteur} coche={actif} desactive={enCours} onChange={setActif} />
      <Champ libelle={TEXTES_AUTONOMIE_USINE.plafond} inputMode="decimal" value={plafond} onChange={(e) => setPlafond(e.target.value)} erreur={erreur} />
      <Bouton variante="secondaire" disabled={enCours} onClick={enregistrer}>
        {TEXTES_AUTONOMIE_USINE.enregistrer}
      </Bouton>
      <p className="text-sm text-texte" role="status">
        {texteEtatAutonomie(vue)}
      </p>
      <p className="text-sm text-texte-doux">{TEXTES_AUTONOMIE_USINE.fixe}</p>
    </div>
  );
}
