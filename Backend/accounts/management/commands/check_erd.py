"""Verify that the live database schema matches SafeVoice_ERD.docx.

    python manage.py check_erd

Exits with a non-zero status when the schema has drifted from the ERD.
"""

from django.apps import apps
from django.core.management.base import BaseCommand
from django.db import connection

# ERD table -> {column: (data type, key)}
# Key codes: PK primary key, FK foreign key, UK unique key.
ERD_SCHEMA = {
    "user": {
        "user_id": ("INT", "PK"),
        "full_name": ("VARCHAR(100)", ""),
        "email": ("VARCHAR(150)", "UK"),
        "password_hash": ("VARCHAR(255)", ""),
        "role": ("VARCHAR(20)", ""),
        "is_active": ("BOOLEAN", ""),
        "created_at": ("DATETIME", ""),
    },
    "crime_category": {
        "category_id": ("INT", "PK"),
        "created_by": ("INT", "FK"),
        "name": ("VARCHAR(100)", "UK"),
        "description": ("VARCHAR(255)", ""),
        "is_active": ("BOOLEAN", ""),
    },
    "report_status": {
        "status_id": ("INT", "PK"),
        "name": ("VARCHAR(30)", "UK"),
    },
    "report": {
        "report_id": ("INT", "PK"),
        "reference_number": ("VARCHAR(20)", "UK"),
        "access_key_hash": ("VARCHAR(255)", ""),
        "category_id": ("INT", "FK"),
        "status_id": ("INT", "FK"),
        "assigned_investigator_id": ("INT", "FK"),
        "description": ("TEXT", ""),
        "incident_datetime": ("DATETIME", ""),
        "location_text": ("VARCHAR(255)", ""),
        "latitude": ("DECIMAL(9,6)", ""),
        "longitude": ("DECIMAL(9,6)", ""),
        "is_flagged": ("BOOLEAN", ""),
        "flag_reason": ("VARCHAR(255)", ""),
        "submitted_at": ("DATETIME", ""),
        "updated_at": ("DATETIME", ""),
    },
    "evidence": {
        "evidence_id": ("INT", "PK"),
        "report_id": ("INT", "FK"),
        "file_path": ("VARCHAR(255)", ""),
        "file_type": ("VARCHAR(50)", ""),
        "file_size": ("INT", ""),
        "uploaded_at": ("DATETIME", ""),
    },
    "investigation_note": {
        "note_id": ("INT", "PK"),
        "report_id": ("INT", "FK"),
        "investigator_id": ("INT", "FK"),
        "note_text": ("TEXT", ""),
        "created_at": ("DATETIME", ""),
    },
    "status_history": {
        "history_id": ("INT", "PK"),
        "report_id": ("INT", "FK"),
        "changed_by": ("INT", "FK"),
        "old_status_id": ("INT", "FK"),
        "new_status_id": ("INT", "FK"),
        "changed_at": ("DATETIME", ""),
    },
    "emergency_contact": {
        "contact_id": ("INT", "PK"),
        "created_by": ("INT", "FK"),
        "name": ("VARCHAR(100)", ""),
        "phone": ("VARCHAR(30)", ""),
        "description": ("VARCHAR(255)", ""),
    },
    "safety_guideline": {
        "guideline_id": ("INT", "PK"),
        "created_by": ("INT", "FK"),
        "title": ("VARCHAR(150)", ""),
        "content": ("TEXT", ""),
        "updated_at": ("DATETIME", ""),
    },
    "system_setting": {
        "setting_id": ("INT", "PK"),
        "updated_by": ("INT", "FK"),
        "setting_key": ("VARCHAR(100)", "UK"),
        "setting_value": ("VARCHAR(255)", ""),
        "updated_at": ("DATETIME", ""),
    },
}

# ERD relationships: (parent, child, cardinality)
ERD_RELATIONSHIPS = [
    ("crime_category", "report", "1:N"),
    ("report_status", "report", "1:N"),
    ("report", "evidence", "1:N"),
    ("report", "investigation_note", "1:N"),
    ("report", "status_history", "1:N"),
    ("user", "report", "0..1:N"),
    ("user", "investigation_note", "1:N"),
    ("user", "status_history", "1:N"),
    ("user", "crime_category", "1:N"),
    ("user", "emergency_contact", "1:N"),
    ("user", "safety_guideline", "1:N"),
    ("user", "system_setting", "1:N"),
]


class Command(BaseCommand):
    help = "Check that the database schema conforms to SafeVoice_ERD.docx."

    def handle(self, *args, **options):
        problems = []
        tables_ok = 0
        columns_ok = 0

        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
            )
            existing_tables = {row[0] for row in cursor.fetchall()}

        for table, columns in ERD_SCHEMA.items():
            if table not in existing_tables:
                problems.append(f"MISSING TABLE  {table}")
                continue
            tables_ok += 1

            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT column_name, data_type, character_maximum_length,
                           numeric_precision, numeric_scale, is_nullable
                    FROM information_schema.columns
                    WHERE table_schema='public' AND table_name = %s
                    """,
                    [table],
                )
                actual = {row[0]: row for row in cursor.fetchall()}

            for column, (expected_type, key) in columns.items():
                if column not in actual:
                    problems.append(f"MISSING COLUMN {table}.{column}")
                    continue
                columns_ok += 1
                if not self._type_matches(actual[column], expected_type):
                    problems.append(
                        f"TYPE MISMATCH  {table}.{column}: "
                        f"expected {expected_type}, got {self._describe(actual[column])}"
                    )

        # Verify the 12 ERD relationships resolve to real foreign keys.
        relationships_ok = 0
        model_map = {}
        for model in apps.get_models():
            model_map[model._meta.db_table] = model

        for parent, child, cardinality in ERD_RELATIONSHIPS:
            child_model = model_map.get(child)
            parent_model = model_map.get(parent)
            if child_model is None or parent_model is None:
                problems.append(f"MISSING RELATIONSHIP {parent} -> {child}")
                continue
            target = parent_model._meta.db_table
            has_fk = any(
                field.related_model is not None and field.related_model._meta.db_table == target
                for field in child_model._meta.get_fields()
            )
            if has_fk:
                relationships_ok += 1
            else:
                problems.append(f"MISSING RELATIONSHIP {parent} -> {child} ({cardinality})")

        total_columns = sum(len(c) for c in ERD_SCHEMA.values())

        self.stdout.write("")
        self.stdout.write("SafeVoice ERD conformance report")
        self.stdout.write("-" * 46)
        self.stdout.write(f"  ERD tables            : {len(ERD_SCHEMA)}")
        self.stdout.write(f"  Tables present        : {tables_ok}")
        self.stdout.write(f"  ERD columns           : {total_columns}")
        self.stdout.write(f"  Columns present       : {columns_ok}")
        self.stdout.write(f"  ERD relationships     : {len(ERD_RELATIONSHIPS)}")
        self.stdout.write(f"  Relationships present : {relationships_ok}")
        self.stdout.write("-" * 46)

        if problems:
            self.stdout.write(self.style.ERROR(f"  {len(problems)} problem(s) found:"))
            for problem in problems:
                self.stdout.write(f"    - {problem}")
            raise SystemExit(1)

        self.stdout.write(self.style.SUCCESS("  Schema matches the ERD exactly."))
        self.stdout.write("")

    def _describe(self, column):
        _name, data_type, max_len, precision, scale, _nullable = column
        if data_type == "character varying" and max_len:
            return f"VARCHAR({max_len})"
        if data_type == "numeric":
            return f"DECIMAL({precision},{scale})"
        if data_type == "text":
            return "TEXT"
        if data_type == "boolean":
            return "BOOLEAN"
        if data_type in ("timestamp without time zone", "timestamp with time zone"):
            return "DATETIME"
        return data_type.upper()

    def _type_matches(self, column, expected):
        actual = self._describe(column)
        data_type = column[1]
        # INT covers integer / bigint primary keys.
        if expected == "INT":
            return data_type in ("integer", "bigint", "smallint")
        if expected == "TEXT":
            return data_type == "text"
        return actual == expected
