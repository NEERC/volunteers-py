"""import-old-data

Revision ID: 252ee2774277
Revises: ffef4006794c
Create Date: 2025-09-21 06:10:55.868512

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "252ee2774277"
down_revision: str | None = "d0b6e64e702c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Import data from volunteers schema into new schema."""
    # This migration reads data directly from the existing volunteers schema
    # and migrates it to the new schema structure with auto-generated IDs
    op.execute("SET search_path TO public,volunteers")

    # Migrate data from volunteers schema to new schema
    _migrate_years()
    _migrate_users()
    _migrate_days()
    _migrate_positions()
    _migrate_application_forms()
    _migrate_user_days()
    _migrate_assessments()


def _migrate_years() -> None:
    """Migrate year data from volunteers schema to new schema."""
    # Create mapping table for old_id -> new_id
    op.execute("""
        CREATE TEMPORARY TABLE year_id_mapping (
            old_id INTEGER,
            new_id INTEGER
        )
    """)

    # Insert years with auto-generated IDs and create mapping
    op.execute("""
        INSERT INTO years (year_name, open_for_registration)
        SELECT name, open_for_registration
        FROM volunteers.year
        ORDER BY id
    """)

    # Create mapping between old and new IDs
    op.execute("""
        INSERT INTO year_id_mapping (old_id, new_id)
        SELECT
            v.id as old_id,
            y.id as new_id
        FROM volunteers.year v
        JOIN years y ON y.year_name = v.name AND y.open_for_registration = v.open_for_registration
        ORDER BY v.id
    """)


def _migrate_users() -> None:
    """Migrate user data from volunteers schema to new schema."""

    # Insert users with auto-generated IDs and create mapping
    op.execute("""
        WITH to_insert AS (
        SELECT
            CASE
            WHEN v.itmo_id IS NOT NULL
                AND v.itmo_id ~ '^[0-9]+$'
                AND v.itmo_id::BIGINT <= 2147483647
            THEN v.itmo_id::INTEGER
            ELSE NULL
            END AS isu_id,
            COALESCE(v.first_name_cyr, '') AS first_name_ru,
            COALESCE(v.last_name_cyr, '') AS last_name_ru,
            '' AS patronymic_ru,
            (COALESCE(v.first_name, '') || ' ' || COALESCE(v.last_name, '')) AS full_name_en,
            v.phone,
            v.email,
            v.telegram AS telegram_username,
            (CASE WHEN v.role_id = 1 THEN TRUE ELSE FALSE END) AS is_admin,
            v.id AS old_id,
            v.password
        FROM volunteers.user v
        WHERE v.email IS NOT NULL AND v.email <> ''
        ORDER BY v.id
        ),
        inserted AS (
        INSERT INTO users (
            isu_id, first_name_ru, last_name_ru, patronymic_ru,
            full_name_en, phone, email, telegram_username, is_admin
        )
        SELECT
            isu_id, first_name_ru, last_name_ru, patronymic_ru,
            full_name_en, phone, email, telegram_username, is_admin
        FROM to_insert
        RETURNING id AS new_user_id, email
        )
        INSERT INTO legacy_users (id, new_user_id, email, password)
        SELECT t.old_id, i.new_user_id, t.email, t.password
        FROM inserted i
        JOIN to_insert t
        ON i.email = t.email;
    """)

    # Create mapping between old and new IDs
    op.execute("""
        INSERT INTO legacy_users (id, new_user_id, email, password)
        SELECT
            v.id as id,
            u.id as new_user_id,
            v.email as email,
            v.password as password
        FROM volunteers.user v
        JOIN users u ON u.email = v.email AND u.telegram_id = v.id
        WHERE v.email IS NOT NULL AND v.email != ''
        ORDER BY v.id
    """)


def _migrate_days() -> None:
    """Migrate day data from volunteers schema to new schema."""
    # Create mapping table for old_id -> new_id
    op.execute("""
        CREATE TEMPORARY TABLE day_id_mapping (
            old_id INTEGER,
            new_id INTEGER
        )
    """)

    # Insert days with auto-generated IDs and create mapping
    op.execute("""
        INSERT INTO days (year_id, name, information)
        SELECT
            yim.new_id as year_id,
            d.name,
            d.information
        FROM volunteers.day d
        JOIN year_id_mapping yim ON d.year = yim.old_id
        WHERE d.year IS NOT NULL
        ORDER BY d.id
    """)

    # Create mapping between old and new IDs
    op.execute("""
        INSERT INTO day_id_mapping (old_id, new_id)
        SELECT
            d.id as old_id,
            nd.id as new_id
        FROM volunteers.day d
        JOIN year_id_mapping yim ON d.year = yim.old_id
        JOIN days nd ON nd.year_id = yim.new_id AND nd.name = d.name AND nd.information = d.information
        WHERE d.year IS NOT NULL
        ORDER BY d.id
    """)


def _migrate_application_forms() -> None:
    """Migrate application form data from volunteers schema to new schema."""
    # Create mapping table for old_id -> new_id
    op.execute("""
        CREATE TEMPORARY TABLE application_form_id_mapping (
            old_id INTEGER,
            new_id INTEGER
        )
    """)

    # Insert application forms with auto-generated IDs and create mapping
    op.execute("""
        INSERT INTO application_forms (year_id, user_id, itmo_group, comments)
        SELECT
            yim.new_id as year_id,
            uim.new_user_id as user_id,
            COALESCE(af."group", '') as itmo_group,
            COALESCE(af.suggestions, '') as comments
        FROM volunteers.application_form af
        JOIN year_id_mapping yim ON af.year = yim.old_id
        JOIN legacy_users uim ON af.user_id = uim.id
        WHERE af.user_id IS NOT NULL AND af.year IS NOT NULL
        ORDER BY af.id
    """)

    # Create mapping between old and new IDs
    op.execute("""
        INSERT INTO application_form_id_mapping (old_id, new_id)
        SELECT
            af.id as old_id,
            af_new.id as new_id
        FROM volunteers.application_form af
        JOIN year_id_mapping yim ON af.year = yim.old_id
        JOIN legacy_users uim ON af.user_id = uim.id
        JOIN application_forms af_new ON af_new.year_id = yim.new_id AND af_new.user_id = uim.new_user_id
        WHERE af.user_id IS NOT NULL AND af.year IS NOT NULL
        ORDER BY af.id
    """)

    # Migrate position associations
    op.execute("""
        INSERT INTO application_form_position_association (form_id, position_id, year_id)
        SELECT
            afim.new_id as form_id,
            pim.new_id as position_id,
            yim.new_id as year_id
        FROM volunteers.application_form_positions afp
        JOIN volunteers.application_form af ON afp.application_form_id = af.id
        JOIN application_form_id_mapping afim ON afp.application_form_id = afim.old_id
        JOIN position_id_mapping pim ON afp.positions_id = pim.old_id
        JOIN year_id_mapping yim ON af.year = yim.old_id
        WHERE afp.application_form_id IS NOT NULL AND afp.positions_id IS NOT NULL
    """)


def _migrate_user_days() -> None:
    """Migrate user_day data from volunteers schema to new schema."""
    # Create mapping table for old_id -> new_id
    op.execute("""
        CREATE TEMPORARY TABLE user_day_id_mapping (
            old_id INTEGER,
            new_id INTEGER
        )
    """)

    # Insert user days with auto-generated IDs and create mapping
    op.execute("""
        INSERT INTO user_days (application_form_id, day_id, information, attendance)
        SELECT
            afim.new_id as application_form_id,
            dim.new_id as day_id,
            '' as information,  -- No information field in old schema
            CASE
                WHEN ud.attendance = 'yes' THEN 'YES'::attendance_enum
                WHEN ud.attendance = 'no' THEN 'NO'::attendance_enum
                WHEN ud.attendance = 'late' THEN 'LATE'::attendance_enum
                WHEN ud.attendance = 'sick' THEN 'SICK'::attendance_enum
                ELSE 'UNKNOWN'::attendance_enum
            END as attendance
        FROM volunteers.user_day ud
        JOIN application_form_id_mapping afim ON ud.user_year = afim.old_id
        JOIN day_id_mapping dim ON ud.day = dim.old_id
        WHERE ud.user_year IS NOT NULL AND ud.day IS NOT NULL
        ORDER BY ud.id
    """)

    # Create mapping between old and new IDs
    op.execute("""
        INSERT INTO user_day_id_mapping (old_id, new_id)
        SELECT
            ud.id as old_id,
            ud_new.id as new_id
        FROM volunteers.user_day ud
        JOIN application_form_id_mapping afim ON ud.user_year = afim.old_id
        JOIN day_id_mapping dim ON ud.day = dim.old_id
        JOIN user_days ud_new ON ud_new.application_form_id = afim.new_id AND ud_new.day_id = dim.new_id
        WHERE ud.user_year IS NOT NULL AND ud.day IS NOT NULL
        ORDER BY ud.id
    """)


def _migrate_assessments() -> None:
    """Migrate assessment data from volunteers schema to new schema."""
    # Insert assessments with auto-generated IDs
    op.execute("""
        INSERT INTO assessments (user_day_id, comment, value)
        SELECT
            udim.new_id as user_day_id,  -- In old schema, user_id refers to user_day.id
            a.comment,
            a.value
        FROM volunteers.assessment a
        JOIN user_day_id_mapping udim ON a.user_id = udim.old_id
        WHERE a.user_id IS NOT NULL
        ORDER BY a.id
    """)


def _migrate_positions() -> None:
    """Migrate position data and associations from volunteers schema."""
    # Create mapping table for old_id -> new_id
    op.execute("""
        CREATE TEMPORARY TABLE position_id_mapping (
            old_id INTEGER,
            new_id INTEGER
        )
    """)

    # Insert positions with auto-generated IDs and create mapping
    op.execute("""
        INSERT INTO positions (year_id, name, can_desire)
        SELECT
            yim.new_id as year_id,
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM volunteers.position_value pv2
                    WHERE pv2.name = pv.name
                    AND pv2.year_id != pv.year_id
                ) THEN pv.name || ' (' || y.name || ')'
                WHEN EXISTS (
                    SELECT 1 FROM volunteers.position_value pv3
                    WHERE pv3.name = pv.name
                    AND pv3.year_id = pv.year_id
                    AND pv3.id != pv.id
                ) THEN pv.name || ' (ID: ' || pv.id || ')'
                ELSE pv.name
            END as name,
            pv.in_form as can_desire
        FROM volunteers.position_value pv
        JOIN volunteers.year y ON pv.year_id = y.id
        JOIN year_id_mapping yim ON pv.year_id = yim.old_id
        WHERE pv.year_id IS NOT NULL
        ORDER BY pv.id
    """)

    # Create mapping between old and new IDs
    op.execute("""
        INSERT INTO position_id_mapping (old_id, new_id)
        SELECT
            pv.id as old_id,
            p.id as new_id
        FROM volunteers.position_value pv
        JOIN volunteers.year y ON pv.year_id = y.id
        JOIN year_id_mapping yim ON pv.year_id = yim.old_id
        JOIN positions p ON p.year_id = yim.new_id AND p.name = (
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM volunteers.position_value pv2
                    WHERE pv2.name = pv.name
                    AND pv2.year_id != pv.year_id
                ) THEN pv.name || ' (' || y.name || ')'
                WHEN EXISTS (
                    SELECT 1 FROM volunteers.position_value pv3
                    WHERE pv3.name = pv.name
                    AND pv3.year_id = pv.year_id
                    AND pv3.id != pv.id
                ) THEN pv.name || ' (ID: ' || pv.id || ')'
                ELSE pv.name
            END
        )
        WHERE pv.year_id IS NOT NULL
        ORDER BY pv.id
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # Remove all imported data in correct order (child tables first)
    op.execute("DELETE FROM assessments")
    op.execute("DELETE FROM user_days")
    op.execute("DELETE FROM application_form_position_association")
    op.execute("DELETE FROM application_forms")
    op.execute("DELETE FROM days")
    op.execute("DELETE FROM positions")
    op.execute("DELETE FROM legacy_users")
    op.execute("DELETE FROM users")
    op.execute("DELETE FROM years")
