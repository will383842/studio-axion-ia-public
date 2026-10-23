"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Bouton, BoutonIcone } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { EtatVide } from "@/components/ui/EtatVide";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone } from "@/components/ui/Icone";
import { IlYA } from "@/components/ui/IlYA";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { adresseFiltres, filtrerSujets, groupesFormats, lireFiltres, nombreFiltres, VUES_RAPIDES, type FiltresScripts, type FormatClassable, type VueRapide } from "@/domaine/classement-generateur";
import { ADRESSES, FAMILLES_FORMAT, MANQUES_GENERATEUR, QUI_PARLE } from "@/domaine/libelles";
import type { Adresse, ModeDiction } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { RESEAUX_DECLINAISON } from "@/reseaux/codes";
import type { SujetListe } from "./donnees";
import { LegendeGrille, MiniGrille } from "./MiniGrille";

export interface ProprietesListeSujets {
  sujets: SujetListe[];
  formats: FormatClassable[];
  /** Nombre de sujets par format (compteurs du bouton Format). */
  nombres: Record<string, number>;
  codes: Record<string, string>;
  favoris?: string[];
  piliers: { id: string; nom: string }[];
  series: { id: string; nom: string }[];
  sansSujet: { id: string; titre: string }[];
}

/** Liste « Scripts » (B.6.2-B.6.4) : rangée de 5 logos et bouton Format visibles ; le reste dans « Plus de filtres ». */
export function ListeSujets(p: ProprietesListeSujets) {
  const router = useRouter();
  const chemin = usePathname();
  const params = useSearchParams();
  const filtres = useMemo(() => lireFiltres(new URLSearchParams(params.toString())), [params]);
  const [feuilleFormat, setFeuilleFormat] = useState(false);
  const plusOuverte = params.get("filtres") === "1";

  function appliquer(f: FiltresScripts) {
    const extra: Record<string, string> = {};
    const onglet = params.get("onglet");
    if (onglet) extra.onglet = onglet;
    router.replace(adresseFiltres(chemin, f, extra), { scroll: false });
  }

  const tous = filtrerSujets(p.sujets, filtres, p.codes);
  const brouillons = tous.filter((s) => s.maitre.numero === undefined);
  const numerotes = tous.filter((s) => s.maitre.numero !== undefined);
  const filtre = nombreFiltres(filtres) > 0;
  const formatActif = p.formats.find((f) => f.id === filtres.format);

  return (
    <div className="space-y-4">
      {/* Rangée fixe : 5 logos + Format */}
      <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-20 -mx-4 border-b border-trait/60 bg-fond/90 px-4 py-2 backdrop-blur-lg">
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Réseau" className="flex min-w-0 flex-1 items-center justify-between gap-1">
            {RESEAUX_DECLINAISON.map((r) => {
              const actif = filtres.reseau === r;
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => appliquer({ ...filtres, reseau: actif ? undefined : r })}
                  className={cn("grid size-11 place-items-center rounded-xl transition-colors", actif ? "bg-orange-doux ring-2 ring-orange" : "hover:bg-surface-2")}
                >
                  <LogoReseau reseau={r} taille="md" className={cn(actif && "border-orange text-orange-vif")} />
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setFeuilleFormat(true)}
            className={cn(
              "inline-flex min-h-11 max-w-[6rem] shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold",
              formatActif ? "border-orange bg-orange-doux text-orange-vif" : "border-trait bg-surface-1 text-texte",
            )}
          >
            <Icone nom="grille" size={16} className="shrink-0" />
            <span className="truncate">{formatActif?.nom ?? "Format"}</span>
          </button>
        </div>
      </div>

      {filtre && (
        <div className="flex items-center justify-between gap-2 text-sm text-texte-doux">
          <span>
            {tous.length} sujet{tous.length > 1 ? "s" : ""}
            {filtres.etat && <> · {VUES_RAPIDES[filtres.etat]}</>}
            {filtres.q && <> · « {filtres.q} »</>}
          </span>
          <button type="button" onClick={() => appliquer({})} className="min-h-11 shrink-0 rounded-full px-2 font-semibold hover:text-texte">
            Tout afficher
          </button>
        </div>
      )}

      {brouillons.map((s) => (
        <Link key={s.id} href={`/ecrire/sujets/${s.id}`} className="block">
          <Carte interactive className="border-ambre/40">
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ambre-doux text-ambre">
                <Icone nom="micro" size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-texte">{s.titre}</p>
                <p className="text-sm text-ambre">{s.maitre.manque ? MANQUES_GENERATEUR[s.maitre.manque.type] ?? "Sujet sans numéro" : "Sujet sans numéro"}</p>
              </div>
              <Icone nom="chevron-droite" size={18} className="text-texte-faible" />
            </div>
          </Carte>
        </Link>
      ))}

      {numerotes.length > 0 ? (
        <ul className="space-y-3">
          {numerotes.map((s) => (
            <li key={s.id}>
              <Link href={`/ecrire/sujets/${s.id}${filtres.reseau ? `?reseau=${filtres.reseau}` : ""}`} className="block">
                <Carte interactive>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="font-titre text-2xl leading-none text-texte">
                      n° {s.maitre.numero}
                      {s.version > 1 && <span className="ml-1.5 align-middle font-texte text-xs font-bold text-texte-faible">v{s.version}</span>}
                    </span>
                    <span className="text-xs text-texte-faible">
                      <IlYA iso={s.quand} />
                    </span>
                  </div>
                  <p className="mb-4 line-clamp-2 text-[15px] leading-snug text-texte-doux">{s.titre}</p>
                  {s.grille.length ? <MiniGrille lignes={s.grille} reseauActif={filtres.reseau} /> : <p className="text-sm text-ambre">En écriture</p>}
                </Carte>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        // État vide SEULEMENT s'il n'y a vraiment rien (vérification E2E n° 1 console, n° 7) ; le bouton « Nouveau sujet »
        // est celui de la barre du bas (un seul).
        !brouillons.length &&
        (filtre || !p.sansSujet.length) && (
          <EtatVide
            compact
            icone="document"
            titre={filtre ? "Aucun sujet ici" : "Aucun sujet"}
            phrase={filtre ? "Changez de réseau ou de format." : "Une idée suffit pour commencer."}
            action={
              filtre ? (
                <Bouton variante="secondaire" onClick={() => appliquer({})}>
                  Tout afficher
                </Bouton>
              ) : undefined
            }
          />
        )
      )}

      {p.sujets.length > 0 && <LegendeGrille />}

      {p.sansSujet.length > 0 && !filtre && (
        // Les scripts existants sont visibles d'emblée, jamais repliés.
        <section aria-labelledby="titre-sans-sujet" className="rounded-carte border border-trait bg-surface-1 px-4">
          <h2 id="titre-sans-sujet" className="flex min-h-12 items-center text-sm font-semibold text-texte-doux">
            Scripts sans sujet · {p.sansSujet.length}
          </h2>
          <ul className="pb-2">
            {p.sansSujet.map((t) => (
              <li key={t.id}>
                <Link href={`/scripts/${t.id}`} className="flex min-h-11 items-center justify-between gap-2 text-sm text-texte hover:text-orange-vif">
                  <span className="truncate">{t.titre}</span>
                  <Icone nom="chevron-droite" size={14} className="shrink-0 text-texte-faible" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FeuilleFormat
        ouverte={feuilleFormat}
        onOuverteChange={setFeuilleFormat}
        formats={p.formats}
        nombres={p.nombres}
        favoris={p.favoris}
        actif={filtres.format}
        onChoisir={(id) => {
          appliquer({ ...filtres, format: id ?? undefined });
          setFeuilleFormat(false);
        }}
      />
      <FeuillePlusDeFiltres
        key={plusOuverte ? "ouverte" : "fermee"}
        ouverte={plusOuverte}
        onOuverteChange={(v) => !v && appliquer(filtres)}
        filtres={filtres}
        piliers={p.piliers}
        series={p.series}
        onAppliquer={appliquer}
      />
    </div>
  );
}

/** Bouton « Plus de filtres » de l'en-tête : ouvre la feuille par l'adresse (`filtres=1`), avec le nombre de critères actifs. */
export function BoutonPlusDeFiltres() {
  const router = useRouter();
  const chemin = usePathname();
  const params = useSearchParams();
  const nombre = nombreFiltres(lireFiltres(new URLSearchParams(params.toString())), ["reseau", "format"]);
  return (
    <span className="relative inline-block">
      <BoutonIcone
        icone="filtre"
        libelle="Plus de filtres"
        variante="secondaire"
        onClick={() => {
          const p = new URLSearchParams(params.toString());
          p.set("filtres", "1");
          router.replace(`${chemin}?${p.toString()}`, { scroll: false });
        }}
      />
      {nombre > 0 && <span className="pointer-events-none absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-orange text-[11px] font-bold text-sur-orange">{nombre}</span>}
    </span>
  );
}

/** Feuille « Format » (B.6.4) : favoris en premier, rangés par type de vidéo, recherche, compteurs, formats vides masqués. */
export function FeuilleFormat({
  ouverte,
  onOuverteChange,
  formats,
  nombres,
  favoris,
  actif,
  onChoisir,
}: {
  ouverte: boolean;
  onOuverteChange: (v: boolean) => void;
  formats: FormatClassable[];
  nombres: Record<string, number>;
  favoris?: string[];
  actif?: string;
  onChoisir: (id: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const [tout, setTout] = useState(false);
  const { groupes, masques } = groupesFormats(formats, nombres, {
    favoris,
    recherche: q,
    toutAfficher: tout,
    ordreFamilles: Object.keys(FAMILLES_FORMAT),
    libelleFamille: (f) => FAMILLES_FORMAT[f] ?? f,
  });
  return (
    <FeuilleBas ouverte={ouverte} onOuverteChange={onOuverteChange} titre="Format">
      <Champ libelle="Chercher un format" libelleMasque icone="loupe" placeholder="Chercher un nom ou un code" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-4 space-y-5">
        {groupes.map((g) => (
          <section key={g.cle}>
            <h3 className="mb-2 flex items-center gap-1.5 font-texte text-xs font-bold uppercase tracking-wider text-texte-faible">
              {g.cle === "favoris" && <Icone nom="etoile" size={12} />}
              {g.libelle}
            </h3>
            <ul className="grid grid-cols-2 gap-2">
              {g.formats.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => onChoisir(actif === f.id ? null : f.id)}
                    aria-pressed={actif === f.id}
                    className={cn(
                      "flex min-h-16 w-full flex-col items-start justify-between rounded-champ border p-3 text-left transition-colors",
                      actif === f.id ? "border-orange bg-orange-doux" : "border-trait bg-surface-2 hover:border-trait-fort",
                    )}
                  >
                    <span className="font-titre text-xs text-orange-vif">{f.code}</span>
                    <span className="flex w-full items-baseline justify-between gap-1">
                      <span className="truncate text-sm font-semibold text-texte">{f.nom}</span>
                      <span className="text-xs tabular-nums text-texte-faible">{f.nombre}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!groupes.length && <p className="text-sm text-texte-faible">Aucun format ne correspond.</p>}
      </div>
      {!tout && masques > 0 && (
        <button type="button" onClick={() => setTout(true)} className="mt-4 min-h-11 w-full rounded-full text-sm font-semibold text-texte-doux hover:text-texte">
          Tout afficher (+{masques} sans sujet)
        </button>
      )}
    </FeuilleBas>
  );
}

/** Feuille « Plus de filtres » (B.6.4) : État, Qui parle, Vous/Tu, Thème, Série ; recherche par texte et par code. */
function FeuillePlusDeFiltres({
  ouverte,
  onOuverteChange,
  filtres,
  piliers,
  series,
  onAppliquer,
}: {
  ouverte: boolean;
  onOuverteChange: (v: boolean) => void;
  filtres: FiltresScripts;
  piliers: { id: string; nom: string }[];
  series: { id: string; nom: string }[];
  onAppliquer: (f: FiltresScripts) => void;
}) {
  const [f, setF] = useState<FiltresScripts>(filtres);
  const tous = "";
  return (
    <FeuilleBas
      ouverte={ouverte}
      onOuverteChange={(v) => {
        if (v) setF(filtres);
        onOuverteChange(v);
      }}
      titre="Plus de filtres"
      pied={
        <div className="flex gap-2 [&>*:last-child]:flex-1">
          <Bouton variante="fantome" taille="lg" onClick={() => onAppliquer({ reseau: f.reseau, format: f.format })}>
            Effacer
          </Bouton>
          <Bouton taille="lg" onClick={() => onAppliquer(f)}>
            Voir les sujets
          </Bouton>
        </div>
      }
    >
      <div className="space-y-6">
        <Champ libelle="Chercher" icone="loupe" placeholder="42, 0042-AV-TT, un mot…" value={f.q ?? ""} onChange={(e) => setF({ ...f, q: e.target.value || undefined })} />
        <SelecteurPastilles<VueRapide | typeof tous>
          libelle="État"
          valeur={f.etat ?? tous}
          onChange={(v) => setF({ ...f, etat: v || undefined })}
          options={[{ valeur: tous, libelle: "Tous" }, ...(Object.keys(VUES_RAPIDES) as VueRapide[]).map((v) => ({ valeur: v, libelle: VUES_RAPIDES[v] }))]}
        />
        <SelecteurPastilles<ModeDiction | typeof tous>
          libelle="Qui parle"
          valeur={f.qui ?? tous}
          onChange={(v) => setF({ ...f, qui: v || undefined })}
          options={[{ valeur: tous, libelle: "Tous" }, ...(Object.keys(QUI_PARLE) as ModeDiction[]).map((m) => ({ valeur: m, libelle: QUI_PARLE[m].libelle, icone: QUI_PARLE[m].icone }))]}
        />
        <SelecteurPastilles<Adresse | typeof tous>
          libelle="Vous ou tu"
          valeur={f.adresse ?? tous}
          onChange={(v) => setF({ ...f, adresse: v || undefined })}
          options={[{ valeur: tous, libelle: "Les deux" }, ...(Object.keys(ADRESSES) as Adresse[]).map((a) => ({ valeur: a, libelle: ADRESSES[a].libelle }))]}
        />
        {piliers.length > 0 && (
          <SelecteurPastilles<string>
            libelle="Thème"
            valeur={f.pilier ?? tous}
            onChange={(v) => setF({ ...f, pilier: v || undefined })}
            options={[{ valeur: tous, libelle: "Tous" }, ...piliers.map((x) => ({ valeur: x.id, libelle: x.nom }))]}
          />
        )}
        {series.length > 0 && (
          <SelecteurPastilles<string>
            libelle="Série"
            valeur={f.serie ?? tous}
            onChange={(v) => setF({ ...f, serie: v || undefined })}
            options={[{ valeur: tous, libelle: "Toutes" }, ...series.map((x) => ({ valeur: x.id, libelle: x.nom }))]}
          />
        )}
        <Link href="/videos/a-ranger" className="flex min-h-12 items-center justify-between rounded-carte border border-trait bg-surface-2 px-4 text-sm font-semibold text-texte hover:border-trait-fort">
          <span className="flex items-center gap-2">
            <Icone nom="archive" size={16} className="text-orange-vif" />À ranger
          </span>
          <Icone nom="chevron-droite" size={16} className="text-texte-faible" />
        </Link>
      </div>
    </FeuilleBas>
  );
}

