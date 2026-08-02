package com.chaslay.pos.ui.tableplan

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.FloorPlanElementType
import com.chaslay.pos.domain.model.TableShape
import com.chaslay.pos.ui.theme.vectronColors

private val AccentTeal = Color(0xFF00897B)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TablePlanDesignerScreen(
    onBack: () -> Unit,
    viewModel: TablePlanViewModel = hiltViewModel()
) {
    val colors = vectronColors()
    Scaffold(
        containerColor = colors.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        stringResource(R.string.table_plan_designer),
                        color = colors.textPrimary,
                        fontWeight = FontWeight.SemiBold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.checkout_back),
                            tint = colors.textPrimary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = colors.header,
                    titleContentColor = colors.textPrimary,
                    navigationIconContentColor = colors.textPrimary
                )
            )
        }
    ) { padding ->
        TablePlanDesignerContent(
            viewModel = viewModel,
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        )
    }
}

/** Embedded designer for Settings → Tables (no second scaffold). */
@Composable
fun TablePlanDesignerContent(
    viewModel: TablePlanViewModel = hiltViewModel(),
    modifier: Modifier = Modifier
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val colors = vectronColors()
    val context = LocalContext.current
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedTextColor = colors.textPrimary,
        unfocusedTextColor = colors.textPrimary,
        focusedBorderColor = AccentTeal,
        unfocusedBorderColor = colors.textSecondary.copy(alpha = 0.4f),
        focusedLabelColor = AccentTeal,
        unfocusedLabelColor = colors.textSecondary,
        cursorColor = AccentTeal
    )

    LaunchedEffect(state.message) {
        state.message?.let { msg ->
            android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show()
            viewModel.clearMessage()
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.background)
            .padding(horizontal = 10.dp, vertical = 6.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            state.floors.forEach { floor ->
                FilterChip(
                    selected = floor.id == state.selectedFloorId,
                    onClick = { viewModel.selectFloor(floor.id) },
                    label = { Text(floor.name, fontSize = 12.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = AccentTeal,
                        selectedLabelColor = Color.White,
                        containerColor = colors.panelLight,
                        labelColor = colors.textPrimary
                    )
                )
            }
            Button(
                onClick = viewModel::addTable,
                colors = ButtonDefaults.buttonColors(containerColor = AccentTeal),
                contentPadding = ButtonDefaults.ContentPadding
            ) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(4.dp))
                Text(stringResource(R.string.add_table), fontSize = 13.sp)
            }
            OutlinedButton(onClick = viewModel::autoLayout) {
                Icon(Icons.Default.GridView, contentDescription = null)
                Spacer(modifier = Modifier.width(4.dp))
                Text(stringResource(R.string.auto_layout), fontSize = 13.sp)
            }
            OutlinedButton(onClick = { viewModel.addElement(FloorPlanElementType.WALL) }) {
                Text(stringResource(R.string.add_wall), fontSize = 12.sp)
            }
            OutlinedButton(onClick = { viewModel.addElement(FloorPlanElementType.BAR) }) {
                Text(stringResource(R.string.add_bar), fontSize = 12.sp)
            }
            OutlinedTextField(
                value = state.newFloorName,
                onValueChange = viewModel::updateNewFloorName,
                label = { Text(stringResource(R.string.new_floor_name), fontSize = 11.sp) },
                singleLine = true,
                colors = fieldColors,
                modifier = Modifier.width(160.dp)
            )
            OutlinedButton(onClick = viewModel::addFloor) {
                Text(stringResource(R.string.add_floor), fontSize = 12.sp)
            }
        }

        Text(
            stringResource(R.string.table_plan_help),
            fontSize = 11.sp,
            color = colors.textSecondary,
            modifier = Modifier.padding(top = 4.dp, bottom = 6.dp)
        )

        Row(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .heightIn(min = 360.dp)
        ) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(10.dp))
                    .border(1.dp, colors.gridGap, RoundedCornerShape(10.dp))
            ) {
                FloorPlanCanvas(
                    tables = state.tables.map { table ->
                        FloorPlanTableDisplay(
                            id = table.id,
                            name = table.name,
                            seatCapacity = table.seatCapacity,
                            planX = table.planX,
                            planY = table.planY,
                            planWidth = table.planWidth,
                            planHeight = table.planHeight,
                            shape = table.shape,
                            rotation = table.rotation,
                            isActive = table.id == state.selectedTableId
                        )
                    },
                    elements = state.elements.map { element ->
                        FloorPlanElementDisplay(
                            id = element.id,
                            elementType = element.elementType,
                            label = element.label,
                            planX = element.planX,
                            planY = element.planY,
                            planWidth = element.planWidth,
                            planHeight = element.planHeight,
                            rotation = element.rotation,
                            isSelected = element.id == state.selectedElementId
                        )
                    },
                    editable = true,
                    selectedTableId = state.selectedTableId,
                    selectedElementId = state.selectedElementId,
                    onTableClick = viewModel::selectTable,
                    onTableMoved = viewModel::moveTable,
                    onElementClick = viewModel::selectElement,
                    onElementMoved = viewModel::moveElement,
                    modifier = Modifier.fillMaxSize()
                )
            }

            if (state.selectedTableId != null || state.selectedElementId != null) {
                Spacer(modifier = Modifier.width(12.dp))
                TableEditSidePanel(
                    state = state,
                    fieldColors = fieldColors,
                    onClose = viewModel::clearSelection,
                    onNameChange = viewModel::updateEditName,
                    onSeatsChange = viewModel::updateEditSeats,
                    onShapeChange = viewModel::updateEditShape,
                    onElementLabelChange = viewModel::updateEditElementLabel,
                    onSaveTable = viewModel::saveSelectedTable,
                    onDeleteTable = viewModel::deleteSelectedTable,
                    onSaveElement = viewModel::saveSelectedElement,
                    onDeleteElement = viewModel::deleteSelectedElement,
                    modifier = Modifier
                        .width(300.dp)
                        .fillMaxHeight()
                )
            }
        }
    }
}

@Composable
private fun TableEditSidePanel(
    state: TablePlanUiState,
    fieldColors: androidx.compose.material3.TextFieldColors,
    onClose: () -> Unit,
    onNameChange: (String) -> Unit,
    onSeatsChange: (String) -> Unit,
    onShapeChange: (TableShape) -> Unit,
    onElementLabelChange: (String) -> Unit,
    onSaveTable: () -> Unit,
    onDeleteTable: () -> Unit,
    onSaveElement: () -> Unit,
    onDeleteElement: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = vectronColors()
    val editingTable = state.selectedTableId != null

    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(colors.panelLight)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    if (editingTable) stringResource(R.string.edit_table)
                    else stringResource(R.string.edit_floor_element),
                    color = colors.textPrimary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
                Text(
                    stringResource(R.string.table_plan_edit_hint),
                    color = colors.textSecondary,
                    fontSize = 12.sp
                )
            }
            IconButton(onClick = onClose) {
                Icon(Icons.Default.Close, contentDescription = stringResource(R.string.cancel), tint = colors.textPrimary)
            }
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (editingTable) {
                OutlinedTextField(
                    value = state.editName,
                    onValueChange = onNameChange,
                    label = { Text(stringResource(R.string.table_name)) },
                    singleLine = true,
                    colors = fieldColors,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = state.editSeats,
                    onValueChange = onSeatsChange,
                    label = { Text(stringResource(R.string.seat_capacity)) },
                    singleLine = true,
                    colors = fieldColors,
                    modifier = Modifier.fillMaxWidth()
                )
                Text(
                    stringResource(R.string.table_shape),
                    fontWeight = FontWeight.SemiBold,
                    color = colors.textPrimary
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TableShape.entries.forEach { shape ->
                        FilterChip(
                            selected = state.editShape == shape,
                            onClick = { onShapeChange(shape) },
                            label = {
                                Text(
                                    when (shape) {
                                        TableShape.ROUND -> stringResource(R.string.shape_round)
                                        TableShape.SQUARE -> stringResource(R.string.shape_square)
                                        TableShape.RECT -> stringResource(R.string.shape_rect)
                                    }
                                )
                            },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = AccentTeal,
                                selectedLabelColor = Color.White,
                                containerColor = colors.panelDark,
                                labelColor = colors.textPrimary
                            )
                        )
                    }
                }
            } else {
                OutlinedTextField(
                    value = state.editElementLabel,
                    onValueChange = onElementLabelChange,
                    label = { Text(stringResource(R.string.element_label_optional)) },
                    singleLine = true,
                    colors = fieldColors,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            TextButton(onClick = if (editingTable) onDeleteTable else onDeleteElement) {
                Text(stringResource(R.string.delete), color = Color(0xFFE57373))
            }
            Spacer(modifier = Modifier.weight(1f))
            OutlinedButton(onClick = onClose) {
                Text(stringResource(R.string.cancel))
            }
            Button(
                onClick = if (editingTable) onSaveTable else onSaveElement,
                colors = ButtonDefaults.buttonColors(containerColor = AccentTeal)
            ) {
                Text(stringResource(R.string.save))
            }
        }
    }
}
