param(
  [Parameter(Mandatory = $true)][string]$DatabaseUrl,
  [Parameter(Mandatory = $true)][string]$InputFile,
  [switch]$ConfirmRestore
)
if (-not $ConfirmRestore) { throw "Phải truyền -ConfirmRestore để xác nhận ghi dữ liệu vào database đích." }
$source = Resolve-Path -LiteralPath $InputFile
pg_restore --exit-on-error --no-owner --dbname=$DatabaseUrl $source
if ($LASTEXITCODE -ne 0) { throw "Khôi phục PostgreSQL thất bại." }
Write-Output "Khôi phục hoàn tất. Hãy đối chiếu ledger/balance và file trước khi mở traffic."
