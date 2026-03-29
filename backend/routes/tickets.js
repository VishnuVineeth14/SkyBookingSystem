const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getDB } = require('../config/db');

// GET /api/tickets
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const tickets = await db.collection('tickets').aggregate([
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
      {
        $lookup: {
          from: 'bookings',
          localField: 'booking_ref',
          foreignField: '_id',
          as: 'booking'
        }
      },
      { $unwind: { path: '$booking', preserveNullAndEmptyArrays: true } },
      { $sort: { issued_at: -1 } }
    ]).toArray();

    res.json({ success: true, data: tickets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/tickets/:pnr
router.get('/:pnr', async (req, res) => {
  try {
    const db = getDB();
    const ticket = await db.collection('tickets').aggregate([
      { $match: { pnr: req.params.pnr } },
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
      {
        $lookup: {
          from: 'bookings',
          localField: 'booking_ref',
          foreignField: '_id',
          as: 'booking'
        }
      },
      { $unwind: { path: '$booking', preserveNullAndEmptyArrays: true } }
    ]).toArray();

    if (!ticket.length) return res.status(404).json({ success: false, error: 'Ticket not found' });
    res.json({ success: true, data: ticket[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
