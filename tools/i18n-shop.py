# -*- coding: utf-8 -*-
from pathlib import Path
import re

def wire_offer_picker():
    path = Path("dashboard/src/components/shop/ShopOfferPicker.tsx")
    text = path.read_text(encoding="utf-8")
    if "useI18n" not in text:
        text = text.replace(
            "import { useMemo, useState } from 'react';\n",
            "import { useMemo, useState } from 'react';\nimport { useI18n } from '@/lib/i18n';\n",
            1,
        )
    if "const { t } = useI18n()" not in text:
        text = text.replace(
            "export default function ShopOfferPicker({ offer, products, priceOf, onClose, onConfirm }: Props) {\n  const rules = offer.rules || {};",
            "export default function ShopOfferPicker({ offer, products, priceOf, onClose, onConfirm }: Props) {\n  const { t } = useI18n();\n  const rules = offer.rules || {};",
            1,
        )
    apo = "\u2019"
    mdash = "\u2014"
    pairs = [
        ("Combo " + mdash + " you" + apo + "ll pick Main etc.", "{t('shopComboPickHint')}"),
        ("No matching products", "{t('shopNoMatchingProducts')}"),
        ('aria-label="Close"', "aria-label={t('close')}"),
        ("Paid " + mdash + " pick {buyQty}", "{t('shopPaidPick').replace('{n}', String(buyQty))}"),
        ("Free " + mdash + " pick {getQty}", "{t('shopFreePick').replace('{n}', String(getQty))}"),
        ("Deal total: CHF {previewTotal.toFixed(2)}", "{t('shopDealTotal')}: CHF {previewTotal.toFixed(2)}"),
        ("package price", "{t('shopPackagePrice')}"),
        ("{getQty} free", "{t('shopNFree').replace('{n}', String(getQty))}"),
        (
            "Select {buyQty} paid{getQty > 0 ? ` and ${getQty} free` : ''} to add this deal to your cart.",
            "{t('shopSelectDealHint').replace('{paid}', String(buyQty)).replace('{freePart}', getQty > 0 ? t('shopAndNFree').replace('{n}', String(getQty)) : '')}",
        ),
        (
            "Combo meals (e.g. Family-first) need Main / Side / Drink picks " + mdash + " you" + apo + "ll choose those next.",
            "{t('shopComboNextHint')}",
        ),
        ("            Cancel\n", "            {t('cancel')}\n"),
        ("            Add to cart\n", "            {t('shopAddToCart')}\n"),
    ]
    for a, b in pairs:
        if a not in text:
            print("MISSING OfferPicker:", ascii(a[:80]))
        else:
            text = text.replace(a, b, 1)
            print("OK OfferPicker:", ascii(a[:40]))
    path.write_text(text, encoding="utf-8")

def wire_ordering_checkout():
    mdash = "\u2014"
    minus = "\u2212"
    for path, pairs in [
        (
            "dashboard/src/pages/shop/OrderingPage.tsx",
            [
                ("{block.offerBadge || 'Offer'}", "{block.offerBadge || t('shopOffer')}"),
                ("Deal locked " + mdash + " remove as a set", "{t('shopDealLocked')}"),
                ("                        Remove\n", "                        {t('shopRemove')}\n"),
                ("                      <span>Deal total</span>", "                      <span>{t('shopDealTotal')}</span>"),
                (
                    '<h2 className="text-sm font-bold uppercase tracking-wide text-amber-800">Offers</h2>',
                    '<h2 className="text-sm font-bold uppercase tracking-wide text-amber-800">{t(\'shopOffers\')}</h2>',
                ),
                ("result.offerBadge || 'Offer'", "result.offerBadge || t('shopOffer')"),
            ],
        ),
        (
            "dashboard/src/pages/shop/CheckoutPage.tsx",
            [
                (
                    "{(offerLabels.join(', ') || 'Offer') + `: " + minus + " CHF ${offerDiscount.toFixed(2)}`}",
                    "{(offerLabels.join(', ') || t('shopOffer')) + `: " + minus + " CHF ${offerDiscount.toFixed(2)}`}",
                ),
                ("Deal locked " + mdash + " remove as a set", "{t('shopDealLocked')}"),
                ("                          <span>Deal total</span>", "                          <span>{t('shopDealTotal')}</span>"),
                ("                      <span>Deal total</span>", "                      <span>{t('shopDealTotal')}</span>"),
                ("<span>{offerLabels.join(', ') || 'Offer'}</span>", "<span>{offerLabels.join(', ') || t('shopOffer')}</span>"),
                ("Could not save address", "t('shopCouldNotSaveAddress')"),
            ],
        ),
    ]:
        p = Path(path)
        text = p.read_text(encoding="utf-8")
        for a, b in pairs:
            if a not in text:
                print("MISSING", path, ascii(a[:70]))
            else:
                text = text.replace(a, b, 1)
                print("OK", path, ascii(a[:40]))
        text = text.replace("{block.offerBadge || 'Offer'}", "{block.offerBadge || t('shopOffer')}")
        p.write_text(text, encoding="utf-8")

def wire_modifiers():
    path = Path("dashboard/src/components/shop/ShopProductModifiersModal.tsx")
    text = path.read_text(encoding="utf-8")
    if "useI18n" not in text:
        text = text.replace(
            "import { useMemo, useState } from 'react';\n",
            "import { useMemo, useState } from 'react';\nimport { useI18n } from '@/lib/i18n';\n",
            1,
        )
    if "const { t } = useI18n()" not in text:
        text = text.replace(
            "export default function ShopProductModifiersModal({ product, onClose, onConfirm }: Props) {\n",
            "export default function ShopProductModifiersModal({ product, onClose, onConfirm }: Props) {\n  const { t } = useI18n();\n",
            1,
        )
    mid = "\u00b7"
    pairs = [
        (
            '            ? `Please choose an option for "${g.title}"`\n'
            '            : `Please choose at least ${min} options for "${g.title}"`',
            "            ? t('shopChooseOptionFor').replace('{name}', g.title)\n"
            "            : t('shopChooseOptionFor').replace('{name}', g.title)",
        ),
        ('setError(`Too many options for "${g.title}"`);', "setError(t('shopTooManyOptions').replace('{name}', g.title));"),
        ("Customize your item", "{t('shopCustomizeItem')}"),
        ("            Close\n", "            {t('close')}\n"),
        (
            "{g.selectionType === 'required' || min > 0 ? 'Required' : 'Optional'}\n"
            "                    {max > 1 ? ` " + mid + " up to ${max}` : ''}",
            "{g.selectionType === 'required' || min > 0 ? t('shopRequired') : t('shopOptional')}\n"
            "                    {max > 1 ? ` " + mid + " ${t('shopUpTo').replace('{n}', String(max))}` : ''}",
        ),
        ("{opt.price > 0 ? `+CHF ${opt.price.toFixed(2)}` : 'Included'}", "{opt.price > 0 ? `+CHF ${opt.price.toFixed(2)}` : t('shopIncluded')}"),
        ("Item total", "{t('shopItemTotal')}"),
        ("            Add to basket\n", "            {t('shopAddToBasket')}\n"),
    ]
    for a, b in pairs:
        if a not in text:
            print("MISSING Modifiers:", ascii(a[:70]))
        else:
            text = text.replace(a, b, 1)
            print("OK Modifiers:", ascii(a[:40]))
    text = text.replace(
        '<h3 className="font-semibold text-stone-900">{g.title}</h3>',
        "<h3 className=\"font-semibold text-stone-900\">{g.title === 'Extras' ? t('shopExtras') : g.title}</h3>",
        1,
    )
    path.write_text(text, encoding="utf-8")

def wire_combo():
    path = Path("dashboard/src/components/shop/ShopComboWizard.tsx")
    text = path.read_text(encoding="utf-8")
    if "useI18n" not in text:
        text = text.replace(
            "import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';\n",
            "import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';\nimport { useI18n } from '@/lib/i18n';\n",
            1,
        )
    if "const { t } = useI18n()" not in text:
        m = re.search(r"export default function ShopComboWizard\(", text)
        if m:
            brace = text.find("{", m.end())
            nl = text.find("\n", brace) + 1
            text = text[:nl] + "  const { t } = useI18n();\n" + text[nl:]
    mid = "\u00b7"
    arrow = "\u2190"
    pairs = [
        (
            '<p className="text-xs font-semibold uppercase tracking-wide text-teal-800">Combo</p>',
            '<p className="text-xs font-semibold uppercase tracking-wide text-teal-800">{t(\'shopCombo\')}</p>',
        ),
        (
            "Step {progressLabel} " + mid + " from CHF {product.price.toFixed(2)}",
            "{t('shopStepFrom').replace('{step}', String(progressLabel)).replace('{price}', product.price.toFixed(2))}",
        ),
        ("              Close\n", "              {t('close')}\n"),
        ("Choose one to continue", "{t('shopChooseOneContinue')}"),
        (
            "{opt.extraPrice > 0 ? `+CHF ${opt.extraPrice.toFixed(2)}` : 'Included'}",
            "{opt.extraPrice > 0 ? `+CHF ${opt.extraPrice.toFixed(2)}` : t('shopIncluded')}",
        ),
        (arrow + " Back\n", "{t('shopBack')}\n"),
        ("Add free or paid extras", "{t('shopAddExtras')}"),
        ("Combo extras", "{t('shopComboExtras')}"),
        ("Optional add-ons for the whole meal", "{t('shopComboExtrasHint')}"),
        ("Your combo", "{t('shopYourCombo')}"),
        ("Running total", "{t('shopRunningTotal')}"),
        ("              Continue\n", "              {t('shopContinue')}\n"),
        ("              Review combo\n", "              {t('shopReviewCombo')}\n"),
        ("                Restart\n", "                {t('shopRestart')}\n"),
        (
            "                Add to basket " + mid + " CHF {unitPrice.toFixed(2)}\n",
            "                {t('shopAddToBasketPrice').replace('{price}', unitPrice.toFixed(2))}\n",
        ),
        ("              Back\n", "              {t('shopBack')}\n"),
    ]
    for a, b in pairs:
        if a not in text:
            print("MISSING Combo:", ascii(a[:70]))
        else:
            text = text.replace(a, b, 1)
            print("OK Combo:", ascii(a[:40]))
    path.write_text(text, encoding="utf-8")

def wire_confirmation():
    path = Path("dashboard/src/pages/shop/OrderConfirmationPage.tsx")
    text = path.read_text(encoding="utf-8")
    mdash = "\u2014"
    pairs = [
        (
            "Card payments are not configured for this shop " + mdash + " you can confirm with the demo button.",
            "{t('shopCardNotConfigured')}",
        ),
        (
            "Card payment form unavailable. Try again or pay cash.",
            "{t('shopCardFormUnavailable')}",
        ),
        ("Order not found", "{t('shopOrderNotFound')}"),
    ]
    for a, b in pairs:
        if a not in text:
            print("MISSING Confirm:", ascii(a[:70]))
        else:
            text = text.replace(a, b, 1)
            print("OK Confirm:", ascii(a[:40]))
    path.write_text(text, encoding="utf-8")

if __name__ == "__main__":
    wire_offer_picker()
    wire_ordering_checkout()
    wire_modifiers()
    wire_combo()
    wire_confirmation()
    print("done")
