# Trading Research V8.1 — Stable Data Safety

V8.1 congela la arquitectura funcional de V8 y añade una primera capa de seguridad del dato.

## Novedades
- **Datos y seguridad** en Configuración.
- **Exportar copia completa** a un único fichero `.trbackup`.
- La copia incluye:
  - Trading Plans y versiones,
  - operaciones,
  - importaciones Ankora,
  - contratos,
  - estrategias/lotes,
  - reglas de riesgo,
  - diario emocional,
  - taxonomías y referencias,
  - imágenes almacenadas en IndexedDB.
- **Restaurar copia** con validación y confirmación explícita.
- **Auditoría de integridad** para detectar:
  - IDs duplicados,
  - planes inexistentes,
  - contratos huérfanos,
  - estrategias huérfanas o sin clasificar,
  - Setup/VD fuera de la configuración actual,
  - contextos sin ficha,
  - referencias de imagen sin blob,
  - blobs de imagen sin referencia.

## V8 conservado
Se mantienen todas las funciones de V8: Setups/VD/Contextos enriquecidos, imágenes LONG/SHORT, biblioteca visual, diario emocional, reglas de riesgo, bloques, importador Ankora y laboratorio de operaciones.

## Despliegue
Build: `npm run build`
Deploy: `npx wrangler deploy`
