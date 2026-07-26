package com.chaslay.pos.ui.menu

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.R
import com.chaslay.pos.data.menuimport.MenuImportMode
import com.chaslay.pos.data.menuimport.ParsedMenuFile

@Composable
fun MenuImportSection(
    importMode: MenuImportMode,
    importPreview: ParsedMenuFile?,
    isImporting: Boolean,
    onModeChange: (MenuImportMode) -> Unit,
    onPickFile: (Uri) -> Unit,
    onConfirmImport: () -> Unit,
    onDismissPreview: () -> Unit,
    onExportTemplate: (Uri) -> Unit
) {
    val pickFileLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri -> uri?.let(onPickFile) }

    val saveTemplateLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    ) { uri -> uri?.let(onExportTemplate) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(stringResource(R.string.menu_import_export), fontWeight = FontWeight.Bold, fontSize = 18.sp)
        Text(stringResource(R.string.menu_import_hint), color = Color.Gray, fontSize = 13.sp)

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(stringResource(R.string.menu_import_mode), fontWeight = FontWeight.SemiBold)
                ImportModeRow(
                    label = stringResource(R.string.menu_import_merge),
                    detail = stringResource(R.string.menu_import_merge_hint),
                    selected = importMode == MenuImportMode.MERGE,
                    onClick = { onModeChange(MenuImportMode.MERGE) }
                )
                ImportModeRow(
                    label = stringResource(R.string.menu_import_replace),
                    detail = stringResource(R.string.menu_import_replace_hint),
                    selected = importMode == MenuImportMode.REPLACE_ALL,
                    onClick = { onModeChange(MenuImportMode.REPLACE_ALL) }
                )
            }
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(stringResource(R.string.menu_excel_format), fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Text(stringResource(R.string.menu_excel_sheets_hint), fontSize = 12.sp, color = Color.Gray)
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedButton(
                        onClick = { saveTemplateLauncher.launch("chaslay_menu_template.xlsx") },
                        enabled = !isImporting
                    ) {
                        Text(stringResource(R.string.menu_download_template))
                    }
                    Button(
                        onClick = {
                            pickFileLauncher.launch(
                                arrayOf(
                                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                    "application/vnd.ms-excel"
                                )
                            )
                        },
                        enabled = !isImporting
                    ) {
                        Text(stringResource(R.string.menu_import_excel))
                    }
                }
                if (isImporting) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        CircularProgressIndicator(modifier = Modifier.padding(4.dp))
                        Text(stringResource(R.string.menu_importing))
                    }
                }
            }
        }
    }

    importPreview?.let { preview ->
        AlertDialog(
            onDismissRequest = onDismissPreview,
            title = { Text(stringResource(R.string.menu_import_preview)) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("${stringResource(R.string.categories)}: ${preview.categories.size}")
                    Text("${stringResource(R.string.products)}: ${preview.products.size}")
                    if (preview.warnings.isNotEmpty()) {
                        Text(stringResource(R.string.menu_import_warnings), fontWeight = FontWeight.SemiBold)
                        preview.warnings.take(8).forEach { warning ->
                            Text("� $warning", fontSize = 12.sp, color = Color(0xFFB45309))
                        }
                        if (preview.warnings.size > 8) {
                            Text("+ ${preview.warnings.size - 8} more", fontSize = 12.sp, color = Color.Gray)
                        }
                    }
                    if (importMode == MenuImportMode.REPLACE_ALL) {
                        Text(
                            stringResource(R.string.menu_import_replace_warning),
                            color = Color(0xFFDC2626),
                            fontSize = 12.sp
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = onConfirmImport,
                    enabled = !isImporting && (preview.categories.isNotEmpty() || preview.products.isNotEmpty())
                ) {
                    Text(stringResource(R.string.menu_import_confirm))
                }
            },
            dismissButton = {
                TextButton(onClick = onDismissPreview) {
                    Text(stringResource(R.string.cancel))
                }
            }
        )
    }
}

@Composable
private fun ImportModeRow(
    label: String,
    detail: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Top
    ) {
        RadioButton(selected = selected, onClick = onClick)
        Column(modifier = Modifier.padding(top = 12.dp)) {
            Text(label, fontWeight = FontWeight.SemiBold)
            Text(detail, fontSize = 12.sp, color = Color.Gray)
        }
    }
}
