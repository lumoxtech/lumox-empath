import assert from 'node:assert/strict';
import {coach} from '../index.mjs';
const d=coach({text:'I am travelling and only have a hotel room'}, {emotionalHistory:false});
assert.equal(d.response.strategy,'simplify_schedule');
console.log(d.response.action);
