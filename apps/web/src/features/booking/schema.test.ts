import { describe, it, expect } from "vitest";
import { bookingSchema } from "./schema";

const valid = {
  departureId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  numAdults: 2,
  numChildren: 1,
  contactName: "Nguyen Van A",
  contactEmail: "a@example.com",
  contactPhone: "+84901234567",
  specialRequests: "Vegetarian",
};

describe("bookingSchema", () => {
  it("accepts a fully valid booking", () => {
    expect(bookingSchema.safeParse(valid).success).toBe(true);
  });
  it("accepts empty optional phone/requests", () => {
    expect(bookingSchema.safeParse({ ...valid, contactPhone: "", specialRequests: "" }).success).toBe(true);
  });
  it("requires a departure id (uuid)", () => {
    expect(bookingSchema.safeParse({ ...valid, departureId: "" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, departureId: "not-a-uuid" }).success).toBe(false);
  });
  it("bounds adults 1-20 and children 0-20 (integers)", () => {
    expect(bookingSchema.safeParse({ ...valid, numAdults: 0 }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, numAdults: 21 }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, numChildren: -1 }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, numChildren: 21 }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, numAdults: 1.5 }).success).toBe(false);
  });
  it("validates contact fields like the backend DTO", () => {
    expect(bookingSchema.safeParse({ ...valid, contactName: "" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, contactName: "x".repeat(121) }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, contactEmail: "not-mail" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, contactPhone: "12345" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, contactPhone: "1".repeat(31) }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, specialRequests: "x".repeat(1001) }).success).toBe(false);
  });
});
