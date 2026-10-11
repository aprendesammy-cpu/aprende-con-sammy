#!/usr/bin/env python3
"""
Validador estructural del esquema SQL.

Parsea `supabase/schema.sql` con libpg_query (el parser real de PostgreSQL) y
comprueba invariantes que un error de sintaxis NO revelaría: tablas sin RLS,
tablas sin política de lectura, triggers de updated_at ausentes, claves foráneas
colgando, o la aparición de la tabla prohibida `profiles`.

Uso: python3 scripts/check-schema.py
"""
import pathlib
import re
import sys
from collections import defaultdict

import pglast
from pglast import ast, enums

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCHEMA_FILE = ROOT / 'supabase' / 'schema.sql'

DOMINIO = {
    'users', 'children', 'subjects', 'sessions', 'progress',
    'resources', 'articles', 'notes', 'payments', 'documents',
}

failures: list[str] = []
warnings: list[str] = []


def fail(message: str) -> None:
    failures.append(message)


def warn(message: str) -> None:
    warnings.append(message)


def qualified(node) -> str:
    """
    Devuelve `esquema.tabla` a partir de un nodo RangeVar.

    @param node Nodo con `schemaname` y `relname`.
    """
    schema = getattr(node, 'schemaname', None) or 'public'
    return f'{schema}.{node.relname}'


def _strip_sql_noise(sql: str) -> str:
    """
    Elimina comentarios y literales de cadena, conservando los saltos de línea
    para que los números de línea del reporte sigan siendo correctos.

    @param sql Fuente SQL completo.
    """
    out: list[str] = []
    i = 0
    length = len(sql)

    while i < length:
        two = sql[i : i + 2]

        # Comentario de línea: se conserva el salto de línea.
        if two == '--':
            end = sql.find('\n', i)
            i = length if end == -1 else end
            continue

        # Comentario de bloque: se conservan sus saltos de línea internos.
        if two == '/*':
            end = sql.find('*/', i + 2)
            block = sql[i : length if end == -1 else end + 2]
            out.append('\n' * block.count('\n'))
            i = length if end == -1 else end + 2
            continue

        # Literal de cadena (con comillas duplicadas como escape).
        if sql[i] == "'":
            i += 1
            while i < length:
                if sql[i] == "'":
                    if i + 1 < length and sql[i + 1] == "'":
                        i += 2
                        continue
                    i += 1
                    break
                if sql[i] == '\n':
                    out.append('\n')
                i += 1
            out.append("''")
            continue

        # Identificador entrecomillado.
        if sql[i] == '"':
            end = sql.find('"', i + 1)
            i = length if end == -1 else end + 1
            out.append('""')
            continue

        out.append(sql[i])
        i += 1

    return ''.join(out)


def main() -> int:
    sql = SCHEMA_FILE.read_text()
    statements = pglast.parse_sql(sql)

    tables: dict[str, list[str]] = {}
    foreign_keys: list[tuple[str, str]] = []
    rls_enabled: set[str] = set()
    policies: dict[str, list[str]] = defaultdict(list)
    triggers: dict[str, list[str]] = defaultdict(list)
    functions: set[str] = set()
    indexes: set[str] = set()

    for raw in statements:
        node = raw.stmt

        # ── CREATE TABLE ────────────────────────────────────────────
        if isinstance(node, ast.CreateStmt):
            name = qualified(node.relation)
            columns = []
            for element in node.tableElts or ():
                if isinstance(element, ast.ColumnDef):
                    columns.append(element.colname)
                elif isinstance(element, ast.Constraint):
                    # FK a nivel de tabla
                    if element.contype == enums.ConstrType.CONSTR_FOREIGN:
                        ref = qualified(element.pktable)
                        foreign_keys.append((name, ref))
            tables[name] = columns

            # FK declaradas dentro de la propia columna
            for element in node.tableElts or ():
                if isinstance(element, ast.ColumnDef):
                    for constraint in element.constraints or ():
                        if (
                            isinstance(constraint, ast.Constraint)
                            and constraint.contype == enums.ConstrType.CONSTR_FOREIGN
                        ):
                            foreign_keys.append((name, qualified(constraint.pktable)))

        # ── ALTER TABLE (RLS) ───────────────────────────────────────
        elif isinstance(node, ast.AlterTableStmt):
            target = qualified(node.relation)
            for command in node.cmds or ():
                if isinstance(command, ast.AlterTableCmd):
                    if command.subtype in (
                        enums.AlterTableType.AT_EnableRowSecurity,
                    ):
                        rls_enabled.add(target)

        # ── CREATE POLICY ───────────────────────────────────────────
        elif isinstance(node, ast.CreatePolicyStmt):
            target = qualified(node.table)
            # En libpg_query el comando viene como cadena en minúsculas
            # ('select', 'insert', 'update', 'delete', 'all').
            cmd = str(node.cmd_name or 'all').upper()
            policies[target].append(f'{node.policy_name}:{cmd}')

        # ── CREATE TRIGGER ──────────────────────────────────────────
        elif isinstance(node, ast.CreateTrigStmt):
            target = qualified(node.relation)
            triggers[target].append(node.trigname)

        # ── CREATE FUNCTION ─────────────────────────────────────────
        elif isinstance(node, ast.CreateFunctionStmt):
            parts = node.funcname or ()
            # En PostgreSQL 15+ el campo del nodo String se llama `sval`
            # (antes `str`). Se leen ambos por compatibilidad.
            names = [getattr(item, 'sval', None) or getattr(item, 'str', '') for item in parts]
            if len(names) > 1:
                functions.add(f'{names[0]}.{names[-1]}')
            elif names:
                functions.add(names[0])

        # ── CREATE INDEX ────────────────────────────────────────────
        elif isinstance(node, ast.IndexStmt):
            indexes.add(node.idxname)

    # ════════════════════════════════════════════════════════════
    #  COMPROBACIONES
    # ════════════════════════════════════════════════════════════

    # 1) Regla 1 del proyecto: jamás debe existir una tabla `profiles`.
    if 'public.profiles' in tables:
        fail('Regla 1 violada: existe la tabla prohibida `public.profiles`.')
    if re.search(r'CREATE TABLE\s+(IF NOT EXISTS\s+)?(public\.)?profiles\b', sql, re.I):
        fail('Regla 1 violada: el script crea una tabla `profiles`.')

    # 2) Las 10 tablas del dominio existen.
    for expected in sorted(DOMINIO):
        if f'public.{expected}' not in tables:
            fail(f'Falta la tabla del dominio `public.{expected}`.')

    # 3) No sobra ninguna tabla no prevista.
    for created in sorted(tables):
        if created.split('.')[-1] not in DOMINIO:
            warn(f'Tabla no prevista en el alcance: `{created}`.')

    # 4) `users` tiene exactamente las columnas que exige el plan (Paso 6.2).
    required_users = {
        'id', 'email', 'name', 'full_name', 'role', 'sala', 'created_at', 'updated_at',
    }
    users_cols = set(tables.get('public.users', []))
    missing = required_users - users_cols
    if missing:
        fail(f'`public.users` no tiene las columnas obligatorias: {sorted(missing)}.')

    # 5) RLS activado en todas las tablas del dominio.
    for expected in sorted(DOMINIO):
        target = f'public.{expected}'
        if target in tables and target not in rls_enabled:
            fail(f'`{target}` no tiene ENABLE ROW LEVEL SECURITY.')

    # 6) Toda tabla con RLS necesita al menos una política de SELECT.
    for target, plist in policies.items():
        kinds = {entry.split(':')[-1] for entry in plist}
        if 'SELECT' not in kinds and 'ALL' not in kinds:
            fail(f'`{target}` tiene políticas pero ninguna de SELECT: la app no podría leer.')

    for expected in sorted(DOMINIO):
        target = f'public.{expected}'
        if target in tables and target not in policies:
            fail(f'`{target}` tiene RLS pero CERO políticas → nadie puede leer ni escribir.')

    # 7) Las cuatro operaciones del plan sobre `users`.
    users_kinds = {entry.split(':')[-1] for entry in policies.get('public.users', [])}
    for kind in ('SELECT', 'INSERT', 'UPDATE', 'DELETE'):
        if kind not in users_kinds:
            fail(f'`public.users` no tiene política de {kind} (Paso 6.4 del plan).')

    # 8) Triggers exigidos por el plan.
    #    `functions` guarda nombres cualificados (`public.is_admin`); se comparan
    #    por el último segmento para que el prefijo de esquema no falsee el test.
    function_names = {item.split('.')[-1] for item in functions}
    if 'handle_users_updated_at' not in function_names:
        fail('Falta la función `handle_users_updated_at` (Paso 6.5 del plan).')
    if 'handle_new_auth_user' not in function_names:
        fail('Falta la función `handle_new_auth_user` (Paso 6.6 del plan).')
    if not any('users_set_updated_at' in name for name in triggers.get('public.users', [])):
        fail('`public.users` no tiene trigger BEFORE UPDATE para `updated_at`.')
    if not any(
        'on_auth_user_created' in name for name in triggers.get('auth.users', [])
    ):
        fail('Falta el trigger `on_auth_user_created` sobre `auth.users`.')

    # 9) Toda tabla con columna updated_at debe tener trigger que la mantenga.
    for name, columns in sorted(tables.items()):
        if 'updated_at' in columns:
            if not any('updated_at' in trig for trig in triggers.get(name, [])):
                fail(f'`{name}` tiene columna updated_at pero ningún trigger que la actualice.')

    # 10) Claves foráneas que apuntan a tablas inexistentes.
    known = set(tables) | {'auth.users'}
    for origin, target in foreign_keys:
        if target not in known:
            fail(f'FK colgando: `{origin}` → `{target}` (no existe en el script).')

    # 11) Las políticas no deben referenciar tablas inexistentes.
    for target in policies:
        if target not in tables:
            fail(f'Política sobre una tabla inexistente: `{target}`.')

    # 12) Funciones auxiliares de autorización presentes.
    for helper in ('is_admin', 'current_role', 'can_view_child', 'set_updated_at'):
        if helper not in function_names:
            fail(f'Falta la función auxiliar `public.{helper}`.')

    # 13) Las funciones SECURITY DEFINER deben fijar search_path (secuestro de nombres).
    for match in re.finditer(
        r'CREATE OR REPLACE FUNCTION\s+([\w.]+)\s*\(([^)]*)\)\s*RETURNS[\s\S]{0,400}?\$\$;',
        sql,
    ):
        fname, _args = match.group(1), match.group(2)
        block = match.group(0)
        if 'SECURITY DEFINER' in block and 'search_path' not in block:
            fail(f'`{fname}` es SECURITY DEFINER sin `SET search_path` (riesgo de secuestro).')

    # 14) Ninguna política debe consultar `public.users` a pelo: provocaría
    #     recursión infinita. Debe pasar por las funciones SECURITY DEFINER.
    for match in re.finditer(r'CREATE POLICY\s+(\w+)\s+ON\s+([\w.]+)([\s\S]*?);', sql):
        policy, table, body = match.group(1), match.group(2), match.group(3)
        if table.endswith('users') and re.search(r'FROM\s+public\.users', body, re.I):
            fail(f'La política `{policy}` consulta `public.users` dentro de `users`: recursión.')

    # 15) `profiles` no debe aparecer como identificador en el DDL.
    #     Se limpia el fuente primero: mencionarlo en un comentario o dentro de
    #     un literal de cadena (por ejemplo, en un COMMENT ON) no es una
    #     violación de la Regla 1.
    for line_no, line in enumerate(_strip_sql_noise(sql).splitlines(), start=1):
        if re.search(r'\bprofiles\b', line, re.I):
            fail(f'Línea {line_no}: referencia a `profiles` en código SQL ejecutable.')

    # 16) Coherencia entre el CHECK de `role` en SQL y el tipo `UserRole` de TS.
    #     Si alguien añade un rol en un sitio y no en el otro, la app escribe
    #     valores que la base de datos rechaza (o al revés). Se detecta aquí.
    ts_file = ROOT / 'src' / 'types' / 'index.ts'
    if ts_file.exists():
        ts_source = ts_file.read_text()
        # Se ancla al cierre de la unión de literales: `[^;]+` sin límite se
        # tragaba también la interfaz `User` declarada más abajo.
        ts_match = re.search(
            r"export type UserRole\s*=\s*((?:'[^']+'\s*\|?\s*)+)", ts_source
        )
        if ts_match:
            ts_roles = set(re.findall(r"'([a-z_]+)'", ts_match.group(1)))
            sql_match = re.search(
                r"role\s+text[\s\S]{0,120}?CHECK\s*\(role IN \(([^)]*)\)\)", sql
            )
            sql_roles = set(re.findall(r"'([a-z_]+)'", sql_match.group(1))) if sql_match else set()

            if not sql_roles:
                fail('No se encontró el CHECK de `role` en la tabla `users`.')
            elif ts_roles != sql_roles:
                fail(
                    'Los roles divergen entre SQL y TypeScript. '
                    f'Solo en SQL: {sorted(sql_roles - ts_roles)}. '
                    f'Solo en TS: {sorted(ts_roles - sql_roles)}.'
                )
        else:
            warn('No se pudo leer `UserRole` en src/types/index.ts; se omite la comprobación.')

    # 17) Las columnas de `public.users` deben coincidir con la interfaz `User`.
    if ts_file.exists():
        ts_source = ts_file.read_text()
        iface = re.search(r"export interface User \{([\s\S]*?)\n\}", ts_source)
        if iface:
            ts_cols = set(re.findall(r'^\s{2}(\w+)\??:', iface.group(1), re.M))
            sql_cols = set(tables.get('public.users', []))
            if ts_cols - sql_cols:
                fail(
                    'La interfaz `User` declara campos inexistentes en SQL: '
                    f'{sorted(ts_cols - sql_cols)}.'
                )
            if sql_cols - ts_cols:
                warn(
                    'La tabla `users` tiene columnas que la interfaz `User` no declara: '
                    f'{sorted(sql_cols - ts_cols)}.'
                )

    # ════════════════════════════════════════════════════════════
    #  REPORTE
    # ════════════════════════════════════════════════════════════
    print(f'Sentencias parseadas          : {len(statements)}')
    print(f'Tablas creadas                : {len(tables)}')
    print(f'  con RLS activado            : {len(rls_enabled)}')
    print(f'Políticas RLS                 : {sum(len(v) for v in policies.values())}')
    print(f'Triggers                      : {sum(len(v) for v in triggers.values())}')
    print(f'Funciones                     : {len(functions)}')
    print(f'Índices                       : {len(indexes)}')
    print(f'Claves foráneas               : {len(foreign_keys)}')

    print('\nPolíticas por tabla:')
    for target in sorted(policies):
        kinds = sorted({entry.split(":")[-1] for entry in policies[target]})
        print(f'  {target.replace("public.", ""):<12} {len(policies[target])} → {", ".join(kinds)}')

    if warnings:
        print(f'\nAvisos ({len(warnings)}):')
        for item in warnings:
            print(f'  ! {item}')

    if failures:
        print(f'\nFALLOS ({len(failures)}):')
        for item in failures:
            print(f'  x {item}')
        return 1

    print('\nOK: el esquema cumple todas las invariantes comprobadas.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
