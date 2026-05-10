# Teacher Management Workflows and Dependency Rules

This document outlines the rules and workflows for managing teacher records within the BAUST CSE Routine Management System.

## 1. Teacher Dependency Rules

To maintain data integrity, the system enforces strict rules regarding the deletion of teacher records:

### Assignment Dependency
- **Rule**: A teacher cannot be deleted if they are currently assigned to any course-section (Course Load).
- **Reason**: Deleting a teacher with active assignments would create "orphaned" classes in the routine, leading to scheduling conflicts and incomplete data.
- **Workflow**: 
  1. Attempt to delete a teacher.
  2. If assignments exist, the system blocks the deletion.
  3. The user is prompted to either:
     - Keep the teacher record.
     - Use the "Move Classes" tool to reassign all of that teacher's responsibilities to another faculty member.
  4. Once all assignments are moved or removed, the teacher record can be safely deleted.

### Unavailability Dependency
- **Rule**: Unavailability rules are automatically removed when a teacher is deleted.
- **Workflow**: When a teacher (without course assignments) is deleted, all associated weekly unavailability windows (e.g., office hours, leave) are permanently removed from the database via a transaction.

## 2. User Workflows

### Adding a Teacher
1. Navigate to the **Teachers** page.
2. Click **Add Teacher**.
3. Fill in the required fields:
   - **Short Name**: Unique identifier (e.g., "MDT"). Must be unique across all faculty.
   - **Full Name**: The teacher's complete name.
   - **Designation**: Academic rank (Lecturer, Assistant Professor, etc.).
   - **Total Credit**: The assigned credit load for the current semester.
4. Click **Add**. The record is saved using a database transaction to ensure integrity.

### Updating a Teacher
1. Click the **Pencil (Edit)** icon next to a teacher's name.
2. Modify the details.
3. If changing the **Short Name**, the system will verify its uniqueness before saving.
4. Click **Save**.

### Deleting a Teacher
1. Click the **Trash (Delete)** icon.
2. The system checks for dependencies:
   - **No Dependencies**: A confirmation dialog appears. Confirm to delete.
   - **Has Dependencies**: A warning dialog appears stating the number of active assignments. You will be offered the **Move classes…** option.
3. If you choose to move classes, select a target teacher to receive the assignments.
4. After migration, you can return to delete the original teacher record.

## 3. Data Integrity & Transactions
- All insert, update, and delete operations are wrapped in **database transactions**.
- If any part of a multi-step operation (like a bulk import or a deletion with associated cleanup) fails, the entire operation is rolled back to prevent data corruption.
