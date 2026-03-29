const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getDB } = require('../config/db');

// GET /api/passengers
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const passengers = await db.collection('passengers').find({}).toArray();
    res.json({ success: true, data: passengers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/passengers/:id
router.get('/:id', async (req, res) => {
  try {
    const db = getDB();
    const passenger = await db.collection('passengers').findOne({ _id: new ObjectId(req.params.id) });
    if (!passenger) return res.status(404).json({ success: false, error: 'Passenger not found' });
    res.json({ success: true, data: passenger });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/passengers
router.post('/', async (req, res) => {
  try {
    const db = getDB();
    const { full_name, email, phone, passport_number, nationality, date_of_birth, preferences, frequent_flyer } = req.body;

    if (!full_name || !email || !phone || !nationality || !date_of_birth) {
      return res.status(400).json({ success: false, error: 'Missing required fields: full_name, email, phone, nationality, date_of_birth' });
    }

    const doc = {
      _id: new ObjectId(),
      full_name,
      email,
      phone,
      nationality,
      date_of_birth: new Date(date_of_birth),
      booking_history: []
    };

    if (passport_number) doc.passport_number = passport_number;
    if (preferences) doc.preferences = preferences;
    if (frequent_flyer) {
      doc.frequent_flyer = {
        ff_number: frequent_flyer.ff_number,
        tier: frequent_flyer.tier,
        miles: parseInt(frequent_flyer.miles) || 0
      };
    }

    await db.collection('passengers').insertOne(doc);
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, error: 'A passenger with this email or passport number already exists.' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
