package com.chaslay.pos.ui.menu

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chaslay.pos.data.menuimport.MenuImportMode
import com.chaslay.pos.data.menuimport.MenuImportRepository
import com.chaslay.pos.data.menuimport.MenuImportResult
import com.chaslay.pos.data.menuimport.ParsedMenuFile
import com.chaslay.pos.data.local.entity.AddonGroupEntity
import com.chaslay.pos.data.local.entity.AddonOptionEntity
import com.chaslay.pos.data.local.entity.CategoryEntity
import com.chaslay.pos.data.local.entity.ModifierGroupEntity
import com.chaslay.pos.data.local.entity.ModifierOptionEntity
import com.chaslay.pos.data.local.entity.ProductEntity
import com.chaslay.pos.data.repository.MenuRepository
import com.chaslay.pos.domain.model.AddonGroupModel
import com.chaslay.pos.domain.model.ComboMealModel
import com.chaslay.pos.domain.model.ModifierGroupModel
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

enum class MenuSection {
    PRODUCT_LIST,
    MENU_ORDER,
    MENU_TEMPLATE,
    IMPORT_EXPORT,
    MODIFIERS,
    ADDONS,
    COMBOS
}

data class MenuUiState(
    val section: MenuSection = MenuSection.PRODUCT_LIST,
    val categories: List<CategoryEntity> = emptyList(),
    val products: List<ProductEntity> = emptyList(),
    val modifierGroups: List<ModifierGroupEntity> = emptyList(),
    val addonGroups: List<AddonGroupEntity> = emptyList(),
    val modifierOptionCounts: Map<Long, Int> = emptyMap(),
    val addonOptionCounts: Map<Long, Int> = emptyMap(),
    val modifierLinkCounts: Map<Long, Int> = emptyMap(),
    val addonLinkCounts: Map<Long, Int> = emptyMap(),
    val selectedCategoryForSort: Long? = null,
    val importMode: MenuImportMode = MenuImportMode.MERGE,
    val importPreview: ParsedMenuFile? = null,
    val isImporting: Boolean = false,
    val message: String? = null
)

@HiltViewModel
class MenuViewModel @Inject constructor(
    private val menuRepository: MenuRepository,
    private val menuImportRepository: MenuImportRepository,
    @ApplicationContext private val appContext: Context
) : ViewModel() {

    private val _section = MutableStateFlow(MenuSection.PRODUCT_LIST)
    private val _selectedCategoryForSort = MutableStateFlow<Long?>(null)
    private val _message = MutableStateFlow<String?>(null)
    private val _importMode = MutableStateFlow(MenuImportMode.MERGE)
    private val _importPreview = MutableStateFlow<ParsedMenuFile?>(null)
    private val _isImporting = MutableStateFlow(false)

    val uiState: StateFlow<MenuUiState> = combine(
        combine(_section, _selectedCategoryForSort, _message) { section, sortCategory, message ->
            Triple(section, sortCategory, message)
        },
        combine(_importMode, _importPreview, _isImporting) { importMode, importPreview, isImporting ->
            Triple(importMode, importPreview, isImporting)
        },
        menuRepository.observeModifierGroups(),
        menuRepository.observeAddonGroups()
    ) { base, import, modifiers, addons ->
        MenuUiState(
            section = base.first,
            categories = emptyList(),
            products = emptyList(),
            modifierGroups = modifiers,
            addonGroups = addons,
            selectedCategoryForSort = base.second,
            importMode = import.first,
            importPreview = import.second,
            isImporting = import.third,
            message = base.third
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), MenuUiState())

    private val _sortState = MutableStateFlow(
        emptyList<CategoryEntity>() to emptyList<ProductEntity>()
    )
    val sortState: StateFlow<Pair<List<CategoryEntity>, List<ProductEntity>>> = _sortState

    init {
        refreshSortData()
        refreshGroupMeta()
    }

    fun setSection(section: MenuSection) {
        _section.value = section
        if (section == MenuSection.MENU_ORDER) refreshSortData()
        if (section == MenuSection.MODIFIERS || section == MenuSection.ADDONS) refreshGroupMeta()
    }

    fun setSortCategory(categoryId: Long?) {
        _selectedCategoryForSort.value = categoryId
        refreshSortData()
    }

    fun refreshSortData() {
        viewModelScope.launch {
            val categories = menuRepository.getAllCategories()
            val products = menuRepository.getAllProducts()
            _sortState.value = categories to products
            if (_selectedCategoryForSort.value == null) {
                _selectedCategoryForSort.value = categories.firstOrNull()?.id
            }
        }
    }

    private fun refreshGroupMeta() {
        viewModelScope.launch {
            // Counts loaded lazily in UI via repository when editing
        }
    }

    suspend fun loadModifierGroup(id: Long): ModifierGroupModel? =
        menuRepository.getModifierGroupWithOptions(id)

    suspend fun loadAddonGroup(id: Long): AddonGroupModel? =
        menuRepository.getAddonGroupWithOptions(id)

    fun saveModifierGroup(
        group: ModifierGroupEntity,
        options: List<Pair<String, Boolean>>,
        linkedProductIds: List<Long>
    ) {
        viewModelScope.launch {
            val entities = options.filter { it.first.isNotBlank() }.map {
                ModifierOptionEntity(groupId = group.id, name = it.first.trim(), inStock = it.second)
            }
            menuRepository.saveModifierGroup(group, entities, linkedProductIds)
            _message.value = "Modifier saved"
        }
    }

    fun saveAddonGroup(
        group: AddonGroupEntity,
        options: List<Triple<String, Double, Boolean>>,
        linkedProductIds: List<Long>
    ) {
        viewModelScope.launch {
            val entities = options.filter { it.first.isNotBlank() }.map {
                AddonOptionEntity(
                    groupId = group.id,
                    name = it.first.trim(),
                    price = it.second,
                    inStock = it.third
                )
            }
            menuRepository.saveAddonGroup(group, entities, linkedProductIds)
            _message.value = "Add-on saved"
        }
    }

    fun toggleModifierOptionInStock(optionId: Long, inStock: Boolean) {
        viewModelScope.launch {
            menuRepository.setModifierOptionInStock(optionId, inStock)
        }
    }

    fun toggleAddonOptionInStock(optionId: Long, inStock: Boolean) {
        viewModelScope.launch {
            menuRepository.setAddonOptionInStock(optionId, inStock)
        }
    }

    fun reorderCategories(fromIndex: Int, toIndex: Int) {
        viewModelScope.launch {
            val (categories, _) = _sortState.value
            if (fromIndex !in categories.indices || toIndex !in categories.indices) return@launch
            val reordered = categories.toMutableList()
            val item = reordered.removeAt(fromIndex)
            reordered.add(toIndex, item)
            menuRepository.reorderCategories(reordered.map { it.id })
            refreshSortData()
        }
    }

    fun reorderProducts(categoryId: Long, fromIndex: Int, toIndex: Int) {
        viewModelScope.launch {
            val products = _sortState.value.second.filter { it.categoryId == categoryId }
            if (fromIndex !in products.indices || toIndex !in products.indices) return@launch
            val reordered = products.toMutableList()
            val item = reordered.removeAt(fromIndex)
            reordered.add(toIndex, item)
            menuRepository.reorderProductsInCategory(categoryId, reordered.map { it.id })
            refreshSortData()
        }
    }

    fun deleteModifierGroup(id: Long) {
        viewModelScope.launch {
            menuRepository.deleteModifierGroup(id)
            _message.value = "Modifier removed"
        }
    }

    fun deleteAddonGroup(id: Long) {
        viewModelScope.launch {
            menuRepository.deleteAddonGroup(id)
            _message.value = "Add-on removed"
        }
    }

    fun moveCategoryUp(categoryId: Long) {
        viewModelScope.launch {
            val (categories, products) = _sortState.value
            val index = categories.indexOfFirst { it.id == categoryId }
            if (index <= 0) return@launch
            val reordered = categories.toMutableList()
            reordered[index - 1] = categories[index].also { reordered[index] = categories[index - 1] }
            menuRepository.reorderCategories(reordered.map { it.id })
            refreshSortData()
        }
    }

    fun moveCategoryDown(categoryId: Long) {
        viewModelScope.launch {
            val (categories, _) = _sortState.value
            val index = categories.indexOfFirst { it.id == categoryId }
            if (index < 0 || index >= categories.lastIndex) return@launch
            val reordered = categories.toMutableList()
            reordered[index + 1] = categories[index].also { reordered[index] = categories[index + 1] }
            menuRepository.reorderCategories(reordered.map { it.id })
            refreshSortData()
        }
    }

    fun moveProductUp(productId: Long, categoryId: Long) {
        viewModelScope.launch {
            val products = _sortState.value.second.filter { it.categoryId == categoryId }
            val index = products.indexOfFirst { it.id == productId }
            if (index <= 0) return@launch
            val reordered = products.toMutableList()
            reordered[index - 1] = products[index].also { reordered[index] = products[index - 1] }
            menuRepository.reorderProductsInCategory(categoryId, reordered.map { it.id })
            refreshSortData()
        }
    }

    fun moveProductDown(productId: Long, categoryId: Long) {
        viewModelScope.launch {
            val products = _sortState.value.second.filter { it.categoryId == categoryId }
            val index = products.indexOfFirst { it.id == productId }
            if (index < 0 || index >= products.lastIndex) return@launch
            val reordered = products.toMutableList()
            reordered[index + 1] = products[index].also { reordered[index] = products[index + 1] }
            menuRepository.reorderProductsInCategory(categoryId, reordered.map { it.id })
            refreshSortData()
        }
    }

    suspend fun getAllProducts(): List<ProductEntity> = menuRepository.getAllProducts()

    suspend fun getAllCategories(): List<CategoryEntity> = menuRepository.getAllCategories()

    suspend fun getComboProducts(): List<ProductEntity> =
        menuRepository.observeComboProducts().first()

    suspend fun getCatalogProductsForCombos(): List<ProductEntity> =
        menuRepository.getAllProducts().filter { !it.isCombo }

    suspend fun loadComboMeal(productId: Long): ComboMealModel? =
        menuRepository.getComboMeal(productId)

    fun saveCombo(
        name: String,
        price: Double,
        taxRate: Double,
        categoryId: Long?,
        slots: List<MenuRepository.ComboSlotDraft>,
        productId: Long,
        onDone: () -> Unit = {}
    ) {
        viewModelScope.launch {
            val entity = ProductEntity(
                id = productId,
                name = name,
                price = price,
                taxRate = taxRate,
                categoryId = categoryId,
                isCombo = true,
                isOpenPrice = false,
                isWeighed = false
            )
            menuRepository.saveComboMeal(entity, slots)
            _message.value = "Combo saved"
            onDone()
        }
    }

    fun deleteCombo(productId: Long, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            menuRepository.deleteComboMeal(productId)
            _message.value = "Combo removed"
            onDone()
        }
    }

    suspend fun countModifierLinks(groupId: Long): Int =
        menuRepository.countProductsLinkedToModifierGroup(groupId)

    suspend fun countAddonLinks(groupId: Long): Int =
        menuRepository.countProductsLinkedToAddonGroup(groupId)

    fun clearMessage() {
        _message.value = null
    }

    fun setImportMode(mode: MenuImportMode) {
        _importMode.value = mode
    }

    fun dismissImportPreview() {
        _importPreview.value = null
    }

    fun parseImportFile(uri: Uri) {
        viewModelScope.launch {
            _isImporting.value = true
            _message.value = null
            runCatching {
                withContext(Dispatchers.IO) {
                    appContext.contentResolver.openInputStream(uri)?.use { stream ->
                        menuImportRepository.parse(stream)
                    } ?: error("Could not read file")
                }
            }.onSuccess { parsed ->
                _importPreview.value = parsed
            }.onFailure { e ->
                _message.value = e.message ?: "Import failed"
            }
            _isImporting.value = false
        }
    }

    fun confirmImport() {
        val preview = _importPreview.value ?: return
        val mode = _importMode.value
        viewModelScope.launch {
            _isImporting.value = true
            runCatching {
                withContext(Dispatchers.IO) {
                    menuImportRepository.applyImport(mode, preview)
                }
            }.onSuccess { result ->
                _importPreview.value = null
                _message.value = formatImportResult(result)
                refreshSortData()
            }.onFailure { e ->
                _message.value = e.message ?: "Import failed"
            }
            _isImporting.value = false
        }
    }

    fun exportTemplate(uri: Uri) {
        viewModelScope.launch {
            _isImporting.value = true
            runCatching {
                withContext(Dispatchers.IO) {
                    appContext.contentResolver.openOutputStream(uri)?.use { stream ->
                        menuImportRepository.writeTemplate(stream)
                    } ?: error("Could not write template")
                }
            }.onSuccess {
                _message.value = "Template saved"
            }.onFailure { e ->
                _message.value = e.message ?: "Could not save template"
            }
            _isImporting.value = false
        }
    }

    private fun formatImportResult(result: MenuImportResult): String = buildString {
        append("Import complete: ")
        append("${result.categoriesAdded} categories added")
        if (result.categoriesUpdated > 0) append(", ${result.categoriesUpdated} updated")
        append("; ${result.productsAdded} products added")
        if (result.productsUpdated > 0) append(", ${result.productsUpdated} prices updated")
        if (result.warnings.isNotEmpty()) {
            append(". ${result.warnings.size} warning(s)")
        }
    }
}
