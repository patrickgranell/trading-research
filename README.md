# Trading Research V31.2 — Mistakes Analysis

V31.2 parte de V31.1.5 y mantiene intactos Supabase, Conflict Guard V9.2, Dashboard Profiles y todos los módulos previos. Market Data continúa pausado hasta completar la auditoría funcional.

## Mistakes Analysis

- Taxonomía de errores configurable por Trading Plan: nombre, categoría, criterio y activo/inactivo.
- Evaluación explícita por operación. Un trade no evaluado nunca se considera “sin error”.
- Snapshot histórico: si la taxonomía cambia, el pasado no se reescribe.
- Para cada error, el grupo “sin error” solo usa operaciones donde esa definición existía realmente en el snapshot evaluado.
- Frecuencia, expectancy con/sin error, delta, resultado asociado y relación con Disciplina.
- Co-ocurrencia de errores, evolución últimas 20 vs 20 anteriores y hotspots error × setup × contexto.
- Tabla de operaciones con errores y acceso directo al trade.
- KPI y panel opcionales en Dashboard.
- Definiciones reutilizables desde Biblioteca.

## Criterio metodológico

Checklist, disciplina, diario emocional y Mistakes son capas distintas. La aplicación no convierte automáticamente una regla incumplida o una emoción en error. Las diferencias de rendimiento muestran asociación histórica, no causalidad ni “coste causado” automáticamente.

## Despliegue

El ZIP contiene exactamente seis archivos raíz. `npm run build` genera un único `dist/index.html` con CSS y JavaScript embebidos para evitar desincronización de assets en Cloudflare. No requiere SQL nuevo.
