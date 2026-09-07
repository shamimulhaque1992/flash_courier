# Flash Courier API Documentation

Base URL: `https://flash-courier.vercel.app/api/v1`

Protected endpoints accept either the `accessToken` cookie or an `Authorization: Bearer <token>` header. Replace IDs and OTPs in the examples with real values. JSON endpoints use `Content-Type: application/json`.

## Auth

(POST): `/auth/register` - Public
(POST): `/auth/verify-email` - Public
(POST): `/auth/login` - Public
(POST): `/auth/refresh-token` - Public
(POST): `/auth/google` - Public
(POST): `/auth/forgot-password` - Public
(POST): `/auth/reset-password` - Public

Register example:

```json
{
  "name": "Customer One",
  "email": "customer@example.com",
  "password": "Secret123!",
  "customer": { "division": "DHAKA", "district": "Dhaka" }
}
```

Verify email: `{ "email": "customer@example.com", "otp": "123456" }`

Login: `{ "email": "customer@example.com", "password": "Secret123!" }`

Forgot password: `{ "email": "customer@example.com" }`

Reset password: `{ "email": "customer@example.com", "otp": "123456", "newPassword": "NewSecret123!" }`

## Users

(PATCH): `/users/profile-image` - All logged-in roles
Demo: `multipart/form-data`, field `profileImage=<file>`

## Merchants

(POST): `/merchants/apply-as-merchant` - Public, multipart
(POST): `/merchants/verify-email` - Public
(PATCH): `/merchants/approve` - Admin
(GET): `/merchants/my-profile` - Merchant
(PATCH): `/merchants/my-profile` - Merchant
(GET): `/merchants/` - Admin

Merchant application uses `multipart/form-data`: a `data` field containing the registration JSON, one `businessLicenseDocument`, and optional `additionalDocuments` files.

```json
{
  "user": { "name": "Shop One", "email": "shop@example.com", "password": "Secret123!", "role": "MERCHANT" },
  "merchant": { "contactNumber": "01700000000", "thana": "Dhanmondi", "district": "Dhaka", "division": "DHAKA", "address": "Dhaka", "tradeLicenseNumber": "TL-100", "businessLicenseNumber": "BL-100", "businessType": "Retail", "businessDescription": "Online shop" }
}
```

Approve: `{ "merchantId": "<merchant-id>", "verificationStatus": "VERIFIED" }` or use `REJECTED` with `rejectionReason`.

Update profile: `{ "body": { "contactNumber": "01700000000", "address": "New address" } }`

## Riders

(POST): `/riders/apply-as-rider` - Public, multipart
(POST): `/riders/verify-email` - Public
(PATCH): `/riders/approve` - Admin
(GET): `/riders/my-profile` - Rider
(PATCH): `/riders/my-profile` - Rider
(GET): `/riders/` - Admin

Rider application uses a `data` JSON field, one `nidDocument`, and optional `additionalDocuments` files.

```json
{ "user": { "name": "Rider One", "email": "rider@example.com", "password": "Secret123!", "role": "RIDER" }, "rider": { "contactNumber": "01700000000", "nidNumber": "1234567890", "thana": "Dhanmondi", "district": "Dhaka", "division": "DHAKA", "address": "Dhaka", "vehicleType": "Bike" } }
```

Approve: `{ "riderId": "<rider-id>", "verificationStatus": "VERIFIED" }` or use `REJECTED` with `rejectionReason`.

## Shipments

(POST): `/shipments/calculate-price` - Public
Demo: `{ "senderDivision": "DHAKA", "receiverDivision": "DHAKA", "packageWeight": 2, "isFragile": false }`
(POST): `/shipments/track` - Customer
Demo: `{ "trackingNumber": "FC-..." }`
(POST): `/shipments/create-shipment` - Merchant
(POST): `/shipments/re-pay` - Merchant
Demo: `{ "shipmentId": "<shipment-id>" }`
(GET): `/shipments/payment/callback` - Public; bKash callback query
(POST): `/shipments/assign` - Admin
Demo: `{ "shipmentId": "<shipment-id>", "scheduleId": "<schedule-id>" }`
(PATCH): `/shipments/respond/:shipmentId` - Rider
Demo: `{ "status": "ACCEPTED_BY_RIDER" }` or `REJECTED_BY_RIDER`
(PATCH): `/shipments/deliver/:shipmentId` - Rider
Demo: `{ "otp": "123456" }`
(PATCH): `/shipments/cancel` - Merchant
Demo: `{ "shipmentId": "<shipment-id>" }`
(PATCH): `/shipments/status/:shipmentId` - Admin
Demo: `{ "status": "READY_FOR_ASSIGNMENT", "remarks": "Payment confirmed" }`
(GET): `/shipments/my-shipments` - Merchant
(GET): `/shipments/my-deliveries` - Customer
(GET): `/shipments/my-assignments` - Rider
(GET): `/shipments/all` - Admin
(GET): `/shipments/:shipmentId` - Authorized user

Create shipment:

```json
{
  "receiverName": "Receiver One",
  "receiverEmail": "receiver@example.com",
  "receiverContactNumber": "01800000000",
  "receiverThana": "Uttara",
  "receiverDistrict": "Dhaka",
  "receiverDivision": "DHAKA",
  "receiverAddress": "House 1, Road 2",
  "packageDescription": "Books",
  "packageWeight": 2,
  "isFragile": false
}
```

## Rider Schedules

(POST): `/rider-schedules/create-schedule` - Rider
(GET): `/rider-schedules/my-schedules` - Rider
(GET): `/rider-schedules/all-schedules` - Admin
(GET): `/rider-schedules/todays-schedule` - Public
(PATCH): `/rider-schedules/update-schedule/:scheduleId` - Rider
(PATCH): `/rider-schedules/publish-schedule/:scheduleId` - Rider
(GET): `/rider-schedules/:scheduleId/slots` - Rider/Admin
(GET): `/rider-schedules/:scheduleId` - Rider/Admin
(DELETE): `/rider-schedules/:scheduleId` - Rider

Create schedule: `{ "dayOfWeek": "SATURDAY", "startTime": "10:00", "endTime": "19:00" }`

Update schedule: `{ "startTime": "11:00", "endTime": "20:00" }`

## Payments

(GET): `/payments/my-payments` - Merchant
(GET): `/payments/all` - Admin
(GET): `/payments/:paymentId` - Merchant/Admin

## Reviews

(POST): `/reviews/` - Customer
Demo: `{ "shipmentId": "<shipment-uuid>", "merchantRating": 5, "riderRating": 5, "comment": "Great service" }`
(GET): `/reviews/my-reviews` - Customer
(GET): `/reviews/merchant-reviews` - Merchant
(GET): `/reviews/rider-reviews` - Rider
(GET): `/reviews/all` - Admin
(PATCH): `/reviews/:reviewId` - Customer
Demo: `{ "riderRating": 4, "comment": "Good delivery" }`
(DELETE): `/reviews/:reviewId` - Customer/Admin

## Customers

(GET): `/customers/my-profile` - Customer
(PATCH): `/customers/my-profile` - Customer
Demo: `{ "body": { "address": "New address", "district": "Dhaka" } }`

## Analytics

(GET): `/analytics/admin` - Admin
(GET): `/analytics/merchant` - Merchant
(GET): `/analytics/rider` - Rider
(GET): `/analytics/customer` - Customer

## Audits

(POST): `/audits/` - Admin
Demo: `{ "merchantId": "<merchant-id>", "startDate": "2026-09-01", "endDate": "2026-09-07" }`
(GET): `/audits/:merchantId` - Admin