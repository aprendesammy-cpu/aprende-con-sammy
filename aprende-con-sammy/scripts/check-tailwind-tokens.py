#!/usr/bin/env python3
"""
Verifica que las clases de Tailwind con tokens PROPIOS del proyecto
(paleta Sammy, radios, sombras, animaciones y utilidades @utility)
generen CSS real en el build.

Un token mal escrito NO rompe la compilación: simplemente no produce
ninguna regla y el componente queda sin estilo en silencio. Este script
convierte ese fallo silencioso en un error de build.

Uso: npm run build && python3 scripts/check-tailwind-tokens.py
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'
DIST_CSS = ROOT / 'dist' / 'assets'

# Espacios de nombres de color definidos en src/index.css (@theme).
COLOR_NAMESPACES = (
    'primary', 'navy', 'sun', 'coral', 'creative', 'success', 'danger',
)
# Tokens de color sin escala numérica.
COLOR_TOKENS = ('cream', 'ink', 'muted')
# Utilidades y tokens propios sin prefijo de color.
CUSTOM_UTILITIES = (
    'rounded-card', 'rounded-xl2', 'shadow-soft', 'shadow-card',
    'min-tap', 'animate-float', 'animate-wave', 'animate-pop',
)

# Caracteres que Tailwind escapa con barra inversa dentro de los selectores.
CSS_ESCAPABLE = set(":/[]()%.#,!@$^&*+=;?<>~'\" ")


def escape_for_css(class_name: str) -> str:
    """
    Convierte una clase de Tailwind en el texto literal de su selector CSS.

    `hover:bg-primary-300` → `hover\\:bg-primary-300`
    """
    return ''.join(
        f'\\{char}' if char in CSS_ESCAPABLE else char for char in class_name
    )


def is_custom_class(class_name: str) -> bool:
    """
    Determina si una clase usa tokens propios del proyecto.

    @param class_name Candidato extraído del código fuente.
    """
    if class_name in CUSTOM_UTILITIES:
        return True

    # Se descarta el prefijo de variante (hover:, md:, focus-visible:, ...).
    body = class_name.rsplit(':', 1)[-1]

    for namespace in COLOR_NAMESPACES:
        if re.search(rf'(?:^|-){re.escape(namespace)}-\d', body):
            return True
    for token in COLOR_TOKENS:
        if re.search(rf'(?:^|-){re.escape(token)}(?:$|-)', body):
            return True
    return False


def extract_candidates() -> set:
    """
    Extrae candidatos a clase de todos los .tsx del proyecto.

    Se recogen tanto los `className` como las cadenas de los mapas de
    variantes, que es donde vive la mayoría de las clases.
    """
    candidates: set = set()
    # Palabras sueltas y clases con variantes/valores arbitrarios.
    pattern = re.compile(r'[A-Za-z][A-Za-z0-9_\-]*(?::[A-Za-z0-9_\-/\[\]().%,]+)*')
    for path in SRC.rglob('*.tsx'):
        for raw in pattern.findall(path.read_text()):
            candidates.add(raw)
    for path in SRC.rglob('*.ts'):
        for raw in pattern.findall(path.read_text()):
            candidates.add(raw)
    return candidates


def main() -> int:
    css_files = sorted(DIST_CSS.glob('*.css'))
    if not css_files:
        print('No hay CSS compilado en dist/assets. Ejecuta `npm run build`.')
        return 2

    css = '\n'.join(item.read_text() for item in css_files)
    candidates = extract_candidates()
    checked = sorted(item for item in candidates if is_custom_class(item))

    missing = [
        item for item in checked if f'.{escape_for_css(item)}' not in css
    ]

    print(f'CSS analizado                        : {", ".join(p.name for p in css_files)}')
    print(f'Clases con tokens propios detectadas : {len(checked)}')
    print(f'Generan CSS en el build              : {len(checked) - len(missing)}')
    print(f'SIN CSS (token inexistente o typo)   : {len(missing)}')

    if missing:
        print('\n--- clases que no producen ninguna regla ---')
        for item in missing:
            print(f'  x {item}')
        print('\nCausa habitual: el token no está declarado en el @theme de src/index.css.')
        return 1

    print('\nOK: todas las clases con tokens propios generan CSS.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
