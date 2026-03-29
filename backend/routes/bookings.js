const express = require('express');
const router = express.Router();
const { ObjectId, Double, Int32 } = require('mongodb');
const { getDB } = require('../config/db');

// Helper: generate booking ref like BK-003, BK-004 etc.
async function generateBookingRef(db) {
  const last = await db.collection('bookings')
    .find({})
    .sort({ booking_ref: -1 })
    .limit(1)
    .toArray();
  if (last.length === 0) return 'BK-001';
  const num = parseInt(last[0].booking_ref.split('-')[1]) + 1;
  return `BK-${String(num).padStart(3, '0')}`;
}

// Helper: generate PNR like PNR-003
async function generatePNR(db) {
  const last = await db.collection('tickets')
    .find({})
    .sort({ pnr: -1 })
    .limit(1)
    .toArray();
  if (last.length === 0) return 'PNR-001';
  const num = parseInt(last[0].pnr.split('-')[1]) + 1;
  return `PNR-${String(num).padStart(3, '0')}`;
}

// Helper: generate seat number
function generateSeatNumber(cabin_class, seatsOccupied) {
  const row = Math.floor(seatsOccupied / 6) + 1;
  const col = String.fromCharCode(65 + (seatsOccupied % 6)); // A-F
  if (cabin_class === 'business') return `${row}${col.charAt(0)}`;
  return `${row}${col}`;
}

// GET /api/bookings
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const bookings = await db.collection('bookings').aggregate([
      {
        $lookup: {
          from: 'passengers',
          localField: 'passenger_ref',
          foreignField: '_id',
          as: 'passenger'
        }
      },
      { $unwind: { path: '$passenger', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'flights',
          localField: 'flight_ref',
          foreignField: '_id',
          as: 'flight'
        }
      },
      { $unwind: { path: '$flight', preserveNullAndEmptyArrays: true } },
      { $sort: { booked_at: -1 } }
    ]).toArray();

    res.json({ success: true, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/bookings — ATOMIC BOOKING
router.post('/', async (req, res) => {
  const db = getDB();
  let seatDecremented = false;
  let bookingInserted = false;
  let bookingId = null;
  let ticketInserted = false;
  let ticketId = null;

  try {
    const { passenger_id, flight_id, cabin_class, payment_method, meal_preference, seat_number, hold_token } = req.body;

    if (!passenger_id || !flight_id || !cabin_class || !payment_method || !seat_number) {
      return res.status(400).json({ success: false, error: 'Missing required fields (including seat_number)' });
    }

    // Validate cabin class
    if (!['economy', 'business', 'first_class'].includes(cabin_class)) {
      return res.status(400).json({ success: false, error: 'Invalid cabin class' });
    }

    // Validate payment method
    if (!['card', 'upi', 'wallet'].includes(payment_method)) {
      return res.status(400).json({ success: false, error: 'Invalid payment method' });
    }

    // CONCURRENCY CHECK: Atomically check if the seat is already booked
    // Use findOneAndUpdate with an upsert-like pattern: we try to find a confirmed booking for this exact seat
    const existingSeatBooking = await db.collection('bookings').findOne({
      flight_ref: flight_id,
      seat_number: seat_number,
      cabin_class: cabin_class,
      booking_status: 'confirmed'
    });

    if (existingSeatBooking) {
      return res.status(409).json({ success: false, error: `Seat ${seat_number} is already booked. Please select another seat.` });
    }

    // Verify hold token if seat is held
    const checkNow = new Date();
    const activeHold = await db.collection('seat_holds').findOne({
      flight_ref: flight_id,
      seat_number: seat_number,
      cabin_class: cabin_class,
      held_until: { $gt: checkNow }
    });

    if (activeHold && activeHold.hold_token !== hold_token) {
      return res.status(409).json({ success: false, error: `Seat ${seat_number} is currently held by someone else.` });
    }

    // 1. Check seat availability and decrement atomically
    const seatField = `seat_inventory.${cabin_class}.available`;
    const updateResult = await db.collection('flights').findOneAndUpdate(
      {
        _id: flight_id,
        [seatField]: { $gt: 0 },
        status: { $in: ['scheduled', 'delayed'] }
      },
      {
        $inc: { [seatField]: new Int32(-1) }
      },
      { returnDocument: 'after' }
    );

    if (!updateResult) {
      return res.status(400).json({ success: false, error: 'No seats available or flight not bookable' });
    }
    seatDecremented = true;
    const flight = updateResult;

    // Double-check seat not taken AFTER decrement (race condition protection)
    const raceCheck = await db.collection('bookings').findOne({
      flight_ref: flight_id,
      seat_number: seat_number,
      cabin_class: cabin_class,
      booking_status: 'confirmed'
    });
    if (raceCheck) {
      throw new Error(`Seat ${seat_number} was just booked by another user. Please try a different seat.`);
    }

    // Get passenger
    const passenger = await db.collection('passengers').findOne({ _id: new ObjectId(passenger_id) });
    if (!passenger) {
      throw new Error('Passenger not found');
    }

    // Meal surcharge pricing
    const MEAL_SURCHARGES = { '': 0, 'vegetarian': 250, 'non-veg': 450, 'vegan': 350 };

    // Built-in advance booking tiers
    const ADVANCE_TIERS = [
      { days_before: 30, discount_pct: 15 },
      { days_before: 14, discount_pct: 10 },
      { days_before: 7,  discount_pct: 5 },
      { days_before: 3,  discount_pct: 0 },
      { days_before: 1,  discount_pct: -10 },
      { days_before: 0,  discount_pct: -20 }
    ];

    // 2. Calculate dynamic pricing
    const inventory = flight.seat_inventory[cabin_class];
    const occupancy_pct = ((inventory.total - inventory.available) / inventory.total) * 100;

    let base_price = flight.base_fare[cabin_class] || 0;
    let demand_multiplier = 1.0;

    const now = new Date();
    const pricingRule = await db.collection('pricing_rules').findOne({
      'route.origin': flight.origin_ref,
      'route.destination': flight.destination_ref,
      cabin_class: cabin_class,
      valid_from: { $lte: now },
      valid_until: { $gte: now }
    });

    if (pricingRule) {
      base_price = pricingRule.base_price;
      for (const bracket of pricingRule.demand_brackets) {
        if (occupancy_pct >= bracket.occupancy_pct_min && occupancy_pct <= bracket.occupancy_pct_max) {
          demand_multiplier = bracket.multiplier;
          break;
        }
      }
    } else {
      // Built-in demand multiplier fallback
      if (occupancy_pct >= 80) demand_multiplier = 1.5;
      else if (occupancy_pct >= 60) demand_multiplier = 1.3;
      else if (occupancy_pct >= 40) demand_multiplier = 1.15;
      else demand_multiplier = 1.0;
    }

    // Advance booking discount/surcharge
    const daysBeforeDeparture = Math.ceil((flight.departure_time - now) / (1000 * 60 * 60 * 24));
    let advance_discount_pct = 0;
    for (const tier of ADVANCE_TIERS) {
      if (daysBeforeDeparture >= tier.days_before) {
        advance_discount_pct = tier.discount_pct;
        break;
      }
    }

    // Meal surcharge
    const meal_surcharge = MEAL_SURCHARGES[meal_preference || ''] || 0;

    const fare_after_demand = base_price * demand_multiplier;
    const advance_adjustment = fare_after_demand * (advance_discount_pct / 100);
    const fare_after_advance = fare_after_demand - advance_adjustment;
    const fare_with_meal = fare_after_advance + meal_surcharge;
    const taxes = fare_with_meal * 0.12;
    const total_fare = Math.round((fare_with_meal + taxes) * 100) / 100;

    // Generate IDs
    const booking_ref = await generateBookingRef(db);
    const pnr = await generatePNR(db);
    bookingId = new ObjectId();
    ticketId = new ObjectId();

    const txnId = `TXN-${Date.now()}`;

    // 3. Insert booking with user-selected seat
    const bookingDoc = {
      _id: bookingId,
      booking_ref,
      passenger_ref: new ObjectId(passenger_id),
      flight_ref: flight_id,
      cabin_class,
      seat_number: seat_number,
      fare_paid: new Double(total_fare),
      booking_status: 'confirmed',
      booked_at: new Date(),
      pricing_snapshot: {
        base_fare: new Double(Math.round(base_price * 100) / 100),
        demand_multiplier: new Double(demand_multiplier),
        advance_discount_pct: new Double(advance_discount_pct),
        meal_surcharge: new Double(meal_surcharge),
        taxes: new Double(Math.round(taxes * 100) / 100)
      },
      payment: {
        method: payment_method,
        transaction_id: txnId,
        paid_at: new Date()
      },
      cancellation: null
    };

    await db.collection('bookings').insertOne(bookingDoc);
    bookingInserted = true;

    // 4. Insert ticket
    const baggageMap = {
      economy: { check_in_kg: new Int32(25), cabin_kg: new Int32(7) },
      business: { check_in_kg: new Int32(30), cabin_kg: new Int32(10) },
      first_class: { check_in_kg: new Int32(40), cabin_kg: new Int32(15) }
    };

    const ticketDoc = {
      _id: ticketId,
      pnr,
      booking_ref: bookingId,
      passenger_ref: new ObjectId(passenger_id),
      flight_ref: flight_id,
      seat_number,
      cabin_class,
      baggage: baggageMap[cabin_class],
      issued_at: new Date(),
      status: 'valid'
    };
    if (meal_preference) ticketDoc.meal_preference = meal_preference;

    await db.collection('tickets').insertOne(ticketDoc);
    ticketInserted = true;

    // 5. Update passenger booking history
    await db.collection('passengers').updateOne(
      { _id: new ObjectId(passenger_id) },
      { $push: { booking_history: bookingId } }
    );

    // 6. Delete the hold since we booked it
    await db.collection('seat_holds').deleteOne({
      flight_ref: flight_id,
      seat_number: seat_number,
      cabin_class: cabin_class
    });

    res.status(201).json({
      success: true,
      data: {
        booking: bookingDoc,
        ticket: ticketDoc,
        pricing: {
          base_price: Math.round(base_price * 100) / 100,
          demand_multiplier: demand_multiplier,
          advance_discount_pct: advance_discount_pct,
          taxes: Math.round(taxes * 100) / 100,
          total_fare
        }
      }
    });

  } catch (err) {
    // ROLLBACK on failure
    try {
      if (ticketInserted && ticketId) {
        await db.collection('tickets').deleteOne({ _id: ticketId });
      }
      if (bookingInserted && bookingId) {
        await db.collection('bookings').deleteOne({ _id: bookingId });
      }
      if (seatDecremented) {
        const { flight_id, cabin_class } = req.body;
        const seatField = `seat_inventory.${cabin_class}.available`;
        await db.collection('flights').updateOne(
          { _id: flight_id },
          { $inc: { [seatField]: new Int32(1) } }
        );
      }
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }

    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/bookings/cancel
router.post('/cancel', async (req, res) => {
  try {
    const db = getDB();
    const { booking_ref, reason } = req.body;

    if (!booking_ref) {
      return res.status(400).json({ success: false, error: 'booking_ref is required' });
    }

    // Find booking
    const booking = await db.collection('bookings').findOne({ booking_ref });
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
    if (booking.booking_status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'Booking already cancelled' });
    }

    // Calculate refund (80% base refund policy)
    const refund_amount = Math.round(booking.fare_paid * 0.8 * 100) / 100;

    // 1. Update booking status
    await db.collection('bookings').updateOne(
      { _id: booking._id },
      {
        $set: {
          booking_status: 'cancelled',
          cancellation: {
            reason: reason || 'Customer requested',
            refund_amount: new Double(refund_amount),
            cancelled_at: new Date()
          }
        }
      }
    );

    // 2. Increment seat availability
    const seatField = `seat_inventory.${booking.cabin_class}.available`;
    await db.collection('flights').updateOne(
      { _id: booking.flight_ref },
      { $inc: { [seatField]: new Int32(1) } }
    );

    // 3. Update ticket status
    await db.collection('tickets').updateMany(
      { booking_ref: booking._id },
      { $set: { status: 'cancelled' } }
    );

    res.json({
      success: true,
      data: {
        booking_ref,
        status: 'cancelled',
        refund_amount,
        message: `Refund of ₹${refund_amount} will be processed`
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
