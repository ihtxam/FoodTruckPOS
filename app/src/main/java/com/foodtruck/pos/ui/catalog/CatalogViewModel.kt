package com.foodtruck.pos.ui.catalog

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.foodtruck.pos.data.local.entity.AddonGroupEntity
import com.foodtruck.pos.data.local.entity.CategoryEntity
import com.foodtruck.pos.data.local.entity.ModifierGroupEntity
import com.foodtruck.pos.data.local.entity.ProductEntity
import com.foodtruck.pos.data.local.entity.ProductVariantEntity
import com.foodtruck.pos.data.repository.MenuRepository
import com.foodtruck.pos.data.repository.ProductRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CatalogUiState(
    val categories: List<CategoryEntity> = emptyList(),
    val products: List<ProductEntity> = emptyList(),
    val message: String? = null,
    val modifierGroups: List<ModifierGroupEntity> = emptyList(),
    val addonGroups: List<AddonGroupEntity> = emptyList()
)

data class ProductVariantDraft(val name: String, val price: Double)

@HiltViewModel
class CatalogViewModel @Inject constructor(
    private val productRepository: ProductRepository,
    private val menuRepository: MenuRepository
) : ViewModel() {

    private val _message = MutableStateFlow<String?>(null)

    val uiState: StateFlow<CatalogUiState> = combine(
        productRepository.observeCategories(),
        productRepository.observeAllProducts(),
        menuRepository.observeModifierGroups(),
        menuRepository.observeAddonGroups(),
        _message
    ) { categories, products, modifierGroups, addonGroups, message ->
        CatalogUiState(categories, products, message, modifierGroups, addonGroups)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), CatalogUiState())

    fun saveCategory(name: String, colorHex: String, sortOrder: Int, id: Long = 0) {
        if (name.isBlank()) return
        viewModelScope.launch {
            productRepository.saveCategory(
                CategoryEntity(id = id, name = name.trim(), colorHex = colorHex, sortOrder = sortOrder)
            )
            _message.value = "Category saved"
        }
    }

    fun saveProduct(
        name: String,
        price: Double,
        categoryId: Long?,
        taxRate: Double,
        isOpenPrice: Boolean,
        sortOrder: Int,
        variants: List<ProductVariantDraft>,
        modifierGroupIds: List<Long>,
        addonGroupIds: List<Long>,
        id: Long = 0
    ) {
        if (name.isBlank()) return
        viewModelScope.launch {
            val productId = productRepository.upsertProduct(
                ProductEntity(
                    id = id,
                    name = name.trim(),
                    categoryId = categoryId,
                    price = price,
                    taxRate = taxRate,
                    isOpenPrice = isOpenPrice,
                    sortOrder = sortOrder
                )
            )
            val variantEntities = variants.filter { it.name.isNotBlank() }.map {
                ProductVariantEntity(productId = productId, name = it.name.trim(), price = it.price)
            }
            menuRepository.replaceProductVariants(productId, variantEntities)
            menuRepository.setProductModifierLinks(productId, modifierGroupIds)
            menuRepository.setProductAddonLinks(productId, addonGroupIds)
            _message.value = "Product saved"
        }
    }

    suspend fun loadProductVariants(productId: Long): List<ProductVariantDraft> =
        menuRepository.getVariantsForProduct(productId).map { ProductVariantDraft(it.name, it.price) }

    suspend fun loadProductModifierIds(productId: Long): List<Long> =
        menuRepository.getProductModifierGroupIds(productId)

    suspend fun loadProductAddonIds(productId: Long): List<Long> =
        menuRepository.getProductAddonGroupIds(productId)

    fun deleteCategory(id: Long) {
        viewModelScope.launch {
            productRepository.deleteCategory(id)
            _message.value = "Category removed"
        }
    }

    fun deleteProduct(id: Long) {
        viewModelScope.launch {
            productRepository.deleteProduct(id)
            _message.value = "Product removed"
        }
    }

    fun clearMessage() {
        _message.value = null
    }
}

val CategoryColorPresets = listOf(
    "#5B9BD5" to "Blue",
    "#E8923A" to "Orange",
    "#C75B9E" to "Pink",
    "#7B68A6" to "Purple",
    "#6B8E6B" to "Green",
    "#D94F4F" to "Red",
    "#4AA8A8" to "Teal"
)
