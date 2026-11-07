# Conectar el inventario a Firebase

Hazlo una sola vez. Mientras no lo hagas, el inventario funciona en **modo demo** y los datos no se comparten con tu socio.

## 1. Crear el proyecto
1. Entra a <https://console.firebase.google.com> y crea un proyecto nuevo, por ejemplo `vella`.
2. No necesitas Google Analytics. Usa el plan gratuito Spark.

## 2. Activar la base de datos
1. Ve a **Firestore Database** y crea la base de datos en **modo producción**.
2. En la pestaña **Reglas**, borra todo, pega el contenido de `firestore.rules` y pulsa **Publicar**.

## 3. Activar el inicio de sesión
1. Ve a **Authentication** y actívalo.
2. En **Sign-in method**, activa **Correo electrónico/contraseña**.
3. En **Users**, pulsa **Agregar usuario** y crea uno para ti y otro para tu socio. Usen contraseñas largas y distintas.
4. Copia el **UID** de cada usuario. Lo necesitas en el paso 4.

## 4. Dar los permisos
Crear el usuario no da acceso: falta decir qué puede hacer cada uno.

1. En Firestore pulsa **Iniciar colección** y escribe `usuarios`.
2. Crea un documento cuyo **ID sea tu UID**, con estos campos de tipo texto:
   - `nombre`: Miguel
   - `rol`: admin
3. Crea otro documento cuyo **ID sea el UID de tu socio**:
   - `nombre`: el nombre de tu socio
   - `rol`: socio

## 5. Conectar la página
1. En **Configuración del proyecto**, baja a **Tus apps** y registra una app web (icono `</>`).
2. Copia el objeto `firebaseConfig` y pega sus valores en `config.js`.
3. Ese objeto es público por diseño. Lo que protege tus costos son las reglas del paso 2.

## 6. Probar
1. Abre el inventario y entra con tu correo.
2. Pulsa **Cargar los 7 productos iniciales**.
3. Entra con el usuario del socio y comprueba que puede registrar ventas, pero no editar precios.

Si cambias `firestore.rules`, vuelve a publicarlas en la consola.
