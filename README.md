# Glam Joyas

Catálogo estático en HTML, CSS y JavaScript. No procesa pagos ni crea cuentas de clientes. Los pedidos se revisan y confirman personalmente por WhatsApp.

## Mantenimiento

- `products.js`: única fuente del catálogo final. Precios base enteros en guaraníes; mantener los SKU para conservar carritos. `groupSkus` identifica piezas, `variants` sus opciones válidas.
- `config.js`: WhatsApp oficial, tasa de promoción y máximo de unidades por opción. La tasa se aplica en precios y textos de ambas páginas.
- `cart-core.js`: validación y cálculo; `app.js`: interfaz y preparación del mensaje. Solo se guardan SKU, variantes y cantidades, no datos del formulario.
- `assets/optimized/` e `image-manifest.js`: copias WebP adaptables. Usar un nombre nuevo cuando se cambie una imagen para renovar caché. Conservar originales aparte para futuras conversiones.
- `index.html` e `informacion.html`: contenido público. Al cambiar el JSON-LD inline, actualizar su hash SHA-256 en `vercel.json`; las pruebas detectan discrepancias.
- `robots.txt`, `sitemap.xml`, canonical y Open Graph apuntan al dominio público. Actualizarlos juntos si se migra el dominio.
- `vercel.json`: CSP, protección contra framing, cabeceras básicas y caché de imágenes. No habilitar scripts inline ni eval. Las asignaciones de funciones a eventos desde archivos JS son compatibles con CSP.
- Los antiguos archivos de correcciones de catálogo y la prueba tipográfica se conservan como referencia, pero `.vercelignore` los excluye del despliegue y ya no se cargan.

## Comprobación local

Requiere Node.js moderno con `node:test`; no hay dependencias npm que instalar.

```
npm test
npm run dev
```

Abrir `http://127.0.0.1:4173`. El servidor local reproduce rutas y cabeceras de seguridad, salvo la actualización obligatoria a HTTPS, que no aplica a su conexión local HTTP. No utilizar este servidor de pruebas como servidor público.

Verificar búsqueda, filtros, opciones, suma/resta/eliminación, persistencia, facturación opcional, teclado y móvil. La prueba de WhatsApp debe interceptar la salida o revisar el mensaje sin enviarlo.

## Límites

Las cantidades máximas no representan inventario disponible. Precio, stock, envío y pago se confirman por WhatsApp. Un pedido enviado por el cliente puede ser modificado por él y siempre requiere comprobación humana. Los secretos y archivos `.env` no deben publicarse. La configuración privada de Vercel, permisos, variables y logs requieren acceso al panel correspondiente.
