jest.mock('../../src/config', () => ({ fintechPrefix: '105172' }));
jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));
const config = require('../../src/config');
const { pool } = require('../../src/config/database');
const { resolveOneBillConsumer } = require('../../src/services/oneBillConsumerService');

beforeEach(() => { jest.resetAllMocks(); config.fintechPrefix = '105172'; });

test.each(['10010001', '10010000000001', '100200000000000001', '00000001'])('restores the prefix without losing digits for %s', async (number) => {
  expect(await resolveOneBillConsumer(number)).toBe(`105172${number}`);
  expect(pool.query).not.toHaveBeenCalled();
});

test.each(['10517210010000000001', '105172100200000000000001'])('keeps the complete number %s', async (number) => {
  expect(await resolveOneBillConsumer(number)).toBe(number);
  expect(pool.query).not.toHaveBeenCalled();
});

test('preserves a full 14-digit consumer without adding the prefix twice', async () => {
  pool.query.mockResolvedValueOnce([[{ consumer_number: '10517210010001' }]]);
  expect(await resolveOneBillConsumer('10517210010001')).toBe('10517210010001');
  expect(pool.query.mock.calls[0][1]).toEqual(['10517210010001', '10517210517210010001', '10517210010001', '10517210517210010001']);
});

test('restores a shortened number that happens to start with the prefix', async () => {
  pool.query.mockResolvedValueOnce([[{ consumer_number: '10517210517210010001' }]]);
  expect(await resolveOneBillConsumer('10517210010001')).toBe('10517210517210010001');
});

test('rejects a collision instead of selecting an arbitrary financial account', async () => {
  pool.query.mockResolvedValueOnce([[{ consumer_number: '10517210010001' }, { consumer_number: '10517210517210010001' }]]);
  await expect(resolveOneBillConsumer('10517210010001')).rejects.toMatchObject({ code: 'AMBIGUOUS_CONSUMER_NUMBER' });
});

test('a nonmatching namespace cannot become an overlength consumer', async () => {
  expect(await resolveOneBillConsumer('999999100200000000000001')).toBeNull();
  expect(pool.query).not.toHaveBeenCalled();
});

test('uses configuration rather than a hard-coded prefix and fails closed if missing', async () => {
  config.fintechPrefix = '654321';
  expect(await resolveOneBillConsumer('10010001')).toBe('65432110010001');
  config.fintechPrefix = '';
  await expect(resolveOneBillConsumer('10010001')).rejects.toMatchObject({ code: 'INVALID_CONSUMER_NAMESPACE' });
});
