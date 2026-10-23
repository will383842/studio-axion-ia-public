"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { creerModeleAction, renommerModeleAction, archiverModeleAction, restaurerModeleAction } from "@/app/(studio)/modeles/actions";
import { ElementsRanges } from "@/components/bibliotheque/ElementsRanges";
import { BarreActionCollee } from "@/components/ui/BarreActionCollee";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { Bouton, BoutonIcone } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { EtatVide } from "@/components/ui/EtatVide";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone } from "@/components/ui/Icone";
import { Menu } from "@/components/ui/Menu";
import { Pastille } from "@/components/ui/Pastille";
import { Portrait } from "@/components/ui/Portrait";
import { notifier } from "@/components/ui/Toast";
import { libelleDuree, nomCourtFormat } from "@/formats";
import { cn } from "@/lib/cn";
import type { VueModele, VueVideoCarte } from "@/services/vues";

export interface ReperesModeles {
  personnages: Record<string, { nom: string; photo: string | null }>;
  elements: Record<string, string>;
}

/**
 * MES MODÈLES (B.8 #12b) : cartes (format, durée, ratios, personnage, LUT, musique), « Utiliser » ouvre
 * l'assistant prérempli ; créer un modèle depuis une vidéo réussie ; renommer, archiver puis restaurer (jamais effacé).
 */
export function ListeModeles({
  modeles,
  archives = [],
  reperes,
  videos,
}: {
  modeles: VueModele[];
  archives?: VueModele[];
  reperes: ReperesModeles;
  videos: VueVideoCarte[];
}) {
  const [creation, setCreation] = useState(false);
  const [videoChoisie, setVideoChoisie] = useState<VueVideoCarte | null>(null);
  const [nom, setNom] = useState("");
  const [aRenommer, setARenommer] = useState<VueModele | null>(null);
  const [aSupprimer, setASupprimer] = useState<VueModele | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function creer() {
    if (!videoChoisie) return;
    setOccupe(true);
    const r = await creerModeleAction(videoChoisie.id, nom || videoChoisie.titre);
    setOccupe(false);
    if (!r.ok) return notifier.erreur(r.message);
    notifier.succes("Modèle enregistré");
    setCreation(false);
    setVideoChoisie(null);
    setNom("");
  }

  const action = (taille: "md" | "lg") => (
    <Bouton taille={taille} icone="plus" disabled={!videos.length} onClick={() => setCreation(true)}>
      Depuis une vidéo réussie
    </Bouton>
  );

  return (
    <>
      {/* Ordinateur : l'action est dans l'en-tête, à droite du titre. Mobile : collée en bas. */}
      <EnTetePage titre="Mes modèles" sousTitre="Un réglage qui vous plaît, réutilisé en un geste." actions={<div className="hidden lg:block">{action("md")}</div>} />
      {modeles.length ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {modeles.map((m, i) => {
              const d = m.distribution[0];
              const p = d?.personnageId ? reperes.personnages[d.personnageId] : undefined;
              const lut = m.stylesChoisis.lutId ? reperes.elements[m.stylesChoisis.lutId] : undefined;
              const musique = m.stylesChoisis.musiqueId ? reperes.elements[m.stylesChoisis.musiqueId] : undefined;
              return (
                <motion.li
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ delay: Math.min(i, 6) * 0.04 }}
                  className="group relative isolate flex gap-4 overflow-hidden rounded-carte border border-trait bg-surface-1 p-3 transition-colors hover:border-trait-fort"
                >
                  <span aria-hidden className="absolute -left-10 -top-10 -z-10 size-32 rounded-full bg-orange/10 blur-2xl" />
                  <span className="relative aspect-[9/16] w-24 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                    {m.vignette ? <Image src={m.vignette} alt="" fill sizes="96px" className="object-cover" /> : <Icone nom="modele" size={22} className="absolute inset-0 m-auto text-texte-faible" />}
                    <span className="absolute bottom-1.5 left-1.5 rounded-md bg-fond/80 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-texte">{libelleDuree(m.dureeSec)}</span>
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start gap-1">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-vif">
                          <Icone nom={m.format.icone} size={12} />
                          <span className="truncate">{nomCourtFormat(m.format)}</span>
                        </p>
                        <p className="mt-0.5 line-clamp-2 font-semibold leading-snug text-texte">{m.nom}</p>
                      </div>
                      <Menu
                        declencheur={<BoutonIcone icone="menu" libelle={`Plus d'actions : ${m.nom}`} className="-mr-1.5 -mt-1.5" />}
                        elements={[
                          {
                            libelle: "Renommer",
                            icone: "ecrire",
                            onSelect: () => {
                              setNom(m.nom);
                              setARenommer(m);
                            },
                          },
                          { libelle: "Archiver", icone: "archive", onSelect: () => setASupprimer(m) },
                        ]}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.ratios.map((r) => (
                        <Pastille key={r}>{r}</Pastille>
                      ))}
                      {lut && <Pastille icone="contraste">{lut}</Pastille>}
                      {musique && <Pastille icone="musique">{musique}</Pastille>}
                    </div>
                    <div className="mt-auto flex items-center gap-2 pt-3">
                      {p && <Portrait nom={p.nom} photo={p.photo} taille="sm" />}
                      <span className="min-w-0 flex-1 truncate text-xs text-texte-faible">{m.utilisations ? `${m.utilisations} vidéo${m.utilisations > 1 ? "s" : ""}` : "Jamais utilisé"}</span>
                      <Bouton asChild variante="secondaire" iconeDroite="fleche-droite" className="group-hover:border-orange/50">
                        <Link href={`/nouvelle/${m.formatId}?modele=${m.id}`}>Utiliser</Link>
                      </Bouton>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      ) : (
        <EtatVide icone="modele" titre="Aucun modèle" phrase="Gardez les réglages d'une vidéo réussie pour les réutiliser en un geste." />
      )}

      {/* Modèles archivés : jamais effacés, restaurés en un geste. */}
      <ElementsRanges
        elements={archives.map((m) => ({ id: m.id, type: "modele", nom: m.nom, vignette: m.vignette }))}
        restaurer={(e) => restaurerModeleAction(e.id)}
      />

      <BarreActionCollee className="lg:hidden">{action("lg")}</BarreActionCollee>

      <FeuilleBas
        ouverte={creation}
        onOuverteChange={(o) => {
          setCreation(o);
          if (!o) setVideoChoisie(null);
        }}
        titre={videoChoisie ? "Nom du modèle" : "Quelle vidéo ?"}
        pied={
          videoChoisie ? (
            <Bouton taille="lg" pleineLargeur icone="modele" chargement={occupe} onClick={() => void creer()}>
              Enregistrer le modèle
            </Bouton>
          ) : undefined
        }
      >
        {videoChoisie ? (
          <div className="space-y-4">
            <button type="button" onClick={() => setVideoChoisie(null)} className="flex min-h-11 items-center gap-3 text-left">
              <span className="relative aspect-[9/16] w-12 shrink-0 overflow-hidden rounded-lg bg-surface-2">{videoChoisie.vignette && <Image src={videoChoisie.vignette} alt="" fill sizes="48px" className="object-cover" />}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-texte">{videoChoisie.titre}</span>
              <Icone nom="ecrire" size={15} className="text-texte-faible" />
            </button>
            <Champ libelle="Nom" grand autoFocus placeholder="Avocat 45 s vertical" value={nom} maxLength={80} onChange={(e) => setNom(e.target.value)} />
          </div>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {videos.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => {
                    setVideoChoisie(v);
                    setNom(`${nomCourtFormat(v.format)} ${libelleDuree(v.dureeCibleSec)} ${v.ratioPrincipal}`);
                  }}
                  className="group block w-full text-left"
                >
                  <span className="relative block aspect-[9/16] overflow-hidden rounded-xl border border-trait bg-surface-2 transition-colors group-hover:border-orange">
                    {v.vignette && <Image src={v.vignette} alt="" fill sizes="120px" className="object-cover" />}
                    {v.noteQualite !== undefined && (
                      <span className={cn("absolute right-1 top-1 rounded-md bg-fond/80 px-1.5 text-[10px] font-bold tabular-nums", v.noteQualite >= 80 ? "text-sauge" : "text-ambre")}>{v.noteQualite}</span>
                    )}
                  </span>
                  <span className="mt-1 line-clamp-2 text-xs font-semibold text-texte-doux group-hover:text-texte">{v.titre}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </FeuilleBas>

      <FeuilleBas
        ouverte={!!aRenommer}
        onOuverteChange={(o) => !o && setARenommer(null)}
        titre="Renommer"
        pied={
          <Bouton
            taille="lg"
            pleineLargeur
            disabled={nom.trim().length < 2}
            onClick={async () => {
              if (!aRenommer) return;
              const r = await renommerModeleAction(aRenommer.id, nom);
              if (!r.ok) return notifier.erreur(r.message);
              setARenommer(null);
              notifier.succes("Renommé");
            }}
          >
            Enregistrer
          </Bouton>
        }
      >
        <Champ libelle="Nom" libelleMasque grand value={nom} maxLength={80} onChange={(e) => setNom(e.target.value)} />
      </FeuilleBas>

      <FeuilleBas
        ouverte={!!aSupprimer}
        onOuverteChange={(o) => !o && setASupprimer(null)}
        titre="Archiver ce modèle ?"
        description={aSupprimer ? `« ${aSupprimer.nom} ». Il quitte la liste, rien n'est effacé. Les vidéos déjà faites ne changent pas.` : undefined}
        pied={
          <Bouton
            taille="lg"
            variante="secondaire"
            pleineLargeur
            icone="archive"
            onClick={async () => {
              if (!aSupprimer) return;
              const r = await archiverModeleAction(aSupprimer.id);
              if (!r.ok) return notifier.erreur(r.message);
              setASupprimer(null);
              notifier.info("Modèle archivé");
            }}
          >
            Archiver
          </Bouton>
        }
      >
        <span />
      </FeuilleBas>
    </>
  );
}
