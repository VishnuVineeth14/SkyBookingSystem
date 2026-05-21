# Airline Reservation and Dynamic Pricing System (ARDPS)

ARDPS is a full-stack airline reservation platform with flight search, passenger management, seat holds, ticket lookup, and dynamic fare calculation. The app uses a Node.js + Express backend, MongoDB for data storage, and a static frontend served directly from the backend server.

## ✨ Project Specs

- **Flight search**: Search flights by origin, destination, and travel date.
- **Seat map booking**: View a live cabin layout and select only available seats.
- **10-minute seat holds**: Seats can be reserved temporarily before confirmation.
- **Concurrency protection**: Booking flow includes server-side checks to avoid duplicate seat sales.
- **Dynamic pricing**: Fare calculation changes with occupancy, route pricing rules, booking lead time, and meal preference.
- **Passenger registry**: Add and manage passenger profiles with contact and travel preferences.
- **Booking records**: Review confirmed bookings with passenger and flight details.
- **Ticket lookup**: Search by PNR or browse issued tickets.
- **Admin dashboard**: View operational summaries such as revenue, booking status, occupancy, and cancellations.
- **Static frontend hosting**: The backend serves the frontend application from the same server.

## 🧱 Tech Stack

- **Frontend**: HTML5, CSS3, vanilla JavaScript, Fetch API, Flatpickr.
- **Backend**: Node.js, Express.js, CORS.
- **Database**: MongoDB with schema validation, indexes, and typed BSON values.
- **Data model**: Airports, aircraft, flights, passengers, bookings, pricing rules, tickets, and seat holds.

## 🗂️ Project Structure

```text
airport_reservation_system/
├── README.md
├── collection_create.js
├── insert_data.js
├── debug.js
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── config/
│   │   └── db.js
│   └── routes/
│       ├── admin.js
│       ├── bookings.js
│       ├── flights.js
│       ├── passengers.js
│       ├── pricing.js
│       └── tickets.js
└── frontend/
    ├── index.html
    ├── css/
    │   └── style.css
    └── js/
        └── app.js
```

## 🛰️ Backend Modules

- **`server.js`**: Starts the Express app, connects to MongoDB, serves the frontend, and mounts the API routes.
- **`config/db.js`**: Manages MongoDB connection lifecycle and shared database access.
- **`routes/flights.js`**: Flight listing, search, seat map generation, and seat hold creation.
- **`routes/bookings.js`**: Booking creation and booking listing.
- **`routes/passengers.js`**: Passenger listing, retrieval, and registration.
- **`routes/pricing.js`**: Fare estimation with occupancy-based pricing and meal surcharges.
- **`routes/tickets.js`**: Ticket listing and PNR lookup.
- **`routes/admin.js`**: Dashboard stats and airport list for the UI.

## 🎨 Frontend Experience

- **Search page**: Find flights using origin, destination, and date filters.
- **Booking modal**: Select passenger, cabin class, seat, payment method, and meal preference.
- **Live seat refresh**: Seat availability updates automatically while the booking modal is open.
- **Passenger page**: Register new passengers and list existing records.
- **Bookings page**: Inspect booking history.
- **Tickets page**: Search tickets by PNR or load all tickets.
- **Admin page**: Show summary cards and charts for operations visibility.

## 🗃️ Database Collections

- **`airports`**: Airport master data and coordinates.
- **`aircraft`**: Aircraft models, seating configuration, and status.
- **`flights`**: Flight schedules, base fares, and seat inventory.
- **`passengers`**: Passenger identity, contact details, and preferences.
- **`bookings`**: Confirmed and cancelled reservations.
- **`pricing_rules`**: Route-based pricing rules and demand brackets.
- **`tickets`**: Issued tickets with PNR and baggage details.
- **`seat_holds`**: Temporary seat reservations with expiry timestamps.

## 🚀 How to Run

This project expects Node.js and a MongoDB instance available at `mongodb://localhost:27017` unless you override `MONGO_URI`.

### 1) Create the schema

Run the schema setup script first so the collections, validators, and indexes exist.

```bash
mongosh < collection_create.js
```

### 2) Load sample data

Insert the demo airports, aircraft, flights, passengers, bookings, pricing rules, and tickets.

```bash
mongosh < insert_data.js
```

### 3) Start the backend

```bash
cd backend
npm install
npm start
```

The server should start on `http://localhost:3000`.

### 4) Open the app

Open `http://localhost:3000` in your browser. The backend serves the frontend files directly, so no separate frontend server is needed.

## 🔌 Main API Endpoints

- **Flights**: `GET /api/flights`, `GET /api/flights/search`, `GET /api/flights/:id`, `GET /api/flights/:id/seats`, `POST /api/flights/:id/seats/hold`
- **Passengers**: `GET /api/passengers`, `GET /api/passengers/:id`, `POST /api/passengers`
- **Bookings**: `GET /api/bookings`, `POST /api/bookings`
- **Tickets**: `GET /api/tickets`, `GET /api/tickets/:pnr`
- **Pricing**: `GET /api/pricing`
- **Admin**: `GET /api/admin/stats`, `GET /api/admin/airports`

## 🧠 Booking Flow

1. A user selects a flight and opens the booking modal.
2. The frontend requests the seat map and live pricing details.
3. The user selects a seat, and the app creates a temporary hold.
4. The app refreshes seat status regularly so other users’ changes are visible.
5. On confirmation, the backend validates the hold, checks availability, writes the booking, and issues the ticket data.
6. The UI updates to show the confirmed result and clears the active hold state.
