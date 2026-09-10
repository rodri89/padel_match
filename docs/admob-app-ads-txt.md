# AdMob app-ads.txt

`app-ads.txt` es un archivo de texto que se hostea en el **sitio web del desarrollador**, no
en la app. Sirve para que los compradores programáticos verifiquen que el inventario de
PadelMatch lo vende realmente su dueño. Sin él, AdMob marca la app como no verificada y
buena parte de la demanda filtra el tráfico.

La copia canónica está en [`app-ads.txt`](./app-ads.txt), en esta misma carpeta. Ese archivo
se sube tal cual, sin modificar.

## Contenido

```
google.com, pub-3758335156050794, DIRECT, f08c47fec0942fa0
```

| Campo | Valor | Qué es |
| --- | --- | --- |
| Dominio | `google.com` | El sistema de anuncios que vende el inventario |
| Publisher ID | `pub-3758335156050794` | Nuestra cuenta de AdMob, **sin** el prefijo `ca-` |
| Relación | `DIRECT` | Somos los dueños directos de la cuenta |
| TAG-ID | `f08c47fec0942fa0` | Certification authority ID de Google (opcional en `DIRECT`, pero es el valor canónico) |

El publisher ID sale de los App IDs en [`src/config/admob.ts`](../src/config/admob.ts):
`ca-app-pub-**3758335156050794**~5609917848` (Android) y `~5418346154` (iOS). Las dos apps
comparten cuenta, así que **este único archivo cubre Android y iOS**. No hay mediación
configurada; si algún día se agrega otra red de anuncios, cada una suma su propia línea.

## Dónde está hosteado

**`https://padelbb.com/app-ads.txt`**

Ese dominio es el que figura en Play Console → Crecimiento → Presencia en la tienda →
Ficha de Store principal → **Sitio web**. Es el único lugar donde AdMob busca.

`padelbb.com` corre **Laravel sobre Hostinger** (hPanel, `server: hcdn`, PHP 8.3). Ojo con
esto, porque es la trampa que ya nos comió un intento: en Laravel el document root **no** es
la carpeta del proyecto (la que tiene `artisan`, `composer.json`, `app/`), sino la subcarpeta
`public/` que está adentro. Un `app-ads.txt` subido al nivel del proyecto nunca se sirve.

**Regla práctica:** el archivo va en la **misma carpeta que `robots.txt`**. Esa carpeta es,
por definición, el document root que ya funciona, así que no hay que adivinar la ruta.
Permisos `644`.

Cómo distinguir si quedó bien sin mirar el navegador: si el archivo existe, el servidor web lo
devuelve como estático (`content-type: text/plain`, con `last-modified` y `etag`, sin
`x-powered-by`). Si no existe, la request cae a PHP y contesta el 404 de Laravel — se
reconoce porque aparece `x-powered-by: PHP/8.3.x` y `content-type: text/html`.

Ojo con el `www`: el crawler de AdMob **descarta los prefijos `www.` y `m.`**, así que va a
pedir el dominio pelado. Si el sitio solo responde con `www`, la verificación falla.

## Re-verificar

Después de subirlo, chequear las cuatro variantes que prueba el crawler:

```bash
DOMINIO=padelbb.com
for u in "http://$DOMINIO/app-ads.txt" "https://$DOMINIO/app-ads.txt" \
         "http://www.$DOMINIO/app-ads.txt" "https://www.$DOMINIO/app-ads.txt"; do
  printf '%s -> %s\n' "$u" "$(curl -sSL -o /dev/null -w '%{http_code} %{content_type}' "$u")"
done
```

Las cuatro tienen que dar `200 text/plain`. Si alguna devuelve `text/html`, el hosting está
sirviendo una página de error (algunos devuelven 200 + HTML en vez de 404), y AdMob no la
parsea.

Confirmar que lo publicado coincide con la copia del repo:

```bash
curl -sSL "https://padelbb.com/app-ads.txt" | diff - docs/app-ads.txt && echo OK
```

Y que `robots.txt` no lo bloquee (`Disallow: /app-ads.txt` o un `Disallow: /` que aplique a
Google).

Recién ahí, en AdMob → Apps → PadelMatch → app-ads.txt → **Buscar actualizaciones**.
El crawl tarda **hasta 24 h**; mientras tanto el estado queda pendiente, y eso no es un fallo.
Si además se cambió la URL del sitio en la ficha de Play, AdMob tarda otras 24 h en detectar
ese cambio.

## Si vuelve a fallar

En este orden:

1. **El archivo quedó fuera del document root de Laravel** — ya nos pasó una vez. Se detecta
   porque el 404 trae `x-powered-by: PHP/8.3.x`. Solución: moverlo junto a `robots.txt`.
2. El dominio de la ficha de Play no es `padelbb.com`.
3. El dominio pelado no resuelve, solo anda con `www`.
4. El hosting sirve HTML o una página de error con status 200.
5. Typo en el publisher ID: 16 dígitos, sin `ca-`, sin el `~` ni el sufijo del App ID.
