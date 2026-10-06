$ErrorActionPreference = "Stop"

$projectRef = "zbopnlzsqlmxlrknyugu"
$secureToken = Read-Host "Telegram Bot Token" -AsSecureString
$tokenPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)

try {
    $telegramToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPtr)
    $cronSecret = ([Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N"))

    npx supabase secrets set `
        "TELEGRAM_BOT_TOKEN=$telegramToken" `
        "CRON_SECRET=$cronSecret" `
        "DAISO_API_BASE_URL=https://mcp.aka.page" `
        --project-ref $projectRef

    if ($LASTEXITCODE -ne 0) { throw "Supabase Edge Function secret 설정 실패" }

    $escapedSecret = $cronSecret.Replace("'", "''")
    $sql = "select vault.create_secret('$escapedSecret', 'gs25_cron_secret', 'GS25 stock check cron authentication');"
    npx supabase db query --linked $sql

    if ($LASTEXITCODE -ne 0) { throw "Supabase Vault secret 설정 실패" }
    Write-Host "Secrets configured. Telegram token was not written to disk."
}
finally {
    if ($tokenPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPtr)
    }
    $telegramToken = $null
}
