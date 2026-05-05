# Időzítő PWA

Egyszerű, modern időzítő alkalmazás iPhone-ra (és bármilyen más eszközre).

## Funkciók

✅ Perc és másodperc beállítás
✅ Gyors preset gombok (1, 5, 10, 15 perc)
✅ Szünet/folytatás
✅ Hang és vibráció amikor lejár
✅ Push értesítés
✅ Képernyő ébren tartása futás közben
✅ Offline működés
✅ Telepíthető a home screen-re

## Telepítés iPhone-ra

1. **Fájlok feltöltése webtárhelyre:**
   - Tölts fel minden fájlt egy webtárhelyre (pl. GitHub Pages, Netlify, Vercel)
   - VAGY futtasd lokálisan (lásd lent)

2. **Megnyitás Safari-ban:**
   - Nyisd meg az URL-t Safari böngészőben (NEM Chrome!)
   
3. **Telepítés:**
   - Koppints a "Megosztás" gombra (négyzet nyíllal)
   - Görgess le és válaszd: "Hozzáadás a kezdőképernyőhöz"
   - Koppints "Hozzáadás"

4. **Kész!** Az ikon megjelenik a home screen-en, mint egy natív app.

## Lokális futtatás (teszteléshez)

Ha van Python telepítve:

```bash
python -m http.server 8000
```

Vagy Node.js-sel:

```bash
npx serve
```

Aztán nyisd meg: `http://localhost:8000`

## Ikonok létrehozása

Az `icon-192.png` és `icon-512.png` fájlokat létre kell hozni.
Használhatsz bármilyen képszerkesztőt, vagy online generátort:
- https://www.pwabuilder.com/imageGenerator
- https://favicon.io/

Vagy egyszerűen használj egy emoji-t nagy méretben! 😄

## Megjegyzések

- **Safari-t használj!** Chrome-ban nem fog működni az iOS-en a telepítés.
- Az értesítésekhez engedélyt kell adni első indításkor.
- A képernyő ébren tartása csak HTTPS-en működik (vagy localhost-on).
- Offline is működik a telepítés után!

## Hibaelhárítás

**Nem jelenik meg a "Hozzáadás a kezdőképernyőhöz" opció:**
- Bizonyosodj meg róla, hogy Safari-t használsz
- Ellenőrizd, hogy HTTPS-en fut (vagy localhost)

**Nem jön értesítés:**
- Engedélyezd az értesítéseket amikor kéri
- Beállítások → Safari → Értesítések

**Nem marad ébren a képernyő:**
- Ez csak HTTPS-en működik (nem HTTP-n)
