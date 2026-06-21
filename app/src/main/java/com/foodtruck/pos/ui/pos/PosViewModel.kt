package com.foodtruck.pos.ui.pos

import android.app.Activity
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.foodtruck.pos.data.local.entity.BusinessSettingsEntity
import com.foodtruck.pos.data.local.entity.CategoryEntity
import com.foodtruck.pos.data.local.entity.ProductEntity
import com.foodtruck.pos.data.local.entity.TransactionEntity
import com.foodtruck.pos.data.preferences.SessionManager
import com.foodtruck.pos.data.repository.CartManager
import com.foodtruck.pos.data.repository.ProductRepository
import com.foodtruck.pos.data.repository.SettingsRepository
import com.foodtruck.pos.data.repository.TransactionRepository
import com.foodtruck.pos.domain.model.CartItem
import com.foodtruck.pos.domain.model.CartSummary
import com.foodtruck.pos.domain.model.PaymentMethod
import com.foodtruck.pos.domain.model.ProductVariantModel
import com.foodtruck.pos.domain.model.ProductWithVariants
import com.foodtruck.pos.payment.CashPaymentService
import com.foodtruck.pos.payment.PaymentOrchestrator
import com.foodtruck.pos.payment.PaymentResult
import com.foodtruck.pos.printer.BluetoothPrinterService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

data class PosUiState(
    val categories: List<CategoryEntity> = emptyList(),
    val products: List<ProductEntity> = emptyList(),
    val selectedCategoryId: Long? = null,
    val cart: CartSummary = CartSummary(emptyList()),
    val settings: BusinessSettingsEntity = BusinessSettingsEntity(),
    val currencySymbol: String = "CHF",
    val isProcessingPayment: Boolean = false,
    val showOpenPriceDialog: Boolean = false,
    val showVariantDialog: Boolean = false,
    val showDiscountDialog: Boolean = false,
    val showPaymentSummary: Boolean = false,
    val showReceiptOptions: Boolean = false,
    val pendingPaymentMethod: PaymentMethod? = null,
    val selectedProduct: ProductWithVariants? = null,
    val lastTransaction: TransactionEntity? = null,
    val errorMessage: String? = null,
    val tapToPayMessage: String? = null
)

@HiltViewModel
class PosViewModel @Inject constructor(
    private val productRepository: ProductRepository,
    private val cartManager: CartManager,
    private val transactionRepository: TransactionRepository,
    private val settingsRepository: SettingsRepository,
    private val sessionManager: SessionManager,
    private val paymentOrchestrator: PaymentOrchestrator,
    private val cashPaymentService: CashPaymentService,
    private val printerService: BluetoothPrinterService
) : ViewModel() {

    private val _selectedCategoryId = MutableStateFlow<Long?>(null)
    private val _uiExtras = MutableStateFlow(PosDialogState())

    private val productsFlow = _selectedCategoryId.flatMapLatest { categoryId ->
        productRepository.observeProducts(categoryId)
    }

    val uiState: StateFlow<PosUiState> = combine(
        combine(
            productRepository.observeCategories(),
            _selectedCategoryId,
            productsFlow
        ) { categories, categoryId, products ->
            Triple(categories, categoryId, products)
        },
        cartManager.cart,
        settingsRepository.observeSettings(),
        _uiExtras
    ) { triple, cart, settings, extras ->
        val (categories, categoryId, products) = triple
        PosUiState(
            categories = categories,
            products = products,
            selectedCategoryId = categoryId,
            cart = cart,
            settings = settings,
            currencySymbol = settings.currencySymbol,
            isProcessingPayment = extras.isProcessingPayment,
            showOpenPriceDialog = extras.showOpenPriceDialog,
            showVariantDialog = extras.showVariantDialog,
            showDiscountDialog = extras.showDiscountDialog,
            showPaymentSummary = extras.showPaymentSummary,
            showReceiptOptions = extras.showReceiptOptions,
            pendingPaymentMethod = extras.pendingPaymentMethod,
            selectedProduct = extras.selectedProduct,
            lastTransaction = extras.lastTransaction,
            errorMessage = extras.errorMessage,
            tapToPayMessage = extras.tapToPayMessage
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), PosUiState())

    fun selectCategory(categoryId: Long?) {
        _selectedCategoryId.value = categoryId
    }

    fun onProductClick(productId: Long) {
        viewModelScope.launch {
            val product = productRepository.getProductWithVariants(productId) ?: return@launch
            when {
                product.isOpenPrice -> updateExtras { it.copy(showOpenPriceDialog = true, selectedProduct = product) }
                product.variants.isNotEmpty() -> updateExtras { it.copy(showVariantDialog = true, selectedProduct = product) }
                else -> addProductToCart(product, null, product.price)
            }
        }
    }

    fun addOpenPriceProduct(price: Double) {
        val product = _uiExtras.value.selectedProduct ?: return
        addProductToCart(product, null, price)
        dismissDialogs()
    }

    fun addVariantProduct(variant: ProductVariantModel) {
        val product = _uiExtras.value.selectedProduct ?: return
        addProductToCart(product, variant.name, variant.price, variant.sku)
        dismissDialogs()
    }

    private fun addProductToCart(
        product: ProductWithVariants,
        variantName: String?,
        price: Double,
        sku: String? = product.sku
    ) {
        cartManager.addItem(
            CartItem(
                id = UUID.randomUUID().toString(),
                productId = product.id,
                productName = product.name,
                variantName = variantName,
                unitPrice = price,
                quantity = 1,
                taxRate = product.taxRate,
                sku = sku
            )
        )
    }

    fun updateQuantity(itemId: String, quantity: Int) = cartManager.updateQuantity(itemId, quantity)
    fun removeItem(itemId: String) = cartManager.removeItem(itemId)

    fun showDiscountDialog() = updateExtras { it.copy(showDiscountDialog = true) }

    fun applyDiscount(percent: Double, amount: Double) {
        cartManager.applyDiscount(percent, amount)
        updateExtras { it.copy(showDiscountDialog = false) }
    }

    fun initiateCashPayment() {
        if (cartManager.snapshot().isEmpty) return
        updateExtras {
            it.copy(showPaymentSummary = true, pendingPaymentMethod = PaymentMethod.CASH, errorMessage = null)
        }
    }

    fun initiateCardPayment() {
        if (cartManager.snapshot().isEmpty) return
        updateExtras {
            it.copy(showPaymentSummary = true, pendingPaymentMethod = PaymentMethod.CARD, errorMessage = null)
        }
    }

    fun confirmPayment(activity: Activity?) {
        val method = _uiExtras.value.pendingPaymentMethod ?: return
        val cart = cartManager.snapshot()
        if (cart.isEmpty) return

        viewModelScope.launch {
            updateExtras { it.copy(isProcessingPayment = true, errorMessage = null) }
            val settings = settingsRepository.getSettings()
            val userId = sessionManager.currentUserId.first() ?: 0L
            val userName = sessionManager.currentUserName.first() ?: "Cashier"

            val paymentResult = when (method) {
                PaymentMethod.CASH -> cashPaymentService.processPayment()
                PaymentMethod.CARD -> {
                    updateExtras { it.copy(tapToPayMessage = "Processing card payment") }
                    paymentOrchestrator.processCardPayment(activity, cart.total, settings.defaultCurrency, settings)
                }
                else -> PaymentResult.Failure("Unsupported payment method")
            }

            when (paymentResult) {
                is PaymentResult.Success -> {
                    val resolvedMethod = if (method == PaymentMethod.CASH) PaymentMethod.CASH else paymentResult.method
                    val transaction = transactionRepository.completeSale(
                        cart = cart,
                        paymentMethod = resolvedMethod,
                        userId = userId,
                        userName = userName,
                        cardReference = paymentResult.reference
                    )
                    cartManager.clear()
                    updateExtras {
                        it.copy(
                            isProcessingPayment = false,
                            showPaymentSummary = false,
                            showReceiptOptions = true,
                            lastTransaction = transaction,
                            pendingPaymentMethod = null,
                            tapToPayMessage = null
                        )
                    }
                }
                is PaymentResult.Failure -> updateExtras {
                    it.copy(isProcessingPayment = false, errorMessage = paymentResult.message, tapToPayMessage = null)
                }
                PaymentResult.Cancelled -> updateExtras {
                    it.copy(isProcessingPayment = false, tapToPayMessage = null)
                }
            }
        }
    }

    fun dismissPaymentSummary() {
        updateExtras { it.copy(showPaymentSummary = false, pendingPaymentMethod = null, errorMessage = null) }
    }

    fun printLastReceipt() {
        viewModelScope.launch {
            val tx = _uiExtras.value.lastTransaction ?: return@launch
            val full = transactionRepository.getTransaction(tx.id) ?: return@launch
            val settings = settingsRepository.getSettings()
            printerService.printReceipt(settings, full.first, full.second)
                .onFailure { e -> updateExtras { it.copy(errorMessage = e.message) } }
            dismissReceiptOptions()
        }
    }

    fun dismissReceiptOptions() {
        updateExtras { it.copy(showReceiptOptions = false, lastTransaction = null) }
    }

    fun dismissDialogs() {
        updateExtras {
            it.copy(
                showOpenPriceDialog = false,
                showVariantDialog = false,
                showDiscountDialog = false,
                selectedProduct = null
            )
        }
    }

    fun clearError() = updateExtras { it.copy(errorMessage = null) }

    private fun updateExtras(block: (PosDialogState) -> PosDialogState) {
        _uiExtras.value = block(_uiExtras.value)
    }

    private data class PosDialogState(
        val isProcessingPayment: Boolean = false,
        val showOpenPriceDialog: Boolean = false,
        val showVariantDialog: Boolean = false,
        val showDiscountDialog: Boolean = false,
        val showPaymentSummary: Boolean = false,
        val showReceiptOptions: Boolean = false,
        val pendingPaymentMethod: PaymentMethod? = null,
        val selectedProduct: ProductWithVariants? = null,
        val lastTransaction: TransactionEntity? = null,
        val errorMessage: String? = null,
        val tapToPayMessage: String? = null
    )
}
