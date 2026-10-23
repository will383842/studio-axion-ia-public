"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ameliorerBlocAction, noterScriptAction } from "@/app/(studio)/nouvelle/[format]/actions";
import { basculerFavoriAction, basculerReferenceAction, enregistrerVersionAction, renommerScriptAction, validerScriptAction } from "@/app/(studio)/scripts/[id]/actions";
import { BarreActionCollee } from "@/components/ui/BarreActionCollee";
import { Bouton, BoutonIcone } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone } from "@/components/ui/Icone";
import { Menu } from "@/components/ui/Menu";
import { Pastille } from "@/components/ui/Pastille";
import { notifier } from "@/components/ui/Toast";
import { texteScript } from "@/domaine/derivations";
import type { BlocScript, NoteScript, Script } from "@/domaine/types";
import { dureeParDefaut, estimerDureeTexte, obtenirFormat } from "@/formats";
import { useSaisieGardee } from "@/hooks/useSaisieGardee";
import { cn } from "@/lib/cn";
import { dateCourte } from "@/lib/dates";
import { EditeurBlocs } from "./EditeurBlocs";
import { ResumeTexte } from "./ResumeTexte";

/**
 * FICHE SCRIPT (B.8 #12) : éditeur par blocs, durée estimée en direct, notes, versions comparées,
 * « Créer la vidéo » (assistant prérempli). Les retouches s'enregistrent en nouvelle version.
 * Correcteur 3 (B10) : la note et « Améliorer » de l'essai (simulés) ne s'affichent pas quand Claude est relié. Aucun
 * rôle réel ne note ni ne retouche un texte seul : un texte rattaché à un sujet renvoie à ses retouches réelles
 * (« Autre accroche », « Plus court », « Améliorer », prix affiché) ; sinon, la correction se fait à la main (0 €).
 */
export function FicheScript({ script, versions, ecritureReelle = false }: { script: Script; versions: Script[]; ecritureReelle?: boolean }) {
  const router = useRouter();
  const format = obtenirFormat(script.formatId);
  const [blocs, setBlocs] = useState<BlocScript[]>(script.blocs);
  const [notes, setNotes] = useState<NoteScript | undefined>(script.notes);
  const [comparerAvec, setComparerAvec] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<"enregistrer" | "video" | null>(null);
  const [renommer, setRenommer] = useState(false);
  const [nom, setNom] = useState(script.sujet);
  const [texteEnregistre, setTexteEnregistre] = useState(() => JSON.stringify(script.blocs));
  const dejaNote = useRef(JSON.stringify(script.blocs));
  const cle = JSON.stringify(blocs);
  const modifie = cle !== texteEnregistre;
  const rang = versions.findIndex((v) => v.id === script.id);
  const autre = versions.find((v) => v.id === comparerAvec);

  // Page ouverte avant une mise en ligne : le texte modifié (pas encore enregistré) est gardé au rechargement et remis.
  useSaisieGardee(
    `script:${script.id}`,
    () => (modifie ? cle : ""),
    (texte) => {
      try {
        const repris = JSON.parse(texte) as BlocScript[];
        if (Array.isArray(repris) && repris.length) setBlocs(repris);
      } catch {
        // texte illisible : on garde la version enregistrée
      }
    },
  );

  const dureeNotee = script.dureeCibleSec ?? dureeParDefaut(format);
  useEffect(() => {
    if (ecritureReelle || !blocs.length || cle === dejaNote.current) return;
    const t = setTimeout(async () => {
      const r = await noterScriptAction(script.formatId, blocs, dureeNotee);
      if (r.ok) {
        dejaNote.current = cle;
        setNotes(r.donnees);
      }
    }, 900);
    return () => clearTimeout(t);
  }, [cle, blocs, script.formatId, dureeNotee, ecritureReelle]);

  async function enregistrer(): Promise<string | null> {
    const r = await enregistrerVersionAction(script.id, blocs);
    if (!r.ok) {
      notifier.erreur(r.message);
      return null;
    }
    setTexteEnregistre(cle);
    return r.donnees;
  }

  async function action(type: "enregistrer" | "video") {
    setOccupe(type);
    let id: string | null = script.id;
    if (modifie) id = await enregistrer();
    if (!id) return setOccupe(null);
    if (type === "video") router.push(`/nouvelle/${format.id}?script=${id}`);
    else {
      notifier.succes(`Version ${versions.length + 1} enregistrée`);
      router.replace(`/scripts/${id}`);
      setOccupe(null);
    }
  }

  async function simple(f: (id: string) => Promise<{ ok: boolean; message?: string }>, succes: string) {
    const r = await f(script.id);
    if (r.ok) notifier.succes(succes);
    else notifier.erreur(r.message ?? "Un souci est survenu.");
  }

  return (
    <div className="mx-auto max-w-5xl">
      <EnTetePage
        retour={{ href: "/ecrire?onglet=scripts", libelle: "Écrire" }}
        surTitre={
          <span className="flex items-center gap-1.5">
            <Icone nom={format.icone} size={14} />
            {format.nom}
          </span>
        }
        titre={script.sujet}
        actions={
          <>
            <BoutonIcone
              icone="etoile"
              libelle={script.favori ? "Retirer des favoris" : "Ajouter aux favoris"}
              className={script.favori ? "text-orange-vif [&_svg]:fill-current" : undefined}
              onClick={() => void simple(basculerFavoriAction, script.favori ? "Retiré des favoris" : "Ajouté aux favoris")}
            />
            <Menu
              declencheur={<BoutonIcone icone="menu" libelle="Plus d'actions" />}
              elements={[
                { libelle: "Renommer", icone: "ecrire", onSelect: () => setRenommer(true) },
                // Générateur (G1b) : un texte rattaché à un sujet se valide version par version, depuis le sujet.
                ...(script.statutEditorial !== "valide" && !script.scriptMaitreId ? [{ libelle: "Valider ce texte", icone: "valide" as const, onSelect: () => void simple(validerScriptAction, "Texte validé") }] : []),
                {
                  libelle: script.reference ? "Retirer des références" : "Mettre en référence",
                  icone: "etoile",
                  onSelect: () => void simple(basculerReferenceAction, script.reference ? "Retiré des références" : "Ajouté aux références"),
                },
              ]}
            />
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        {script.statutEditorial === "valide" ? (
          <Pastille ton="sauge" icone="valide" taille="md">
            Validé
          </Pastille>
        ) : (
          <Pastille taille="md">Brouillon</Pastille>
        )}
        {script.reference && (
          <Pastille ton="orange" icone="etoile" taille="md">
            Référence
          </Pastille>
        )}
        {script.cible && <Pastille taille="md">{script.cible}</Pastille>}
        {script.ton && <Pastille taille="md">{script.ton}</Pastille>}
      </div>

      {versions.length > 1 && (
        <section className="mb-5">
          <div className="sans-barre -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1">
            {versions.map((v, i) => {
              const courante = v.id === script.id;
              const comparee = v.id === comparerAvec;
              return courante ? (
                <span key={v.id} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-orange px-4 text-sm font-semibold text-sur-orange">
                  v{i + 1}
                  <span className="text-xs">{dateCourte(v.creeLe)}</span>
                </span>
              ) : (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setComparerAvec(comparee ? null : v.id)}
                  aria-pressed={comparee}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors",
                    comparee ? "border-orange bg-orange-doux text-orange-vif" : "border-trait bg-surface-1 text-texte-doux hover:text-texte",
                  )}
                >
                  <Icone nom="calques" size={14} />v{i + 1}
                  {v.notes && <span className="text-xs tabular-nums opacity-80">{v.notes.globale}</span>}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-texte-faible">Touchez une version pour la comparer.</p>
        </section>
      )}

      <div className={cn("grid gap-5", autre && "lg:grid-cols-2")}>
        <div className="min-w-0 space-y-4">
          <ResumeTexte dureeSec={estimerDureeTexte(format, texteScript(blocs))} cibleSec={script.dureeCibleSec} notes={ecritureReelle ? undefined : notes} criteres={format.recetteScript.criteres} />
          {ecritureReelle &&
            (script.scriptMaitreId ? (
              <Bouton asChild variante="secondaire" icone="baguette" pleineLargeur>
                <Link href={`/ecrire/sujets/${script.scriptMaitreId}`}>Retoucher avec Claude, depuis le sujet</Link>
              </Bouton>
            ) : (
              <p className="text-sm text-texte-faible">Corrigez le texte à la main (0 €), ou écrivez un nouveau sujet dans « Écrire ».</p>
            ))}
          <EditeurBlocs
            formatId={script.formatId}
            blocs={blocs}
            notes={ecritureReelle ? undefined : notes}
            onChange={setBlocs}
            ameliorer={ecritureReelle ? undefined : async (bloc, consigne) => {
              const r = await ameliorerBlocAction(script.formatId, bloc, consigne);
              if (!r.ok) {
                notifier.erreur(r.message);
                return null;
              }
              return r.donnees;
            }}
          />
        </div>
        <AnimatePresence>
          {autre && (
            <motion.aside key={autre.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} className="min-w-0 space-y-4 rounded-[20px] border border-dashed border-trait-fort p-3 lg:sticky lg:top-6 lg:self-start">
              <div className="flex items-center gap-2 px-1">
                <Icone nom="calques" size={16} className="text-orange-vif" />
                <span className="text-sm font-semibold text-texte">Version {versions.findIndex((v) => v.id === autre.id) + 1}</span>
                {autre.notes && <span className="font-titre text-lg tabular-nums text-texte-doux">{autre.notes.globale}</span>}
                <Bouton asChild variante="fantome" className="ml-auto">
                  <Link href={`/scripts/${autre.id}`}>Ouvrir</Link>
                </Bouton>
              </div>
              <EditeurBlocs formatId={autre.formatId} blocs={autre.blocs} notes={autre.notes} lectureSeule className="opacity-90" />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      <BarreActionCollee
        secondaire={
          modifie && format.statut === "actif" ? (
            <Bouton variante="secondaire" taille="lg" icone="valide" aria-label="Enregistrer la version" chargement={occupe === "enregistrer"} onClick={() => void action("enregistrer")}>
              <span className="hidden sm:inline">Enregistrer</span>
            </Bouton>
          ) : undefined
        }
      >
        {format.statut === "actif" ? (
          <Bouton taille="lg" icone="clap" chargement={occupe === "video"} onClick={() => void action("video")}>
            Créer la vidéo
          </Bouton>
        ) : (
          <Bouton taille="lg" icone="valide" disabled={!modifie} chargement={occupe === "enregistrer"} onClick={() => void action("enregistrer")}>
            {modifie ? `Enregistrer la v${versions.length + 1}` : rang >= 0 ? `Version ${rang + 1}` : "Enregistré"}
          </Bouton>
        )}
      </BarreActionCollee>

      <FeuilleBas
        ouverte={renommer}
        onOuverteChange={setRenommer}
        titre="Renommer"
        pied={
          <Bouton
            taille="lg"
            pleineLargeur
            disabled={nom.trim().length < 3}
            onClick={async () => {
              const r = await renommerScriptAction(script.id, nom.trim());
              if (!r.ok) return notifier.erreur(r.message);
              setRenommer(false);
              notifier.succes("Renommé");
            }}
          >
            Enregistrer
          </Bouton>
        }
      >
        <Champ libelle="Sujet" libelleMasque grand value={nom} maxLength={160} onChange={(e) => setNom(e.target.value)} />
      </FeuilleBas>
    </div>
  );
}
