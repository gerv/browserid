#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

require('./lib/test_env.js');

const
assert = require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
primary = require('./lib/primary.js');

var suite = vows.describe('primary-then-secondary');

start_stop.addStartupBatches(suite);

// this test verifies that a user who has only authenticated with
// an assertion from their primary, may not call restricted apis

const TEST_DOMAIN = 'example.domain',
      TEST_EMAIL = 'testuser2@' + TEST_DOMAIN,
      TEST_ORIGIN = 'http://127.0.0.1:10002';

var primaryUser = new primary({
  email: TEST_EMAIL,
  domain: TEST_DOMAIN
});

// now let's generate an assertion using this user
suite.addBatch({
  "generating an assertion": {
    topic: function() {
      return primaryUser.getAssertion(TEST_ORIGIN);
    },
    "succeeds": function(r, err) {
      assert.isString(r);
    },
    "and logging in with the assertion": {
      topic: function(assertion)  {
        wsapi.post('/wsapi/auth_with_assertion', {
          email: TEST_EMAIL,
          assertion: assertion
        }).call(this);
      },
      "succeeds": function(r, err) {
        var resp = JSON.parse(r.body);
        assert.isObject(resp);
        assert.isTrue(resp.success);
      }
    }
  }
});

suite.addBatch({
  "updating our password": {
    topic: wsapi.post('/wsapi/update_password', { oldpass: '', newpass: 'frobaztastic' }),
    "won't work": function(r) {
      assert.strictEqual(r.code, 400);
    }
  },
  "certifying a key": {
    topic: wsapi.post('/wsapi/cert_key', { email: TEST_EMAIL, pubkey: 'fake_key' }),
    "won't work": function(r) {
      assert.strictEqual(r.code, 400);
    }
  },
  "listing emails": {
    topic: wsapi.get('/wsapi/list_emails'),
    "works fine": function(r) {
      assert.strictEqual(r.code, 200);
      assert.equal(Object.keys(JSON.parse(r.body)).length, 1);
    }
  }
});

// shut the server down and cleanup
start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
