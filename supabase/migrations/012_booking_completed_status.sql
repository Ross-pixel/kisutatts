-- KISU.TATTS BOOKING SYSTEM
-- Terminal status for appointments that have already taken place.

alter type public.booking_request_status
  add value if not exists 'completed';
