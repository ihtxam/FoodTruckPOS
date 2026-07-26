package com.chaslay.pos.ui.menu

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.R
import com.chaslay.pos.data.local.entity.CategoryEntity
import com.chaslay.pos.data.local.entity.ProductEntity
import com.chaslay.pos.data.repository.MenuRepository
import com.chaslay.pos.ui.theme.categoryColor
import kotlinx.coroutines.launch

private data class ComboSlotDraftUi(
    val name: String,
    val minPick: String,
    val maxPick: String,
    val selectedProductIds: MutableList<Long>
)

@Composable
fun CombosSection(
    combos: List<ProductEntity>,
    categories: List<CategoryEntity>,
    viewModel: MenuViewModel,
    onRefresh: suspend () -> Unit = {}
) {
    var showDialog by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<ProductEntity?>(null) }
    val scope = rememberCoroutineScope()

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { editing = null; showDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = null)
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .padding(16.dp)
        ) {
            Text(stringResource(R.string.combos), fontWeight = FontWeight.Bold, fontSize = 18.sp)
            Text(stringResource(R.string.combos_hint), color = Color.Gray, fontSize = 12.sp, modifier = Modifier.padding(bottom = 12.dp))
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(combos, key = { it.id }) { combo ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(combo.name, fontWeight = FontWeight.SemiBold)
                                Text(
                                    "${combo.price} � ${categories.find { it.id == combo.categoryId }?.name ?: "�"}",
                                    fontSize = 12.sp,
                                    color = Color.Gray
                                )
                            }
                            TextButton(onClick = { editing = combo; showDialog = true }) {
                                Text(stringResource(R.string.edit))
                            }
                            IconButton(onClick = {
                                viewModel.deleteCombo(combo.id) {
                                    scope.launch { onRefresh() }
                                }
                            }) {
                                Icon(Icons.Default.Delete, contentDescription = null)
                            }
                        }
                    }
                }
            }
        }
    }

    if (showDialog) {
        ComboEditDialog(
            combo = editing,
            categories = categories,
            viewModel = viewModel,
            onDismiss = { showDialog = false },
            onSaved = {
                scope.launch { onRefresh() }
                showDialog = false
            }
        )
    }
}

@Composable
private fun ComboEditDialog(
    combo: ProductEntity?,
    categories: List<CategoryEntity>,
    viewModel: MenuViewModel,
    onDismiss: () -> Unit,
    onSaved: () -> Unit
) {
    var name by remember(combo) { mutableStateOf(combo?.name ?: "") }
    var price by remember(combo) { mutableStateOf(combo?.price?.toString() ?: "") }
    var tax by remember(combo) { mutableStateOf(combo?.taxRate?.toString() ?: "2.6") }
    var selectedCategoryId by remember(combo) { mutableStateOf(combo?.categoryId ?: categories.firstOrNull()?.id) }
    val slots = remember(combo) { mutableStateListOf<ComboSlotDraftUi>() }
    var catalogProducts by remember { mutableStateOf<List<ProductEntity>>(emptyList()) }

    LaunchedEffect(combo?.id) {
        catalogProducts = viewModel.getCatalogProductsForCombos()
        slots.clear()
        if (combo != null && combo.id > 0) {
            val meal = viewModel.loadComboMeal(combo.id)
            meal?.slots?.forEach { slot ->
                slots.add(
                    ComboSlotDraftUi(
                        name = slot.name,
                        minPick = slot.minPick.toString(),
                        maxPick = slot.maxPick.toString(),
                        selectedProductIds = slot.options.map { it.productId }.toMutableList()
                    )
                )
            }
        }
        if (slots.isEmpty()) {
            slots.addAll(defaultComboSlots())
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (combo == null) stringResource(R.string.add_combo) else stringResource(R.string.edit_combo)) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text(stringResource(R.string.combo_name)) }, singleLine = true)
                OutlinedTextField(
                    value = price,
                    onValueChange = { price = it },
                    label = { Text(stringResource(R.string.combo_fixed_price)) },
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true
                )
                OutlinedTextField(
                    value = tax,
                    onValueChange = { tax = it },
                    label = { Text(stringResource(R.string.tax_rate)) },
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true
                )
                Text(stringResource(R.string.category), fontWeight = FontWeight.SemiBold)
                categories.forEach { category ->
                    val selected = selectedCategoryId == category.id
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 2.dp)
                            .clickable { selectedCategoryId = category.id },
                        colors = androidx.compose.material3.CardDefaults.cardColors(
                            containerColor = if (selected) categoryColor(category.colorHex).copy(alpha = 0.35f) else Color.LightGray.copy(alpha = 0.15f)
                        )
                    ) {
                        Text(category.name, modifier = Modifier.padding(12.dp))
                    }
                }
                Text(stringResource(R.string.combo_slots), fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 8.dp))
                slots.forEachIndexed { index, slot ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                            OutlinedTextField(
                                value = slot.name,
                                onValueChange = { slots[index] = slot.copy(name = it) },
                                modifier = Modifier.weight(1f),
                                label = { Text(stringResource(R.string.slot_name)) },
                                singleLine = true
                            )
                            IconButton(onClick = { if (slots.size > 1) slots.removeAt(index) }) {
                                Icon(Icons.Default.Delete, contentDescription = null)
                            }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            OutlinedTextField(
                                value = slot.minPick,
                                onValueChange = { slots[index] = slot.copy(minPick = it) },
                                modifier = Modifier.weight(1f),
                                label = { Text(stringResource(R.string.min_pick)) },
                                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Number),
                                singleLine = true
                            )
                            OutlinedTextField(
                                value = slot.maxPick,
                                onValueChange = { slots[index] = slot.copy(maxPick = it) },
                                modifier = Modifier.weight(1f),
                                label = { Text(stringResource(R.string.max_pick)) },
                                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Number),
                                singleLine = true
                            )
                        }
                        catalogProducts.filter { !it.isCombo }.forEach { product ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(
                                    checked = product.id in slot.selectedProductIds,
                                    onCheckedChange = { checked ->
                                        if (checked) slot.selectedProductIds.add(product.id)
                                        else slot.selectedProductIds.remove(product.id)
                                    }
                                )
                                Text(product.name, fontSize = 13.sp)
                            }
                        }
                    }
                }
                TextButton(onClick = {
                    slots.add(ComboSlotDraftUi("New slot", "1", "1", mutableListOf()))
                }) {
                    Text("+ ${stringResource(R.string.add_slot)}")
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                val drafts = slots.mapNotNull { slot ->
                    val slotName = slot.name.trim()
                    if (slotName.isBlank()) return@mapNotNull null
                    MenuRepository.ComboSlotDraft(
                        name = slotName,
                        minPick = slot.minPick.toIntOrNull()?.coerceAtLeast(0) ?: 0,
                        maxPick = slot.maxPick.toIntOrNull()?.coerceAtLeast(1) ?: 1,
                        productIds = slot.selectedProductIds.distinct()
                    )
                }
                viewModel.saveCombo(
                    name = name.trim(),
                    price = price.toDoubleOrNull() ?: 0.0,
                    taxRate = tax.toDoubleOrNull() ?: 2.6,
                    categoryId = selectedCategoryId,
                    slots = drafts,
                    productId = combo?.id ?: 0L,
                    onDone = onSaved
                )
            }) { Text(stringResource(R.string.save)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } }
    )
}

private fun defaultComboSlots(): List<ComboSlotDraftUi> = listOf(
    ComboSlotDraftUi("Starter", "1", "1", mutableListOf()),
    ComboSlotDraftUi("Main", "1", "1", mutableListOf()),
    ComboSlotDraftUi("Extras", "0", "2", mutableListOf()),
    ComboSlotDraftUi("Drinks", "1", "1", mutableListOf()),
    ComboSlotDraftUi("Dessert", "0", "1", mutableListOf())
)
