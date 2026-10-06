$ErrorActionPreference = "Stop"

$projectRef = "zbopnlzsqlmxlrknyugu"
$secureToken = Read-Host "Telegram Bot Token" -AsSecureString
$tokenPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)

try {
    $telegramToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPtr)
    npx supabase secrets set `
        "TELEGRAM_BOT_TOKEN=$telegramToken" `
        "DAISO_API_BASE_URL=https://mcp.aka.page" `
        --project-ref $projectRef

    if ($LASTEXITCODE -ne 0) { throw "Supabase Edge Function secret 설정 실패" }

    Write-Host "Telegram secret configured. The token was not written to disk."
}
finally {
    if ($tokenPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPtr)
    }
    $telegramToken = $null
}
