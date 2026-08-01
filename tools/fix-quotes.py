# -*- coding: utf-8 -*-
from pathlib import Path

p = Path("dashboard/src/pages/shop/CheckoutPage.tsx")
t = p.read_text(encoding="utf-8")
bad = "|| 't('shopCouldNotSaveAddress')'"
good = "|| t('shopCouldNotSaveAddress')"
print("found", bad in t)
t = t.replace(bad, good)
p.write_text(t, encoding="utf-8")
print("ok", good in p.read_text(encoding="utf-8"))
