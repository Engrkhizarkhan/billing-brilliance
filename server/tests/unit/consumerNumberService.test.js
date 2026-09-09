const config = require('../../src/config');
const { allocateConsumerNumber, getCapacity } = require('../../src/services/consumerNumberService');

describe('deterministic consumer-number allocation', () => {
  test.each([
    [14, '1001', 42],
    [24, '2001', 42],
  ])('creates an exact %i digit numeric identifier', async (length, billerCode, sequence) => {
    const query = jest.fn()
      .mockResolvedValueOnce([[{
        id: 'tenant-1', biller_code: billerCode,
        consumer_number_length: length, next_consumer_sequence: sequence,
      }]])
      .mockResolvedValueOnce([{}]);
    const result = await allocateConsumerNumber({ query }, 'tenant-1');
    const width = length - String(config.fintechPrefix).length - billerCode.length;
    expect(result.consumerNumber).toBe(`${config.fintechPrefix}${billerCode}${String(sequence).padStart(width, '0')}`);
    expect(result.consumerNumber).toMatch(/^\d+$/);
    expect(result.consumerNumber).toHaveLength(length);
    expect(query.mock.calls[1]).toEqual([
      'UPDATE tenants SET next_consumer_sequence = ? WHERE id = ?', [sequence + 1, 'tenant-1'],
    ]);
  });

  test('reports capacity for the 14-digit policy', () => {
    expect(getCapacity(14, '1001')).toEqual({ sequenceWidth: 4, maxSequence: 9999 });
  });

  test('fails closed when the namespace is exhausted', async () => {
    const query = jest.fn().mockResolvedValueOnce([[
      { id: 'tenant-1', biller_code: '1001', consumer_number_length: 14, next_consumer_sequence: 10000 },
    ]]);
    await expect(allocateConsumerNumber({ query }, 'tenant-1')).rejects.toMatchObject({ code: 'CONSUMER_NUMBER_EXHAUSTED' });
  });
});
