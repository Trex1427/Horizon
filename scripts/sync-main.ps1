Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Fail {
    param([string]$Message)
    Write-Error $Message
    exit 1
}

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args,
        [string]$ErrorMessage = "La commande Git a echoue."
    )

    & git @Args
    if ($LASTEXITCODE -ne 0) {
        Fail "$ErrorMessage (git $($Args -join ' '))"
    }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Fail "Git est introuvable. Installez Git et verifiez qu'il est dans le PATH."
}

# Verification du depot Git
$insideRepo = & git rev-parse --is-inside-work-tree 2>$null
if ($LASTEXITCODE -ne 0 -or "$insideRepo".Trim() -ne 'true') {
    Fail "Le repertoire courant n'est pas un depot Git valide."
}

# Verification du working tree
$workingTreeState = (& git status --porcelain)
if ($LASTEXITCODE -ne 0) {
    Fail "Impossible de verifier l'etat du working tree."
}

if (-not [string]::IsNullOrWhiteSpace(($workingTreeState | Out-String))) {
    Fail "Le working tree n'est pas propre. Committez ou stashez vos changements avant de synchroniser main."
}

# Memorise la branche initiale
$previousBranch = (& git branch --show-current 2>$null)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace("$previousBranch")) {
    Fail "Impossible de determiner la branche courante avant synchronisation."
}
$previousBranch = "$previousBranch".Trim()

Invoke-Git -Args @('switch', 'main') -ErrorMessage "Impossible de basculer sur main."
Invoke-Git -Args @('fetch', 'origin') -ErrorMessage "Impossible de recuperer les references depuis origin."
Invoke-Git -Args @('pull', '--ff-only', 'origin', 'main') -ErrorMessage "Impossible de mettre a jour main en fast-forward."

Write-Host "Dernier commit sur main :"
Invoke-Git -Args @('log', '-1', '--oneline') -ErrorMessage "Impossible d'afficher le dernier commit de main."

Write-Host "Etat Git actuel :"
Invoke-Git -Args @('status') -ErrorMessage "Impossible d'afficher git status."

if ($previousBranch -ne 'main') {
    Write-Host "Branche initiale memorisee : $previousBranch"
    Write-Host "Suppression optionnelle (non executee) de l'ancienne branche locale : git branch -d $previousBranch"
    Write-Host "Suppression optionnelle (non executee) de l'ancienne branche distante : git push origin --delete $previousBranch"
}
