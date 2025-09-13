# Backend API Endpoints

This document outlines the API endpoints for the backend of the application.

## Authentication

### `/api/auth`

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/register/vendor` | Register a new vendor. |
| POST | `/register/mentor` | Register a new mentor. |
| POST | `/register/student` | Register a new student. |
| POST | `/verify-otp` | Verify OTP and activate user account. |
| POST | `/login` | Login for all user types. |

## Admin

### `/api/admin`

**Note:** All routes require authentication and `ADMIN` role.

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/login` | Admin login. |
| GET | `/dashboard` | Get admin dashboard data. |
| POST | `/create-vendor` | Create a new vendor. |
| GET | `/vendors` | Get all vendors. |
| PUT | `/vendor/:id/approve` | Approve a vendor. |
| PUT | `/vendor/:id/reject` | Reject a vendor. |
| PUT | `/vendor/:id/suspend` | Suspend a vendor. |
| PUT | `/vendor/:id` | Update a vendor. |
| DELETE | `/vendor/:id` | Delete a vendor. |
| GET | `/mentors` | Get all mentors. |
| PUT | `/mentor/:id` | Update a mentor. |
| DELETE | `/mentor/:id` | Delete a mentor. |
| GET | `/students` | Get all students. |
| PUT | `/student/:id` | Update a student. |
| DELETE | `/student/:id` | Delete a student. |
| POST | `/create-course` | Create a new course. |
| GET | `/courses` | Get all courses. |
| PUT | `/course/:id` | Update a course. |
| DELETE | `/course/:id` | Delete a course. |
| GET | `/enrollments` | Get all enrollments. |
| DELETE | `/enrollment/:id` | Delete an enrollment. |
| PUT | `/enrollment/:id` | Update an enrollment. |
| POST | `/referral/generate` | Generate a referral code. |

## Contact

### `/api/contact`

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/` | Handle contact form submission. |

## Mentor

### `/api/mentor`

**Note:** All routes require authentication and `MENTOR` role.

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/dashboard` | Get mentor dashboard data. |
| POST | `/create-referral-code` | Create a referral code. |
| GET | `/referral-codes` | Get all referral codes for the mentor. |
| GET | `/students` | Get all students referred by the mentor. |
| PUT | `/referral-code/:id/deactivate`| Deactivate a referral code. |
| GET | `/courses` | Get all courses for the mentor. |
| GET | `/enrollments` | Get all enrollments for the mentor's courses. |
| GET | `/recent-activities` | Get recent activities for the mentor. |

## Student

### `/api/student`

**Note:** All routes require authentication and `STUDENT` or `ADMIN` role.

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/dashboard` | Get student dashboard data. |
| POST | `/enroll/:courseId` | Enroll in a course. |
| GET | `/courses` | Get all enrolled courses for the student. |
| GET | `/available-courses` | Get all available courses. |
| POST | `/dummy-payment` | Process a dummy payment. |

## Vendor

### `/api/vendor`

**Note:** All routes require authentication and `VENDOR` role.

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/dashboard` | Get vendor dashboard data. |
| POST | `/create-mentor` | Create a new mentor. |
| GET | `/mentors` | Get all mentors created by the vendor. |
| GET | `/students` | Get all students. |
| PUT | `/mentor/:id/approve` | Approve a mentor. |
| PUT | `/mentor/:id/reject` | Reject a mentor. |
| PUT | `/mentor/:id/suspend` | Suspend a mentor. |
| GET | `/courses` | Get all courses. |
