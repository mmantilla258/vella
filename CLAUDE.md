# Vella

Tienda de cosmética en Colombia. Miguel está aprendiendo: explica los cambios en español, en pasos cortos,
y pide confirmación antes de decisiones que no se puedan deshacer.

## Stack
- HTML, CSS y JavaScript vanilla, sin frameworks, npm ni paso de build. Miguel no tiene Node.js.
- Hosting: GitHub Pages (repositorio público). No hacer `git push` sin que Miguel lo pida.
- Firebase plan Spark, SDK modular por CDN fijado en `12.19.0`. Sin Firebase Storage: las fotos nuevas se reducen
  en el navegador y se guardan como data URL en `productos/{id}.foto`.
- Firebase ya está conectado (proyecto `vella-1f2dd`). Si `config.js` queda sin `apiKey`, todo vuelve al modo demo (localStorage).
- Al cambiar un `.js` o `.css`, subir el número `?v=` en el `<script>` / `<link>` de `index.html` e `inventario.html`;
  si no, el navegador sigue usando la copia vieja.
- Probar en local: `python -m http.server 8123` y abrir `http://localhost:8123/inventario.html`.

## Datos
- `productos/{id}`: público, lo lee la tienda.
- `privado/{id}`: costos, cantidad, competencia y proveedores. Nunca debe ser público.
- `movimientos/{id}`: historial; se agrega, no se edita ni se borra.
- `usuarios/{uid}`: `{ nombre, rol }` con rol `admin` o `socio`; se crea a mano en la consola.
- La cantidad solo cambia con movimientos (`moverStock`), dentro de una transacción.
- `firestore.rules` es la copia de las reglas: si cambia, recordarle a Miguel publicarlas en la consola.

## Roles
- `admin`: todo.
- `socio`: ve todo y registra ventas, entradas y conteos. No edita productos, precios, competencia ni proveedores.

## Negocio
- Canales: web, Instagram, TikTok, Facebook y WhatsApp Business.
- Pagos por Bre-B; sin tarjeta por ahora. El pedido se cierra por WhatsApp.
- Textos sin promesas terapéuticas (nada de "curativo" ni "clínicamente probado" sin soporte).

## Tienda
- `index.html` y `tienda.js` leen solo `productos` con `visible: true`; no cargan Firebase Auth.
- El carrito guarda solo id y cantidad en localStorage; el precio siempre sale del catálogo.
- El pedido se abre en WhatsApp con el mensaje armado. No se guardan datos de clientes.
- `WHATSAPP` y `REDES` están en `config.js`.

## Pendiente
1. Conectar Firebase y probar reglas (ver `CONFIGURAR-FIREBASE.md`).
2. Llenar `WHATSAPP` y `REDES` en `config.js`.
3. Datos legales del vendedor, política de datos y retracto antes de abrir al público.
4. Contenido para redes.
