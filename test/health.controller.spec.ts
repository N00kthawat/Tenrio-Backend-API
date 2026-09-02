import { HealthController } from '../src/health/health.controller';

describe('Health endpoint', () => {
  const controller = new HealthController();

  it('returns ok', () => {
    expect(controller.getHealth()).toEqual({
      status: 'ok',
    });
  });
});
