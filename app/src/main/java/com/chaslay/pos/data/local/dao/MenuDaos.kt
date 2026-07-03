package com.chaslay.pos.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.chaslay.pos.data.local.entity.AddonGroupEntity
import com.chaslay.pos.data.local.entity.AddonOptionEntity
import com.chaslay.pos.data.local.entity.ModifierGroupEntity
import com.chaslay.pos.data.local.entity.ModifierOptionEntity
import com.chaslay.pos.data.local.entity.ProductAddonGroupEntity
import com.chaslay.pos.data.local.entity.ProductModifierGroupEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ModifierGroupDao {
    @Query("SELECT * FROM modifier_groups WHERE isActive = 1 ORDER BY sortOrder, name")
    fun observeActive(): Flow<List<ModifierGroupEntity>>

    @Query("SELECT * FROM modifier_groups WHERE id = :id LIMIT 1")
    suspend fun getById(id: Long): ModifierGroupEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(group: ModifierGroupEntity): Long

    @Update
    suspend fun update(group: ModifierGroupEntity)

    @Query("UPDATE modifier_groups SET isActive = 0 WHERE id = :id")
    suspend fun deactivate(id: Long)
}

@Dao
interface ModifierOptionDao {
    @Query("SELECT * FROM modifier_options WHERE groupId = :groupId AND isActive = 1 ORDER BY sortOrder, name")
    suspend fun getByGroup(groupId: Long): List<ModifierOptionEntity>

    @Query("SELECT * FROM modifier_options WHERE groupId = :groupId AND isActive = 1 ORDER BY sortOrder, name")
    fun observeByGroup(groupId: Long): Flow<List<ModifierOptionEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(options: List<ModifierOptionEntity>)

    @Query("DELETE FROM modifier_options WHERE groupId = :groupId")
    suspend fun deleteByGroup(groupId: Long)

    @Query("UPDATE modifier_options SET inStock = :inStock WHERE id = :id")
    suspend fun setInStock(id: Long, inStock: Boolean)
}

@Dao
interface AddonGroupDao {
    @Query("SELECT * FROM addon_groups WHERE isActive = 1 ORDER BY sortOrder, name")
    fun observeActive(): Flow<List<AddonGroupEntity>>

    @Query("SELECT * FROM addon_groups WHERE id = :id LIMIT 1")
    suspend fun getById(id: Long): AddonGroupEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(group: AddonGroupEntity): Long

    @Update
    suspend fun update(group: AddonGroupEntity)

    @Query("UPDATE addon_groups SET isActive = 0 WHERE id = :id")
    suspend fun deactivate(id: Long)
}

@Dao
interface AddonOptionDao {
    @Query("SELECT * FROM addon_options WHERE groupId = :groupId AND isActive = 1 ORDER BY sortOrder, name")
    suspend fun getByGroup(groupId: Long): List<AddonOptionEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(options: List<AddonOptionEntity>)

    @Query("DELETE FROM addon_options WHERE groupId = :groupId")
    suspend fun deleteByGroup(groupId: Long)

    @Query("UPDATE addon_options SET inStock = :inStock WHERE id = :id")
    suspend fun setInStock(id: Long, inStock: Boolean)
}

@Dao
interface ProductModifierGroupDao {
    @Query(
        """
        SELECT mg.* FROM modifier_groups mg
        INNER JOIN product_modifier_groups pmg ON pmg.groupId = mg.id
        WHERE pmg.productId = :productId AND mg.isActive = 1
        ORDER BY pmg.sortOrder, mg.sortOrder, mg.name
        """
    )
    suspend fun getGroupsForProduct(productId: Long): List<ModifierGroupEntity>

    @Query("SELECT productId FROM product_modifier_groups WHERE groupId = :groupId")
    suspend fun getProductIdsForGroup(groupId: Long): List<Long>

    @Query("DELETE FROM product_modifier_groups WHERE groupId = :groupId")
    suspend fun deleteByGroup(groupId: Long)

    @Query("DELETE FROM product_modifier_groups WHERE productId = :productId")
    suspend fun deleteByProduct(productId: Long)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(links: List<ProductModifierGroupEntity>)
}

@Dao
interface ProductAddonGroupDao {
    @Query(
        """
        SELECT ag.* FROM addon_groups ag
        INNER JOIN product_addon_groups pag ON pag.groupId = ag.id
        WHERE pag.productId = :productId AND ag.isActive = 1
        ORDER BY pag.sortOrder, ag.sortOrder, ag.name
        """
    )
    suspend fun getGroupsForProduct(productId: Long): List<AddonGroupEntity>

    @Query("SELECT productId FROM product_addon_groups WHERE groupId = :groupId")
    suspend fun getProductIdsForGroup(groupId: Long): List<Long>

    @Query("DELETE FROM product_addon_groups WHERE groupId = :groupId")
    suspend fun deleteByGroup(groupId: Long)

    @Query("DELETE FROM product_addon_groups WHERE productId = :productId")
    suspend fun deleteByProduct(productId: Long)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(links: List<ProductAddonGroupEntity>)
}
