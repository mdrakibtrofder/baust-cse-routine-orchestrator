# BAUST CSE Routine Orchestrator - API Reference

This document provides a detailed reference for all the API endpoints available in the BAUST CSE Routine Management System backend.

## Interactive Documentation (Swagger)
The project is equipped with Swagger for interactive API exploration and testing.
- **Local URL:** `http://localhost:3201/api/docs`

## Base URL
All API endpoints are prefixed with `/api`.
Default local URL: `http://localhost:3201/api`

---

## Table of Contents
1. [Authentication](#authentication)
2. [Semesters](#semesters)
3. [Teachers](#teachers)
4. [Rooms](#rooms)
5. [Sections](#sections)
6. [Courses](#courses)
7. [Periods](#periods)
8. [Days](#days)
9. [Class Slots](#class-slots)
10. [Assignments](#assignments)
11. [Routine Views](#routine-views)

---

## 1. Authentication

### Login
Authenticates a user and returns a JWT token.

- **Endpoint:** `POST /auth/login`
- **Request Body:**
  ```json
  {
    "username": "admin",
    "password": "password123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "username": "admin"
    }
  }
  ```

---

## 2. Semesters

### List All Semesters
- **Endpoint:** `GET /semesters`
- **Response (200 OK):** Array of semester objects.

### Get Active Semester
- **Endpoint:** `GET /semesters/active`
- **Response (200 OK):** The currently active semester object.

### Get Semester by ID
- **Endpoint:** `GET /semesters/:id`
- **Response (200 OK):** Semester object.

### Create Semester
- **Endpoint:** `POST /semesters`
- **Request Body:** `CreateSemesterDto`
- **Response (201 Created):** Created semester object.

### Update Semester
- **Endpoint:** `PATCH /semesters/:id`
- **Request Body:** `Partial<CreateSemesterDto>`
- **Response (200 OK):** Updated semester object.

### Delete Semester
- **Endpoint:** `DELETE /semesters/:id`
- **Response (200 OK):** Success message.

---

## 3. Teachers

### List Teachers
- **Endpoint:** `GET /teachers`
- **Query Parameters:**
  - `page` (default: 1)
  - `limit` (default: 20)
  - `search` (optional)
- **Response (200 OK):** Paginated teacher data.

### Get Teacher by ID
- **Endpoint:** `GET /teachers/:id`
- **Response (200 OK):** Teacher object.

### Get Teacher by Short Name
- **Endpoint:** `GET /teachers/short-name/:shortName`
- **Response (200 OK):** Teacher object.

### Create Teacher
- **Endpoint:** `POST /teachers`
- **Request Body:** `CreateTeacherDto`

### Bulk Import Teachers
- **Endpoint:** `POST /teachers/bulk-import`
- **Request Body:**
  ```json
  {
    "teachers": [ { ...CreateTeacherDto }, ... ]
  }
  ```

### Update Teacher
- **Endpoint:** `PATCH /teachers/:id`
- **Request Body:** `UpdateTeacherDto`

### Delete Teacher
- **Endpoint:** `DELETE /teachers/:id`

### Get Teacher Load
- **Endpoint:** `GET /teachers/:id/load`
- **Response (200 OK):** Teacher's current credit load and assignments.

---

## 4. Rooms

### List Rooms
- **Endpoint:** `GET /rooms`

### Create Room
- **Endpoint:** `POST /rooms`

### Update Room
- **Endpoint:** `PATCH /rooms/:id`

### Delete Room
- **Endpoint:** `DELETE /rooms/:id`

---

## 5. Sections

### List Sections
- **Endpoint:** `GET /sections`

### Get Sections by Level and Term
- **Endpoint:** `GET /sections/by-level/:level/term/:term`

### Create Section
- **Endpoint:** `POST /sections`

---

## 6. Courses

### List Courses
- **Endpoint:** `GET /courses`

### Get Courses by Level and Term
- **Endpoint:** `GET /courses/by-level/:level/term/:term`

### Create Course
- **Endpoint:** `POST /courses`

---

## 7. Periods

### List Periods
- **Endpoint:** `GET /periods`

### Get Periods by Kind
- **Endpoint:** `GET /periods/by-kind/:kind` (theory | sessional)

### Create Period
- **Endpoint:** `POST /periods`

---

## 8. Days

### List Days
- **Endpoint:** `GET /days`

### Create Day
- **Endpoint:** `POST /days`

---

## 9. Class Slots

### List Slots by Semester
- **Endpoint:** `GET /class-slots`
- **Query Parameters:** `semester_id` (required)

### Create Class Slot
- **Endpoint:** `POST /class-slots`

### Check Conflicts
- **Endpoint:** `POST /class-slots/check-conflicts`
- **Request Body:** `CheckConflictsDto`
- **Response (200 OK):**
  ```json
  {
    "conflicts": [ { "type": "...", "message": "..." } ],
    "hasConflicts": true
  }
  ```

### Update Class Slot
- **Endpoint:** `PATCH /class-slots/:id`

### Delete Class Slot
- **Endpoint:** `DELETE /class-slots/:id`

### Delete Slots for Course-Section
- **Endpoint:** `DELETE /class-slots/course/:courseId/section/:sectionId`
- **Query Parameters:** `semester_id` (required)

---

## 10. Assignments

### List Assignments by Semester
- **Endpoint:** `GET /assignments`
- **Query Parameters:** `semester_id` (required)

### Get Assignment for Course-Section
- **Endpoint:** `GET /assignments/course/:courseId/section/:sectionId`
- **Query Parameters:** `semester_id` (required)

### Create or Update Assignment
- **Endpoint:** `POST /assignments`
- **Request Body:** `CreateAssignmentDto`

### Get Teacher's Assignments
- **Endpoint:** `GET /assignments/teacher/:teacherId`
- **Query Parameters:** `semester_id` (required)

---

## 11. Routine Views

### Get Teacher Routine
- **Endpoint:** `GET /routine/teacher/:teacherId`
- **Query Parameters:** `semester_id` (required)

### Get Room Routine
- **Endpoint:** `GET /routine/room/:roomId`
- **Query Parameters:** `semester_id` (required)

### Get Section Routine
- **Endpoint:** `GET /routine/section/:sectionId`
- **Query Parameters:** `semester_id` (required)

### Get Full Semester Routine
- **Endpoint:** `GET /routine/semester/:semesterId`
