const { AppError } = require('../middleware/errorHandler');
const { assertDate, pakistanDate, dueDayEnd } = require('./billingRules');

const orgBillingTerms = ({ dueDate, expireAt, neverExpires, defaultHours }, now = new Date()) => {
  let expiry;
  if (!neverExpires && expireAt) {
    if (typeof expireAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(expireAt)) {
      throw new AppError('Expiry must be an ISO timestamp with a timezone', 400, 'INVALID_EXPIRY_DATE');
    }
    assertDate(expireAt.slice(0, 10));
    expiry = new Date(expireAt);
    if (!Number.isFinite(expiry.getTime()) || expiry <= now) throw new AppError('Expiry must be in the future', 400, 'INVALID_EXPIRY_DATE');
  }
  const due = dueDate ? assertDate(dueDate) : pakistanDate(expiry || new Date(now.getTime() + defaultHours * 3600000));
  if (neverExpires) return { dueDate: due, expiryDate: '9999-12-31 23:59:59' };
  expiry ||= dueDate ? dueDayEnd(due) : new Date(now.getTime() + defaultHours * 3600000);
  if (expiry <= now || pakistanDate(expiry) < due) throw new AppError('Expiry must be in the future and cannot precede the due date', 400, 'INVALID_EXPIRY_DATE');
  return { dueDate: due, expiryDate: expiry.toISOString().slice(0, 19).replace('T', ' ') };
};
module.exports = { orgBillingTerms };
