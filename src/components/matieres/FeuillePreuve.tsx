"use client";

import { useRef, useState } from "react";
import { accordPreuveAction, ajouterPreuveAction, aNePasDireAction, retirerPreuveAction } from "@/app/(studio)/ecrire/matieres/actions";
import type { Preuve } from "@/domaine/types";
import { proposerANePasDire, type PropositionANePasDire } from "@/domaine/preuves-saisie";
import type { ImpactRetrait } from "@/services/matieres";
import type { VuePreuve } from "@/services/preuves";
import { Bouton, FeuilleBas, Icone, Interrupteur, notifier, ZoneTexte } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ajouterDicte, BoutonMicro, useDictee } from "./Dictee";
import { ChoixMotif, VersionsTouchees } from "./Retrait";

/** « À ne pas dire » proposé : chaque pastille se valide d'un toucher. */
function ANePasDire({ preuve, propositions, onChange }: { preuve: Preuve; propositions: PropositionANePasDire[]; onChange: (p: Preuve) => void }) {
  if (!propositions.length && !preuve.formulationsInterdites.length) return null;
  const toutes = [...new Set([...preuve.formulationsInterdites, ...propositions.map((p) => p.texte)])];
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-texte-faible">
        <Icone nom="oeil-barre" size={13} />À ne pas dire ?
      </p>
      <div className="flex flex-wrap gap-2">
        {toutes.map((t) => {
          const validee = preuve.formulationsInterdites.includes(t);
          const raison = propositions.find((p) => p.texte === t)?.raison;
          return (
            <button
              key={t}
              type="button"
              disabled={validee}
              aria-pressed={validee}
              title={raison}
              onClick={async () => {
                const r = await aNePasDireAction(preuve.id, t);
                if (!r.ok) return notifier.erreur(r.message);
                onChange(r.donnees);
              }}
              className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-left text-sm font-semibold",
                validee ? "border-brique/40 bg-brique-doux text-brique" : "border-trait bg-surface-1 text-texte hover:bg-surface-2",
              )}
            >
              <Icone nom={validee ? "coche" : "plus"} size={14} />« {t} »
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Accords({ preuve, onChange }: { preuve: Preuve; onChange: (p: Preuve) => void }) {
  if (preuve.type !== "cas-client") return null;
  const c = preuve.client ?? { anonymise: true, accordEcrit: false };
  const basculer = async (accord: "accordEcrit" | "accordCapture" | "accordAvantApres", v: boolean) => {
    const r = await accordPreuveAction(preuve.id, accord, v);
    if (!r.ok) return notifier.erreur(r.message);
    onChange(r.donnees);
  };
  return (
    <div className="divide-y divide-trait rounded-2xl border border-trait bg-surface-1 px-3">
      <Interrupteur icone="bouclier" libelle="Accord écrit du client" coche={!!c.accordEcrit} onChange={(v) => basculer("accordEcrit", v)} />
      <Interrupteur icone="camera" libelle="Capture d'écran permise" coche={!!c.accordCapture} onChange={(v) => basculer("accordCapture", v)} />
      <Interrupteur icone="contraste" libelle="Avant / après permis" coche={!!c.accordAvantApres} onChange={(v) => basculer("accordAvantApres", v)} />
    </div>
  );
}

/**
 * Preuve en < 20 s : l'énoncé dicté (« ce qu'on peut dire ») ; le reste prend ses valeurs par défaut. Ensuite, d'un
 * toucher : « à ne pas dire » proposé (sans fait ajouté) et accords du client.
 */
export function FeuilleNouvellePreuve({ ouverte, onOuverteChange }: { ouverte: boolean; onOuverteChange: (o: boolean) => void }) {
  const [enonce, setEnonce] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [apres, setApres] = useState<{ preuve: Preuve; propositions: PropositionANePasDire[] } | null>(null);
  const champ = useRef<HTMLTextAreaElement>(null);
  const micro = useDictee((m) => setEnonce((t) => ajouterDicte(t, m)), champ);

  function fermer(o: boolean) {
    if (!o) {
      micro.arreter();
      setEnonce("");
      setApres(null);
    }
    onOuverteChange(o);
  }

  async function garder() {
    micro.arreter();
    setEnvoi(true);
    const r = await ajouterPreuveAction(enonce, []);
    setEnvoi(false);
    if (!r.ok) return notifier.erreur(r.message);
    setApres(r.donnees);
  }

  return (
    <FeuilleBas
      ouverte={ouverte}
      onOuverteChange={fermer}
      titre={apres ? "Preuve gardée" : "Nouvelle preuve"}
      pied={
        apres ? (
          <Bouton pleineLargeur taille="lg" icone="coche" onClick={() => fermer(false)}>
            Terminer
          </Bouton>
        ) : (
          <Bouton pleineLargeur taille="lg" icone="coche" chargement={envoi} disabled={!enonce.trim()} onClick={garder}>
            Garder
          </Bouton>
        )
      }
    >
      {apres ? (
        <div className="space-y-5">
          <p className="rounded-2xl bg-surface-2 p-4 text-[15px] font-semibold leading-snug text-texte">« {apres.preuve.enonce} »</p>
          <ANePasDire preuve={apres.preuve} propositions={apres.propositions} onChange={(p) => setApres({ ...apres, preuve: p })} />
          <Accords preuve={apres.preuve} onChange={(p) => setApres({ ...apres, preuve: p })} />
        </div>
      ) : (
        <div className="space-y-5">
          <BoutonMicro ecoute={micro.ecoute} onClick={micro.basculer} libelle="Ce qu'on peut dire" />
          <ZoneTexte ref={champ} libelle="Ce qu'on peut dire" libelleMasque value={enonce} onChange={(e) => setEnonce(e.target.value)} rows={3} placeholder="La phrase exacte, avec le chiffre." />
        </div>
      )}
    </FeuilleBas>
  );
}

/** Fiche d'une preuve : « à ne pas dire », accords, retrait (avec les versions touchées). */
export function FeuillePreuve({ vue, onFermer }: { vue: VuePreuve | null; onFermer: () => void }) {
  const [preuve, setPreuve] = useState<Preuve | null>(null);
  const [etape, setEtape] = useState<"fiche" | "retrait" | "impact">("fiche");
  const [impact, setImpact] = useState<ImpactRetrait | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const p = preuve && preuve.id === vue?.preuve.id ? preuve : (vue?.preuve ?? null);

  function fermer() {
    setEtape("fiche");
    setImpact(null);
    setPreuve(null);
    onFermer();
  }

  return (
    <FeuilleBas ouverte={!!vue} onOuverteChange={(o) => !o && fermer()} titre={etape === "retrait" ? "Retirer ?" : etape === "impact" ? "Versions concernées" : "Preuve"}>
      {p && etape === "fiche" && (
        <div className="space-y-5">
          <p className="rounded-2xl bg-surface-2 p-4 text-[17px] font-semibold leading-snug text-texte">« {p.enonce} »</p>
          {!p.retrait && (
            <>
              <ANePasDire preuve={p} propositions={proposerANePasDire(p)} onChange={setPreuve} />
              <Accords preuve={p} onChange={setPreuve} />
              <Bouton variante="fantome" pleineLargeur icone="archive" className="text-brique" onClick={() => setEtape("retrait")}>
                Retirer
              </Bouton>
            </>
          )}
        </div>
      )}
      {p && etape === "retrait" && (
        <div className="space-y-4">
          <p className="flex items-start gap-2 text-sm text-texte-doux">
            <Icone nom="info" size={16} className="mt-0.5 shrink-0" />
            Les matières qui la citent tombent avec elle. Rien n&apos;est effacé.
          </p>
          <ChoixMotif
            envoi={envoi}
            onRetirer={async (motif) => {
              setEnvoi(true);
              const r = await retirerPreuveAction(p.id, motif);
              setEnvoi(false);
              if (!r.ok) return notifier.erreur(r.message);
              notifier.succes("Preuve retirée");
              setImpact(r.donnees);
              setEtape("impact");
            }}
          />
        </div>
      )}
      {etape === "impact" && impact && <VersionsTouchees impact={impact} />}
    </FeuilleBas>
  );
}
