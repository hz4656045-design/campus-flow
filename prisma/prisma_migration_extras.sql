-- =============================================================================
-- Campus Flow — Prisma Migration Companion SQL
-- -----------------------------------------------------------------------------
-- File:    prisma_migration_extras.sql
-- Purpose: Apply all DB-level integrity features that Prisma schema.prisma
--          cannot natively express. Run AFTER `prisma migrate dev` or
--          `prisma db push` so the base tables/indexes already exist.
--
-- Covers:
--   1. CHECK constraints (Prisma has no native CHECK in schema language)
--   2. Partial UNIQUE indexes (e.g. one active enrollment per section)
--   3. Cross-column CHECK via BEFORE-INSERT/UPDATE trigger (grade.score)
--   4. Comments
--
-- Does NOT cover (already in logical_schema.sql, run separately if you
-- bootstrap from raw SQL instead of Prisma):
--   - pgcrypto, btree_gist extensions
--   - GiST exclusion constraints (room/instructor double-booking)
--   - updated_at auto-trigger (Prisma's @updatedAt handles client writes)
--
-- Idempotent: each statement uses IF NOT EXISTS or CREATE OR REPLACE.
-- =============================================================================

\set ON_ERROR_STOP on

-- -----------------------------------------------------------------------------
-- 1. CHECK constraints
-- -----------------------------------------------------------------------------

-- users.email format
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_email_format_chk;
ALTER TABLE users
    ADD CONSTRAINT users_email_format_chk
    CHECK (email ~* '^[^@]+@[^@]+\.[^@]+$');

-- courses.credit_hours BETWEEN 1 AND 8
ALTER TABLE courses
    DROP CONSTRAINT IF EXISTS courses_credit_hours_chk;
ALTER TABLE courses
    ADD CONSTRAINT courses_credit_hours_chk
    CHECK (credit_hours BETWEEN 1 AND 8);

-- prerequisites.course_id <> prerequisite_course_id
ALTER TABLE prerequisites
    DROP CONSTRAINT IF EXISTS prerequisites_no_self_ref_chk;
ALTER TABLE prerequisites
    ADD CONSTRAINT prerequisites_no_self_ref_chk
    CHECK (course_id <> prerequisite_course_id);

-- semesters.end_date > start_date AND registration_end > registration_start
ALTER TABLE semesters
    DROP CONSTRAINT IF EXISTS semesters_date_order_chk;
ALTER TABLE semesters
    ADD CONSTRAINT semesters_date_order_chk
    CHECK (end_date > start_date);

ALTER TABLE semesters
    DROP CONSTRAINT IF EXISTS semesters_reg_window_chk;
ALTER TABLE semesters
    ADD CONSTRAINT semesters_reg_window_chk
    CHECK (registration_end > registration_start);

-- rooms.capacity >= 1
ALTER TABLE rooms
    DROP CONSTRAINT IF EXISTS rooms_capacity_chk;
ALTER TABLE rooms
    ADD CONSTRAINT rooms_capacity_chk
    CHECK (capacity >= 1);

-- class_sections.capacity >= 1
ALTER TABLE class_sections
    DROP CONSTRAINT IF EXISTS sections_capacity_chk;
ALTER TABLE class_sections
    ADD CONSTRAINT sections_capacity_chk
    CHECK (capacity >= 1);

-- class_schedules.day_of_week BETWEEN 1 AND 7 AND end_time > start_time
ALTER TABLE class_schedules
    DROP CONSTRAINT IF EXISTS schedules_day_of_week_chk;
ALTER TABLE class_schedules
    ADD CONSTRAINT schedules_day_of_week_chk
    CHECK (day_of_week BETWEEN 1 AND 7);

ALTER TABLE class_schedules
    DROP CONSTRAINT IF EXISTS schedules_time_order_chk;
ALTER TABLE class_schedules
    ADD CONSTRAINT schedules_time_order_chk
    CHECK (end_time > start_time);

-- students.credit_cap BETWEEN 1 AND 30
ALTER TABLE students
    DROP CONSTRAINT IF EXISTS students_credit_cap_chk;
ALTER TABLE students
    ADD CONSTRAINT students_credit_cap_chk
    CHECK (credit_cap BETWEEN 1 AND 30);

-- assessments.max_score > 0 AND weight BETWEEN 0 AND 100
ALTER TABLE assessments
    DROP CONSTRAINT IF EXISTS assessments_max_score_chk;
ALTER TABLE assessments
    ADD CONSTRAINT assessments_max_score_chk
    CHECK (max_score > 0);

ALTER TABLE assessments
    DROP CONSTRAINT IF EXISTS assessments_weight_chk;
ALTER TABLE assessments
    ADD CONSTRAINT assessments_weight_chk
    CHECK (weight BETWEEN 0 AND 100);

-- final_grades: numeric 0..100, gpa 0..4
ALTER TABLE final_grades
    DROP CONSTRAINT IF EXISTS final_grades_numeric_chk;
ALTER TABLE final_grades
    ADD CONSTRAINT final_grades_numeric_chk
    CHECK (numeric_grade BETWEEN 0 AND 100);

ALTER TABLE final_grades
    DROP CONSTRAINT IF EXISTS final_grades_gpa_chk;
ALTER TABLE final_grades
    ADD CONSTRAINT final_grades_gpa_chk
    CHECK (gpa_points BETWEEN 0.00 AND 4.00);

-- academic_records: GPA ranges, credits_earned <= credits_attempted
ALTER TABLE academic_records
    DROP CONSTRAINT IF EXISTS academic_records_semester_gpa_chk;
ALTER TABLE academic_records
    ADD CONSTRAINT academic_records_semester_gpa_chk
    CHECK (semester_gpa BETWEEN 0.000 AND 4.000);

ALTER TABLE academic_records
    DROP CONSTRAINT IF EXISTS academic_records_cumulative_gpa_chk;
ALTER TABLE academic_records
    ADD CONSTRAINT academic_records_cumulative_gpa_chk
    CHECK (cumulative_gpa BETWEEN 0.000 AND 4.000);

ALTER TABLE academic_records
    DROP CONSTRAINT IF EXISTS academic_records_credits_chk;
ALTER TABLE academic_records
    ADD CONSTRAINT academic_records_credits_chk
    CHECK (credits_earned <= credits_attempted);

-- audit_logs: result and method enums (defensive; column type already enum)
ALTER TABLE audit_logs
    DROP CONSTRAINT IF EXISTS audit_logs_result_chk;
ALTER TABLE audit_logs
    ADD CONSTRAINT audit_logs_result_chk
    CHECK (result IN ('success','failure','denied'));

ALTER TABLE audit_logs
    DROP CONSTRAINT IF EXISTS audit_logs_method_chk;
ALTER TABLE audit_logs
    ADD CONSTRAINT audit_logs_method_chk
    CHECK (method IN ('GET','POST','PUT','PATCH','DELETE'));

-- -----------------------------------------------------------------------------
-- 2. Partial UNIQUE indexes
-- -----------------------------------------------------------------------------

-- At most one *active* enrollment per (student, class_section)
CREATE UNIQUE INDEX IF NOT EXISTS enrollments_active_unique_idx
    ON enrollments (student_id, class_section_id)
    WHERE status NOT IN ('dropped','completed','failed');

-- At most one semester with status='open' at a time
CREATE UNIQUE INDEX IF NOT EXISTS semesters_only_one_open_idx
    ON semesters (status)
    WHERE status = 'open';

-- Active holds lookup (partial index for fast "is this student on hold?")
CREATE INDEX IF NOT EXISTS holds_active_idx
    ON registration_holds (student_id, held_until)
    WHERE released_at IS NULL;

-- -----------------------------------------------------------------------------
-- 3. Trigger: validate grade.score <= assessment.max_score
--    (cross-column CHECK that Prisma cannot express)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_grade_score() RETURNS TRIGGER AS $$
DECLARE
    max_score NUMERIC;
BEGIN
    IF NEW.score < 0 THEN
        RAISE EXCEPTION 'score cannot be negative (got %)', NEW.score;
    END IF;
    SELECT max_score INTO max_score FROM assessments WHERE id = NEW.assessment_id;
    IF NEW.score > max_score THEN
        RAISE EXCEPTION 'score % exceeds max_score % for assessment %',
            NEW.score, max_score, NEW.assessment_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS grades_score_chk_trg ON grades;
CREATE TRIGGER grades_score_chk_trg
    BEFORE INSERT OR UPDATE OF score ON grades
    FOR EACH ROW EXECUTE FUNCTION validate_grade_score();

-- -----------------------------------------------------------------------------
-- 4. Auto updated_at trigger (for out-of-band / raw SQL writes only).
--    Prisma's @updatedAt handles client-side writes, but raw SQL or jobs
--    bypassing Prisma still need the DB-level safety net.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.columns
        WHERE column_name = 'updated_at'
          AND table_schema = 'public'
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_touch_updated_at ON %I;'
            'CREATE TRIGGER trg_touch_updated_at
             BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION touch_updated_at();',
            t, t
        );
    END LOOP;
END $$;

-- =============================================================================
-- End of prisma_migration_extras.sql
-- =============================================================================
