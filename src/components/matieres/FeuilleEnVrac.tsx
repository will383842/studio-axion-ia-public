"use client";

import { useRef, useState } from "react";
import { useRetenirDepart } from "@/components/generateur/useRetenirDepart";
import { enregistrerEnVracAction, proposerDecoupeAction, rangerPourMoiAction } from "@/app/(studio)/ecrire/matieres/actions";
import { accordRequis } from "@/domaine/matieres";
import type { TypeMatiere } from "@/domaine/types";
import { Bouton, FeuilleBas, Icone, Interrupteur, notifier, PastilleEssai, ZoneTexte } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ajouterDicte, BoutonMicro, useDictee } from "./Dictee";
import { ChoixType, cite, NomsAMasquer, PastilleType } from "./visuels";

export interface Morceau {
  texte: string;
  type: TypeMatiere;
  garde: boolean;
  /** E2E-1 n° 13 : noms, société et ville repérés, proposés au masquage (tous cochés d'avance). */
  noms: string[];
  masques: string[];
  /** Accord de la personne (cas client, parole de dirigeant). */
  accord: boolean;
}

/**
 * Un morceau de la dictée en vrac : son type (touché pour le changer), garder ou non, les noms à masquer et l'accord
 * quand le type l'exige. Le texte reste mot pour mot.
 */
export function LigneMorceau({ morceau: m, ouvert, onOuvrir, onChange }: { morceau: Morceau; ouvert: boolean; onOuvrir: () => void; onChange: (m: Morceau) => void }) {
  return (
    <li className={cn("rounded-2xl border border-trait bg-surface-1 p-3.5 transition-opacity", !m.garde && "opacity-45")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button type="button" onClick={onOuvrir} aria-expanded={ouvert} className="min-h-10">
          <PastilleType type={m.type} className="bg-orange-doux text-orange-vif" />
        </button>
        <button
          type="button"
          aria-pressed={!m.garde}
          aria-label={m.garde ? "Ne pas garder" : "Garder"}
          onClick={() => onChange({ ...m, garde: !m.garde })}
          className="grid size-10 place-items-center rounded-full text-texte-faible hover:bg-surface-2"
        >
          <Icone nom={m.garde ? "fermer" : "reessayer"} size={18} />
        </button>
      </div>
      <p className="text-[15px] leading-snug text-texte">{cite(m.texte)}</p>
      {ouvert && (
        <div className="mt-3">
          <ChoixType compact className="-mx-3.5 px-3.5" valeur={m.type} onChange={(type) => onChange({ ...m, type })} />
        </div>
      )}
      {m.garde && m.noms.length > 0 && (
        <div className="mt-3">
          <NomsAMasquer noms={m.noms} masques={m.masques} onChange={(masques) => onChange({ ...m, masques })} />
        </div>
      )}
      {m.garde && accordRequis(m.type) && (
        <div className="mt-3">
          <Interrupteur icone="bouclier" libelle="J'ai son accord" detail={m.accord ? undefined : "Sans accord, elle n'est pas citée"} coche={m.accord} onChange={(accord) => onChange({ ...m, accord })} />
        </div>
      )}
    </li>
  );
}

/**
 * Dictée EN VRAC (B.2.9) : plusieurs phrases d'un coup ; le code découpe et propose un type par morceau ; Will confirme
 * ou change d'un toucher. Le texte n'est jamais reformulé : chaque morceau est un passage exact de la dictée.
 * « Ranger pour moi » est facultatif et passe par le même contrôle. Aucun rôle Claude ne range encore : c'est un essai
 * (rien n'est payé), montré SEULEMENT quand Claude n'est pas relié, et marqué « Essai » (correcteur 3, B14).
 */
export function FeuilleEnVrac({ ouverte, onOuverteChange, rangementEssai = false }: { ouverte: boolean; onOuverteChange: (o: boolean) => void; rangementEssai?: boolean }) {
  const [dictee, setDictee] = useState("");
  const [morceaux, setMorceaux] = useState<Morceau[] | null>(null);
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [parMachine, setParMachine] = useState(false);
  const [envoi, setEnvoi] = useState<"" | "decoupe" | "machine" | "ranger">("");
  const champ = useRef<HTMLTextAreaElement>(null);
  const micro = useDictee((m) => setDictee((t) => ajouterDicte(t, m)), champ);
  useRetenirDepart(ouverte && (!!dictee.trim() || !!morceaux?.length));

  function fermer(o: boolean) {
    if (!o) {
      micro.arreter();
      setDictee("");
      setMorceaux(null);
      setOuvert(null);
      setParMachine(false);
    }
    onOuverteChange(o);
  }

  async function decouper(machine: boolean) {
    micro.arreter();
    setEnvoi(machine ? "machine" : "decoupe");
    const r = machine ? await rangerPourMoiAction(dictee) : await proposerDecoupeAction(dictee);
    setEnvoi("");
    if (!r.ok) return notifier.erreur(r.message);
    const liste = "morceaux" in r.donnees ? r.donnees.morceaux : r.donnees;
    if ("rejetes" in r.donnees && r.donnees.rejetes.length) notifier.info(`${r.donnees.rejetes.length} morceau(x) écarté(s) : pas mot pour mot`);
    if ("simule" in r.donnees) notifier.essai("rangement simulé, rien n'est payé");
    setParMachine(machine);
    setMorceaux(liste.map((m) => ({ texte: m.texte, type: m.type, garde: true, noms: m.nomsProposes ?? [], masques: m.nomsProposes ?? [], accord: false })));
  }

  async function ranger() {
    if (!morceaux) return;
    setEnvoi("ranger");
    const r = await enregistrerEnVracAction(dictee, morceaux.filter((m) => m.garde).map(({ texte, type, masques, accord }) => ({ texte, type, nomsSensibles: masques, accord: accordRequis(type) ? accord : undefined })), parMachine ? "machine" : "code");
    setEnvoi("");
    if (!r.ok) return notifier.erreur(r.message);
    notifier.succes(`${r.donnees} matière(s) rangée(s)`);
    fermer(false);
  }

  const gardes = morceaux?.filter((m) => m.garde).length ?? 0;

  return (
    <FeuilleBas
      ouverte={ouverte}
      onOuverteChange={fermer}
      pleinEcran
      titre={morceaux ? `${morceaux.length} matière${morceaux.length > 1 ? "s" : ""}` : "Plusieurs d'un coup"}
      description={morceaux ? "Mot pour mot. Touchez un type pour le changer." : undefined}
      pied={
        morceaux ? (
          <Bouton pleineLargeur taille="lg" icone="coche" chargement={envoi === "ranger"} disabled={!gardes} onClick={ranger}>
            Ranger les {gardes}
          </Bouton>
        ) : (
          <div className="space-y-2">
            <Bouton pleineLargeur taille="lg" icone="ciseaux" chargement={envoi === "decoupe"} disabled={!dictee.trim()} onClick={() => decouper(false)}>
              Découper
            </Bouton>
            {rangementEssai && (
              <Bouton pleineLargeur variante="fantome" icone="etincelles" chargement={envoi === "machine"} disabled={!dictee.trim()} onClick={() => decouper(true)}>
                Ranger pour moi · 0 €
                <PastilleEssai className="ml-1" />
              </Bouton>
            )}
          </div>
        )
      }
    >
      {!morceaux ? (
        <div className="space-y-5">
          <BoutonMicro ecoute={micro.ecoute} onClick={micro.basculer} libelle="Dictez tout, d'une traite" />
          <ZoneTexte ref={champ} libelle="Votre dictée" libelleMasque value={dictee} onChange={(e) => setDictee(e.target.value)} rows={6} placeholder="Une phrase par idée. Le studio coupe aux points et aux retours à la ligne." />
        </div>
      ) : (
        <ul className="space-y-3">
          {morceaux.map((m, i) => (
            <LigneMorceau
              key={`${i}-${m.texte}`}
              morceau={m}
              ouvert={ouvert === i}
              onOuvrir={() => setOuvert(ouvert === i ? null : i)}
              onChange={(x) => {
                setMorceaux(morceaux.map((y, j) => (j === i ? x : y)));
                if (x.type !== m.type) setOuvert(null);
              }}
            />
          ))}
        </ul>
      )}
    </FeuilleBas>
  );
}
