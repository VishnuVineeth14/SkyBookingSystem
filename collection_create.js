// ===================== 1. AIRPORTS =====================
db.createCollection("airports", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["_id", "name", "city", "country", "timezone"],
            properties: {
                _id: { bsonType: "string" },
                name: { bsonType: "string" },
                city: { bsonType: "string" },
                country: { bsonType: "string" },
                timezone: { bsonType: "string" },
                terminals: {
                    bsonType: "array",
                    items: { bsonType: "string" }
                },
                coordinates: {
                    bsonType: "object",
                    properties: {
                        lat: { bsonType: "double" },
                        lng: { bsonType: "double" }
                    }
                }
            }
        }
    }
})

// Geospatial index
db.airports.createIndex({ coordinates: "2dsphere" })

// ===================== 2. AIRCRAFT =====================
db.createCollection("aircraft", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["_id", "model", "total_seats", "seat_config", "status"],
            properties: {
                _id: { bsonType: "string" },
                registration_number: { bsonType: "string" },
                model: { bsonType: "string" },
                total_seats: { bsonType: "int" },
                seat_config: {
                    bsonType: "object",
                    required: ["economy", "business", "first_class"],
                    properties: {
                        economy: { bsonType: "int" },
                        business: { bsonType: "int" },
                        first_class: { bsonType: "int" }
                    }
                },
                status: { enum: ["active", "maintenance"] }
            }
        }
    }
})

db.aircraft.createIndex({ registration_number: 1 }, { unique: true, sparse: true })

// ===================== 3. FLIGHTS =====================
db.createCollection("flights", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["_id", "flight_number", "departure_time", "arrival_time", "status", "seat_inventory", "base_fare"],
            properties: {
                _id: { bsonType: "string" },
                flight_number: { bsonType: "string" },
                aircraft_ref: { bsonType: "string" },
                origin_ref: { bsonType: "string" },
                destination_ref: { bsonType: "string" },
                departure_time: { bsonType: "date" },
                arrival_time: { bsonType: "date" },
                status: { enum: ["scheduled", "delayed", "cancelled", "completed"] },
                base_fare: {
                    bsonType: "object",
                    required: ["economy", "business", "first_class"],
                    properties: {
                        economy: { bsonType: "double" },
                        business: { bsonType: "double" },
                        first_class: { bsonType: ["double", "null"] }
                    }
                },
                stops: {
                    bsonType: "array",
                    items: { bsonType: "string" }
                },
                seat_inventory: {
                    bsonType: "object",
                    required: ["economy", "business", "first_class"],
                    properties: {
                        economy: {
                            bsonType: "object",
                            required: ["total", "available"],
                            properties: {
                                total: { bsonType: "int" },
                                available: { bsonType: "int" }
                            }
                        },
                        business: {
                            bsonType: "object",
                            required: ["total", "available"],
                            properties: {
                                total: { bsonType: "int" },
                                available: { bsonType: "int" }
                            }
                        },
                        first_class: {
                            bsonType: "object",
                            required: ["total", "available"],
                            properties: {
                                total: { bsonType: "int" },
                                available: { bsonType: "int" }
                            }
                        }
                    }
                }
            }
        }
    }
})

// Search index (IMPORTANT)
db.flights.createIndex({
    origin_ref: 1,
    destination_ref: 1,
    departure_time: 1
})

// ===================== 4. PASSENGERS =====================
db.createCollection("passengers", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["_id", "full_name", "email", "phone", "nationality", "date_of_birth"],
            properties: {
                _id: { bsonType: "objectId" },
                full_name: { bsonType: "string" },
                email: { bsonType: "string" },
                phone: { bsonType: "string" },
                passport_number: { bsonType: "string" },
                nationality: { bsonType: "string" },
                date_of_birth: { bsonType: "date" },
                frequent_flyer: {
                    bsonType: "object",
                    properties: {
                        ff_number: { bsonType: "string" },
                        tier: { enum: ["Silver", "Gold", "Platinum"] },
                        miles: { bsonType: "int" }
                    }
                },
                preferences: {
                    bsonType: "object",
                    properties: {
                        meal: { bsonType: "string" },
                        seat_type: { bsonType: "string" }
                    }
                },
                booking_history: {
                    bsonType: "array",
                    items: { bsonType: "objectId" }
                }
            }
        }
    }
})

db.passengers.createIndex({ email: 1 }, { unique: true })
db.passengers.createIndex({ passport_number: 1 }, { unique: true, sparse: true })

// ===================== 5. BOOKINGS =====================
db.createCollection("bookings", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["_id", "booking_ref", "passenger_ref", "flight_ref", "cabin_class", "seat_number", "fare_paid", "booking_status"],
            properties: {
                _id: { bsonType: "objectId" },
                booking_ref: { bsonType: "string" },
                passenger_ref: { bsonType: "objectId" },
                flight_ref: { bsonType: "string" },
                cabin_class: { enum: ["economy", "business", "first_class"] },
                seat_number: { bsonType: "string" },
                fare_paid: { bsonType: "double" },
                booking_status: { enum: ["confirmed", "cancelled", "pending"] },
                booked_at: { bsonType: "date" },
                pricing_snapshot: {
                    bsonType: "object",
                    properties: {
                        base_fare: { bsonType: "double" },
                        demand_multiplier: { bsonType: "double" },
                        advance_discount_pct: { bsonType: "double" },
                        taxes: { bsonType: "double" }
                    }
                },
                payment: {
                    bsonType: "object",
                    properties: {
                        method: { enum: ["card", "upi", "wallet"] },
                        transaction_id: { bsonType: "string" },
                        paid_at: { bsonType: "date" }
                    }
                },
                cancellation: {
                    bsonType: ["object", "null"],
                    properties: {
                        reason: { bsonType: "string" },
                        refund_amount: { bsonType: "double" },
                        cancelled_at: { bsonType: "date" }
                    }
                }
            }
        }
    }
})

db.bookings.createIndex({ booking_ref: 1 }, { unique: true })
db.bookings.createIndex({ "payment.transaction_id": 1 }, { unique: true, sparse: true })

// ===================== 6. PRICING RULES =====================
db.createCollection("pricing_rules", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["_id", "route", "cabin_class", "season", "base_price", "demand_brackets", "valid_from", "valid_until"],
            properties: {
                _id: { bsonType: "objectId" },
                route: {
                    bsonType: "object",
                    required: ["origin", "destination"],
                    properties: {
                        origin: { bsonType: "string" },
                        destination: { bsonType: "string" }
                    }
                },
                cabin_class: { enum: ["economy", "business", "first_class"] },
                season: { enum: ["peak", "off-peak", "festive"] },
                base_price: { bsonType: "double" },
                demand_brackets: {
                    bsonType: "array",
                    items: {
                        bsonType: "object",
                        required: ["occupancy_pct_min", "occupancy_pct_max", "multiplier"],
                        properties: {
                            occupancy_pct_min: { bsonType: "int" },
                            occupancy_pct_max: { bsonType: "int" },
                            multiplier: { bsonType: "double" }
                        }
                    }
                },
                advance_booking_discount: {
                    bsonType: "array",
                    items: {
                        bsonType: "object",
                        properties: {
                            days_before: { bsonType: "int" },
                            discount_pct: { bsonType: "double" }
                        }
                    }
                },
                valid_from: { bsonType: "date" },
                valid_until: { bsonType: "date" }
            }
        }
    }
})

// ===================== 7. TICKETS =====================
db.createCollection("tickets", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["_id", "pnr", "booking_ref", "passenger_ref", "flight_ref", "seat_number", "cabin_class", "baggage", "status"],
            properties: {
                _id: { bsonType: "objectId" },
                pnr: { bsonType: "string" },
                booking_ref: { bsonType: "objectId" },
                passenger_ref: { bsonType: "objectId" },
                flight_ref: { bsonType: "string" },
                seat_number: { bsonType: "string" },
                cabin_class: { bsonType: "string" },
                baggage: {
                    bsonType: "object",
                    required: ["check_in_kg", "cabin_kg"],
                    properties: {
                        check_in_kg: { bsonType: "int" },
                        cabin_kg: { bsonType: "int" }
                    }
                },
                meal_preference: { bsonType: "string" },
                issued_at: { bsonType: "date" },
                qr_code_url: { bsonType: "string" },
                status: { enum: ["valid", "used", "cancelled"] }
            }
        }
    }
})

db.tickets.createIndex({ pnr: 1 }, { unique: true })
