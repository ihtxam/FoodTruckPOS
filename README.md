# Food Truck POS

A native Android Point of Sale app built for food trucks and small businesses. Optimized for fast touchscreen checkout � similar simplicity to SumUp mPOS.

## Features

- **One-screen checkout** � categories, product grid, cart, and CASH/CARD buttons always visible
- **Offline-first** � Room SQLite database, works without internet
- **Sync-ready** � pending transactions queue for backend sync when online
- **Product variants** � Coffee (S/M/L), Pizza (Regular/Large/Family)
- **Open price products** � custom services, donations, misc items
- **Cart** � quantity, discounts (% or fixed), tax calculation
- **Payments** � cash flow, card via Tap-to-Pay or Adyen Terminal API (integration stubs)
- **Receipts** � QR digital receipt, Bluetooth ESC/POS thermal printing
- **Role-based access** � Admin, Manager, Cashier
- **Auth** � PIN, email/password, biometric
- **Settings** � business info, currency (CHF/EUR/USD/GBP/AED/CAD), runtime language switch
- **Reports** � daily sales, top products, cashier performance
- **Dashboard** � today's revenue, transaction count, cash vs card

## Tech Stack

| Layer | Technology |
|-------|------------|
| Language | Kotlin |
| UI | Jetpack Compose + Material Design 3 |
| Database | Room (SQLite) |
| DI | Hilt |
| State | ViewModel + StateFlow |
| Images | Coil |
| QR | ZXing |
| Networking | Retrofit + OkHttp (sync-ready) |

## Getting Started

### Requirements

- Android Studio Ladybug (2024.2+) or newer
- JDK 17
- Android SDK 35
- Device/emulator API 26+

### Open & Run

1. In Android Studio, choose **File ? Open** and select the **`FoodTruckPOS`** folder (not the parent `Downloads` folder).
2. When prompted, trust the project and wait for **Gradle Sync** to finish.
3. Go to **Settings ? Build, Execution, Deployment ? Build Tools ? Gradle** and set **Gradle JDK** to **Embedded JDK (17)**. Do **not** use JDK 24+ or OpenJDK 26.
4. Click **File ? Sync Project with Gradle Files**.
5. Select the **`app`** run configuration in the toolbar and run on a device/emulator.

> **"No module" error?** This usually means Gradle sync did not complete. Ensure `gradlew.bat` exists in the project root, then re-sync. Do not open the parent `Downloads` directory as the project root.

### Demo Login

| Role | PIN | Email |
|------|-----|-------|
| Admin | `1234` | `admin@foodtruck.local` / `admin123` |
| Cashier | `0000` | � |

## Project Structure

```
app/src/main/java/com/foodtruck/pos/
??? data/           # Room entities, DAOs, repositories
??? domain/model/   # Cart, reports, enums
??? ui/
?   ??? pos/        # Main checkout screen
?   ??? auth/       # Login
?   ??? settings/   # Business & payment config
?   ??? reports/    # Sales analytics
?   ??? dashboard/  # Today overview
??? payment/        # Tap-to-Pay, Adyen, cash
??? printer/        # Bluetooth ESC/POS
??? receipt/        # QR generation
??? sync/           # Offline sync queue
```

## Production Integrations (Next Steps)

These are scaffolded with simulation � replace with real SDKs:

1. **Tap-to-Pay** � `TapToPayService.kt` ? Stripe Terminal, Adyen Tap-to-Pay, or SumUp SDK
2. **Adyen Terminal** � `AdyenTerminalService.kt` ? [Terminal API](https://docs.adyen.com/point-of-sale/design-your-integration/choose-your-architecture/terminal-api/)
3. **Backend sync** � `SyncService.kt` ? Retrofit REST API
4. **Digital receipts** � host receipt page at `receiptBaseUrl` in settings
5. **Bluetooth printers** � pair printer in Settings ? Test Print

## Performance Targets

- App launch < 2s
- Checkout < 5s (cash path)
- Supports 10,000+ products and 100,000+ transactions (indexed Room schema)

## License

Private � for your food truck business.
