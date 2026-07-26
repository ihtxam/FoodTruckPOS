package com.chaslay.pos.ui.tableplan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
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
import com.chaslay.pos.ui.theme.ChaslayBrand

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TablePlanDesignerScreen(
    onBack: () -> Unit,
    viewModel: TablePlanViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LaunchedEffect(state.message) {
        state.message?.let { msg ->
            android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show()
            viewModel.clearMessage()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.table_plan_designer)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.checkout_back))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = ChaslayBrand.Black,
                    titleContentColor = ChaslayBrand.White,
                    navigationIconContentColor = ChaslayBrand.White
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(12.dp)
        ) {
            Text(
                stringResource(R.string.table_plan_help),
                fontSize = 13.sp,
                color = ChaslayBrand.Gray600,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                state.floors.forEach { floor ->
                    FilterChip(
                        selected = floor.id == state.selectedFloorId,
                        onClick = { viewModel.selectFloor(floor.id) },
                        label = { Text(floor.name) }
                    )
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(onClick = viewModel::addTable) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Text(stringResource(R.string.add_table))
                }
                OutlinedButton(onClick = viewModel::autoLayout) {
                    Icon(Icons.Default.GridView, contentDescription = null)
                    Text(stringResource(R.string.auto_layout))
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(onClick = { viewModel.addElement(FloorPlanElementType.WALL) }) {
                    Text(stringResource(R.string.add_wall))
                }
                OutlinedButton(onClick = { viewModel.addElement(FloorPlanElementType.BAR) }) {
                    Text(stringResource(R.string.add_bar))
                }
                OutlinedButton(onClick = { viewModel.addElement(FloorPlanElementType.OBSTACLE) }) {
                    Text(stringResource(R.string.add_obstacle))
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = state.newFloorName,
                    onValueChange = viewModel::updateNewFloorName,
                    label = { Text(stringResource(R.string.new_floor_name)) },
                    modifier = Modifier.weight(1f)
                )
                OutlinedButton(onClick = viewModel::addFloor) {
                    Text(stringResource(R.string.add_floor))
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

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
                modifier = Modifier
                    .fillMaxWidth()
                    .fillMaxHeight()
            )
        }
    }

    if (state.showEditDialog) {
        AlertDialog(
            onDismissRequest = viewModel::dismissEditDialog,
            title = { Text(stringResource(R.string.edit_table)) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = state.editName,
                        onValueChange = viewModel::updateEditName,
                        label = { Text(stringResource(R.string.table_name)) },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = state.editSeats,
                        onValueChange = viewModel::updateEditSeats,
                        label = { Text(stringResource(R.string.seat_capacity)) },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Text(stringResource(R.string.table_shape), fontWeight = FontWeight.SemiBold)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TableShape.entries.forEach { shape ->
                            FilterChip(
                                selected = state.editShape == shape,
                                onClick = { viewModel.updateEditShape(shape) },
                                label = {
                                    Text(
                                        when (shape) {
                                            TableShape.ROUND -> stringResource(R.string.shape_round)
                                            TableShape.SQUARE -> stringResource(R.string.shape_square)
                                            TableShape.RECT -> stringResource(R.string.shape_rect)
                                        }
                                    )
                                }
                            )
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = viewModel::saveSelectedTable) {
                    Text(stringResource(R.string.save))
                }
            },
            dismissButton = {
                Row {
                    TextButton(onClick = viewModel::deleteSelectedTable) {
                        Text(stringResource(R.string.delete))
                    }
                    TextButton(onClick = viewModel::dismissEditDialog) {
                        Text(stringResource(R.string.cancel))
                    }
                }
            }
        )
    }

    if (state.showElementEditDialog) {
        AlertDialog(
            onDismissRequest = viewModel::dismissElementEditDialog,
            title = { Text(stringResource(R.string.edit_floor_element)) },
            text = {
                OutlinedTextField(
                    value = state.editElementLabel,
                    onValueChange = viewModel::updateEditElementLabel,
                    label = { Text(stringResource(R.string.element_label_optional)) },
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                TextButton(onClick = viewModel::saveSelectedElement) {
                    Text(stringResource(R.string.save))
                }
            },
            dismissButton = {
                Row {
                    TextButton(onClick = viewModel::deleteSelectedElement) {
                        Text(stringResource(R.string.delete))
                    }
                    TextButton(onClick = viewModel::dismissElementEditDialog) {
                        Text(stringResource(R.string.cancel))
                    }
                }
            }
        )
    }
}
