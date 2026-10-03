param(
  [Parameter(Mandatory = $true)][string]$DatabaseUrl,
  [Parameter(Mandatory = $true)][string]$OutputFile
)
$resolvedParent = Resolve-Path -LiteralPath (Split-Path -Parent $OutputFile)
$target = Join-Path $resolvedParent (Split-Path -Leaf $OutputFile)
pg_dump --format=custom --no-owner --file=$target $DatabaseUrl
if ($LASTEXITCODE -ne 0) { throw "Sao lưu PostgreSQL thất bại." }
Write-Output "Đã tạo backup tại $target"
