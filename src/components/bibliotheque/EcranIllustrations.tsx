"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { ajouterIllustrationsAction } from "@/app/(studio)/bibliotheque/actions";
import { ApercuVideoSurvol, BarreActionCollee, Bouton, Champ, EtatVide, FeuilleBas, Icone, notifier, Pastille, ZoneDepot } from "@/components/ui";
import { contient } from "@/lib/textes";
import { cn } from "@/lib/cn";
import type { VueElement } from "@/services/vues";
import { envoyerFichiers } from "@/lib/envoi-multipart";
import { FeuilleDetailElement } from "./FeuilleDetailElement";
import type { FormatCourt } from "./outils";

type Filtre = "tout" | "illustration-image" | "illustration-video";

/** ILLUSTRATIONS (AV2.3-6) : galerie images + vidéos, recherche, mots-clés, import. */
export function EcranIllustrations({ elements, formats, filtreInitial, ajouterAuDepart }: { elements: VueElement[]; formats: FormatCourt[]; filtreInitial: Filtre; ajouterAuDepart?: boolean }) {
  const [filtre, setFiltre] = useState<Filtre>(filtreInitial);
  const [q, setQ] = useState("");
  const [motCle, setMotCle] = useState<string | null>(null);
  const [ouvertId, setOuvertId] = useState<string | null>(null);
  const [ajout, setAjout] = useState(!!ajouterAuDepart);

  const motsCles = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of elements) for (const m of e.motsCles) c.set(m, (c.get(m) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr")).slice(0, 14).map(([m]) => m);
  }, [elements]);

  const visibles = elements.filter((e) => (filtre === "tout" || e.type === filtre) && (!motCle || e.motsCles.includes(motCle)) && (!q || contient(`${e.nom} ${e.motsCles.join(" ")}`, q)));
  const nbImages = elements.filter((e) => e.type === "illustration-image").length;
  const ouvert = elements.find((e) => e.id === ouvertId) ?? null;

  return (
    <div>
      <div className="space-y-3 pb-3">
        <Champ libelle="Rechercher" libelleMasque icone="loupe" placeholder="Tribunal, clavier, réunion…" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
        <div className="sans-barre -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
          {(
            [
              ["tout", "Tout", elements.length],
              ["illustration-image", "Images", nbImages],
              ["illustration-video", "Vidéos", elements.length - nbImages],
            ] as const
          ).map(([v, l, n]) => (
            <button
              key={v}
              type="button"
              aria-pressed={filtre === v}
              onClick={() => setFiltre(v)}
              className={cn("flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors", filtre === v ? "bg-orange text-sur-orange" : "bg-surface-2 text-texte-doux hover:text-texte")}
            >
              {l}
              <span className="tabular-nums opacity-70">{n}</span>
            </button>
          ))}
          <span aria-hidden className="mx-1 w-px shrink-0 self-stretch bg-trait" />
          {motsCles.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={motCle === m}
              onClick={() => setMotCle((x) => (x === m ? null : m))}
              className={cn("flex min-h-11 shrink-0 items-center gap-1 rounded-full border px-3 text-sm transition-colors", motCle === m ? "border-orange text-orange-vif" : "border-trait text-texte-doux hover:text-texte")}
            >
              <Icone nom="diese" size={13} />
              {m}
            </button>
          ))}
        </div>
      </div>

      {elements.length === 0 ? (
        <EtatVide icone="images" titre="Aucune illustration" phrase="Ajoutez vos images et vidéos : le moteur piochera dedans." />
      ) : visibles.length === 0 ? (
        <EtatVide compact icone="loupe" titre="Rien ne correspond" action={<Bouton variante="secondaire" onClick={() => { setQ(""); setMotCle(null); setFiltre("tout"); }}>Tout afficher</Bouton>} />
      ) : (
        <motion.ul layout className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          <AnimatePresence initial={false}>
            {visibles.map((e) => (
              <motion.li key={e.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.2 }}>
                <button type="button" onClick={() => setOuvertId(e.id)} className="group relative block aspect-[9/16] w-full overflow-hidden rounded-2xl border border-trait bg-surface-2 text-left">
                  <div data-carte className="absolute inset-0">
                    {e.vignette && <Image src={e.vignette} alt={e.nom} fill sizes="(max-width: 640px) 33vw, 200px" className="object-cover transition-transform duration-500 group-hover:scale-[1.05]" />}
                    {e.type === "illustration-video" && e.url && <ApercuVideoSurvol src={e.url} />}
                  </div>
                  <span className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-fond/90 to-transparent" />
                  <span className="absolute left-1.5 top-1.5 flex flex-col items-start gap-1">
                    {e.etatLicence === "expiree" && <Pastille ton="brique" icone="attention">Expirée</Pastille>}
                    {e.etatLicence === "a-verifier" && <Pastille ton="ambre" icone="attention">À vérifier</Pastille>}
                    {e.licence.type === "generee-ia" && <Pastille ton="orange">IA</Pastille>}
                  </span>
                  {e.type === "illustration-video" && (
                    <span className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-fond/70 text-texte">
                      <Icone nom="lecture" size={13} fill="currentColor" />
                    </span>
                  )}
                  <span className="absolute inset-x-2 bottom-2 line-clamp-2 text-xs font-semibold leading-tight text-texte">{e.nom}</span>
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      <BarreActionCollee>
        <Bouton taille="lg" icone="plus" onClick={() => setAjout(true)}>
          Ajouter des images
        </Bouton>
      </BarreActionCollee>

      <FeuilleDetailElement element={ouvert} formats={formats} onFermer={() => setOuvertId(null)} />
      <FeuilleAjoutIllustrations ouverte={ajout} onOuverteChange={setAjout} motsClesConnus={motsCles} />
    </div>
  );
}

function FeuilleAjoutIllustrations({ ouverte, onOuverteChange, motsClesConnus }: { ouverte: boolean; onOuverteChange: (v: boolean) => void; motsClesConnus: string[] }) {
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [apercus, setApercus] = useState<string[]>([]);
  const [mots, setMots] = useState<string[]>([]);
  const [saisie, setSaisie] = useState("");
  const [enCours, demarrer] = useTransition();

  function ajouterFichiers(f: File[]) {
    setFichiers((x) => [...x, ...f].slice(0, 30));
    setApercus((x) => [...x, ...f.map((y) => (y.type.startsWith("image/") ? URL.createObjectURL(y) : ""))].slice(0, 30));
  }

  function vider() {
    apercus.forEach((u) => u && URL.revokeObjectURL(u));
    setFichiers([]);
    setApercus([]);
    setMots([]);
  }

  function ajouterMot(m: string) {
    const propre = m.trim().toLowerCase();
    if (propre && !mots.includes(propre)) setMots((x) => [...x, propre]);
    setSaisie("");
  }

  function envoyer() {
    demarrer(async () => {
      const e = await envoyerFichiers(fichiers, { typeEntite: "element", entiteId: "illustration" });
      if (!e.ok) return void notifier.erreur(e.message);
      const r = await ajouterIllustrationsAction(e.fichierIds.map((fichierId) => ({ fichierId })), saisie.trim() ? [...mots, saisie] : mots);
      if (!r.ok) return void notifier.erreur(r.message);
      const n = r.donnees.ids.length;
      if (e.simulation) notifier.essai(`${n} ajoutée${n > 1 ? "s" : ""}, rien n'a été envoyé`);
      else notifier.succes(`${n} ajoutée${n > 1 ? "s" : ""}`);
      vider();
      onOuverteChange(false);
    });
  }

  return (
    <FeuilleBas
      ouverte={ouverte}
      onOuverteChange={onOuverteChange}
      titre="Ajouter des illustrations"
      pied={
        <Bouton taille="lg" pleineLargeur icone="coche" essai chargement={enCours} disabled={!fichiers.length} onClick={envoyer}>
          {fichiers.length ? `Ajouter ${fichiers.length}` : "Ajouter"}
        </Bouton>
      }
    >
      <div className="grid gap-4">
        <ZoneDepot libelle="Choisir des images ou des vidéos" detail="Plusieurs à la fois" accepte="image/*,video/*" icone="images" onFichiers={ajouterFichiers} />
        {fichiers.length > 0 && (
          <ul className="grid grid-cols-4 gap-2">
            {fichiers.map((f, i) => (
              <li key={`${f.name}-${i}`} className="relative aspect-square overflow-hidden rounded-xl bg-surface-2">
                {/* Aperçu local (adresse blob:) : pas d'optimisation d'image possible ici. */}
                {apercus[i] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={apercus[i]} alt="" className="size-full object-cover" />
                ) : (
                  <span className="grid size-full place-items-center text-texte-faible">
                    <Icone nom="film" size={20} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <div>
          <Champ
            libelle="Mots-clés"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                ajouterMot(saisie);
              }
            }}
            placeholder="justice, bureau…"
            aide="Le moteur s'en sert pour choisir les images."
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {mots.map((m) => (
              <button key={m} type="button" onClick={() => setMots((x) => x.filter((y) => y !== m))} className="flex min-h-11 items-center gap-1 rounded-full bg-orange-doux px-3 text-sm font-semibold text-orange-vif">
                {m}
                <Icone nom="fermer" size={13} />
              </button>
            ))}
            {motsClesConnus
              .filter((m) => !mots.includes(m))
              .slice(0, 8)
              .map((m) => (
                <button key={m} type="button" onClick={() => ajouterMot(m)} className="flex min-h-11 items-center gap-1 rounded-full border border-trait px-3 text-sm text-texte-doux hover:text-texte">
                  <Icone nom="plus" size={13} />
                  {m}
                </button>
              ))}
          </div>
        </div>
      </div>
    </FeuilleBas>
  );
}
