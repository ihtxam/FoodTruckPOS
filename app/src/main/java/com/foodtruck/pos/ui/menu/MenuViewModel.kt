package com.foodtruck.pos.ui.menu

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.foodtruck.pos.data.local.entity.AddonGroupEntity
import com.foodtruck.pos.data.local.entity.AddonOptionEntity
import com.foodtruck.pos.data.local.entity.CategoryEntity
import com.foodtruck.pos.data.local.entity.ModifierGroupEntity
import com.foodtruck.pos.data.local.entity.ModifierOptionEntity
import com.foodtruck.pos.data.local.entity.ProductEntity
import com.foodtruck.pos.data.repository.MenuRepository
import com.foodtruck.pos.domain.model.AddonGroupModel
import com.foodtruck.pos.domain.model.ModifierGroupModel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class MenuSection {
    PRODUCT_LIST,
    MENU_ORDER,
    MENU_TEMPLATE,
    MODIFIERS,
    ADDONS
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
    val message: String? = null
)

@HiltViewModel
class MenuViewModel @Inject constructor(
    private val menuRepository: MenuRepository
) : ViewModel() {

    private val _section = MutableStateFlow(MenuSection.PRODUCT_LIST)
    private val _selectedCategoryForSort = MutableStateFlow<Long?>(null)
    private val _message = MutableStateFlow<String?>(null)

    val uiState: StateFlow<MenuUiState> = combine(
        _section,
        _selectedCategoryForSort,
        menuRepository.observeModifierGroups(),
        menuRepository.observeAddonGroups(),
        _message
    ) { section, sortCategory, modifiers, addons, message ->
        MenuUiState(
            section = section,
            categories = emptyList(),
            products = emptyList(),
            modifierGroups = modifiers,
            addonGroups = addons,
            selectedCategoryForSort = sortCategory,
            message = message
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

    suspend fun countModifierLinks(groupId: Long): Int =
        menuRepository.countProductsLinkedToModifierGroup(groupId)

    suspend fun countAddonLinks(groupId: Long): Int =
        menuRepository.countProductsLinkedToAddonGroup(groupId)

    fun clearMessage() {
        _message.value = null
    }
}
