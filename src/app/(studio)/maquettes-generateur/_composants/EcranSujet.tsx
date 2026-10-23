"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { BarreActionCollee, Bouton, Carte, FeuilleBas, Icone, LogoReseau, SelecteurPastilles, type NomIcone, type OptionPastille } from "@/components/ui";
import type { IdReseau } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { obtenirReseau } from "@/reseaux";
import { RESEAUX_GENERATEUR } from "../_demo";
import { ADRESSE, BUTS, QUI_PARLE } from "../_lexique";

type Reglage = "format" | "reseaux" | "adresse" | "qui" | "but";

const ICONES_BUT: Record<(typeof BUTS)[number], NomIcone> = {
  "Faire partager": "partager",
  "Faire garder": "signet",
  "Faire réagir": "citation",
  "Rendez-vous": "calendrier",
};
const ICONES_QUI: Record<(typeof QUI_PARLE)[number], NomIcone> = {
  "Mon double": "visage",
  "Je lis": "texte",
  "J'improvise": "micro",
  "Voix off": "volume",
};

/** Écran Sujet (B.6.5) : l'idée seule est obligatoire, le reste est déjà réglé. */
export function EcranSujet({ ideeInitiale, sensible }: { ideeInitiale: string; sensible: boolean }) {
  const idIdee = useId();
  const [idee, setIdee] = useState(ideeInitiale);
  const [phraseOuverte, setPhraseOuverte] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [feuille, setFeuille] = useState<Reglage | null>(null);
  const [format, setFormat] = useState("Avocat");
  const [reseaux, setReseaux] = useState<IdReseau[]>(RESEAUX_GENERATEUR);
  const [adresse, setAdresse] = useState<(typeof ADRESSE)[number]>("Vous");
  const [qui, setQui] = useState<(typeof QUI_PARLE)[number]>(sensible ? "Je lis" : "Mon double");
  const [but, setBut] = useState<(typeof BUTS)[number]>("Faire partager");
  const pret = idee.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* L'idée : le seul champ obligatoire */}
      <Carte lueur className="p-0 sm:p-0">
        <label htmlFor={idIdee} className="flex items-center gap-2 px-4 pt-4 text-sm font-semibold text-orange-vif">
          <Icone nom="idee" size={16} />
          Votre idée
        </label>
        <textarea
          id={idIdee}
          value={idee}
          onChange={(e) => setIdee(e.target.value)}
          rows={3}
          placeholder="Dites ou tapez votre idée"
          className="block w-full resize-none bg-transparent px-4 pb-4 pt-2 text-xl font-semibold leading-snug text-texte outline-none placeholder:text-texte-faible"
        />
      </Carte>

      {/* Une phrase à vous : repliée */}
      {phraseOuverte ? (
        <Carte className="p-0 sm:p-0">
          <label htmlFor={`${idIdee}-p`} className="block px-4 pt-3 text-sm font-semibold text-texte-doux">
            Une phrase à vous
          </label>
          <textarea
            id={`${idIdee}-p`}
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            rows={2}
            autoFocus
            placeholder="Facultatif"
            className="block w-full resize-none bg-transparent px-4 pb-3 pt-1 text-base text-texte outline-none placeholder:text-texte-faible"
          />
        </Carte>
      ) : (
        <button
          type="button"
          onClick={() => setPhraseOuverte(true)}
          className="flex min-h-12 w-full items-center gap-2 rounded-carte border border-dashed border-trait-fort px-4 text-left text-sm font-semibold text-texte-doux hover:text-texte"
        >
          <Icone nom="plus" size={16} />
          Une phrase à vous
          <span className="ml-auto text-xs font-medium text-texte-faible">facultatif</span>
        </button>
      )}

      {sensible && (
        <div className="flex items-center gap-3 rounded-carte border border-ambre/40 bg-ambre-doux p-3">
          <Icone nom="balance" size={20} className="shrink-0 text-ambre" />
          <p className="flex-1 text-sm font-semibold leading-snug text-texte">Sujet juridique : vous en personne conseillé</p>
          <button type="button" onClick={() => setQui("Mon double")} className="min-h-11 shrink-0 rounded-full border border-trait-fort px-3 text-xs font-bold text-texte">
            Garder mon double
          </button>
        </div>
      )}

      {/* Pastilles déjà réglées */}
      <section aria-label="Réglages" className="grid grid-cols-2 gap-2">
        <TuileReglage etiquette="Réseaux" onClick={() => setFeuille("reseaux")} large>
          <span className="flex gap-1.5">
            {RESEAUX_GENERATEUR.map((r) => (
              <LogoReseau key={r} reseau={r} taille="sm" className={cn(!reseaux.includes(r) && "opacity-25")} />
            ))}
          </span>
        </TuileReglage>
        <TuileReglage etiquette="Format" icone="balance" onClick={() => setFeuille("format")}>
          {format}
        </TuileReglage>
        <TuileReglage etiquette="Qui parle" icone={ICONES_QUI[qui]} onClick={() => setFeuille("qui")} accent={sensible && qui === "Je lis"}>
          {qui}
        </TuileReglage>
        <TuileReglage etiquette="Vous ou tu" icone="personne" onClick={() => setFeuille("adresse")}>
          {adresse}
        </TuileReglage>
        <TuileReglage etiquette="But" icone={ICONES_BUT[but]} onClick={() => setFeuille("but")}>
          {but}
        </TuileReglage>
      </section>

      {/* « Je choisis » : replié, pour qui veut tout régler */}
      <details className="group rounded-carte border border-trait bg-surface-1 px-4">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm font-semibold text-texte-doux">
          Je choisis
          <Icone nom="chevron-bas" size={16} className="transition-transform group-open:rotate-180" />
        </summary>
        <ul className="divide-y divide-trait pb-2">
          {[
            ["À qui ?", "Dirigeants de PME"],
            ["Ils connaissent le problème ?", "Oui"],
            ["Mot cherché", "factures ChatGPT"],
            ["Avec quelle matière ?", "Une question reçue"],
          ].map(([q, r]) => (
            <li key={q} className="flex min-h-12 items-center justify-between gap-3 text-sm">
              <span className="text-texte-doux">{q}</span>
              <span className="font-semibold text-texte">{r}</span>
            </li>
          ))}
        </ul>
      </details>

      <BarreActionCollee>
        {pret ? (
          <Bouton asChild icone="ecrire" taille="lg">
            <Link href="/maquettes-generateur/resultat">Écrire · au plus 1,40 €</Link>
          </Bouton>
        ) : (
          <Bouton icone="ecrire" taille="lg" disabled>
            Écrire · au plus 1,40 €
          </Bouton>
        )}
      </BarreActionCollee>

      <FeuilleReglage
        ouverte={feuille === "format"}
        onFermer={() => setFeuille(null)}
        titre="Format"
        options={[
          { valeur: "Avocat", libelle: "Avocat", icone: "balance" },
          { valeur: "Podcast", libelle: "Podcast", icone: "casque", desactive: true, raison: "Bientôt", detail: "bientôt" },
          { valeur: "Écran partagé", libelle: "Écran partagé", icone: "ecran-partage", desactive: true, raison: "Bientôt", detail: "bientôt" },
          { valeur: "Selfie", libelle: "Selfie", icone: "camera", desactive: true, raison: "Bientôt", detail: "bientôt" },
        ]}
        valeur={format}
        onChange={setFormat}
      />
      <FeuilleBas ouverte={feuille === "reseaux"} onOuverteChange={(v) => !v && setFeuille(null)} titre="Réseaux" pied={<Bouton pleineLargeur taille="lg" onClick={() => setFeuille(null)}>OK</Bouton>}>
        <SelecteurPastilles
          libelle="Réseaux"
          libelleMasque
          multiple
          minimum={1}
          taille="lg"
          valeur={reseaux}
          onChange={setReseaux}
          options={RESEAUX_GENERATEUR.map((r) => ({ valeur: r, libelle: obtenirReseau(r).nom, visuel: <LogoReseau reseau={r} taille="sm" /> }))}
        />
      </FeuilleBas>
      <FeuilleReglage
        ouverte={feuille === "adresse"}
        onFermer={() => setFeuille(null)}
        titre="Vous ou tu"
        options={ADRESSE.map((a) => ({ valeur: a, libelle: a }))}
        valeur={adresse}
        onChange={setAdresse}
      />
      <FeuilleReglage
        ouverte={feuille === "qui"}
        onFermer={() => setFeuille(null)}
        titre="Qui parle"
        options={QUI_PARLE.map((q) => ({ valeur: q, libelle: q, icone: ICONES_QUI[q], detail: q === "Je lis" || q === "J'improvise" ? "vous filmez" : undefined }))}
        valeur={qui}
        onChange={setQui}
      />
      <FeuilleReglage
        ouverte={feuille === "but"}
        onFermer={() => setFeuille(null)}
        titre="But"
        options={BUTS.map((b) => ({ valeur: b, libelle: b, icone: ICONES_BUT[b] }))}
        valeur={but}
        onChange={setBut}
      />
    </div>
  );
}

function TuileReglage({
  etiquette,
  icone,
  onClick,
  large,
  accent,
  children,
}: {
  etiquette: string;
  icone?: NomIcone;
  onClick: () => void;
  large?: boolean;
  accent?: boolean;
  children: ReactNode;
}) {
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

function FeuilleReglage<V extends string>({
  ouverte,
  onFermer,
  titre,
  options,
  valeur,
  onChange,
}: {
  ouverte: boolean;
  onFermer: () => void;
  titre: string;
  options: OptionPastille<V>[];
  valeur: V;
  onChange: (v: V) => void;
}) {
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
