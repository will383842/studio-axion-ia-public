"use client";

import { useEffect, useState, useTransition } from "react";
import { formateurDate } from "@/lib/intl";
import { Bouton } from "@/components/ui/Bouton";
import { EtatVide } from "@/components/ui/EtatVide";
import { notifier } from "@/components/ui/Toast";
import { compterParOnglet, filtrerParOnglet, LIBELLE_RESEAU_A_TRAITER, ONGLETS_A_TRAITER, type CarteDejaTraitee, type OngletATraiter } from "@/services/a-traiter-onglets";
import { copiePossible, lienCommentaireSur } from "@/services/a-traiter-kit";
import { masqueesPourEcran, trierPourEcran } from "@/services/a-traiter-pur";
import { extraitLisible } from "@/services/a-traiter-types";
import type { ResultatChangement, VueATraiter } from "@/services/a-traiter-types";
import type { CarteATraiter as TypeCarte } from "@/services/a-traiter-types";
import { CarteATraiter } from "./CarteATraiter";
import { clePost, CompteursATraiter, etiquettesPosts } from "./CompteursATraiter";

/** Ce que l'écran appelle : en production les gestes de `a-traiter-gestes`, dans les tests un faux. */
export interface ServicesATraiter {
  fait(id: string): Promise<ResultatChangement>;
  ignorer(id: string): Promise<ResultatChangement>;
  stop(id: string, compte: string): Promise<ResultatChangement>;
}

/** Conservé pour les appelants existants : `CarteDejaTraitee` porte désormais `faitLe`. */
export type CarteDejaTraiteeDatee = CarteDejaTraitee;

/** Touche pressée : seules « Flèche droite » et « S » (suivante) et « F » (Fait) agissent. Jamais de raccourci pour STOP ou Ignorer. */
export function actionClavier(e: { key: string; repeat?: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; target?: { tagName?: string; isContentEditable?: boolean } | null }): "suivante" | "fait" | null {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return null;
  const t = e.target;
  if (t?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes((t?.tagName ?? "").toUpperCase())) return null;
  if (e.key === "ArrowRight" || e.key === "s" || e.key === "S") return "suivante";
  if (e.key === "f" || e.key === "F") return "fait";
  return null;
}

/** Ce que fait l'écran pour une touche : rien si une action est en cours, si l'écran n'est pas « normal » ou s'il n'y a pas de carte ; « Fait » jamais sur une carte opposée ; STOP jamais. */
export function decisionClavier(a: "suivante" | "fait" | null, o: { carte?: { opposee?: boolean } | undefined; enCours: boolean; etat: string }): "suivante" | "fait" | null {
  if (!a || !o.carte || o.enCours || o.etat !== "normal") return null;
  if (a === "suivante") return "suivante";
  return o.carte.opposee ? null : "fait";
}

/** « Fait le JJ/MM à HHhMM » (heure de Paris) ; « Fait » seul si l'heure manque ou est illisible. */
export function libelleFait(iso: string | undefined): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "Fait";
  const p = Object.fromEntries(HEURE_PARIS.formatToParts(d).map((x) => [x.type, x.value]));
  return `Fait le ${p.day}/${p.month} à ${p.hour}h${p.minute}`;
}
const HEURE_PARIS = formateurDate("en-GB", { timeZone: "Europe/Paris", hourCycle: "h23", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Écran « À traiter à la main » : une carte à la fois, la plus prioritaire d’abord. */
export function EcranATraiter({ vue, services, compte, onChange, dejaTraitees }: { vue: VueATraiter; services: ServicesATraiter; compte: string; onChange?: () => void; dejaTraitees?: readonly CarteDejaTraiteeDatee[] }) {
  const [enCours, demarrer] = useTransition();
  const [fait, setFait] = useState<readonly string[]>([]);
  const [onglet, setOnglet] = useState<OngletATraiter>("tous");
  const [post, setPost] = useState("");
  const [rang, setRang] = useState(0);
  const [masquesVus, setMasquesVus] = useState(false);
  const restantes = vue.cartes.filter((c) => !fait.includes(c.idEvenement));
  const triees = trierPourEcran(restantes);
  const nombres = compterParOnglet(triees);
  const dansOnglet = filtrerParOnglet(triees, onglet);
  const postsListe = [...new Set(dansOnglet.map(clePost))];
  const postChoisi = postsListe.includes(post) ? post : "";
  const visibles = postChoisi ? dansOnglet.filter((c) => clePost(c) === postChoisi) : dansOnglet;
  const masquees = filtrerParOnglet(masqueesPourEcran(restantes), onglet);
  // Compteurs : cartes encore à traiter + cartes déjà traitées (sinon « répondus » serait toujours 0).
  const idsVue = new Set(vue.cartes.map((c) => c.idEvenement));
  const anciennes = (dejaTraitees ?? [])
    .filter((d) => !idsVue.has(d.idEvenement))
    .map((d) => ({ idEvenement: d.idEvenement, reseau: d.reseau, post: d.post, lienPost: null, mot: null, motif: "mot_manuel" as const, extrait: d.extrait, creeLe: d.creeLe, statut: d.statut, kit: null, ...(d.faitLe ? { faitLe: d.faitLe } : {}) }));
  const pourCompteurs: TypeCarte[] = [...vue.cartes, ...anciennes].map((c) => (fait.includes(c.idEvenement) ? { ...c, statut: "fait" as const } : c));
  // Une seule table de noms de posts, calculée sur une source stable : la même pour le filtre et les compteurs.
  const noms = etiquettesPosts(pourCompteurs);

  const carte = visibles.length ? visibles[rang % visibles.length] : undefined;
  const manuel = carte?.reseau === "linkedin" || carte?.reseau === "tiktok";
  const tiktok = carte?.reseau === "tiktok";
  const lienReseau = carte && manuel ? lienCommentaireSur(carte.reseau, carte.lienPost) : null;
  const agir = (f: () => Promise<ResultatChangement>) =>
    demarrer(async () => {
      if (!carte) return;
      const r = await f();
      if (r.issue === "refuse") notifier.erreur("Ça n’a pas marché. Réessayez.");
      else {
        if (r.issue === "simule") notifier.essai("rien n’a été envoyé.");
        else notifier.succes("C’est fait.");
        setFait((l) => [...l, carte.idEvenement]);
        onChange?.();
      }
    });
  useEffect(() => {
    const ecoute = (e: KeyboardEvent) => {
      const a = actionClavier(e as unknown as Parameters<typeof actionClavier>[0]);
      const d = decisionClavier(a, { carte, enCours, etat: vue.etat });
      if (d === "suivante") {
        e.preventDefault();
        setRang((r) => r + 1);
      } else if (d === "fait" && carte) {
        e.preventDefault();
        agir(() => services.fait(carte.idEvenement));
      }
    };
    window.addEventListener("keydown", ecoute);
    return () => window.removeEventListener("keydown", ecoute);
  });
  if (vue.etat === "desactive") return <EtatVide compact icone="envoyer" titre="Désactivé" phrase="Cet écran est éteint pour le moment." />;
  if (vue.etat === "illisible") return <EtatVide compact icone="envoyer" titre="Source non lisible" phrase="Nous n’arrivons pas à lire la liste. Réessayez plus tard." />;
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(carte?.kit ?? "");
      notifier.succes("Réponse copiée.");
    } catch {
      notifier.erreur("Copie impossible. Sélectionnez le texte à la main.");
    }
  };

  return (
    <div className="flex flex-col gap-4" data-ecran="a-traiter">
      <div role="tablist" aria-label="Réseaux" className="flex flex-wrap gap-2">
        {ONGLETS_A_TRAITER.map((o) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            id={`onglet-a-traiter-${o.id}`}
            aria-selected={onglet === o.id}
            aria-controls="panneau-a-traiter"
            className={`min-h-11 rounded-full border px-4 text-sm ${onglet === o.id ? "border-texte bg-texte font-semibold text-fond" : "border-surface-3 bg-surface-3 text-texte-doux"}`}
            onClick={() => { setOnglet(o.id); setPost(""); setRang(0); }}
          >
            {o.libelle} ({nombres[o.id]})
          </button>
        ))}
      </div>
      {postsListe.length > 0 ? (
        <label className="flex flex-wrap items-center gap-2 text-sm text-texte-doux">
          Post
          <select
            className="min-h-11 max-w-full rounded-lg border border-surface-3 bg-surface-3 px-3 text-texte"
            value={postChoisi ? String(postsListe.indexOf(postChoisi)) : ""}
            onChange={(e) => { setPost(postsListe[Number(e.target.value)] ?? ""); setRang(0); }}
          >
            <option value="">Tous les posts</option>
            {postsListe.map((k, i) => (
              <option key={k} value={String(i)}>{onglet === "tous" ? `${LIBELLE_RESEAU_A_TRAITER[k.split("|")[0] as keyof typeof LIBELLE_RESEAU_A_TRAITER]} · ` : ""}{noms.get(k)}</option>
            ))}
          </select>
        </label>
      ) : null}
      <CompteursATraiter cartes={pourCompteurs} onglet={onglet} noms={noms} />
      <p className="text-sm text-texte-doux" data-restantes>{visibles.length} à traiter</p>
      <div role="tabpanel" id="panneau-a-traiter" aria-labelledby={`onglet-a-traiter-${onglet}`} className="flex flex-col gap-4">
      {!carte ? (
        <EtatVide compact icone="envoyer" titre="Rien à traiter" phrase={restantes.length ? "Aucun commentaire à traiter pour ce réseau." : "Les commentaires à traiter à la main arrivent ici."} />
      ) : (
      <>
      <CarteATraiter carte={carte} />
      {carte.opposee ? (
        <div className="flex flex-wrap gap-2" data-actions="opposee">
          <Bouton variante="fantome" disabled={enCours} onClick={() => agir(() => services.ignorer(carte.idEvenement))}>Classer la carte</Bouton>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Bouton variante="secondaire" disabled={!carte.kit || (tiktok && !copiePossible("tiktok", carte.kit))} onClick={copier}>Copier la réponse</Bouton>
          {lienReseau ? (
            <Bouton variante="secondaire" asChild>
              <a href={lienReseau} target="_blank" rel="noopener noreferrer">Ouvrir sur le réseau</a>
            </Bouton>
          ) : !manuel && carte.lienPost ? (
            <Bouton variante="secondaire" asChild>
              <a href={carte.lienPost} target="_blank" rel="noopener noreferrer">Ouvrir le post</a>
            </Bouton>
          ) : null}
          {tiktok && carte.kit && !copiePossible("tiktok", carte.kit) ? <p className="basis-full text-sm text-texte-doux" data-copie-impossible>TikTok : réponse trop longue ou avec un @, écrivez-la vous-même.</p> : null}
          <Bouton disabled={enCours} onClick={() => agir(() => services.fait(carte.idEvenement))}>Fait</Bouton>
          <Bouton variante="fantome" disabled={enCours} onClick={() => agir(() => services.ignorer(carte.idEvenement))}>Ignorer</Bouton>
          <Bouton variante="danger" disabled={enCours} onClick={() => agir(() => services.stop(carte.idEvenement, compte))}>STOP</Bouton>
        </div>
      )}
      </>
      )}
      </div>
      {masquees.length > 0 ? (
        <div className="flex flex-col gap-2" data-masques>
          <Bouton variante="fantome" onClick={() => setMasquesVus((v) => !v)}>
            {masquesVus ? "Cacher les messages masqués" : `Voir les messages masqués (${masquees.length})`}
          </Bouton>
          {masquesVus ? (
            <ul className="flex flex-col gap-2 rounded-lg border border-surface-3 p-3">
              {masquees.map((c) => (
                <li key={c.idEvenement} className="break-words text-sm text-texte-doux">
                  <span className="font-semibold">{LIBELLE_RESEAU_A_TRAITER[c.reseau]}</span> · masqué, lecture seule
                  <br />
                  {extraitLisible(c.extrait)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {dejaTraitees ? <DejaTraitees cartes={filtrerParOnglet(dejaTraitees, onglet)} /> : null}
    </div>
  );
}

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
/** Date lisible ; une date mal formée ne doit jamais faire tomber la page. */
function dateLisible(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : DATE.format(d);
}

/** Bloc replié, lecture seule : rien n'est supprimé ni renvoyé. */
function DejaTraitees({ cartes }: { cartes: readonly CarteDejaTraiteeDatee[] }) {
  return (
    <details className="rounded-lg border border-surface-3 p-3" data-deja-traitees>
      <summary className="cursor-pointer text-sm font-semibold">Déjà traitées ({cartes.length})</summary>
      <ul className="mt-2 flex flex-col gap-2">
        {cartes.map((c) => (
          <li key={c.idEvenement} className="break-words text-sm text-texte-doux">
            <span className="font-semibold">{LIBELLE_RESEAU_A_TRAITER[c.reseau]}</span> · {c.statut === "fait" ? libelleFait(c.faitLe) : "Ignorée"} · reçue le {dateLisible(c.creeLe)}
            <br />
            {extraitLisible(c.extrait)}
          </li>
        ))}
      </ul>
    </details>
  );
}
