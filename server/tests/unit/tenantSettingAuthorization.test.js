const { authorizeTenantSetting } = require('../../src/middleware/auth');

const invoke = ({ user, key = 'org_security_context', write = false }) => {
  const req = { user, params: { key } };
  const response = { statusCode: 200, body: null };
  const res = {
    status(code) {
      response.statusCode = code;
      return this;
    },
    json(body) {
      response.body = body;
      return this;
    },
  };
  const next = jest.fn();

  authorizeTenantSetting({ write })(req, res, next);
  return { next, response };
};

describe('authorizeTenantSetting', () => {
  test('allows organization users to read and write only their security context', () => {
    expect(invoke({ user: { role: 'org' } }).next).toHaveBeenCalledTimes(1);
    expect(invoke({ user: { role: 'org' }, write: true }).next).toHaveBeenCalledTimes(1);

    const forbidden = invoke({ user: { role: 'org' }, key: 'invoice_number_policy' });
    expect(forbidden.next).not.toHaveBeenCalled();
    expect(forbidden.response.statusCode).toBe(403);
  });

  test('keeps school setting writes restricted to school administrators', () => {
    expect(invoke({ user: { role: 'school', school_access_role: 'finance' } }).next).toHaveBeenCalledTimes(1);

    const financeWrite = invoke({
      user: { role: 'school', school_access_role: 'finance' },
      key: 'invoice_number_policy',
      write: true,
    });
    expect(financeWrite.next).not.toHaveBeenCalled();
    expect(financeWrite.response.statusCode).toBe(403);

    expect(invoke({
      user: { role: 'school', school_access_role: 'admin' },
      key: 'invoice_number_policy',
      write: true,
    }).next).toHaveBeenCalledTimes(1);
  });

  test('allows platform administrators and rejects unauthenticated requests', () => {
    expect(invoke({ user: { role: 'admin' }, key: 'any_setting', write: true }).next).toHaveBeenCalledTimes(1);

    const unauthenticated = invoke({ user: null });
    expect(unauthenticated.next).not.toHaveBeenCalled();
    expect(unauthenticated.response.statusCode).toBe(401);
  });
});
