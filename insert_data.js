db = db.getSiblingDB('ARDPS');

// Clear existing data so we can run cleanly
db.airports.deleteMany({});
db.aircraft.deleteMany({});
db.flights.deleteMany({});
db.passengers.deleteMany({});
db.bookings.deleteMany({});
db.pricing_rules.deleteMany({});
db.tickets.deleteMany({});

// ===================== AIRPORTS =====================
db.airports.insertMany([
{
  _id: "MAA",
  name: "Chennai International Airport",
  city: "Chennai",
  country: "India",
  timezone: "Asia/Kolkata",
  terminals: ["T1","T2"],
  coordinates: { lat: Double(12.9941), lng: Double(80.1709) }
},
{
  _id: "DEL",
  name: "Indira Gandhi International Airport",
  city: "Delhi",
  country: "India",
  timezone: "Asia/Kolkata",
  terminals: ["T1","T3"],
  coordinates: { lat: Double(28.5562), lng: Double(77.1000) }
}
]);

// ===================== AIRCRAFT =====================
db.aircraft.insertMany([
{
  _id: "AC-001",
  registration_number: "VT-AIL",
  model: "Boeing 737-800",
  total_seats: NumberInt(162),
  seat_config: { economy: NumberInt(138), business: NumberInt(24), first_class: NumberInt(0) },
  status: "active"
},
{
  _id: "AC-002",
  registration_number: "VT-XYZ",
  model: "Airbus A320",
  total_seats: NumberInt(180),
  seat_config: { economy: NumberInt(150), business: NumberInt(30), first_class: NumberInt(0) },
  status: "active"
}
]);

// ===================== FLIGHTS =====================
db.flights.insertMany([
{
  _id: "FL-001",
  flight_number: "AI-202",
  aircraft_ref: "AC-001",
  origin_ref: "MAA",
  destination_ref: "DEL",
  departure_time: new Date("2025-04-01T06:00:00Z"),
  arrival_time: new Date("2025-04-01T08:30:00Z"),
  status: "scheduled",
  base_fare: { economy: Double(3500.0), business: Double(12000.0), first_class: null },
  stops: [],
  seat_inventory: {
    economy: { total: NumberInt(138), available: NumberInt(100) },
    business: { total: NumberInt(24), available: NumberInt(10) },
    first_class: { total: NumberInt(0), available: NumberInt(0) }
  }
},
{
  _id: "FL-002",
  flight_number: "AI-303",
  aircraft_ref: "AC-002",
  origin_ref: "DEL",
  destination_ref: "MAA",
  departure_time: new Date("2025-04-02T10:00:00Z"),
  arrival_time: new Date("2025-04-02T12:45:00Z"),
  status: "scheduled",
  base_fare: { economy: Double(4000.0), business: Double(13000.0), first_class: null },
  stops: [],
  seat_inventory: {
    economy: { total: NumberInt(150), available: NumberInt(120) },
    business: { total: NumberInt(30), available: NumberInt(15) },
    first_class: { total: NumberInt(0), available: NumberInt(0) }
  }
}
]);

// ===================== PASSENGERS =====================
const p1 = new ObjectId();
const p2 = new ObjectId();

db.passengers.insertMany([
{
  _id: p1,
  full_name: "Priya Ramesh",
  email: "priya.ramesh@email.com",
  phone: "+91-9876543210",
  passport_number: "Z1234567",
  nationality: "Indian",
  date_of_birth: new Date("1995-08-15"),
  frequent_flyer: { ff_number: "FF-90212", tier: "Gold", miles: NumberInt(15000) },
  preferences: { meal: "vegetarian", seat_type: "window" },
  booking_history: []
},
{
  _id: p2,
  full_name: "Arjun Kumar",
  email: "arjun.kumar@email.com",
  phone: "+91-9123456789",
  passport_number: "X7654321",
  nationality: "Indian",
  date_of_birth: new Date("1992-05-10"),
  preferences: { meal: "non-veg", seat_type: "aisle" },
  booking_history: []
}
]);

// ===================== BOOKINGS =====================
const b1 = new ObjectId();
const b2 = new ObjectId();

db.bookings.insertMany([
{
  _id: b1,
  booking_ref: "BK-001",
  passenger_ref: p1,
  flight_ref: "FL-001",
  cabin_class: "economy",
  seat_number: "14B",
  fare_paid: Double(4200.50),
  booking_status: "confirmed",
  booked_at: new Date(),
  pricing_snapshot: {
    base_fare: Double(3500.0),
    demand_multiplier: Double(1.2),
    advance_discount_pct: Double(10.0),
    taxes: Double(300.5)
  },
  payment: {
    method: "card",
    transaction_id: "TXN-1001",
    paid_at: new Date()
  },
  cancellation: null
},
{
  _id: b2,
  booking_ref: "BK-002",
  passenger_ref: p2,
  flight_ref: "FL-002",
  cabin_class: "business",
  seat_number: "2A",
  fare_paid: Double(13500.00),
  booking_status: "confirmed",
  booked_at: new Date(),
  pricing_snapshot: {
    base_fare: Double(13000.0),
    demand_multiplier: Double(1.1),
    advance_discount_pct: Double(5.0),
    taxes: Double(500.0)
  },
  payment: {
    method: "upi",
    transaction_id: "TXN-1002",
    paid_at: new Date()
  },
  cancellation: null
}
]);

// ===================== PRICING RULES =====================
db.pricing_rules.insertMany([
{
  _id: new ObjectId(),
  route: { origin: "MAA", destination: "DEL" },
  cabin_class: "economy",
  season: "peak",
  base_price: Double(3500.0),
  demand_brackets: [
    { occupancy_pct_min: NumberInt(0), occupancy_pct_max: NumberInt(50), multiplier: Double(1.0) },
    { occupancy_pct_min: NumberInt(51), occupancy_pct_max: NumberInt(100), multiplier: Double(1.5) }
  ],
  advance_booking_discount: [
    { days_before: NumberInt(30), discount_pct: Double(10.0) }
  ],
  valid_from: new Date("2025-01-01"),
  valid_until: new Date("2025-06-30")
},
{
  _id: new ObjectId(),
  route: { origin: "DEL", destination: "MAA" },
  cabin_class: "business",
  season: "off-peak",
  base_price: Double(12000.0),
  demand_brackets: [
    { occupancy_pct_min: NumberInt(0), occupancy_pct_max: NumberInt(100), multiplier: Double(1.2) }
  ],
  valid_from: new Date("2025-01-01"),
  valid_until: new Date("2025-12-31")
}
]);

// ===================== TICKETS =====================
db.tickets.insertMany([
{
  _id: new ObjectId(),
  pnr: "PNR-001",
  booking_ref: b1,
  passenger_ref: p1,
  flight_ref: "FL-001",
  seat_number: "14B",
  cabin_class: "economy",
  baggage: { check_in_kg: NumberInt(25), cabin_kg: NumberInt(7) },
  meal_preference: "vegetarian",
  issued_at: new Date(),
  status: "valid"
},
{
  _id: new ObjectId(),
  pnr: "PNR-002",
  booking_ref: b2,
  passenger_ref: p2,
  flight_ref: "FL-002",
  seat_number: "2A",
  cabin_class: "business",
  baggage: { check_in_kg: NumberInt(30), cabin_kg: NumberInt(10) },
  issued_at: new Date(),
  status: "valid"
}
]);

// ===================== INVALID TEST CASES =====================
print("Starting invalid test cases...");

try {
  // Missing required fields (should FAIL)
  db.airports.insertOne({
    _id: "BLR"
  });
  print("ERROR: Invalid test case (airports missing fields) surprisingly succeeded.");
} catch (e) { print("Expected error on BLR missing fields: " + e.message); }

try {
  // Wrong data type (should FAIL)
  db.aircraft.insertOne({
    _id: "AC-003",
    model: "Boeing 777",
    total_seats: "300",
    seat_config: { economy: 200, business: 50, first_class: 50 },
    status: "active"
  });
  print("ERROR: Invalid test case (AC-003 wrong type) surprisingly succeeded.");
} catch (e) { print("Expected error on AC-003 wrong type: " + e.message); }

try {
  // Invalid enum (should FAIL)
  db.bookings.insertOne({
    _id: new ObjectId(),
    booking_ref: "BK-003",
    passenger_ref: p1,
    flight_ref: "FL-001",
    cabin_class: "premium",
    seat_number: "10A",
    fare_paid: Double(5000.0),
    booking_status: "confirmed"
  });
  print("ERROR: Invalid test case (BK-003 invalid enum) surprisingly succeeded.");
} catch (e) { print("Expected error on BK-003 invalid enum: " + e.message); }

print("Data insertion completed.");
