const express = require('express');
const router = express.Router();
const { getDB } = require('../config/db');

// Meal surcharge pricing (flat add-on per meal type)
const MEAL_SURCHARGES = {
  '': 0,
  'vegetarian': 250,
  'non-veg': 450,
  'vegan': 350
};

// Built-in advance booking tiers (always applied)
// Sorted descending by days_before — first match wins
const ADVANCE_BOOKING_TIERS = [
  { days_before: 30, discount_pct: 15, label: '30+ days early' },
  { days_before: 14, discount_pct: 10, label: '14+ days early' },
  { days_before: 7,  discount_pct: 5,  label: '7+ days early' },
  { days_before: 3,  discount_pct: 0,  label: '3-6 days before' },
  { days_before: 1,  discount_pct: -10, label: 'Last-minute surge' }, // negative = surcharge
  { days_before: 0,  discount_pct: -20, label: 'Same-day surge' }
];

function getAdvanceBookingAdjustment(departureTime) {
  const now = new Date();
  const daysBeforeDeparture = Math.ceil((new Date(departureTime) - now) / (1000 * 60 * 60 * 24));

  for (const tier of ADVANCE_BOOKING_TIERS) {
    if (daysBeforeDeparture >= tier.days_before) {
      return { days_before: daysBeforeDeparture, discount_pct: tier.discount_pct, label: tier.label };
    }
  }
  // Past departure
  return { days_before: daysBeforeDeparture, discount_pct: 0, label: 'Departure passed' };
}

// GET /api/pricing?origin=MAA&destination=DEL&cabin_class=economy&flight_id=FL-001&meal=vegetarian
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const { origin, destination, cabin_class, flight_id, meal } = req.query;

    if (!origin || !destination || !cabin_class || !flight_id) {
      return res.status(400).json({ success: false, error: 'Required: origin, destination, cabin_class, flight_id' });
    }

    // Get flight for seat inventory
    const flight = await db.collection('flights').findOne({ _id: flight_id });
    if (!flight) return res.status(404).json({ success: false, error: 'Flight not found' });

    const inventory = flight.seat_inventory[cabin_class];
    if (!inventory || inventory.total === 0) {
      return res.status(400).json({ success: false, error: `No ${cabin_class} seats on this flight` });
    }

    // Calculate occupancy
    const occupancy_pct = ((inventory.total - inventory.available) / inventory.total) * 100;

    // Find matching pricing rule (from DB)
    const now = new Date();
    const pricingRule = await db.collection('pricing_rules').findOne({
      'route.origin': origin,
      'route.destination': destination,
      cabin_class: cabin_class,
      valid_from: { $lte: now },
      valid_until: { $gte: now }
    });

    // Fallback to flight base_fare if no pricing rule found
    let base_price = flight.base_fare[cabin_class] || 0;
    let demand_multiplier = 1.0;
    let rule_applied = false;

    if (pricingRule) {
      base_price = pricingRule.base_price;
      rule_applied = true;

      // Find demand bracket from DB rule
      for (const bracket of pricingRule.demand_brackets) {
        if (occupancy_pct >= bracket.occupancy_pct_min && occupancy_pct <= bracket.occupancy_pct_max) {
          demand_multiplier = bracket.multiplier;
          break;
        }
      }
    } else {
      // Built-in demand multiplier when no DB rule exists
      if (occupancy_pct >= 80) demand_multiplier = 1.5;
      else if (occupancy_pct >= 60) demand_multiplier = 1.3;
      else if (occupancy_pct >= 40) demand_multiplier = 1.15;
      else demand_multiplier = 1.0;
    }

    // Advance booking adjustment (always applied)
    const advanceInfo = getAdvanceBookingAdjustment(flight.departure_time);

    // Meal surcharge
    const meal_surcharge = MEAL_SURCHARGES[meal || ''] || 0;

    // Calculate final fare
    const fare_after_demand = base_price * demand_multiplier;
    const advance_adjustment = fare_after_demand * (advanceInfo.discount_pct / 100); // positive = discount, negative = surcharge
    const fare_after_advance = fare_after_demand - advance_adjustment;
    const fare_with_meal = fare_after_advance + meal_surcharge;
    const taxes = fare_with_meal * 0.12;
    const total_fare = fare_with_meal + taxes;

    res.json({
      success: true,
      data: {
        base_price: Math.round(base_price * 100) / 100,
        occupancy_pct: Math.round(occupancy_pct * 100) / 100,
        demand_multiplier,
        advance_booking: {
          days_before: advanceInfo.days_before,
          discount_pct: advanceInfo.discount_pct,
          label: advanceInfo.label,
          adjustment: Math.round(advance_adjustment * 100) / 100
        },
        meal_surcharge,
        meal_type: meal || 'none',
        fare_after_demand: Math.round(fare_after_demand * 100) / 100,
        fare_after_advance: Math.round(fare_after_advance * 100) / 100,
        fare_with_meal: Math.round(fare_with_meal * 100) / 100,
        taxes: Math.round(taxes * 100) / 100,
        total_fare: Math.round(total_fare * 100) / 100,
        seats_available: inventory.available,
        seats_total: inventory.total,
        rule_applied
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
