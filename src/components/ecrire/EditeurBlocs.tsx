"use client";

import { AnimatePresence, motion } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { PastilleEssai } from "@/components/ui/PastilleEssai";
import { idBlocAjoute } from "@/domaine/relecture-script";
import { compterMots } from "@/domaine/derivations";
import { phrasesTropDenses } from "@/domaine/lecture";
import type { AnnotationSegment, BlocScript, NoteScript, SegmentScript } from "@/domaine/types";
import { obtenirFormat } from "@/formats";
import { BORDURES_BLOC, FONDS_BLOC, TEXTES_BLOC } from "@/formats/presentation";
import type { BlocRecette } from "@/formats/types";
import type { ConsigneAmelioration } from "@/fournisseurs";
import { cn } from "@/lib/cn";

/** Identifiant court côté client (nouveaux blocs et phrases). */
export function idClient(prefixe: string): string {
  return `${prefixe}-${Math.random().toString(36).slice(2, 10)}`;
}

const CONSIGNES: { cle: ConsigneAmelioration; libelle: string; icone: NomIcone }[] = [
  { cle: "ameliorer", libelle: "Améliorer", icone: "baguette" },
  { cle: "plus-percutant", libelle: "Plus percutant", icone: "eclair" },
  { cle: "plus-court", libelle: "Plus court", icone: "ciseaux" },
];

const ANGLES: Record<string, string> = { face: "Face", "trois-quarts": "Trois quarts", profil: "Profil" };

/** Pastilles discrètes d'annotation de montage sous une phrase (AV2.3-7). */
function annotations(seg: SegmentScript, actives: AnnotationSegment[]): { icone: NomIcone; texte: string; accent?: boolean }[] {
  const a = new Set(actives);
  const r: { icone: NomIcone; texte: string; accent?: boolean }[] = [];
  if (a.has("titreEcran") && seg.titreEcran) r.push({ icone: "texte", texte: seg.titreEcran, accent: true });
  if (a.has("angle") && seg.angle) r.push({ icone: "camera", texte: ANGLES[seg.angle] ?? seg.angle });
  if (a.has("emphase") && seg.emphase?.length) r.push({ icone: "etincelles", texte: seg.emphase.join(", ") });
  if (a.has("illustration") && seg.intentionIllustration) r.push({ icone: "image", texte: seg.intentionIllustration });
  if (a.has("zoom") && seg.zoom && seg.zoom !== "aucun") r.push({ icone: "loupe", texte: seg.zoom === "fort" ? "Zoom fort" : "Zoom léger" });
  if (a.has("pause") && seg.pauseApresSec) r.push({ icone: "horloge", texte: `Pause ${String(seg.pauseApresSec).replace(".", ",")} s` });
  if (a.has("role") && seg.role) r.push({ icone: "personne", texte: seg.role });
  if (a.has("incrustation") && seg.incrustation) r.push({ icone: seg.incrustation.type === "montant" ? "euro" : "image", texte: seg.incrustation.texte ?? "Incrustation", accent: seg.incrustation.sens === "gain" });
  return r;
}

/** Texte avec les mots mis en valeur en orange. */
export function TexteEnValeur({ texte, mots }: { texte: string; mots?: string[] }) {
  const liste = (mots ?? []).filter(Boolean);
  if (!liste.length) return <>{texte}</>;
  const echappe = liste.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // Mots ENTIERS seulement (« écrit » ne s'allume pas dans « écrite »).
  const morceaux = texte.split(new RegExp(`(?<![\\p{L}\\p{N}])(${echappe.join("|")})(?![\\p{L}\\p{N}])`, "giu"));
  return (
    <>
      {morceaux.map((m, i) =>
        liste.some((x) => x.toLowerCase() === m.toLowerCase()) ? (
          <mark key={i} className="rounded bg-transparent font-bold text-orange-vif">
            {m}
          </mark>
        ) : (
          <span key={i}>{m}</span>
        ),
      )}
    </>
  );
}

function ordonner(blocs: BlocScript[], recette: BlocRecette[]): BlocScript[] {
  const rang = (id: string) => {
    const i = recette.findIndex((r) => r.id === id);
    return i < 0 ? recette.length : i;
  };
  return blocs.map((b, i) => ({ b, i })).sort((x, y) => rang(x.b.blocRecette) - rang(y.b.blocRecette) || x.i - y.i).map((x) => x.b);
}

/**
 * ÉDITEUR PAR BLOCS (assistant, fiche script, atelier) : blocs colorés selon la recette du format,
 * phrases modifiables d'un toucher, mots en valeur, annotations en pastilles discrètes,
 * « Améliorer · Plus percutant · Plus court » par bloc (générateur simulé → pastille Essai).
 */
export function EditeurBlocs({
  formatId,
  blocs,
  onChange,
  notes,
  ameliorer,
  lectureSeule,
  className,
}: {
  formatId: string;
  blocs: BlocScript[];
  onChange?: (blocs: BlocScript[]) => void;
  notes?: NoteScript;
  ameliorer?: (bloc: BlocScript, consigne: ConsigneAmelioration) => Promise<BlocScript | null>;
  lectureSeule?: boolean;
  className?: string;
}) {
  const format = obtenirFormat(formatId);
  const recette = format.recetteScript;
  const [enCours, setEnCours] = useState<string | null>(null);
  const [eclat, setEclat] = useState<string | null>(null);
  const tries = ordonner(blocs, recette.blocs);
  const manquants = recette.blocs.filter((r) => !blocs.some((b) => b.blocRecette === r.id));

  const remplacer = (id: string, bloc: BlocScript) => onChange?.(blocs.map((b) => (b.id === id ? bloc : b)));
  const modifierSegment = (bloc: BlocScript, segId: string, texte: string) => remplacer(bloc.id, { ...bloc, segments: bloc.segments.map((s) => (s.id === segId ? { ...s, texte } : s)) });
  const ajouterBloc = (r: BlocRecette) => onChange?.(ordonner([...blocs, { id: idBlocAjoute(blocs, idClient("bloc")), blocRecette: r.id, segments: [{ id: idClient("seg"), texte: "", role: r.role }] }], recette.blocs));

  async function lancer(bloc: BlocScript, consigne: ConsigneAmelioration) {
    if (!ameliorer) return;
    setEnCours(`${bloc.id}:${consigne}`);
    const nouveau = await ameliorer(bloc, consigne);
    setEnCours(null);
    if (nouveau) {
      remplacer(bloc.id, nouveau);
      setEclat(nouveau.id);
      setTimeout(() => setEclat(null), 900);
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <ol className="space-y-3">
        <AnimatePresence initial={false}>
          {tries.map((bloc) => {
            const r = recette.blocs.find((x) => x.id === bloc.blocRecette);
            const couleur = r?.couleur ?? "texte-doux";
            const mots = compterMots(bloc.segments.map((s) => s.texte).join(" "));
            const sec = Math.round(mots / recette.motsParSeconde);
            const horsCible = r && (sec < r.dureeCibleSec[0] - 1 || sec > r.dureeCibleSec[1] + 2);
            const noteBloc = notes?.criteres[bloc.blocRecette];
            return (
              <motion.li
                key={bloc.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.22 }}
                className={cn(
                  "relative overflow-hidden rounded-carte border border-trait border-l-4 bg-surface-1 transition-shadow duration-500",
                  BORDURES_BLOC[couleur],
                  eclat === bloc.id && "shadow-orange",
                )}
              >
                <div className="flex items-center gap-2 px-4 pt-3">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider", FONDS_BLOC[couleur], TEXTES_BLOC[couleur])}>{r?.nom ?? bloc.blocRecette}</span>
                  {noteBloc !== undefined && (
                    <span title="Note estimée" className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums", noteBloc >= 75 ? "bg-sauge-doux text-sauge" : noteBloc >= 55 ? "bg-ambre-doux text-ambre" : "bg-brique-doux text-brique")}>
                      {noteBloc}/100
                    </span>
                  )}
                  <span className={cn("ml-auto text-xs tabular-nums", horsCible ? "font-semibold text-ambre" : "text-texte-faible")} title={r ? `Cible : ${r.dureeCibleSec[0]} à ${r.dureeCibleSec[1]} s` : undefined}>
                    {sec} s
                  </span>
                </div>
                <div className="space-y-2.5 px-4 pb-3 pt-2">
                  {bloc.segments.map((seg) => (
                    <div key={seg.id}>
                      <PhraseModifiable texte={seg.texte} mots={seg.emphase} lectureSeule={lectureSeule} placeholder={r?.consigne ?? "Écrivez ici"} onChange={(t) => modifierSegment(bloc, seg.id, t)} />
                      {/* Lot M2 (B.5) : phrase trop dense pour être lue en sous-titres (> 5,5 mots/s). Jamais bloquant. */}
                      {seg.texte.trim() && phrasesTropDenses(seg.texte, recette.motsParSeconde).length > 0 && (
                        <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-ambre-doux px-2 py-0.5 text-[11px] font-semibold text-ambre" role="note">
                          <Icone nom="attention" size={11} className="shrink-0" />
                          Phrase trop dense pour être lue
                        </p>
                      )}
                      {annotations(seg, recette.annotations).length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {annotations(seg, recette.annotations).map((a, i) => (
                            <span
                              key={i}
                              className={cn(
                                "inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px] font-medium",
                                a.accent ? "bg-orange-doux text-orange-vif" : "bg-surface-2 text-texte-faible",
                              )}
                            >
                              <Icone nom={a.icone} size={11} className="shrink-0" />
                              <span className="truncate">{a.texte}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {ameliorer && !lectureSeule && (
                  <div className="sans-barre flex gap-1 overflow-x-auto border-t border-trait px-2 py-1.5 lg:flex-wrap lg:overflow-visible">
                    {CONSIGNES.map((c) => {
                      const actif = enCours === `${bloc.id}:${c.cle}`;
                      return (
                        <button
                          key={c.cle}
                          type="button"
                          disabled={!!enCours}
                          onClick={() => void lancer(bloc, c.cle)}
                          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-texte-doux transition-colors hover:bg-surface-2 hover:text-texte disabled:opacity-50"
                        >
                          <Icone nom={actif ? "chargement" : c.icone} size={14} className={actif ? "animate-spin text-orange-vif" : "text-orange-vif"} />
                          {c.libelle}
                        </button>
                      );
                    })}
                    <PastilleEssai className="my-auto ml-auto shrink-0" />
                  </div>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
      {!lectureSeule && manquants.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {manquants.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => ajouterBloc(r)}
              className={cn("flex min-h-11 items-center gap-2 rounded-full border border-dashed border-trait-fort px-4 text-sm font-semibold text-texte-doux hover:text-texte", TEXTES_BLOC[r.couleur])}
            >
              <Icone nom="plus" size={15} />
              {r.nom}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Une phrase : lecture (mots en valeur) ; un toucher → modification (zone de texte qui grandit). */
function PhraseModifiable({ texte, mots, lectureSeule, placeholder, onChange }: { texte: string; mots?: string[]; lectureSeule?: boolean; placeholder: string; onChange: (t: string) => void }) {
  const [edition, setEdition] = useState(!texte && !lectureSeule);
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [texte, edition]);

  if (lectureSeule) {
    return (
      <p className="text-[16px] leading-relaxed text-texte">
        <TexteEnValeur texte={texte} mots={mots} />
      </p>
    );
  }
  if (edition) {
    return (
      <textarea
        ref={ref}
        autoFocus={!!texte}
        rows={1}
        value={texte}
        placeholder={placeholder}
        aria-label="Phrase"
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => texte.trim() && setEdition(false)}
        className="block w-full resize-none rounded-xl bg-surface-2 px-3 py-2 text-[16px] leading-relaxed text-texte outline-none ring-1 ring-orange placeholder:text-texte-faible"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEdition(true)}
      className="-mx-2 block w-[calc(100%+16px)] min-h-11 rounded-xl px-2 py-1.5 text-left text-[16px] leading-relaxed text-texte transition-colors hover:bg-surface-2"
      aria-label={`Modifier : ${texte}`}
    >
      <TexteEnValeur texte={texte} mots={mots} />
    </button>
  );
}
