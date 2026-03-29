const express = require('express');
const router = express.Router();
const { getDB } = require('../config/db');

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const db = getDB();

    // Total counts
    const [totalFlights, totalPassengers, totalBookings, totalTickets] = await Promise.all([
      db.collection('flights').countDocuments(),
      db.collection('passengers').countDocuments(),
      db.collection('bookings').countDocuments(),
      db.collection('tickets').countDocuments()
    ]);

    // Booking stats by status
    const bookingStats = await db.collection('bookings').aggregate([
      {
        $group: {
          _id: '$booking_status',
          count: { $sum: 1 },
          total_revenue: { $sum: '$fare_paid' }
        }
      }
    ]).toArray();

    // Revenue by cabin class
    const revenueByCabin = await db.collection('bookings').aggregate([
      { $match: { booking_status: 'confirmed' } },
      {
        $group: {
          _id: '$cabin_class',
          count: { $sum: 1 },
          revenue: { $sum: '$fare_paid' }
        }
      }
    ]).toArray();

    // Flight occupancy
    const flightOccupancy = await db.collection('flights').aggregate([
      {
        $project: {
          flight_number: 1,
          origin_ref: 1,
          destination_ref: 1,
          status: 1,
          economy_booked: {
            $subtract: ['$seat_inventory.economy.total', '$seat_inventory.economy.available']
          },
          business_booked: {
            $subtract: ['$seat_inventory.business.total', '$seat_inventory.business.available']
          },
          seats: '$seat_inventory'
        }
      }
    ]).toArray();

    // Cancellation stats
    const cancellationStats = await db.collection('bookings').aggregate([
      { $match: { booking_status: 'cancelled' } },
      {
        $group: {
          _id: null,
          total_cancellations: { $sum: 1 },
          total_refunds: { $sum: '$cancellation.refund_amount' }
        }
      }
    ]).toArray();

    // Total confirmed revenue
    const confirmedRevenue = bookingStats.find(s => s._id === 'confirmed');

    res.json({
      success: true,
      data: {
        overview: {
          total_flights: totalFlights,
          total_passengers: totalPassengers,
          total_bookings: totalBookings,
          total_tickets: totalTickets,
          total_revenue: confirmedRevenue ? Math.round(confirmedRevenue.total_revenue * 100) / 100 : 0,
          confirmed_bookings: confirmedRevenue ? confirmedRevenue.count : 0
        },
        booking_by_status: bookingStats,
        revenue_by_cabin: revenueByCabin,
        flight_occupancy: flightOccupancy,
        cancellations: cancellationStats[0] || { total_cancellations: 0, total_refunds: 0 }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/airports
router.get('/airports', async (req, res) => {
  try {
    const db = getDB();
    const airports = await db.collection('airports').find({}).toArray();
    res.json({ success: true, data: airports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
