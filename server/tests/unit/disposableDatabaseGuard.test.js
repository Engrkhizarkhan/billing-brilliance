const { assertDisposableDatabase } = require('../../src/services/disposableDatabaseGuard');
const local={nodeEnv:'test',appEnvironment:'development',db:{database:'fintap_test_hardening'}};
test('reset requires an exact disposable target confirmation',()=>{
  expect(()=>assertDisposableDatabase(local,'fintap_test_hardening')).not.toThrow();
  expect(()=>assertDisposableDatabase(local,'yes')).toThrow('refused');
  expect(()=>assertDisposableDatabase({...local,db:{database:'Fintap'}},'Fintap')).toThrow('refused');
});
test('production runtimes cannot reset even a test-named database',()=>{
  expect(()=>assertDisposableDatabase({...local,nodeEnv:'production'},local.db.database)).toThrow('refused');
  expect(()=>assertDisposableDatabase({...local,appEnvironment:'production'},local.db.database)).toThrow('refused');
});
