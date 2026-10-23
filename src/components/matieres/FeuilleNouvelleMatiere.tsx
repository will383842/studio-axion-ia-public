"use client";

import { useRef, useState } from "react";
import { ajouterMatiereAction, nomsSensiblesAction } from "@/app/(studio)/ecrire/matieres/actions";
import type { Matiere, TypeMatiere } from "@/domaine/types";
import { accordRequis, proposerTypeMatiere } from "@/domaine/matieres";
import { Bouton, FeuilleBas, Icone, Interrupteur, notifier, ZoneTexte } from "@/components/ui";
import { ajouterDicte, BoutonMicro, useDictee } from "./Dictee";
import { ChoixType, cite, NomsAMasquer } from "./visuels";

/**
 * « + Matière » (B.2.9) : le micro d'abord ; le type est proposé par le code au fil de la dictée et se change d'un
 * toucher ; source « dictée » et date du jour par défaut. Un seul champ : moins de 15 s.
 * Après l'enregistrement : les noms repérés se masquent d'un toucher.
 */
export function FeuilleNouvelleMatiere({ ouverte, onOuverteChange, typeInitial }: { ouverte: boolean; onOuverteChange: (o: boolean) => void; typeInitial?: TypeMatiere }) {
  const [texte, setTexte] = useState("");
  const [typeTouche, setTypeTouche] = useState<TypeMatiere | undefined>(typeInitial);
  const [accord, setAccord] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [apres, setApres] = useState<{ matiere: Matiere; noms: string[]; masques: string[] } | null>(null);
  const champ = useRef<HTMLTextAreaElement>(null);
  const dictee = useDictee((m) => setTexte((t) => ajouterDicte(t, m)), champ);
  const type = typeTouche ?? (texte.trim() ? proposerTypeMatiere(texte) : "question-recue");

  function fermer(o: boolean) {
    if (!o) {
      dictee.arreter();
      setTexte("");
      setTypeTouche(typeInitial);
      setAccord(false);
      setApres(null);
    }
    onOuverteChange(o);
  }

  async function enregistrer() {
    dictee.arreter();
    setEnvoi(true);
    const r = await ajouterMatiereAction({ texte, type, accord: accordRequis(type) ? accord : undefined });
    setEnvoi(false);
    if (!r.ok) return notifier.erreur(r.message);
    if (r.donnees.aConfirmer) notifier.info("Gardée à confirmer", r.donnees.aConfirmer);
    if (r.donnees.nomsProposes.length) setApres({ matiere: r.donnees.matiere, noms: r.donnees.nomsProposes, masques: r.donnees.nomsProposes });
    else {
      notifier.succes("Matière ajoutée");
      fermer(false);
    }
  }

  async function masquer() {
    if (!apres) return;
    setEnvoi(true);
    const r = await nomsSensiblesAction(apres.matiere.id, apres.masques);
    setEnvoi(false);
    if (!r.ok) return notifier.erreur(r.message);
    notifier.succes("Matière ajoutée");
    fermer(false);
  }

  return (
    <FeuilleBas
      ouverte={ouverte}
      onOuverteChange={fermer}
      titre={apres ? "Des noms à masquer ?" : "Nouvelle matière"}
      pied={
        apres ? (
          <Bouton pleineLargeur taille="lg" icone="coche" chargement={envoi} onClick={masquer}>
            Terminer
          </Bouton>
        ) : (
          <Bouton pleineLargeur taille="lg" icone="coche" chargement={envoi} disabled={!texte.trim()} onClick={enregistrer}>
            Garder
          </Bouton>
        )
      }
    >
      {apres ? (
        <div className="space-y-4">
          <p className="rounded-2xl bg-surface-2 p-4 text-[15px] leading-snug text-texte">{cite(apres.matiere.texte)}</p>
          <NomsAMasquer noms={apres.noms} masques={apres.masques} onChange={(m) => setApres({ ...apres, masques: m })} />
        </div>
      ) : (
        <div className="space-y-5">
          <BoutonMicro ecoute={dictee.ecoute} onClick={dictee.basculer} />
          <ZoneTexte ref={champ} libelle="Votre matière" libelleMasque value={texte} onChange={(e) => setTexte(e.target.value)} rows={3} placeholder="Une question reçue, un avis, ce que vous voyez souvent…" />
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-texte-faible">
              <Icone nom="etincelles" size={13} />
              C&apos;est
            </p>
            <ChoixType valeur={type} onChange={setTypeTouche} compact />
          </div>
          {accordRequis(type) && <Interrupteur icone="bouclier" libelle="J'ai son accord" detail={accord ? undefined : "Sans accord, elle n'est pas citée"} coche={accord} onChange={setAccord} />}
        </div>
      )}
    </FeuilleBas>
  );
}
