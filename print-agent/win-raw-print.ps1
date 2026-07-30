param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,

    [string]$PrinterName = ""
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $FilePath)) {
    throw "Print file not found: $FilePath"
}

if ([string]::IsNullOrWhiteSpace($PrinterName)) {
    $default = Get-CimInstance -ClassName Win32_Printer -Filter "Default='True'" -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $default) {
        throw "No default printer configured in Windows."
    }
    $PrinterName = $default.Name
}

$bytes = [System.IO.File]::ReadAllBytes($FilePath)

$csharp = @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DOCINFO {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFO di);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);
}
"@

Add-Type -TypeDefinition $csharp -ErrorAction Stop

function Send-RawToPrinter {
    param(
        [string]$Printer,
        [byte[]]$Data
    )

    $docInfo = New-Object RawPrinterHelper+DOCINFO
    $docInfo.pDocName = "ManuPOS Receipt"
    $docInfo.pDataType = "RAW"

    $handle = [IntPtr]::Zero
    if (-not [RawPrinterHelper]::OpenPrinter($Printer, [ref]$handle, [IntPtr]::Zero)) {
        throw "OpenPrinter failed for '$Printer'."
    }

    try {
        if (-not [RawPrinterHelper]::StartDocPrinter($handle, 1, [ref]$docInfo)) {
            throw "StartDocPrinter failed for '$Printer'."
        }
        try {
            if (-not [RawPrinterHelper]::StartPagePrinter($handle)) {
                throw "StartPagePrinter failed for '$Printer'."
            }
            $written = 0
            if (-not [RawPrinterHelper]::WritePrinter($handle, $Data, $Data.Length, [ref]$written)) {
                throw "WritePrinter failed for '$Printer'."
            }
            [RawPrinterHelper]::EndPagePrinter($handle) | Out-Null
        }
        finally {
            [RawPrinterHelper]::EndDocPrinter($handle) | Out-Null
        }
    }
    finally {
        [RawPrinterHelper]::ClosePrinter($handle) | Out-Null
    }
}

Send-RawToPrinter -Printer $PrinterName -Data $bytes
Write-Output $PrinterName
