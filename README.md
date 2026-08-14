# Trading Research V16 — Plan Compliance

V16 parte de V15 Dashboard Personalizable y conserva toda la infraestructura anterior: Supabase, V9.2 Conflict Guard, snapshots, Biblioteca Simple, modo claro/oscuro, Dashboard configurable, Calendario, Research Grid y Exit Lab.

## Nuevo · Checklist del Trading Plan

- Nueva pestaña `Configuración → Checklist`.
- Reglas editables por Trading Plan con categoría, descripción, estado y condición obligatoria/opcional.
- Reordenación de reglas.
- Cada regla puede guardarse en la Biblioteca Simple y reutilizarse en otros Trading Plans.
- Las operaciones manuales pueden registrar el checklist como `Evaluado` o `No evaluado`.
- Al evaluar, cada operación guarda un snapshot independiente de las reglas para que cambios futuros del plan no reescriban el histórico.
- Si se guarda una operación con reglas obligatorias incumplidas, la aplicación lo advierte antes de continuar.
- Checklist y `Disciplina` permanecen como capas independientes.

## Nuevo · Cumplimiento del Plan

Nueva sección principal `Cumplimiento` con:

- Cobertura de checklist.
- Cumplimiento medio.
- Porcentaje de operaciones con el 100% de reglas obligatorias.
- Expectancy de operaciones 100% cumplidas frente a operaciones con incumplimientos.
- Diferencia de expectancy.
- Análisis por regla: tasa de cumplimiento, expectancy cumplida/incumplida, delta y resultado negativo asociado.
- Ranking de incumplimientos observados.
- Filtros por Setup y Contexto.
- Unidades R / ticks / US$ y Bruto / Neto.
- Tabla de operaciones evaluadas y filtro para inspeccionar los fallos de una regla concreta.

Las importaciones antiguas o trades sin checklist se consideran `No evaluados`; nunca se convierten automáticamente en incumplimientos. `TPCompliance` de Ankora sigue siendo válido para Disciplina, pero V16 no inventa qué regla concreta falló.

## Dashboard

El personalizador añade dos opciones nuevas:

- KPI `Cumplimiento checklist`.
- Panel `Cumplimiento por regla`.

No están forzados en el Dashboard: se pueden activar desde `⚙ Personalizar`.

## Infraestructura

No requiere SQL nuevo ni cambios en Supabase/Cloudflare. Continúa utilizando los mismos seis archivos raíz.
