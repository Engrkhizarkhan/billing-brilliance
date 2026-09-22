const assertDisposableDatabase = (config, confirmation = process.env.ALLOW_DISPOSABLE_DB_RESET) => {
  if (config.nodeEnv === 'production' || config.appEnvironment === 'production'
    || !/^(fintap|billing)_(test|local|ci|sandbox)(_[a-z0-9]+)*$/i.test(config.db.database)
    || confirmation !== config.db.database) {
    throw new Error('Destructive database operation refused. Use a disposable fintap_test/local/ci/sandbox database, a non-production runtime, and set ALLOW_DISPOSABLE_DB_RESET to its exact name.');
  }
};
module.exports = { assertDisposableDatabase };
