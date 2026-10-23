# Voix de synthèse de Windows (Hortense, fr-FR) pour les preuves LOCALES du générateur (G6) : aucun service payant.
# Lit un texte (fichier UTF-8, déjà « dit » : prononciations appliquées), écrit un WAV 48 kHz mono et le début de
# chaque mot (événement SpeakProgress), comme `word_timestamps` de HeyGen. Même réglage que la démonstration M4.
# Usage : powershell -File outils/generateur/voix-windows.ps1 -Texte <fichier.txt> -Sortie <chemin sans extension>
param([Parameter(Mandatory = $true)][string]$Texte, [Parameter(Mandatory = $true)][string]$Sortie)

Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice("Microsoft Hortense Desktop")
$s.Rate = 3

$contenu = [System.IO.File]::ReadAllText($Texte, [System.Text.Encoding]::UTF8)
$mots = New-Object System.Collections.ArrayList
$s.add_SpeakProgress({ param($o, $e) [void]$mots.Add([pscustomobject]@{ mot = $e.Text; debutSec = [math]::Round($e.AudioPosition.TotalSeconds, 3) }) })

$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$s.SetOutputToWaveFile("$Sortie.16k.wav", $format)
$s.Speak($contenu)
$s.SetOutputToNull()
$s.Dispose()

& ffmpeg -y -loglevel error -i "$Sortie.16k.wav" -ar 48000 -ac 1 -c:a pcm_s16le "$Sortie.wav"
Remove-Item "$Sortie.16k.wav"
$json = $mots | ConvertTo-Json
[System.IO.File]::WriteAllText("$Sortie.debuts.json", $json, (New-Object System.Text.UTF8Encoding($false)))
