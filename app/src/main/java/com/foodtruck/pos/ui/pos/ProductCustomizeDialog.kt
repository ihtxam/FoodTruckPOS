package com.foodtruck.pos.ui.pos

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.foodtruck.pos.R
import com.foodtruck.pos.domain.model.AddonGroupModel
import com.foodtruck.pos.domain.model.ModifierGroupModel
import com.foodtruck.pos.domain.model.ProductCustomizeState
import com.foodtruck.pos.domain.model.SelectedAddon
import com.foodtruck.pos.domain.model.SelectedModifier
import java.util.Locale

data class CustomizedProductResult(
    val variantName: String?,
    val unitPrice: Double,
    val sku: String?,
    val quantity: Int,
    val modifiers: List<SelectedModifier>,
    val addons: List<SelectedAddon>,
    val notes: String?
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ProductCustomizeDialog(
    state: ProductCustomizeState,
    currencySymbol: String,
    onAdd: (CustomizedProductResult) -> Unit,
    onDismiss: () -> Unit
) {
    val product = state.product
    val basePrice = state.openPrice ?: product.price
    val editKey = state.editingItemId ?: "new-${product.id}"
    var selectedVariant by remember(editKey) {
        mutableStateOf(
            state.initialVariantName?.let { name -> product.variants.find { it.name == name } }
                ?: product.variants.firstOrNull()
        )
    }
    var itemQty by remember(editKey) { mutableIntStateOf(state.initialQuantity.coerceAtLeast(1)) }
    var userNotes by remember(editKey) { mutableStateOf("") }
    var showNotes by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val modifierQty = remember(editKey) {
        mutableStateMapOf<Long, Int>().apply {
            state.modifierGroups.filter { !it.isSingleSelect }.forEach { group ->
                group.options.forEach { opt ->
                    state.initialModifiers.find { it.name == opt.name }?.let { put(opt.id, it.quantity) }
                }
            }
        }
    }
    val addonQty = remember(editKey) {
        mutableStateMapOf<Long, Int>().apply {
            state.addonGroups.forEach { group ->
                group.options.forEach { opt ->
                    state.initialAddons.find { it.name == opt.name }?.let { put(opt.id, it.quantity) }
                }
            }
        }
    }
    val singleModifier = remember(editKey) {
        mutableStateMapOf<Long, Long>().apply {
            state.modifierGroups.filter { it.isSingleSelect }.forEach { group ->
                val match = state.initialModifiers.find { mod -> group.options.any { it.name == mod.name } }
                match?.let { mod ->
                    group.options.find { it.name == mod.name }?.let { opt -> put(group.id, opt.id) }
                }
            }
        }
    }
    val isEditing = state.editingItemId != null

    val unitBase = selectedVariant?.price ?: basePrice
    val addonTotal = state.addonGroups.sumOf { group ->
        group.options.sumOf { opt -> (addonQty[opt.id] ?: 0) * opt.price }
    }
    val lineTotal = (unitBase + addonTotal) * itemQty

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.94f)
                .fillMaxHeight(0.88f),
            color = Color(0xFF1E1E1E),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF2A2A2A))
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(product.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Text(
                            "$currencySymbol ${"%.2f".format(Locale.getDefault(), unitBase + addonTotal)}",
                            color = Color(0xFF4CAF50),
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = null, tint = Color(0xFFE57373))
                    }
                }

                Row(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        if (product.variants.isNotEmpty()) {
                            OptionGroupSection(
                                title = stringResource(R.string.specification),
                                subtitle = stringResource(R.string.choose_one)
                            ) {
                                product.variants.forEach { variant ->
                                    OptionChip(
                                        label = variant.name,
                                        priceLabel = "$currencySymbol ${"%.2f".format(Locale.getDefault(), variant.price)}",
                                        selected = selectedVariant?.id == variant.id,
                                        onClick = { selectedVariant = variant }
                                    )
                                }
                            }
                        }

                        state.modifierGroups.forEach { group ->
                            OptionGroupSection(
                                title = group.name,
                                subtitle = groupSubtitle(group)
                            ) {
                                group.options.filter { it.inStock }.forEach { option ->
                                    if (group.isSingleSelect) {
                                        OptionChip(
                                            label = option.name,
                                            selected = singleModifier[group.id] == option.id,
                                            onClick = {
                                                singleModifier[group.id] = option.id
                                                modifierQty.clear()
                                                modifierQty[option.id] = 1
                                            }
                                        )
                                    } else {
                                        QtyOptionChip(
                                            label = option.name,
                                            quantity = modifierQty[option.id] ?: 0,
                                            maxTotal = group.limitQuantity,
                                            currentTotal = group.options.sumOf { modifierQty[it.id] ?: 0 },
                                            onIncrement = {
                                                val total = group.options.sumOf { modifierQty[it.id] ?: 0 }
                                                if (total < group.limitQuantity) {
                                                    modifierQty[option.id] = (modifierQty[option.id] ?: 0) + 1
                                                }
                                            },
                                            onDecrement = {
                                                val q = (modifierQty[option.id] ?: 0) - 1
                                                if (q <= 0) modifierQty.remove(option.id) else modifierQty[option.id] = q
                                            }
                                        )
                                    }
                                }
                            }
                        }

                        state.addonGroups.forEach { group ->
                            OptionGroupSection(
                                title = group.name,
                                subtitle = addonGroupSubtitle(group)
                            ) {
                                group.options.filter { it.inStock }.forEach { option ->
                                    QtyOptionChip(
                                        label = option.name,
                                        priceLabel = "+$currencySymbol ${"%.2f".format(Locale.getDefault(), option.price)}",
                                        quantity = addonQty[option.id] ?: 0,
                                        maxTotal = group.limitQuantity,
                                        currentTotal = group.options.sumOf { addonQty[it.id] ?: 0 },
                                        allowRepeat = group.allowMultipleSame,
                                        onIncrement = {
                                            val total = group.options.sumOf { addonQty[it.id] ?: 0 }
                                            val current = addonQty[option.id] ?: 0
                                            if (group.allowMultipleSame || current == 0) {
                                                if (total < group.limitQuantity) {
                                                    addonQty[option.id] = current + 1
                                                }
                                            } else {
                                                addonQty.keys.filter { id ->
                                                    group.options.any { it.id == id }
                                                }.forEach { addonQty.remove(it) }
                                                addonQty[option.id] = 1
                                            }
                                        },
                                        onDecrement = {
                                            val q = (addonQty[option.id] ?: 0) - 1
                                            if (q <= 0) addonQty.remove(option.id) else addonQty[option.id] = q
                                        }
                                    )
                                }
                            }
                        }
                    }

                    Column(
                        modifier = Modifier
                            .width(68.dp)
                            .fillMaxHeight()
                            .background(Color(0xFF252525))
                            .padding(vertical = 16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        IconButton(
                            onClick = { itemQty++ },
                            modifier = Modifier.background(Color(0xFF00897B), RoundedCornerShape(8.dp))
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null, tint = Color.White)
                        }
                        Text(
                            itemQty.toString(),
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 26.sp,
                            modifier = Modifier.padding(vertical = 10.dp)
                        )
                        IconButton(
                            onClick = { if (itemQty > 1) itemQty-- },
                            modifier = Modifier.background(Color(0xFF424242), RoundedCornerShape(8.dp))
                        ) {
                            Icon(Icons.Default.Remove, contentDescription = null, tint = Color.White)
                        }
                    }
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF2A2A2A))
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    TextButton(
                        onClick = { showNotes = true },
                        modifier = Modifier.align(Alignment.Start)
                    ) {
                        Icon(Icons.Default.Edit, contentDescription = null, tint = Color(0xFF80CBC4))
                        Spacer(Modifier.width(6.dp))
                        Text(
                            if (userNotes.isBlank()) stringResource(R.string.add_notes) else stringResource(R.string.edit_notes),
                            color = Color(0xFF80CBC4),
                            fontSize = 13.sp
                        )
                    }

                    errorMessage?.let { msg ->
                        Text(msg, color = Color(0xFFE57373), fontSize = 12.sp)
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            stringResource(R.string.total_items, itemQty),
                            color = Color.Gray,
                            fontSize = 13.sp
                        )
                        Text(
                            "$currencySymbol ${"%.2f".format(Locale.getDefault(), lineTotal)}",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 22.sp
                        )
                    }

                    Button(
                        onClick = {
                            val validation = validateSelections(state, singleModifier, modifierQty, addonQty)
                            if (validation != null) {
                                errorMessage = validation
                                return@Button
                            }
                            errorMessage = null
                            val modifiers = buildModifiers(state.modifierGroups, singleModifier, modifierQty)
                            val addons = buildAddons(state.addonGroups, addonQty)
                            onAdd(
                                CustomizedProductResult(
                                    variantName = selectedVariant?.name,
                                    unitPrice = unitBase + addonTotal,
                                    sku = selectedVariant?.sku ?: product.sku,
                                    quantity = itemQty,
                                    modifiers = modifiers,
                                    addons = addons,
                                    notes = userNotes.trim().ifBlank { null }
                                )
                            )
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00897B)),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(
                            if (isEditing) {
                                stringResource(R.string.save).uppercase()
                            } else {
                                stringResource(R.string.add_to_cart).uppercase()
                            },
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                    }
                }
            }
        }
    }

    if (showNotes) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { showNotes = false },
            title = { Text(stringResource(R.string.item_notes)) },
            text = {
                OutlinedTextField(
                    value = userNotes,
                    onValueChange = { userNotes = it },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3
                )
            },
            confirmButton = {
                TextButton(onClick = { showNotes = false }) { Text(stringResource(R.string.save)) }
            }
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun OptionGroupSection(title: String, subtitle: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
        Text(subtitle, color = Color.Gray, fontSize = 11.sp)
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            content()
        }
    }
}

@Composable
private fun OptionChip(
    label: String,
    priceLabel: String? = null,
    selected: Boolean,
    onClick: () -> Unit
) {
    val bg = if (selected) Color(0xFF00897B) else Color(0xFF333333)
    Box(
        modifier = Modifier
            .border(1.dp, if (selected) Color(0xFF00897B) else Color(0xFF555555), RoundedCornerShape(20.dp))
            .background(bg, RoundedCornerShape(20.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp)
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                label,
                color = Color.White,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                fontSize = 13.sp
            )
            priceLabel?.let {
                Text(it, color = if (selected) Color(0xFFE0F2F1) else Color(0xFF9E9E9E), fontSize = 10.sp)
            }
        }
    }
}

@Composable
private fun QtyOptionChip(
    label: String,
    priceLabel: String? = null,
    quantity: Int,
    maxTotal: Int,
    currentTotal: Int,
    allowRepeat: Boolean = true,
    onIncrement: () -> Unit,
    onDecrement: () -> Unit
) {
    val selected = quantity > 0
    val canAdd = !selected && currentTotal < maxTotal && (allowRepeat || quantity == 0)
    val bg = if (selected) Color(0xFF00897B) else Color(0xFF333333)
    Row(
        modifier = Modifier
            .border(1.dp, if (selected) Color(0xFF00897B) else Color(0xFF555555), RoundedCornerShape(20.dp))
            .background(bg, RoundedCornerShape(20.dp))
            .then(if (canAdd) Modifier.clickable(onClick = onIncrement) else Modifier)
            .padding(start = 12.dp, end = if (selected) 2.dp else 12.dp, top = 4.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f).padding(end = if (selected) 2.dp else 0.dp)) {
            Text(
                label,
                color = Color.White,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                fontSize = 13.sp
            )
            priceLabel?.let {
                Text(it, color = if (selected) Color(0xFFE0F2F1) else Color(0xFF9E9E9E), fontSize = 10.sp)
            }
        }
        if (selected) {
            IconButton(onClick = onDecrement, modifier = Modifier.height(30.dp).width(30.dp)) {
                Icon(Icons.Default.Remove, contentDescription = null, tint = Color.White, modifier = Modifier.height(16.dp))
            }
            Text(
                quantity.toString(),
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
                modifier = Modifier.width(18.dp),
                textAlign = TextAlign.Center
            )
            IconButton(onClick = onIncrement, modifier = Modifier.height(30.dp).width(30.dp)) {
                Icon(Icons.Default.Add, contentDescription = null, tint = Color.White, modifier = Modifier.height(16.dp))
            }
        } else if (canAdd) {
            Icon(Icons.Default.Add, contentDescription = null, tint = Color(0xFF80CBC4), modifier = Modifier.height(18.dp))
        }
    }
}

private fun groupSubtitle(group: ModifierGroupModel): String {
    val pick = if (group.limitQuantity <= 1) "Choose 1" else "Up to ${group.limitQuantity}"
    val req = if (group.required) "  Required" else ""
    return pick + req
}

private fun addonGroupSubtitle(group: AddonGroupModel): String {
    val pick = if (group.limitQuantity <= 1) "Choose 1" else "Up to ${group.limitQuantity}"
    val req = if (group.required) "  Required" else ""
    return pick + req + "  Paid extras"
}

private fun validateSelections(
    state: ProductCustomizeState,
    singleModifier: Map<Long, Long>,
    modifierQty: Map<Long, Int>,
    addonQty: Map<Long, Int>
): String? {
    state.modifierGroups.forEach { group ->
        val count = if (group.isSingleSelect) {
            if (singleModifier[group.id] != null) 1 else 0
        } else {
            group.options.sumOf { modifierQty[it.id] ?: 0 }
        }
        if (group.required && count == 0) return "Please choose ${group.name}"
        if (count > group.limitQuantity) return "Too many selections for ${group.name}"
    }
    state.addonGroups.forEach { group ->
        val count = group.options.sumOf { addonQty[it.id] ?: 0 }
        if (group.required && count == 0) return "Please choose ${group.name}"
        if (count > group.limitQuantity) return "Too many add-ons for ${group.name}"
    }
    return null
}

private fun buildModifiers(
    groups: List<ModifierGroupModel>,
    singleModifier: Map<Long, Long>,
    modifierQty: Map<Long, Int>
): List<SelectedModifier> {
    val result = mutableListOf<SelectedModifier>()
    groups.forEach { group ->
        if (group.isSingleSelect) {
            val optionId = singleModifier[group.id] ?: return@forEach
            val name = group.options.find { it.id == optionId }?.name ?: return@forEach
            result.add(SelectedModifier(name, 1))
        } else {
            group.options.forEach { opt ->
                val q = modifierQty[opt.id] ?: 0
                if (q > 0) result.add(SelectedModifier(opt.name, q))
            }
        }
    }
    return result
}

private fun buildAddons(
    groups: List<AddonGroupModel>,
    addonQty: Map<Long, Int>
): List<SelectedAddon> {
    val result = mutableListOf<SelectedAddon>()
    groups.forEach { group ->
        group.options.forEach { opt ->
            val q = addonQty[opt.id] ?: 0
            if (q > 0) result.add(SelectedAddon(opt.name, opt.price, q))
        }
    }
    return result
}
