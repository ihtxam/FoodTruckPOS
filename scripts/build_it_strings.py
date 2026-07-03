#!/usr/bin/env python3
from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EN = ROOT / "app/src/main/res/values/strings.xml"
FR = ROOT / "app/src/main/res/values-fr/strings.xml"
IT = ROOT / "app/src/main/res/values-it/strings.xml"

OVERRIDES: dict[str, str] = {
    "login_title": "Accedi",
    "pin_login": "Accesso PIN",
    "email_login": "Accesso e-mail",
    "biometric_login": "Usa biometria",
    "enter_pin": "Inserisci PIN",
    "login_enter_pin_to_continue": "Inserisci il PIN per accedere o cambiare operatore",
    "email": "E-mail",
    "password": "Password",
    "login": "Accedi",
    "invalid_credentials": "Credenziali non valide",
    "pos_title": "Cassa",
    "cart": "Carrello",
    "cart_empty": "Il carrello \u00e8 vuoto",
    "subtotal": "Subtotale",
    "tax": "IVA",
    "discount": "Sconto",
    "total": "Totale",
    "cash": "Contanti",
    "card": "Carta",
    "payment": "Pagamento",
    "all_categories": "Tutti",
    "enter_price": "Inserisci prezzo",
    "select_variant": "Seleziona variante",
    "add_to_cart": "Aggiungi al carrello",
    "quantity": "Qt\u00e0",
    "notes": "Note",
    "apply_discount": "Applica sconto",
    "discount_percent": "Sconto %",
    "discount_amount": "Importo sconto",
    "misc_item": "Varie",
    "receipt": "Scontrino",
    "take_away_delivery": "Asporto / Consegna",
    "table_settings": "Tavoli",
    "table_name": "Nome tavolo",
    "add_table": "Aggiungi tavolo",
    "existing_tables": "%1$d tavoli configurati",
    "item_adjustments": "Sconti articolo",
    "keypad_clear": "CL",
    "keypad_enter": "Invio",
    "settings": "Impostazioni",
    "language_settings": "Lingua",
    "save": "Salva",
    "cancel": "Annulla",
    "confirm": "Conferma",
    "dashboard": "Dashboard",
    "reports": "Report",
    "pos_register": "Cassa",
    "pos_orders": "Ordini",
    "xpress_sale": "Express",
    "ongoing_orders": "Ordini in corso",
    "programmed_orders": "Ordini programmati",
    "checkout_back": "Indietro",
    "checkout_title": "Pagamento",
    "checkout_complete": "Completa pagamento",
    "logout": "Esci",
    "menu": "Menu",
    "admin_hub": "Amministrazione",
    "back_to_pos": "Torna alla cassa",
    "tables": "Tavoli",
    "send_kitchen": "Invia cucina",
    "payment_success": "Pagamento riuscito",
    "payment_failed": "Pagamento non riuscito",
    "print_receipt": "Stampa scontrino",
    "email_receipt": "Invia scontrino via e-mail",
    "done": "Fine",
    "loading": "Caricamento\u2026",
    "delete": "Elimina",
    "edit": "Modifica",
    "new_order": "Nuovo ordine",
    "hold_order": "Sospendi",
    "order_history": "Cronologia ordini",
    "appearance_settings": "Aspetto",
    "theme_light": "Cassa chiara",
    "theme_dark": "Cassa scura",
}


def fr_to_it(text: str) -> str:
    replacements = [
        ("Connexion", "Accesso"),
        ("connexion", "accesso"),
        ("Panier", "Carrello"),
        ("panier", "carrello"),
        ("Param\u00e8tres", "Impostazioni"),
        ("param\u00e8tres", "impostazioni"),
        ("Commandes", "Ordini"),
        ("commandes", "ordini"),
        ("Caisse", "Cassa"),
        ("caisse", "cassa"),
        ("Paiement", "Pagamento"),
        ("paiement", "pagamento"),
        ("Remise", "Sconto"),
        ("remise", "sconto"),
        ("Esp\u00e8ces", "Contanti"),
        ("Carte ", "Carta "),
        ("Carte", "Carta"),
        ("Tous", "Tutti"),
        ("Annuler", "Annulla"),
        ("Enregistrer", "Salva"),
        ("Supprimer", "Elimina"),
        ("Modifier", "Modifica"),
        ("Rechercher", "Cerca"),
        ("Imprimer", "Stampa"),
        ("Table", "Tavolo"),
        ("table", "tavolo"),
        ("Cuisine", "Cucina"),
        ("cuisine", "cucina"),
        ("Rapports", "Report"),
        ("Utilisateur", "Utente"),
        ("utilisateur", "utente"),
        ("Mot de passe", "Password"),
        ("Adresse", "Indirizzo"),
        ("T\u00e9l\u00e9phone", "Telefono"),
        ("Nom", "Nome"),
        ("Quantit\u00e9", "Quantit\u00e0"),
        ("Aujourd'hui", "Oggi"),
        ("Demain", "Domani"),
        ("Oui", "S\u00ec"),
        ("Non", "No"),
        ("Retour", "Indietro"),
        ("Envoyer", "Invia"),
        ("R\u00e9glages", "Impostazioni"),
    ]
    out = text
    for src, dst in replacements:
        out = out.replace(src, dst)
    return out


def escape_xml(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def main() -> None:
    en_root = ET.parse(EN).getroot()
    fr_map = {node.attrib["name"]: node.text or "" for node in ET.parse(FR).getroot().findall("string")}
    lines = ['<?xml version="1.0" encoding="utf-8"?>', "<resources>", '    <string name="app_name">ChaslayPOS</string>']
    for node in en_root.findall("string"):
        name = node.attrib["name"]
        if name == "app_name":
            continue
        if name in OVERRIDES:
            value = OVERRIDES[name]
        elif name in fr_map:
            value = fr_to_it(fr_map[name])
        else:
            value = node.text or ""
        lines.append(f'    <string name="{name}">{escape_xml(value)}</string>')
    lines.extend(["</resources>", ""])
    IT.parent.mkdir(parents=True, exist_ok=True)
    IT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {IT}")


if __name__ == "__main__":
    main()
