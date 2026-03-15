# Prompts Centralizados - OpenAI para Actas

Carpeta que centraliza todos los prompts usados por OpenAI para generar actas de entrega profesionales.

## Estructura

```
backend/prompts/
├── __init__.py                    # Exporta prompts principales
├── acta_entrega_prompts.py        # Definición de prompts
└── README.md                      # Este archivo
```

## Archivos

### `acta_entrega_prompts.py`
Define constantes y funciones para construir prompts:

- **Constantes de sistema**: `SYSTEM_PROMPT_REDACTOR`, `PREMIUM_TONE_RULES`
- **Prompts específicos**: `PROMPT_SECCION_GENERICA`, `PROMPT_OBSERVACIONES_FINALES`
- **Constructores**: `build_user_prompt_*()` - construyen prompts personalizados
- **Configuración**: `DEFAULT_MODEL`, `DEFAULT_TEMPERATURE`, `CLEANUP_PATTERNS`

### `openai_service.py` (en `/backend/services/`)
Servicio centralizado que:
- Encapsula llamadas a OpenAI API
- Usa prompts desde este directorio
- Proporciona métodos: `generate_acta_completa()`, `generate_seccion()`, `generate_observaciones()`

## Uso

### En endpoints (ejemplo):

```python
from services.openai_service import get_openai_service

service = get_openai_service()
response = service.generate_seccion(
    numero=1,
    titulo="Estado del vehículo",
    contenido_actual="",
    contexto_informe="..."
)
return jsonify({"texto": response["texto"]}), 200
```

### Importar prompts directamente:

```python
from prompts import SYSTEM_PROMPT_REDACTOR, build_user_prompt_acta

prompt = build_user_prompt_acta(cliente, coche, matricula, km, averias, borrador)
```

## Agregar nuevos prompts

1. Edita `acta_entrega_prompts.py`
2. Define constante o función constructora
3. Exporta en `__init__.py` si es público
4. Úsalo desde `openai_service.py` o directamente

## Ejemplo: Agregar un prompt de "Recomendaciones"

```python
# En acta_entrega_prompts.py
PROMPT_RECOMENDACIONES = (
    "Redacta recomendaciones de mantenimiento futuro. "
    f"{PREMIUM_TONE_RULES} "
    "Sé profesional y realista."
)

def build_user_prompt_recomendaciones(historial, estado_actual):
    return f"{PROMPT_RECOMENDACIONES}\nHistorial: {historial}\nEstado: {estado_actual}"

# Exportar en __init__.py
# Usar en openai_service.py
```

## Variables de entorno requeridas

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5-mini
```

## Notas

- Los prompts están centralizados para facilitar mantenimiento y A/B testing
- Todos los prompts siguen el tono "premium" definido en `PREMIUM_TONE_RULES`
- Los patrones de limpieza (regex) están en `CLEANUP_PATTERNS` para post-procesar respuestas
