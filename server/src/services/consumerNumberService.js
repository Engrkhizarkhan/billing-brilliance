const config = require('../config');
const { AppError } = require('../middleware/errorHandler');

const SUPPORTED_LENGTHS = new Set([14, 20, 24]);

const getCapacity = (length, billerCode) => {
  const sequenceWidth = Number(length) - String(config.fintechPrefix).length - String(billerCode).length;
  return {
    sequenceWidth,
    maxSequence: sequenceWidth < 1 ? 0 : (10 ** sequenceWidth) - 1,
  };
};

const allocateConsumerNumber = async (connection, tenantId) => {
  const [rows] = await connection.query(
    `SELECT id, biller_code, consumer_number_length, next_consumer_sequence
     FROM tenants WHERE id = ? AND deleted_at IS NULL FOR UPDATE`,
    [tenantId]
  );
  if (rows.length === 0) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');

  const tenant = rows[0];
  const length = Number(tenant.consumer_number_length || 20);
  if (!SUPPORTED_LENGTHS.has(length)) {
    throw new AppError('Tenant consumer-number policy is invalid', 500, 'INVALID_CONSUMER_POLICY');
  }
  if (!/^\d{6}$/.test(String(config.fintechPrefix)) || !/^\d+$/.test(String(tenant.biller_code))) {
    throw new AppError('Consumer-number namespace must be numeric', 422, 'INVALID_CONSUMER_NAMESPACE');
  }

  const { sequenceWidth, maxSequence } = getCapacity(length, tenant.biller_code);
  const sequence = Number(tenant.next_consumer_sequence || 1);
  if (sequenceWidth < 1 || sequence > maxSequence) {
    throw new AppError(`Consumer-number capacity exhausted for ${length}-digit format`, 409, 'CONSUMER_NUMBER_EXHAUSTED');
  }

  const consumerNumber = `${config.fintechPrefix}${tenant.biller_code}${String(sequence).padStart(sequenceWidth, '0')}`;
  if (consumerNumber.length !== length || !/^\d+$/.test(consumerNumber)) {
    throw new AppError('Generated consumer number violates tenant policy', 500, 'INVALID_CONSUMER_NUMBER');
  }

  await connection.query('UPDATE tenants SET next_consumer_sequence = ? WHERE id = ?', [sequence + 1, tenantId]);
  return { consumerNumber, sequence, length, billerCode: tenant.biller_code, maxSequence };
};

module.exports = { allocateConsumerNumber, getCapacity, SUPPORTED_LENGTHS };
