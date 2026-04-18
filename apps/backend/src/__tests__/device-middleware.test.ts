import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { deviceMiddleware } from '../middleware/device.js';

function makeReq(deviceId: string | undefined): Partial<Request> {
  return {
    headers: deviceId ? { 'x-device-id': deviceId } : {},
  };
}

const mockRes = () => {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
};

describe('deviceMiddleware', () => {
  it('passes valid UUID v4 and attaches to req.deviceId', () => {
    const req = makeReq('550e8400-e29b-41d4-a716-446655440000') as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    deviceMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.deviceId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('rejects request with no X-Device-ID header', () => {
    const req = makeReq(undefined) as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    deviceMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
  });

  it('rejects an empty string', () => {
    const req = makeReq('') as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    deviceMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a non-UUID v4 string', () => {
    const req = makeReq('not-a-uuid') as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    deviceMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('accepts uppercase UUID', () => {
    const req = makeReq('550E8400-E29B-41D4-A716-446655440000') as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    deviceMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
