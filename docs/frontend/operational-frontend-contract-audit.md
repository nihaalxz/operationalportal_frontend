# Texas Operational Portal — Frontend Contract Audit

This document summarizes the REST API contracts provided by the Operational Portal ASP.NET Core Backend (running locally on `https://localhost:7142` or `http://localhost:5232`) for the SvelteKit frontend application.

## Endpoints, Methods, and Permissions

| Endpoint | Method | Authentication | Policy/Permission | Request Body | Response DTO | Expected Errors |
|---|---|---|---|---|---|---|
| `/api/auth/login` | `POST` | Anonymous | None | `LoginRequest` | `LoginResponse` + Cookie | 400 Bad Request, 401 Unauthorized |
| `/api/auth/refresh` | `POST` | Anonymous (reads Cookie) | None | None | `LoginResponse` + Cookie | 401 Unauthorized |
| `/api/auth/logout` | `POST` | Authenticated | `OperationalPortalAccess` | None | `{ Message: string }` | 401 Unauthorized |
| `/api/auth/me` | `GET` | Authenticated | `OperationalPortalAccess` | None | `LoginResponse` | 401 Unauthorized |
| `/api/dashboard/summary` | `GET` | Authenticated | `OperationalPortalAccess` | None | `DashboardSummaryResponse` | 401 Unauthorized |
| `/api/visas` | `GET` | Authenticated | `CanViewVisas` | Query Parameters | `PagedResponse<VisaApplicationSummaryResponse>` | 400 Bad Request, 401 Unauthorized |
| `/api/visas/{id}` | `GET` | Authenticated | `CanViewVisas` | Route parameter `id: long` | `VisaApplicationDetailResponse` | 401 Unauthorized, 404 Not Found |
| `/api/vfs-appointments` | `GET` | Authenticated | `CanViewVfs` | Query Parameters | `PagedResponse<VfsAppointmentSummaryResponse>` | 400 Bad Request, 401 Unauthorized |
| `/api/vfs-appointments/{id}` | `GET` | Authenticated | `CanViewVfs` | Route parameter `id: long` | `VfsAppointmentDetailResponse` | 401 Unauthorized, 404 Not Found |
| `/api/holiday-packages` | `GET` | Authenticated | `CanViewHolidays` | Query Parameters | `PagedResponse<HolidayPackageSummaryResponse>` | 400 Bad Request, 401 Unauthorized |
| `/api/holiday-packages/{id}` | `GET` | Authenticated | `CanViewHolidays` | Route parameter `id: long` | `HolidayPackageDetailResponse` | 401 Unauthorized, 404 Not Found |

---

## Detailed Data Contracts

### 1. Authentication Contracts

#### `LoginRequest` (JSON)
- `Email` (string, required)
- `Password` (string, required)

#### `LoginResponse` (JSON)
- `AccessToken` (string, empty for `/me`)
- `Name` (string)
- `Email` (string)
- `UserType` (string - `Admin`, `Operations`, `Accounts`)
- `Permissions` (array of strings)

---

### 2. Dashboard Contracts

#### `DashboardSummaryResponse` (JSON)
- `PendingVisasCount` (integer)
- `UnderReviewVisasCount` (integer)
- `PendingVfsCount` (integer)
- `ProcessingVfsCount` (integer)
- `PendingHolidaysCount` (integer)
- `ProcessingHolidaysCount` (integer)

---

### 3. Visa Application Contracts

#### `VisaApplicationSummaryResponse` (JSON)
- `Id` (long)
- `HeadName` (string, nullable)
- `VisaPackName` (string, nullable)
- `ClientType` (string)
- `ProcessingStatus` (string)
- `PaymentStatus` (string)
- `PayableAmount` (decimal)
- `Profit` (decimal)
- `ApplicantCount` (integer)
- `CreatedAt` (string/DateTime, nullable)

#### `VisaApplicationDetailResponse` (JSON)
- `Id` (long)
- `UserId` (long)
- `CountryId` (integer)
- `VisaPackId` (integer)
- `VisaPackName` (string, nullable)
- `ClientType` (string)
- `Agent` (string, nullable)
- `AgentId` (long, nullable)
- `HeadId` (long, nullable)
- `HeadName` (string, nullable)
- `ProcessingStatus` (string)
- `PaymentStatus` (string)
- `VisaDocument` (string, nullable)
- `ApprovalNote` (string, nullable)
- `RejectionDocument` (string, nullable)
- `RejectionNote` (string, nullable)
- `RefundNote` (string, nullable)
- `PayableAmount` (decimal)
- `ExpectedSupplierCost` (decimal)
- `Profit` (decimal)
- `SupplierId` (long, nullable)
- `SupplierName` (string, nullable)
- `RejectionFee` (decimal)
- `CreatedAt` (string/DateTime, nullable)
- `UpdatedAt` (string/DateTime, nullable)
- `Applicants` (array of `VisaApplicantResponse`)

#### `VisaApplicantResponse` (JSON)
- `Id` (long)
- `Prefix` (string)
- `FName` (string)
- `LName` (string)
- `Dob` (string/DateTime)
- `Nationality` (string)
- `CareOf` (string)
- `ContactNo` (string)
- `EmailId` (string)
- `PassportNo` (string)
- `IqamaHotelNo` (string)
- `PayableAmount` (decimal)
- `ExpectedSupplierCost` (decimal)
- `Profit` (decimal)
- `IsInhouse` (boolean)
- `PaymentMethod` (string)
- `PaymentStatus` (string)
- `PaymentProof` (string, nullable)
- `PaymentReference` (string, nullable)
- `BankId` (long, nullable)
- `BankName` (string, nullable)

---

### 4. VFS Appointment Contracts

#### `VfsAppointmentSummaryResponse` (JSON)
- `Id` (long)
- `HeadName` (string, nullable)
- `Name` (string)
- `Country` (string)
- `VisaType` (string)
- `PaymentStatus` (string)
- `ProcessingStatus` (string)
- `PayableAmount` (decimal)
- `Profit` (decimal)
- `AppointmentDate` (string/DateTime, nullable)
- `CreatedAt` (string/DateTime, nullable)

#### `VfsAppointmentDetailResponse` (JSON)
- `Id` (long)
- `CreatedBy` (long)
- `HeadId` (long, nullable)
- `HeadName` (string, nullable)
- `ClientType` (string, nullable)
- `Agent` (string, nullable)
- `AgentId` (long, nullable)
- `VfsId` (string)
- `VfsAppId` (string, nullable)
- `Prefix` (string)
- `Name` (string)
- `Supplier` (string)
- `SupplierId` (long, nullable)
- `SupplierName` (string, nullable)
- `Country` (string)
- `VisaType` (string)
- `PayableAmount` (decimal)
- `ExpectedSupplierCost` (decimal)
- `Profit` (decimal)
- `PaymentMode` (string)
- `PaymentStatus` (string)
- `ProcessingStatus` (string)
- `AppointmentDate` (string/DateTime, nullable)
- `AppointmentTime` (string/TimeSpan, nullable)
- `VfsReceipt` (string, nullable)
- `PassportCopy` (string, nullable)
- `CreatedAt` (string/DateTime, nullable)
- `UpdatedAt` (string/DateTime, nullable)

---

### 5. Holiday Package Contracts

#### `HolidayPackageSummaryResponse` (JSON)
- `Id` (long)
- `HeadName` (string, nullable)
- `PassengerName` (string)
- `Country` (string)
- `Days` (integer)
- `PaymentStatus` (string)
- `ProcessingStatus` (string)
- `PayableAmount` (decimal)
- `Profit` (decimal)
- `CreatedAt` (string/DateTime, nullable)

#### `HolidayPackageDetailResponse` (JSON)
- `Id` (long)
- `CreatedBy` (long)
- `HeadId` (long, nullable)
- `HeadName` (string, nullable)
- `ClientType` (string, nullable)
- `Agent` (string, nullable)
- `AgentId` (long, nullable)
- `BookingId` (string)
- `HolidayAppId` (string, nullable)
- `Prefix` (string)
- `PassengerName` (string)
- `Supplier` (string)
- `SupplierId` (long, nullable)
- `SupplierName` (string, nullable)
- `Country` (string)
- `Days` (integer)
- `PayableAmount` (decimal)
- `ExpectedSupplierCost` (decimal)
- `Profit` (decimal)
- `PaymentMode` (string)
- `PaymentStatus` (string)
- `ProcessingStatus` (string)
- `CreatedAt` (string/DateTime, nullable)
- `UpdatedAt` (string/DateTime, nullable)

---

### 6. Generic Paged Envelope (`PagedResponse<T>`)
- `Items` (array of `T`)
- `TotalCount` (integer)
- `PageNumber` (integer)
- `PageSize` (integer)
- `TotalPages` (integer)

---

## ProblemDetails / Error Contracts
All error payloads from the API (e.g., validation, authentication, rate limits, downstream timeouts) adhere to the **RFC 7807 ProblemDetails** format:
- `Status` (integer) - HTTP status code
- `Title` (string) - Short, human-readable summary of the error
- `Detail` (string) - Specific details about what went wrong

### Downstream Error Translations
The backend exception filter standardizes downstream Sales API failures:
- Downstream `401`/`403` &rarr; Mapped to `502 Bad Gateway` (Title: "Bad Downstream Gateway", Detail: "Received an invalid or unauthorized response from the booking gateway.")
- Downstream `404` &rarr; Mapped to `404 Not Found` (Title: "Booking Not Found", Detail: "The requested booking ID does not exist.")
- Downstream `429` &rarr; Mapped to `503 Service Unavailable` (Title: "Downstream Service Unavailable", Detail: "The booking service is busy or offline. Please retry in a moment.")
- Downstream `504` &rarr; Mapped to `504 Gateway Timeout` (Title: "Downstream Service Timeout", Detail: "The downstream request timed out.")
- Other/Unknown &rarr; Mapped to `502 Bad Gateway`
