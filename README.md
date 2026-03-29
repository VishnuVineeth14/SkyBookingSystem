# Airline Reservation and Dynamic Pricing System (ARDPS)

ARDPS is a modern, full-stack Airline Reservation System featuring visual seat mapping, real-time concurrency-safe bookings, and dynamic flight pricing based on occupancy, advance booking lead times, and meal preferences. 

## 🚀 Features

- **Visual Seat Selection**: Interactive airplane layout where users can pick available seats. Real-time status indication (Green = Available, Red = Booked).
- **Atomic Concurrency Checks**: Highly reliable booking flow that prevents duplicate bookings on the same seat by utilizing database-level transaction double-checking.
- **Dynamic Pricing Algorithm**: Auto-calculates flight fares based on available seat inventory, occupancy demand curves, and dynamic lead-time tiers. Includes a real-time price breakdown.
- **Admin Dashboard**: Visual analytics containing statistics on bookings, revenue, and passenger demographics.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (Fetch API).
- **Backend / API**: Node.js, Express.js, CORS.
- **Database**: MongoDB (Native Driver), utilizing advanced BSON type-checks (Double, Int32) and schema validation.

---

## 🏃‍♂️ How to Run the Application

This project requires a running instance of MongoDB (running on the default `localhost:27017`) and Node.js.

### 1. Initialize the Database
Before running the server, you **must** build the strict database schema and insert the sample data. In your terminal, run the following Mongosh scripts:

1. **Create Collections and Schema Validation:**
   ```bash
   mongosh < collection_create.js
   ```
2. **Insert Initial Data (Airports, Aircraft, Flights, Pricing Rules):**
   ```bash
   mongosh < insert_data.js
   ```

### 2. Start the Backend Server
Navigate to the `backend` directory, install any dependencies (if you haven't yet), and start the Express server.
```bash
cd backend
npm install
node server.js
```
The console should confirm: `ARDPS Server running on http://localhost:3000`

### 3. Open the Frontend
Since the frontend uses relative API fetching, the backend server actually serves the `frontend` folder directly.
Simply open your web browser and navigate to:
**[http://localhost:3000](http://localhost:3000)**

---

## 📡 System Architecture & Connectivity Flow

The system uses a unified client-server architecture where the frontend orchestrates data by interacting directly with RESTful endpoints on the Express Backend. 

1. **User Action (Frontend)**: The user interacts with the UI (e.g., clicking "Search flights" or picking a specific seat).
2. **API Request (JS Fetch)**: `app.js` catches the event and constructs an HTTP Request to the Express server (e.g., `GET /api/flights/FL-001/seats`).
3. **Backend Route Handler**: The Express router (e.g., `flights.js` or `bookings.js`) receives the request.
4. **Database Query**: The backend queries the MongoDB database. For bookings, this includes **Atomic Operations** (like `$inc` to decrement seat counts) directly verified alongside MongoDB `findOne` and `$gte` conditions to ensure safe data mutation.
5. **Response Delivery**: The modified data is compiled, mapped, and cleanly returned as a JSON payload (`{ success: true, data: [...] }`).
6. **Frontend Render**: `app.js` processes the new JSON payload and surgically updates the DOM (HTML/CSS) to reflect the new state (showing the Seat Map grid, updating the Price Total, or transitioning to the confirmed Ticket screen).
