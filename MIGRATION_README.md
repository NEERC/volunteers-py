# Data Migration from Volunteers Schema

This migration transfers data directly from the existing `volunteers` schema to the new database schema.

## Files Overview

- `volunteers/alembic/versions/252ee2774277_import_old_data.py` - The main Alembic migration
- `generate_complete_migration.py` - Script to generate complete migration data (for reference)
- `complete_migration_data.sql` - Generated SQL with all backup data (for reference)
- `migration_summary.json` - Summary of data to be migrated (for reference)

## Migration Process

### Run the Migration

The Alembic migration reads directly from the existing `volunteers` schema and migrates to the new schema:

```bash
alembic upgrade head
```

The migration will:
1. Read data from `volunteers.year` → `years`
2. Read data from `volunteers.user` → `users`
3. Read data from `volunteers.day` → `days`
4. Read data from `volunteers.application_form` → `application_forms`
5. Read data from `volunteers.user_day` → `user_days`
6. Read data from `volunteers.assessment` → `assessments`
7. Read data from `volunteers.position_value` → `positions`
8. Read data from `volunteers.application_form_positions` → `application_form_position_association`

## Data Mapping

The migration maps data from the volunteers schema to the new schema:

| Volunteers Schema Table | New Table | Key Mappings |
|-------------------------|-----------|--------------|
| `volunteers.year` | `years` | `name` → `year_name`, `open_for_registration` |
| `volunteers.user` | `users` | `badge_name` → `first_name_ru`, `first_name_cyr` → `last_name_ru`, etc. |
| `volunteers.day` | `days` | `name`, `information`, `year` → `year_id` |
| `volunteers.application_form` | `application_forms` | `group` → `itmo_group`, `suggestions` → `comments` |
| `volunteers.user_day` | `user_days` | `attendance` → enum, `user_year` → `application_form_id` |
| `volunteers.assessment` | `assessments` | `comment`, `value`, `user_id` → `user_day_id` |
| `volunteers.position_value` | `positions` | `name`, `year` → `year_id` |
| `volunteers.application_form_positions` | `application_form_position_association` | Association table |

## Migration Summary

Based on the backup data analysis:

- **Years**: 12 records
- **Users**: 605 records
- **Days**: 70 records
- **Application Forms**: 1,022 records
- **User Days**: 7,196 records
- **Assessments**: 529 records
- **Positions**: 206 records
- **Position Associations**: 1,638 records

**Total**: 11,512 records to migrate

## Important Notes

1. **Direct Schema Access**: The migration reads directly from the existing `volunteers` schema in the database.

2. **Data Validation**: The migration includes data validation and mapping to ensure data integrity.

3. **Rollback**: The migration includes a downgrade function to remove imported data if needed.

4. **Complete Data**: The migration loads all data from the volunteers schema in one operation.

## Customization

If you need to modify the migration:

1. Edit the parsing scripts to change data extraction logic
2. Modify the migration functions to change data mapping
3. Regenerate the complete migration data if needed

## Troubleshooting

- If the migration fails, check the database logs for specific errors
- Ensure all foreign key constraints are satisfied
- Verify that the backup data is complete and valid
- Check that the new schema tables exist before running the migration
