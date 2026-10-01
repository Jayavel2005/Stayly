import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter, TransformInterceptor } from '../src/common';
import { BookingStatus } from '../src/modules/bookings/types/booking-status.enum';

describe('Reviews & Ratings System (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let prisma: PrismaService;

  let customerAToken: string;
  let customerBToken: string;
  let managerToken: string;
  let adminToken: string;

  let customerAUserId: string;
  const customerBUserId = '22222222-2222-4222-8222-222222222277';
  const HOTEL_MUMBAI_ID = '44444444-4444-4444-8444-444444444444';
  const UNASSIGNED_HOTEL_ID = '77777777-7777-4777-8777-777777777777';

  const createdBookingIds: string[] = [];
  const createdReviewIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
    server = app.getHttpServer() as App;
    prisma = app.get<PrismaService>(PrismaService);

    const passwordHash = await bcrypt.hash('Password123!', 10);

    // 1. Log in existing Customer A
    const resCustA = await request(server)
      .post('/api/v1/auth/customer/login')
      .send({ email: 'customer@stayora.com', password: 'Password123!' });
    customerAToken = resCustA.body.data.accessToken;

    const userA = await prisma.user.findFirst({
      where: { email: 'customer@stayora.com' },
    });
    customerAUserId = userA!.id;

    // 2. Ensure Customer B exists and log in
    await prisma.user.upsert({
      where: { id: customerBUserId },
      update: { email: 'customer.reviews.b@stayora.com', passwordHash },
      create: {
        id: customerBUserId,
        email: 'customer.reviews.b@stayora.com',
        passwordHash,
        firstName: 'Devika',
        lastName: 'Patel',
        role: 'CUSTOMER',
        status: 'ACTIVE',
      },
    });

    const resCustB = await request(server)
      .post('/api/v1/auth/customer/login')
      .send({ email: 'customer.reviews.b@stayora.com', password: 'Password123!' });
    customerBToken = resCustB.body.data.accessToken;

    // 3. Log in Manager
    const resManager = await request(server)
      .post('/api/v1/auth/manager/login')
      .send({ email: 'manager@stayora.com', password: 'Password123!' });
    managerToken = resManager.body.data.accessToken;

    // 4. Log in Admin
    const resAdmin = await request(server)
      .post('/api/v1/auth/admin/login')
      .send({ email: 'admin@stayora.com', password: 'Password123!' });
    adminToken = resAdmin.body.data.accessToken;

    // 5. Ensure an unassigned test hotel exists
    await prisma.hotel.upsert({
      where: { id: UNASSIGNED_HOTEL_ID },
      update: {},
      create: {
        id: UNASSIGNED_HOTEL_ID,
        name: 'Unassigned Test Hotel',
        slug: 'unassigned-test-hotel',
        description: 'Test hotel with no assigned managers',
        starRating: 4,
        addressLine1: 'Test Avenue',
        city: 'Jaipur',
        state: 'Rajasthan',
        country: 'India',
        postalCode: '302001',
        phone: '+911412345678',
        email: 'jaipur.test@stayora.com',
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    // Clean up created reviews
    if (createdReviewIds.length > 0) {
      await prisma.review.deleteMany({
        where: { id: { in: createdReviewIds } },
      });
    }

    await prisma.hotel.deleteMany({
      where: { id: UNASSIGNED_HOTEL_ID },
    });

    // Clean up created test bookings
    if (createdBookingIds.length > 0) {
      await prisma.review.deleteMany({
        where: { bookingId: { in: createdBookingIds } },
      });
      await prisma.bookingRoom.deleteMany({
        where: { bookingId: { in: createdBookingIds } },
      });
      await prisma.bookingPriceSnapshot.deleteMany({
        where: { bookingId: { in: createdBookingIds } },
      });
      await prisma.bookingGuest.deleteMany({
        where: { bookingId: { in: createdBookingIds } },
      });
      await prisma.booking.deleteMany({
        where: { id: { in: createdBookingIds } },
      });
    }

    await app.close();
  });

  // Helper to create a test booking in a given status
  async function createTestBooking(
    customerId: string,
    status: string = BookingStatus.CHECKED_OUT,
    hotelId: string = HOTEL_MUMBAI_ID,
  ): Promise<string> {
    const checkIn = new Date('2026-09-01T14:00:00.000Z');
    const checkOut = new Date('2026-09-03T11:00:00.000Z');
    const ref = `BK-REV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

    const booking = await prisma.booking.create({
      data: {
        bookingReference: ref,
        customerId,
        hotelId,
        status,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        totalNights: 2,
        totalGuests: 2,
        totalAmountCents: BigInt(1200000),
        currency: 'INR',
        priceSnapshot: {
          create: {
            baseRateCents: BigInt(500000),
            totalNights: 2,
            grossRoomCents: BigInt(1000000),
            taxCents: BigInt(200000),
            netAmountCents: BigInt(1200000),
            currency: 'INR',
          },
        },
      },
    });

    createdBookingIds.push(booking.id);
    return booking.id;
  }

  // ===========================================================================
  // 1. Review Eligibility & Creation
  // ===========================================================================
  describe('Review Eligibility & Creation', () => {
    it('allows customer to review their own completed (CHECKED_OUT) stay', async () => {
      const bookingId = await createTestBooking(customerAUserId, BookingStatus.CHECKED_OUT);

      const res = await request(server)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          bookingId,
          rating: 5,
          title: 'Exemplary Experience',
          comment: 'The room was immaculate and staff hospitality was first class.',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.rating).toBe(5);
      expect(res.body.data.title).toBe('Exemplary Experience');
      expect(res.body.data.comment).toBe('The room was immaculate and staff hospitality was first class.');
      expect(res.body.data.hotelId).toBe(HOTEL_MUMBAI_ID);
      expect(res.body.data.reviewer).toBeDefined();
      expect(res.body.data.reviewer.displayName).toBeDefined();

      createdReviewIds.push(res.body.data.id);
    });

    it('rejects review creation when booking status is PENDING', async () => {
      const bookingId = await createTestBooking(customerAUserId, BookingStatus.PENDING);

      const res = await request(server)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          bookingId,
          rating: 5,
          comment: 'Pending booking review attempt.',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BOOKING_NOT_COMPLETED');
    });

    it('rejects review creation when booking status is CONFIRMED', async () => {
      const bookingId = await createTestBooking(customerAUserId, BookingStatus.CONFIRMED);

      const res = await request(server)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          bookingId,
          rating: 4,
          comment: 'Confirmed booking review attempt.',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BOOKING_NOT_COMPLETED');
    });

    it('rejects review creation when booking status is CANCELLED', async () => {
      const bookingId = await createTestBooking(customerAUserId, BookingStatus.CANCELLED);

      const res = await request(server)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          bookingId,
          rating: 1,
          comment: 'Cancelled booking review attempt.',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BOOKING_NOT_COMPLETED');
    });

    it('rejects review creation if customer does not own the booking (IDOR Defense)', async () => {
      // Booking belongs to Customer A
      const bookingId = await createTestBooking(customerAUserId, BookingStatus.CHECKED_OUT);

      // Customer B attempts to review it
      const res = await request(server)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({
          bookingId,
          rating: 4,
          comment: 'IDOR attempt to review someone else reservation.',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('BOOKING_NOT_OWNED');
    });

    it('rejects unauthenticated review submission with 401', async () => {
      const bookingId = await createTestBooking(customerAUserId, BookingStatus.CHECKED_OUT);

      const res = await request(server)
        .post('/api/v1/reviews')
        .send({
          bookingId,
          rating: 5,
          comment: 'Unauthenticated review attempt.',
        });

      expect(res.status).toBe(401);
    });
  });

  // ===========================================================================
  // 2. Input Validation (Rating & Comment)
  // ===========================================================================
  describe('Input Validation', () => {
    it('rejects ratings below 1 or above 5', async () => {
      const bookingId = await createTestBooking(customerAUserId, BookingStatus.CHECKED_OUT);

      const resBelow = await request(server)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          bookingId,
          rating: 0,
          comment: 'Rating 0 should be rejected.',
        });

      expect(resBelow.status).toBe(400);

      const resAbove = await request(server)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          bookingId,
          rating: 6,
          comment: 'Rating 6 should be rejected.',
        });

      expect(resAbove.status).toBe(400);
    });

    it('rejects non-integer floating ratings', async () => {
      const bookingId = await createTestBooking(customerAUserId, BookingStatus.CHECKED_OUT);

      const res = await request(server)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          bookingId,
          rating: 4.5,
          comment: 'Rating 4.5 floating point should be rejected.',
        });

      expect(res.status).toBe(400);
    });

    it('rejects comments that are too short or excessively long', async () => {
      const bookingId = await createTestBooking(customerAUserId, BookingStatus.CHECKED_OUT);

      const resShort = await request(server)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          bookingId,
          rating: 5,
          comment: 'Hi', // Under 5 characters
        });

      expect(resShort.status).toBe(400);

      const resLong = await request(server)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          bookingId,
          rating: 5,
          comment: 'A'.repeat(2001), // Over 2000 characters
        });

      expect(resLong.status).toBe(400);
    });
  });

  // ===========================================================================
  // 3. One Review Per Booking & Concurrency Protection
  // ===========================================================================
  describe('One Review Per Booking & Concurrency Invariant', () => {
    it('prevents sequential duplicate review creation on the same booking', async () => {
      const bookingId = await createTestBooking(customerAUserId, BookingStatus.CHECKED_OUT);

      // First submission
      const res1 = await request(server)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          bookingId,
          rating: 5,
          comment: 'First legitimate review.',
        });

      expect(res1.status).toBe(201);
      createdReviewIds.push(res1.body.data.id);

      // Second submission for the same booking
      const res2 = await request(server)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          bookingId,
          rating: 4,
          comment: 'Second duplicate review attempt.',
        });

      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('REVIEW_ALREADY_EXISTS');
    });

    it('handles simultaneous concurrent review creation: exactly one succeeds, one fails with 409', async () => {
      const bookingId = await createTestBooking(customerAUserId, BookingStatus.CHECKED_OUT);

      const [reqA, reqB] = await Promise.all([
        request(server)
          .post('/api/v1/reviews')
          .set('Authorization', `Bearer ${customerAToken}`)
          .send({
            bookingId,
            rating: 5,
            comment: 'Concurrent Request A',
          }),
        request(server)
          .post('/api/v1/reviews')
          .set('Authorization', `Bearer ${customerAToken}`)
          .send({
            bookingId,
            rating: 4,
            comment: 'Concurrent Request B',
          }),
      ]);

      const statuses = [reqA.status, reqB.status].sort();
      expect(statuses).toEqual([201, 409]);

      const successfulRes = reqA.status === 201 ? reqA : reqB;
      createdReviewIds.push(successfulRes.body.data.id);

      // Verify that in PostgreSQL there is exactly ONE review for this booking
      const dbReviews = await prisma.review.findMany({
        where: { bookingId },
      });
      expect(dbReviews).toHaveLength(1);
    });
  });

  // ===========================================================================
  // 4. Update Review
  // ===========================================================================
  describe('Review Updates & Immutability', () => {
    it('allows author to update rating and comment', async () => {
      const bookingId = await createTestBooking(customerAUserId, BookingStatus.CHECKED_OUT);

      const createRes = await request(server)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          bookingId,
          rating: 3,
          comment: 'Average stay initially.',
        });

      expect(createRes.status).toBe(201);
      const reviewId = createRes.body.data.id;
      createdReviewIds.push(reviewId);

      // Update review
      const updateRes = await request(server)
        .patch(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          rating: 4,
          comment: 'Upgraded review after hotel resolved concerns.',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.rating).toBe(4);
      expect(updateRes.body.data.comment).toBe('Upgraded review after hotel resolved concerns.');
      // Immutable relationships
      expect(updateRes.body.data.bookingId).toBe(bookingId);
      expect(updateRes.body.data.hotelId).toBe(HOTEL_MUMBAI_ID);
    });

    it('forbids another customer from updating author review', async () => {
      const bookingId = await createTestBooking(customerAUserId, BookingStatus.CHECKED_OUT);

      const createRes = await request(server)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          bookingId,
          rating: 5,
          comment: 'Original author review.',
        });

      const reviewId = createRes.body.data.id;
      createdReviewIds.push(reviewId);

      // Customer B attempts to update Customer A review
      const updateRes = await request(server)
        .patch(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({
          rating: 1,
          comment: 'Tampered review content.',
        });

      expect(updateRes.status).toBe(403);
      expect(updateRes.body.error.code).toBe('FORBIDDEN_RESOURCE');
    });
  });

  // ===========================================================================
  // 5. Delete Review
  // ===========================================================================
  describe('Review Deletion', () => {
    it('forbids another customer from deleting author review', async () => {
      const bookingId = await createTestBooking(customerAUserId, BookingStatus.CHECKED_OUT);

      const createRes = await request(server)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          bookingId,
          rating: 5,
          comment: 'Review to test unauthorized deletion.',
        });

      const reviewId = createRes.body.data.id;
      createdReviewIds.push(reviewId);

      const deleteRes = await request(server)
        .delete(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${customerBToken}`);

      expect(deleteRes.status).toBe(403);
    });

    it('allows author to delete review', async () => {
      const bookingId = await createTestBooking(customerAUserId, BookingStatus.CHECKED_OUT);

      const createRes = await request(server)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          bookingId,
          rating: 5,
          comment: 'Review to be deleted by author.',
        });

      const reviewId = createRes.body.data.id;

      const deleteRes = await request(server)
        .delete(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // Verify deletion in database
      const dbReview = await prisma.review.findUnique({
        where: { id: reviewId },
      });
      expect(dbReview).toBeNull();
    });
  });

  // ===========================================================================
  // 6. Public Discovery & Aggregation
  // ===========================================================================
  describe('Public Hotel Reviews & Rating Aggregation', () => {
    it('returns paginated reviews with database-level aggregation', async () => {
      // Fetch public reviews for Mumbai hotel
      const res = await request(server).get(
        `/api/v1/hotels/${HOTEL_MUMBAI_ID}/reviews?page=1&limit=10&sortBy=newest`,
      );

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.meta).toBeDefined();
      expect(res.body.data.meta.page).toBe(1);
      expect(res.body.data.summary).toBeDefined();
      expect(typeof res.body.data.summary.averageRating).toBe('number');
      expect(typeof res.body.data.summary.reviewCount).toBe('number');
      expect(res.body.data.summary.ratingDistribution).toBeDefined();
    });

    it('preserves reviewer privacy: no password, email, or phone exposed in public reviews', async () => {
      const bookingId = await createTestBooking(customerAUserId, BookingStatus.CHECKED_OUT);

      const createRes = await request(server)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          bookingId,
          rating: 5,
          comment: 'Privacy verification review test.',
        });

      const reviewId = createRes.body.data.id;
      createdReviewIds.push(reviewId);

      const res = await request(server).get(
        `/api/v1/hotels/${HOTEL_MUMBAI_ID}/reviews`,
      );

      expect(res.status).toBe(200);
      const target = res.body.data.items.find((item: any) => item.id === reviewId);
      expect(target).toBeDefined();
      expect(target.reviewer).toBeDefined();
      expect(target.reviewer.displayName).toBeDefined();
      // Ensure private credentials are never leaked
      expect(target.reviewer.email).toBeUndefined();
      expect(target.reviewer.password).toBeUndefined();
      expect(target.reviewer.passwordHash).toBeUndefined();
      expect(target.reviewer.phone).toBeUndefined();
    });
  });

  // ===========================================================================
  // 7. Customer Review History & Eligibility Endpoint
  // ===========================================================================
  describe('Customer History & Eligibility Check', () => {
    it('returns reviews written by authenticated customer at /api/v1/reviews/me', async () => {
      const res = await request(server)
        .get('/api/v1/reviews/me')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.meta).toBeDefined();
    });

    it('reports eligibility correctly at /api/v1/bookings/:bookingId/review-eligibility', async () => {
      // Eligible booking
      const eligibleBookingId = await createTestBooking(
        customerAUserId,
        BookingStatus.CHECKED_OUT,
      );

      const resEligible = await request(server)
        .get(`/api/v1/bookings/${eligibleBookingId}/review-eligibility`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(resEligible.status).toBe(200);
      expect(resEligible.body.data.eligible).toBe(true);
      expect(resEligible.body.data.reason).toBeNull();

      // Submit review
      const revRes = await request(server)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          bookingId: eligibleBookingId,
          rating: 5,
          comment: 'Post-stay review for eligibility re-test.',
        });
      createdReviewIds.push(revRes.body.data.id);

      // Now eligibility should be false with REVIEW_ALREADY_EXISTS
      const resAfter = await request(server)
        .get(`/api/v1/bookings/${eligibleBookingId}/review-eligibility`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(resAfter.status).toBe(200);
      expect(resAfter.body.data.eligible).toBe(false);
      expect(resAfter.body.data.reason).toBe('REVIEW_ALREADY_EXISTS');
    });
  });

  // ===========================================================================
  // 8. Manager Access & Admin Moderation
  // ===========================================================================
  describe('Manager Access & Admin Moderation', () => {
    it('allows assigned manager to view reviews for their hotel property', async () => {
      const res = await request(server)
        .get(`/api/v1/manager/hotels/${HOTEL_MUMBAI_ID}/reviews`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
    });

    it('forbids manager from viewing unassigned hotel reviews via manager endpoint', async () => {
      const res = await request(server)
        .get(`/api/v1/manager/hotels/${UNASSIGNED_HOTEL_ID}/reviews`)
        .set('Authorization', `Bearer ${managerToken}`);

      // Manager is not assigned to this hotel property
      expect([403, 404]).toContain(res.status);
    });

    it('allows admin to moderate (conceal) a review', async () => {
      const bookingId = await createTestBooking(customerAUserId, BookingStatus.CHECKED_OUT);

      const createRes = await request(server)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          bookingId,
          rating: 1,
          comment: 'Content to be moderated by admin.',
        });

      const reviewId = createRes.body.data.id;
      createdReviewIds.push(reviewId);

      // Admin conceals the review
      const modRes = await request(server)
        .patch(`/api/v1/admin/reviews/${reviewId}/moderation`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isPublished: false });

      expect(modRes.status).toBe(200);
      expect(modRes.body.data.isPublished).toBe(false);

      // Check public reviews: concealed review should not appear
      const pubRes = await request(server).get(
        `/api/v1/hotels/${HOTEL_MUMBAI_ID}/reviews`,
      );
      const found = pubRes.body.data.items.find((i: any) => i.id === reviewId);
      expect(found).toBeUndefined();
    });

    it('forbids customer from moderating review publication state', async () => {
      const bookingId = await createTestBooking(customerAUserId, BookingStatus.CHECKED_OUT);

      const createRes = await request(server)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          bookingId,
          rating: 5,
          comment: 'Customer moderation attempt test.',
        });

      const reviewId = createRes.body.data.id;
      createdReviewIds.push(reviewId);

      const modRes = await request(server)
        .patch(`/api/v1/admin/reviews/${reviewId}/moderation`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ isPublished: false });

      expect(modRes.status).toBe(403);
    });
  });
});
