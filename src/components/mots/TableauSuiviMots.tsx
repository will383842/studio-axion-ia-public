"use client";

// SUI-B — tableau du suivi chiffré par mot : une ligne par mot, choix de la fenêtre (7 jours / 30 jours / total).
// Présentation pure : tout arrive en propriété. Les chiffres du site absents s'écrivent « — », jamais 0.
import { useState } from "react";
import { chiffreOuTiret, compteAffiche, libelleGagnees, type Fen, type TableauSuivi } from "./suivi-affichage";

type Fenetre = keyof Fen;

const FENETRES: { cle: Fenetre; libelle: string }[] = [
  { cle: "j7", libelle: "7 jours" },
  { cle: "j30", libelle: "30 jours" },
  { cle: "total", libelle: "Total" },
];

const COLONNES = [
  "Commentaires",
  "Réponses publiques",
  "Premiers messages",
  "Formulaires",
  "E-mails envoyés",
  "Clics",
  "Personnes gagnées",
];

export function TableauSuiviMots({ suivi }: { suivi: TableauSuivi }) {
  const [fenetre, setFenetre] = useState<Fenetre>("j7");
  const valeur = (f: Fen | null) => (f === null ? chiffreOuTiret(null) : compteAffiche(f[fenetre]));
  return (
    <section aria-label="Suivi chiffré par mot">
      {!suivi.siteDisponible && (
        <p role="status">Chiffres du site indisponibles pour l&apos;instant</p>
      )}
      <div role="group" aria-label="Période affichée">
        {FENETRES.map((f) => (
          <button key={f.cle} type="button" aria-pressed={fenetre === f.cle} onClick={() => setFenetre(f.cle)}>
            {f.libelle}
          </button>
        ))}
      </div>
      <table>
        <caption>Suivi chiffré par mot</caption>
        <thead>
          <tr>
            <th scope="col">Mot</th>
            {COLONNES.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {suivi.lignes.map((l) => (
            <tr key={l.mot}>
              <th scope="row">{l.mot}</th>
              <td>{valeur(l.commentaires)}</td>
              <td>{valeur(l.reponsesPubliques)}</td>
              <td>{valeur(l.premiersMessages)}</td>
              <td>{valeur(suivi.siteDisponible ? l.formulaires : null)}</td>
              <td>{valeur(suivi.siteDisponible ? l.envoisEmail : null)}</td>
              <td>{valeur(suivi.siteDisponible ? l.clics : null)}</td>
              <td>{libelleGagnees(l.instagram.gagnees[fenetre])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {suivi.lignes.map((l) => (
        <details key={l.mot}>
          <summary>Détail du mot {l.mot}</summary>
          <h4>Par publication</h4>
          <ul>
            {l.parPublication.map((p) => (
              <li key={`${p.reseau}-${p.post}`}>
                {p.reseau} · {p.post} : {p.commentaires} commentaires, {p.premiersMessages} premiers messages,{" "}
                {chiffreOuTiret(suivi.siteDisponible ? p.formulaires : null)} formulaires,{" "}
                {chiffreOuTiret(suivi.siteDisponible ? p.clics : null)} clics, {libelleGagnees(p.auMoinsGagnees)}
              </li>
            ))}
          </ul>
          <h4>Par formulation</h4>
          <ul>
            {l.formulations.map((f) => (
              <li key={f.version}>
                {f.version} : {f.envois} envois, {chiffreOuTiret(suivi.siteDisponible ? f.clics : null)} clics
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  );
}
