package com.chaslay.pos.ui.pos

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
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.ComboPickState
import com.chaslay.pos.domain.model.ComboSelection
import com.chaslay.pos.domain.model.ComboSlotModel
import java.util.Locale

data class ComboPickResult(
    val selections: List<ComboSelection>,
    val quantity: Int
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ComboPickDialog(
    state: ComboPickState,
    currencySymbol: String,
    onConfirm: (ComboPickResult) -> Unit,
    onDismiss: () -> Unit
) {
    val combo = state.combo
    val product = combo.product
    var itemQty by remember { mutableIntStateOf(1) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val picks = remember(combo.product.id) {
        mutableStateMapOf<Long, MutableSet<Long>>().apply {
            combo.slots.forEach { slot -> put(slot.id, mutableSetOf()) }
        }
    }

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
                            stringResource(R.string.combo_deal_price, currencySymbol, product.price),
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
                        combo.slots.forEach { slot ->
                            ComboSlotSection(
                                slot = slot,
                                selected = picks[slot.id].orEmpty(),
                                onToggle = { productId ->
                                    val set = picks.getOrPut(slot.id) { mutableSetOf() }
                                    if (slot.maxPick <= 1) {
                                        set.clear()
                                        set.add(productId)
                                    } else {
                                        if (set.contains(productId)) {
                                            set.remove(productId)
                                        } else if (set.size < slot.maxPick) {
                                            set.add(productId)
                                        }
                                    }
                                }
                            )
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
                            "$currencySymbol ${"%.2f".format(Locale.getDefault(), product.price * itemQty)}",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 22.sp
                        )
                    }
                    Button(
                        onClick = {
                            val validation = validateComboPicks(combo.slots, picks)
                            if (validation != null) {
                                errorMessage = validation
                                return@Button
                            }
                            errorMessage = null
                            val selections = buildComboSelections(combo.slots, picks)
                            onConfirm(ComboPickResult(selections, itemQty))
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00897B)),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(
                            stringResource(R.string.add_to_cart).uppercase(),
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ComboSlotSection(
    slot: ComboSlotModel,
    selected: Set<Long>,
    onToggle: (Long) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(slot.name, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
        Text(comboSlotSubtitle(slot), color = Color.Gray, fontSize = 11.sp)
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            slot.options.forEach { option ->
                val isSelected = option.productId in selected
                val bg = if (isSelected) Color(0xFF00897B) else Color(0xFF333333)
                Box(
                    modifier = Modifier
                        .border(
                            1.dp,
                            if (isSelected) Color(0xFF00897B) else Color(0xFF555555),
                            RoundedCornerShape(20.dp)
                        )
                        .background(bg, RoundedCornerShape(20.dp))
                        .clickable { onToggle(option.productId) }
                        .padding(horizontal = 14.dp, vertical = 8.dp)
                ) {
                    Text(
                        option.productName,
                        color = Color.White,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                        fontSize = 13.sp
                    )
                }
            }
        }
        if (selected.isNotEmpty()) {
            Text(
                selected.size.toString() + " / " + slot.maxPick,
                color = Color(0xFF80CBC4),
                fontSize = 11.sp
            )
        }
    }
}

private fun comboSlotSubtitle(slot: ComboSlotModel): String {
    val pick = when {
        slot.minPick == slot.maxPick && slot.minPick == 1 -> "Choose 1"
        slot.minPick == slot.maxPick -> "Choose ${slot.minPick}"
        slot.minPick <= 0 -> "Up to ${slot.maxPick} (optional)"
        else -> "Choose ${slot.minPick}�${slot.maxPick}"
    }
    val req = if (slot.minPick > 0) " � Required" else ""
    return pick + req
}

private fun validateComboPicks(
    slots: List<ComboSlotModel>,
    picks: Map<Long, Set<Long>>
): String? {
    slots.forEach { slot ->
        val count = picks[slot.id]?.size ?: 0
        if (count < slot.minPick) return "Please choose ${slot.minPick} for ${slot.name}"
        if (count > slot.maxPick) return "Too many picks for ${slot.name}"
    }
    return null
}

private fun buildComboSelections(
    slots: List<ComboSlotModel>,
    picks: Map<Long, Set<Long>>
): List<ComboSelection> {
    val result = mutableListOf<ComboSelection>()
    slots.forEach { slot ->
        val selectedIds = picks[slot.id].orEmpty()
        slot.options.filter { it.productId in selectedIds }.forEach { opt ->
            result.add(ComboSelection(slot.name, opt.productId, opt.productName))
        }
    }
    return result
}
