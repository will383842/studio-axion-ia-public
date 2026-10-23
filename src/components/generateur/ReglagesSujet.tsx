"use client";

import { useState, type ReactNode } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { SelecteurPastilles, type OptionPastille } from "@/components/ui/SelecteurPastilles";
import { ADRESSES, BUTS_SUJET, QUI_PARLE } from "@/domaine/libelles";
import type { Adresse, ModeDiction, ObjectifSujet, ReseauDeclinaison } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { obtenirReseau } from "@/reseaux";
import { RESEAUX_DECLINAISON } from "@/reseaux/codes";

export interface FormatEcrivable {
  id: string;
  nom: string;
  icone: NomIcone;
  /** « bientot » : le texte s'écrit, la fabrication viendra (« moteur à venir »). */
  statut: string;
  modes: ModeDiction[];
  modeParDefaut: ModeDiction;
}

type Reglage = "format" | "reseaux" | "adresse" | "qui" | "but";

/**
 * Réglages d'un sujet (réseaux, format, qui parle, vous ou tu, but) : l'écran Sujet et l'écriture en série partagent
 * les mêmes valeurs par défaut et les mêmes feuilles.
 */
export function useReglagesSujet(formats: FormatEcrivable[], sensible?: string) {
  const [formatId, setFormatId] = useState(formats.find((f) => f.statut === "actif")?.id ?? formats[0]?.id ?? "");
  const [reseaux, setReseaux] = useState<ReseauDeclinaison[]>([...RESEAUX_DECLINAISON]);
  const [adresse, setAdresse] = useState<Adresse>("vous");
  const [quiChoisi, setQuiChoisi] = useState<ModeDiction | null>(null);
  const [but, setBut] = useState<ObjectifSujet>("notoriete");
  const format = formats.find((f) => f.id === formatId);
  const modes = format?.modes ?? ["avatar"];
  const qui: ModeDiction = quiChoisi && modes.includes(quiChoisi) ? quiChoisi : sensible && modes.includes("teleprompteur") ? "teleprompteur" : (format?.modeParDefaut ?? "avatar");
  return { formats, format, formatId, setFormatId, reseaux, setReseaux, adresse, setAdresse, qui, setQuiChoisi, modes, but, setBut, sensible, pret: reseaux.length > 0 && !!format };
}

export type EtatReglagesSujet = ReturnType<typeof useReglagesSujet>;

/** Les tuiles des réglages et leurs feuilles. */
export function ReglagesSujet({ r }: { r: EtatReglagesSujet }) {
  const [feuille, setFeuille] = useState<Reglage | null>(null);
  return (
    <>
      <section aria-label="Réglages" className="grid grid-cols-2 gap-2">
        <TuileReglage etiquette="Réseaux" onClick={() => setFeuille("reseaux")} large>
          <span className="flex gap-1.5">
            {RESEAUX_DECLINAISON.map((x) => (
              <LogoReseau key={x} reseau={x} taille="sm" className={cn(!r.reseaux.includes(x) && "opacity-25")} />
            ))}
          </span>
        </TuileReglage>
        <TuileReglage etiquette="Format" icone={r.format?.icone ?? "grille"} onClick={() => setFeuille("format")}>
          {r.format?.nom ?? "Choisir"}
        </TuileReglage>
        <TuileReglage etiquette="Qui parle" icone={QUI_PARLE[r.qui].icone} onClick={() => setFeuille("qui")} accent={!!r.sensible && r.qui === "teleprompteur"}>
          {QUI_PARLE[r.qui].libelle}
        </TuileReglage>
        <TuileReglage etiquette="Vous ou tu" icone="personne" onClick={() => setFeuille("adresse")}>
          {ADRESSES[r.adresse].libelle}
        </TuileReglage>
        <TuileReglage etiquette="But" icone={BUTS_SUJET[r.but].icone} onClick={() => setFeuille("but")}>
          {BUTS_SUJET[r.but].libelle}
        </TuileReglage>
      </section>

      <FeuilleReglage
        ouverte={feuille === "format"}
        onFermer={() => setFeuille(null)}
        titre="Format"
        options={r.formats.map((f) => ({ valeur: f.id, libelle: f.nom, icone: f.icone, detail: f.statut === "actif" ? undefined : "moteur à venir" }))}
        valeur={r.formatId}
        onChange={r.setFormatId}
      />
      <FeuilleBas
        ouverte={feuille === "reseaux"}
        onOuverteChange={(v) => !v && setFeuille(null)}
        titre="Réseaux"
        pied={
          <Bouton pleineLargeur taille="lg" onClick={() => setFeuille(null)}>
            OK
          </Bouton>
        }
      >
        <SelecteurPastilles<ReseauDeclinaison>
          libelle="Réseaux"
          libelleMasque
          multiple
          minimum={1}
          taille="lg"
          valeur={r.reseaux}
          onChange={r.setReseaux}
          options={RESEAUX_DECLINAISON.map((x) => ({ valeur: x, libelle: obtenirReseau(x).nom, visuel: <LogoReseau reseau={x} taille="sm" /> }))}
        />
      </FeuilleBas>
      <FeuilleReglage
        ouverte={feuille === "adresse"}
        onFermer={() => setFeuille(null)}
        titre="Vous ou tu"
        options={(Object.keys(ADRESSES) as Adresse[]).map((a) => ({ valeur: a, libelle: ADRESSES[a].libelle }))}
        valeur={r.adresse}
        onChange={r.setAdresse}
      />
      <FeuilleReglage
        ouverte={feuille === "qui"}
        onFermer={() => setFeuille(null)}
        titre="Qui parle"
        options={(Object.keys(QUI_PARLE) as ModeDiction[]).map((q) => ({
          valeur: q,
          libelle: QUI_PARLE[q].libelle,
          icone: QUI_PARLE[q].icone,
          desactive: !r.modes.includes(q),
          raison: "Pas pour ce format",
          detail: !r.modes.includes(q) ? "pas pour ce format" : q === "teleprompteur" || q === "trame" ? "vous filmez" : undefined,
        }))}
        valeur={r.qui}
        onChange={r.setQuiChoisi}
      />
      <FeuilleReglage
        ouverte={feuille === "but"}
        onFermer={() => setFeuille(null)}
        titre="But"
        options={(Object.keys(BUTS_SUJET) as ObjectifSujet[]).map((b) => ({ valeur: b, libelle: BUTS_SUJET[b].libelle, icone: BUTS_SUJET[b].icone }))}
        valeur={r.but}
        onChange={r.setBut}
      />
    </>
  );
}

function TuileReglage({ etiquette, icone, onClick, large, accent, children }: { etiquette: string; icone?: NomIcone; onClick: () => void; large?: boolean; accent?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${etiquette} : modifier`}
      className={cn(
        "flex min-h-[72px] flex-col items-start justify-between gap-2 rounded-carte border bg-surface-1 p-3 text-left transition-colors hover:border-trait-fort hover:bg-surface-2",
        accent ? "border-ambre/50" : "border-trait",
        large && "col-span-2 flex-row items-center",
      )}
    >
      <span className="text-[11px] font-bold uppercase tracking-wider text-texte-faible">{etiquette}</span>
      <span className="flex items-center gap-2 text-[15px] font-semibold text-texte">
        {icone && <Icone nom={icone} size={18} className="text-orange-vif" />}
        {children}
      </span>
    </button>
  );
}

function FeuilleReglage<V extends string>({ ouverte, onFermer, titre, options, valeur, onChange }: { ouverte: boolean; onFermer: () => void; titre: string; options: OptionPastille<V>[]; valeur: V; onChange: (v: V) => void }) {
  return (
    <FeuilleBas ouverte={ouverte} onOuverteChange={(v) => !v && onFermer()} titre={titre}>
      <SelecteurPastilles
        libelle={titre}
        libelleMasque
        taille="lg"
        options={options}
        valeur={valeur}
        onChange={(v) => {
          onChange(v);
          onFermer();
        }}
      />
    </FeuilleBas>
  );
}
