package com.chaslay.pos.ui.tableplan

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.drag
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.domain.model.FloorPlanElementType
import com.chaslay.pos.domain.model.TableShape
import com.chaslay.pos.domain.model.TableStatus
import com.chaslay.pos.domain.model.TableWithOrderInfo
import com.chaslay.pos.ui.theme.VectronColors
import kotlin.math.abs
import kotlin.math.roundToInt

data class FloorPlanTableDisplay(
    val id: Long,
    val name: String,
    val seatCapacity: Int,
    val planX: Float,
    val planY: Float,
    val planWidth: Float,
    val planHeight: Float,
    val shape: String,
    val rotation: Float,
    val status: TableStatus = TableStatus.FREE,
    val orderTotal: Double = 0.0,
    val guestCount: Int? = null,
    val isActive: Boolean = false
)

data class FloorPlanElementDisplay(
    val id: Long,
    val elementType: String,
    val label: String?,
    val planX: Float,
    val planY: Float,
    val planWidth: Float,
    val planHeight: Float,
    val rotation: Float,
    val isSelected: Boolean = false
)

fun TableWithOrderInfo.toFloorPlanDisplay(activeTableName: String?, currencySymbol: String): FloorPlanTableDisplay =
    FloorPlanTableDisplay(
        id = id,
        name = name,
        seatCapacity = seatCapacity,
        planX = planX,
        planY = planY,
        planWidth = planWidth,
        planHeight = planHeight,
        shape = shape,
        rotation = rotation,
        status = status,
        orderTotal = orderTotal,
        guestCount = guestCount,
        isActive = name == activeTableName
    )

@Composable
fun FloorPlanCanvas(
    tables: List<FloorPlanTableDisplay>,
    elements: List<FloorPlanElementDisplay> = emptyList(),
    editable: Boolean,
    selectedTableId: Long?,
    selectedElementId: Long? = null,
    onTableClick: (Long) -> Unit,
    onTableMoved: ((Long, Float, Float) -> Unit)?,
    onElementClick: ((Long) -> Unit)? = null,
    onElementMoved: ((Long, Float, Float) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    BoxWithConstraints(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFFECEFF1))
            .border(1.dp, Color(0xFFB0BEC5))
    ) {
        val canvasW = maxWidth
        val canvasH = maxHeight
        // Guard against zero-size layout (parent Column without weight).
        if (canvasW.value < 8f || canvasH.value < 8f) return@BoxWithConstraints

        elements.forEach { element ->
            DraggablePlanItem(
                planX = element.planX,
                planY = element.planY,
                planWidth = element.planWidth,
                planHeight = element.planHeight,
                rotation = element.rotation,
                canvasW = canvasW.value,
                canvasH = canvasH.value,
                editable = editable && onElementMoved != null,
                onMoved = { x, y -> onElementMoved?.invoke(element.id, x, y) },
                onClick = { onElementClick?.invoke(element.id) }
            ) {
                FloorPlanElementChip(element = element)
            }
        }

        tables.forEach { table ->
            DraggablePlanItem(
                planX = table.planX,
                planY = table.planY,
                planWidth = table.planWidth,
                planHeight = table.planHeight,
                rotation = table.rotation,
                canvasW = canvasW.value,
                canvasH = canvasH.value,
                editable = editable && onTableMoved != null,
                onMoved = { x, y -> onTableMoved?.invoke(table.id, x, y) },
                onClick = { onTableClick(table.id) }
            ) {
                FloorPlanTableChip(
                    table = table,
                    isSelected = table.id == selectedTableId
                )
            }
        }
    }
}

@Composable
private fun DraggablePlanItem(
    planX: Float,
    planY: Float,
    planWidth: Float,
    planHeight: Float,
    rotation: Float,
    canvasW: Float,
    canvasH: Float,
    editable: Boolean,
    onMoved: (Float, Float) -> Unit,
    onClick: () -> Unit,
    content: @Composable () -> Unit
) {
    val w = (planWidth.coerceIn(0.04f, 0.5f) * canvasW).dp
    val h = (planHeight.coerceIn(0.03f, 0.5f) * canvasH).dp
    val baseX = planX.coerceIn(0f, 1f) * canvasW
    val baseY = planY.coerceIn(0f, 1f) * canvasH
    var dragOffsetX by remember(planX, planY) { mutableFloatStateOf(0f) }
    var dragOffsetY by remember(planX, planY) { mutableFloatStateOf(0f) }

    Box(
        modifier = Modifier
            .offset {
                IntOffset(
                    (baseX + dragOffsetX).roundToInt(),
                    (baseY + dragOffsetY).roundToInt()
                )
            }
            .rotate(rotation)
            .pointerInput(planX, planY, editable) {
                // Single gesture handler: tap selects, drag moves (no clickable conflict).
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    var totalDrag = 0f
                    var moved = false
                    drag(down.id) { change ->
                        val delta = change.positionChange()
                        change.consume()
                        if (editable) {
                            dragOffsetX += delta.x
                            dragOffsetY += delta.y
                        }
                        totalDrag += abs(delta.x) + abs(delta.y)
                        if (totalDrag > 8f) moved = true
                    }
                    if (!moved) {
                        onClick()
                    } else if (editable) {
                        onMoved(
                            ((baseX + dragOffsetX) / canvasW).coerceIn(0.02f, 0.92f),
                            ((baseY + dragOffsetY) / canvasH).coerceIn(0.02f, 0.92f)
                        )
                    }
                    dragOffsetX = 0f
                    dragOffsetY = 0f
                }
            }
    ) {
        Box(modifier = Modifier.size(width = w.coerceAtLeast(40.dp), height = h.coerceAtLeast(24.dp))) {
            content()
        }
    }
}

@Composable
private fun FloorPlanElementChip(element: FloorPlanElementDisplay) {
    val type = FloorPlanElementType.fromApi(element.elementType)
    val bg = when (type) {
        FloorPlanElementType.WALL -> Color(0xFF4A4A4A)
        FloorPlanElementType.BAR -> Color(0xFF6D4C41)
        FloorPlanElementType.OBSTACLE -> Color(0xFF9E9E9E)
    }
    Box(
        modifier = Modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(3.dp))
            .background(bg)
            .border(
                width = if (element.isSelected) 2.dp else 0.dp,
                color = Color.White,
                shape = RoundedCornerShape(3.dp)
            ),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = element.label ?: when (type) {
                FloorPlanElementType.WALL -> "Wall"
                FloorPlanElementType.BAR -> "Bar"
                FloorPlanElementType.OBSTACLE -> "Obstacle"
            },
            color = Color.White,
            fontSize = 9.sp,
            textAlign = TextAlign.Center,
            maxLines = 1
        )
    }
}

@Composable
private fun FloorPlanTableChip(
    table: FloorPlanTableDisplay,
    isSelected: Boolean
) {
    val bg = when {
        isSelected -> VectronColors.CardBlue
        table.isActive -> VectronColors.CardBlue.copy(alpha = 0.95f)
        table.status == TableStatus.OCCUPIED -> Color(0xFFE67E22)
        table.status == TableStatus.ACTIVE -> VectronColors.CashGreen.copy(alpha = 0.9f)
        else -> Color(0xFF5C6BC0).copy(alpha = 0.8f)
    }
    val shape = TableShape.fromApi(table.shape)
    val clipShape = when (shape) {
        TableShape.ROUND -> CircleShape
        TableShape.SQUARE -> RoundedCornerShape(6.dp)
        TableShape.RECT -> RoundedCornerShape(4.dp)
    }
    val coverLabel = table.guestCount?.let { "$it/${table.seatCapacity}" }
        ?: "${table.seatCapacity} seats"

    Box(
        modifier = Modifier
            .fillMaxSize()
            .clip(clipShape)
            .background(bg)
            .border(
                width = if (isSelected || table.isActive) 2.dp else 0.dp,
                color = Color.White,
                shape = clipShape
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(4.dp)
        ) {
            Text(table.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 11.sp, maxLines = 1)
            Text(coverLabel, color = Color.White.copy(alpha = 0.9f), fontSize = 9.sp, textAlign = TextAlign.Center)
            if (table.orderTotal > 0) {
                Text("%.0f".format(table.orderTotal), color = Color.White.copy(alpha = 0.85f), fontSize = 8.sp)
            }
        }
    }
}
