'use strict';
/*
 * Global setup code for mocha tests
 * note: I think this works (executes first) because
 * it is not inside of a describe block.   It still must
 * stay within the '${ROOT}/test' folder.
 */
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const mocha_1 = require('mocha');
// import db from '../db';
const server_1 = __importDefault(require('../server'));
(0, mocha_1.before)(function () {
  return __awaiter(this, void 0, void 0, function* () {
    this.timeout(5000);
    yield server_1.default.isReadyPromise;
    // await clearDatabase(db);
  });
});
(0, mocha_1.afterEach)(function () {
  return __awaiter(this, void 0, void 0, function* () {
    // await clearDatabase(db);
  });
});
//# sourceMappingURL=mochaSetup.test.js.map
