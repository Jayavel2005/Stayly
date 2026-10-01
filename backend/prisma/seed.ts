import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Stayora database seeding...');

  // 1. Password Hashing (Deterministic bcrypt for development)
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 2. Deterministic UUIDs for development seed idempotency
  const CUSTOMER_ID = '11111111-1111-4111-8111-111111111111';
  const MANAGER_ID = '22222222-2222-4222-8222-222222222222';
  const ADMIN_ID = '33333333-3333-4333-8333-333333333333';

  const HOTEL_MUMBAI_ID = '44444444-4444-4444-8444-444444444444';
  const HOTEL_GOA_ID = '55555555-5555-4555-8555-555555555555';

  // 3. Seed Users (Customer, Hotel Manager, Admin)
  console.log('👤 Seeding core development users...');
  const customer = await prisma.user.upsert({
    where: { id: CUSTOMER_ID },
    update: {
      email: 'customer@stayora.com',
      firstName: 'Aarav',
      lastName: 'Sharma',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    },
    create: {
      id: CUSTOMER_ID,
      email: 'customer@stayora.com',
      passwordHash,
      firstName: 'Aarav',
      lastName: 'Sharma',
      phone: '+919876543210',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    },
  });

  const manager = await prisma.user.upsert({
    where: { id: MANAGER_ID },
    update: {
      email: 'manager@stayora.com',
      firstName: 'Vikram',
      lastName: 'Malhotra',
      role: 'HOTEL_MANAGER',
      status: 'ACTIVE',
    },
    create: {
      id: MANAGER_ID,
      email: 'manager@stayora.com',
      passwordHash,
      firstName: 'Vikram',
      lastName: 'Malhotra',
      phone: '+919876543211',
      role: 'HOTEL_MANAGER',
      status: 'ACTIVE',
    },
  });

  const admin = await prisma.user.upsert({
    where: { id: ADMIN_ID },
    update: {
      email: 'admin@stayora.com',
      firstName: 'Priya',
      lastName: 'Nair',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    create: {
      id: ADMIN_ID,
      email: 'admin@stayora.com',
      passwordHash,
      firstName: 'Priya',
      lastName: 'Nair',
      phone: '+919876543212',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  console.log(`✓ Seeded users: ${customer.email}, ${manager.email}, ${admin.email}`);

  // 4. Seed Amenities Taxonomy
  console.log('✨ Seeding amenities catalog...');
  const amenityDefs = [
    { name: 'High-Speed Wi-Fi', iconKey: 'wifi', category: 'CONNECTIVITY' },
    { name: 'Infinity Swimming Pool', iconKey: 'pool', category: 'WELLNESS' },
    { name: 'Ayurvedic Spa & Wellness', iconKey: 'spa', category: 'WELLNESS' },
    { name: 'King Size Bed', iconKey: 'bed', category: 'ROOM' },
    { name: 'Private Balcony & Ocean View', iconKey: 'eye', category: 'ROOM' },
    { name: 'Artisan Breakfast Included', iconKey: 'coffee', category: 'DINING' },
    { name: '24/7 Concierge & In-Room Dining', iconKey: 'bell', category: 'SERVICE' },
    { name: 'Climate Control AC', iconKey: 'air-vent', category: 'ROOM' },
    { name: 'Airport Executive Transfer', iconKey: 'car', category: 'TRANSPORT' },
    { name: 'State-of-the-Art Fitness Center', iconKey: 'dumbbell', category: 'WELLNESS' },
  ];

  const amenities: Record<string, string> = {};
  for (const item of amenityDefs) {
    const record = await prisma.amenity.upsert({
      where: { name: item.name },
      update: { iconKey: item.iconKey, category: item.category },
      create: item,
    });
    amenities[item.name] = record.id;
  }
  console.log(`✓ Seeded ${Object.keys(amenities).length} amenities`);

  // 5. Seed Hotels
  console.log('🏨 Seeding hotels...');
  const hotelMumbai = await prisma.hotel.upsert({
    where: { id: HOTEL_MUMBAI_ID },
    update: {
      name: 'Stayora Grand Palace',
      slug: 'stayora-grand-palace',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      starRating: 5,
    },
    create: {
      id: HOTEL_MUMBAI_ID,
      name: 'Stayora Grand Palace',
      slug: 'stayora-grand-palace',
      description:
        'A magnificent luxury heritage hotel overlooking the Arabian Sea, featuring bespoke dining and world-class royal suites.',
      starRating: 5,
      addressLine1: 'Apollo Bunder, Colaba',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      postalCode: '400001',
      latitude: 18.9220,
      longitude: 72.8347,
      phone: '+912266653366',
      email: 'grandpalace@stayora.com',
      isActive: true,
    },
  });

  const hotelGoa = await prisma.hotel.upsert({
    where: { id: HOTEL_GOA_ID },
    update: {
      name: 'Stayora Bayfront Resort',
      slug: 'stayora-bayfront-resort',
      city: 'Candolim',
      state: 'Goa',
      country: 'India',
      starRating: 4,
    },
    create: {
      id: HOTEL_GOA_ID,
      name: 'Stayora Bayfront Resort',
      slug: 'stayora-bayfront-resort',
      description:
        'A tropical sanctuary surrounded by pristine golden sands, swaying palms, and contemporary beachside luxury.',
      starRating: 4,
      addressLine1: 'Aguada Siolim Road, Candolim Beach',
      city: 'Candolim',
      state: 'Goa',
      country: 'India',
      postalCode: '403515',
      latitude: 15.5186,
      longitude: 73.7661,
      phone: '+918322479900',
      email: 'bayfront.goa@stayora.com',
      isActive: true,
    },
  });

  console.log(`✓ Seeded hotels: ${hotelMumbai.name}, ${hotelGoa.name}`);

  // 6. Seed Manager Assignments (hotel_managers join table)
  console.log('👔 Seeding hotel manager assignments...');
  await prisma.hotelManager.upsert({
    where: {
      userId_hotelId: {
        userId: manager.id,
        hotelId: hotelMumbai.id,
      },
    },
    update: { isPrimary: true },
    create: {
      userId: manager.id,
      hotelId: hotelMumbai.id,
      isPrimary: true,
    },
  });

  await prisma.hotelManager.upsert({
    where: {
      userId_hotelId: {
        userId: manager.id,
        hotelId: hotelGoa.id,
      },
    },
    update: { isPrimary: false },
    create: {
      userId: manager.id,
      hotelId: hotelGoa.id,
      isPrimary: false,
    },
  });
  console.log(`✓ Manager ${manager.email} assigned to both properties`);

  // 7. Seed Room Types for Hotel Mumbai
  console.log('🛏️ Seeding room types and physical rooms for Mumbai...');
  const mumbaiStandard = await prisma.roomType.upsert({
    where: {
      hotelId_slug: {
        hotelId: hotelMumbai.id,
        slug: 'classic-heritage-room',
      },
    },
    update: {
      name: 'Classic Heritage Room',
      basePriceCents: BigInt(450000), // INR 4,500.00
      maxOccupancy: 2,
    },
    create: {
      hotelId: hotelMumbai.id,
      name: 'Classic Heritage Room',
      slug: 'classic-heritage-room',
      description: 'Elegant Victorian-inspired interiors with plush king bed, marble bath, and garden views.',
      maxOccupancy: 2,
      maxAdults: 2,
      maxChildren: 1,
      basePriceCents: BigInt(450000),
      currency: 'INR',
      bedType: 'KING',
      sizeSqMeters: 38.5,
      isActive: true,
    },
  });

  const mumbaiDeluxe = await prisma.roomType.upsert({
    where: {
      hotelId_slug: {
        hotelId: hotelMumbai.id,
        slug: 'palace-sea-view-suite',
      },
    },
    update: {
      name: 'Palace Sea View Suite',
      basePriceCents: BigInt(850000), // INR 8,500.00
      maxOccupancy: 3,
    },
    create: {
      hotelId: hotelMumbai.id,
      name: 'Palace Sea View Suite',
      slug: 'palace-sea-view-suite',
      description: 'Expansive ocean-facing suite with separate living parlor, walk-in closet, and butler service.',
      maxOccupancy: 3,
      maxAdults: 3,
      maxChildren: 2,
      basePriceCents: BigInt(850000),
      currency: 'INR',
      bedType: 'KING',
      sizeSqMeters: 65.0,
      isActive: true,
    },
  });

  const mumbaiVilla = await prisma.roomType.upsert({
    where: {
      hotelId_slug: {
        hotelId: hotelMumbai.id,
        slug: 'presidential-royal-suite',
      },
    },
    update: {
      name: 'Presidential Royal Suite',
      basePriceCents: BigInt(2500000), // INR 25,000.00
      maxOccupancy: 4,
    },
    create: {
      hotelId: hotelMumbai.id,
      name: 'Presidential Royal Suite',
      slug: 'presidential-royal-suite',
      description: 'The pinnacle of luxury: private terrace, dining room for 8, dedicated chef, and chauffeur service.',
      maxOccupancy: 4,
      maxAdults: 4,
      maxChildren: 2,
      basePriceCents: BigInt(2500000),
      currency: 'INR',
      bedType: 'KING',
      sizeSqMeters: 140.0,
      isActive: true,
    },
  });

  // Link Amenities to Mumbai Room Types
  const allAmenityIds = Object.values(amenities);
  for (const amenityId of allAmenityIds.slice(0, 5)) {
    await prisma.roomTypeAmenity.upsert({
      where: {
        roomTypeId_amenityId: {
          roomTypeId: mumbaiStandard.id,
          amenityId,
        },
      },
      update: {},
      create: {
        roomTypeId: mumbaiStandard.id,
        amenityId,
      },
    });
  }
  for (const amenityId of allAmenityIds) {
    await prisma.roomTypeAmenity.upsert({
      where: {
        roomTypeId_amenityId: {
          roomTypeId: mumbaiDeluxe.id,
          amenityId,
        },
      },
      update: {},
      create: {
        roomTypeId: mumbaiDeluxe.id,
        amenityId,
      },
    });
  }

  // Seed Physical Rooms for Mumbai
  const mumbaiRooms = [
    { roomTypeId: mumbaiStandard.id, roomNumber: '101', floor: 1 },
    { roomTypeId: mumbaiStandard.id, roomNumber: '102', floor: 1 },
    { roomTypeId: mumbaiStandard.id, roomNumber: '103', floor: 1 },
    { roomTypeId: mumbaiDeluxe.id, roomNumber: '201', floor: 2 },
    { roomTypeId: mumbaiDeluxe.id, roomNumber: '202', floor: 2 },
    { roomTypeId: mumbaiDeluxe.id, roomNumber: '203', floor: 2 },
    { roomTypeId: mumbaiVilla.id, roomNumber: '301', floor: 3 },
  ];

  const seededMumbaiRooms: Record<string, string> = {};
  for (const room of mumbaiRooms) {
    const r = await prisma.room.upsert({
      where: {
        hotelId_roomNumber: {
          hotelId: hotelMumbai.id,
          roomNumber: room.roomNumber,
        },
      },
      update: {
        roomTypeId: room.roomTypeId,
        floor: room.floor,
        operationalStatus: 'AVAILABLE',
      },
      create: {
        hotelId: hotelMumbai.id,
        roomTypeId: room.roomTypeId,
        roomNumber: room.roomNumber,
        floor: room.floor,
        operationalStatus: 'AVAILABLE',
      },
    });
    seededMumbaiRooms[room.roomNumber] = r.id;
  }
  console.log(`✓ Seeded ${mumbaiRooms.length} physical rooms for ${hotelMumbai.name}`);

  // 8. Seed Room Types and Physical Rooms for Hotel Goa
  console.log('🌴 Seeding room types and physical rooms for Goa...');
  const goaSuperior = await prisma.roomType.upsert({
    where: {
      hotelId_slug: {
        hotelId: hotelGoa.id,
        slug: 'sunset-coastal-room',
      },
    },
    update: {
      name: 'Sunset Coastal Room',
      basePriceCents: BigInt(550000), // INR 5,500.00
      maxOccupancy: 2,
    },
    create: {
      hotelId: hotelGoa.id,
      name: 'Sunset Coastal Room',
      slug: 'sunset-coastal-room',
      description: 'Breezy coastal haven steps from the beach with panoramic sunset views and rain shower.',
      maxOccupancy: 2,
      maxAdults: 2,
      maxChildren: 1,
      basePriceCents: BigInt(550000),
      currency: 'INR',
      bedType: 'QUEEN',
      sizeSqMeters: 42.0,
      isActive: true,
    },
  });

  const goaPoolSuite = await prisma.roomType.upsert({
    where: {
      hotelId_slug: {
        hotelId: hotelGoa.id,
        slug: 'private-pool-villa',
      },
    },
    update: {
      name: 'Private Plunge Pool Villa',
      basePriceCents: BigInt(1400000), // INR 14,000.00
      maxOccupancy: 4,
    },
    create: {
      hotelId: hotelGoa.id,
      name: 'Private Plunge Pool Villa',
      slug: 'private-pool-villa',
      description: 'Exclusive detached villa with private temperature-controlled plunge pool and sundeck.',
      maxOccupancy: 4,
      maxAdults: 4,
      maxChildren: 2,
      basePriceCents: BigInt(1400000),
      currency: 'INR',
      bedType: 'KING',
      sizeSqMeters: 95.0,
      isActive: true,
    },
  });

  const goaRooms = [
    { roomTypeId: goaSuperior.id, roomNumber: '101', floor: 1 },
    { roomTypeId: goaSuperior.id, roomNumber: '102', floor: 1 },
    { roomTypeId: goaSuperior.id, roomNumber: '103', floor: 1 },
    { roomTypeId: goaPoolSuite.id, roomNumber: '201', floor: 2 },
    { roomTypeId: goaPoolSuite.id, roomNumber: '202', floor: 2 },
  ];

  for (const room of goaRooms) {
    await prisma.room.upsert({
      where: {
        hotelId_roomNumber: {
          hotelId: hotelGoa.id,
          roomNumber: room.roomNumber,
        },
      },
      update: {
        roomTypeId: room.roomTypeId,
        floor: room.floor,
        operationalStatus: 'AVAILABLE',
      },
      create: {
        hotelId: hotelGoa.id,
        roomTypeId: room.roomTypeId,
        roomNumber: room.roomNumber,
        floor: room.floor,
        operationalStatus: 'AVAILABLE',
      },
    });
  }
  console.log(`✓ Seeded ${goaRooms.length} physical rooms for ${hotelGoa.name}`);

  // 9. Seed Sample Completed Booking, Historical Price Snapshot, Payment, and Review
  console.log('📋 Seeding sample historical booking & review...');
  const sampleRef = 'STY-202610-0001';
  const checkIn = new Date('2026-10-10');
  const checkOut = new Date('2026-10-12');
  const nights = 2;
  const baseRate = BigInt(450000); // 4500.00
  const gross = BigInt(900000); // 9000.00
  const tax = BigInt(162000); // 18% GST = 1620.00
  const net = gross + tax; // 1062000 = 10,620.00

  const sampleBooking = await prisma.booking.upsert({
    where: { bookingReference: sampleRef },
    update: {
      status: 'CONFIRMED',
    },
    create: {
      bookingReference: sampleRef,
      customerId: customer.id,
      hotelId: hotelMumbai.id,
      status: 'CONFIRMED',
      checkInDate: checkIn,
      checkOutDate: checkOut,
      totalNights: nights,
      totalGuests: 2,
      totalAmountCents: net,
      currency: 'INR',
      bookingRooms: {
        create: {
          roomId: seededMumbaiRooms['101'],
          roomTypeId: mumbaiStandard.id,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          status: 'RESERVED',
        },
      },
      guests: {
        create: [
          { firstName: 'Aarav', lastName: 'Sharma', isPrimary: true, isChild: false },
          { firstName: 'Meera', lastName: 'Sharma', isPrimary: false, isChild: false },
        ],
      },
      priceSnapshot: {
        create: {
          baseRateCents: baseRate,
          totalNights: nights,
          grossRoomCents: gross,
          taxCents: tax,
          serviceFeeCents: BigInt(0),
          discountCents: BigInt(0),
          netAmountCents: net,
          currency: 'INR',
        },
      },
      payment: {
        create: {
          transactionReference: 'TXN-MOCK-202610-001',
          idempotencyKey: 'IDEMP-20261010-0001',
          amountCents: net,
          currency: 'INR',
          status: 'SUCCEEDED',
          gatewayProvider: 'MOCK',
          paymentMethod: 'UPI',
          settledAt: new Date('2026-10-01T10:00:00Z'),
        },
      },
    },
  });

  const existingPayment = await prisma.payment.findUnique({
    where: { bookingId: sampleBooking.id },
  });
  if (existingPayment) {
    await prisma.paymentAttempt.upsert({
      where: { idempotencyKey: 'IDEMP-20261010-0001' },
      update: {},
      create: {
        paymentId: existingPayment.id,
        bookingId: sampleBooking.id,
        attemptNumber: 1,
        idempotencyKey: 'IDEMP-20261010-0001',
        amountCents: net,
        currency: 'INR',
        status: 'SUCCEEDED',
        gatewayProvider: 'MOCK',
        gatewayReference: 'TXN-MOCK-202610-001',
        paymentMethod: 'UPI',
      },
    });
  }

  // Seed Review for Completed Booking
  await prisma.review.upsert({
    where: { bookingId: sampleBooking.id },
    update: {},
    create: {
      bookingId: sampleBooking.id,
      customerId: customer.id,
      hotelId: hotelMumbai.id,
      rating: 5,
      title: 'Exceptional royal hospitality!',
      comment:
        'The Classic Heritage Room was breathtaking. Impeccable staff service, divine breakfast, and serene Arabian sea views.',
      isPublished: true,
    },
  });

  // Seed Initial Audit Log Record
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: 'SYSTEM_SEED',
      entityType: 'DATABASE',
      entityId: hotelMumbai.id,
      newValues: {
        hotelsCount: 2,
        usersCount: 3,
        environment: 'development',
      },
    },
  });

  console.log('✅ Stayora database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error executing database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
