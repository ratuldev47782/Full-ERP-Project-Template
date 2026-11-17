/*
=========================================================
IMPORTANT AI DEVELOPER INSTRUCTIONS - DATABASE DESIGN
=========================================================

1. DO NOT create unnecessary MySQL tables.

2. Always try to keep the total number of database
   tables as LOW as reasonably possible.

3. Do not create separate tables for every small feature
   or related information.

4. Prefer adding related fields to an existing table
   whenever it is logically appropriate.

5. Use MySQL JSON columns for nested objects or grouped
   data when appropriate.

6. Follow MongoDB-like object-based data structures
   wherever practical.

7. Before creating a new table, ALWAYS check whether
   the required information can be added to an existing
   table or stored using a JSON column.

8. Never create a new table without a clear functional
   requirement.

9. Avoid unnecessary relationships, JOIN operations,
   and overcomplicated database normalization.

10. Keep the database schema simple, centralized,
    flexible, and easy to maintain.

11. When modifying the database schema in the future,
    preserve existing tables and data whenever possible.

12. Do not sacrifice data integrity or create an
    inefficient structure just to reduce table count.

IMPORTANT:
MySQL is the required database, but I prefer
MongoDB-like flexible object structures.

Fewer tables, simpler architecture, and maintainability
are my primary database design preferences.

AI MUST READ AND FOLLOW THESE INSTRUCTIONS BEFORE
ADDING, MODIFYING, OR CREATING DATABASE TABLES.
=========================================================
*/

/**
 * backend/models/model.js
 *
 * Every table of the project is defined in this single file.
 *
 * Current schema: exactly ONE table.
 *
 * users
 * -----
 * id              auto-increment primary key
 * username        unique login name (3-30 chars, validated in the controller)
 * password        plain text for now (temporary local development only)
 * profile_picture public path of the uploaded image, e.g. /uploads/<uuid>.png
 * work            JSON column holding the organisation details as one object:
 *                 { factory, floor, department, designation }
 *                 JSON instead of four extra tables/relations, so more
 *                 work-related fields can be added without new tables.
 * created_at      registration timestamp
 *
 * Why one table: registration describes a single user. Factory, floor,
 * department and designation are attributes of that user (not separate
 * entities with their own lifecycle), so a JSON column is the simplest
 * correct structure. Add a new table only for a genuinely new entity.
 */

const { int, json, mysqlTable, timestamp, varchar } = require('drizzle-orm/mysql-core');

const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  username: varchar('username', { length: 60 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  profilePicture: varchar('profile_picture', { length: 500 }),
  // { factory: string, floor: string, department: string, designation: string }
  work: json('work').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

module.exports = { users };
