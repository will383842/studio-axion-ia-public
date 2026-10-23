"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { archiverMesImageAction } from "@/app/(studio)/bibliotheque/actions";
import { BarreActionCollee, Bouton, Champ, EtatVide, FeuilleBas, Icone, notifier, Pastille } from "@/components/ui";
import { CATEGORIES_MES_IMAGES, correspondRecherche, nomCategorie } from "@/domaine/mes-images";
import type { CategorieMesImages } from "@/domaine/types";
import { cn } from "@/lib/cn";
import type { VueMesImage } from "@/services/mes-images";
import { FeuilleImport } from "./FeuilleImport";
import { ImageAvecZones } from "./ImageAvecZones";
import { ValidationEnSerie } from "./ValidationEnSerie";

/**
 * « MES IMAGES » (lot A2) : grille par catégorie, recherche, filtre par mot-clé, « utilisée dans N vidéos »,
 * pastilles à vérifier (orange) / prête (vert) / floutée / vidéo, validation en série, archivage.
 */
export function EcranMesImages({ images, ranges, ajouterAuDepart }: { images: VueMesImage[]; ranges: VueMesImage[]; ajouterAuDepart?: boolean }) {
  const router = useRouter();
  const [categorie, setCategorie] = useState<CategorieMesImages | "toutes">("toutes");
  const [q, setQ] = useState("");
  const [motCle, setMotCle] = useState<string | null>(null);
  const [import_, setImport] = useState(!!ajouterAuDepart);
  const [serie, setSerie] = useState(false);
  // La série est FIGÉE à l'ouverture : la page se met à jour à chaque validation, la liste parcourue ne bouge pas.
  const [serieImages, setSerieImages] = useState<VueMesImage[]>([]);
  const ouvrirSerie = (depuis?: string) => {
    const liste = images.filter((i) => i.statut !== "prete");
    const debut = depuis ? liste.findIndex((i) => i.id === depuis) : 0;
    setSerieImages(debut > 0 ? [...liste.slice(debut), ...liste.slice(0, debut)] : liste);
    setSerie(true);
  };
  const [ouverteId, setOuverteId] = useState<string | null>(null);
  const [, demarrer] = useTransition();

  const aVerifier = images.filter((i) => i.statut !== "prete");
  const motsCles = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of images) for (const m of e.motsCles) c.set(m, (c.get(m) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr")).slice(0, 12).map(([m]) => m);
  }, [images]);
  const visibles = images.filter(
    (i) => (categorie === "toutes" || i.categorie === categorie) && (!motCle || i.motsCles.includes(motCle)) && (!q || correspondRecherche({ ...i, categorieImage: i.categorie }, q)),
  );
  const parCategorie = (c: CategorieMesImages) => images.filter((i) => i.categorie === c).length;
  const ouverte = images.find((i) => i.id === ouverteId) ?? null;

  function archiver(id: string, oui: boolean) {
    demarrer(async () => {
      const r = await archiverMesImageAction(id, oui);
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.info(oui ? "Archivée (rien n'est supprimé)" : "Restaurée");
      setOuverteId(null);
      router.refresh();
    });
  }

  return (
    <div>
      {aVerifier.length > 0 && (
        <button
          type="button"
          onClick={() => ouvrirSerie()}
          className="mb-4 flex min-h-14 w-full items-center gap-3 rounded-carte border border-ambre/40 bg-ambre/10 px-4 text-left"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ambre/20 text-ambre">
            <Icone nom="bouclier" size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-texte">
              {aVerifier.length} à vérifier
            </span>
            <span className="block text-xs text-texte-faible">Inutilisées tant que vous n&apos;avez pas validé</span>
          </span>
          <span className="text-sm font-semibold text-orange-vif">Valider</span>
          <Icone nom="chevron-droite" size={16} className="text-orange-vif" />
        </button>
      )}

      <div className="space-y-3 pb-3">
        <Champ libelle="Rechercher" libelleMasque icone="loupe" placeholder="Console, facture, GOFAB…" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
        <div className="sans-barre -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
          <Puce actif={categorie === "toutes"} onClick={() => setCategorie("toutes")} libelle="Toutes" n={images.length} />
          {CATEGORIES_MES_IMAGES.filter((c) => parCategorie(c.id) > 0).map((c) => (
            <Puce key={c.id} actif={categorie === c.id} onClick={() => setCategorie(c.id)} libelle={c.nom} n={parCategorie(c.id)} />
          ))}
        </div>
        {motsCles.length > 0 && (
          <div className="sans-barre -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
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
        )}
      </div>

      {images.length === 0 ? (
        <EtatVide icone="images" titre="Aucune image à vous" phrase="Bureau, consoles, interventions : déposez-les en vrac, le studio range." action={<Bouton icone="plus" onClick={() => setImport(true)}>Ajouter</Bouton>} />
      ) : visibles.length === 0 ? (
        <EtatVide compact icone="loupe" titre="Rien ne correspond" action={<Bouton variante="secondaire" onClick={() => { setQ(""); setMotCle(null); setCategorie("toutes"); }}>Tout afficher</Bouton>} />
      ) : (
        <motion.ul layout className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence initial={false}>
            {visibles.map((i) => (
              <motion.li key={i.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <button type="button" onClick={() => setOuverteId(i.id)} className="block w-full overflow-hidden rounded-2xl border border-trait bg-surface-1 text-left">
                  <div className="relative grid aspect-square place-items-center overflow-hidden bg-surface-2 p-1">
                    <ImageAvecZones src={i.vignette} alt={i.nom} largeur={i.largeur} hauteur={i.hauteur} zones={i.zones} floutee={i.floutee} copieReelle={i.copieReelle} video={i.type === "illustration-video"} className="max-h-full" />
                    <span className="absolute left-1.5 top-1.5 flex flex-wrap gap-1">
                      {i.pastilles.map((p) => (
                        <Pastille key={p.libelle} ton={p.ton} point={p.libelle === "Prête" || p.libelle === "À vérifier"}>
                          {p.libelle}
                        </Pastille>
                      ))}
                    </span>
                  </div>
                  <div className="px-2.5 py-2">
                    <p className="truncate text-xs font-semibold text-texte">{i.nom}</p>
                    <p className="truncate text-[11px] text-texte-faible">
                      {nomCategorie(i.categorie)} · {i.utilisations ? `dans ${i.utilisations} vidéo${i.utilisations > 1 ? "s" : ""}` : "pas encore utilisée"}
                    </p>
                  </div>
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      {ranges.length > 0 && (
        <details className="mt-8 rounded-carte border border-trait bg-surface-1 p-3">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-texte-doux">
            <Icone nom="archive" size={15} />
            Archivées ({ranges.length})
          </summary>
          <ul className="mt-2 grid gap-1">
            {ranges.map((r) => (
              <li key={r.id} className="flex min-h-11 items-center justify-between gap-2 text-sm">
                <span className="truncate text-texte-doux">{r.nom}</span>
                <Bouton variante="fantome" icone="reessayer" onClick={() => archiver(r.id, false)}>
                  Restaurer
                </Bouton>
              </li>
            ))}
          </ul>
        </details>
      )}

      <BarreActionCollee>
        <Bouton taille="lg" icone="plus" onClick={() => setImport(true)}>
          Ajouter des images
        </Bouton>
      </BarreActionCollee>

      <FeuilleImport ouverte={import_} onOuverteChange={setImport} onImportees={() => router.refresh()} />
      <ValidationEnSerie
        images={serieImages}
        ouverte={serie}
        onOuverteChange={(o) => {
          setSerie(o);
          if (!o) router.refresh();
        }}
      />
      <FeuilleBas ouverte={!!ouverte} onOuverteChange={(o) => !o && setOuverteId(null)} titre={ouverte?.nom ?? ""} description={ouverte ? nomCategorie(ouverte.categorie) : undefined}>
        {ouverte && (
          <div className="grid gap-3 pb-2">
            <div className="grid h-[46dvh] place-items-center">
              <ImageAvecZones src={ouverte.vignette} alt={ouverte.nom} largeur={ouverte.largeur} hauteur={ouverte.hauteur} zones={ouverte.zones} floutee={ouverte.floutee} copieReelle={ouverte.copieReelle} tailles="(max-width: 640px) 92vw, 480px" className="max-h-[46dvh]" />
            </div>
            {ouverte.description && <p className="text-sm text-texte-doux">{ouverte.description}</p>}
            <div className="flex flex-wrap gap-1.5">
              {ouverte.motsCles.map((m) => (
                <Pastille key={m}>{m}</Pastille>
              ))}
            </div>
            <p className="text-xs text-texte-faible">
              Propriété Axion-IA · {ouverte.utilisations ? `utilisée dans ${ouverte.utilisations} vidéo${ouverte.utilisations > 1 ? "s" : ""}` : "pas encore utilisée"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Bouton variante="secondaire" icone="archive" onClick={() => archiver(ouverte.id, true)}>
                Archiver
              </Bouton>
              <Bouton
                icone="coche"
                onClick={() => {
                  setOuverteId(null);
                  ouvrirSerie(ouverte.id);
                }}
                disabled={ouverte.statut === "prete"}
              >
                {ouverte.statut === "prete" ? "Prête" : "Vérifier"}
              </Bouton>
            </div>
          </div>
        )}
      </FeuilleBas>
    </div>
  );
}

function Puce({ actif, onClick, libelle, n }: { actif: boolean; onClick: () => void; libelle: string; n: number }) {
  return (
    <button type="button" aria-pressed={actif} onClick={onClick} className={cn("flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors", actif ? "bg-orange text-sur-orange" : "bg-surface-2 text-texte-doux hover:text-texte")}>
      {libelle}
      <span className="tabular-nums opacity-70">{n}</span>
    </button>
  );
}
