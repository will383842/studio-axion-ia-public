"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { ajouterIdeeEcrireAction, archiverIdeeAction, restaurerIdeeAction } from "@/app/(studio)/ecrire/actions";
import { BoutonIcone } from "@/components/ui/Bouton";
import { EtatVide } from "@/components/ui/EtatVide";
import { Icone } from "@/components/ui/Icone";
import { Menu } from "@/components/ui/Menu";
import { Pastille } from "@/components/ui/Pastille";
import { notifier } from "@/components/ui/Toast";
import { lienEcrireTexte, retourAssistant } from "@/domaine/retour-video";
import type { Idee } from "@/domaine/types";
import { listerFormatsActifs, nomCourtFormat, trouverFormat } from "@/formats";
import { IlYA } from "@/components/ui/IlYA";
import type { FormatEcrivable } from "@/components/generateur/ReglagesSujet";
import { SuiviSerie } from "@/components/generateur/SuiviSerie";
import type { SuiviSerie as Suivi } from "@/services/serie-ecriture";
import { BlocIdeesUsine } from "./BlocIdeesUsine";
import { BarreSerieIdees, CaseIdee, ideeEcrivable } from "./SerieIdees";

/** Format où ouvrir l'assistant : le format suggéré s'il est actif, sinon le premier actif. */
function formatPourVideo(i: Idee): string | null {
  const f = trouverFormat(i.formatSuggere ?? "");
  if (f?.statut === "actif") return f.id;
  return listerFormatsActifs()[0]?.id ?? null;
}

/** Onglet « Idées » : ajout en une ligne, format suggéré, « En vidéo » / « En script » en un geste. */
export function OngletIdees({ idees, formats = [], suivi = null, usine = false }: { idees: Idee[]; formats?: FormatEcrivable[]; suivi?: Suivi | null; usine?: boolean }) {
  const id = useId();
  const router = useRouter();
  const [texte, setTexte] = useState("");
  /** Écriture en série (B7) : idées cochées. */
  const [choisies, setChoisies] = useState<string[]>([]);
  const basculer = (x: string) => setChoisies((c) => (c.includes(x) ? c.filter((y) => y !== x) : [...c, x]));
  const [enCours, demarrer] = useTransition();

  function ajouter() {
    if (!texte.trim()) return;
    demarrer(async () => {
      const r = await ajouterIdeeEcrireAction(texte);
      if (r.ok) {
        setTexte("");
        notifier.succes("Idée notée");
      } else notifier.erreur(r.message);
    });
  }

  async function archiver(i: Idee) {
    const r = await archiverIdeeAction(i.id);
    if (!r.ok) return notifier.erreur(r.message);
    notifier.info("Idée archivée");
  }

  return (
    <div className="space-y-4">
      {usine && <BlocIdeesUsine />}
      <SuiviSerie key={suivi?.id ?? "aucune"} initial={suivi} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ajouter();
        }}
        className="flex min-h-14 items-center gap-2 rounded-full border border-trait bg-surface-1 pl-5 pr-1.5 transition-colors focus-within:border-orange"
      >
        <Icone nom="plus" size={18} className="shrink-0 text-ambre" />
        <label htmlFor={id} className="sr-only">
          Nouvelle idée
        </label>
        <input
          id={id}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="Une idée en une ligne"
          maxLength={200}
          enterKeyHint="send"
          className="min-w-0 flex-1 bg-transparent text-[16px] text-texte outline-none placeholder:text-texte-faible"
        />
        <button type="submit" disabled={!texte.trim() || enCours} aria-label="Noter l'idée" className="grid size-11 shrink-0 place-items-center rounded-full bg-orange text-sur-orange transition-opacity disabled:opacity-40">
          <Icone nom={enCours ? "chargement" : "fleche-droite"} size={18} className={enCours ? "animate-spin" : ""} />
        </button>
      </form>

      {idees.length === 0 ? (
        <EtatVide compact icone="idee" titre="Aucune idée" phrase="Notez-la en une ligne, ici ou depuis l'accueil." />
      ) : (
        <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          <AnimatePresence initial={false}>
            {idees.map((i, n) => {
              const f = trouverFormat(i.formatSuggere ?? "");
              const formatVideo = formatPourVideo(i);
              return (
                <motion.li
                  key={i.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2, delay: Math.min(n, 8) * 0.025 }}
                  className={`flex items-center gap-2 rounded-carte border bg-surface-1 py-2 pr-1.5 ${choisies.includes(i.id) ? "border-orange" : "border-trait"} ${formats.length && ideeEcrivable(i) ? "pl-1" : "pl-4"}`}
                >
                  {formats.length > 0 && ideeEcrivable(i) && <CaseIdee cochee={choisies.includes(i.id)} onChange={() => basculer(i.id)} texte={i.texte} />}
                  <div className="min-w-0 flex-1 py-1">
                    <p className="text-[15px] font-semibold leading-snug text-texte">{i.texte}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-texte-faible">
                      {f && (
                        <Pastille icone={f.icone} ton={f.statut === "actif" ? "orange" : "neutre"}>
                          {nomCourtFormat(f)}
                        </Pastille>
                      )}
                      {i.etat === "en-video" && (
                        <Pastille ton="sauge" icone="clap">
                          En vidéo
                        </Pastille>
                      )}
                      {i.etat === "en-script" && (
                        <Pastille ton="sauge" icone="document">
                          En script
                        </Pastille>
                      )}
                      {i.scriptMaitreId && (
                        <Link href={`/ecrire/sujets/${i.scriptMaitreId}`} className="rounded-full hover:opacity-80">
                          <Pastille ton="sauge" icone="ecrire">
                            Sujet
                          </Pastille>
                        </Link>
                      )}
                      <span><IlYA iso={i.creeLe} /></span>
                    </p>
                  </div>
                  {formatVideo && i.etat !== "en-video" && (
                    <Link
                      // Correcteur 3, B2 : le VRAI générateur écrit le texte (idée remplie), puis retour à la vidéo.
                      href={lienEcrireTexte({ ideeId: i.id, retour: retourAssistant(formatVideo) })}
                      aria-label={f && f.statut !== "actif" ? `En faire une vidéo (${nomCourtFormat({ id: formatVideo }).toLowerCase()})` : "En faire une vidéo"}
                      title={f && f.statut !== "actif" ? `${f.nom} arrive bientôt : la vidéo s'ouvre en ${nomCourtFormat({ id: formatVideo }).toLowerCase()}` : "En faire une vidéo"}
                      onClick={() => {
                        // Format suggéré pas encore disponible : on le dit, au lieu de l'ignorer en silence.
                        if (f && f.statut !== "actif") notifier.info(`${f.nom} arrive bientôt`, `Je l'ouvre en ${nomCourtFormat({ id: formatVideo }).toLowerCase()}.`);
                      }}
                      className="grid size-11 shrink-0 place-items-center rounded-full bg-orange-doux text-orange-vif transition-colors hover:bg-orange hover:text-sur-orange"
                    >
                      <Icone nom="clap" size={18} />
                    </Link>
                  )}
                  <Menu
                    declencheur={<BoutonIcone icone="menu" libelle={`Plus d'actions : ${i.texte.length > 60 ? `${i.texte.slice(0, 60)}…` : i.texte}`} />}
                    elements={[
                      ...(i.etat === "en-video" && i.videoId ? [{ libelle: "Voir la vidéo", icone: "film" as const, onSelect: () => router.push(`/nouvelle/${formatVideo}?brouillon=${i.videoId}`) }] : []),
                      i.etat === "en-script" && i.scriptId
                        ? { libelle: "Ouvrir le script", icone: "document" as const, onSelect: () => router.push(`/scripts/${i.scriptId}`) }
                        : { libelle: "En faire un script", icone: "ecrire" as const, onSelect: () => router.push(`/ecrire/atelier?idee=${i.id}`) },
                      "separateur",
                      i.etat === "archivee"
                        ? { libelle: "Restaurer", icone: "actualiser" as const, onSelect: () => void restaurerIdeeAction(i.id) }
                        : { libelle: "Archiver", icone: "archive" as const, onSelect: () => void archiver(i) },
                    ]}
                  />
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
      <BarreSerieIdees idees={idees.filter((i) => choisies.includes(i.id) && ideeEcrivable(i))} formats={formats} onFini={() => setChoisies([])} />
    </div>
  );
}
