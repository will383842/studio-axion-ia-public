"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cocherAvantDePublierAction, envoyerVersBufferAction, modifierTexteKitAction } from "@/app/(studio)/videos/actions";
import { programmerSujetAction } from "@/app/(studio)/mesures/actions";
import { Bouton } from "@/components/ui/Bouton";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { Pastille } from "@/components/ui/Pastille";
import { PastilleEssai } from "@/components/ui/PastilleEssai";
import { notifier } from "@/components/ui/Toast";
import { libelleComptes } from "@/domaine/comptes-envoi";
import type { LigneAPublier, VueAPublier } from "@/services/a-publier";

/** Valeur d'un <input type="datetime-local"> (heure locale). */
function versLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function demainNeufHeures(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

const LIBELLES_CASES: Record<string, string> = { image: "Image", son: "Son", sousTitres: "Sous-titres", mentionIA: "Mention IA", droits: "Droits" };

export function LignesAPublier({ vue }: { vue: VueAPublier }) {
  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 rounded-2xl border border-trait bg-surface-2 px-3 py-2.5 text-sm text-texte-doux">
        {vue.envoiSimule ? (
          <>
            <PastilleEssai /> Essai : rien ne part vers Buffer tant que la publication n&apos;est pas reliée.
          </>
        ) : vue.modeBuffer === "programmer" ? (
          "Les envois sont programmés dans Buffer à la date choisie."
        ) : (
          "Brouillon dans Buffer : rien ne part tant que vous ne l'avez pas programmé dans Buffer."
        )}
      </p>
      <ul className="space-y-4">
        {vue.lignes.map((l) => (
          <LigneCarte key={l.cle} ligne={l} envoiSimule={vue.envoiSimule} modeBuffer={vue.modeBuffer} />
        ))}
      </ul>
    </div>
  );
}

function LigneCarte({ ligne: l, envoiSimule, modeBuffer }: { ligne: LigneAPublier; envoiSimule: boolean; modeBuffer: VueAPublier["modeBuffer"] }) {
  const router = useRouter();
  const [texte, setTexte] = useState(l.texte);
  const [commentaire, setCommentaire] = useState(l.premierCommentaire ?? "");
  const [coches, setCoches] = useState<Record<string, boolean>>(l.coches);
  const [date, setDate] = useState(() => versLocal(demainNeufHeures()));
  const [comptes, setComptes] = useState<string[]>(l.compte.memorises ?? []);
  const [enCours, demarrer] = useTransition();
  const manque = l.casesRequises.filter((c) => !coches[c]);
  const avecChoix = !!l.compte.choix?.length;
  const raison = l.blocage ?? l.compte.probleme ?? (avecChoix && !comptes.length ? "Cochez le compte où envoyer." : undefined) ?? (manque.length ? `Avant de publier : ${manque.map((c) => LIBELLES_CASES[c]).join(", ")}.` : undefined) ?? (l.etat?.envoye ? "Déjà envoyée pour ce réseau." : undefined);
  const peutEnvoyer = !raison && !envoiSimule;
  const modifie = texte !== l.texte;

  function cocher(cle: string, v: boolean) {
    setCoches((c) => ({ ...c, [cle]: v }));
    demarrer(async () => {
      const r = await cocherAvantDePublierAction(l.videoId, cle as "image", v);
      if (!r.ok) {
        setCoches((c) => ({ ...c, [cle]: !v }));
        notifier.erreur(r.message);
      }
    });
  }

  function enregistrerTexte() {
    demarrer(async () => {
      const r = await modifierTexteKitAction(l.videoId, l.reseau, texte, l.motsDiese, l.titreReseau);
      if (!r.ok) notifier.erreur(r.message);
      else {
        notifier.succes("Texte enregistré");
        router.refresh();
      }
    });
  }

  function brouillon() {
    demarrer(async () => {
      const iso = new Date(date).toISOString();
      const r = await envoyerVersBufferAction(l.videoId, [l.reseau], iso, false, avecChoix ? { [l.reseau]: comptes } : {}, commentaire.trim() ? { [l.reseau]: commentaire } : {});
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      const n = r.donnees.nombre;
      if (n && r.donnees.mode === "brouillon") notifier.succes(`Brouillon dans Buffer · ${libelleComptes(n)}`, "Relisez et programmez dans Buffer.");
      else if (n) notifier.succes(`Programmée sur ${libelleComptes(n)}`);
      if (r.donnees.problemes.length) notifier.erreur(r.donnees.problemes[0]);
      if (r.donnees.commentairesALaMain.length) notifier.erreur("Le premier commentaire n'est pas transmis à ce réseau : posez-le à la main.");
      router.refresh();
    });
  }

  function programmer() {
    if (!l.sujetId) return;
    demarrer(async () => {
      const r = await programmerSujetAction(l.sujetId!);
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      const { programmees, ignorees, modeBuffer } = r.donnees;
      if (programmees.length) notifier.succes(modeBuffer === "brouillon" ? `Brouillon dans Buffer · ${libelleComptes(programmees.length)}` : `Programmée sur ${libelleComptes(programmees.length)}`);
      if (ignorees.length) notifier.erreur(ignorees[0].message);
      router.refresh();
    });
  }

  return (
    <li className="rounded-carte border border-trait bg-surface-1 p-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="w-full shrink-0 sm:w-40">
          {l.lecture ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption -- aperçu de la vidéo à publier : les sous-titres sont dans l'image
            <video controls preload="none" poster={l.jaquette ?? undefined} src={l.lecture} className="aspect-[9/16] w-full rounded-xl bg-surface-2 object-cover" />
          ) : (
            <div className="grid aspect-[9/16] w-full place-items-center rounded-xl bg-surface-2 text-xs text-texte-faible">Pas de fichier</div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <LogoReseau reseau={l.reseau} taille="sm" />
            <Link href={`/videos/${l.videoId}`} className="min-w-0 truncate text-sm font-semibold text-texte hover:underline">
              {l.titre}
            </Link>
            <span className="text-xs text-texte-faible">· {l.reseauNom}</span>
            {l.etat && <Pastille ton={l.etat.ton}>{l.etat.libelle}</Pastille>}
            {l.etat?.lien && (
              <a href={l.etat.lien} target="_blank" rel="noreferrer" className="text-sm font-semibold text-orange-vif">
                Voir la publication
              </a>
            )}
          </div>
          {l.etat?.detail && <p className="text-sm text-texte-doux">{l.etat.detail}</p>}

          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-1 text-xs font-semibold text-texte-doux">Avant de publier</legend>
            {l.casesRequises.map((c) => (
              <label key={c} className="flex min-h-11 items-center gap-2 rounded-full border border-trait px-3 text-sm">
                <input type="checkbox" checked={!!coches[c]} disabled={enCours} onChange={(e) => cocher(c, e.target.checked)} />
                {LIBELLES_CASES[c]}
              </label>
            ))}
          </fieldset>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-texte-doux">Phrase du post</span>
            <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={4} className="w-full rounded-champ border border-trait bg-surface-1 p-3 text-sm text-texte outline-none focus:border-orange" />
          </label>
          {modifie && (
            <Bouton variante="secondaire" icone="coche" chargement={enCours} onClick={enregistrerTexte}>
              Enregistrer le texte
            </Bouton>
          )}
          {l.motsDiese.length > 0 && <p className="text-xs text-texte-faible">{l.motsDiese.join(" ")}</p>}

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-texte-doux">Premier commentaire</span>
            <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={2} className="w-full rounded-champ border border-trait bg-surface-1 p-3 text-sm text-texte outline-none focus:border-orange" />
          </label>
          {commentaire.trim() && !l.commentaireTransmissible && <p className="text-sm text-texte-doux">{l.reseauNom} ne reçoit pas le premier commentaire par Buffer : rien ne sera envoyé, posez-le à la main.</p>}

          <div className="space-y-1 text-sm">
            <span className="block text-xs font-semibold text-texte-doux">Compte Buffer</span>
            {l.compte.nom && <span className="text-texte">{l.compte.nom}</span>}
            {l.compte.probleme && <span className="text-texte-doux">{l.compte.probleme}</span>}
            {avecChoix && (
              <div className="flex flex-wrap gap-2">
                {l.compte.choix!.map((c) => (
                  <label key={c.id} className="flex min-h-11 items-center gap-2 rounded-full border border-trait px-3">
                    <input type="checkbox" checked={comptes.includes(c.id)} onChange={(e) => setComptes((x) => (e.target.checked ? [...x, c.id] : x.filter((i) => i !== c.id)))} />
                    {c.nom}
                  </label>
                ))}
              </div>
            )}
            {!l.compte.nom && !l.compte.probleme && !avecChoix && <span className="text-texte-faible">Lu au premier envoi.</span>}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-texte-doux">Date</span>
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="min-h-12 rounded-champ border border-trait bg-surface-1 px-3.5 text-[15px] text-texte outline-none [color-scheme:light] focus:border-orange" />
          </label>

          <div className="flex flex-wrap gap-2">
            <Bouton icone="envoyer" disabled={!peutEnvoyer} chargement={enCours} onClick={brouillon}>
              {modeBuffer === "programmer" ? "Programmer dans Buffer" : "Mettre en brouillon dans Buffer"}
            </Bouton>
            <Bouton variante="secondaire" icone="calendrier" disabled={!peutEnvoyer || !l.sujetId} chargement={enCours} onClick={programmer}>
              Programmer
            </Bouton>
          </div>
          {raison && <p className="text-sm text-texte-doux">{raison}</p>}
          {envoiSimule && <p className="text-sm text-texte-doux">Essai : aucun envoi tant que Buffer n&apos;est pas relié.</p>}
          {!l.sujetId && <p className="text-xs text-texte-faible">« Programmer » programme les versions d&apos;un sujet : cette vidéo n&apos;en vient pas, utilisez le brouillon.</p>}
          {l.sujetId && <p className="text-xs text-texte-faible">« Programmer » envoie toutes les versions prêtes du sujet, chacune à son créneau.</p>}
        </div>
      </div>
    </li>
  );
}
