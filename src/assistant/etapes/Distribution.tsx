"use client";

import { motion } from "motion/react";
import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { deposerFichierAction } from "@/app/(studio)/nouvelle/[format]/actions";
import { envoyerFichiers } from "@/lib/envoi-multipart";
import { Icone } from "@/components/ui/Icone";
import { Pastille } from "@/components/ui/Pastille";
import { Portrait } from "@/components/ui/Portrait";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { notifier } from "@/components/ui/Toast";
import { ZoneDepot } from "@/components/ui/ZoneDepot";
import { EtatVide } from "@/components/ui/EtatVide";
import { anglePrincipalDe, postureDe, tenueDe, visagePourFormat } from "@/domaine/distribution";
import { voixPourFormat } from "@/domaine/voix-format";
import type { AngleVisage, Distribution, PostureVisage } from "@/domaine/types";
import { obtenirFormat } from "@/formats";
import { cn } from "@/lib/cn";
import type { VuePersonnage } from "@/services/vues";
import { posturesDisponibles, tenuesDisponibles, visagePour } from "../express/logique";
import type { FichierDepose, ProprietesEtape } from "./types";

const NATURES: Record<string, string> = { moi: "Moi", reel: "Personne réelle", invente: "Personnage" };

/** Ce qui empêche un personnage de jouer (accord manquant, aucun double prêt…). */
function blocage(p: VuePersonnage, source: Distribution["source"]): string | null {
  if (!p.accordValide) return "Accord manquant";
  if (source === "double" && !p.visages.some((v) => v.statut === "pret")) return "Double pas prêt";
  if (!p.voix.some((v) => v.statut === "pret")) return "Voix pas prête";
  return null;
}

/**
 * Étape « distribution » : pour chaque rôle, le personnage (photo), puis « mon double » ou « mes images filmées »
 * si le format l'autorise (AV2.3-8), puis l'angle et la tenue (visages prêts). Un personnage réel sans accord est bloqué (B.4-6).
 * Compact (bloc Plateau de l'écran « Votre vidéo », lot M3) : le personnage en une ligne, puis Tenues et Assis / Debout ;
 * la voix a son propre bloc (`ChoixVoix`).
 */
export function EtapeDistribution({ formatId, brouillon, modifier, contexte, compacte }: ProprietesEtape) {
  const format = obtenirFormat(formatId);
  const roles = format.personnages.roles?.length ? format.personnages.roles : ["Face caméra"];
  const nombre = Math.max(format.personnages.min, Math.min(format.personnages.max, brouillon.distribution.length || format.personnages.min));
  const slots: Distribution[] = Array.from({ length: nombre }, (_, i) => brouillon.distribution[i] ?? { role: roles[i] ?? roles[0], source: format.personnages.sources[0] ?? "double" });

  if (format.personnages.max > 0 && contexte.personnages.length === 0) return <AjoutezVousDabord />;

  if (format.personnages.max === 0) {
    return (
      <div className="flex min-h-16 items-center gap-3 rounded-carte border border-trait bg-surface-1 p-4 text-texte-doux">
        <Icone nom="info" size={18} />
        Ce format se passe de visage.
      </div>
    );
  }

  const changer = (i: number, patch: Partial<Distribution>) => {
    const suite = slots.map((s, j) => (j === i ? { ...s, ...patch } : s));
    modifier({ distribution: suite });
  };

  const choisirPersonnage = (i: number, p: VuePersonnage) => {
    // L'avatar du format, sinon le double PAR DÉFAUT du personnage, sinon le premier prêt (B.0 §5, correcteur 4).
    const visage = visagePourFormat(p.visages, p.personnage, formatId);
    // Voix du format d'abord (« Vidéo type avocat → Voix avocat rapide »), sinon la voix habituelle (02/10).
    const voix = voixPourFormat(p.voix, p.personnage, formatId);
    changer(i, { personnageId: p.personnage.id, visageId: visage?.id, voixId: voix?.id, visagesParAngle: undefined });
  };

  return (
    <div className={compacte ? "space-y-5" : "space-y-8"}>
      {slots.map((slot, i) => {
        const choisi = contexte.personnages.find((p) => p.personnage.id === slot.personnageId);
        const sources = format.personnages.sources;
        if (compacte && choisi && slot.source === "double") {
          return (
            <section key={i} className="space-y-5">
              <PlateauCompact
                personnage={choisi}
                autres={contexte.personnages.filter((p) => p.personnage.id !== choisi.personnage.id && !blocage(p, "double"))}
                slot={slot}
                posture={brouillon.posture}
                anglePrincipal={anglePrincipalDe(format.recetteMontage)}
                onPersonnage={(p) => choisirPersonnage(i, p)}
                onChange={(patch, posture) => {
                  const suite = slots.map((s, j) => (j === i ? { ...s, ...patch } : s));
                  modifier(posture ? { distribution: suite, posture } : { distribution: suite });
                }}
              />
            </section>
          );
        }
        return (
          <section key={i} className="space-y-5">
            {slots.length > 1 && <h2 className="font-texte text-xs font-bold uppercase tracking-wider text-orange-vif">{slot.role}</h2>}

            <div role="radiogroup" aria-label={`Qui joue : ${slot.role}`} className="sans-barre -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {contexte.personnages.map((p, n) => {
                const raison = blocage(p, slot.source);
                const actif = p.personnage.id === slot.personnageId;
                return (
                  <motion.button
                    key={p.personnage.id}
                    type="button"
                    role="radio"
                    aria-checked={actif}
                    aria-disabled={!!raison}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: n * 0.04 }}
                    onClick={() => (raison ? notifier.info(raison, "Complétez sa fiche dans Personnages.") : choisirPersonnage(i, p))}
                    className={cn(
                      "relative flex w-[132px] shrink-0 flex-col items-center gap-2 rounded-carte border p-3 text-center transition-colors duration-200 disabled:cursor-not-allowed",
                      actif ? "border-orange bg-surface-2 shadow-orange" : "border-trait bg-surface-1 hover:border-trait-fort",
                      raison && "opacity-60",
                    )}
                  >
                    <Portrait nom={p.personnage.nom} photo={p.photo} taille="lg" anneau={actif} />
                    <span className="w-full truncate text-[15px] font-semibold text-texte">{p.personnage.nom}</span>
                    {raison ? (
                      <Pastille ton="ambre" icone={raison === "Accord manquant" ? "cadenas" : "attention"}>
                        {raison}
                      </Pastille>
                    ) : (
                      <Pastille ton={actif ? "orange" : "neutre"}>{NATURES[p.personnage.nature]}</Pastille>
                    )}
                    {actif && (
                      <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-orange text-sur-orange">
                        <Icone nom="coche" size={13} strokeWidth={3} />
                      </span>
                    )}
                  </motion.button>
                );
              })}
              <Link
                href="/personnages"
                className="flex w-[110px] shrink-0 flex-col items-center justify-center gap-2 rounded-carte border border-dashed border-trait-fort p-3 text-center text-sm font-semibold text-texte-doux hover:text-texte"
              >
                <span className="grid size-16 place-items-center rounded-full bg-surface-2">
                  <Icone nom="plus" size={22} />
                </span>
                Ajouter
              </Link>
            </div>

            {choisi && sources.length > 1 && (
              <SelecteurPastilles
                libelle="Les images"
                libelleMasque
                options={[
                  { valeur: "double", libelle: "Mon double", icone: "visage" },
                  { valeur: "rush", libelle: "Mes images filmées", icone: "camera" },
                ]}
                valeur={slot.source}
                onChange={(v) => changer(i, { source: v })}
              />
            )}

            {choisi && slot.source === "double" && (
              <div>
                <p className="mb-2 text-sm font-semibold text-texte-doux">Angle et tenue</p>
                <div role="radiogroup" aria-label="Angle et tenue" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {choisi.visages.map((v) => {
                    const pret = v.statut === "pret";
                    const actif = v.id === slot.visageId;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        role="radio"
                        aria-checked={actif}
                        disabled={!pret}
                        onClick={() => changer(i, { visageId: v.id })}
                        className={cn(
                          "group relative overflow-hidden rounded-carte border text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                          actif ? "border-orange ring-2 ring-orange/40" : "border-trait hover:border-trait-fort",
                        )}
                      >
                        <span className="relative block aspect-[4/5] bg-surface-2">
                          {v.vignette ? (
                            <Image src={v.vignette} alt="" fill sizes="(max-width: 640px) 50vw, 200px" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                          ) : (
                            <span className="absolute inset-0 grid place-items-center text-texte-faible">
                              <Icone nom="visage" size={28} />
                            </span>
                          )}
                          <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-fond/90 to-transparent" />
                          {actif && (
                            <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-orange text-sur-orange">
                              <Icone nom="coche" size={15} strokeWidth={3} />
                            </span>
                          )}
                          {!pret && (
                            <span className="absolute left-2 top-2">
                              <Pastille ton="ambre">En préparation</Pastille>
                            </span>
                          )}
                          <span className="absolute inset-x-0 bottom-0 p-2.5">
                            <span className="block truncate text-sm font-semibold text-texte">{v.nom}</span>
                            {v.qualite && <span className="text-xs tabular-nums text-texte-doux">{v.qualite.note}/100</span>}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {choisi && slot.source === "rush" && (
              <div className="space-y-3">
                <ZoneDepot
                  libelle="Mes images filmées"
                  detail="Vidéos du téléphone ou de la caméra"
                  accepte="video/*"
                  icone="camera"
                  compacte
                  onFichiers={async (fichiers) => {
                    const deposes: FichierDepose[] = [];
                    const cible = { typeEntite: "rush", entiteId: brouillon.videoId ?? "brouillon" };
                    const e = await envoyerFichiers(fichiers, cible);
                    if (!e.ok) notifier.erreur(e.message);
                    for (const fichierId of e.ok ? e.fichierIds : []) {
                      const r = await deposerFichierAction({ fichierId, ...cible });
                      if (r.ok) deposes.push(r.donnees);
                      else notifier.erreur(r.message);
                    }
                    if (!deposes.length) return;
                    changer(i, { rushIds: [...(slot.rushIds ?? []), ...deposes.map((d) => d.id)] });
                    if (e.ok && e.simulation) notifier.essai("rien n'a été envoyé, fichier de démonstration");
                  }}
                />
                {(slot.rushIds?.length ?? 0) > 0 && (
                  <p className="flex items-center gap-2 text-sm text-texte-doux">
                    <Icone nom="film" size={15} className="text-sauge" />
                    {slot.rushIds!.length} séquence{slot.rushIds!.length > 1 ? "s" : ""} prête{slot.rushIds!.length > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            )}

            {!compacte && choisi && choisi.voix.filter((v) => v.statut === "pret").length > 0 && (
              <SelecteurPastilles
                libelle="Voix"
                options={choisi.voix.filter((v) => v.statut === "pret").map((v) => ({ valeur: v.id, libelle: v.nom, icone: "micro" as const }))}
                valeur={slot.voixId}
                onChange={(v) => changer(i, { voixId: v })}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}

/**
 * Bloc Plateau compact : le personnage en une ligne, puis les TENUES (une vignette par tenue normalisée) et
 * ASSIS / DEBOUT. Une posture non filmée est grisée « à filmer (1 vidéo, 10 min) » et mène au guide de tournage (A.3).
 */
function PlateauCompact({
  personnage,
  autres,
  slot,
  posture,
  anglePrincipal,
  onPersonnage,
  onChange,
}: {
  personnage: VuePersonnage;
  autres: VuePersonnage[];
  slot: Distribution;
  posture?: PostureVisage;
  anglePrincipal: AngleVisage;
  onPersonnage: (p: VuePersonnage) => void;
  onChange: (patch: Partial<Distribution>, posture?: PostureVisage) => void;
}) {
  const visage = personnage.visages.find((v) => v.id === slot.visageId);
  const tenueChoisie = visage ? tenueDe(visage) : undefined;
  const postureChoisie = posture ?? (visage ? postureDe(visage) : "assis");
  const tenues = tenuesDisponibles(personnage.visages);
  const postures = posturesDisponibles(personnage.visages, tenueChoisie);
  const choisir = (tenueId: string | undefined, p: PostureVisage) => {
    // Correcteur 4 : la tenue change, l'avatar reste le même (jamais un autre avatar de même tenue).
    const v = visagePour(personnage.visages, tenueId, p, { actuel: visage, anglePrincipal });
    if (!v) return notifier.info("Pas encore filmé", "Le guide de tournage est dans Personnages.");
    onChange({ visageId: v.id, visagesParAngle: undefined }, p);
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <Portrait nom={personnage.personnage.nom} photo={personnage.photo} taille="md" />
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-texte">{personnage.personnage.nom}</span>
        {autres.length > 0 && (
          <SelecteurPastilles
            libelle="Qui parle"
            libelleMasque
            options={autres.map((p) => ({ valeur: p.personnage.id, libelle: p.personnage.nom }))}
            valeur={undefined}
            onChange={(id) => {
              const p = autres.find((x) => x.personnage.id === id);
              if (p) onPersonnage(p);
            }}
          />
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-texte-doux">Tenues</p>
        <div role="radiogroup" aria-label="Tenue" className="sans-barre -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {tenues.map((t) => {
            const actif = t.id === tenueChoisie;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={actif}
                onClick={() => choisir(t.id, postureChoisie)}
                className={cn("w-24 shrink-0 overflow-hidden rounded-xl border text-left transition-colors", actif ? "border-orange ring-2 ring-orange/40" : "border-trait hover:border-trait-fort")}
              >
                <span className="relative block aspect-[4/5] bg-surface-2">
                  {t.vignette ? <Image src={t.vignette} alt="" fill sizes="96px" className="object-cover" /> : <Icone nom="visage" size={22} className="absolute inset-0 m-auto text-texte-faible" />}
                  {t.generee && (
                    <span className="absolute left-1 top-1">
                      <Pastille ton="ambre">À vérifier</Pastille>
                    </span>
                  )}
                </span>
                <span className="block truncate px-2 py-1.5 text-xs font-semibold text-texte">{t.nom}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div role="radiogroup" aria-label="Posture" className="grid grid-cols-2 gap-2">
        {postures.map((p) => {
          const actif = p.posture === postureChoisie;
          return p.filmee ? (
            <button
              key={p.posture}
              type="button"
              role="radio"
              aria-checked={actif}
              onClick={() => choisir(tenueChoisie, p.posture)}
              className={cn(
                "flex min-h-12 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors",
                actif ? "border-orange bg-orange-doux text-orange-vif" : "border-trait bg-surface-1 text-texte hover:border-trait-fort",
              )}
            >
              {actif && <Icone nom="coche" size={15} strokeWidth={3} />}
              {p.libelle}
            </button>
          ) : (
            <Link
              key={p.posture}
              href="/personnages"
              className="flex min-h-12 flex-col items-center justify-center rounded-xl border border-dashed border-trait bg-surface-2/50 px-2 text-center opacity-70"
            >
              <span className="text-sm font-semibold text-texte-doux">{p.libelle} · à filmer</span>
              <span className="text-[11px] text-texte-faible">1 vidéo, 10 min</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}

/**
 * Aucun personnage encore (TEST-UI-REEL U4) : un état vide qui guide vers Personnages, au lieu d'un simple « Ajouter »
 * (Plateau) ou de « Choisissez d'abord qui parle » (Voix).
 */
export function AjoutezVousDabord() {
  return (
    <EtatVide
      compact
      icone="personnages"
      titre="Ajoutez-vous d'abord"
      phrase="Votre visage et votre voix, une seule fois."
      action={
        <Link href="/personnages" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-orange px-4 text-sm font-semibold text-sur-orange">
          <Icone nom="plus" size={16} /> Personnages
        </Link>
      }
    />
  );
}

/** Bloc Voix (écran « Votre vidéo ») : la voix en carte, avec ▶ pour l'écouter (échantillon existant, gratuit). */
export function ChoixVoix({ brouillon, modifier, contexte }: Pick<ProprietesEtape, "brouillon" | "modifier" | "contexte">) {
  if (contexte.personnages.length === 0) return <AjoutezVousDabord />;
  const slot = brouillon.distribution[0];
  const p = contexte.personnages.find((x) => x.personnage.id === slot?.personnageId);
  if (!slot || !p) return <EtatVide compact icone="micro" titre="Choisissez d'abord qui parle" phrase="Dans le bloc Plateau." />;
  const pretes = p.voix.filter((v) => v.statut === "pret");
  if (!pretes.length)
    return (
      <EtatVide
        compact
        icone="micro"
        titre="Aucune voix prête"
        phrase="Reliez votre voix HeyGen en une minute."
        action={
          <Link href={`/personnages/${p.personnage.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-orange px-4 text-sm font-semibold text-sur-orange">
            <Icone nom="micro" size={16} /> Relier ma voix
          </Link>
        }
      />
    );
  return (
    <ul role="radiogroup" aria-label="Voix" className="space-y-2">
      {pretes.map((v) => {
        const actif = v.id === slot.voixId;
        const echantillon = contexte.express?.plateau.echantillonsVoix[v.id];
        return (
          <li key={v.id} className={cn("flex min-h-16 items-center gap-3 rounded-carte border p-3", actif ? "border-orange bg-surface-2" : "border-trait bg-surface-1")}>
            <button
              type="button"
              role="radio"
              aria-checked={actif}
              onClick={() => modifier({ distribution: brouillon.distribution.map((d, i) => (i === 0 ? { ...d, voixId: v.id } : d)) })}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <span className={cn("grid size-11 shrink-0 place-items-center rounded-full", actif ? "bg-orange text-sur-orange" : "bg-orange-doux text-orange-vif")}>
                <Icone nom={actif ? "coche" : "micro"} size={18} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold text-texte">{v.nom}</span>
                <span className="text-xs text-texte-faible">{v.fournisseur === "heygen" ? "Votre voix HeyGen" : v.fournisseur === "elevenlabs" ? "ElevenLabs, en secours" : "Voix d'essai"}</span>
              </span>
            </button>
            {echantillon && <BoutonEcoute src={echantillon} nom={v.nom} />}
          </li>
        );
      })}
    </ul>
  );
}

/** ▶ / pause d'un échantillon de voix (aucun appel payant : le fichier existe déjà). */
function BoutonEcoute({ src, nom }: { src: string; nom: string }) {
  const [lecture, setLecture] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  return (
    <>
      <audio ref={audio} src={src} preload="none" onEnded={() => setLecture(false)} onPause={() => setLecture(false)} onPlay={() => setLecture(true)} />
      <button
        type="button"
        aria-label={lecture ? `Arrêter l'écoute de « ${nom} »` : `Écouter « ${nom} »`}
        onClick={() => (audio.current?.paused ? void audio.current.play() : audio.current?.pause())}
        className="grid size-11 shrink-0 place-items-center rounded-full border border-trait bg-surface-2 text-texte transition-colors hover:border-orange"
      >
        <Icone nom={lecture ? "volume" : "lecture"} size={18} />
      </button>
    </>
  );
}
