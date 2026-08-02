package com.chaslay.pos.ui.menu

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Switch
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
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
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.data.local.entity.AddonGroupEntity
import com.chaslay.pos.data.local.entity.CategoryEntity
import com.chaslay.pos.data.local.entity.ModifierGroupEntity
import com.chaslay.pos.data.local.entity.ProductEntity
import com.chaslay.pos.domain.model.AddonGroupModel
import com.chaslay.pos.domain.model.AddonOptionModel
import com.chaslay.pos.domain.model.ModifierOptionModel
import com.chaslay.pos.ui.catalog.CatalogScreen
import com.chaslay.pos.ui.theme.vectronColors
import kotlinx.coroutines.launch

@Composable
fun MenuHubScreen(viewModel: MenuViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val sortState by viewModel.sortState.collectAsStateWithLifecycle()
    val colors = vectronColors()

    state.message?.let { msg ->
        AlertDialog(
            onDismissRequest = viewModel::clearMessage,
            confirmButton = { TextButton(onClick = viewModel::clearMessage) { Text("OK") } },
            text = { Text(msg) }
        )
    }

    Row(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .width(180.dp)
                .fillMaxHeight()
                .background(colors.panelLight)
                .padding(8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(stringResource(R.string.menu_settings), fontWeight = FontWeight.Bold, modifier = Modifier.padding(8.dp))
            MenuSection.entries.forEach { section ->
                val selected = state.section == section
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(if (selected) Color(0xFF00897B) else Color.Transparent)
                        .clickable { viewModel.setSection(section) }
                        .padding(horizontal = 12.dp, vertical = 10.dp)
                ) {
                    Text(
                        stringResource(
                            when (section) {
                                MenuSection.PRODUCT_LIST -> R.string.product_list
                                MenuSection.MENU_SYNC -> R.string.menu_sync_title
                                MenuSection.MENU_ORDER -> R.string.menu_order
                                MenuSection.MENU_TEMPLATE -> R.string.menu_template
                                MenuSection.IMPORT_EXPORT -> R.string.menu_import_export
                                MenuSection.MODIFIERS -> R.string.modifiers
                                MenuSection.ADDONS -> R.string.addons
                                MenuSection.COMBOS -> R.string.combos
                            }
                        ),
                        color = if (selected) Color.White else colors.textPrimary,
                        fontSize = 13.sp
                    )
                }
            }
        }
        Box(modifier = Modifier.weight(1f).fillMaxHeight()) {
            when (state.section) {
                MenuSection.PRODUCT_LIST -> CatalogScreen()
                MenuSection.MENU_SYNC -> MenuSyncSection()
                MenuSection.MENU_ORDER -> MenuSortSection(
                    categories = sortState.first,
                    products = sortState.second,
                    selectedCategoryId = state.selectedCategoryForSort,
                    onSelectCategory = viewModel::setSortCategory,
                    onMoveCategoryUp = viewModel::moveCategoryUp,
                    onMoveCategoryDown = viewModel::moveCategoryDown,
                    onMoveProductUp = viewModel::moveProductUp,
                    onMoveProductDown = viewModel::moveProductDown
                )
                MenuSection.MENU_TEMPLATE -> MenuTemplateSection()
                MenuSection.IMPORT_EXPORT -> MenuImportSection(
                    importMode = state.importMode,
                    importPreview = state.importPreview,
                    isImporting = state.isImporting,
                    onModeChange = viewModel::setImportMode,
                    onPickFile = viewModel::parseImportFile,
                    onConfirmImport = viewModel::confirmImport,
                    onDismissPreview = viewModel::dismissImportPreview,
                    onExportTemplate = viewModel::exportTemplate
                )
                MenuSection.MODIFIERS -> ModifierListSection(
                    groups = state.modifierGroups,
                    viewModel = viewModel
                )
                MenuSection.ADDONS -> AddonListSection(
                    groups = state.addonGroups,
                    viewModel = viewModel
                )
                MenuSection.COMBOS -> CombosSectionHost(viewModel = viewModel)
            }
        }
    }
}

@Composable
private fun CombosSectionHost(viewModel: MenuViewModel) {
    var combos by remember { mutableStateOf<List<ProductEntity>>(emptyList()) }
    var categories by remember { mutableStateOf<List<CategoryEntity>>(emptyList()) }
    LaunchedEffect(Unit) {
        combos = viewModel.getComboProducts()
        categories = viewModel.getAllCategories()
    }
    CombosSection(
        combos = combos,
        categories = categories,
        viewModel = viewModel,
        onRefresh = {
            combos = viewModel.getComboProducts()
            categories = viewModel.getAllCategories()
        }
    )
}

@Composable
private fun MenuTemplateSection() {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text(stringResource(R.string.menu_template), fontWeight = FontWeight.Bold, fontSize = 18.sp)
        Text(
            stringResource(R.string.menu_template_hint),
            color = Color.Gray,
            fontSize = 13.sp,
            modifier = Modifier.padding(vertical = 12.dp)
        )
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(stringResource(R.string.receipt_template), fontWeight = FontWeight.SemiBold)
                Text("? ${stringResource(R.string.receipt_show_vat)}", fontSize = 13.sp)
                Text("? ${stringResource(R.string.kitchen_large_items)}", fontSize = 13.sp)
                Text("? ${stringResource(R.string.kitchen_large_header)}", fontSize = 13.sp)
                Text(stringResource(R.string.receipt_design), fontSize = 12.sp, color = Color.Gray)
            }
        }
    }
}

@Composable
private fun MenuSortSection(
    categories: List<com.chaslay.pos.data.local.entity.CategoryEntity>,
    products: List<ProductEntity>,
    selectedCategoryId: Long?,
    onSelectCategory: (Long?) -> Unit,
    onMoveCategoryUp: (Long) -> Unit,
    onMoveCategoryDown: (Long) -> Unit,
    onMoveProductUp: (Long, Long) -> Unit,
    onMoveProductDown: (Long, Long) -> Unit
) {
    val categoryProducts = products.filter { it.categoryId == selectedCategoryId }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        Text(stringResource(R.string.menu_order), fontWeight = FontWeight.Bold, fontSize = 18.sp)
        Text(stringResource(R.string.menu_order_hint), color = Color.Gray, fontSize = 12.sp, modifier = Modifier.padding(bottom = 12.dp))
        Text(stringResource(R.string.categories), fontWeight = FontWeight.SemiBold)
        categories.forEach { category ->
            SortRow(
                label = category.name,
                selected = selectedCategoryId == category.id,
                onSelect = { onSelectCategory(category.id) },
                onUp = { onMoveCategoryUp(category.id) },
                onDown = { onMoveCategoryDown(category.id) }
            )
        }
        Text(stringResource(R.string.products), fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 16.dp, bottom = 8.dp))
        if (selectedCategoryId == null) {
            Text("Select a category above to reorder its products.", color = Color.Gray, fontSize = 12.sp)
        } else {
            categoryProducts.forEach { product ->
                SortRow(
                    label = product.name,
                    onUp = { onMoveProductUp(product.id, selectedCategoryId) },
                    onDown = { onMoveProductDown(product.id, selectedCategoryId) }
                )
            }
        }
    }
}

@Composable
private fun SortRow(
    label: String,
    selected: Boolean = false,
    onSelect: (() -> Unit)? = null,
    onUp: () -> Unit,
    onDown: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .then(if (onSelect != null) Modifier.clickable(onClick = onSelect) else Modifier),
        colors = androidx.compose.material3.CardDefaults.cardColors(
            containerColor = if (selected) Color(0x332196F3) else Color(0xFFF5F5F5)
        )
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(label, modifier = Modifier.weight(1f))
            IconButton(onClick = onUp) { Icon(Icons.Default.ArrowUpward, contentDescription = null) }
            IconButton(onClick = onDown) { Icon(Icons.Default.ArrowDownward, contentDescription = null) }
        }
    }
}

@Composable
private fun ModifierListSection(groups: List<ModifierGroupEntity>, viewModel: MenuViewModel) {
    var showDialog by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<ModifierGroupEntity?>(null) }
    Scaffold(
        floatingActionButton = {
            androidx.compose.material3.FloatingActionButton(onClick = { editing = null; showDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = null)
            }
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding).fillMaxSize().padding(16.dp)) {
            Text(stringResource(R.string.modifiers), fontWeight = FontWeight.Bold, fontSize = 18.sp)
            Text(stringResource(R.string.modifiers_hint), color = Color.Gray, fontSize = 12.sp)
            Text(stringResource(R.string.quick_edit), fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 8.dp))
            LazyColumn(modifier = Modifier.padding(top = 12.dp)) {
                items(groups, key = { it.id }) { group ->
                    QuickEditGroupCard(
                        name = group.name,
                        subtitle = "Pick ${group.limitQuantity} ? ${if (group.required) "Required" else "Optional"}",
                        onEdit = { editing = group; showDialog = true },
                        onDelete = { viewModel.deleteModifierGroup(group.id) },
                        loadOptions = { viewModel.loadModifierGroup(group.id)?.options.orEmpty() },
                        onToggleStock = { id, inStock -> viewModel.toggleModifierOptionInStock(id, inStock) }
                    )
                }
            }
        }
    }
    if (showDialog) {
        ModifierEditDialog(
            group = editing,
            viewModel = viewModel,
            onDismiss = { showDialog = false },
            onSaved = { showDialog = false }
        )
    }
}

@Composable
private fun AddonListSection(groups: List<AddonGroupEntity>, viewModel: MenuViewModel) {
    var showDialog by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<AddonGroupEntity?>(null) }
    Scaffold(
        floatingActionButton = {
            androidx.compose.material3.FloatingActionButton(onClick = { editing = null; showDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = null)
            }
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding).fillMaxSize().padding(16.dp)) {
            Text(stringResource(R.string.addons), fontWeight = FontWeight.Bold, fontSize = 18.sp)
            Text(stringResource(R.string.addons_hint), color = Color.Gray, fontSize = 12.sp)
            Text(stringResource(R.string.quick_edit), fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 8.dp))
            LazyColumn(modifier = Modifier.padding(top = 12.dp)) {
                items(groups, key = { it.id }) { group ->
                    QuickEditAddonGroupCard(
                        name = group.name,
                        subtitle = "Pick ${group.limitQuantity} ? Paid extras",
                        onEdit = { editing = group; showDialog = true },
                        onDelete = { viewModel.deleteAddonGroup(group.id) },
                        loadOptions = { viewModel.loadAddonGroup(group.id)?.options.orEmpty() },
                        onToggleStock = { id, inStock -> viewModel.toggleAddonOptionInStock(id, inStock) }
                    )
                }
            }
        }
    }
    if (showDialog) {
        AddonEditDialog(
            group = editing,
            viewModel = viewModel,
            onDismiss = { showDialog = false },
            onSaved = { showDialog = false }
        )
    }
}

@Composable
private fun QuickEditGroupCard(
    name: String,
    subtitle: String,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    loadOptions: suspend () -> List<ModifierOptionModel>,
    onToggleStock: (Long, Boolean) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    var options by remember { mutableStateOf<List<ModifierOptionModel>>(emptyList()) }
    LaunchedEffect(expanded) {
        if (expanded) options = loadOptions()
    }
    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Column {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { expanded = !expanded }
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(name, fontWeight = FontWeight.SemiBold)
                    Text(subtitle, fontSize = 12.sp, color = Color.Gray)
                }
                TextButton(onClick = onEdit) { Text(stringResource(R.string.edit)) }
                IconButton(onClick = onDelete) { Icon(Icons.Default.Delete, contentDescription = null) }
            }
            if (expanded) {
                options.forEach { option ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(option.name, modifier = Modifier.weight(1f), fontSize = 13.sp)
                        Text(stringResource(R.string.in_stock), fontSize = 11.sp, color = Color.Gray)
                        Switch(
                            checked = option.inStock,
                            onCheckedChange = { onToggleStock(option.id, it) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun QuickEditAddonGroupCard(
    name: String,
    subtitle: String,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    loadOptions: suspend () -> List<AddonOptionModel>,
    onToggleStock: (Long, Boolean) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    var options by remember { mutableStateOf<List<AddonOptionModel>>(emptyList()) }
    LaunchedEffect(expanded) {
        if (expanded) options = loadOptions()
    }
    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Column {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { expanded = !expanded }
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(name, fontWeight = FontWeight.SemiBold)
                    Text(subtitle, fontSize = 12.sp, color = Color.Gray)
                }
                TextButton(onClick = onEdit) { Text(stringResource(R.string.edit)) }
                IconButton(onClick = onDelete) { Icon(Icons.Default.Delete, contentDescription = null) }
            }
            if (expanded) {
                options.forEach { option ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(option.name, fontSize = 13.sp)
                            Text("CHF ${"%.2f".format(option.price)}", fontSize = 11.sp, color = Color.Gray)
                        }
                        Switch(
                            checked = option.inStock,
                            onCheckedChange = { onToggleStock(option.id, it) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun GroupListCard(name: String, subtitle: String, onClick: () -> Unit, onDelete: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp).clickable(onClick = onClick)) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(name, fontWeight = FontWeight.SemiBold)
                Text(subtitle, fontSize = 12.sp, color = Color.Gray)
            }
            IconButton(onClick = onDelete) { Icon(Icons.Default.Delete, contentDescription = null) }
        }
    }
}

@Composable
private fun ModifierEditDialog(
    group: ModifierGroupEntity?,
    viewModel: MenuViewModel,
    onDismiss: () -> Unit,
    onSaved: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var name by remember(group) { mutableStateOf(group?.name ?: "") }
    var limitQty by remember(group) { mutableStateOf((group?.limitQuantity ?: 1).toString()) }
    var required by remember(group) { mutableStateOf(group?.required ?: false) }
    val options = remember(group) { mutableStateListOf<String>() }
    val optionInStock = remember(group) { mutableStateListOf<Boolean>() }
    val linkedProducts = remember(group) { mutableStateListOf<Long>() }
    var allProducts by remember { mutableStateOf<List<ProductEntity>>(emptyList()) }

    LaunchedEffect(group?.id) {
        allProducts = viewModel.getAllProducts()
        options.clear()
        optionInStock.clear()
        linkedProducts.clear()
        if (group != null && group.id > 0) {
            val detail = viewModel.loadModifierGroup(group.id)
            detail?.options?.forEach {
                options.add(it.name)
                optionInStock.add(it.inStock)
            }
            linkedProducts.addAll(detail?.linkedProductIds.orEmpty())
        } else if (options.isEmpty()) {
            options.add("")
            optionInStock.add(true)
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (group == null) stringResource(R.string.add_modifier) else stringResource(R.string.edit_modifier)) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text(stringResource(R.string.name)) }, singleLine = true)
                OutlinedTextField(
                    value = limitQty,
                    onValueChange = { limitQty = it },
                    label = { Text(stringResource(R.string.limit_quantity)) },
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true
                )
                Text(stringResource(R.string.choose_at_least_one), fontSize = 12.sp)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(selected = !required, onClick = { required = false })
                    Text(stringResource(R.string.no))
                    RadioButton(selected = required, onClick = { required = true })
                    Text(stringResource(R.string.yes))
                }
                Text(stringResource(R.string.sub_options), fontWeight = FontWeight.SemiBold)
                options.forEachIndexed { index, opt ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        OutlinedTextField(
                            value = opt,
                            onValueChange = { options[index] = it },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                        Switch(
                            checked = optionInStock.getOrElse(index) { true },
                            onCheckedChange = { optionInStock[index] = it }
                        )
                        IconButton(onClick = {
                            if (options.size > 1) {
                                options.removeAt(index)
                                if (index < optionInStock.size) optionInStock.removeAt(index)
                            }
                        }) {
                            Icon(Icons.Default.Delete, contentDescription = null)
                        }
                    }
                }
                TextButton(onClick = { options.add(""); optionInStock.add(true) }) { Text("+ Add") }
                Text(stringResource(R.string.link_products), fontWeight = FontWeight.SemiBold)
                allProducts.forEach { product ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(
                            checked = product.id in linkedProducts,
                            onCheckedChange = { checked ->
                                if (checked) linkedProducts.add(product.id) else linkedProducts.remove(product.id)
                            }
                        )
                        Text(product.name, fontSize = 13.sp)
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                val entity = ModifierGroupEntity(
                    id = group?.id ?: 0,
                    name = name.trim(),
                    limitQuantity = limitQty.toIntOrNull()?.coerceAtLeast(1) ?: 1,
                    required = required
                )
                viewModel.saveModifierGroup(
                    entity,
                    options.mapIndexed { index, value -> value to optionInStock.getOrElse(index) { true } },
                    linkedProducts.toList()
                )
                onSaved()
            }) { Text(stringResource(R.string.save)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } }
    )
}

@Composable
private fun AddonEditDialog(
    group: AddonGroupEntity?,
    viewModel: MenuViewModel,
    onDismiss: () -> Unit,
    onSaved: () -> Unit
) {
    var name by remember(group) { mutableStateOf(group?.name ?: "") }
    var limitQty by remember(group) { mutableStateOf((group?.limitQuantity ?: 1).toString()) }
    var required by remember(group) { mutableStateOf(group?.required ?: false) }
    var allowMultiple by remember(group) { mutableStateOf(group?.allowMultipleSame ?: false) }
    val optionNames = remember(group) { mutableStateListOf<String>() }
    val optionPrices = remember(group) { mutableStateListOf<String>() }
    val optionInStock = remember(group) { mutableStateListOf<Boolean>() }
    val linkedProducts = remember(group) { mutableStateListOf<Long>() }
    var allProducts by remember { mutableStateOf<List<ProductEntity>>(emptyList()) }

    LaunchedEffect(group?.id) {
        allProducts = viewModel.getAllProducts()
        optionNames.clear()
        optionPrices.clear()
        optionInStock.clear()
        linkedProducts.clear()
        if (group != null && group.id > 0) {
            val detail = viewModel.loadAddonGroup(group.id)
            detail?.options?.forEach { opt ->
                optionNames.add(opt.name)
                optionPrices.add(opt.price.toString())
                optionInStock.add(opt.inStock)
            }
            linkedProducts.addAll(detail?.linkedProductIds.orEmpty())
        }
        if (optionNames.isEmpty()) {
            optionNames.add("")
            optionPrices.add("0")
            optionInStock.add(true)
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (group == null) stringResource(R.string.add_addon) else stringResource(R.string.edit_addon)) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text(stringResource(R.string.name)) }, singleLine = true)
                OutlinedTextField(
                    value = limitQty,
                    onValueChange = { limitQty = it },
                    label = { Text(stringResource(R.string.limit_quantity)) },
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(stringResource(R.string.required_option), fontSize = 12.sp, modifier = Modifier.weight(1f))
                    RadioButton(selected = !required, onClick = { required = false })
                    Text(stringResource(R.string.no))
                    RadioButton(selected = required, onClick = { required = true })
                    Text(stringResource(R.string.yes))
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(stringResource(R.string.multiple_same_item), fontSize = 12.sp, modifier = Modifier.weight(1f))
                    RadioButton(selected = !allowMultiple, onClick = { allowMultiple = false })
                    Text(stringResource(R.string.no))
                    RadioButton(selected = allowMultiple, onClick = { allowMultiple = true })
                    Text(stringResource(R.string.yes))
                }
                Text(stringResource(R.string.sub_options), fontWeight = FontWeight.SemiBold)
                optionNames.forEachIndexed { index, opt ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        OutlinedTextField(
                            value = opt,
                            onValueChange = { optionNames[index] = it },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = optionPrices.getOrElse(index) { "0" },
                            onValueChange = { if (index < optionPrices.size) optionPrices[index] = it },
                            modifier = Modifier.width(90.dp),
                            label = { Text("CHF") },
                            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            singleLine = true
                        )
                        Switch(
                            checked = optionInStock.getOrElse(index) { true },
                            onCheckedChange = { optionInStock[index] = it }
                        )
                        IconButton(onClick = {
                            if (optionNames.size > 1) {
                                optionNames.removeAt(index)
                                if (index < optionPrices.size) optionPrices.removeAt(index)
                                if (index < optionInStock.size) optionInStock.removeAt(index)
                            }
                        }) { Icon(Icons.Default.Delete, contentDescription = null) }
                    }
                }
                TextButton(onClick = { optionNames.add(""); optionPrices.add("0"); optionInStock.add(true) }) {
                    Text("+ Add")
                }
                Text(stringResource(R.string.link_products), fontWeight = FontWeight.SemiBold)
                allProducts.forEach { product ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(
                            checked = product.id in linkedProducts,
                            onCheckedChange = { checked ->
                                if (checked) linkedProducts.add(product.id) else linkedProducts.remove(product.id)
                            }
                        )
                        Text(product.name, fontSize = 13.sp)
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                val options = optionNames.indices.map { i ->
                    Triple(
                        optionNames[i],
                        optionPrices.getOrElse(i) { "0" }.toDoubleOrNull() ?: 0.0,
                        optionInStock.getOrElse(i) { true }
                    )
                }
                val entity = AddonGroupEntity(
                    id = group?.id ?: 0,
                    name = name.trim(),
                    limitQuantity = limitQty.toIntOrNull()?.coerceAtLeast(1) ?: 1,
                    required = required,
                    allowMultipleSame = allowMultiple
                )
                viewModel.saveAddonGroup(entity, options, linkedProducts.toList())
                onSaved()
            }) { Text(stringResource(R.string.save)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } }
    )
}
