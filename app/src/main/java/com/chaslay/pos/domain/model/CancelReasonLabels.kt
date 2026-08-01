package com.chaslay.pos.domain.model

/** Localized cancel-order reasons (stable ids 1–6 from DB seed). */
object CancelReasonLabels {
    private val reasonIds = listOf(1L, 2L, 3L, 4L, 5L, 6L)

    fun localizedLabels(languageCode: String): List<String> =
        reasonIds.map { localizedLabel(it, languageCode) }

    fun localizedLabel(id: Long, languageCode: String): String {
        val index = (id - 1).toInt().coerceIn(0, 5)
        return when (AppLanguage.fromCode(languageCode)) {
            AppLanguage.FRENCH -> french()[index]
            AppLanguage.GERMAN -> german()[index]
            AppLanguage.ITALIAN -> italian()[index]
            else -> english()[index]
        }
    }

    private fun english() = listOf(
        "Could not process order",
        "Kitchen too busy",
        "Client cancellation",
        "Out of stock",
        "Wrong order entered",
        "Other"
    )

    private fun french() = listOf(
        "Impossible de traiter la commande",
        "Cuisine trop occupée",
        "Annulation client",
        "Rupture de stock",
        "Mauvaise commande saisie",
        "Autre"
    )

    private fun german() = listOf(
        "Bestellung konnte nicht bearbeitet werden",
        "Küche überlastet",
        "Stornierung durch Kunde",
        "Nicht auf Lager",
        "Falsche Bestellung erfasst",
        "Sonstiges"
    )

    private fun italian() = listOf(
        "Impossibile elaborare l'ordine",
        "Cucina troppo occupata",
        "Annullamento cliente",
        "Esaurito",
        "Ordine errato inserito",
        "Altro"
    )
}
