package com.chaslay.pos.data.repository

import com.chaslay.pos.data.local.dao.AddonGroupDao
import com.chaslay.pos.data.local.dao.AddonOptionDao
import com.chaslay.pos.data.local.dao.CategoryDao
import com.chaslay.pos.data.local.dao.ComboSlotDao
import com.chaslay.pos.data.local.dao.ComboSlotOptionDao
import com.chaslay.pos.data.local.dao.ModifierGroupDao
import com.chaslay.pos.data.local.dao.ModifierOptionDao
import com.chaslay.pos.data.local.dao.ProductAddonGroupDao
import com.chaslay.pos.data.local.dao.ProductDao
import com.chaslay.pos.data.local.dao.ProductModifierGroupDao
import com.chaslay.pos.data.local.dao.ProductVariantDao
import com.chaslay.pos.data.local.entity.AddonGroupEntity
import com.chaslay.pos.data.local.entity.AddonOptionEntity
import com.chaslay.pos.data.local.entity.CategoryEntity
import com.chaslay.pos.data.local.entity.ComboSlotEntity
import com.chaslay.pos.data.local.entity.ComboSlotOptionEntity
import com.chaslay.pos.data.local.entity.ModifierGroupEntity
import com.chaslay.pos.data.local.entity.ModifierOptionEntity
import com.chaslay.pos.data.local.entity.ProductAddonGroupEntity
import com.chaslay.pos.data.local.entity.ProductEntity
import com.chaslay.pos.data.local.entity.ProductModifierGroupEntity
import com.chaslay.pos.data.local.entity.ProductVariantEntity
import com.chaslay.pos.domain.model.AddonGroupModel
import com.chaslay.pos.domain.model.AddonOptionModel
import com.chaslay.pos.domain.model.ComboMealModel
import com.chaslay.pos.domain.model.ComboSlotModel
import com.chaslay.pos.domain.model.ComboSlotOptionModel
import com.chaslay.pos.domain.model.ProductWithVariants
import com.chaslay.pos.domain.model.ModifierGroupModel
import com.chaslay.pos.domain.model.ModifierOptionModel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MenuRepository @Inject constructor(
    private val modifierGroupDao: ModifierGroupDao,
    private val modifierOptionDao: ModifierOptionDao,
    private val addonGroupDao: AddonGroupDao,
    private val addonOptionDao: AddonOptionDao,
    private val productModifierGroupDao: ProductModifierGroupDao,
    private val productAddonGroupDao: ProductAddonGroupDao,
    private val productDao: ProductDao,
    private val productVariantDao: ProductVariantDao,
    private val categoryDao: CategoryDao,
    private val comboSlotDao: ComboSlotDao,
    private val comboSlotOptionDao: ComboSlotOptionDao
) {
    fun observeComboProducts(): Flow<List<ProductEntity>> = productDao.observeCombos()
    fun observeModifierGroups(): Flow<List<ModifierGroupEntity>> = modifierGroupDao.observeActive()

    fun observeAddonGroups(): Flow<List<AddonGroupEntity>> = addonGroupDao.observeActive()

    suspend fun getModifierGroupWithOptions(groupId: Long): ModifierGroupModel? {
        val group = modifierGroupDao.getById(groupId) ?: return null
        val options = modifierOptionDao.getByGroup(groupId).map { it.toModel() }
        val productIds = productModifierGroupDao.getProductIdsForGroup(groupId)
        return group.toModel(options, productIds)
    }

    suspend fun getAddonGroupWithOptions(groupId: Long): AddonGroupModel? {
        val group = addonGroupDao.getById(groupId) ?: return null
        val options = addonOptionDao.getByGroup(groupId).map { it.toModel() }
        val productIds = productAddonGroupDao.getProductIdsForGroup(groupId)
        return group.toModel(options, productIds)
    }

    suspend fun saveModifierGroup(
        group: ModifierGroupEntity,
        options: List<ModifierOptionEntity>,
        linkedProductIds: List<Long>
    ): Long {
        val id = if (group.id == 0L) modifierGroupDao.insert(group) else {
            modifierGroupDao.update(group)
            group.id
        }
        modifierOptionDao.deleteByGroup(id)
        if (options.isNotEmpty()) {
            modifierOptionDao.insertAll(options.mapIndexed { index, opt ->
                opt.copy(groupId = id, sortOrder = index)
            })
        }
        productModifierGroupDao.deleteByGroup(id)
        if (linkedProductIds.isNotEmpty()) {
            productModifierGroupDao.insertAll(
                linkedProductIds.mapIndexed { index, productId ->
                    ProductModifierGroupEntity(productId = productId, groupId = id, sortOrder = index)
                }
            )
        }
        return id
    }

    suspend fun saveAddonGroup(
        group: AddonGroupEntity,
        options: List<AddonOptionEntity>,
        linkedProductIds: List<Long>
    ): Long {
        val id = if (group.id == 0L) addonGroupDao.insert(group) else {
            addonGroupDao.update(group)
            group.id
        }
        addonOptionDao.deleteByGroup(id)
        if (options.isNotEmpty()) {
            addonOptionDao.insertAll(options.mapIndexed { index, opt ->
                opt.copy(groupId = id, sortOrder = index)
            })
        }
        productAddonGroupDao.deleteByGroup(id)
        if (linkedProductIds.isNotEmpty()) {
            productAddonGroupDao.insertAll(
                linkedProductIds.mapIndexed { index, productId ->
                    ProductAddonGroupEntity(productId = productId, groupId = id, sortOrder = index)
                }
            )
        }
        return id
    }

    suspend fun deleteModifierGroup(id: Long) = modifierGroupDao.deactivate(id)

    suspend fun deleteAddonGroup(id: Long) = addonGroupDao.deactivate(id)

    suspend fun setModifierOptionInStock(optionId: Long, inStock: Boolean) {
        modifierOptionDao.setInStock(optionId, inStock)
    }

    suspend fun setAddonOptionInStock(optionId: Long, inStock: Boolean) {
        addonOptionDao.setInStock(optionId, inStock)
    }

    suspend fun getModifierGroupsForProduct(productId: Long): List<ModifierGroupModel> {
        val groups = productModifierGroupDao.getGroupsForProduct(productId)
        return groups.map { group ->
            val options = modifierOptionDao.getByGroup(group.id).map { it.toModel() }
            group.toModel(options, emptyList())
        }
    }

    suspend fun getAddonGroupsForProduct(productId: Long): List<AddonGroupModel> {
        val groups = productAddonGroupDao.getGroupsForProduct(productId)
        return groups.map { group ->
            val options = addonOptionDao.getByGroup(group.id).map { it.toModel() }
            group.toModel(options, emptyList())
        }
    }

    suspend fun setProductModifierLinks(productId: Long, groupIds: List<Long>) {
        productModifierGroupDao.deleteByProduct(productId)
        if (groupIds.isNotEmpty()) {
            productModifierGroupDao.insertAll(
                groupIds.mapIndexed { index, groupId ->
                    ProductModifierGroupEntity(productId = productId, groupId = groupId, sortOrder = index)
                }
            )
        }
    }

    suspend fun setProductAddonLinks(productId: Long, groupIds: List<Long>) {
        productAddonGroupDao.deleteByProduct(productId)
        if (groupIds.isNotEmpty()) {
            productAddonGroupDao.insertAll(
                groupIds.mapIndexed { index, groupId ->
                    ProductAddonGroupEntity(productId = productId, groupId = groupId, sortOrder = index)
                }
            )
        }
    }

    suspend fun getProductModifierGroupIds(productId: Long): List<Long> =
        productModifierGroupDao.getGroupsForProduct(productId).map { it.id }

    suspend fun getProductAddonGroupIds(productId: Long): List<Long> =
        productAddonGroupDao.getGroupsForProduct(productId).map { it.id }

    suspend fun reorderCategories(orderedIds: List<Long>) {
        val categories = categoryDao.observeActive().first()
        orderedIds.forEachIndexed { index, id ->
            categories.find { it.id == id }?.let { categoryDao.update(it.copy(sortOrder = index)) }
        }
    }

    suspend fun reorderProductsInCategory(categoryId: Long, orderedIds: List<Long>) {
        orderedIds.forEachIndexed { index, id ->
            productDao.getById(id)?.let { product ->
                if (product.categoryId == categoryId) {
                    productDao.update(product.copy(sortOrder = index, updatedAt = System.currentTimeMillis()))
                }
            }
        }
    }

    suspend fun replaceProductVariants(productId: Long, variants: List<ProductVariantEntity>) {
        productVariantDao.deactivateByProduct(productId)
        if (variants.isNotEmpty()) {
            productVariantDao.insertAll(variants.mapIndexed { index, v ->
                v.copy(productId = productId, sortOrder = index, isActive = true)
            })
        }
    }

    suspend fun getVariantsForProduct(productId: Long): List<ProductVariantEntity> =
        productVariantDao.getByProduct(productId)

    suspend fun countProductsLinkedToModifierGroup(groupId: Long): Int =
        productModifierGroupDao.getProductIdsForGroup(groupId).size

    suspend fun countProductsLinkedToAddonGroup(groupId: Long): Int =
        productAddonGroupDao.getProductIdsForGroup(groupId).size

    suspend fun getAllProducts(): List<ProductEntity> = productDao.observeAllActive().first()

    suspend fun getAllCategories(): List<CategoryEntity> = categoryDao.observeActive().first()

    data class ComboSlotDraft(
        val name: String,
        val minPick: Int,
        val maxPick: Int,
        val productIds: List<Long>
    )

    suspend fun getComboMeal(comboProductId: Long): ComboMealModel? {
        val product = productDao.getById(comboProductId) ?: return null
        if (!product.isCombo) return null
        val categoryName = product.categoryId?.let { cid ->
            categoryDao.observeActive().first().find { it.id == cid }?.name
        }
        val slots = comboSlotDao.getByComboProduct(comboProductId).map { slot ->
            val options = comboSlotOptionDao.getBySlot(slot.id).mapNotNull { opt ->
                val p = productDao.getById(opt.productId) ?: return@mapNotNull null
                ComboSlotOptionModel(opt.id, p.id, p.name)
            }
            ComboSlotModel(slot.id, slot.name, slot.minPick, slot.maxPick, options)
        }
        return ComboMealModel(
            product = product.toComboModel(categoryName),
            slots = slots
        )
    }

    suspend fun saveComboMeal(
        product: ProductEntity,
        slots: List<ComboSlotDraft>
    ): Long {
        val comboProduct = product.copy(isCombo = true, isOpenPrice = false, isWeighed = false)
        val productId = if (comboProduct.id == 0L) {
            productDao.insert(comboProduct)
        } else {
            productDao.update(comboProduct.copy(updatedAt = System.currentTimeMillis()))
            comboProduct.id
        }
        comboSlotOptionDao.deleteByComboProduct(productId)
        comboSlotDao.deleteByComboProduct(productId)
        slots.forEachIndexed { slotIndex, draft ->
            if (draft.name.isBlank()) return@forEachIndexed
            val slotId = comboSlotDao.insert(
                ComboSlotEntity(
                    comboProductId = productId,
                    name = draft.name.trim(),
                    minPick = draft.minPick.coerceAtLeast(0),
                    maxPick = draft.maxPick.coerceAtLeast(1),
                    sortOrder = slotIndex
                )
            )
            val options = draft.productIds.mapIndexed { optIndex, pid ->
                ComboSlotOptionEntity(slotId = slotId, productId = pid, sortOrder = optIndex)
            }
            if (options.isNotEmpty()) comboSlotOptionDao.insertAll(options)
        }
        return productId
    }

    suspend fun deleteComboMeal(productId: Long) {
        comboSlotOptionDao.deleteByComboProduct(productId)
        comboSlotDao.deleteByComboProduct(productId)
        productDao.deactivate(productId)
    }

    private fun ProductEntity.toComboModel(categoryName: String?) = ProductWithVariants(
        id = id,
        name = name,
        sku = sku,
        barcode = barcode,
        categoryId = categoryId,
        categoryName = categoryName,
        taxRate = taxRate,
        price = price,
        costPrice = costPrice,
        imageUri = imageUri,
        isActive = isActive,
        isOpenPrice = isOpenPrice,
        isWeighed = isWeighed,
        isCombo = isCombo,
        variants = emptyList()
    )

    private fun ModifierGroupEntity.toModel(options: List<ModifierOptionModel>, productIds: List<Long>) =
        ModifierGroupModel(
            id = id,
            name = name,
            limitQuantity = limitQuantity,
            required = required,
            options = options,
            linkedProductIds = productIds
        )

    private fun ModifierOptionEntity.toModel() = ModifierOptionModel(id = id, name = name, inStock = inStock)

    private fun AddonGroupEntity.toModel(options: List<AddonOptionModel>, productIds: List<Long>) =
        AddonGroupModel(
            id = id,
            name = name,
            limitQuantity = limitQuantity,
            required = required,
            allowMultipleSame = allowMultipleSame,
            options = options,
            linkedProductIds = productIds
        )

    private fun AddonOptionEntity.toModel() = AddonOptionModel(
        id = id,
        name = name,
        price = price,
        inStock = inStock
    )
}
